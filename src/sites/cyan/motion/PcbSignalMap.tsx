import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type PointerEvent,
} from "react";
import { useReducedMotion } from "framer-motion";
import { otherWork, selectedWork } from "@/data/portfolio";
import { useMotionPaused } from "@/lib/motion-pause";
import "./pcb-signal-map.css";

/*
 * The Signal map as a circuit board. Projects are chips on the left, tools are
 * parts on the right, and every connection is a copper trace: level out of its
 * chip, upright in a lane of the shared channel, level into its tool, with 45°
 * corners and a via at each bend. The board is a pure function of its width,
 * so the HTML parts and the SVG copper always agree and the routing can be
 * tested without a browser.
 */

type MapProject = { name: string; tools: string[] };

// The same data as the original map: the selected work and the first two other projects.
const MAP_PROJECTS: MapProject[] = [
  ...selectedWork.map((p) => ({ name: p.name, tools: [...p.stack] })),
  ...otherWork
    .slice(0, 2)
    .map((p) => ({ name: p.name.split(" / ")[0], tools: p.tech.split(" / ") })),
];
const MAP_TOOLS = Array.from(new Set(MAP_PROJECTS.flatMap((p) => p.tools)));

type Point = { x: number; y: number };
type Box = { x: number; y: number; w: number; h: number };
/** A via sits on its trace; `at` is how far along the trace it is, from 0 to 1. */
type Via = Point & { at: number };
type Route = { d: string; length: number; vias: Via[] };
/** One trace's ends across the flow: where it leaves its chip and where it meets its tool. */
type LaneRequest = { from: number; to: number };
type BoardSize = "wide" | "compact";
type Selection = { kind: "project" | "tool"; name: string } | null;

type Trace = Route & {
  id: string;
  project: string;
  tool: string;
  /** Position in the draw-on sequence. */
  order: number;
  /** Null for a trace that runs level all the way. */
  lane: number | null;
  /** The chip pin the trace leaves from and the tool pad it ends on. */
  pin: Box;
  pad: Box;
};

type BoardLayout = {
  size: BoardSize;
  width: number;
  height: number;
  via: number;
  readout: { x: number; y: number; w: number; align: "start" | "center" };
  labels: { y: number; projects: number; tools: number };
  holes: (Point & { r: number })[];
  projects: { name: string; tools: string[]; ref: string; box: Box }[];
  tools: { name: string; users: string[]; box: Box }[];
  traces: Trace[];
};

type Metrics = {
  /** Inner margin of the board. */
  pad: number;
  /** Room above the parts for the readout and the column labels. */
  head: number;
  projectW: number;
  chipH: number;
  /** Least space between two project chips. */
  chipGap: number;
  /** Between neighbouring pins on a chip. */
  pinPitch: number;
  /** How far a pin or pad stands out from its part. */
  pinLen: number;
  pinH: number;
  toolW: number;
  toolH: number;
  toolGap: number;
  /** Between the pads of a tool that more than one project uses. */
  padSpread: number;
  chamfer: number;
  via: number;
  /** Least level run before a trace may turn. */
  stub: number;
  laneMin: number;
  laneMax: number;
  /** Clearance between two traces that share a lane. */
  gap: number;
  /** A pin and a pad closer than this, across the flow, would read as one line. */
  sep: number;
};

const COMPACT_BELOW = 600;

const WIDE: Metrics = {
  pad: 20,
  head: 64,
  projectW: 196,
  chipH: 56,
  chipGap: 16,
  pinPitch: 10,
  pinLen: 6,
  pinH: 4,
  toolW: 156,
  toolH: 24,
  toolGap: 6,
  padSpread: 8,
  chamfer: 6,
  via: 2.5,
  stub: 32,
  laneMin: 8,
  laneMax: 26,
  gap: 14,
  sep: 6,
};

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const round = (value: number) => Math.round(value * 100) / 100;
const num = (value: number) => String(round(value));

/** Phones keep both columns side by side on a tall, narrow board with finer copper. */
function compactMetrics(width: number): Metrics {
  return {
    pad: 10,
    head: 84,
    // The least widths still fit "AxiomQuant" and "Jetpack Compose" on a 320px phone.
    projectW: clamp(Math.round(width * 0.31), 96, 112),
    chipH: 46,
    chipGap: 10,
    pinPitch: 8,
    pinLen: 4,
    pinH: 3,
    toolW: clamp(Math.round(width * 0.34), 108, 124),
    toolH: 24,
    toolGap: 6,
    padSpread: 8,
    chamfer: 3,
    via: 1.7,
    stub: 8,
    laneMin: 5,
    laneMax: 12,
    gap: 9,
    sep: 5,
  };
}

/**
 * One trace from a chip pin to a tool pad: level to the lane, a 45° corner,
 * upright in the lane, another corner, then level into the pad. A via marks
 * the middle of each corner.
 */
function routeTrace(from: Point, to: Point, laneX: number, chamfer: number): Route {
  const rise = to.y - from.y;
  if (rise === 0) {
    return { d: `M${num(from.x)} ${num(from.y)}H${num(to.x)}`, length: to.x - from.x, vias: [] };
  }
  const dir = Math.sign(rise);
  const c = Math.min(chamfer, Math.abs(rise) / 2);
  const lead = laneX - c - from.x;
  const tail = to.x - laneX - c;
  const corner = c * Math.SQRT2;
  const upright = Math.abs(rise) - 2 * c;
  const length = lead + 2 * corner + upright + tail;
  if (upright === 0) {
    // Too small a step for two corners: a single 45° jog with one via.
    return {
      d: `M${num(from.x)} ${num(from.y)}H${num(laneX - c)}L${num(laneX + c)} ${num(to.y)}H${num(to.x)}`,
      length,
      vias: [{ x: round(laneX), y: round((from.y + to.y) / 2), at: (lead + corner) / length }],
    };
  }
  return {
    d:
      `M${num(from.x)} ${num(from.y)}H${num(laneX - c)}L${num(laneX)} ${num(from.y + dir * c)}` +
      `V${num(to.y - dir * c)}L${num(laneX + c)} ${num(to.y)}H${num(to.x)}`,
    length,
    vias: [
      { x: round(laneX - c / 2), y: round(from.y + (dir * c) / 2), at: (lead + corner / 2) / length },
      { x: round(laneX + c / 2), y: round(to.y - (dir * c) / 2), at: (length - tail - corner / 2) / length },
    ],
  };
}

/**
 * Gives each bent trace a lane in the channel, numbered from the projects'
 * side. Traces whose upright runs are far enough apart share a lane, the way a
 * left-edge channel router packs tracks. Level traces need no lane (null).
 */
function assignLanes(links: readonly LaneRequest[], gap: number, sep: number): (number | null)[] {
  const lo = links.map((link) => Math.min(link.from, link.to));
  const hi = links.map((link) => Math.max(link.from, link.to));
  const bent = links.map((_, i) => i).filter((i) => links[i].from !== links[i].to);
  const overlap = (a: number, b: number) => lo[a] < hi[b] + gap && lo[b] < hi[a] + gap;
  const down = (i: number) => links[i].to > links[i].from;

  // right[a] holds the traces whose lane must lie to the right of a's lane.
  const right = links.map(() => new Set<number>());
  const reaches = (start: number, target: number) => {
    const seen = new Set<number>();
    const stack = [start];
    while (stack.length) {
      const node = stack.pop() as number;
      if (node === target) return true;
      if (seen.has(node)) continue;
      seen.add(node);
      stack.push(...right[node]);
    }
    return false;
  };
  // An ordering is dropped if it would contradict one already made.
  const order = (a: number, b: number) => {
    if (a !== b && !reaches(b, a)) right[a].add(b);
  };

  // A pin level with another trace's pad: the first trace must turn before the
  // second one's level run begins, or the two runs would lie on top of each other.
  for (const a of bent) {
    for (const b of bent) {
      if (a !== b && Math.abs(links[a].from - links[b].to) < sep) order(a, b);
    }
  }
  // Two traces heading the same way nest without crossing when the one that
  // starts further back (higher, going down; lower, going up) turns later.
  for (const a of bent) {
    for (const b of bent) {
      if (a >= b || down(a) !== down(b) || !overlap(a, b)) continue;
      const aBehind = down(a) ? links[a].from < links[b].from : links[a].from > links[b].from;
      if (aBehind) order(b, a);
      else order(a, b);
    }
  }

  const lane: (number | null)[] = links.map(() => null);
  const waiting = new Map<number, number>(bent.map((i) => [i, 0]));
  for (const a of bent) for (const b of right[a]) waiting.set(b, (waiting.get(b) ?? 0) + 1);
  const ready = bent.filter((i) => waiting.get(i) === 0);
  while (ready.length) {
    // The earliest-starting span goes first, as in the left-edge algorithm.
    ready.sort((a, b) => lo[a] - lo[b] || hi[a] - hi[b] || a - b);
    const next = ready.shift() as number;
    const after = bent.filter((a) => right[a].has(next)).map((a) => (lane[a] ?? 0) + 1);
    let k = Math.max(0, ...after);
    while (bent.some((other) => lane[other] === k && overlap(other, next))) k++;
    lane[next] = k;
    for (const b of right[next]) {
      const count = (waiting.get(b) ?? 0) - 1;
      waiting.set(b, count);
      if (count === 0) ready.push(b);
    }
  }
  return lane;
}

/** The whole board for a given width: parts, pins, pads, lanes and traces. */
function layoutBoard(width: number, projects: readonly MapProject[] = MAP_PROJECTS): BoardLayout {
  const size: BoardSize = width < COMPACT_BELOW ? "compact" : "wide";
  const m = size === "compact" ? compactMetrics(width) : WIDE;
  const tools = Array.from(new Set(projects.flatMap((p) => p.tools)));
  const users = new Map(
    tools.map((tool) => [tool, projects.flatMap((p, i) => (p.tools.includes(tool) ? [i] : []))]),
  );
  const toolPitch = m.toolH + m.toolGap;
  const partsH = Math.max(
    tools.length * toolPitch - m.toolGap,
    projects.length * (m.chipH + m.chipGap) - m.chipGap,
  );
  const top = m.head;
  const x0 = m.pad + m.projectW;
  const x1 = width - m.pad - m.toolW;
  const xs = x0 + m.pinLen;
  const xe = x1 - m.pinLen;

  const toolTop = (row: number) => top + row * toolPitch;
  // A shared tool spreads its pads in the order of its projects, top to bottom.
  const padY = (tool: string, project: number) => {
    const list = users.get(tool) ?? [project];
    const middle = toolTop(tools.indexOf(tool)) + m.toolH / 2;
    return middle + (list.indexOf(project) - (list.length - 1) / 2) * m.padSpread;
  };
  const offsets = (count: number) =>
    Array.from({ length: count }, (_, k) => (k - (count - 1) / 2) * m.pinPitch);

  // A chip's pins meet its tools in the same top-to-bottom order, so its own traces never cross.
  const pins = projects.map((project, i) =>
    project.tools.map((tool) => ({ tool, to: padY(tool, i) })).sort((a, b) => a.to - b.to),
  );
  const pads = pins.flatMap((list, i) => list.map((pin) => ({ project: i, tool: pin.tool, y: pin.to })));
  // Each chip tries every height that runs one of its traces level and keeps
  // the one with the least upright travel, where a pin level with another
  // trace's pad costs extra: the two runs would read as one broken line.
  const centres = pins.map((list, i) => {
    const shift = offsets(list.length);
    const score = (centre: number) =>
      list.reduce((sum, pin, k) => {
        const y = centre + shift[k];
        const clashes = pads.filter(
          (pad) => !(pad.project === i && pad.tool === pin.tool) && Math.abs(pad.y - y) < m.sep,
        ).length;
        return sum + Math.abs(y - pin.to) + clashes * 2 * toolPitch;
      }, 0);
    const options = list.map((pin, k) => pin.to - shift[k]).sort((a, b) => a - b);
    let best = options[0] ?? top + partsH / 2;
    for (const option of options) if (score(option) < score(best)) best = option;
    return best;
  });
  const step = m.chipH + m.chipGap;
  const lowest = top + m.chipH / 2;
  const highest = top + partsH - m.chipH / 2;
  for (let k = 0; k < centres.length; k++) {
    centres[k] = clamp(centres[k], lowest, highest);
    if (k > 0) centres[k] = Math.max(centres[k], centres[k - 1] + step);
  }
  for (let k = centres.length - 1; k >= 0; k--) {
    centres[k] = Math.min(centres[k], k === centres.length - 1 ? highest : centres[k + 1] - step);
  }
  if (centres.length && centres[0] < lowest) {
    centres.forEach((_, k) => (centres[k] = Math.round(top + ((k + 0.5) * partsH) / centres.length)));
  }

  const links = pins.flatMap((list, i) => {
    const shift = offsets(list.length);
    return list.map((pin, k) => ({ project: i, tool: pin.tool, from: centres[i] + shift[k], to: pin.to }));
  });
  const lanes = assignLanes(links, m.gap, m.sep);
  const count = Math.max(0, ...lanes.map((lane) => (lane ?? -1) + 1));
  const span = xe - xs;
  let pitch = count > 1 ? Math.min(m.laneMax, (span - 2 * m.stub) / (count - 1)) : 0;
  if (count > 1 && pitch < m.laneMin) {
    pitch = Math.max(0, Math.min(m.laneMin, (span - 2 * (m.chamfer + 1)) / (count - 1)));
  }
  // The lanes form one bus in the middle of the channel.
  const laneX = (lane: number) => round(xs + span / 2 + (lane - (count - 1) / 2) * pitch);

  const traces: Trace[] = links.map((link, order) => {
    const lane = lanes[order];
    const route = routeTrace(
      { x: xs, y: link.from },
      { x: xe, y: link.to },
      lane === null ? xs + span / 2 : laneX(lane),
      m.chamfer,
    );
    const project = projects[link.project].name;
    return {
      id: `${project}→${link.tool}`,
      project,
      tool: link.tool,
      order,
      lane,
      ...route,
      pin: { x: x0, y: link.from - m.pinH / 2, w: m.pinLen, h: m.pinH },
      pad: { x: xe, y: link.to - m.pinH / 2, w: m.pinLen, h: m.pinH },
    };
  });

  const height = top + partsH + m.pad;
  const inset = m.pad / 2;
  const hole = size === "wide" ? 3.5 : 2.5;
  return {
    size,
    width,
    height,
    via: m.via,
    readout: { x: m.pad, y: 10, w: width - 2 * m.pad, align: size === "wide" ? "center" : "start" },
    labels: { y: top - 16, projects: m.pad, tools: x1 },
    holes: [
      { x: inset, y: inset, r: hole },
      { x: width - inset, y: inset, r: hole },
      { x: inset, y: height - inset, r: hole },
      { x: width - inset, y: height - inset, r: hole },
    ],
    projects: projects.map((project, i) => ({
      name: project.name,
      tools: project.tools,
      ref: `U${i + 1}`,
      box: { x: m.pad, y: centres[i] - m.chipH / 2, w: m.projectW, h: m.chipH },
    })),
    tools: tools.map((tool, row) => ({
      name: tool,
      users: (users.get(tool) ?? []).map((i) => projects[i].name),
      box: { x: x1, y: toolTop(row), w: m.toolW, h: m.toolH },
    })),
    traces,
  };
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** The readout's two lines for a selection, or the board totals when nothing is selected. */
function describeSelection(selection: Selection, projects: readonly MapProject[] = MAP_PROJECTS) {
  if (!selection) {
    const tools = new Set(projects.flatMap((p) => p.tools));
    const links = projects.reduce((sum, p) => sum + p.tools.length, 0);
    return {
      value: `${plural(projects.length, "project")} · ${plural(tools.size, "tool")}`,
      detail: plural(links, "connection"),
    };
  }
  if (selection.kind === "project") {
    const used = projects.find((p) => p.name === selection.name)?.tools ?? [];
    return { value: `${selection.name} · ${plural(used.length, "tool")}`, detail: used.join(", ") };
  }
  const users = projects.filter((p) => p.tools.includes(selection.name)).map((p) => p.name);
  return {
    value: `${selection.name} · used in ${plural(users.length, "project")}`,
    detail: users.join(", "),
  };
}

const DEFAULT_WIDTH = 960;
const STAGGER = 30;
const DRAW = 700;

/** The share of its duration the house easing takes to cover `progress` of the way. */
function easedTime(progress: number) {
  // cubic-bezier(0.16, 1, 0.3, 1) has y(u) = 1 - (1 - u)^3, so u has a closed form.
  const u = 1 - Math.cbrt(1 - progress);
  return 3 * (1 - u) ** 2 * u * 0.16 + 3 * (1 - u) * u ** 2 * 0.3 + u ** 3;
}

const slug = (name: string) => name.replace(/\W/g, "");
const same = (a: Selection, b: Selection) => a?.kind === b?.kind && a?.name === b?.name;

export function PcbSignalMap() {
  const boardRef = useRef<HTMLDivElement>(null);
  // The part holding keyboard focus, which the selection returns to when the pointer leaves.
  const focused = useRef<Selection>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [selection, setSelection] = useState<Selection>(null);
  const [reveal, setReveal] = useState<"waiting" | "playing" | "done">("waiting");
  const reduced = useReducedMotion();
  const paused = useMotionPaused();
  const still = Boolean(reduced) || paused;
  const layout = useMemo(() => layoutBoard(width), [width]);
  const readout = describeSelection(selection);

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const measure = () => {
      const next = Math.round(board.clientWidth);
      if (next > 0) setWidth(next);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    return () => observer.disconnect();
  }, []);

  // Without motion the board is simply drawn, and it never replays when motion returns.
  useEffect(() => {
    if (still) setReveal("done");
  }, [still]);

  useEffect(() => {
    if (reveal !== "waiting" || still) return;
    const board = boardRef.current;
    if (!board || typeof IntersectionObserver === "undefined") {
      setReveal("done");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        setReveal("playing");
      },
      { threshold: 0.15 },
    );
    observer.observe(board);
    return () => observer.disconnect();
  }, [reveal, still]);

  // Once drawn, the board settles so a later resize doesn't replay anything.
  useEffect(() => {
    if (reveal !== "playing") return;
    const timer = setTimeout(() => setReveal("done"), layout.traces.length * STAGGER + DRAW + 240);
    return () => clearTimeout(timer);
  }, [reveal, layout.traces.length]);

  const isLit = (trace: Trace) =>
    selection !== null &&
    (selection.kind === "project" ? trace.project === selection.name : trace.tool === selection.name);
  const lit = layout.traces.filter(isLit);
  const litProjects = new Set(lit.map((trace) => trace.project));
  const litTools = new Set(lit.map((trace) => trace.tool));
  if (selection?.kind === "project") litProjects.add(selection.name);
  if (selection?.kind === "tool") litTools.add(selection.name);
  const selectionKey = selection ? `${selection.kind}:${selection.name}` : "";

  const partProps = (part: NonNullable<Selection>) => ({
    type: "button" as const,
    "aria-pressed": same(selection, part),
    // A touch that lands while scrolling shouldn't select; a tap selects through onClick.
    onPointerEnter: (event: PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType !== "touch") setSelection(part);
    },
    onClick: () => setSelection(part),
    onFocus: () => {
      focused.current = part;
      setSelection(part);
    },
    onBlur: (event: FocusEvent<HTMLButtonElement>) => {
      focused.current = null;
      if (!boardRef.current?.contains(event.relatedTarget as Node | null)) setSelection(null);
    },
  });

  return (
    <section id="signal" tabIndex={-1} className="cyan-signal section-wrap">
      <div className="section-heading">
        <h2>
          What each project runs on<span className="heading-period">.</span>
        </h2>
        <p>
          Choose a project to trace its stack, or a tool to see every project
          that uses it.
        </p>
      </div>
      <div
        ref={boardRef}
        className={`pcb-board${selection ? " has-focus" : ""}`}
        data-size={layout.size}
        data-flow={selection?.kind === "tool" ? "in" : "out"}
        data-reveal={still ? "done" : reveal}
        data-still={still ? "" : undefined}
        onPointerLeave={(event) => {
          if (event.pointerType !== "touch") setSelection(focused.current);
        }}
      >
        <div className="pcb-stage" style={{ height: layout.height }}>
          <svg
            className="pcb-copper"
            width={layout.width}
            height={layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            aria-hidden="true"
            focusable="false"
          >
            {layout.holes.map((hole, k) => (
              <circle key={k} className="pcb-hole" cx={hole.x} cy={hole.y} r={hole.r} />
            ))}
            <g>
              {layout.traces.map((trace) => (
                <path
                  key={trace.id}
                  className={`pcb-trace${isLit(trace) ? " is-lit" : ""}`}
                  d={trace.d}
                  pathLength={1}
                  style={{ "--i": trace.order } as CSSProperties}
                />
              ))}
            </g>
            {/* The lit copy of every trace sits above all the dim ones. */}
            <g>
              {layout.traces.map((trace) => (
                <path
                  key={trace.id}
                  className={`pcb-lit${isLit(trace) ? " is-lit" : ""}`}
                  d={trace.d}
                  pathLength={1}
                  data-project={trace.project}
                  data-tool={trace.tool}
                  style={{ "--i": trace.order } as CSSProperties}
                />
              ))}
            </g>
            <g>
              {layout.traces.flatMap((trace) =>
                trace.vias.map((via, k) => (
                  <circle
                    key={`${trace.id}:${k}`}
                    className={`pcb-via${isLit(trace) ? " is-lit" : ""}`}
                    cx={via.x}
                    cy={via.y}
                    r={layout.via}
                    style={
                      {
                        "--d": `${Math.round(trace.order * STAGGER + easedTime(via.at) * DRAW)}ms`,
                      } as CSSProperties
                    }
                  />
                )),
              )}
            </g>
            <g>
              {layout.traces.flatMap((trace) =>
                [trace.pin, trace.pad].map((box, k) => (
                  <rect
                    key={`${trace.id}:${k}`}
                    className={`pcb-pad${isLit(trace) ? " is-lit" : ""}`}
                    x={box.x}
                    y={box.y}
                    width={box.w}
                    height={box.h}
                  />
                )),
              )}
            </g>
            {/* Keyed by the selection, so each new selection sends a fresh pulse. */}
            {!still && (
              <g>
                {lit.map((trace) => (
                  <path
                    key={`${selectionKey}:${trace.id}`}
                    className="pcb-pulse"
                    d={trace.d}
                    pathLength={1}
                  />
                ))}
              </g>
            )}
          </svg>

          <p
            className="pcb-readout"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-align={layout.readout.align}
            style={{ left: layout.readout.x, top: layout.readout.y, width: layout.readout.w }}
          >
            <span className="pcb-readout-value">{readout.value}</span>
            <span className="sr-only">. </span>
            <span className="pcb-readout-detail">{readout.detail}</span>
          </p>
          <span
            className="pcb-label"
            aria-hidden="true"
            style={{ left: layout.labels.projects, top: layout.labels.y }}
          >
            Projects
          </span>
          <span
            className="pcb-label"
            aria-hidden="true"
            style={{ left: layout.labels.tools, top: layout.labels.y }}
          >
            Tools
          </span>

          <ul className="pcb-parts" aria-label="Projects">
            {layout.projects.map((project) => {
              const part = { kind: "project" as const, name: project.name };
              const id = `signal-${slug(project.name)}`;
              return (
                <li key={project.name}>
                  <button
                    {...partProps(part)}
                    className={`pcb-chip pcb-ic${litProjects.has(project.name) ? " is-lit" : ""}${
                      same(selection, part) ? " is-active" : ""
                    }`}
                    style={{
                      left: project.box.x,
                      top: project.box.y,
                      width: project.box.w,
                      height: project.box.h,
                    }}
                    aria-describedby={id}
                  >
                    <span className="pcb-ref" aria-hidden="true">
                      {project.ref}
                    </span>
                    <span className="pcb-name">{project.name}</span>
                  </button>
                  <span id={id} hidden>
                    Uses {project.tools.join(", ")}
                  </span>
                </li>
              );
            })}
          </ul>
          <ul className="pcb-parts" aria-label="Tools">
            {layout.tools.map((tool) => {
              const part = { kind: "tool" as const, name: tool.name };
              const id = `signal-tool-${slug(tool.name)}`;
              return (
                <li key={tool.name}>
                  <button
                    {...partProps(part)}
                    className={`pcb-chip pcb-part${litTools.has(tool.name) ? " is-lit" : ""}${
                      same(selection, part) ? " is-active" : ""
                    }`}
                    style={{ left: tool.box.x, top: tool.box.y, width: tool.box.w, height: tool.box.h }}
                    aria-describedby={id}
                  >
                    <span className="pcb-name">{tool.name}</span>
                  </button>
                  <span id={id} hidden>
                    Used in {tool.users.join(", ")}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- the board's pure layout is exported for tests
export { MAP_PROJECTS, MAP_TOOLS, assignLanes, describeSelection, layoutBoard, routeTrace };
export type { BoardLayout, LaneRequest, MapProject, Route, Selection, Trace };

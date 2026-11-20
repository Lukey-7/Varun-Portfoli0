import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { ORDO_URL } from "@/lib/sites";
import { pointerLight } from "../kit";
import { formatMonth, kindLabel, pad2, readKinds, readLog, readRoles, type LogEntry, type LogKind } from "./data";
import { useStill } from "./hooks";
import { WaveGlyph } from "./WaveGlyph";
import { buildTrace, lengthAtY, pointAtLength, type Trace, type WaveKind } from "./waves";

/*
 * The signature of the page: the log as an oscilloscope trace. A rail runs
 * down the left of the entries and the beam writes it as the visitor scrolls,
 * drawing each entry's waveform just above its node and lighting the node as
 * it arrives. A sticky readout follows the beam (or whatever is being
 * probed) with a minimap of the whole trace. Kind chips re-lay the list and
 * the scope re-acquires. The trace ends on a live node for the present role.
 *
 * Reduced motion and the site-wide pause show the whole trace written and
 * every node lit; nothing here loops except CSS, which lab.css pauses.
 */

type Filter = LogKind | "all";

type Row =
  | { type: "year"; id: string; year: string }
  | { type: "entry"; id: string; entry: LogEntry; index: number }
  | { type: "now"; id: string };

interface Measured {
  id: string;
  kind: WaveKind;
  y: number;
}

/** Where the beam is read: this far down the viewport. */
const READ_LINE = 0.62;
const NOW_ID = "log-now";

/** The node's offset from the top of the track, through any positioned rows between. */
function offsetWithin(element: HTMLElement, container: HTMLElement) {
  let y = 0;
  let x = 0;
  let node: HTMLElement | null = element;
  while (node && node !== container) {
    y += node.offsetTop;
    x += node.offsetLeft;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

const linkFor = (entry: LogEntry) => {
  if (entry.href) {
    const github = entry.href.includes("github.com");
    return { href: entry.href, label: github ? "Source on GitHub" : "Open link", external: true };
  }
  if (entry.to) return { href: `${ORDO_URL}${entry.to}`, label: "More on the monochrome site", external: false };
  return null;
};

export function SignalTrace({ now }: { now: Date }) {
  const still = useStill();
  const entries = useMemo(() => readLog(now), [now]);
  const kinds = useMemo(() => readKinds(entries), [entries]);
  const current = useMemo(() => readRoles(now).find((role) => role.current), [now]);
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(entries.filter((entry) => entry.role?.current).map((entry) => entry.id)),
  );
  const [probe, setProbe] = useState<string | null>(null);
  const [lit, setLit] = useState(0);
  const [map, setMap] = useState<{ height: number; nodes: Measured[] }>({ height: 1, nodes: [] });
  const [path, setPath] = useState("");

  const visible = useMemo(
    () => (filter === "all" ? entries : entries.filter((entry) => entry.kind === filter)),
    [entries, filter],
  );

  const rows = useMemo(() => {
    const list: Row[] = [];
    let year = "";
    visible.forEach((entry, index) => {
      if (entry.year !== year) {
        year = entry.year;
        list.push({ type: "year", id: `year-${year}`, year });
      }
      list.push({ type: "entry", id: entry.id, entry, index });
    });
    list.push({ type: "now", id: NOW_ID });
    return list;
  }, [visible]);

  /* ------------------------------------------------------------ the beam */

  const trackRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLElement>());
  const traceRef = useRef<Trace | null>(null);
  const nodeYs = useRef<number[]>([]);
  const heightRef = useRef(1);
  const hotRef = useRef(0.08);
  const litRef = useRef(0);
  const stillRef = useRef(still);
  stillRef.current = still;

  const target = useMotionValue(0);
  const beam = useSpring(target, { stiffness: 120, damping: 26, mass: 0.7 });
  const drawn = useMotionValue(0);
  const hotOffset = useMotionValue(0);
  const headX = useMotionValue(0);
  const headY = useMotionValue(0);
  const headOpacity = useMotionValue(0);
  const cursorY = useMotionValue(0);
  const cursorTop = useTransform(cursorY, (y) => `${Math.min(100, Math.max(0, (y / heightRef.current) * 100))}%`);

  const apply = useCallback(
    (length: number) => {
      const trace = traceRef.current;
      if (!trace) return;
      const at = Math.max(0, Math.min(trace.total, length));
      const fraction = at / trace.total;
      drawn.set(fraction);
      hotOffset.set(hotRef.current - fraction);
      const point = pointAtLength(trace, at);
      headX.set(point.x);
      headY.set(point.y);
      headOpacity.set(at > 1 && at < trace.total - 1 ? 1 : 0);
      cursorY.set(point.y);
      const ys = nodeYs.current;
      let count = 0;
      while (count < ys.length && ys[count] <= point.y + 2) count++;
      if (count !== litRef.current) {
        litRef.current = count;
        setLit(count);
      }
    },
    [drawn, hotOffset, headX, headY, headOpacity, cursorY],
  );

  /** Turns the scroll position into how much of the trace is written. */
  const update = useCallback(() => {
    const track = trackRef.current;
    const trace = traceRef.current;
    if (!track || !trace) return;
    if (stillRef.current) {
      target.jump(trace.total);
      beam.jump(trace.total);
      apply(trace.total);
      return;
    }
    const readY = window.innerHeight * READ_LINE - track.getBoundingClientRect().top;
    target.set(lengthAtY(trace, readY));
  }, [apply, beam, target]);

  /** Measures every node and rebuilds the trace through them. */
  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const ids = [...visible.map((entry) => entry.id), NOW_ID];
    const kindOf = new Map<string, WaveKind>(visible.map((entry) => [entry.id, entry.kind]));
    let cx = 28;
    const nodes: Measured[] = [];
    for (const id of ids) {
      const element = nodeRefs.current.get(id);
      if (!element) continue;
      const offset = offsetWithin(element, track);
      cx = offset.x + element.offsetWidth / 2;
      nodes.push({ id, kind: kindOf.get(id) ?? "now", y: offset.y + element.offsetHeight / 2 });
    }
    const height = track.offsetHeight;
    const trace = buildTrace(nodes, height, cx, Math.min(20, cx * 0.66));
    traceRef.current = trace;
    nodeYs.current = nodes.map((node) => node.y);
    heightRef.current = Math.max(1, height);
    hotRef.current = Math.min(0.12, 120 / trace.total);
    setPath(trace.d);
    setMap((previous) => {
      const same =
        Math.abs(previous.height - height) < 1 &&
        previous.nodes.length === nodes.length &&
        previous.nodes.every((node, i) => node.id === nodes[i].id && Math.abs(node.y - nodes[i].y) < 1);
      return same ? previous : { height, nodes };
    });
    // Recount the lit nodes against the new layout, then let the beam find its place.
    litRef.current = -1;
    apply(beam.get());
    update();
  }, [visible, apply, beam, update]);

  useLayoutEffect(() => {
    measure();
  }, [measure, still]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    observer.observe(track);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [measure]);

  useEffect(() => {
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update]);

  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", update);
  useMotionValueEvent(beam, "change", apply);

  /* ------------------------------------------------------------ the readout */

  const entryCount = Math.min(lit, visible.length);
  const reached = entryCount > 0 ? visible[entryCount - 1] : null;
  const probed = probe ? visible.find((entry) => entry.id === probe) : null;
  const atNow = lit > visible.length || probe === NOW_ID;
  const shown = probed ?? (atNow ? null : reached);

  const release = (id: string) => setProbe((value) => (value === id ? null : value));
  const toggle = (id: string) =>
    setOpen((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const jumpTo = (id: string) => {
    const element = nodeRefs.current.get(id)?.closest("li");
    element?.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
  };

  const setNode = (id: string) => (element: HTMLElement | null) => {
    if (element) nodeRefs.current.set(id, element);
    else nodeRefs.current.delete(id);
  };

  const ease = [0.16, 1, 0.3, 1] as const;
  const rowMotion = still
    ? { initial: false as const, transition: { duration: 0 } }
    : {
        initial: { opacity: 0, x: -14 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -14, transition: { duration: 0.2 } },
        transition: { duration: 0.5, ease },
      };

  return (
    <div className="logs-trace" data-still={still ? "" : undefined}>
      <div className="logs-controls">
        <div className="logs-filters" role="group" aria-label="Show entries of one kind">
          <button type="button" className="lab-chip" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
            All <span className="logs-chip-count">{entries.length}</span>
          </button>
          {kinds.map((kind) => (
            <button
              key={kind.id}
              type="button"
              className="lab-chip logs-chip"
              aria-pressed={filter === kind.id}
              onClick={() => setFilter(kind.id)}
            >
              <WaveGlyph kind={kind.id} width={20} height={10} />
              {kind.label}
              <span className="logs-chip-count">{kind.count}</span>
            </button>
          ))}
        </div>
        <p className="logs-showing mono" aria-live="polite">
          Showing <span className="lab-readout">{pad2(visible.length)}</span> of{" "}
          <span className="lab-readout">{pad2(entries.length)}</span>
          <span className="sr-only"> entries</span>
        </p>
      </div>

      <div className="logs-trace-grid">
        <aside className="logs-hud lab-panel" aria-label="Trace readout" {...pointerLight}>
          <div className="logs-hud-head mono">
            <span className="logs-hud-mode" data-mode={probed ? "probe" : "beam"}>
              {probed ? "Probe" : "Beam"}
            </span>
            <span className="lab-readout">
              {pad2(entryCount)}/{pad2(visible.length)}
            </span>
          </div>
          <p className="logs-hud-date lab-readout">
            {shown ? shown.label.toUpperCase() : atNow ? formatMonth(now).toUpperCase() : "-- ----"}
          </p>
          <p className="logs-hud-kind mono">
            <WaveGlyph kind={shown ? shown.kind : "now"} />
            {shown ? kindLabel(shown.kind) : atNow ? "Now" : "Awaiting signal"}
          </p>
          <p className="logs-hud-title">
            {shown
              ? shown.title
              : atNow && current
                ? `${current.role} at ${current.company}, month ${current.months}.`
                : "Scroll, and the beam writes the log."}
          </p>
          <div className="logs-minimap" aria-hidden="true">
            <span className="logs-minimap-rail" />
            {map.nodes.map((node, index) => (
              <span
                key={node.id}
                className="logs-minimap-tick"
                data-kind={node.kind}
                data-lit={index < lit ? "" : undefined}
                data-probe={probe === node.id ? "" : undefined}
                style={{ top: `${(node.y / map.height) * 100}%` }}
                onClick={() => jumpTo(node.id)}
              />
            ))}
            <motion.span className="logs-minimap-cursor" style={{ top: cursorTop }} />
          </div>
          <p className="logs-hud-hint mono">Minimap: click a tick to jump</p>
        </aside>

        <div ref={trackRef} className="logs-track">
          <svg className="logs-rail" aria-hidden="true" focusable="false">
            <g key={filter} className="logs-retune">
              <path className="logs-ghost" d={path} />
              <motion.path className="logs-beam" d={path} style={{ pathLength: drawn }} />
              <motion.path
                className="logs-hot"
                d={path}
                pathLength={1}
                strokeDasharray={`${hotRef.current} 2`}
                style={{ strokeDashoffset: hotOffset }}
              />
              <motion.circle className="logs-head-halo" r={11} cx={headX} cy={headY} style={{ opacity: headOpacity }} />
              <motion.circle className="logs-head" r={3} cx={headX} cy={headY} style={{ opacity: headOpacity }} />
            </g>
          </svg>

          <ul className="logs-list">
            <AnimatePresence mode="popLayout" initial={false}>
              {rows.map((row) => {
                if (row.type === "year") {
                  return (
                    <motion.li key={row.id} layout={still ? false : "position"} className="logs-year" {...rowMotion}>
                      <span className="logs-year-tick" aria-hidden="true" />
                      <h3 className="mono">{row.year}</h3>
                    </motion.li>
                  );
                }

                if (row.type === "now") {
                  return (
                    <motion.li
                      key={row.id}
                      layout={still ? false : "position"}
                      className="logs-row logs-now"
                      data-lit={lit > visible.length ? "" : undefined}
                      onPointerEnter={() => setProbe(NOW_ID)}
                      onPointerLeave={() => release(NOW_ID)}
                      {...rowMotion}
                    >
                      <span ref={setNode(NOW_ID)} className="logs-node" aria-hidden="true" />
                      <div className="logs-card">
                        <p className="logs-meta mono">
                          <time dateTime={now.toISOString().slice(0, 7)}>{formatMonth(now)}</time>
                          <span className="logs-kind">
                            <WaveGlyph kind="now" />
                            Now
                          </span>
                          <span className="logs-badge">Live</span>
                        </p>
                        <h4 className="logs-title">
                          {current ? `On the trace now: ${current.role} at ${current.company}` : "On the trace now"}
                        </h4>
                        {current && (
                          <p className="logs-text">
                            <span className="lab-readout">Month {pad2(current.months)}</span> of the role, in{" "}
                            {current.location}. The log is written up to here.
                          </p>
                        )}
                      </div>
                    </motion.li>
                  );
                }

                const { entry } = row;
                const role = entry.role;
                const isOpen = open.has(entry.id);
                const link = linkFor(entry);
                const detailId = `${entry.id}-detail`;
                return (
                  <motion.li
                    key={row.id}
                    layout={still ? false : "position"}
                    className="logs-row"
                    data-kind={entry.kind}
                    data-lit={row.index < lit ? "" : undefined}
                    data-probe={probe === entry.id ? "" : undefined}
                    data-role={role ? "" : undefined}
                    onPointerEnter={() => setProbe(entry.id)}
                    onPointerLeave={() => release(entry.id)}
                    onFocus={() => setProbe(entry.id)}
                    onBlur={() => release(entry.id)}
                    {...rowMotion}
                  >
                    <span ref={setNode(entry.id)} className="logs-node" aria-hidden="true" />
                    <div className={role ? "logs-card lab-panel" : "logs-card"} {...(role ? pointerLight : {})}>
                      <p className="logs-meta mono">
                        <time dateTime={entry.date}>{entry.label}</time>
                        <span className="logs-kind">
                          <WaveGlyph kind={entry.kind} />
                          {kindLabel(entry.kind)}
                        </span>
                        {role?.current && <span className="logs-badge">Current</span>}
                      </p>
                      <h4 className="logs-title">{entry.title}</h4>
                      {role && (
                        <p className="logs-company mono">
                          {role.role} · {role.company} · {role.location} · {role.period}
                        </p>
                      )}
                      {entry.text && <p className="logs-text">{entry.text}</p>}
                      {role && (
                        <>
                          <button
                            type="button"
                            className="logs-expand"
                            aria-expanded={isOpen}
                            aria-controls={detailId}
                            onClick={() => toggle(entry.id)}
                          >
                            <span>{isOpen ? "Hide" : "Show"} highlights</span>
                            <span className="lab-readout">{pad2(role.highlights.length)}</span>
                            <ChevronDown size={15} aria-hidden="true" />
                          </button>
                          <AnimatePresence initial={false}>
                            {isOpen && (
                              <motion.div
                                id={detailId}
                                key="detail"
                                className="logs-detail"
                                initial={still ? false : { height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={still ? { height: 0, opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }}
                                transition={{ duration: still ? 0 : 0.45, ease }}
                              >
                                <ul className="logs-highlights">
                                  {role.highlights.map((point) => (
                                    <li key={point}>{point}</li>
                                  ))}
                                </ul>
                                <div className="logs-detail-foot">
                                  <ul className="logs-stack" aria-label="Stack">
                                    {role.stack.map((tech) => (
                                      <li key={tech} className="lab-chip">
                                        {tech}
                                      </li>
                                    ))}
                                  </ul>
                                  <p className="logs-length mono">
                                    Length <span className="lab-readout">{role.months} months</span>
                                  </p>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </>
                      )}
                      {link && (
                        <a
                          className="logs-link"
                          href={link.href}
                          {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}
                        >
                          {link.label}
                          <ArrowUpRight size={14} aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </div>
      </div>
    </div>
  );
}

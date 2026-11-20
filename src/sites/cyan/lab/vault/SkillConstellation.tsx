import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { useReducedMotion } from "framer-motion";
import type { SkillCategory } from "@/data/profile";
import { useMotionPaused } from "@/lib/motion-pause";
import {
  COMPACT_BELOW,
  EDGES,
  NODES,
  NODE_BY_ID,
  RIM,
  SECTORS,
  TOTALS,
  VIEW,
  bearingOf,
  edgePath,
  focusLayout,
  nextInDirection,
  nodeRadius,
  norm,
  pointOnEdge,
  skyLayout,
  toXY,
  type Layout,
} from "./graph";

/*
 * The skill map as a radar scope. A sweep circles the dial and wakes each star
 * as it passes the first time; afterwards it brushes them with light on every
 * turn. With an area filtered it narrows to a sector scan. Signal pulses run
 * along the lines, outward from whatever the visitor is probing. Selecting a
 * star re-plots the chart around it.
 *
 * React renders the parts and their states; one animation loop writes the
 * geometry (positions, curves, pulses, sweep) straight to the SVG, so the
 * lines are always drawn from the same coordinates as the stars they join.
 * The loop runs only while the scope is on screen, the tab is visible and
 * motion is allowed; otherwise each change is painted once, without easing.
 */

type Current = { x: number; y: number; scale: number; lb: number };
type Pulse = { live: boolean; edge: number; from: "a" | "b"; t: number; speed: number };

const POOL = 28;
const SWEEP_PERIOD = 7.5;
const SCAN_SPEED = 64;
const FLARE_SPAN = 70;
const TAIL = 0.14;

const pad3 = (n: number) => String(Math.round(norm(n)) % 360).padStart(3, "0");
const f1 = (v: number) => Math.round(v * 10) / 10;

/** The SVG path for an arc of the rim between two bearings. */
function arc(from: number, to: number, r: number, reverse = false) {
  const a = toXY(reverse ? to : from, r);
  const b = toXY(reverse ? from : to, r);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  return `M${f1(a.x)} ${f1(a.y)}A${r} ${r} 0 ${large} ${reverse ? 0 : 1} ${f1(b.x)} ${f1(b.y)}`;
}
function wedge(from: number, to: number, r: number) {
  return `M0 0L${arc(from, to, r).slice(1)}Z`;
}

const TICKS = (() => {
  let d = "";
  for (let b = 0; b < 360; b += 5) {
    const inner = b % 30 === 0 ? RIM - 18 : RIM - 8;
    const p = toXY(b, RIM);
    const q = toXY(b, inner);
    d += `M${f1(p.x)} ${f1(p.y)}L${f1(q.x)} ${f1(q.y)}`;
  }
  return d;
})();

/** Thin slices behind the sweep's leading edge, fading as they trail. */
const SWEEP_SLICES = Array.from({ length: 14 }, (_, k) => ({
  d: wedge(-(k + 1) * 3, -k * 3, RIM),
  opacity: (1 - k / 14) ** 1.6,
}));

export function SkillConstellation({
  selected,
  filter,
  onSelect,
}: {
  selected: string | null;
  filter: SkillCategory | null;
  onSelect: (id: string | null) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const nodeEls = useRef(new Map<string, SVGGElement>());
  const labelEls = useRef(new Map<string, { outer: SVGGElement; inner: SVGGElement; text: SVGTextElement }>());
  const edgeEls = useRef<(SVGPathElement | null)[]>([]);
  const pulseEls = useRef<({ head: SVGCircleElement; tail: SVGPathElement } | null)[]>([]);
  const sweepEl = useRef<SVGGElement>(null);
  const sweepReadout = useRef<HTMLSpanElement>(null);
  const reticleEl = useRef<SVGGElement>(null);
  const rangeEl = useRef<SVGCircleElement>(null);
  const probeReadout = useRef<HTMLSpanElement>(null);
  const focusedRef = useRef<string | null>(null);

  const [width, setWidth] = useState(800);
  const [probe, setProbe] = useState<string | null>(null);
  const [tabStop, setTabStop] = useState<string>(selected ?? NODES[0].id);
  const reduced = useReducedMotion();
  const paused = useMotionPaused();
  const still = Boolean(reduced) || paused;
  const compact = width < COMPACT_BELOW;

  const layout = useMemo<Layout>(
    () => (selected ? focusLayout(selected, compact) : skyLayout(compact)),
    [selected, compact],
  );
  const active = probe ?? selected;
  const activeNode = active ? NODE_BY_ID.get(active) : undefined;
  const linked = useMemo(() => new Set(activeNode?.links ?? []), [activeNode]);
  const inFilter = useCallback(
    (id: string) => !filter || NODE_BY_ID.get(id)?.skill.category === filter,
    [filter],
  );

  // Everything the loop reads, kept current without restarting it.
  const live = useRef({ layout, active, filter, compact });
  live.current = { layout, active, filter, compact };

  const sim = useRef({
    pos: new Map<string, Current>(),
    shown: new Map<string, { x: number; y: number }>(),
    time: 0,
    sweep: 0,
    dir: 1 as 1 | -1,
    travelled: 0,
    awake: new Set<string>(),
    allAwake: false,
    pulses: Array.from({ length: POOL }, (): Pulse => ({ live: false, edge: 0, from: "a", t: 0, speed: 1 })),
    spawnIn: 0,
    spawnTurn: 0,
    scanFilter: null as SkillCategory | null,
  });

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const next = Math.round(el.clientWidth);
      if (next > 0) setWidth(next);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (selected) setTabStop(selected);
  }, [selected]);

  /** Writes one frame. `snap` jumps straight to the layout; `still` drops drift, sweep and pulses. */
  const paint = useCallback((dt: number, snap: boolean, isStill: boolean) => {
    const s = sim.current;
    const { layout: target, active: probeId, filter: band, compact: small } = live.current;
    const ease = snap ? 1 : 1 - Math.exp(-dt * 6.5);
    if (!isStill) s.time += dt;

    // Stars
    for (const node of NODES) {
      const goal = target[node.id];
      let cur = s.pos.get(node.id);
      if (!cur) {
        cur = { x: goal.x, y: goal.y, scale: goal.scale, lb: goal.labelBearing };
        s.pos.set(node.id, cur);
      }
      cur.x += (goal.x - cur.x) * ease;
      cur.y += (goal.y - cur.y) * ease;
      cur.scale += (goal.scale - cur.scale) * ease;
      cur.lb += ((((goal.labelBearing - cur.lb + 540) % 360) - 180) * ease) as number;
      cur.lb = norm(cur.lb);
      const drift = isStill ? 0 : 4.5 * cur.scale;
      const x = cur.x + Math.sin(s.time * 0.55 + node.index * 1.7) * drift;
      const y = cur.y + Math.cos(s.time * 0.43 + node.index * 2.3) * drift;
      s.shown.set(node.id, { x, y });

      const r = nodeRadius(node, small) * cur.scale;
      nodeEls.current
        .get(node.id)
        ?.setAttribute("transform", `translate(${f1(x)} ${f1(y)}) scale(${cur.scale.toFixed(3)})`);

      const label = labelEls.current.get(node.id);
      if (label) {
        if (goal.label === "below") {
          label.outer.setAttribute("transform", `translate(${f1(x)} ${f1(y)})`);
          label.inner.setAttribute("transform", `translate(0 ${f1(r + 30)})`);
          label.text.setAttribute("text-anchor", "middle");
        } else {
          const right = cur.lb < 180;
          const turn = right ? cur.lb - 90 : cur.lb + 90;
          label.outer.setAttribute("transform", `translate(${f1(x)} ${f1(y)}) rotate(${f1(turn)})`);
          label.inner.setAttribute("transform", `translate(${f1((r + 11) * (right ? 1 : -1))} 0)`);
          label.text.setAttribute("text-anchor", right ? "start" : "end");
        }
      }
    }

    // Lines, from exactly the points the stars were drawn at.
    EDGES.forEach((edge, k) => {
      const a = s.shown.get(edge.a);
      const b = s.shown.get(edge.b);
      if (a && b) edgeEls.current[k]?.setAttribute("d", edgePath(a.x, a.y, b.x, b.y));
    });

    // Sweep: a full turn, or a back-and-forth scan across the filtered area.
    const sector = band ? SECTORS.find((item) => item.category === band) : undefined;
    if (!isStill) {
      if (sector) {
        if (s.scanFilter !== band) {
          s.sweep = sector.from - 4;
          s.dir = 1;
          s.scanFilter = band;
        }
        let at = s.sweep + SCAN_SPEED * dt * s.dir;
        if (at > sector.to + 4) {
          at = sector.to + 4;
          s.dir = -1;
        } else if (at < sector.from - 4) {
          at = sector.from - 4;
          s.dir = 1;
        }
        s.sweep = at;
      } else {
        s.scanFilter = null;
        s.dir = 1;
        // The first, waking turn runs faster, so the chart is whole within a few seconds.
        const step = (360 / SWEEP_PERIOD) * dt * (s.travelled < 360 ? 2.6 : 1);
        s.sweep = norm(s.sweep + step);
        s.travelled += step;
      }
    }
    if (sweepEl.current) {
      sweepEl.current.setAttribute(
        "transform",
        `rotate(${f1(s.sweep)}) scale(${s.dir} 1)`,
      );
    }
    if (sweepReadout.current) sweepReadout.current.textContent = isStill ? "SWP HOLD" : `SWP ${pad3(s.sweep)}°`;

    // First pass of the sweep wakes each star; after that, it brushes them with light.
    if (isStill || s.travelled >= 360 || band || probeId) s.allAwake = true;
    for (const node of NODES) {
      const el = nodeEls.current.get(node.id);
      if (!el) continue;
      const p = s.shown.get(node.id)!;
      const near = Math.hypot(p.x, p.y) < 8;
      const bearing = bearingOf(p.x, p.y);
      if (!s.awake.has(node.id) && (s.allAwake || (!near && s.travelled >= bearing))) {
        s.awake.add(node.id);
        el.setAttribute("data-on", "");
        labelEls.current.get(node.id)?.outer.setAttribute("data-on", "");
      }
      let flare = 0;
      if (!isStill && !near) {
        const behind = s.dir > 0 ? norm(s.sweep - bearing) : norm(bearing - s.sweep);
        flare = behind < FLARE_SPAN ? 1 - behind / FLARE_SPAN : 0;
      }
      el.style.setProperty("--flare", flare.toFixed(2));
    }
    EDGES.forEach((edge, k) => {
      const el = edgeEls.current[k];
      if (el && !el.hasAttribute("data-on") && s.awake.has(edge.a) && s.awake.has(edge.b)) {
        el.setAttribute("data-on", "");
      }
    });

    // Pulses: a steady stream out of the probed star, or stray signal across the chart.
    if (isStill) {
      for (const p of s.pulses) p.live = false;
    } else {
      s.spawnIn -= dt;
      if (s.spawnIn <= 0) {
        const incident = probeId
          ? EDGES.map((edge, k) => ({ edge, k })).filter(({ edge }) => edge.a === probeId || edge.b === probeId)
          : [];
        const slot = s.pulses.find((p) => !p.live);
        if (slot) {
          let pick: { k: number; from: "a" | "b" } | null = null;
          if (incident.length) {
            const { edge, k } = incident[s.spawnTurn++ % incident.length];
            pick = { k, from: edge.a === probeId ? "a" : "b" };
          } else {
            const pool = EDGES.map((edge, k) => ({ edge, k })).filter(
              ({ edge }) =>
                s.awake.has(edge.a) &&
                s.awake.has(edge.b) &&
                (!band ||
                  NODE_BY_ID.get(edge.a)?.skill.category === band ||
                  NODE_BY_ID.get(edge.b)?.skill.category === band),
            );
            if (pool.length) {
              const { k } = pool[Math.floor(Math.random() * pool.length)];
              pick = { k, from: Math.random() < 0.5 ? "a" : "b" };
            }
          }
          if (pick) {
            const edge = EDGES[pick.k];
            const a = s.shown.get(edge.a)!;
            const b = s.shown.get(edge.b)!;
            const length = Math.max(60, Math.hypot(a.x - b.x, a.y - b.y));
            Object.assign(slot, { live: true, edge: pick.k, from: pick.from, t: 0, speed: 300 / length });
          }
        }
        s.spawnIn = incident.length ? 0.16 : 0.42;
      }
    }
    s.pulses.forEach((p, k) => {
      const el = pulseEls.current[k];
      if (!el) return;
      if (p.live) p.t += dt * p.speed;
      if (p.live && p.t > 1 + TAIL) p.live = false;
      if (!p.live) {
        el.head.setAttribute("opacity", "0");
        el.tail.setAttribute("opacity", "0");
        return;
      }
      const edge = EDGES[p.edge];
      const a = s.shown.get(p.from === "a" ? edge.a : edge.b)!;
      const b = s.shown.get(p.from === "a" ? edge.b : edge.a)!;
      const at = (t: number) => pointOnEdge(a.x, a.y, b.x, b.y, Math.min(1, Math.max(0, t)));
      const head = at(p.t);
      el.head.setAttribute("cx", String(f1(head.x)));
      el.head.setAttribute("cy", String(f1(head.y)));
      el.head.setAttribute("opacity", p.t > 1 ? "0" : "1");
      let d = "";
      for (let i = 0; i <= 4; i++) {
        const q = at(p.t - TAIL + (TAIL * i) / 4);
        d += `${i ? "L" : "M"}${f1(q.x)} ${f1(q.y)}`;
      }
      el.tail.setAttribute("d", d);
      el.tail.setAttribute("opacity", "1");
    });
  }, []);

  // First frame, before paint, so nothing jumps in from the origin.
  useLayoutEffect(() => {
    paint(0, true, still);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, at mount
  }, []);

  // Without motion every change is painted once, in place.
  useEffect(() => {
    if (still) paint(0, true, true);
  }, [still, layout, filter, active, paint]);

  useEffect(() => {
    if (still) return;
    const wrap = wrapRef.current;
    let frame = 0;
    let last = 0;
    let onScreen = true;
    const tick = (now: number) => {
      frame = 0;
      if (!onScreen || document.hidden) {
        last = 0;
        return;
      }
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      paint(dt, false, false);
      frame = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (!frame && onScreen && !document.hidden) frame = requestAnimationFrame(tick);
    };
    let observer: IntersectionObserver | undefined;
    if (wrap && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver((entries) => {
        onScreen = entries.some((entry) => entry.isIntersecting);
        wake();
      });
      observer.observe(wrap);
    }
    document.addEventListener("visibilitychange", wake);
    wake();
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", wake);
    };
  }, [still, paint]);

  /* ------------------------------------------------------------ input */

  const navigable = useMemo(() => NODES.map((n) => n.id).filter(inFilter), [inFilter]);

  const focusNode = (id: string) => {
    setTabStop(id);
    nodeEls.current.get(id)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<SVGGElement>, id: string) => {
    const moves: Record<string, [number, number]> = {
      ArrowRight: [1, 0],
      ArrowLeft: [-1, 0],
      ArrowDown: [0, 1],
      ArrowUp: [0, -1],
    };
    if (event.key in moves) {
      event.preventDefault();
      const [dx, dy] = moves[event.key];
      const next = nextInDirection(id, dx, dy, layout, navigable.length ? navigable : [id]);
      if (next) focusNode(next);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const list = navigable.length ? navigable : NODES.map((n) => n.id);
      focusNode(event.key === "Home" ? list[0] : list[list.length - 1]);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(selected === id ? null : id);
    } else if (event.key === "Escape" && selected) {
      event.preventDefault();
      onSelect(null);
    }
  };

  const onScopeMove = (event: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    const reticle = reticleEl.current;
    if (!svg || !reticle || event.pointerType !== "mouse") return;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const range = Math.hypot(point.x, point.y);
    if (range > RIM) {
      reticle.removeAttribute("data-on");
      if (probeReadout.current) probeReadout.current.textContent = "";
      return;
    }
    reticle.setAttribute("data-on", "");
    reticle.querySelector(".vault-reticle-cross")?.setAttribute(
      "transform",
      `translate(${f1(point.x)} ${f1(point.y)})`,
    );
    rangeEl.current?.setAttribute("r", String(f1(range)));
    if (probeReadout.current) {
      probeReadout.current.textContent = `BRG ${pad3(bearingOf(point.x, point.y))}° · RNG ${(range / RIM).toFixed(2)}`;
    }
  };
  const onScopeLeave = () => {
    reticleEl.current?.removeAttribute("data-on");
    if (probeReadout.current) probeReadout.current.textContent = "";
  };

  /* ------------------------------------------------------------ render */

  const statusNode = activeNode;
  const sectorLabelR = RIM + (compact ? 30 : 24);

  return (
    <div
      ref={wrapRef}
      className={`vault-scope${active ? " has-active" : ""}${filter ? " has-filter" : ""}`}
      data-size={compact ? "compact" : "wide"}
      data-mode={selected ? "focus" : "sky"}
      data-still={still ? "" : undefined}
    >
      <div className="vault-hud vault-hud-top" aria-hidden="true">
        <p className="vault-hud-status">
          {statusNode ? (
            <>
              <span className="vault-hud-code mono">{statusNode.skill.short}</span>
              <span className="vault-hud-name">{statusNode.skill.name}</span>
              <span className="vault-hud-meta mono">
                {statusNode.skill.category} · <span className="lab-readout">{statusNode.links.length}</span> links
              </span>
            </>
          ) : (
            <>
              <span className="vault-hud-name">{filter ?? "Full chart"}</span>
              <span className="vault-hud-meta mono">
                <span className="lab-readout">
                  {filter ? NODES.filter((n) => n.skill.category === filter).length : TOTALS.skills}
                </span>{" "}
                skills · <span className="lab-readout">{TOTALS.links}</span> links in all
              </span>
            </>
          )}
        </p>
        <p className="vault-hud-gauges mono">
          <span ref={sweepReadout} className="lab-readout">
            SWP 000°
          </span>
          <span ref={probeReadout} className="lab-readout vault-hud-probe" />
        </p>
      </div>

      <svg
        ref={svgRef}
        className="vault-svg"
        viewBox={`${-VIEW} ${-VIEW} ${VIEW * 2} ${VIEW * 2}`}
        role="group"
        aria-label="Skill constellation"
        aria-describedby="vault-scope-help"
        onPointerMove={onScopeMove}
        onPointerLeave={onScopeLeave}
      >
        <defs>
          {SECTORS.map((sector) => {
            const middle = norm((sector.from + sector.to) / 2);
            const bottom = middle > 90 && middle < 270;
            return (
              <path
                key={sector.category}
                id={`vault-arc-${sector.category.replace(/\W/g, "")}`}
                d={
                  bottom
                    ? arc(sector.from - 20, sector.to + 20, sectorLabelR + (compact ? 22 : 12), true)
                    : arc(sector.from - 20, sector.to + 20, sectorLabelR)
                }
              />
            );
          })}
        </defs>

        {/* A click on open sky returns to the full chart. */}
        <circle
          className="vault-sky"
          r={RIM}
          onClick={() => {
            if (selected) onSelect(null);
          }}
        />

        <g className="vault-dial" aria-hidden="true">
          {[0.25, 0.5, 0.75].map((k) => (
            <circle key={k} className="vault-range" r={RIM * k} />
          ))}
          <path className="vault-cross" d={`M${-RIM} 0H${RIM}M0 ${-RIM}V${RIM}`} />
          <circle className="vault-rim" r={RIM} />
          <path className="vault-ticks" d={TICKS} />
          {SECTORS.map((sector) => (
            <g
              key={sector.category}
              className={`vault-sector${filter === sector.category ? " is-on" : ""}${
                activeNode?.skill.category === sector.category ? " is-probed" : ""
              }`}
            >
              <path className="vault-sector-wash" d={wedge(sector.from - 3, sector.to + 3, RIM)} />
              <path className="vault-sector-arc" d={arc(sector.from, sector.to, RIM)} />
              <text className="vault-sector-label">
                <textPath href={`#vault-arc-${sector.category.replace(/\W/g, "")}`} startOffset="50%" textAnchor="middle">
                  {sector.category}
                  <tspan className="vault-sector-count"> · {String(sector.count).padStart(2, "0")}</tspan>
                </textPath>
              </text>
            </g>
          ))}
        </g>

        <g ref={sweepEl} className="vault-sweep" aria-hidden="true">
          {SWEEP_SLICES.map((slice, k) => (
            <path key={k} d={slice.d} style={{ opacity: slice.opacity }} />
          ))}
          <line className="vault-sweep-edge" x1="0" y1="0" x2="0" y2={-RIM} />
        </g>

        <g className="vault-edges" aria-hidden="true">
          {EDGES.map((edge, k) => {
            const lit = active !== null && (edge.a === active || edge.b === active);
            const out = !inFilter(edge.a) && !inFilter(edge.b);
            const half = !out && (!inFilter(edge.a) || !inFilter(edge.b));
            return (
              <path
                key={edge.id}
                ref={(el) => {
                  edgeEls.current[k] = el;
                }}
                className={`vault-edge${lit ? " is-lit" : ""}${active && !lit ? " is-dim" : ""}${
                  out ? " is-out" : half ? " is-half" : ""
                }`}
                pathLength={1}
              />
            );
          })}
        </g>

        <g className="vault-pulses" aria-hidden="true">
          {Array.from({ length: POOL }, (_, k) => (
            <g key={k}>
              <path
                className="vault-pulse-tail"
                opacity="0"
                ref={(el) => {
                  const slot = pulseEls.current[k] ?? ({} as { head: SVGCircleElement; tail: SVGPathElement });
                  if (el) slot.tail = el;
                  pulseEls.current[k] = slot;
                }}
              />
              <circle
                className="vault-pulse-head"
                r={compact ? 7 : 4}
                opacity="0"
                ref={(el) => {
                  const slot = pulseEls.current[k] ?? ({} as { head: SVGCircleElement; tail: SVGPathElement });
                  if (el) slot.head = el;
                  pulseEls.current[k] = slot;
                }}
              />
            </g>
          ))}
        </g>

        <g ref={reticleEl} className="vault-reticle" aria-hidden="true">
          <circle ref={rangeEl} className="vault-reticle-range" r="0" />
          <g className="vault-reticle-cross">
            <path d="M-18 0H-6M6 0H18M0 -18V-6M0 6V18" />
          </g>
        </g>

        <g className="vault-nodes">
          {NODES.map((node) => {
            const r = nodeRadius(node, compact);
            const isActive = node.id === active;
            const isLinked = linked.has(node.id);
            const isSelected = node.id === selected;
            const far = layout[node.id].scale < 1;
            const classes = [
              "vault-node",
              isActive && "is-active",
              isSelected && "is-selected",
              isLinked && "is-linked",
              active && !isActive && !isLinked && "is-dim",
              !inFilter(node.id) && "is-out",
              far && "is-far",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <g
                key={node.id}
                ref={(el) => {
                  if (el) nodeEls.current.set(node.id, el);
                  else nodeEls.current.delete(node.id);
                }}
                className={classes}
                role="button"
                tabIndex={node.id === tabStop ? 0 : -1}
                aria-pressed={isSelected}
                aria-label={`${node.skill.name}, ${node.skill.category}, ${node.links.length} links`}
                onPointerEnter={(event) => {
                  if (event.pointerType !== "touch") setProbe(node.id);
                }}
                onPointerLeave={(event) => {
                  if (event.pointerType !== "touch") setProbe(focusedRef.current);
                }}
                onFocus={() => {
                  focusedRef.current = node.id;
                  setTabStop(node.id);
                  setProbe(node.id);
                }}
                onBlur={(event: FocusEvent<SVGGElement>) => {
                  focusedRef.current = null;
                  if (!svgRef.current?.contains(event.relatedTarget as Node | null)) setProbe(null);
                }}
                onClick={() => onSelect(selected === node.id ? null : node.id)}
                onKeyDown={(event) => onKeyDown(event, node.id)}
              >
                <circle className="vault-node-hit" r={r + (compact ? 16 : 12)} />
                <circle className="vault-node-halo" r={r + 14} />
                <circle className="vault-node-orbit" r={r + 7} />
                <circle className="vault-node-body" r={r} />
                <text className="vault-node-code" fontSize={Math.max(compact ? 24 : 11.5, r * 0.56)} dy="0.36em">
                  {node.skill.short}
                </text>
              </g>
            );
          })}
        </g>

        <g className="vault-labels" aria-hidden="true">
          {NODES.map((node) => {
            const mode = layout[node.id].label;
            const isLinked = linked.has(node.id);
            const classes = [
              "vault-label",
              `is-${mode}`,
              node.id === active && "is-active",
              isLinked && "is-linked",
              active && node.id !== active && !isLinked && "is-dim",
              !inFilter(node.id) && "is-out",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <g
                key={node.id}
                className={classes}
                ref={(el) => {
                  if (!el) {
                    labelEls.current.delete(node.id);
                    return;
                  }
                  const inner = el.firstElementChild as SVGGElement;
                  labelEls.current.set(node.id, {
                    outer: el,
                    inner,
                    text: inner.firstElementChild as SVGTextElement,
                  });
                }}
              >
                <g>
                  <text>
                    {node.lines.map((line, k) => (
                      <tspan
                        key={k}
                        x="0"
                        dy={k === 0 ? (node.lines.length > 1 ? "-0.2em" : "0.35em") : "1.15em"}
                      >
                        {line}
                      </tspan>
                    ))}
                  </text>
                </g>
              </g>
            );
          })}
        </g>
      </svg>

      <div className="vault-hud vault-hud-bottom">
        <p className="vault-hud-hint mono" aria-hidden="true">
          {selected
            ? compact
              ? "Tap open sky for the full chart"
              : "Esc or open sky: full chart"
            : compact
              ? "Tap a star to centre it"
              : "Click a star to centre it · arrows move"}
        </p>
        {selected && (
          <button type="button" className="lab-chip vault-reset" onClick={() => onSelect(null)}>
            Full chart
          </button>
        )}
      </div>
      <p id="vault-scope-help" className="sr-only">
        Each skill is a button. Use the arrow keys to move between skills, Enter to centre the chart on one and read
        about it, and Escape to return to the full chart. The same skills are listed in the index below.
      </p>
    </div>
  );
}

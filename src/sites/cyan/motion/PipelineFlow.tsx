import { Fragment, useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { useMotionPaused } from "@/lib/motion-pause";
import "./pipeline-flow.css";

/*
 * The approach section's pipeline drawn as an instrument: a module per stage,
 * traces between them, and packets that hop from stage to stage. It shows the
 * shape of the workflow, not live data, and its corner tag says so.
 *
 * The ambient motion is CSS on one shared cycle. Every packet, LED and the
 * active halo gets a negative delay that places its moment in that cycle, so a
 * stage lights as a packet reaches it. JavaScript only decides when that runs
 * and, for 700ms after a tab change, decodes the labels out of glyph noise.
 */

/** The stage the original diagram highlights. */
const ACTIVE_STAGE = 2;
/** One batch through the pipeline, then a quiet beat. Passed to CSS as --flow-cycle. */
const CYCLE_MS = 8400;
/** One hop along a trace: 15% of the cycle, as in the flow-hop keyframes. */
const HOP_MS = 1260;
/** When an eased packet's head reaches the next module. */
const ARRIVE_MS = 720;
/** How long a stage holds a batch before passing it on. */
const DWELL_MS = 2100;
/** The highlighted stage holds it longer, so the eye rests there. */
const ACTIVE_DWELL_MS = 2500;
/** The second packet of each burst trails the first. */
const TRAIL_MS = 200;
/** A tab change: the old labels scramble out, then the new ones decode in. */
const OUT_MS = 240;
const IN_MS = 460;
/** A phase's first frame can land a frame late, so each sweep ends this much early. */
const SLACK_MS = 30;
/** While the labels decode, the route is traced again one trace after another. */
const ROUTE_STAGGER_MS = 70;
const GLYPHS = "01ABCDEF#%&*+=<>/\\|_-:";
const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

type Phase = "idle" | "out" | "in";
type Shown = { chips: readonly string[]; step: number };
type FlowStyle = CSSProperties & { [property: `--flow-${string}`]: string };

const keyOf = (chips: readonly string[], step: number) => `${step}\u001e${chips.join("\u001f")}`;
const seedOf = (step: number, index: number) => step * 31 + index * 7 + 1;

/** A negative delay starts an element part-way through the cycle, so its moment lands `t` ms after it starts. */
function at(t: number) {
  const offset = ((Math.round(t) % CYCLE_MS) + CYCLE_MS) % CYCLE_MS;
  return `${offset === 0 ? 0 : offset - CYCLE_MS}ms`;
}

/** When each hop leaves its stage, in ms from the start of the cycle. */
function hopStarts(hops: number, active: number) {
  const gaps = Array.from({ length: Math.max(0, hops - 1) }, (_, hop) =>
    hop + 1 === active ? ACTIVE_DWELL_MS : DWELL_MS,
  );
  // Longer pipelines squeeze their dwell times rather than overrun the cycle.
  const room = CYCLE_MS - HOP_MS - 1200;
  const total = gaps.reduce((sum, gap) => sum + gap, 0);
  const scale = total > room ? room / total : 1;
  const starts = [0];
  for (const gap of gaps) starts.push(starts[starts.length - 1] + gap * scale);
  return starts.slice(0, Math.max(0, hops));
}

/** A role for each module that is true for every tab, whatever its chips say. */
function roleOf(index: number, count: number, active: number) {
  if (index === active) return "ACTIVE";
  if (index === 0) return "IN";
  if (index === count - 1) return "OUT";
  return `STAGE ${String(index + 1).padStart(2, "0")}`;
}

/** One fixed glyph per position, so a label decodes without flickering. */
function noise(text: string, seed: number) {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    if (text[i] === " ") {
      out += " ";
      continue;
    }
    let hash = Math.imul(seed + 0x9e37, 0x85ebca6b) ^ Math.imul(i + 1, 0xc2b2ae35);
    hash ^= hash >>> 15;
    hash = Math.imul(hash, 0x27d4eb2d);
    hash ^= hash >>> 13;
    out += GLYPHS[(hash >>> 0) % GLYPHS.length];
  }
  return out;
}

/** The first `progress` of `front` over the rest of `back`; both are the same length. */
function sweep(front: string, back: string, progress: number) {
  const count = Math.round(progress * front.length);
  return front.slice(0, count) + back.slice(count);
}

/** How far one label is through its sweep; labels start one after another. */
function progress(elapsed: number, index: number, count: number, total: number) {
  const stagger = count > 1 ? Math.min(60, (total * 0.4) / (count - 1)) : 0;
  const span = total - stagger * (count - 1);
  return Math.min(1, Math.max(0, (elapsed - index * stagger) / span));
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(REDUCE_QUERY).matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(REDUCE_QUERY);
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

function useOnScreen(ref: RefObject<HTMLElement>) {
  const [onScreen, setOnScreen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setOnScreen(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (entry) setOnScreen(entry.isIntersecting);
      },
      { rootMargin: "64px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return onScreen;
}

function usePageVisible() {
  const [visible, setVisible] = useState(() => typeof document === "undefined" || document.visibilityState !== "hidden");
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

/**
 * The workflow's stages as instrument modules joined by traces, with packets
 * hopping between them while the section is on screen. The highlighted stage
 * (index 2) pulses. Changing `chips` or `step` scrambles the old labels out
 * and decodes the new ones in. Under reduced motion or the site-wide pause it
 * is a still frame: one packet parked on each trace, the stages lit steadily.
 */
export function PipelineFlow({ chips, step }: { chips: readonly string[]; step: number }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const reduced = usePrefersReducedMotion();
  const paused = useMotionPaused();
  const onScreen = useOnScreen(rootRef);
  const pageVisible = usePageVisible();
  const still = reduced || paused;
  const live = !still && onScreen && pageVisible;
  const animate = live && typeof window !== "undefined" && typeof window.requestAnimationFrame === "function";

  const [shown, setShown] = useState<Shown>(() => ({ chips, step }));
  const [phase, setPhase] = useState<Phase>("idle");

  // The transition reads these without restarting whenever they change.
  const target = useRef<Shown>({ chips, step });
  target.current = { chips, step };
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const count = shown.chips.length;
  const active = count > ACTIVE_STAGE ? ACTIVE_STAGE : -1;
  const starts = hopStarts(count - 1, active);
  const labels = shown.chips.map((chip, index) => (phase === "in" ? noise(chip, seedOf(shown.step, index)) : chip));
  const rendered = useRef(labels);
  rendered.current = labels;

  const targetKey = keyOf(chips, step);

  useEffect(() => {
    const next = target.current;
    const from = shownRef.current;
    if (keyOf(from.chips, from.step) === targetKey) {
      // Nothing to change, or the visitor came back before the swap.
      setPhase("idle");
      return;
    }
    if (!animate) {
      setShown(next);
      setPhase("idle");
      return;
    }

    // React renders each phase's text; between renders the frames below
    // overwrite it. Each phase is timed from the first frame that sees it.
    const written: string[] = [];
    let seen: Phase = "idle";
    let begin = 0;
    let frame = 0;
    const write = (index: number, text: string) => {
      const node = labelRefs.current[index];
      if (!node || written[index] === text) return;
      written[index] = text;
      node.textContent = text;
    };
    const tick = (now: number) => {
      const current = phaseRef.current;
      if (current !== seen) {
        seen = current;
        begin = now;
        written.length = 0;
      }
      const elapsed = now - begin;
      if (current === "out") {
        from.chips.forEach((chip, index) => {
          const scrambled = noise(chip, seedOf(from.step, index) + 97);
          write(index, sweep(scrambled, chip, progress(elapsed, index, from.chips.length, OUT_MS - SLACK_MS)));
        });
      } else if (current === "in") {
        next.chips.forEach((chip, index) => {
          const scrambled = noise(chip, seedOf(next.step, index));
          write(index, sweep(chip, scrambled, progress(elapsed, index, next.chips.length, IN_MS - SLACK_MS)));
        });
      }
      frame = window.requestAnimationFrame(tick);
    };
    const restore = () => {
      labelRefs.current.forEach((node, index) => {
        const text = rendered.current[index];
        if (node && text !== undefined && node.textContent !== text) node.textContent = text;
      });
    };

    setPhase("out");
    frame = window.requestAnimationFrame(tick);
    const swap = window.setTimeout(() => {
      setShown(next);
      setPhase("in");
    }, OUT_MS);
    const settle = window.setTimeout(() => {
      window.cancelAnimationFrame(frame);
      setPhase("idle");
    }, OUT_MS + IN_MS);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(swap);
      window.clearTimeout(settle);
      restore();
    };
  }, [targetKey, animate]);

  return (
    <div
      ref={rootRef}
      className="flow-root"
      role="img"
      aria-label={chips.join(" then ")}
      data-live={live ? "" : undefined}
      data-still={still ? "" : undefined}
      data-phase={phase === "idle" ? undefined : phase}
      style={{ "--flow-cycle": `${CYCLE_MS}ms` } as FlowStyle}
    >
      <span className="flow-tag">[ILLUSTRATION]</span>
      <div className="flow-chain">
        {labels.map((label, index) => (
          <Fragment key={index}>
            {index > 0 && (
              <div className="flow-trace" aria-hidden="true">
                <span className="flow-wire" />
                {phase === "in" && (
                  <span
                    className="flow-route"
                    style={{ "--flow-at": `${(index - 1) * ROUTE_STAGGER_MS}ms` } as FlowStyle}
                  />
                )}
                <span className="flow-packets">
                  {(still ? [0] : [0, 1]).map((packet) => (
                    <span
                      key={packet}
                      className="flow-packet"
                      data-parked={still ? "" : undefined}
                      style={{ "--flow-at": at(starts[index - 1] + packet * TRAIL_MS) } as FlowStyle}
                    />
                  ))}
                </span>
              </div>
            )}
            <div
              className="flow-module"
              data-active={index === active ? "" : undefined}
              style={
                {
                  "--flow-at": at(index === 0 ? 0 : starts[index - 1] + ARRIVE_MS),
                  "--flow-wake": `${200 + index * 60}ms`,
                } as FlowStyle
              }
            >
              <span className="flow-status">
                <span className="flow-led" aria-hidden="true" />
                <span className="flow-role">{roleOf(index, count, active)}</span>
              </span>
              <span
                className="flow-label"
                ref={(node) => {
                  labelRefs.current[index] = node;
                }}
              >
                {label}
              </span>
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

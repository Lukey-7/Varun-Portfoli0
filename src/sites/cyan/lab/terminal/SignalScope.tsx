import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { useMotionPaused } from "@/lib/motion-pause";
import { formatUptime, useUptime } from "./useUptime";

const POINTS = 200;
const WIDTH = 400;
const HEIGHT = 140;
const MID = HEIGHT / 2;
/** One pass of the beam across the screen. */
const SWEEP_MS = 3600;
/** Blank samples ahead of the beam, where the old trace is being wiped. */
const GAP = 10;
/** Every few seconds the receiver catches something that fades before it locks. */
const SEARCH_EVERY_MS = 3100;
const SEARCH_MS = 620;

/** The receiver's level at time t (ms): hiss, plus a carrier that rings and dies. */
function level(t: number, random: () => number) {
  const hiss = (random() - 0.5) * 0.07;
  const since = t % SEARCH_EVERY_MS;
  if (since > SEARCH_MS) return hiss;
  const fade = Math.exp(-since / 150);
  return hiss + Math.sin(since / 11) * 0.62 * fade;
}

function toPath(samples: Float32Array, head: number, still: boolean) {
  let d = "";
  let pen = false;
  for (let i = 0; i < POINTS; i++) {
    const ahead = (i - head + POINTS) % POINTS;
    if (!still && ahead > 0 && ahead <= GAP) {
      pen = false;
      continue;
    }
    const x = (i / (POINTS - 1)) * WIDTH;
    const y = MID - samples[i] * (MID - 8);
    d += `${pen ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    pen = true;
  }
  return d;
}

/** A fixed seed, so the still frame is the same on every visit. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * The not-found page's instrument: an oscilloscope sweeping for a signal that
 * never locks. The beam writes left to right and wipes the old trace ahead of
 * it, as a monitor does. Under reduced motion or the site-wide pause it is a
 * single still frame (a flat line with one dying burst) and no loop runs.
 */
export function SignalScope({ pathname }: { pathname: string }) {
  const reduced = useReducedMotion();
  const paused = useMotionPaused();
  const still = Boolean(reduced) || paused;
  const searching = useUptime(still);
  const traceRef = useRef<SVGPathElement>(null);
  const headRef = useRef<SVGCircleElement>(null);
  const samples = useRef<Float32Array | null>(null);

  useEffect(() => {
    if (!samples.current) {
      // Start from the still frame: hiss, with one burst caught mid-screen.
      const random = seeded(404);
      const data = new Float32Array(POINTS);
      for (let i = 0; i < POINTS; i++) {
        const t = ((i - 80) / POINTS) * SWEEP_MS;
        data[i] = t >= 0 && t < SEARCH_MS ? level(t, random) : (random() - 0.5) * 0.07;
      }
      samples.current = data;
    }
    const data = samples.current;
    const trace = traceRef.current;
    const headDot = headRef.current;
    if (!trace || !headDot) return;

    if (still) {
      trace.setAttribute("d", toPath(data, 0, true));
      headDot.style.opacity = "0";
      return;
    }

    headDot.style.opacity = "1";
    let frame = 0;
    let start = 0;
    let last = -1;
    const tick = (now: number) => {
      if (!start) start = now;
      const elapsed = now - start;
      const head = Math.floor(((elapsed % SWEEP_MS) / SWEEP_MS) * POINTS);
      // Fill every sample the beam passed since the last frame.
      if (last < 0) last = head;
      let i = last;
      while (i !== head) {
        i = (i + 1) % POINTS;
        data[i] = level(elapsed - ((head - i + POINTS) % POINTS) * (SWEEP_MS / POINTS), Math.random);
      }
      last = head;
      trace.setAttribute("d", toPath(data, head, false));
      const x = (head / (POINTS - 1)) * WIDTH;
      const y = MID - data[head] * (MID - 8);
      headDot.setAttribute("cx", x.toFixed(1));
      headDot.setAttribute("cy", y.toFixed(1));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [still]);

  return (
    <figure className="nf-scope lab-panel" aria-label="An oscilloscope searching for a signal and finding none">
      <div className="nf-scope-bar mono">
        <span className="nf-scope-led" aria-hidden="true" />
        <span>No carrier</span>
        <span className="nf-scope-ch">CH-??</span>
      </div>
      <div className="nf-scope-screen">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <g className="nf-scope-grid">
            {Array.from({ length: 9 }, (_, i) => (
              <line key={`v${i}`} x1={(i + 1) * (WIDTH / 10)} x2={(i + 1) * (WIDTH / 10)} y1={0} y2={HEIGHT} />
            ))}
            {Array.from({ length: 3 }, (_, i) => (
              <line key={`h${i}`} y1={(i + 1) * (HEIGHT / 4)} y2={(i + 1) * (HEIGHT / 4)} x1={0} x2={WIDTH} />
            ))}
          </g>
          <path ref={traceRef} className="nf-scope-trace" />
          <circle ref={headRef} className="nf-scope-head" r={3} cx={0} cy={MID} />
        </svg>
        <span className="nf-scope-static" aria-hidden="true" />
      </div>
      <dl className="nf-scope-readouts mono">
        <div>
          <dt>Status</dt>
          <dd className="lab-readout">404</dd>
        </div>
        <div>
          <dt>Searching</dt>
          <dd className="lab-readout">{formatUptime(searching)}</dd>
        </div>
        <div className="nf-scope-path">
          <dt>Path</dt>
          <dd className="lab-readout">{pathname}</dd>
        </div>
      </dl>
    </figure>
  );
}

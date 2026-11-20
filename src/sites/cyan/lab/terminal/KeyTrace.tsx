import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export interface KeyTraceHandle {
  /** Feed the trace some energy: a keystroke is small, a command is large. */
  bump: (strength: number) => void;
}

const SAMPLES = 96;
const WIDTH = 240;
const HEIGHT = 24;
/** About thirty samples a second, so the trace scrolls at a calm, readable pace. */
const STEP_MS = 33;

const FLAT = `M0 ${HEIGHT / 2}H${WIDTH}`;

function tracePath(data: Float32Array) {
  const mid = HEIGHT / 2;
  let d = "";
  for (let i = 0; i < SAMPLES; i++) {
    const x = (i / (SAMPLES - 1)) * WIDTH;
    const y = mid - data[i] * (mid - 2);
    d += `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(2)}`;
  }
  return d;
}

/**
 * A small oscilloscope strip at the foot of the terminal. Each keystroke
 * kicks the beam; the ringing decays back to a flat line, and the animation
 * loop stops as soon as it is flat. Under reduced motion or the site-wide
 * pause the strip is a still, flat line and no loop runs.
 */
export const KeyTrace = forwardRef<KeyTraceHandle, { still: boolean }>(function KeyTrace({ still }, ref) {
  const pathRef = useRef<SVGPathElement>(null);
  // All of the loop's state lives in one ref, so the frame callback never goes stale.
  const loop = useRef({
    samples: new Float32Array(SAMPLES),
    energy: 0,
    phase: 0,
    frame: 0,
    last: 0,
    still,
  });
  loop.current.still = still;

  useImperativeHandle(ref, () => ({
    bump: (strength: number) => {
      const state = loop.current;
      if (state.still) return;
      state.energy = Math.min(1, state.energy + strength);
      if (state.frame) return;
      const tick = (now: number) => {
        state.frame = 0;
        if (state.still) return;
        if (now - state.last >= STEP_MS) {
          state.last = now;
          const data = state.samples;
          data.copyWithin(0, 1);
          state.phase += 1.35;
          const jitter = 0.65 + Math.random() * 0.35;
          data[SAMPLES - 1] = Math.max(-1, Math.min(1, state.energy * Math.sin(state.phase) * jitter));
          state.energy *= 0.84;
          let peak = 0;
          for (let i = 0; i < SAMPLES; i++) peak = Math.max(peak, Math.abs(data[i]));
          // Flat again: rest the loop until the next keystroke.
          if (state.energy < 0.01 && peak < 0.01) {
            data.fill(0);
            pathRef.current?.setAttribute("d", FLAT);
            return;
          }
          pathRef.current?.setAttribute("d", tracePath(data));
        }
        state.frame = requestAnimationFrame(tick);
      };
      state.frame = requestAnimationFrame(tick);
    },
  }));

  // Pausing flattens the trace and ends the loop.
  useEffect(() => {
    if (!still) return;
    const state = loop.current;
    cancelAnimationFrame(state.frame);
    state.frame = 0;
    state.energy = 0;
    state.samples.fill(0);
    pathRef.current?.setAttribute("d", FLAT);
  }, [still]);
  // Unmounting always ends it.
  useEffect(() => {
    const state = loop.current;
    return () => cancelAnimationFrame(state.frame);
  }, []);

  return (
    <svg
      className="term-trace"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path className="term-trace-base" d={FLAT} />
      <path ref={pathRef} className="term-trace-beam" d={FLAT} />
    </svg>
  );
});

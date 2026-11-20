import type { LogKind } from "./data";

/*
 * Each kind of entry has its own waveform, so the trace can be read at a
 * glance: a square pulse for work, a sine burst for a project, a ramp for
 * research, a triangle for writing, a staircase for education and a single
 * spike for this site. The present is a heartbeat. A wave is a list of
 * [t, a] vertices, t running 0 → 1 along the time axis, a from -1 to 1.
 */

export type WaveKind = LogKind | "now";
type Wave = readonly (readonly [number, number])[];

const burst = (cycles: number, samples: number): Wave =>
  Array.from({ length: samples + 1 }, (_, i) => {
    const t = i / samples;
    return [t, Math.sin(Math.PI * 2 * cycles * t) * Math.sin(Math.PI * t)] as const;
  });

export const WAVES: Record<WaveKind, Wave> = {
  work: [
    [0, 0],
    [0.14, 0],
    [0.14, 1],
    [0.5, 1],
    [0.5, -1],
    [0.86, -1],
    [0.86, 0],
    [1, 0],
  ],
  project: burst(2, 28),
  research: [
    [0, 0],
    [0.08, -0.85],
    [0.44, 0.95],
    [0.44, -0.85],
    [0.8, 0.95],
    [0.8, 0],
    [1, 0],
  ],
  writing: [
    [0, 0],
    [0.12, 0.9],
    [0.36, -0.9],
    [0.6, 0.9],
    [0.84, -0.9],
    [1, 0],
  ],
  education: [
    [0, 0],
    [0.16, 0],
    [0.16, 0.34],
    [0.38, 0.34],
    [0.38, 0.68],
    [0.6, 0.68],
    [0.6, 1],
    [0.82, 1],
    [0.82, 0],
    [1, 0],
  ],
  site: [
    [0, 0],
    [0.42, 0],
    [0.5, 1],
    [0.56, -0.7],
    [0.62, 0],
    [1, 0],
  ],
  now: [
    [0, 0],
    [0.3, 0],
    [0.37, -0.3],
    [0.45, 1],
    [0.53, -0.9],
    [0.6, 0.25],
    [0.66, 0],
    [1, 0],
  ],
};

const round = (value: number) => Math.round(value * 10) / 10;

/** A small horizontal glyph of a kind's wave, for chips and labels. */
export function glyphPath(kind: WaveKind, width = 28, height = 12) {
  const middle = height / 2;
  const reach = middle - 1.5;
  return WAVES[kind]
    .map(([t, a], i) => `${i ? "L" : "M"}${round(t * width)} ${round(middle - a * reach)}`)
    .join(" ");
}

export interface TraceNode {
  /** Where the node sits down the rail, in pixels from the top of the list. */
  y: number;
  kind: WaveKind;
}

export interface Trace {
  d: string;
  xs: number[];
  ys: number[];
  /** Length of the path up to each vertex. */
  lengths: number[];
  total: number;
}

/** The longest a pulse is drawn, and the gap it keeps above its node. */
const PULSE = 72;
const LEAD = 8;

/**
 * The rail's signal: a flat line down the rail that writes each node's wave
 * just above it, so the beam draws the wave and then reaches the node. Pulses
 * shrink where nodes sit close together. y never decreases along the path,
 * which is what lets the scroll position be turned into a length.
 */
export function buildTrace(nodes: TraceNode[], height: number, cx: number, amp: number): Trace {
  const xs: number[] = [cx];
  const ys: number[] = [0];
  const push = (x: number, y: number) => {
    const last = xs.length - 1;
    if (Math.abs(xs[last] - x) < 0.05 && Math.abs(ys[last] - y) < 0.05) return;
    xs.push(x);
    ys.push(y);
  };
  let floor = 0;
  for (const node of nodes) {
    const end = node.y - LEAD;
    const span = Math.min(PULSE, end - floor - 6);
    if (span > 10) {
      const start = end - span;
      push(cx, start);
      for (const [t, a] of WAVES[node.kind]) push(cx + a * amp, start + t * span);
    }
    push(cx, Math.max(node.y, ys[ys.length - 1]));
    floor = node.y;
  }
  push(cx, Math.max(height, ys[ys.length - 1]));

  const lengths = [0];
  for (let i = 1; i < xs.length; i++) lengths.push(lengths[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]));
  const d = xs.map((x, i) => `${i ? "L" : "M"}${round(x)} ${round(ys[i])}`).join(" ");
  return { d, xs, ys, lengths, total: lengths[lengths.length - 1] || 1 };
}

/** The last index whose value is at most `target`, in a list that never decreases. */
function lastAtMost(values: number[], target: number) {
  let lo = 0;
  let hi = values.length - 1;
  if (target < values[0]) return -1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (values[mid] <= target) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** How much of the trace is written when the beam has come down to `y`. */
export function lengthAtY(trace: Trace, y: number) {
  const { ys, lengths } = trace;
  const i = lastAtMost(ys, y);
  if (i < 0) return 0;
  if (i >= ys.length - 1) return trace.total;
  const fraction = (y - ys[i]) / (ys[i + 1] - ys[i]);
  return lengths[i] + fraction * (lengths[i + 1] - lengths[i]);
}

/** The point at a length along the trace. */
export function pointAtLength(trace: Trace, length: number) {
  const { xs, ys, lengths } = trace;
  const i = Math.max(0, lastAtMost(lengths, length));
  if (i >= xs.length - 1) return { x: xs[xs.length - 1], y: ys[ys.length - 1] };
  const step = lengths[i + 1] - lengths[i] || 1;
  const fraction = Math.min(1, Math.max(0, (length - lengths[i]) / step));
  return { x: xs[i] + (xs[i + 1] - xs[i]) * fraction, y: ys[i] + (ys[i + 1] - ys[i]) * fraction };
}

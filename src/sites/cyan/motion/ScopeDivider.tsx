import { useEffect, useId, useMemo, useRef, type KeyboardEvent } from "react";
import { githubSnapshot } from "@/data/github-activity";
import type { ContributionDay } from "@/lib/github-activity";
import { isMotionPaused } from "@/lib/motion-pause";
import "./scope-divider.css";

/*
 * A strip between sections that draws a real series as an oscilloscope trace.
 * When it scrolls into view the beam writes the series once, left to right; the
 * tail cools like phosphor and the trace stays stored, dim. A read cursor
 * (pointer, touch or arrow keys) reports any point in amber, the colour kept
 * for measurements. After the sweep nothing animates, so the canvas only
 * redraws when something changes.
 */

export interface ScopePoint {
  /** Calendar day, YYYY-MM-DD. */
  date: string;
  value: number;
}

export interface ScopeSeries {
  label: string;
  unit: string;
  /** Honesty tag for the corner, such as "[Snapshot · 22 Oct 2026]". */
  tag: string;
  points: ScopePoint[];
}

export interface ScopeDividerProps {
  series?: ScopeSeries;
  caption?: string;
}

type Rgb = readonly [number, number, number];
type Phase = "waiting" | "sweeping" | "done";

interface Palette {
  light: boolean;
  beam: Rgb;
  hot: Rgb;
  amber: Rgb;
  grid: Rgb;
}

interface Plot {
  width: number;
  height: number;
  dpr: number;
  top: number;
  bottom: number;
}

interface Trace {
  xs: number[];
  ys: number[];
  /** When the sweep reaches each point, in ms from its start. */
  written: number[];
}

interface Layer {
  width: number;
  alpha: number;
}

interface ScopeEngine {
  redraw: () => void;
  relayout: () => void;
  stop: () => void;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 86_400_000;
const WINDOW_DAYS = 7;
/** The plot's side margin in CSS pixels; matches --scope-inset in scope-divider.css. */
const INSET = 12;
const SWEEP_MS = 1400;
/** Phosphor decay: the tail falls to 1/e of its glow in this time. */
const TAU_MS = 300;
/** By now the tail has cooled into the stored trace, so the loop can stop. */
const SETTLE_MS = SWEEP_MS + 5 * TAU_MS;
const MAJOR = 120;
const MINOR = MAJOR / 5;
const TURN = Math.PI * 2;
const WHITE: Rgb = [255, 255, 255];
/** How bright the stored trace stays: dim phosphor on the dark screen, dry ink on paper. */
const STORED = { dark: 0.45, light: 0.8 };
// On the dark screen light adds up: a wide faint glow, a halo and a hot core.
const BEAM: Layer[] = [
  { width: 7, alpha: 0.07 },
  { width: 2.6, alpha: 0.24 },
  { width: 1.1, alpha: 0.9 },
];
// In the light theme the trace is ink on paper: a slight bleed under a crisp line.
const INK: Layer[] = [
  { width: 3, alpha: 0.1 },
  { width: 1.25, alpha: 0.9 },
];
const KEYS_HINT =
  "Use the left and right arrow keys to move the read cursor, with Shift to move seven points. Home and End go to the first and last points.";

/* ------------------------------------------------------------- Series */

const dayNumber = (date: string) => {
  const [year, month, day] = date.slice(0, 10).split("-").map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS);
};
const dayString = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);

/** "2026-09-14" as "14 Sep 2026". Spelt out by hand: en-GB formatting now gives "Sept". */
function formatDay(date: string) {
  const [year, month, day] = date.slice(0, 10).split("-").map(Number);
  return year && day && MONTHS[month - 1] ? `${day} ${MONTHS[month - 1]} ${year}` : date;
}

const formatValue = (value: number) => value.toLocaleString("en-GB", { maximumFractionDigits: 2 });

/**
 * Daily GitHub contributions as a seven-day rolling total, so a year of mostly
 * quiet days reads as a signal rather than as noise. Each point sums the seven
 * days ending on its date. Missing days count as zero, and the first six days
 * only fill the window, so every point covers a whole week. The tag carries the
 * snapshot's date: `fetchedAt` if given, otherwise the last day in the calendar.
 */
// eslint-disable-next-line react-refresh/only-export-components -- the default series and its tests share this helper
export function githubSeries(calendar: ContributionDay[], fetchedAt?: string): ScopeSeries {
  const counts = new Map<number, number>();
  for (const { date, count } of calendar) {
    const day = dayNumber(date);
    if (Number.isFinite(day) && Number.isFinite(count)) counts.set(day, (counts.get(day) ?? 0) + count);
  }
  const days = [...counts.keys()].sort((a, b) => a - b);
  const points: ScopePoint[] = [];
  if (days.length) {
    const first = days[0];
    let total = 0;
    for (let day = first; day <= days[days.length - 1]; day++) {
      total += (counts.get(day) ?? 0) - (counts.get(day - WINDOW_DAYS) ?? 0);
      if (day - first >= WINDOW_DAYS - 1) points.push({ date: dayString(day), value: total });
    }
  }
  const taken = fetchedAt ? fetchedAt.slice(0, 10) : days.length ? dayString(days[days.length - 1]) : "";
  return {
    label: "GitHub contributions",
    unit: "contributions / 7 days",
    tag: taken ? `[Snapshot · ${formatDay(taken)}]` : "[Snapshot]",
    points,
  };
}

const DEFAULT_SERIES = githubSeries(githubSnapshot.calendar, githubSnapshot.fetchedAt);

/** The text equivalent of the trace: its span, its peak and where it ends. */
function summarise({ label, unit, tag, points }: ScopeSeries) {
  const note = tag.replace(/[[\]]/g, "").replace(/\s*·\s*/g, ", ").trim();
  const ending = note ? ` ${note}.` : "";
  if (!points.length) return `${label}: no data yet.${ending}`;
  const first = points[0];
  const last = points[points.length - 1];
  const peak = points.reduce((best, point) => (point.value > best.value ? point : best), first);
  return (
    `${label} (${unit}), ${formatDay(first.date)} to ${formatDay(last.date)}. ` +
    `Highest ${formatValue(peak.value)} on ${formatDay(peak.date)}; ` +
    `latest ${formatValue(last.value)} on ${formatDay(last.date)}.${ending}`
  );
}

/** The readout is written straight to the DOM, because it follows every pointer move. */
function writeReadout(screen: HTMLElement | null, readout: HTMLElement | null, series: ScopeSeries, index: number | null) {
  if (!screen || !readout) return;
  const point = index === null ? undefined : series.points[index];
  const text = point ? `${formatDay(point.date)} · ${formatValue(point.value)} ${series.unit}` : "";
  if (readout.textContent !== text) readout.textContent = text;
  if (point && index !== null) {
    const across = series.points.length > 1 ? index / (series.points.length - 1) : 0.5;
    readout.style.setProperty("--scope-x", String(across));
  }
  screen.dataset.probe = point ? "on" : "off";
}

/* ------------------------------------------------------------- Easing */

/** One coordinate of a cubic Bézier whose ends sit at 0 and 1. */
const bezier = (t: number, p1: number, p2: number) =>
  3 * (1 - t) * (1 - t) * t * p1 + 3 * (1 - t) * t * t * p2 + t * t * t;

/** Solves a rising Bézier coordinate for t, by bisection. */
function solve(target: number, p1: number, p2: number) {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (bezier(mid, p1, p2) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** The site's cubic-bezier(0.16, 1, 0.3, 1): how far the sweep is at a fraction of its time. */
const ease = (time: number) => (time <= 0 ? 0 : time >= 1 ? 1 : bezier(solve(time, 0.16, 0.3), 1, 1));
/** Its inverse: the fraction of the time at which the sweep reaches a fraction of the width. */
const easeInverse = (progress: number) =>
  progress <= 0 ? 0 : progress >= 1 ? 1 : bezier(solve(progress, 1, 1), 0.16, 0.3);

/* ------------------------------------------------------------ Colours */

const rgba = (colour: Rgb, alpha: number) =>
  `rgba(${colour[0]},${colour[1]},${colour[2]},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

/** Any CSS colour as RGB, using the canvas's own parser. Unset or unparseable values use the fallback. */
function toRgb(ctx: CanvasRenderingContext2D, value: string, fallback: Rgb): Rgb {
  if (!value) return fallback;
  const sentinel = "#010203";
  ctx.fillStyle = sentinel;
  ctx.fillStyle = value;
  const parsed = String(ctx.fillStyle);
  if (parsed === sentinel) return fallback;
  if (/^#[0-9a-f]{6}$/i.test(parsed)) {
    const n = parseInt(parsed.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const parts = parsed.match(/[\d.]+/g);
  return parsed.startsWith("rgb") && parts && parts.length >= 3
    ? [Number(parts[0]), Number(parts[1]), Number(parts[2])]
    : fallback;
}

/** Theme colours from the stylesheet, so a theme switch reaches the canvas. */
function readPalette(element: HTMLElement, ctx: CanvasRenderingContext2D): Palette {
  const style = getComputedStyle(element);
  const read = (name: string) => style.getPropertyValue(name).trim();
  const mode = read("--scope-mode");
  const light = mode ? mode === "light" : element.closest('[data-theme="light"]') !== null;
  const beam = toRgb(ctx, read("--scope-beam"), light ? [8, 124, 112] : [83, 218, 206]);
  return {
    light,
    beam,
    hot: light ? beam : mix(beam, WHITE, 0.55),
    amber: toRgb(ctx, read("--scope-amber"), light ? [168, 98, 10] : [240, 176, 74]),
    grid: toRgb(ctx, read("--scope-grid"), light ? [209, 221, 214] : [38, 55, 51]),
  };
}

/* ------------------------------------------------------------ Drawing */

/** Where the trace is at a fractional sample index. */
function pointAt({ xs, ys }: Trace, at: number) {
  const i = Math.max(0, Math.min(xs.length - 1, Math.floor(at)));
  const j = Math.min(xs.length - 1, i + 1);
  const rest = Math.max(0, at - i);
  return { x: xs[i] + (xs[j] - xs[i]) * rest, y: ys[i] + (ys[j] - ys[i]) * rest };
}

/** Builds the path from sample `from` to a fractional index `to`. */
function tracePath(ctx: CanvasRenderingContext2D, trace: Trace, from: number, to: number) {
  const { xs, ys } = trace;
  const end = Math.floor(to);
  ctx.beginPath();
  ctx.moveTo(xs[from], ys[from]);
  for (let i = from + 1; i <= end; i++) ctx.lineTo(xs[i], ys[i]);
  if (to > end) {
    const tip = pointAt(trace, to);
    ctx.lineTo(tip.x, tip.y);
  }
  // A lone sample still shows, as a dot under the round cap.
  if (to <= from) ctx.lineTo(xs[from] + 0.01, ys[from]);
}

/** Strokes the current path once per layer; the innermost layer takes the core colour. */
function strokeLayers(
  ctx: CanvasRenderingContext2D,
  layers: Layer[],
  outer: string | CanvasGradient,
  core: string | CanvasGradient,
  strength: number,
) {
  layers.forEach((layer, index) => {
    ctx.strokeStyle = index === layers.length - 1 ? core : outer;
    ctx.globalAlpha = Math.min(1, layer.alpha * strength);
    ctx.lineWidth = layer.width;
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
}

/** A faint graticule: dotted major divisions, and a solid centre axis with minor ticks. */
function drawGraticule(ctx: CanvasRenderingContext2D, plot: Plot, palette: Palette) {
  const { width, top, bottom } = plot;
  const crisp = (value: number) => Math.round(value) + 0.5;
  const centre = width / 2;
  const middle = crisp((top + bottom) / 2);
  ctx.lineCap = "butt";
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(palette.grid, 1);
  ctx.setLineDash([1, 3]);
  ctx.beginPath();
  // Divisions run out from the centre, as on a scope's screen.
  for (let x = centre - Math.floor(centre / MAJOR) * MAJOR; x <= width; x += MAJOR) {
    ctx.moveTo(crisp(x), top);
    ctx.lineTo(crisp(x), bottom);
  }
  for (const row of [0, 1, 3, 4]) {
    const y = crisp(top + ((bottom - top) * row) / 4);
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(0, middle);
  ctx.lineTo(width, middle);
  for (let x = centre - Math.floor(centre / MINOR) * MINOR; x <= width; x += MINOR) {
    const reach = Math.abs(Math.round((x - centre) / MINOR)) % 5 === 0 ? 4 : 2;
    ctx.moveTo(crisp(x), middle - reach);
    ctx.lineTo(crisp(x), middle + reach);
  }
  ctx.stroke();
}

/** The stretch written in the last few τ glows above the stored trace and cools with time. */
function drawTail(
  ctx: CanvasRenderingContext2D,
  trace: Trace,
  at: number,
  clock: number,
  palette: Palette,
  layers: Layer[],
  stored: number,
) {
  const { xs, written } = trace;
  let from = Math.floor(at);
  while (from > 0 && clock - written[from - 1] < 4 * TAU_MS) from--;
  const head = pointAt(trace, at);
  const span = head.x - xs[from];
  if (span < 0.5) return;
  const beam = ctx.createLinearGradient(xs[from], 0, head.x, 0);
  const hot = ctx.createLinearGradient(xs[from], 0, head.x, 0);
  const heat = (time: number) => (1 - stored) * Math.exp(-Math.max(0, clock - time) / TAU_MS);
  // Brightness only rises along x, so a few dozen stops describe it.
  const step = Math.max(1, Math.ceil((at - from) / 48));
  for (let i = from; i < at; i += step) {
    const offset = (xs[i] - xs[from]) / span;
    if (offset >= 1) break;
    beam.addColorStop(offset, rgba(palette.beam, heat(written[i])));
    hot.addColorStop(offset, rgba(palette.hot, heat(written[i])));
  }
  beam.addColorStop(1, rgba(palette.beam, 1 - stored));
  hot.addColorStop(1, rgba(palette.hot, 1 - stored));
  tracePath(ctx, trace, from, at);
  strokeLayers(ctx, layers, beam, hot, 1);
}

/** The beam's spot: a bloom on the dark screen, a pen tip on paper. */
function drawHead(ctx: CanvasRenderingContext2D, x: number, y: number, bloom: number, palette: Palette) {
  if (bloom < 0.01) return;
  if (palette.light) {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = rgba(palette.beam, bloom);
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, TURN);
    ctx.fill();
    return;
  }
  ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 12);
  glow.addColorStop(0, rgba(palette.hot, 0.5 * bloom));
  glow.addColorStop(1, rgba(palette.beam, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 12, 0, TURN);
  ctx.fill();
  ctx.fillStyle = rgba(palette.hot, bloom);
  ctx.beginPath();
  ctx.arc(x, y, 1.6, 0, TURN);
  ctx.fill();
}

/** The read cursor: an amber line and marker, with the stretch being read lit up. */
function drawCursor(
  ctx: CanvasRenderingContext2D,
  plot: Plot,
  trace: Trace,
  index: number,
  palette: Palette,
  layers: Layer[],
) {
  const { xs, ys } = trace;
  const x = Math.round(xs[index]) + 0.5;
  ctx.globalCompositeOperation = "source-over";
  ctx.lineCap = "butt";
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(palette.amber, 0.6);
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(x, plot.top - 4);
  ctx.lineTo(x, plot.bottom + 4);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineCap = "round";
  ctx.globalCompositeOperation = palette.light ? "source-over" : "lighter";
  tracePath(ctx, trace, Math.max(0, index - 3), Math.min(xs.length - 1, index + 3));
  strokeLayers(ctx, layers, rgba(palette.beam, 1), rgba(palette.hot, 1), 0.55);
  ctx.globalCompositeOperation = "source-over";
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(palette.amber, 0.95);
  ctx.beginPath();
  ctx.arc(xs[index], ys[index], 3.5, 0, TURN);
  ctx.stroke();
}

/* ------------------------------------------------------------- Engine */

interface EngineParts {
  screen: HTMLElement;
  canvas: HTMLCanvasElement;
  head: HTMLElement | null;
  foot: HTMLElement | null;
  points: () => ScopePoint[];
  cursor: () => number | null;
}

/**
 * Runs one strip's canvas. Frames are requested only while the sweep plays or
 * when something changes, so an idle strip costs nothing. The sweep waits while
 * the strip is off screen, and its clock moves in clamped steps, so a hidden tab
 * pauses it rather than skipping it. Reduced motion and the site-wide pause draw
 * the whole trace at once, including mid-sweep. Returns null without a 2D context.
 */
function startScope({ screen, canvas, head, foot, points, cursor }: EngineParts): ScopeEngine | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const still = () => motion.matches || isMotionPaused();
  const canObserve = typeof IntersectionObserver !== "undefined";
  let plot: Plot = { width: 0, height: 0, dpr: 1, top: 0, bottom: 0 };
  let palette = readPalette(screen, ctx);
  let trace: Trace = { xs: [], ys: [], written: [] };
  let phase: Phase = "waiting";
  let clock = 0;
  let last: number | null = null;
  let frame = 0;
  let onScreen = true;

  const setPhase = (next: Phase) => {
    phase = next;
    screen.dataset.sweep = next;
  };

  const layout = () => {
    const values = points();
    const n = values.length;
    let lo = 0;
    let hi = 0;
    for (const point of values) {
      lo = Math.min(lo, point.value);
      hi = Math.max(hi, point.value);
    }
    // Headroom keeps the peak's glow clear of the top division.
    const span = (hi - lo) * 1.12 || 1;
    const across = Math.max(1, plot.width - INSET * 2);
    trace = { xs: [], ys: [], written: [] };
    values.forEach((point, i) => {
      const fraction = n > 1 ? i / (n - 1) : 0.5;
      trace.xs.push(INSET + across * fraction);
      trace.ys.push(plot.bottom - ((point.value - lo) / span) * (plot.bottom - plot.top));
      trace.written.push(SWEEP_MS * easeInverse(fraction));
    });
  };

  const draw = () => {
    const { width, height, dpr } = plot;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, width, height);
    if (width < 2 || height < 2) return;
    drawGraticule(ctx, plot, palette);
    const n = trace.xs.length;
    if (!n) return;
    const layers = palette.light ? INK : BEAM;
    const stored = palette.light ? STORED.light : STORED.dark;
    const beam = rgba(palette.beam, 1);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // Light adds up on the dark screen, like phosphor; on paper, ink layers normally.
    ctx.globalCompositeOperation = palette.light ? "source-over" : "lighter";
    if (phase === "done") {
      tracePath(ctx, trace, 0, n - 1);
      strokeLayers(ctx, layers, beam, beam, stored);
    } else if (phase === "sweeping") {
      const at = ease(clock / SWEEP_MS) * (n - 1);
      tracePath(ctx, trace, 0, at);
      strokeLayers(ctx, layers, beam, beam, stored);
      drawTail(ctx, trace, at, clock, palette, layers, stored);
      const spot = pointAt(trace, at);
      const bloom = clock <= SWEEP_MS ? 1 : Math.exp(-(clock - SWEEP_MS) / TAU_MS);
      drawHead(ctx, spot.x, spot.y, bloom, palette);
    }
    const index = cursor();
    if (index !== null && index < n) drawCursor(ctx, plot, trace, index, palette, layers);
  };

  const measure = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    // The trace runs between the label rows, wherever the labels wrap to.
    let top = head ? head.offsetTop + head.offsetHeight + 6 : 0;
    let bottom = foot ? foot.offsetTop - 6 : 0;
    if (bottom - top < 12) {
      top = Math.min(30, height * 0.25);
      bottom = height - Math.min(26, height * 0.2);
    }
    plot = { width, height, dpr, top, bottom };
    palette = readPalette(screen, ctx);
    layout();
    draw();
  };

  const tick = (now: number) => {
    frame = 0;
    if (phase === "sweeping") {
      if (!onScreen) {
        last = null;
        return;
      }
      clock += last === null ? 0 : Math.min(now - last, 64);
      last = now;
      if (still() || clock >= SETTLE_MS) setPhase("done");
    }
    draw();
    if (phase === "sweeping") frame = requestAnimationFrame(tick);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(tick);
  };
  const finish = () => {
    if (phase === "done") return;
    setPhase("done");
    schedule();
  };
  const begin = () => {
    if (phase !== "waiting") return;
    if (still()) {
      finish();
      return;
    }
    setPhase("sweeping");
    clock = 0;
    last = null;
    schedule();
  };

  setPhase(canObserve && !still() ? "waiting" : "done");
  // The sweep plays once, when most of the strip is in view.
  const reveal = canObserve
    ? new IntersectionObserver(
        (entries, observer) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          observer.disconnect();
          begin();
        },
        { threshold: 0.5, rootMargin: "0px 0px -10% 0px" },
      )
    : null;
  const presence = canObserve
    ? new IntersectionObserver((entries) => {
        onScreen = entries[entries.length - 1].isIntersecting;
        if (onScreen && phase === "sweeping") schedule();
      })
    : null;
  reveal?.observe(screen);
  presence?.observe(screen);

  const onMotion = () => {
    if (motion.matches) finish();
  };
  motion.addEventListener?.("change", onMotion);

  const repaint = () => {
    palette = readPalette(screen, ctx);
    draw();
  };
  const themed = screen.closest("[data-theme]");
  const theme = themed && typeof MutationObserver !== "undefined" ? new MutationObserver(repaint) : null;
  if (themed) theme?.observe(themed, { attributes: true, attributeFilter: ["data-theme"] });

  const sizer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
  sizer?.observe(screen);
  if (!sizer) window.addEventListener("resize", measure);
  measure();

  return {
    redraw: schedule,
    relayout: () => {
      layout();
      schedule();
    },
    stop: () => {
      cancelAnimationFrame(frame);
      frame = 0;
      reveal?.disconnect();
      presence?.disconnect();
      theme?.disconnect();
      sizer?.disconnect();
      window.removeEventListener("resize", measure);
      motion.removeEventListener?.("change", onMotion);
    },
  };
}

/* ---------------------------------------------------------- Component */

/**
 * An oscilloscope strip between sections, drawing a real series. Defaults to
 * the build-time GitHub snapshot as a seven-day rolling total. Pass `series` as
 * a stable value (a module constant or a memo): a new object re-lays the trace.
 */
export function ScopeDivider({ series = DEFAULT_SERIES, caption }: ScopeDividerProps) {
  const id = useId();
  const screenRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const engineRef = useRef<ScopeEngine | null>(null);
  const cursorRef = useRef<number | null>(null);
  const seriesRef = useRef(series);
  seriesRef.current = series;
  const summary = useMemo(() => summarise(series), [series]);
  const first = series.points[0];
  const last = series.points[series.points.length - 1];

  const setCursor = (index: number | null) => {
    const count = seriesRef.current.points.length;
    const next = index === null || !count ? null : Math.max(0, Math.min(count - 1, index));
    if (next === cursorRef.current) return;
    cursorRef.current = next;
    writeReadout(screenRef.current, readoutRef.current, seriesRef.current, next);
    engineRef.current?.redraw();
  };

  /** The sample nearest a pointer, measured live so layout changes never misalign it. */
  const indexAt = (clientX: number) => {
    const screen = screenRef.current;
    const count = seriesRef.current.points.length;
    if (!screen || !count) return null;
    const box = screen.getBoundingClientRect();
    const fraction = (clientX - box.left - INSET) / Math.max(1, box.width - INSET * 2);
    return Math.round(Math.max(0, Math.min(1, fraction)) * (count - 1));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Leave browser shortcuts such as Alt+Left (back) alone.
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const count = seriesRef.current.points.length;
    if (!count) return;
    const current = cursorRef.current ?? count - 1;
    const stride = event.shiftKey ? 7 : 1;
    let next: number;
    switch (event.key) {
      case "ArrowLeft":
        next = current - stride;
        break;
      case "ArrowRight":
        next = current + stride;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = count - 1;
        break;
      case "Escape":
        if (cursorRef.current === null) return;
        setCursor(null);
        return;
      default:
        return;
    }
    event.preventDefault();
    setCursor(next);
  };

  useEffect(() => {
    const screen = screenRef.current;
    const canvas = canvasRef.current;
    if (!screen || !canvas) return;
    const engine = startScope({
      screen,
      canvas,
      head: headRef.current,
      foot: footRef.current,
      points: () => seriesRef.current.points,
      cursor: () => cursorRef.current,
    });
    engineRef.current = engine;
    return () => {
      engine?.stop();
      engineRef.current = null;
    };
  }, []);

  // A new series keeps the read cursor in range and re-lays the trace.
  useEffect(() => {
    const count = series.points.length;
    const index = cursorRef.current;
    cursorRef.current = index === null || !count ? null : Math.min(index, count - 1);
    writeReadout(screenRef.current, readoutRef.current, series, cursorRef.current);
    engineRef.current?.relayout();
  }, [series]);

  return (
    <figure className="scope-divider">
      <div
        ref={screenRef}
        className="scope-screen"
        role="group"
        tabIndex={0}
        aria-labelledby={`${id}-summary`}
        aria-describedby={`${id}-keys`}
        onPointerDown={(event) => setCursor(indexAt(event.clientX))}
        onPointerMove={(event) => setCursor(indexAt(event.clientX))}
        onPointerLeave={(event) => {
          // A tap keeps its reading; a mouse reading ends when the pointer leaves.
          if (event.pointerType !== "touch" && document.activeElement !== event.currentTarget) setCursor(null);
        }}
        onPointerCancel={() => setCursor(null)}
        onFocus={() => {
          if (cursorRef.current === null) setCursor(seriesRef.current.points.length - 1);
        }}
        onBlur={() => setCursor(null)}
        onKeyDown={onKeyDown}
      >
        <canvas ref={canvasRef} className="scope-canvas" aria-hidden="true" />
        <div ref={headRef} className="scope-head" aria-hidden="true">
          <span className="scope-label">{series.label}</span>
          <span className="scope-meta">
            <span>{series.tag}</span>
            <span>{series.unit}</span>
          </span>
        </div>
        <div ref={footRef} className="scope-foot" aria-hidden="true">
          <span>{first ? formatDay(first.date) : ""}</span>
          <span>{last ? formatDay(last.date) : ""}</span>
        </div>
        <span ref={readoutRef} className="scope-readout" aria-live="polite" aria-atomic="true" />
        <span id={`${id}-summary`} className="scope-hidden">
          {summary}
        </span>
        <span id={`${id}-keys`} className="scope-hidden">
          {KEYS_HINT}
        </span>
      </div>
      {caption ? <figcaption className="scope-caption">{caption}</figcaption> : null}
    </figure>
  );
}

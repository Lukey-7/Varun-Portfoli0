import {
  memo,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { evidence, testCounts } from "@/data/portfolio";
import { isMotionPaused, useMotionPaused } from "@/lib/motion-pause";
import "./eval-meters.css";

/*
 * The Results section as LED meters, one channel per measured change: the
 * dense-only baseline as a ghost, the measured value lit in cyan, the change
 * as an amber bracket and readout. The first time a row scrolls into view its
 * meter kicks past the value, settles back and leaves a peak-hold tick that
 * drops onto the reading. The markup is always the final frame; the script
 * only borrows it for a couple of seconds, so reduced motion, the page-wide
 * pause, printing and a missing IntersectionObserver all show the real values.
 */

type Evidence = (typeof evidence)[number];

const SEGMENTS = 40;
// Ballistics in ms: attack and drop use the 240 ms tier, the hold 700 ms.
const ATTACK = 240;
const RELEASE = 600;
const HOLD = 700;
const DROP = 240;
const STAGGER = 80;
/** Time constant of a switched-off segment's afterglow. */
const AFTERGLOW = 300;
/** How far past the value the attack carries, as a share of full scale. */
const OVERSHOOT = 0.05;

interface EvalSet {
  set: string;
  n: number;
  baseline: string;
  measured: string;
  note?: string;
}

/** Each evaluation as its case study and write-up describe it. */
const EVAL_SETS: Record<Evidence["project"], EvalSet> = {
  StudyForge: {
    set: "33 labelled questions over three short documents",
    n: 33,
    baseline: "Dense only",
    measured: "Hybrid + MMR + LLM rerank",
    note: "Written for the repo: a development check, not a held-out benchmark",
  },
  MARA: {
    set: "35 labelled queries over 317 chunks",
    n: 35,
    baseline: "Dense only",
    measured: "Hybrid search + cross-encoder rerank",
  },
};

const TICKS = Array.from({ length: 21 }, (_, k) => k / 20);
const SCALE_LABELS = [0, 0.25, 0.5, 0.75, 1];

const places = (value: number) => {
  const text = String(value);
  return text.includes(".") ? text.length - text.indexOf(".") - 1 : 0;
};

/** Before, after and change, at the precision the results were reported to. */
function reading(item: Evidence) {
  const digits = Math.max(2, places(item.before), places(item.after));
  const change = item.after - item.before;
  const size = Math.abs(change).toFixed(digits);
  return {
    before: item.before.toFixed(digits),
    after: item.after.toFixed(digits),
    delta: `${change < 0 ? "−" : "+"}${size}`,
    spoken: `${change < 0 ? "down" : "up"} ${size}`,
  };
}

/** A segment lights once the level reaches its top edge, so a bar never overstates. */
const litCount = (level: number) =>
  Math.max(0, Math.min(SEGMENTS, Math.floor(level * SEGMENTS + 1e-6)));

const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;
const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
/** The site's cubic-bezier(0.16, 1, 0.3, 1) is, near enough, the exponential ease-out. */
const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - 2 ** (-10 * x));

/** Bar level and peak-hold tick `t` ms into a meter's reveal, on the 0–1 scale. */
function ballistics(t: number, value: number) {
  const top = Math.min(1, value + OVERSHOOT);
  if (t <= 0) return { level: 0, peak: 0, landed: false };
  if (t < ATTACK) {
    const level = top * easeOutCubic(t / ATTACK);
    return { level, peak: level, landed: false };
  }
  const since = t - ATTACK;
  const level = top + (value - top) * easeInOutCubic(Math.min(1, since / RELEASE));
  const peak = top + (value - top) * easeOutExpo(Math.max(0, (since - HOLD) / DROP));
  return { level, peak, landed: since >= HOLD + DROP };
}

type Phase = "armed" | "queued" | "playing" | "latched" | "done";

interface Channel {
  index: number;
  row: HTMLElement;
  meter: HTMLElement;
  segments: HTMLElement[];
  value: number;
  /** Brightness per segment now, and as last written to the DOM. */
  glow: Float32Array;
  shown: Float32Array;
  start: number;
  phase: Phase;
}

/**
 * Arms every meter at zero and plays each one when its row scrolls into view.
 * Runs on its own clock, which stops while the list is off screen. Returns a
 * function that jumps everything to the final frame and stops for good.
 */
function runMeters(list: HTMLElement, values: readonly number[], reduce: MediaQueryList | null) {
  const channels: Channel[] = [];
  list.querySelectorAll<HTMLElement>(".eval-row").forEach((row, index) => {
    const meter = row.querySelector<HTMLElement>(".eval-meter");
    if (!meter) return;
    const segments = Array.from(meter.querySelectorAll<HTMLElement>(".eval-seg"));
    channels.push({
      index,
      row,
      meter,
      segments,
      value: values[index] ?? 0,
      glow: new Float32Array(segments.length),
      shown: new Float32Array(segments.length),
      start: 0,
      phase: "armed",
    });
  });
  const byRow = new Map<Element, Channel>(channels.map((channel) => [channel.row, channel]));
  let clock = 0;
  let last = 0;
  let frame = 0;
  let visible = false;
  let lastStart = -Infinity;
  const active = (channel: Channel) =>
    channel.phase === "queued" || channel.phase === "playing" || channel.phase === "latched";

  function clearOverrides(channel: Channel) {
    channel.meter.style.removeProperty("--eval-g");
    channel.meter.style.removeProperty("--eval-peak");
    channel.segments.forEach((segment) => segment.style.removeProperty("--eval-g"));
  }

  function step(channel: Channel, dt: number) {
    const t = clock - channel.start;
    if (t < 0) return true;
    if (channel.phase === "queued") {
      channel.phase = "playing";
      channel.row.dataset.meter = "playing";
    }
    const { level, peak, landed } = ballistics(t, channel.value);
    const lit = litCount(level);
    const fade = Math.exp(-dt / AFTERGLOW);
    let glowing = false;
    for (let i = 0; i < channel.segments.length; i++) {
      // LEDs switch on at once; switched off, they fade like phosphor.
      let g = i < lit ? 1 : channel.glow[i] * fade;
      if (g < 0.02) g = 0;
      else if (i >= lit) glowing = true;
      channel.glow[i] = g;
      const was = channel.shown[i];
      const changed = g === 0 || g === 1 ? g !== was : Math.abs(g - was) >= 0.01;
      if (!changed) continue;
      channel.shown[i] = g;
      channel.segments[i].style.setProperty("--eval-g", g === 0 || g === 1 ? String(g) : g.toFixed(3));
    }
    channel.meter.style.setProperty("--eval-peak", peak.toFixed(4));
    if (landed && channel.phase === "playing") {
      channel.phase = "latched";
      channel.row.dataset.meter = "latched";
    }
    if (landed && !glowing) {
      channel.phase = "done";
      clearOverrides(channel);
      return false;
    }
    return true;
  }

  function tick(now: number) {
    frame = 0;
    // A long gap (a background tab) must not skip the reveal.
    const dt = last ? Math.min(now - last, 50) : 0;
    last = now;
    clock += dt;
    let busy = false;
    for (const channel of channels) if (active(channel)) busy = step(channel, dt) || busy;
    if (channels.every((channel) => channel.phase === "done")) {
      stop();
      return;
    }
    if (busy && visible) frame = requestAnimationFrame(tick);
    else last = 0;
  }

  function wake() {
    if (frame || !visible || !channels.some(active)) return;
    last = 0;
    frame = requestAnimationFrame(tick);
  }

  function trigger(channel: Channel) {
    if (channel.phase !== "armed") return;
    channel.phase = "queued";
    // Rows that arrive together play one after another; a late row starts at once.
    channel.start = Math.max(clock, lastStart + STAGGER);
    lastStart = channel.start;
    wake();
  }

  function onReduce() {
    if (reduce?.matches) stop();
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    view.disconnect();
    seen.disconnect();
    reduce?.removeEventListener("change", onReduce);
    for (const channel of channels) {
      if (channel.phase === "done") continue;
      channel.phase = "done";
      delete channel.row.dataset.meter;
      clearOverrides(channel);
    }
  }

  const view = new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    wake();
  });
  const seen = new IntersectionObserver(
    (entries) => {
      entries
        .filter((entry) => entry.isIntersecting)
        .map((entry) => byRow.get(entry.target))
        .filter((channel): channel is Channel => Boolean(channel))
        .sort((a, b) => a.index - b.index)
        .forEach((channel) => {
          seen.unobserve(channel.row);
          trigger(channel);
        });
    },
    { threshold: 0.5, rootMargin: "0px 0px -8% 0px" },
  );

  for (const channel of channels) {
    channel.row.dataset.meter = "armed";
    channel.meter.style.setProperty("--eval-g", "0");
    channel.meter.style.setProperty("--eval-peak", "0");
  }
  reduce?.addEventListener("change", onReduce);
  view.observe(list);
  channels.forEach((channel) => seen.observe(channel.row));
  return stop;
}

/** One LED bar, drawn at its final reading. */
const Meter = memo(function Meter({ before, after }: { before: number; after: number }) {
  const on = litCount(after);
  const ghost = litCount(before);
  return (
    <div
      className="eval-meter"
      style={{ "--before": before, "--after": after } as CSSProperties}
      aria-hidden="true"
    >
      <div className="eval-band">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <i
            key={i}
            className={`eval-seg${i < ghost ? " is-ghost" : ""}${i < on ? " is-on" : ""}`}
          />
        ))}
        <b className="eval-ghost" />
        <b className="eval-rail" />
        <b className="eval-peak" />
      </div>
    </div>
  );
});

export function CyanResultsInstrument() {
  const baseId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const stopRef = useRef<() => void>(() => {});
  const paused = useMotionPaused();
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const anyOpen = !dismissed && (hovered !== null || focused !== null);

  // Arm before the first paint, so a meter never flashes its final reading
  // and then drops to zero.
  useLayoutEffect(() => {
    const list = listRef.current;
    const reduce =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    const canPlay =
      typeof IntersectionObserver !== "undefined" && typeof requestAnimationFrame === "function";
    if (!list || !canPlay || reduce?.matches || isMotionPaused()) return;
    const stop = runMeters(
      list,
      evidence.map((item) => item.after),
      reduce,
    );
    stopRef.current = stop;
    return () => {
      stopRef.current = () => {};
      stop();
    };
  }, []);

  // Pausing mid-reveal shows the true reading rather than freezing on an overshoot.
  useEffect(() => {
    if (paused) stopRef.current();
  }, [paused]);

  // Details shown on hover or focus can be dismissed with Escape (WCAG 1.4.13).
  useEffect(() => {
    if (!anyOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDismissed(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [anyOpen]);

  return (
    <section
      id="results"
      className="eval-section section-wrap"
      aria-labelledby={`${baseId}-heading`}
    >
      <div className="section-heading">
        <h2 id={`${baseId}-heading`}>
          Results<span className="heading-period">,</span>
          <br />
          <span>with their scope.</span>
        </h2>
        <p>
          Each change measured against a baseline on a labelled set. These
          numbers describe those evaluations, not every document.
        </p>
      </div>

      <div className="eval-panel">
        <p className="eval-hud">
          <span className="eval-tag">[PRECOMPUTED · EVAL RESULTS FILES]</span>
          <span>
            Linear 0–1 · {SEGMENTS} segments of {(1 / SEGMENTS).toFixed(3)}
          </span>
          <span className="eval-legend">
            <span>
              <i className="eval-key is-measured" aria-hidden="true" />
              Measured
            </span>
            <span>
              <i className="eval-key is-baseline" aria-hidden="true" />
              Baseline
            </span>
            <span>
              <i className="eval-key is-change" aria-hidden="true" />
              Change
            </span>
          </span>
        </p>
        <div className="eval-ruler" aria-hidden="true">
          <span>Project · metric</span>
          <div className="eval-scale">
            {TICKS.map((at, k) => (
              <i
                key={at}
                className={k % 5 === 0 ? "is-major" : undefined}
                style={{ "--at": at } as CSSProperties}
              />
            ))}
            {SCALE_LABELS.map((at) => (
              <span key={at} style={{ "--at": at } as CSSProperties}>
                {at === 0 ? "0" : at.toFixed(2)}
              </span>
            ))}
          </div>
          <span className="eval-ruler-end">Change · before → after</span>
        </div>

        <ul ref={listRef} className="eval-list" aria-label="Retrieval results">
          {evidence.map((item, index) => {
            const value = reading(item);
            const details = EVAL_SETS[item.project];
            const detailId = `${baseId}-${index}-detail`;
            const open = !dismissed && (hovered === index || focused === index);
            return (
              <li
                key={item.project + item.metric}
                className="eval-row"
                tabIndex={0}
                data-open={open ? "true" : undefined}
                aria-label={`${item.project} ${item.metric}: ${value.before} to ${value.after}, ${value.spoken}, on ${item.scope}.`}
                aria-describedby={detailId}
                onPointerEnter={(event) => {
                  // A tap opens the details through focus instead.
                  if (event.pointerType === "touch") return;
                  setHovered(index);
                  setDismissed(false);
                }}
                onPointerLeave={(event) => {
                  if (event.pointerType === "touch") return;
                  setHovered((current) => (current === index ? null : current));
                }}
                onFocus={() => {
                  setFocused(index);
                  setDismissed(false);
                }}
                onBlur={() => setFocused((current) => (current === index ? null : current))}
                // Some mobile browsers do not focus a tapped row on their own.
                onClick={(event) => event.currentTarget.focus({ preventScroll: true })}
              >
                <div className="eval-name">
                  <strong>{item.project}</strong>
                  <span className="eval-metric">{item.metric}</span>
                </div>
                <Meter before={item.before} after={item.after} />
                <div className="eval-read">
                  <span className="eval-delta" aria-hidden="true">
                    {value.delta}
                  </span>
                  <span className="eval-values" aria-hidden="true">
                    {value.before} → <b>{value.after}</b>
                  </span>
                  <span className="sr-only">
                    {item.metric} rose from {value.before} to {value.after}, {value.spoken}.
                  </span>
                </div>
                <div className="eval-foot">
                  <p className="eval-scope">{item.scope}</p>
                  <div className="eval-detail" id={detailId}>
                    <div className="eval-detail-clip">
                      <dl>
                        <div className="is-wide">
                          <dt>Eval set</dt>
                          <dd>{details.set}</dd>
                        </div>
                        <div>
                          <dt>n</dt>
                          <dd>{details.n} queries</dd>
                        </div>
                        <div>
                          <dt>Baseline</dt>
                          <dd>
                            {details.baseline} <span aria-hidden="true">·</span> {value.before}
                          </dd>
                        </div>
                        <div>
                          <dt>Measured</dt>
                          <dd>
                            {details.measured} <span aria-hidden="true">·</span> {value.after}
                          </dd>
                        </div>
                        {details.note && (
                          <div className="is-wide">
                            <dt>Note</dt>
                            <dd>{details.note}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="eval-hint">
          Hover, tap or focus a row to see its evaluation set, n and baseline.
        </p>
      </div>

      <div className="eval-counts-wrap">
        <p className="eval-counts-head">
          <span className="eval-tag">[SNAPSHOT]</span>
          <span>Automated tests</span>
        </p>
        <ul className="eval-counts" aria-label="Automated tests">
          {testCounts.map((item) => {
            const digits = String(item.count);
            return (
              <li key={item.project}>
                <span className="eval-count-num" aria-hidden="true">
                  <span className="eval-count-pad">{"0".repeat(Math.max(0, 4 - digits.length))}</span>
                  {digits}
                  {item.suffix}
                </span>
                <span className="eval-count-label">
                  <span className="sr-only">
                    {item.count}
                    {item.suffix}{" "}
                  </span>
                  {item.project} tests
                </span>
                <span className="eval-count-note">{item.note}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

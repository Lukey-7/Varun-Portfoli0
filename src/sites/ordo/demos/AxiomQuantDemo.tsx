import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useReducedMotion } from "framer-motion";
import { Grid3x3, Shuffle } from "lucide-react";
import { useMotionPaused } from "@/lib/motion-pause";
import DemoFrame from "./DemoFrame";
import {
  DAYS,
  IN_SAMPLE_SHARE,
  SWEEP_FAST,
  SWEEP_SLOW,
  TRADING_DAYS,
  backtest,
  createMarket,
  runSweep,
  summarise,
  sweepPairs,
  tally,
  type Backtest,
  type Market,
  type SweepResult,
  type TallyEntry,
} from "./backtest";
import "./axiomquant.css";

const FAST_RANGE = { min: 2, max: 100 };
const SLOW_RANGE = { min: 10, max: 250 };
const COST_MAX = 50;
const DEFAULT_PAIR = { fast: 20, slow: 100 };
const DEFAULT_COST = 10;
const PAIRS = sweepPairs();
const PAIR_INDEX = new Map(PAIRS.map((pair, index) => [`${pair.fast}/${pair.slow}`, index]));
// 41 cells at 45 ms fill the grid in about two seconds; the pick then holds for a beat.
const STEP_MS = 45;
const PICK_MS = 700;
const YEARS = DAYS / TRADING_DAYS;
const IN_YEARS = Math.round(YEARS * IN_SAMPLE_SHARE);
const YEAR_TICKS = [0, 2, 4, 6, 8, 10];
/** Sharpe boundaries between the six heatmap shades. */
const SHADE_STEPS = [-0.25, 0, 0.25, 0.5, 0.75];
const MINUS = "\u2212";

const randomSeed = () => 1 + Math.floor(Math.random() * 9999);
const pad = (n: number, width: number) => String(n).padStart(width, "0");
const plural = (n: number, word: string) => (n === 1 ? word : `${word}s`);
const growth = (value: number) => Math.round(value * 100);

/** "+0.42", "−0.18" or "0.00", with a true minus sign. */
function signed(value: number, digits = 2) {
  const text = Math.abs(value).toFixed(digits);
  if (Number(text) === 0) return text;
  return `${value > 0 ? "+" : MINUS}${text}`;
}

function percent(fraction: number) {
  const text = Math.abs(fraction * 100).toFixed(1);
  return `${fraction < 0 && Number(text) !== 0 ? MINUS : ""}${text}%`;
}

function ordinal(n: number) {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
}

/** Heatmap shade for a Sharpe ratio: 0 (hatched, below −0.25) to 5 (above +0.75). */
const shade = (value: number) => SHADE_STEPS.filter((step) => value > step).length;

/** Round tick values inside [lo, hi], roughly `count` of them. */
function tickValues(lo: number, hi: number, count: number) {
  const raw = Math.max(hi - lo, 1e-9) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude;
  const ticks: number[] = [];
  for (let value = Math.ceil(lo / step) * step; value <= hi; value += step) {
    ticks.push(Number(value.toFixed(6)));
  }
  return ticks;
}

/** Width of an element in CSS pixels, so the chart draws at its real size. */
function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      if (node.clientWidth > 0) setWidth(node.clientWidth);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

interface SweepRun {
  result: SweepResult;
  /** Number of the market the sweep ran on. */
  market: number;
  /** Cells filled in so far. */
  shown: number;
  phase: "running" | "picked" | "done";
}

interface TallyRow extends TallyEntry {
  /** Number of the market this row came from; a rerun on it replaces the row. */
  market: number;
}

type View = "in" | "out";

const bestOf = (sweep: SweepRun) => sweep.result.cells[sweep.result.best];

function EquityChart({
  market,
  run,
  width,
  label,
}: {
  market: Market;
  run: Backtest;
  width: number;
  label: string;
}) {
  const narrow = width < 460;
  const height = narrow ? 164 : 190;
  const left = 34;
  const right = 6;
  const top = 6;
  const plotW = Math.max(60, width - left - right);
  const plotH = height - top - 30;
  const stripY = top + plotH + 5;

  const geometry = useMemo(() => {
    const { prices, start, days, split } = market;
    const hold = (k: number) => (prices[start + k] / prices[start]) * 100;
    let lo = 100;
    let hi = 100;
    for (let k = 0; k <= days; k += 1) {
      const net = run.netEquity[k] * 100;
      const gross = run.grossEquity[k] * 100;
      lo = Math.min(lo, net, gross, hold(k));
      hi = Math.max(hi, net, gross, hold(k));
    }
    const room = (hi - lo) * 0.06;
    lo -= room;
    hi += room;
    const x = (k: number) => left + (k / days) * plotW;
    const y = (value: number) => top + (1 - (value - lo) / (hi - lo)) * plotH;
    // Two points per pixel is plenty for a line; the readouts use every day.
    const step = Math.max(1, Math.floor(days / (plotW * 2)));
    const path = (value: (k: number) => number) => {
      let d = "";
      for (let k = 0; k <= days; k += step) d += `${k ? "L" : "M"}${x(k).toFixed(1)} ${y(value(k)).toFixed(1)}`;
      if (days % step) d += `L${x(days).toFixed(1)} ${y(value(days)).toFixed(1)}`;
      return d;
    };
    const longs: [number, number][] = [];
    for (let k = 0; k < days; k += 1) {
      if (!run.positions[k]) continue;
      const last = longs[longs.length - 1];
      if (last && last[1] === k) last[1] = k + 1;
      else longs.push([k, k + 1]);
    }
    return {
      x,
      y,
      ticks: tickValues(lo, hi, narrow ? 3 : 4),
      // Whole pixels, so the SVG split line meets the HTML label border exactly.
      splitX: Math.round(x(split)),
      net: path((k) => run.netEquity[k] * 100),
      gross: path((k) => run.grossEquity[k] * 100),
      hold: path(hold),
      longs,
    };
  }, [market, run, plotW, plotH, narrow]);

  const { x, y, ticks, splitX } = geometry;
  return (
    <>
      {/* HTML, not SVG text, so the labels wrap on a phone instead of being clipped. */}
      <div
        className="aq-regions"
        aria-hidden="true"
        style={{
          gridTemplateColumns: `${splitX - left}px minmax(0, 1fr)`,
          paddingLeft: left,
          paddingRight: right,
        }}
      >
        <span>
          In sample<span className="aq-years"> · years 1–{IN_YEARS}</span>
        </span>
        <span>
          Out of sample<span className="aq-years"> · {IN_YEARS + 1}–{YEARS}</span>
        </span>
      </div>
      <svg
        className="aq-equity"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
      >
        <rect className="aq-oos" x={splitX} y={top} width={left + plotW - splitX} height={plotH} />
        {ticks.map((value) => (
          <g key={value}>
            {value !== 100 && (
              <line className="aq-gridline" x1={left} x2={left + plotW} y1={y(value)} y2={y(value)} />
            )}
            <text className="aq-tick" x={left - 6} y={y(value) + 3} textAnchor="end">
              {value}
            </text>
          </g>
        ))}
        <line className="aq-baseline" x1={left} x2={left + plotW} y1={y(100)} y2={y(100)} />
        <line className="aq-split" x1={splitX + 0.5} x2={splitX + 0.5} y1={0} y2={stripY + 5} />
        <path className="aq-line is-hold" d={geometry.hold} />
        <path className="aq-line is-gross" d={geometry.gross} />
        <path className="aq-line is-net" d={geometry.net} />
        <g className="aq-longs">
          {geometry.longs.map(([from, to]) => (
            <rect key={from} x={x(from)} y={stripY} width={Math.max(0.6, x(to) - x(from))} height={5} />
          ))}
        </g>
        {YEAR_TICKS.map((year) => (
          <text
            key={year}
            className="aq-tick"
            x={x(year * TRADING_DAYS)}
            y={height - 3}
            textAnchor={year === 0 ? "start" : year === YEARS ? "end" : "middle"}
          >
            {year}Y
          </text>
        ))}
      </svg>
    </>
  );
}

function Slider({
  id,
  label,
  value,
  min,
  max,
  unit,
  spokenUnit,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  spokenUnit: string;
  onChange: (value: number) => void;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div className="aq-field">
      <div className="aq-field-head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>
          {value} {unit}
        </output>
      </div>
      <input
        id={id}
        className="aq-range"
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        aria-valuetext={`${value} ${spokenUnit}`}
        style={{ "--fill": `${fill}%` } as CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function Heatmap({ sweep, view }: { sweep: SweepRun | null; view: View }) {
  const result = sweep?.result;
  const shown = sweep?.shown ?? 0;
  const running = sweep?.phase === "running";
  const caption = result
    ? `${view === "out" ? "Out-of-sample" : "In-sample"} Sharpe after ${result.costBps} bps costs`
    : "Sharpe by pair: run the sweep to fill this in";
  return (
    <table className="aq-heat">
      <caption>{caption}</caption>
      <colgroup>
        <col className="aq-col-head" />
        <col span={SWEEP_SLOW.length} />
      </colgroup>
      <thead>
        <tr>
          <td />
          <th scope="colgroup" colSpan={SWEEP_SLOW.length}>
            Slow average, days
          </th>
        </tr>
        <tr>
          <th scope="col">Fast</th>
          {SWEEP_SLOW.map((slow) => (
            <th key={slow} scope="col">
              <span className="aq-sr">slow </span>
              {slow}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {SWEEP_FAST.map((fast) => (
          <tr key={fast}>
            <th scope="row">
              <span className="aq-sr">fast </span>
              {fast}
            </th>
            {SWEEP_SLOW.map((slow) => {
              const index = PAIR_INDEX.get(`${fast}/${slow}`);
              if (index === undefined) {
                return (
                  <td key={slow} className="aq-cell is-na">
                    <span aria-hidden="true">–</span>
                    <span className="aq-sr">not tested: fast must be shorter than slow</span>
                  </td>
                );
              }
              const cell = result && index < shown ? result.cells[index] : null;
              if (!cell) {
                return (
                  <td key={slow} className="aq-cell is-pending">
                    <span aria-hidden="true">·</span>
                  </td>
                );
              }
              const value = view === "out" ? cell.outOfSample : cell.inSample;
              const best = !running && index === result?.best;
              const head = running && index === shown - 1;
              return (
                <td
                  key={slow}
                  className={`aq-cell aq-l${shade(value)}${best ? " is-best" : ""}${head ? " is-head" : ""}`}
                >
                  {signed(value)}
                  {best && <span className="aq-sr"> (highest in sample)</span>}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ShadeScale() {
  return (
    <div className="aq-scale" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((level) => (
        <i key={level} className={`aq-l${level}`} />
      ))}
      {SHADE_STEPS.map((step, i) => (
        <span key={step} style={{ gridColumn: `${i + 1} / span 2` }}>
          {step === 0 ? "0" : signed(step)}
        </span>
      ))}
    </div>
  );
}

function PickPanel({ sweep }: { sweep: SweepRun }) {
  const best = bestOf(sweep);
  return (
    <div className="aq-pick">
      <p className="aq-pick-title">
        Highest in sample · fast {best.fast} / slow {best.slow}
      </p>
      <div className="aq-pick-pair">
        <div>
          <span>In sample</span> <strong>{signed(best.inSample)}</strong>
        </div>
        <div>
          <span>Out of sample</span> <strong>{signed(best.outOfSample)}</strong>
        </div>
      </div>
      <p>
        {best.outOfSample < best.inSample ? "Worse" : "Better, this time,"} on the years it never saw: ranked{" "}
        {ordinal(sweep.result.bestOutOfSampleRank)} of {PAIRS.length} there. Now on the chart.
      </p>
    </div>
  );
}

/**
 * A moving-average backtest on random prices: tune one rule, then sweep 41 of
 * them on the in-sample years and see how the winner does on the years it never saw.
 */
export default function AxiomQuantDemo({ seed }: { seed?: number }) {
  const reduced = useReducedMotion();
  const paused = useMotionPaused();
  const still = Boolean(reduced) || paused;
  const id = useId();
  const [firstSeed] = useState(() => seed ?? randomSeed());
  const [market, setMarket] = useState({ number: 1, seed: firstSeed });
  const [pair, setPair] = useState(DEFAULT_PAIR);
  const [costBps, setCostBps] = useState(DEFAULT_COST);
  const [sweep, setSweep] = useState<SweepRun | null>(null);
  const [view, setView] = useState<View>("in");
  const [rows, setRows] = useState<TallyRow[]>([]);
  const [resultNews, setResultNews] = useState("");
  // Only the visitor's own changes are read out, not the first render.
  const interacted = useRef(false);
  const [plotRef, plotWidth] = useWidth<HTMLDivElement>(560);

  const data = useMemo(() => createMarket(market.seed), [market.seed]);
  const run = useMemo(() => backtest(data, { ...pair, costBps }), [data, pair, costBps]);
  const summary = useMemo(() => summarise(data, run), [data, run]);
  const score = useMemo(() => tally(rows), [rows]);

  const finish = useCallback((current: SweepRun) => {
    const { result } = current;
    const best = bestOf(current);
    // The sweep announces its own result, so the pair it loads is not read out twice.
    interacted.current = false;
    setSweep({ ...current, shown: result.cells.length, phase: "done" });
    setPair({ fast: best.fast, slow: best.slow });
    setRows((previous) =>
      [
        ...previous.filter((row) => row.market !== current.market),
        {
          market: current.market,
          inSample: best.inSample,
          outOfSample: best.outOfSample,
          rank: result.bestOutOfSampleRank,
        },
      ].sort((a, b) => a.market - b.market),
    );
  }, []);

  // Fill the heatmap one cell at a time, hold on the pick, then reveal it.
  // Reduced or paused motion skips straight to the end state.
  useEffect(() => {
    if (!sweep || sweep.phase === "done") return;
    if (still) {
      finish(sweep);
      return;
    }
    const total = sweep.result.cells.length;
    const timer = setTimeout(
      () => {
        if (sweep.phase === "picked") finish(sweep);
        else if (sweep.shown + 1 >= total) setSweep({ ...sweep, shown: total, phase: "picked" });
        else setSweep({ ...sweep, shown: sweep.shown + 1 });
      },
      sweep.phase === "picked" ? PICK_MS : STEP_MS,
    );
    return () => clearTimeout(timer);
  }, [sweep, still, finish]);

  const resultText =
    `Market ${market.number}, fast ${pair.fast} and slow ${pair.slow} days at ${costBps} basis points a trade: ` +
    `${summary.trades} trades, Sharpe ${signed(summary.sharpeIn)} in sample and ${signed(summary.sharpeOut)} ` +
    `out of sample after costs, maximum drawdown ${percent(summary.maxDrawdown)}.`;
  useEffect(() => {
    if (!interacted.current) return;
    // Wait for a drag to settle so it is read once, not at every step.
    const timer = setTimeout(() => setResultNews(resultText), 700);
    return () => clearTimeout(timer);
  }, [resultText]);

  // The two windows never cross: moving one past the other pushes the other along.
  const changeFast = (fast: number) => {
    interacted.current = true;
    setPair((current) => ({
      fast,
      slow: fast >= current.slow ? Math.min(SLOW_RANGE.max, fast + 1) : current.slow,
    }));
  };
  const changeSlow = (slow: number) => {
    interacted.current = true;
    setPair((current) => ({
      fast: slow <= current.fast ? Math.max(FAST_RANGE.min, slow - 1) : current.fast,
      slow,
    }));
  };
  const changeCost = (value: number) => {
    interacted.current = true;
    setCostBps(value);
  };

  const finished = sweep?.phase === "done" ? sweep : null;
  const running = sweep && sweep.phase !== "done" ? sweep : null;
  const staleCost = finished && finished.result.costBps !== costBps ? finished.result.costBps : null;

  const startSweep = () => {
    if (running) return;
    const next: SweepRun = {
      result: runSweep(data, costBps, PAIRS),
      market: market.number,
      shown: 0,
      phase: "running",
    };
    setView("in");
    if (still) finish(next);
    else setSweep(next);
  };

  const newMarket = () => {
    interacted.current = true;
    let next = randomSeed();
    if (next === market.seed) next = (next % 9999) + 1;
    setMarket({ number: market.number + 1, seed: next });
    setSweep(null);
    setView("in");
  };

  const reset = () => {
    interacted.current = false;
    setMarket({ number: 1, seed: firstSeed });
    setPair(DEFAULT_PAIR);
    setCostBps(DEFAULT_COST);
    setSweep(null);
    setView("in");
    setRows([]);
    setResultNews("");
  };

  let progress = "";
  if (running?.phase === "picked") {
    const best = bestOf(running);
    progress = `Highest in sample: fast ${best.fast} / slow ${best.slow}. Checking the unseen years…`;
  } else if (running) {
    const latest = running.shown > 0 ? running.result.cells[running.shown - 1] : PAIRS[0];
    progress = `Testing fast ${latest.fast} / slow ${latest.slow} · ${running.shown} of ${PAIRS.length}`;
  }

  let sweepNews = "";
  if (finished) {
    const best = bestOf(finished);
    sweepNews =
      `Sweep finished. Highest in-sample Sharpe: fast ${best.fast} and slow ${best.slow} days, ` +
      `${signed(best.inSample)} in sample and ${signed(best.outOfSample)} out of sample, where it ranked ` +
      `${ordinal(finished.result.bestOutOfSampleRank)} of ${PAIRS.length}. It is now on the chart. ` +
      `Tally: worse out of sample in ${score.worse} of ${score.total} ${plural(score.total, "market")}.`;
  } else if (running) {
    sweepNews = `Running the sweep over ${PAIRS.length} pairs.`;
  }

  const chartLabel =
    `Growth of 100 over ten years with fast ${pair.fast} and slow ${pair.slow} day averages: ` +
    `${growth(summary.finalNet)} after costs, ${growth(summary.finalGross)} before costs and ` +
    `${growth(summary.finalMarket)} for buy and hold. The first seven years are in sample, ` +
    `the last three out of sample.`;

  return (
    <DemoFrame
      project="AxiomQuant"
      title="Why the best backtest is usually the luckiest"
      intro={`Tune a moving-average rule on ten years of made-up prices, then sweep ${PAIRS.length} versions of it on the first seven years and see how the winner does on the last three.`}
      note="Random synthetic prices and one simple rule, computed in your browser; none of these numbers are AxiomQuant's results. Sharpe ratios are annualised (×√252) with a zero risk-free rate, after costs unless marked. AxiomQuant itself is a C++20 engine with point-in-time data, costs, walk-forward testing and statistical checks. Not investment advice."
      onReset={reset}
      className={`aq-demo${still ? "" : " is-animated"}`}
    >
      <div className="aq-layout">
        <div className="aq-market">
          <div className="aq-market-text">
            <p className="aq-market-label">
              <strong>Market {pad(market.number, 2)}</strong> · Seed {pad(market.seed, 4)} · {YEARS} years of
              daily prices
            </p>
            <p className="aq-luck">
              These prices are a random walk with no drift. Each day's move is independent of the past, so no
              rule has a real edge here: any edge you find is luck.
            </p>
          </div>
          <button type="button" className="demo-btn is-ghost" onClick={newMarket}>
            <Shuffle size={14} aria-hidden="true" /> New market
          </button>
        </div>

        <div className="aq-top">
          <figure className="aq-chart">
            <div className="aq-plot" ref={plotRef}>
              <EquityChart market={data} run={run} width={plotWidth} label={chartLabel} />
            </div>
            <figcaption>
              <ul className="aq-legend">
                <li>
                  <svg viewBox="0 0 20 6" aria-hidden="true">
                    <line className="aq-line is-net" x1="0" x2="20" y1="3" y2="3" />
                  </svg>
                  After costs <strong>{growth(summary.finalNet)}</strong>
                </li>
                <li>
                  <svg viewBox="0 0 20 6" aria-hidden="true">
                    <line className="aq-line is-gross" x1="0" x2="20" y1="3" y2="3" />
                  </svg>
                  Before costs <strong>{growth(summary.finalGross)}</strong>
                </li>
                <li>
                  <svg viewBox="0 0 20 6" aria-hidden="true">
                    <line className="aq-line is-hold" x1="1" x2="20" y1="3" y2="3" />
                  </svg>
                  Buy and hold <strong>{growth(summary.finalMarket)}</strong>
                </li>
                <li>
                  <i className="aq-key-long" aria-hidden="true" /> Long; gaps are cash
                </li>
              </ul>
              <span className="aq-sr">Each line shows the growth of 100.</span>
            </figcaption>
          </figure>

          <div className="aq-controls">
            <Slider
              id={`${id}-fast`}
              label="Fast average"
              value={pair.fast}
              min={FAST_RANGE.min}
              max={FAST_RANGE.max}
              unit="days"
              spokenUnit="days"
              onChange={changeFast}
            />
            <Slider
              id={`${id}-slow`}
              label="Slow average"
              value={pair.slow}
              min={SLOW_RANGE.min}
              max={SLOW_RANGE.max}
              unit="days"
              spokenUnit="days"
              onChange={changeSlow}
            />
            <Slider
              id={`${id}-cost`}
              label="Cost per trade"
              value={costBps}
              min={0}
              max={COST_MAX}
              unit="bps"
              spokenUnit="basis points"
              onChange={changeCost}
            />
            <p className="aq-rule">
              Long while the fast average is above the slow one, in cash otherwise. Each buy and each sell pays
              the cost.
            </p>
          </div>
        </div>

        {/* The space before each <small> keeps value and note apart when read aloud. */}
        <dl className="aq-stats">
          <div>
            <dt>Trades</dt>
            <dd>
              {summary.trades} <small>{(summary.trades / YEARS).toFixed(1)} a year</small>
            </dd>
          </div>
          <div>
            <dt>Costs paid</dt>
            <dd>
              {percent(summary.costPaid)} <small>of starting capital</small>
            </dd>
          </div>
          <div>
            <dt>Sharpe in sample</dt>
            <dd>
              {signed(summary.sharpeIn)} <small>before costs {signed(summary.sharpeInGross)}</small>
            </dd>
          </div>
          <div>
            <dt>Sharpe out of sample</dt>
            <dd>
              {signed(summary.sharpeOut)} <small>before costs {signed(summary.sharpeOutGross)}</small>
            </dd>
          </div>
          <div>
            <dt>Max drawdown</dt>
            <dd>
              {percent(summary.maxDrawdown)} <small>after costs</small>
            </dd>
          </div>
        </dl>

        <section className="aq-sweep" aria-labelledby={`${id}-sweep`}>
          <h4 id={`${id}-sweep`}>
            Parameter sweep · {PAIRS.length} pairs · scored on years 1–{IN_YEARS} only
          </h4>

          <div className="aq-sweep-grid">
            <div className="aq-sweep-actions">
              {!sweep && (
                <p className="aq-copy">
                  Scores every pair in the grid, the same one AxiomQuant's own sweep uses, on the in-sample years
                  only. It keeps the highest Sharpe after costs, then shows how that pair did on the years it never
                  saw.
                </p>
              )}
              <div className="aq-sweep-buttons">
                <button
                  type="button"
                  className="demo-btn"
                  aria-disabled={running ? true : undefined}
                  onClick={startSweep}
                >
                  <Grid3x3 size={15} aria-hidden="true" />
                  {running ? "Sweeping…" : finished ? "Run the sweep again" : "Run the sweep"}
                </button>
                {finished && (
                  <div className="demo-chips" role="group" aria-label="Heatmap shows">
                    <button
                      type="button"
                      className="demo-chip"
                      aria-pressed={view === "in"}
                      onClick={() => setView("in")}
                    >
                      In sample
                    </button>
                    <button
                      type="button"
                      className="demo-chip"
                      aria-pressed={view === "out"}
                      onClick={() => setView("out")}
                    >
                      Out of sample
                    </button>
                  </div>
                )}
              </div>
              {progress && (
                <p className="aq-progress" aria-hidden="true">
                  {progress}
                </p>
              )}
              {staleCost !== null && (
                <p className="aq-stale">
                  This sweep used {staleCost} bps a trade; the cost is now {costBps} bps. Run it again to update
                  it.
                </p>
              )}
            </div>

            <div className="aq-heat-wrap">
              <Heatmap sweep={sweep} view={view} />
              <ShadeScale />
            </div>

            <div className="aq-verdict">
              {finished && <PickPanel sweep={finished} />}
              <div className="aq-tally">
                <p className="aq-tally-title">Tally across markets</p>
                {score.total ? (
                  <>
                    <p className="aq-tally-line">
                      The in-sample winner did worse out of sample in{" "}
                      <strong>
                        {score.worse} of {score.total}
                      </strong>{" "}
                      {plural(score.total, "market")}.
                    </p>
                    <p className="aq-tally-note">
                      Average winner: {signed(score.meanInSample)} in sample, {signed(score.meanOutOfSample)} out
                      of sample, ranked {ordinal(Math.round(score.meanRank))} of {PAIRS.length} there; a random
                      pick averages {ordinal((PAIRS.length + 1) / 2)}.
                    </p>
                  </>
                ) : (
                  <p className="aq-tally-line">
                    Empty so far. Each sweep adds its market; New market draws another random walk.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <p className="aq-sr" aria-live="polite">
          {resultNews}
        </p>
        <p className="aq-sr" aria-live="polite">
          {sweepNews}
        </p>
      </div>
    </DemoFrame>
  );
}

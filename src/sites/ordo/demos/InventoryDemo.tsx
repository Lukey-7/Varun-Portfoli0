import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { useReducedMotion } from "framer-motion";
import { ArrowRight, FastForward, Lightbulb, Pause, Play, RotateCcw, Shuffle } from "lucide-react";
import { useMotionPaused } from "@/lib/motion-pause";
import DemoFrame from "./DemoFrame";
import {
  CONFIGS,
  DIFFICULTIES,
  PUBLISHED,
  TUNED,
  createScenario,
  cumulativeCost,
  demandRate,
  initialState,
  inventoryPosition,
  randomPolicy,
  runEpisode,
  sSPolicy,
  step,
  totals,
  type DayRecord,
  type Difficulty,
  type InventoryConfig,
  type ShopState,
  type Totals,
} from "./inventory";
import "./inventory.css";

const SEED_MAX = 9999;
const SHELF_CELLS = 40;
/** Milliseconds per day for the autopilot. */
const SPEEDS = [
  { label: "Slow", ms: 650 },
  { label: "Steady", ms: 260 },
  { label: "Fast", ms: 70 },
] as const;
const NAMES: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

const randomSeed = () => 1 + Math.floor(Math.random() * SEED_MAX);
const fmt = (value: number) => Math.round(value).toLocaleString("en-GB");
const plural = (n: number, word: string, many = `${word}s`) => (n === 1 ? word : many);
const pct = (fraction: number, digits = 1) => `${(fraction * 100).toFixed(digits)}%`;
const fillRate = (t: Totals) => (t.demand > 0 ? t.sales / t.demand : 1);

function configSummary(config: InventoryConfig) {
  const lead =
    config.leadTime === 0
      ? "Orders arrive the same morning"
      : `Deliveries take ${config.leadTime} ${plural(config.leadTime, "day")}`;
  const demand =
    config.seasonality > 0
      ? `demand swings ±${Math.round(config.seasonality * 100)}% over the week`
      : `demand is steady at ${config.demandMean} a day on average`;
  return `${lead}; ${demand}. Every order costs ${config.fixedCost} plus ${config.unitCost} a unit, each unit left on the shelf overnight ${config.holdingCost}, and each customer turned away ${config.stockoutPenalty}.`;
}

/** Round tick values from 0 to at least `hi`, roughly `count` of them. */
function niceMax(hi: number, count: number) {
  const raw = Math.max(hi, 1) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const stepSize = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude;
  const top = Math.ceil(hi / stepSize) * stepSize;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += stepSize) ticks.push(Number(v.toFixed(6)));
  return { top: Math.max(top, stepSize), ticks };
}

/** Width of an element in CSS pixels, so a chart draws at its real size. */
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

/** True while the browser tab is hidden, so the autopilot can rest. */
function usePageHidden() {
  const [hidden, setHidden] = useState(() => typeof document !== "undefined" && document.visibilityState === "hidden");
  useEffect(() => {
    const sync = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  return hidden;
}

interface Game {
  state: ShopState;
  records: DayRecord[];
  /** Days the visitor chose the order (not the autopilot). */
  manualDays: number;
  /** Manual days played with the rule's order showing. */
  hintDays: number;
}

const newGame = (difficulty: Difficulty, seed: number): Game => ({
  state: initialState(createScenario(difficulty, seed)),
  records: [],
  manualDays: 0,
  hintDays: 0,
});

/* ---------------------------------------------------------------- charts */

function StockChart({
  records,
  rule,
  horizon,
  width,
  label,
}: {
  records: DayRecord[];
  rule: DayRecord[];
  horizon: number;
  width: number;
  label: string;
}) {
  const narrow = width < 420;
  const height = narrow ? 150 : 168;
  const left = 26;
  const right = 4;
  const top = 6;
  const strip = 16;
  const plotW = Math.max(60, width - left - right);
  const plotH = height - top - strip - 14;
  const base = top + plotH;
  const n = records.length;

  const peak = Math.max(
    10,
    ...records.map((r) => Math.max(r.stockEnd, r.demand)),
    ...rule.slice(0, n).map((r) => r.stockEnd),
  );
  const { top: yTop, ticks } = niceMax(peak, narrow ? 3 : 4);
  const band = plotW / horizon;
  const x = (day: number) => left + day * band;
  const y = (value: number) => top + (1 - value / yTop) * plotH;
  const barW = Math.max(0.6, band - (band > 4 ? 1.2 : 0.4));

  const rulePath = rule
    .slice(0, n)
    .map((r, i) => `${i ? "L" : "M"}${(x(i) + band / 2).toFixed(1)} ${y(r.stockEnd).toFixed(1)}`)
    .join("");

  return (
    <svg className="ivd-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <rect className="ivd-future" x={x(n)} y={top} width={Math.max(0, x(horizon) - x(n))} height={plotH} />
      {ticks.map((value) => (
        <g key={value}>
          {value > 0 && <line className="ivd-grid" x1={left} x2={left + plotW} y1={y(value)} y2={y(value)} />}
          <text className="ivd-tick" x={left - 5} y={y(value) + 3} textAnchor="end">
            {value}
          </text>
        </g>
      ))}
      <g className="ivd-bars">
        {records.map((r, i) => (
          <rect key={r.day} x={x(i) + (band - barW) / 2} y={y(r.stockEnd)} width={barW} height={base - y(r.stockEnd)} />
        ))}
      </g>
      {rulePath && <path className="ivd-rule-stock" d={rulePath} />}
      <g className="ivd-demand">
        {records.map((r, i) => (
          <circle key={r.day} cx={x(i) + band / 2} cy={y(r.demand)} r={narrow ? 1.5 : 1.8} />
        ))}
      </g>
      <line className="ivd-axis" x1={left} x2={left + plotW} y1={base} y2={base} />
      <g className="ivd-lost">
        {records.map((r, i) =>
          r.lost > 0 ? (
            <rect key={r.day} x={x(i) + (band - barW) / 2} y={base + 3} width={barW} height={Math.min(r.lost, 6) * 2} />
          ) : null,
        )}
      </g>
      {n > 0 && n < horizon && <line className="ivd-cursor" x1={x(n)} x2={x(n)} y1={top} y2={base + strip - 2} />}
      {[1, 25, 50, 75, 100].map((day) => (
        <text
          key={day}
          className="ivd-tick"
          x={x(day) - band / 2}
          y={height - 2}
          textAnchor={day === 1 ? "start" : day === horizon ? "end" : "middle"}
        >
          {day === 1 ? "Day 1" : day}
        </text>
      ))}
    </svg>
  );
}

function RaceChart({
  you,
  rule,
  ruleFull,
  ppo,
  horizon,
  width,
  label,
}: {
  you: number[];
  rule: number[];
  ruleFull: number;
  ppo: number;
  horizon: number;
  width: number;
  label: string;
}) {
  const narrow = width < 420;
  const height = narrow ? 150 : 168;
  const left = 38;
  const right = 4;
  const top = 6;
  const plotW = Math.max(60, width - left - right);
  const plotH = height - top - 18;
  const n = you.length - 1;
  const { top: yTop, ticks } = niceMax(Math.max(ruleFull, ppo, you[n]) * 1.04, narrow ? 3 : 4);
  const x = (day: number) => left + (day / horizon) * plotW;
  const y = (value: number) => top + (1 - value / yTop) * plotH;
  const path = (values: number[]) =>
    values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");

  return (
    <svg className="ivd-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <rect className="ivd-future" x={x(n)} y={top} width={Math.max(0, x(horizon) - x(n))} height={plotH} />
      {ticks.map((value) => (
        <g key={value}>
          {value > 0 && <line className="ivd-grid" x1={left} x2={left + plotW} y1={y(value)} y2={y(value)} />}
          <text className="ivd-tick" x={left - 5} y={y(value) + 3} textAnchor="end">
            {value >= 1000 ? `${value / 1000}k` : value}
          </text>
        </g>
      ))}
      <line className="ivd-ppo" x1={x(0)} y1={y(0)} x2={x(horizon)} y2={y(ppo)} />
      <path className="ivd-race-rule" d={path(rule)} />
      <path className="ivd-race-you" d={path(you)} />
      {n > 0 && (
        <>
          <circle className="ivd-race-dot is-rule" cx={x(n)} cy={y(rule[n])} r={3} />
          <circle className="ivd-race-dot" cx={x(n)} cy={y(you[n])} r={3.2} />
        </>
      )}
      <line className="ivd-axis" x1={left} x2={left + plotW} y1={top + plotH} y2={top + plotH} />
      {[0, 25, 50, 75, 100].map((day) => (
        <text
          key={day}
          className="ivd-tick"
          x={x(day)}
          y={height - 2}
          textAnchor={day === 0 ? "start" : day === horizon ? "end" : "middle"}
        >
          {day === 0 ? "Day 0" : day}
        </text>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------ shop parts */

/** The rule's name keeps its case inside uppercase labels: (s, S), never (S, S). */
const SS = () => <span className="ivd-ss">(s, S)</span>;

function WeekStrip({ config, weekday }: { config: InventoryConfig; weekday: number }) {
  const rates = Array.from({ length: 7 }, (_, d) => demandRate(config, d));
  const peak = Math.max(...rates);
  return (
    <div className="ivd-week" aria-hidden="true">
      {rates.map((rate, d) => (
        <i
          key={d}
          className={d === weekday ? "is-today" : undefined}
          style={{ "--h": `${Math.max(12, (rate / peak) * 100)}%` } as CSSProperties}
        />
      ))}
    </div>
  );
}

function Shelf({ stock }: { stock: number }) {
  const shown = Math.min(stock, SHELF_CELLS);
  return (
    <div className="ivd-shelf" aria-hidden="true">
      {Array.from({ length: SHELF_CELLS }, (_, i) => (
        <i key={i} className={i < shown ? "is-full" : undefined} />
      ))}
      {stock > SHELF_CELLS && <span className="ivd-overflow">+{stock - SHELF_CELLS}</span>}
    </div>
  );
}

/** `order` is today's order, shown at the back of the queue; null once the shop has closed. */
function Pipeline({ state, order, config }: { state: ShopState; order: number | null; config: InventoryConfig }) {
  if (config.leadTime === 0) {
    return (
      <p className="ivd-pipe-none">
        No lead time: today's order is on the shelf before the first customer arrives.
      </p>
    );
  }
  return (
    <ol className="ivd-pipe" aria-label="Deliveries on the way, by days until arrival">
      {state.pipeline.map((units, i) => (
        <li key={i} className={units > 0 ? "has-units" : undefined}>
          <strong>{units}</strong>
          <span>{i === 0 ? "today" : `in ${i}d`}</span>
        </li>
      ))}
      {order !== null && (
        <li className="is-yours" title="Today's order">
          <strong>{order}</strong>
          <span>in {config.leadTime}d</span>
          <span className="ivd-sr"> (today's order)</span>
        </li>
      )}
    </ol>
  );
}

function CostCell({ label, you, rule }: { label: string; you: number; rule: number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {fmt(you)} <small>(s, S) {fmt(rule)}</small>
      </dd>
    </div>
  );
}

/* ----------------------------------------------------------------- demo */

/**
 * Run a small shop for 100 days against the tuned (s, S) rule, on exactly the
 * same customers, in a TypeScript port of the project's Gymnasium environment.
 */
export default function InventoryDemo({
  seed,
  difficulty: firstDifficulty = "medium",
}: {
  seed?: number;
  difficulty?: Difficulty;
}) {
  const reduced = useReducedMotion();
  const motionPaused = useMotionPaused();
  const hidden = usePageHidden();
  const id = useId();
  const [firstSeed] = useState(() => seed ?? randomSeed());
  const [difficulty, setDifficulty] = useState<Difficulty>(firstDifficulty);
  const [scenarioSeed, setScenarioSeed] = useState(firstSeed);
  const [seedDraft, setSeedDraft] = useState(String(firstSeed));
  const [game, setGame] = useState<Game>(() => newGame(firstDifficulty, firstSeed));
  const [order, setOrder] = useState(0);
  const [hint, setHint] = useState(false);
  const [auto, setAuto] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [news, setNews] = useState("");
  const [stockRef, stockWidth] = useWidth<HTMLDivElement>(420);
  const [raceRef, raceWidth] = useWidth<HTMLDivElement>(420);

  const config = CONFIGS[difficulty];
  const tuned = TUNED[difficulty];
  const published = PUBLISHED[difficulty];
  const scenario = useMemo(() => createScenario(difficulty, scenarioSeed), [difficulty, scenarioSeed]);
  const rulePolicy = useMemo(() => sSPolicy(tuned.s, tuned.S), [tuned]);
  const rule = useMemo(() => runEpisode(scenario, rulePolicy), [scenario, rulePolicy]);
  const ruleCum = useMemo(() => cumulativeCost(rule), [rule]);
  const randomCost = useMemo(() => totals(runEpisode(scenario, randomPolicy(scenario.seed))).total, [scenario]);

  const { state, records } = game;
  const day = state.t;
  const done = day >= config.horizon;
  const youCum = useMemo(() => cumulativeCost(records), [records]);
  const you = useMemo(() => totals(records), [records]);
  const ruleSoFar = useMemo(() => totals(rule, day), [rule, day]);
  const ruleOrder = rulePolicy(state, config);
  const position = inventoryPosition(state);
  const onTheWay = position - state.stock;
  const running = auto && !done && !motionPaused && !hidden;
  const still = Boolean(reduced) || motionPaused;

  const restart = useCallback((nextDifficulty: Difficulty, nextSeed: number) => {
    setGame(newGame(nextDifficulty, nextSeed));
    setAuto(false);
    setNews("");
  }, []);

  /** Plays one day with the given order. `byRule` marks autopilot days. */
  const playDay = useCallback(
    (quantity: number, byRule: boolean) => {
      if (game.state.t >= config.horizon) return;
      const result = step(config, game.state, quantity, scenario.demands[game.state.t]);
      const nextRecords = [...game.records, result.record];
      setGame({
        state: result.state,
        records: nextRecords,
        manualDays: game.manualDays + (byRule ? 0 : 1),
        hintDays: game.hintDays + (!byRule && hint ? 1 : 0),
      });
      const r = result.record;
      const youTotal = totals(nextRecords).total;
      const ruleTotal = ruleCum[r.day];
      if (r.day >= config.horizon) {
        setNews(
          `Day ${config.horizon}, the shop closes. Your cost ${fmt(youTotal)}; the (s, S) rule's ${fmt(ruleTotal)} on the same customers.`,
        );
      } else if (!byRule) {
        setNews(
          `Day ${r.day}: ordered ${r.order}, ${r.arrived} arrived, ${r.demand} ${plural(r.demand, "customer")}, ` +
            `${r.sales} served, ${r.lost} turned away. Cost today ${fmt(r.cost)}. ` +
            `Total ${fmt(youTotal)} against ${fmt(ruleTotal)} for (s, S).`,
        );
      }
    },
    [game, config, scenario, hint, ruleCum],
  );

  // The autopilot plays the rule's order on the visitor's own shop, one day per tick.
  // It rests while the tab is hidden or the page's motion switch is off, and stops on unmount.
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => {
      const quantity = rulePolicy(game.state, config);
      setOrder(quantity);
      playDay(quantity, true);
    }, SPEEDS[speed].ms);
    return () => window.clearTimeout(timer);
  }, [running, speed, game, config, rulePolicy, playDay]);

  const toggleAuto = () => {
    if (auto) {
      setAuto(false);
      setNews(`Autopilot paused on day ${day}.`);
    } else {
      setAuto(true);
      setNews(`Autopilot on: the (s, S) rule orders for you.`);
    }
  };

  const finishWithRule = () => {
    let next = game.state;
    const nextRecords = [...game.records];
    while (next.t < config.horizon) {
      const result = step(config, next, rulePolicy(next, config), scenario.demands[next.t]);
      nextRecords.push(result.record);
      next = result.state;
    }
    setGame({ ...game, state: next, records: nextRecords });
    setAuto(false);
    setNews(
      `The rule played the rest. Your cost ${fmt(totals(nextRecords).total)}; the (s, S) rule's ${fmt(ruleCum[config.horizon])}.`,
    );
  };

  const chooseDifficulty = (next: Difficulty) => {
    if (next === difficulty) return;
    setDifficulty(next);
    restart(next, scenarioSeed);
  };

  const changeSeed = (text: string) => {
    setSeedDraft(text);
    const value = Number(text);
    if (Number.isInteger(value) && value >= 1 && value <= SEED_MAX && value !== scenarioSeed) {
      setScenarioSeed(value);
      restart(difficulty, value);
    }
  };

  const shuffle = () => {
    let next = randomSeed();
    if (next === scenarioSeed) next = (next % SEED_MAX) + 1;
    setScenarioSeed(next);
    setSeedDraft(String(next));
    restart(difficulty, next);
  };

  const replay = () => restart(difficulty, scenarioSeed);

  const reset = () => {
    setDifficulty(firstDifficulty);
    setScenarioSeed(firstSeed);
    setSeedDraft(String(firstSeed));
    setOrder(0);
    setHint(false);
    setSpeed(1);
    restart(firstDifficulty, firstSeed);
  };

  const onSliderKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (!running) playDay(order, false);
    }
  };

  const today = day + 1;
  const expected = demandRate(config, state.weekday);
  const orderCost = order > 0 ? config.fixedCost + config.unitCost * order : 0;
  const last = records[records.length - 1];
  const gap = you.total - ruleSoFar.total;
  const ruleFinal = ruleCum[config.horizon];
  const ruleTotals = useMemo(() => totals(rule), [rule]);

  const hintText =
    position <= tuned.s
      ? `(s, S) would order ${ruleOrder}: the position ${position} is at or below s = ${tuned.s}, so it orders up to S = ${tuned.S}${
          tuned.S - position > config.maxOrder ? `, capped at ${config.maxOrder}` : ""
        }.`
      : `(s, S) would order nothing: the position ${position} is above s = ${tuned.s}.`;

  const stockLabel =
    `Stock at closing and customers for ${day} ${plural(day, "day")}. ` +
    (day > 0
      ? `You turned away ${you.lost} of ${you.demand} customers; the (s, S) rule turned away ${ruleSoFar.lost}.`
      : "Nothing played yet.");
  const raceLabel =
    `Cumulative cost after ${day} ${plural(day, "day")}: you ${fmt(you.total)}, the (s, S) rule ${fmt(ruleSoFar.total)}. ` +
    `A straight reference line shows PPO's published average of ${fmt(published.ppo)} per 100 days.`;

  // Ranking at the close: you against the rule and the random baseline, on these customers.
  const ranking = [
    { name: "You", cost: you.total, you: true },
    { name: `(s, S) rule · s ${tuned.s}, S ${tuned.S}`, cost: ruleFinal, you: false },
    { name: "Random orders", cost: randomCost, you: false },
  ].sort((a, b) => a.cost - b.cost || (a.you ? -1 : b.you ? 1 : 0));
  const rankOf = (cost: number) => ranking.filter((row) => row.cost < cost).length + 1;
  const finalGap = you.total - ruleFinal;
  let verdict = "A dead heat with the textbook rule.";
  if (finalGap < 0) verdict = `You beat the textbook rule by ${fmt(-finalGap)} (${pct(-finalGap / ruleFinal)}).`;
  else if (finalGap > 0) verdict = `The textbook rule won by ${fmt(finalGap)} (${pct(finalGap / ruleFinal)}).`;

  let gapText = "Level with the rule.";
  if (day === 0) gapText = "Same customers, same starting shelf.";
  else if (gap < 0) gapText = `${fmt(-gap)} ahead of the rule`;
  else if (gap > 0) gapText = `${fmt(gap)} behind the rule`;

  return (
    <DemoFrame
      project="Inventory RL"
      title="Run the shop yourself"
      intro="Each morning, choose how many units to order. Customers walk away when the shelf is empty, stock left on it costs money every night, and deliveries can take days. The tuned (s, S) rule runs the same shop on exactly the same customers."
      note="A TypeScript port of the project's Gymnasium environment: the same daily timeline, costs, three configs and tuned (s, S) pairs, with its own seeded random numbers, so scenario 7 here is not the Python seed 7. The random baseline uses its own generator too. PPO is not run in your browser: its line is the published average over 30 held-out seeds for that difficulty, not this scenario."
      onReset={reset}
      className={`ivd-demo${still ? " is-still" : ""}`}
    >
      <div className="ivd-layout">
        {/* ---------- Setup: difficulty and scenario ---------- */}
        <div className="ivd-setup">
          <div className="ivd-setup-group">
            <span className="demo-label" id={`${id}-diff`}>
              Difficulty
            </span>
            <div className="demo-chips" role="group" aria-labelledby={`${id}-diff`}>
              {DIFFICULTIES.map((key) => {
                const c = CONFIGS[key];
                return (
                  <button
                    key={key}
                    type="button"
                    className="demo-chip ivd-diff"
                    aria-pressed={key === difficulty}
                    onClick={() => chooseDifficulty(key)}
                  >
                    {NAMES[key]}
                    <small>
                      L {c.leadTime} · K {c.fixedCost}
                      {c.seasonality > 0 ? " · weekly" : ""}
                    </small>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="ivd-setup-group">
            <label className="demo-label" htmlFor={`${id}-seed`}>
              Scenario
            </label>
            <div className="ivd-seed">
              <input
                id={`${id}-seed`}
                className="demo-input ivd-seed-input"
                type="number"
                inputMode="numeric"
                min={1}
                max={SEED_MAX}
                value={seedDraft}
                onChange={(event) => changeSeed(event.target.value)}
                onBlur={() => setSeedDraft(String(scenarioSeed))}
              />
              <button type="button" className="demo-btn is-ghost" onClick={shuffle}>
                <Shuffle size={14} aria-hidden="true" /> New scenario
              </button>
            </div>
          </div>
          <p className="ivd-config">{configSummary(config)}</p>
        </div>

        <div className="ivd-main">
          {/* ---------- The shop ---------- */}
          <section className="ivd-shop" aria-labelledby={`${id}-shop`}>
            <div className="ivd-day">
              <h4 id={`${id}-shop`}>
                {done ? (
                  <>Day {config.horizon} · closed</>
                ) : (
                  <>
                    Day <strong>{today}</strong> of {config.horizon}
                  </>
                )}
              </h4>
              <div
                className="ivd-progress"
                role="progressbar"
                aria-label="Days played"
                aria-valuemin={0}
                aria-valuemax={config.horizon}
                aria-valuenow={day}
              >
                <i style={{ width: `${(day / config.horizon) * 100}%` }} />
              </div>
            </div>

            {!done && (
              <div className="ivd-today">
                {config.seasonality > 0 && <WeekStrip config={config} weekday={state.weekday} />}
                <p>
                  {config.seasonality > 0 ? "Weekly cycle · " : "Steady demand · "}
                  about <strong>{expected.toFixed(1)}</strong> customers expected today
                </p>
              </div>
            )}

            <div className="ivd-block">
              <p className="ivd-block-head">
                <span>On the shelf</span> <strong>{state.stock}</strong>
              </p>
              <Shelf stock={state.stock} />
            </div>

            <div className="ivd-block">
              <p className="ivd-block-head">
                <span>On the way</span> <strong>{onTheWay}</strong>
              </p>
              <Pipeline state={state} order={done ? null : order} config={config} />
              <p className="ivd-position">
                Inventory position {position} <span>(shelf + on the way)</span>
                {config.leadTime > 0 && !done && <span className="ivd-dashed-note"> · dashed: today's order</span>}
              </p>
            </div>

            {done ? (
              <div className="ivd-result" aria-labelledby={`${id}-result`}>
                <p className="ivd-result-title" id={`${id}-result`}>
                  Day {config.horizon} · the shop closes
                </p>
                <div className="ivd-result-pair">
                  <div>
                    <span>Your cost</span> <strong>{fmt(you.total)}</strong>
                  </div>
                  <div>
                    <span><SS /> rule</span> <strong>{fmt(ruleFinal)}</strong>
                  </div>
                </div>
                <p className="ivd-verdict">{verdict}</p>
                <ol className="ivd-rank" aria-label="Ranking on these customers">
                  {ranking.map((row) => (
                    <li key={row.name} className={row.you ? "is-you" : undefined}>
                      <span className="ivd-rank-n">{rankOf(row.cost)}</span>
                      <span className="ivd-rank-name">{row.name}</span>
                      <span className="ivd-rank-cost">{fmt(row.cost)}</span>
                    </li>
                  ))}
                </ol>
                <p className="ivd-result-note">
                  You served {pct(fillRate(you), 0)} of customers; the rule served {pct(fillRate(ruleTotals), 0)}.
                  {game.manualDays === 0
                    ? ` The rule chose all ${config.horizon} orders, so this was the rule racing itself.`
                    : game.manualDays < config.horizon &&
                      ` You chose ${game.manualDays} of ${config.horizon} orders; the rule chose the rest.`}
                  {game.hintDays > 0 &&
                    ` The rule's order was showing on ${game.hintDays} ${plural(game.hintDays, "day")}.`}
                </p>
                <p className="ivd-result-note">
                  For reference, PPO averaged {fmt(published.ppo)} ± {published.ppoHalfWidth} on {difficulty} over 30
                  held-out seeds, and the (s,{" "}S) rule {fmt(published.sS)} ± {published.sSHalfWidth}: measured
                  averages, not these customers.
                </p>
                <div className="ivd-result-actions">
                  <button type="button" className="demo-btn" onClick={replay}>
                    <RotateCcw size={14} aria-hidden="true" /> Replay these customers
                  </button>
                  <button type="button" className="demo-btn is-ghost" onClick={shuffle}>
                    <Shuffle size={14} aria-hidden="true" /> New scenario
                  </button>
                </div>
              </div>
            ) : (
              <div className="ivd-order">
                <div className="ivd-order-head">
                  <label htmlFor={`${id}-order`}>Today's order</label>
                  <output htmlFor={`${id}-order`}>
                    <strong>{order}</strong> {plural(order, "unit")}
                  </output>
                </div>
                <div
                  className="ivd-range-wrap"
                  style={{ "--mark": ruleOrder / config.maxOrder } as CSSProperties}
                >
                  <input
                    id={`${id}-order`}
                    className="ivd-range"
                    type="range"
                    min={0}
                    max={config.maxOrder}
                    step={1}
                    value={order}
                    aria-valuetext={`${order} ${plural(order, "unit")}`}
                    aria-describedby={`${id}-keys`}
                    style={{ "--fill": `${(order / config.maxOrder) * 100}%` } as CSSProperties}
                    onChange={(event) => setOrder(Number(event.target.value))}
                    onKeyDown={onSliderKey}
                    disabled={running}
                  />
                  {hint && <i className="ivd-mark" aria-hidden="true" />}
                </div>
                <p className="ivd-order-cost">
                  {order > 0
                    ? `Costs ${config.fixedCost} + ${config.unitCost} × ${order} = ${orderCost} today`
                    : "No order today, so no ordering cost"}
                </p>
                {hint && <p className="ivd-hint">{hintText}</p>}

                <div className="ivd-actions">
                  <button
                    type="button"
                    className="demo-btn"
                    onClick={() => playDay(order, false)}
                    disabled={running}
                  >
                    Next day <ArrowRight size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="demo-btn is-ghost"
                    aria-pressed={hint}
                    onClick={() => setHint(!hint)}
                  >
                    <Lightbulb size={14} aria-hidden="true" /> Show the rule's order
                  </button>
                </div>
                <p className="ivd-keys" id={`${id}-keys`}>
                  Arrow keys set the order; Enter plays the day.
                </p>

                <div className="ivd-auto">
                  <span className="demo-label">
                    Autopilot · the <SS /> rule orders for you
                  </span>
                  <div className="ivd-auto-row">
                    <button
                      type="button"
                      className="demo-btn is-ghost"
                      aria-pressed={auto}
                      onClick={toggleAuto}
                      disabled={motionPaused && !auto}
                    >
                      {auto ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
                      {auto ? "Pause autopilot" : "Autopilot"}
                    </button>
                    <div className="demo-chips" role="group" aria-label="Autopilot speed">
                      {SPEEDS.map((option, i) => (
                        <button
                          key={option.label}
                          type="button"
                          className="demo-chip"
                          aria-pressed={speed === i}
                          onClick={() => setSpeed(i)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <button type="button" className="demo-btn is-ghost" onClick={finishWithRule}>
                      <FastForward size={14} aria-hidden="true" /> Rule plays the rest
                    </button>
                  </div>
                  {motionPaused && (
                    <p className="ivd-keys">Motion is paused on this page, so the autopilot is off.</p>
                  )}
                </div>
              </div>
            )}

            {last && (
              <p className="ivd-receipt">
                <span>Day {last.day}</span> ordered {last.order} · {last.arrived} arrived · {last.demand}{" "}
                {plural(last.demand, "customer")} · {last.sales} served ·{" "}
                <span className={last.lost > 0 ? "is-lost" : undefined}>{last.lost} turned away</span> · cost{" "}
                {fmt(last.cost)} <small>(holding {last.holdingCost}, lost sales {last.stockoutCost}, ordering {last.orderCost})</small>
              </p>
            )}
          </section>

          {/* ---------- Charts ---------- */}
          <div className="ivd-charts">
            <figure className="ivd-chart">
              <figcaption className="ivd-chart-head">
                <span>Stock and customers</span>
                <span className="ivd-chart-meta">
                  {you.lost} turned away · <SS /> {ruleSoFar.lost}
                </span>
              </figcaption>
              <div className="ivd-plot" ref={stockRef}>
                <StockChart records={records} rule={rule} horizon={config.horizon} width={stockWidth} label={stockLabel} />
              </div>
              <ul className="ivd-legend" aria-hidden="true">
                <li>
                  <i className="ivd-key-bar" /> Your stock at closing
                </li>
                <li>
                  <i className="ivd-key-dot" /> Customers
                </li>
                <li>
                  <svg viewBox="0 0 18 6">
                    <line className="ivd-rule-stock" x1="0" x2="18" y1="3" y2="3" />
                  </svg>
                  <SS /> stock
                </li>
                <li>
                  <i className="ivd-key-lost" /> Turned away
                </li>
              </ul>
            </figure>

            <figure className="ivd-chart">
              <figcaption className="ivd-chart-head">
                <span>Cumulative cost · lower wins</span>
                <span className="ivd-chart-meta">{gapText}</span>
              </figcaption>
              <div className="ivd-plot" ref={raceRef}>
                <RaceChart
                  you={youCum}
                  rule={ruleCum.slice(0, day + 1)}
                  ruleFull={ruleFinal}
                  ppo={published.ppo}
                  horizon={config.horizon}
                  width={raceWidth}
                  label={raceLabel}
                />
              </div>
              <ul className="ivd-legend" aria-hidden="true">
                <li>
                  <svg viewBox="0 0 18 6">
                    <line className="ivd-race-you" x1="0" x2="18" y1="3" y2="3" />
                  </svg>
                  You <strong>{fmt(you.total)}</strong>
                </li>
                <li>
                  <svg viewBox="0 0 18 6">
                    <line className="ivd-race-rule" x1="0" x2="18" y1="3" y2="3" />
                  </svg>
                  <SS /> <strong>{fmt(ruleSoFar.total)}</strong>
                </li>
                <li>
                  <svg viewBox="0 0 18 6">
                    <line className="ivd-ppo" x1="1" x2="18" y1="3" y2="3" />
                  </svg>
                  PPO pace <strong>{fmt(published.ppo)}</strong>/100 days
                </li>
              </ul>
              <p className="ivd-ppo-note">
                PPO line: the published average over 30 held-out seeds on {difficulty}, drawn as an even pace. It is
                not PPO playing these customers.
              </p>
            </figure>
          </div>
        </div>

        {/* ---------- Running cost breakdown ---------- */}
        {/* The space before each <small> keeps value and note apart when read aloud. */}
        <dl className="ivd-stats" aria-label={`Costs after ${day} ${plural(day, "day")}, you against the (s, S) rule`}>
          <CostCell label="Holding" you={you.holding} rule={ruleSoFar.holding} />
          <CostCell label="Lost sales" you={you.stockout} rule={ruleSoFar.stockout} />
          <CostCell label="Ordering" you={you.ordering} rule={ruleSoFar.ordering} />
          <CostCell label="Total cost" you={you.total} rule={ruleSoFar.total} />
          <div>
            <dt>Customers served</dt>
            <dd>
              {day > 0 ? pct(fillRate(you), 0) : "–"} <small>(s, S) {day > 0 ? pct(fillRate(ruleSoFar), 0) : "–"}</small>
            </dd>
          </div>
        </dl>

        <p className="ivd-sr" aria-live="polite">
          {news}
        </p>
      </div>
    </DemoFrame>
  );
}


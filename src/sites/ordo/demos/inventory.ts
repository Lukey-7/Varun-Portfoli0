/**
 * The pure, deterministic half of the Inventory RL demo: a TypeScript port of
 * the project's Gymnasium environment (single product, lost sales, an order
 * lead time, a weekly demand cycle) and its (s, S) baseline.
 *
 * One day, exactly as in inventory_rl/env.py:
 *   1. Choose an order q (0..20) and pay for it: K if q > 0, plus c per unit.
 *   2. The order placed L days ago arrives (with L = 0, today's order arrives now).
 *   3. Poisson demand D is drawn; sales = min(stock, D); the rest are lost.
 *   4. Holding cost h is charged on the stock left at the end of the day.
 *   reward = -(h * stock_end + p * lost + K * [q > 0] + c * q)
 *
 * Nothing here touches the network, the clock or Math.random.
 */

export type Difficulty = "easy" | "medium" | "hard";

export interface InventoryConfig {
  leadTime: number;
  demandMean: number;
  /** Amplitude of the weekly demand cycle (0 = stationary). */
  seasonality: number;
  maxOrder: number;
  holdingCost: number;
  stockoutPenalty: number;
  fixedCost: number;
  unitCost: number;
  horizon: number;
}

const BASE: InventoryConfig = {
  leadTime: 0,
  demandMean: 4,
  seasonality: 0,
  maxOrder: 20,
  holdingCost: 1,
  stockoutPenalty: 10,
  fixedCost: 5,
  unitCost: 2,
  horizon: 100,
};

/** The project's three configs (inventory_rl/env.py, CONFIGS). */
export const CONFIGS: Record<Difficulty, InventoryConfig> = {
  easy: { ...BASE, leadTime: 0 },
  medium: { ...BASE, leadTime: 2 },
  hard: { ...BASE, leadTime: 4, seasonality: 0.5, fixedCost: 20 },
};

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

/** Grid-searched (s, S) per config, from results/s_S_params.json. */
export const TUNED: Record<Difficulty, { s: number; S: number }> = {
  easy: { s: 3, S: 9 },
  medium: { s: 12, S: 18 },
  hard: { s: 17, S: 29 },
};

/**
 * Published results (results/results.md): mean cost per 100-day episode over
 * 30 held-out seeds (1000–1029), with the 95% half-width. Costs are minus the
 * returns in the table. PPO averages its three training seeds.
 */
export const PUBLISHED: Record<
  Difficulty,
  { random: number; sS: number; sSHalfWidth: number; ppo: number; ppoHalfWidth: number }
> = {
  easy: { random: 34280.6, sS: 1541.5, sSHalfWidth: 21.8, ppo: 1557.4, ppoHalfWidth: 21.2 },
  medium: { random: 33242.5, sS: 1741.0, sSHalfWidth: 28.3, ppo: 1737.6, ppoHalfWidth: 28.6 },
  hard: { random: 33870.2, sS: 2442.4, sSHalfWidth: 51.5, ppo: 2360.9, ppoHalfWidth: 44.1 },
};

/** Mulberry32: a small 32-bit generator. The same seed always gives the same stream. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Spread neighbouring seeds (1, 2, 3...) across the generator's state space. */
export function mixSeed(seed: number) {
  let h = Math.imul((seed | 0) ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** A uniform integer in [lo, hi], both inclusive (numpy's integers(lo, hi + 1)). */
export function uniformInt(random: () => number, lo: number, hi: number) {
  return lo + Math.floor(random() * (hi - lo + 1));
}

/** One Poisson draw (Knuth's product method; exact, and quick for means this small). */
export function poisson(random: () => number, mean: number): number {
  if (mean <= 0) return 0;
  const limit = Math.exp(-mean);
  let k = 0;
  let product = random();
  while (product > limit) {
    k += 1;
    product *= random();
  }
  return k;
}

/** μ_d = μ · (1 + a · sin(2π · d / 7)) for day of week d. */
export function demandRate(config: InventoryConfig, weekday: number) {
  return config.demandMean * (1 + config.seasonality * Math.sin((2 * Math.PI * weekday) / 7));
}

/** Everything random about one episode. It never depends on the orders placed. */
export interface Scenario {
  seed: number;
  difficulty: Difficulty;
  config: InventoryConfig;
  initialStock: number;
  startWeekday: number;
  /** demands[t] is the number of customers on day t + 1. */
  demands: number[];
}

/**
 * Draws a scenario in the env's own order: starting stock in [0, 2μ(L + 1)],
 * starting weekday, then one Poisson demand per day. Because demand depends
 * only on the weekday, which advances by one each day whatever is ordered,
 * every policy run on a scenario faces exactly the same customers.
 */
export function createScenario(difficulty: Difficulty, seed: number): Scenario {
  const config = CONFIGS[difficulty];
  const random = mulberry32(mixSeed(seed));
  const high = Math.trunc(2 * config.demandMean * (config.leadTime + 1));
  const initialStock = uniformInt(random, 0, high);
  const startWeekday = uniformInt(random, 0, 6);
  const demands: number[] = [];
  for (let t = 0; t < config.horizon; t += 1) {
    demands.push(poisson(random, demandRate(config, (startWeekday + t) % 7)));
  }
  return { seed, difficulty, config, initialStock, startWeekday, demands };
}

export interface ShopState {
  /** Days already played (0..horizon). */
  t: number;
  /** Day of the week for the next day (0..6). */
  weekday: number;
  /** Units on the shelf before today's delivery. */
  stock: number;
  /** pipeline[i] arrives i days from now (pipeline[0] arrives today). Length L. */
  pipeline: number[];
}

export function initialState(scenario: Scenario): ShopState {
  return {
    t: 0,
    weekday: scenario.startWeekday,
    stock: scenario.initialStock,
    pipeline: new Array<number>(scenario.config.leadTime).fill(0),
  };
}

/** On-hand stock plus everything already ordered but not yet arrived. */
export function inventoryPosition(state: ShopState) {
  return state.stock + state.pipeline.reduce((sum, units) => sum + units, 0);
}

export interface DayRecord {
  /** 1-based day number. */
  day: number;
  weekday: number;
  stockStart: number;
  order: number;
  arrived: number;
  demand: number;
  sales: number;
  lost: number;
  stockEnd: number;
  holdingCost: number;
  stockoutCost: number;
  orderCost: number;
  /** holding + stockout + order; the env's reward is minus this. */
  cost: number;
}

/** One day of the environment, given the day's demand. Pure: returns a new state. */
export function step(
  config: InventoryConfig,
  state: ShopState,
  order: number,
  demand: number,
): { state: ShopState; record: DayRecord } {
  if (!Number.isInteger(order) || order < 0 || order > config.maxOrder) {
    throw new RangeError(`order ${order} outside 0..${config.maxOrder}`);
  }
  const orderCost = (order > 0 ? config.fixedCost : 0) + config.unitCost * order;
  let arrived: number;
  let pipeline: number[];
  if (config.leadTime === 0) {
    arrived = order;
    pipeline = [];
  } else {
    arrived = state.pipeline[0];
    pipeline = [...state.pipeline.slice(1), order];
  }
  const stocked = state.stock + arrived;
  const sales = Math.min(stocked, demand);
  const lost = demand - sales;
  const stockEnd = stocked - sales;
  const holdingCost = config.holdingCost * stockEnd;
  const stockoutCost = config.stockoutPenalty * lost;
  const record: DayRecord = {
    day: state.t + 1,
    weekday: state.weekday,
    stockStart: state.stock,
    order,
    arrived,
    demand,
    sales,
    lost,
    stockEnd,
    holdingCost,
    stockoutCost,
    orderCost,
    cost: holdingCost + stockoutCost + orderCost,
  };
  return {
    state: { t: state.t + 1, weekday: (state.weekday + 1) % 7, stock: stockEnd, pipeline },
    record,
  };
}

export type Policy = (state: ShopState, config: InventoryConfig) => number;

/** Classic (s, S): when the inventory position falls to s or below, order up to S. */
export function sSPolicy(s: number, S: number): Policy {
  return (state, config) => {
    const position = inventoryPosition(state);
    return position <= s ? Math.min(S - position, config.maxOrder) : 0;
  };
}

/** A uniform random order each day, from its own generator (never the scenario's). */
export function randomPolicy(seed: number): Policy {
  const random = mulberry32(mixSeed(seed ^ 0x5bd1e995));
  return (_state, config) => uniformInt(random, 0, config.maxOrder);
}

/** Plays a policy through a whole scenario and returns the per-day log. */
export function runEpisode(scenario: Scenario, policy: Policy): DayRecord[] {
  const { config } = scenario;
  let state = initialState(scenario);
  const records: DayRecord[] = [];
  while (state.t < config.horizon) {
    const next = step(config, state, policy(state, config), scenario.demands[state.t]);
    records.push(next.record);
    state = next.state;
  }
  return records;
}

export interface Totals {
  holding: number;
  stockout: number;
  ordering: number;
  total: number;
  demand: number;
  sales: number;
  lost: number;
  orders: number;
}

export function totals(records: readonly DayRecord[], days = records.length): Totals {
  const sum: Totals = { holding: 0, stockout: 0, ordering: 0, total: 0, demand: 0, sales: 0, lost: 0, orders: 0 };
  for (let i = 0; i < Math.min(days, records.length); i += 1) {
    const r = records[i];
    sum.holding += r.holdingCost;
    sum.stockout += r.stockoutCost;
    sum.ordering += r.orderCost;
    sum.total += r.cost;
    sum.demand += r.demand;
    sum.sales += r.sales;
    sum.lost += r.lost;
    if (r.order > 0) sum.orders += 1;
  }
  return sum;
}

/** Running total cost: cumulative[0] = 0, cumulative[t] = cost of days 1..t. */
export function cumulativeCost(records: readonly DayRecord[]) {
  const out = [0];
  for (const r of records) out.push(out[out.length - 1] + r.cost);
  return out;
}

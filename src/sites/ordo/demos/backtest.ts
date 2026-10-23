/**
 * The pure, deterministic half of the AxiomQuant demo: a seeded random walk,
 * a long/flat moving-average crossover that pays a cost on every trade,
 * annualised Sharpe, drawdown and an in-sample parameter sweep.
 * Nothing here touches the network, the clock or Math.random.
 */

export const TRADING_DAYS = 252;
/** Ten years of trading days, shown on the chart and scored. */
export const DAYS = 2520;
/** Closes before day one, so even the slowest average is ready on the first day. */
export const HISTORY = 250;
export const IN_SAMPLE_SHARE = 0.7;
/** Roughly a broad stock index: about 1% a day. */
export const ANNUAL_VOLATILITY = 0.16;

/** The grid AxiomQuant's own sweep uses: 41 pairs once fast < slow is enforced. */
export const SWEEP_FAST = [5, 10, 15, 20, 30, 40, 50];
export const SWEEP_SLOW = [50, 75, 100, 125, 150, 200];

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

/** One standard normal draw (Box-Muller). */
export function normal(random: () => number): number {
  // 1 - u lies in (0, 1], so the logarithm stays finite.
  const u = 1 - random();
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Spread neighbouring seeds (1, 2, 3...) across the generator's state space.
const mixSeed = (seed: number) => {
  let h = Math.imul((seed | 0) ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
};

export interface MarketOptions {
  days?: number;
  history?: number;
  /** Annualised volatility of daily returns. */
  volatility?: number;
  /** Annualised expected return. Zero means no rule can have a real edge. */
  drift?: number;
  startPrice?: number;
}

export interface Market {
  seed: number;
  /** Daily closes: `history` warm-up closes, then `days` more. */
  prices: Float64Array;
  /** Index of the close on day one, where the rule may first trade. */
  start: number;
  /** Number of daily returns shown and scored. */
  days: number;
  /** Returns before this index are in sample; the rest are out of sample. */
  split: number;
}

/** A geometric random walk whose expected daily return is exactly the drift. */
export function createMarket(seed: number, options: MarketOptions = {}): Market {
  const {
    days = DAYS,
    history = HISTORY,
    volatility = ANNUAL_VOLATILITY,
    drift = 0,
    startPrice = 100,
  } = options;
  const random = mulberry32(mixSeed(seed));
  const sigma = volatility / Math.sqrt(TRADING_DAYS);
  // The -sigma^2/2 term makes E[P(t+1) / P(t)] = 1 + daily drift, so zero drift really is zero.
  const mu = Math.log(1 + drift / TRADING_DAYS) - (sigma * sigma) / 2;
  const prices = new Float64Array(history + days + 1);
  prices[0] = startPrice;
  for (let i = 1; i < prices.length; i += 1) {
    prices[i] = prices[i - 1] * Math.exp(mu + sigma * normal(random));
  }
  return { seed, prices, start: history, days, split: Math.round(days * IN_SAMPLE_SHARE) };
}

/** Trailing simple moving average; NaN until `window` closes exist. */
export function movingAverage(prices: ArrayLike<number>, window: number): Float64Array {
  const out = new Float64Array(prices.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < prices.length; i += 1) {
    sum += prices[i];
    if (i >= window) sum -= prices[i - window];
    if (i >= window - 1) out[i] = sum / window;
  }
  return out;
}

/**
 * 1 (long) when the fast average closes above the slow one, else 0 (cash).
 * Each value uses closes up to and including that day only.
 */
export function crossoverSignal(prices: ArrayLike<number>, fast: number, slow: number): Uint8Array {
  const quick = movingAverage(prices, fast);
  const steady = movingAverage(prices, slow);
  const signal = new Uint8Array(prices.length);
  // NaN never compares greater, so the rule stays in cash until both averages exist.
  for (let i = 0; i < prices.length; i += 1) signal[i] = quick[i] > steady[i] ? 1 : 0;
  return signal;
}

export interface StrategyParams {
  fast: number;
  slow: number;
  /** Cost of each buy or sell, in basis points of the amount traded. */
  costBps: number;
}

export interface Backtest {
  /** Position held over each day shown: 1 long, 0 cash. */
  positions: Uint8Array;
  /** Daily returns before costs, one per day shown. */
  gross: Float64Array;
  /** Daily returns after costs. */
  net: Float64Array;
  /** Growth of 1 before costs; days + 1 values. */
  grossEquity: Float64Array;
  /** Growth of 1 after costs; days + 1 values. */
  netEquity: Float64Array;
  /** Buys plus sells. */
  trades: number;
  /** Total costs paid, as a fraction of starting capital. */
  costPaid: number;
  /** Share of days spent long. */
  exposure: number;
}

/**
 * Long/flat crossover: the signal at one close sets the position held until
 * the next, so the rule never sees a price before it trades on it. It starts
 * in cash, and every change of position pays the cost on the whole account.
 */
export function backtest(market: Market, { fast, slow, costBps }: StrategyParams): Backtest {
  const { prices, start, days } = market;
  const signal = crossoverSignal(prices, fast, slow);
  const cost = costBps / 10_000;
  const positions = new Uint8Array(days);
  const gross = new Float64Array(days);
  const net = new Float64Array(days);
  const grossEquity = new Float64Array(days + 1);
  const netEquity = new Float64Array(days + 1);
  grossEquity[0] = 1;
  netEquity[0] = 1;
  let held = 0;
  let trades = 0;
  let costPaid = 0;
  let longDays = 0;
  for (let k = 0; k < days; k += 1) {
    const t = start + k;
    let equity = netEquity[k];
    if (signal[t] !== held) {
      held = signal[t];
      trades += 1;
      costPaid += equity * cost;
      equity *= 1 - cost;
    }
    const move = held * (prices[t + 1] / prices[t] - 1);
    positions[k] = held;
    gross[k] = move;
    grossEquity[k + 1] = grossEquity[k] * (1 + move);
    netEquity[k + 1] = equity * (1 + move);
    net[k] = netEquity[k + 1] / netEquity[k] - 1;
    longDays += held;
  }
  return { positions, gross, net, grossEquity, netEquity, trades, costPaid, exposure: longDays / days };
}

/** Annualised Sharpe ratio (√252) of daily returns in [from, to), with a zero risk-free rate. */
export function sharpe(returns: ArrayLike<number>, from = 0, to = returns.length): number {
  const n = to - from;
  if (n < 2) return 0;
  let mean = 0;
  for (let i = from; i < to; i += 1) mean += returns[i];
  mean /= n;
  let squares = 0;
  for (let i = from; i < to; i += 1) squares += (returns[i] - mean) ** 2;
  const sd = Math.sqrt(squares / (n - 1));
  // A rule that never holds anything has no risk and no return; call that 0.
  return sd > 1e-12 ? (mean / sd) * Math.sqrt(TRADING_DAYS) : 0;
}

/** Largest fall from a running peak, as a fraction at or below zero (-0.2 is 20% down). */
export function maxDrawdown(equity: ArrayLike<number>): number {
  let peak = -Infinity;
  let worst = 0;
  for (let i = 0; i < equity.length; i += 1) {
    peak = Math.max(peak, equity[i]);
    worst = Math.min(worst, equity[i] / peak - 1);
  }
  return worst;
}

export interface Summary {
  trades: number;
  costPaid: number;
  sharpeIn: number;
  sharpeOut: number;
  sharpeInGross: number;
  sharpeOutGross: number;
  maxDrawdown: number;
  /** Growth of 1 at the end, after costs, before costs and for buy and hold. */
  finalNet: number;
  finalGross: number;
  finalMarket: number;
  exposure: number;
}

/** The readouts: Sharpe ratios after costs (and before) on each side of the split. */
export function summarise(market: Market, run: Backtest): Summary {
  const { split, days, prices, start } = market;
  return {
    trades: run.trades,
    costPaid: run.costPaid,
    sharpeIn: sharpe(run.net, 0, split),
    sharpeOut: sharpe(run.net, split, days),
    sharpeInGross: sharpe(run.gross, 0, split),
    sharpeOutGross: sharpe(run.gross, split, days),
    maxDrawdown: maxDrawdown(run.netEquity),
    finalNet: run.netEquity[days],
    finalGross: run.grossEquity[days],
    finalMarket: prices[start + days] / prices[start],
    exposure: run.exposure,
  };
}

export interface Pair {
  fast: number;
  slow: number;
}

/** Every (fast, slow) pair in the grid with fast < slow, fast-major order. */
export function sweepPairs(fasts: number[] = SWEEP_FAST, slows: number[] = SWEEP_SLOW): Pair[] {
  return fasts.flatMap((fast) => slows.filter((slow) => fast < slow).map((slow) => ({ fast, slow })));
}

export interface SweepCell extends Pair {
  inSample: number;
  outOfSample: number;
}

export interface SweepResult {
  seed: number;
  costBps: number;
  /** One cell per pair, in sweepPairs order. */
  cells: SweepCell[];
  /** Index of the cell with the highest in-sample Sharpe. */
  best: number;
  /** Where the pick lands among all pairs out of sample; 1 is the top. */
  bestOutOfSampleRank: number;
}

/**
 * Scores every pair after costs and picks the highest in-sample Sharpe.
 * The pick reads in-sample numbers only; out-of-sample ones are kept for the reveal.
 */
export function runSweep(market: Market, costBps: number, pairs: Pair[] = sweepPairs()): SweepResult {
  const cells = pairs.map(({ fast, slow }) => {
    const run = backtest(market, { fast, slow, costBps });
    return {
      fast,
      slow,
      inSample: sharpe(run.net, 0, market.split),
      outOfSample: sharpe(run.net, market.split, market.days),
    };
  });
  let best = 0;
  cells.forEach((cell, i) => {
    if (cell.inSample > cells[best].inSample) best = i;
  });
  const bestOutOfSampleRank = 1 + cells.filter((cell) => cell.outOfSample > cells[best].outOfSample).length;
  return { seed: market.seed, costBps, cells, best, bestOutOfSampleRank };
}

export interface TallyEntry {
  /** The in-sample winner's Sharpe on each side of the split. */
  inSample: number;
  outOfSample: number;
  /** Its out-of-sample rank among all pairs; 1 is the top. */
  rank: number;
}

/** How often the in-sample winner did worse on the years it never saw. */
export function tally(entries: TallyEntry[]) {
  const total = entries.length;
  const worse = entries.filter((entry) => entry.outOfSample < entry.inSample).length;
  const mean = (pick: (entry: TallyEntry) => number) =>
    total ? entries.reduce((sum, entry) => sum + pick(entry), 0) / total : 0;
  return {
    worse,
    total,
    meanInSample: mean((entry) => entry.inSample),
    meanOutOfSample: mean((entry) => entry.outOfSample),
    meanRank: mean((entry) => entry.rank),
  };
}

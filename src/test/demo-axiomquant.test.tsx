import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { setMotionPaused } from "@/lib/motion-pause";
import AxiomQuantDemo from "@/sites/ordo/demos/AxiomQuantDemo";
import {
  DAYS,
  HISTORY,
  IN_SAMPLE_SHARE,
  TRADING_DAYS,
  backtest,
  createMarket,
  crossoverSignal,
  maxDrawdown,
  movingAverage,
  mulberry32,
  runSweep,
  sharpe,
  summarise,
  sweepPairs,
  tally,
  type Market,
} from "@/sites/ordo/demos/backtest";

afterEach(() => {
  cleanup();
  setMotionPaused(false);
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const bestOf = (seed: number, costBps = 10) => {
  const sweep = runSweep(createMarket(seed), costBps);
  return { sweep, best: sweep.cells[sweep.best] };
};
/** Reads a displayed number ("+1.05", "-0.42" shown with a true minus, "12.5%") back as a number. */
const shown = (text: string | null | undefined) => Number((text ?? "").replace("\u2212", "-").replace("%", ""));
const readout = (label: string) =>
  screen.getByText(label, { selector: "dt" }).nextElementSibling?.firstChild?.textContent;
const filledCells = () =>
  within(screen.getByRole("table")).queryAllByText(/^[+\u2212]?\d\.\d\d$/).length;

describe("backtest maths", () => {
  it("replays the same random stream for the same seed", () => {
    const first = Array.from({ length: 6 }, mulberry32(42));
    expect(Array.from({ length: 6 }, mulberry32(42))).toEqual(first);
    expect(Array.from({ length: 6 }, mulberry32(43))).not.toEqual(first);
    first.forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    });
  });

  it("builds a seeded random walk with no drift and about 16% yearly volatility", () => {
    const market = createMarket(7);
    expect(createMarket(7).prices).toEqual(market.prices);
    expect(createMarket(8).prices).not.toEqual(market.prices);
    expect(market.prices).toHaveLength(HISTORY + DAYS + 1);
    expect(market.start).toBe(HISTORY);
    expect(market.split).toBe(Math.round(DAYS * IN_SAMPLE_SHARE));
    expect(market.prices.every((price) => price > 0)).toBe(true);

    let sum = 0;
    let squares = 0;
    let count = 0;
    for (let seed = 1; seed <= 50; seed += 1) {
      const { prices } = createMarket(seed);
      for (let i = 1; i < prices.length; i += 1) {
        const move = prices[i] / prices[i - 1] - 1;
        sum += move;
        squares += move * move;
        count += 1;
      }
    }
    const mean = sum / count;
    const volatility = Math.sqrt(squares / count - mean * mean) * Math.sqrt(TRADING_DAYS);
    expect(Math.abs(mean)).toBeLessThan(1e-4);
    expect(volatility).toBeGreaterThan(0.15);
    expect(volatility).toBeLessThan(0.17);
  });

  it("averages trailing windows and decides from past closes only", () => {
    expect(Array.from(movingAverage([1, 2, 3, 4, 5], 2))).toEqual([NaN, 1.5, 2.5, 3.5, 4.5]);

    const market = createMarket(3);
    const cut = market.start + 1000;
    const changed = new Float64Array(market.prices);
    for (let i = cut + 1; i < changed.length; i += 1) changed[i] *= 1.5;
    const before = crossoverSignal(market.prices, 10, 50);
    const after = crossoverSignal(changed, 10, 50);
    expect(Array.from(after.subarray(0, cut + 1))).toEqual(Array.from(before.subarray(0, cut + 1)));
  });

  it("trades on the close after a signal and charges every buy and sell", () => {
    // fast 1 / slow 2 means "long after an up day"; worked through by hand.
    const market: Market = {
      seed: 0,
      prices: Float64Array.from([10, 10, 11, 12, 11, 10, 10, 12]),
      start: 1,
      days: 6,
      split: 3,
    };
    const run = backtest(market, { fast: 1, slow: 2, costBps: 100 });
    expect(Array.from(run.positions)).toEqual([0, 1, 1, 0, 0, 0]);
    expect(run.trades).toBe(2);
    expect(run.gross[1]).toBeCloseTo(12 / 11 - 1, 12);
    expect(run.gross[2]).toBeCloseTo(11 / 12 - 1, 12);
    expect(run.grossEquity[6]).toBeCloseTo(1, 12);
    expect(run.netEquity[6]).toBeCloseTo(0.99 * 0.99, 12);
    expect(run.costPaid).toBeCloseTo(0.01 + 0.01 * 0.99, 12);
    expect(run.exposure).toBeCloseTo(2 / 6, 12);
  });

  it("makes costs the only gap between the before and after curves", () => {
    const market = createMarket(11);
    const free = backtest(market, { fast: 10, slow: 50, costBps: 0 });
    const paid = backtest(market, { fast: 10, slow: 50, costBps: 25 });
    expect(free.netEquity).toEqual(free.grossEquity);
    expect(paid.trades).toBe(free.trades);
    let changes = 0;
    let held = 0;
    paid.positions.forEach((position) => {
      if (position !== held) changes += 1;
      held = position;
    });
    expect(paid.trades).toBe(changes);
    expect(paid.netEquity[market.days]).toBeCloseTo(
      free.grossEquity[market.days] * (1 - 0.0025) ** paid.trades,
      10,
    );
  });

  it("annualises Sharpe with √252 and measures drawdown from the running peak", () => {
    expect(sharpe([0.02, 0])).toBeCloseTo((0.01 / Math.sqrt(0.0002)) * Math.sqrt(252), 10);
    expect(sharpe([5, 5, 0.02, 0], 2, 4)).toBeCloseTo(sharpe([0.02, 0]), 12);
    expect(sharpe([0.01, -0.01, 0.01, -0.01])).toBeCloseTo(0, 12);
    expect(sharpe([0, 0, 0])).toBe(0);
    expect(maxDrawdown([1, 1.2, 0.9, 1.1, 0.6, 1.3])).toBeCloseTo(-0.5, 12);
    expect(maxDrawdown([1, 1.1, 1.2])).toBe(0);
  });

  it("sweeps the 41-pair grid and picks on in-sample numbers alone", () => {
    const pairs = sweepPairs();
    expect(pairs).toHaveLength(41);
    expect(pairs.every(({ fast, slow }) => fast < slow)).toBe(true);
    expect(pairs).toContainEqual({ fast: 5, slow: 50 });
    expect(pairs).not.toContainEqual({ fast: 50, slow: 50 });

    const market = createMarket(5);
    const sweep = runSweep(market, 10);
    const top = Math.max(...sweep.cells.map((cell) => cell.inSample));
    expect(sweep.cells[sweep.best].inSample).toBe(top);
    const cell = sweep.cells[7];
    const direct = summarise(market, backtest(market, { fast: cell.fast, slow: cell.slow, costBps: 10 }));
    expect(cell.inSample).toBeCloseTo(direct.sharpeIn, 12);
    expect(cell.outOfSample).toBeCloseTo(direct.sharpeOut, 12);

    // Rewriting every price after the split changes nothing the pick could see.
    const changed: Market = { ...market, prices: new Float64Array(market.prices) };
    for (let i = market.start + market.split + 1; i < changed.prices.length; i += 1) {
      changed.prices[i] *= 0.7 + 0.05 * (i % 13);
    }
    const again = runSweep(changed, 10);
    expect(again.cells.map((c) => c.inSample)).toEqual(sweep.cells.map((c) => c.inSample));
    expect(again.best).toBe(sweep.best);
    expect(again.cells.map((c) => c.outOfSample)).not.toEqual(sweep.cells.map((c) => c.outOfSample));
  });

  it("usually finds that the in-sample winner does worse on the unseen years", () => {
    const entries = Array.from({ length: 60 }, (_, i) => {
      const { sweep, best } = bestOf(i + 1);
      return { inSample: best.inSample, outOfSample: best.outOfSample, rank: sweep.bestOutOfSampleRank };
    });
    const score = tally(entries);
    expect(score.total).toBe(60);
    expect(score.worse / score.total).toBeGreaterThan(0.6);
    expect(score.meanInSample - score.meanOutOfSample).toBeGreaterThan(0.25);
    // Out of sample the winner lands mid-table, like a random pick (21st of 41).
    expect(score.meanRank).toBeGreaterThan(14);
    expect(score.meanRank).toBeLessThan(28);
  });

  it("tallies how often the winner fell back", () => {
    const score = tally([
      { inSample: 1, outOfSample: 0.2, rank: 30 },
      { inSample: 0.1, outOfSample: 0.5, rank: 2 },
    ]);
    expect(score.worse).toBe(1);
    expect(score.total).toBe(2);
    expect(score.meanInSample).toBeCloseTo(0.55, 12);
    expect(score.meanOutOfSample).toBeCloseTo(0.35, 12);
    expect(score.meanRank).toBe(16);
    expect(tally([])).toMatchObject({ worse: 0, total: 0, meanInSample: 0, meanOutOfSample: 0 });
  });
});

describe("AxiomQuant demo", () => {
  it("labels every control and says plainly that the prices are random", () => {
    render(<AxiomQuantDemo seed={1} />);
    expect(screen.getByRole("region", { name: "AxiomQuant demo" })).toBeInTheDocument();
    const fast = screen.getByRole("slider", { name: "Fast average" });
    expect(fast).toHaveValue("20");
    expect(fast).toHaveAttribute("aria-valuetext", "20 days");
    expect(screen.getByRole("slider", { name: "Slow average" })).toHaveValue("100");
    expect(screen.getByRole("slider", { name: "Cost per trade" })).toHaveAttribute(
      "aria-valuetext",
      "10 basis points",
    );
    expect(screen.getByText(/random walk with no drift/)).toBeInTheDocument();
    expect(screen.getByText(/none of these numbers are AxiomQuant's results/)).toHaveTextContent(
      "Not investment advice.",
    );
    expect(screen.getByRole("img", { name: /^Growth of 100 over ten years/ })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: /run the sweep to fill this in/ })).toBeInTheDocument();
  });

  it("shows readouts that match the backtest for the chosen rule", () => {
    render(<AxiomQuantDemo seed={1} />);
    const market = createMarket(1);
    const expected = summarise(market, backtest(market, { fast: 20, slow: 100, costBps: 10 }));
    expect(readout("Trades")).toBe(String(expected.trades));
    expect(shown(readout("Costs paid")) / 100).toBeCloseTo(expected.costPaid, 3);
    expect(shown(readout("Sharpe in sample"))).toBeCloseTo(expected.sharpeIn, 2);
    expect(shown(readout("Sharpe out of sample"))).toBeCloseTo(expected.sharpeOut, 2);
    expect(shown(readout("Max drawdown")) / 100).toBeCloseTo(expected.maxDrawdown, 3);
  });

  it("keeps the fast average shorter than the slow one and reads out the result once settled", () => {
    vi.useFakeTimers();
    render(<AxiomQuantDemo seed={1} />);
    const fast = screen.getByRole("slider", { name: "Fast average" });
    const slow = screen.getByRole("slider", { name: "Slow average" });
    fireEvent.change(slow, { target: { value: "15" } });
    expect(fast).toHaveValue("14");
    fireEvent.change(fast, { target: { value: "60" } });
    expect(slow).toHaveValue("61");
    expect(screen.queryByText(/^Market 1, fast 60/)).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(screen.getByText(/^Market 1, fast 60 and slow 61 days at 10 basis points/)).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("fills the heatmap cell by cell, then reveals the winner", () => {
    vi.useFakeTimers();
    render(<AxiomQuantDemo seed={2} />);
    fireEvent.click(screen.getByRole("button", { name: "Run the sweep" }));
    expect(filledCells()).toBe(0);
    const step = (times: number, ms: number) => {
      for (let i = 0; i < times; i += 1) {
        act(() => {
          vi.advanceTimersByTime(ms);
        });
      }
    };
    step(10, 45);
    expect(filledCells()).toBe(10);
    const busy = screen.getByRole("button", { name: "Sweeping…" });
    expect(busy).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(busy);
    expect(filledCells()).toBe(10);
    step(31, 45);
    expect(filledCells()).toBe(41);
    expect(screen.queryByText(/^Highest in sample ·/)).not.toBeInTheDocument();
    step(1, 700);
    const { best } = bestOf(2);
    expect(screen.getByText(`Highest in sample · fast ${best.fast} / slow ${best.slow}`)).toBeInTheDocument();
  });

  it("shows end states at once when motion is paused, and counts each market", () => {
    setMotionPaused(true);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    render(<AxiomQuantDemo seed={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Run the sweep" }));

    const first = bestOf(1);
    expect(filledCells()).toBe(41);
    expect(within(screen.getByRole("table")).getByText("(highest in sample)")).toBeInTheDocument();
    expect(screen.getByText(`Highest in sample · fast ${first.best.fast} / slow ${first.best.slow}`)).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Fast average" })).toHaveValue(String(first.best.fast));
    expect(screen.getByRole("slider", { name: "Slow average" })).toHaveValue(String(first.best.slow));
    const firstWorse = first.best.outOfSample < first.best.inSample ? 1 : 0;
    expect(screen.getByText(/did worse out of sample in/)).toHaveTextContent(`in ${firstWorse} of 1 market.`);
    expect(screen.getByText(/^Sweep finished\./)).toHaveAttribute("aria-live", "polite");

    fireEvent.click(screen.getByRole("button", { name: "Out of sample" }));
    expect(screen.getByRole("button", { name: "Out of sample" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("table", { name: "Out-of-sample Sharpe after 10 bps costs" })).toBeInTheDocument();

    // A new market (seed 1 + floor(0.5 × 9999) = 5000) clears the sweep but keeps the tally.
    fireEvent.click(screen.getByRole("button", { name: "New market" }));
    expect(screen.getByText("Market 02")).toBeInTheDocument();
    expect(screen.getByText(/Seed 5000/)).toBeInTheDocument();
    expect(screen.queryByText(/^Highest in sample ·/)).not.toBeInTheDocument();
    expect(screen.getByText(/did worse out of sample in/)).toHaveTextContent("of 1 market.");
    fireEvent.click(screen.getByRole("button", { name: "Run the sweep" }));

    const second = bestOf(5000);
    const worse = firstWorse + (second.best.outOfSample < second.best.inSample ? 1 : 0);
    expect(screen.getByText(/did worse out of sample in/)).toHaveTextContent(`in ${worse} of 2 markets.`);
    const meanRank = Math.round((first.sweep.bestOutOfSampleRank + second.sweep.bestOutOfSampleRank) / 2);
    expect(screen.getByText(/^Average winner:/)).toHaveTextContent(
      new RegExp(`ranked ${meanRank}(st|nd|rd|th) of 41 there; a random pick averages 21st\\.`),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("flags a sweep made at an old cost, and Reset starts over", () => {
    setMotionPaused(true);
    render(<AxiomQuantDemo seed={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Run the sweep" }));
    fireEvent.change(screen.getByRole("slider", { name: "Cost per trade" }), { target: { value: "30" } });
    expect(screen.getByText(/This sweep used 10 bps a trade; the cost is now 30 bps/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run the sweep again" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("slider", { name: "Fast average" })).toHaveValue("20");
    expect(screen.getByRole("slider", { name: "Slow average" })).toHaveValue("100");
    expect(screen.getByRole("slider", { name: "Cost per trade" })).toHaveValue("10");
    expect(screen.getByText("Market 01")).toBeInTheDocument();
    expect(screen.getByText(/^Empty so far\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run the sweep" })).toBeInTheDocument();
  });
});

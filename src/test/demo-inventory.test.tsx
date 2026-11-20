import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { setMotionPaused } from "@/lib/motion-pause";
import InventoryDemo from "@/sites/ordo/demos/InventoryDemo";
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
  mulberry32,
  poisson,
  randomPolicy,
  runEpisode,
  sSPolicy,
  step,
  totals,
  type InventoryConfig,
  type ShopState,
} from "@/sites/ordo/demos/inventory";

afterEach(() => {
  cleanup();
  setMotionPaused(false);
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const ruleFor = (difficulty: keyof typeof TUNED) => sSPolicy(TUNED[difficulty].s, TUNED[difficulty].S);
const shop = (stock: number, pipeline: number[] = [], t = 0, weekday = 0): ShopState => ({ t, weekday, stock, pipeline });
const readout = (label: string) =>
  screen.getByText(label, { selector: "dt" }).nextElementSibling?.firstChild?.textContent?.trim();

describe("inventory environment", () => {
  it("keeps the project's three configs and tuned (s, S) pairs", () => {
    expect(CONFIGS.easy).toMatchObject({ leadTime: 0, seasonality: 0, fixedCost: 5 });
    expect(CONFIGS.medium).toMatchObject({ leadTime: 2, seasonality: 0, fixedCost: 5 });
    expect(CONFIGS.hard).toMatchObject({ leadTime: 4, seasonality: 0.5, fixedCost: 20 });
    for (const key of DIFFICULTIES) {
      expect(CONFIGS[key]).toMatchObject({
        demandMean: 4,
        maxOrder: 20,
        holdingCost: 1,
        stockoutPenalty: 10,
        unitCost: 2,
        horizon: 100,
      });
    }
    expect(TUNED).toEqual({ easy: { s: 3, S: 9 }, medium: { s: 12, S: 18 }, hard: { s: 17, S: 29 } });
    expect(demandRate(CONFIGS.hard, 0)).toBeCloseTo(4, 12);
    expect(demandRate(CONFIGS.hard, 2)).toBeCloseTo(4 * (1 + 0.5 * Math.sin((4 * Math.PI) / 7)), 12);
    expect(demandRate(CONFIGS.medium, 2)).toBe(4);
  });

  it("draws the same scenario for the same seed, and a different one otherwise", () => {
    const first = createScenario("hard", 42);
    expect(createScenario("hard", 42)).toEqual(first);
    expect(createScenario("hard", 43).demands).not.toEqual(first.demands);
    expect(first.demands).toHaveLength(100);
    expect(first.demands.every((d) => Number.isInteger(d) && d >= 0)).toBe(true);
    for (let seed = 1; seed <= 200; seed += 1) {
      for (const key of DIFFICULTIES) {
        const s = createScenario(key, seed);
        expect(s.initialStock).toBeGreaterThanOrEqual(0);
        expect(s.initialStock).toBeLessThanOrEqual(8 * (CONFIGS[key].leadTime + 1));
        expect(s.startWeekday).toBeGreaterThanOrEqual(0);
        expect(s.startWeekday).toBeLessThanOrEqual(6);
      }
    }
    // Same seed, same policy: the whole trajectory replays exactly.
    const scenario = createScenario("medium", 9);
    expect(runEpisode(scenario, ruleFor("medium"))).toEqual(runEpisode(createScenario("medium", 9), ruleFor("medium")));
  });

  it("samples Poisson demand with the right mean and variance", () => {
    const random = mulberry32(7);
    const draws = Array.from({ length: 40000 }, () => poisson(random, 4));
    const mean = draws.reduce((a, b) => a + b, 0) / draws.length;
    const variance = draws.reduce((a, b) => a + (b - mean) ** 2, 0) / draws.length;
    expect(mean).toBeGreaterThan(3.95);
    expect(mean).toBeLessThan(4.05);
    expect(variance).toBeGreaterThan(3.85);
    expect(variance).toBeLessThan(4.15);
    expect(poisson(random, 0)).toBe(0);
  });

  it("delivers an order after exactly L days", () => {
    for (const leadTime of [0, 1, 2, 4]) {
      const config: InventoryConfig = { ...CONFIGS.easy, leadTime };
      let state = shop(0, new Array(leadTime).fill(0));
      const arrivals: number[] = [];
      for (let t = 0; t <= leadTime + 1; t += 1) {
        const next = step(config, state, t === 0 ? 7 : 0, 0);
        arrivals.push(next.record.arrived);
        state = next.state;
      }
      expect(arrivals.indexOf(7)).toBe(leadTime);
      expect(arrivals.filter((units) => units > 0)).toEqual([7]);
    }
    // The pipeline shifts by one each day and today's order joins the back.
    const { state } = step(CONFIGS.hard, shop(3, [1, 2, 3, 4]), 9, 0);
    expect(state.pipeline).toEqual([2, 3, 4, 9]);
    expect(state.stock).toBe(4);
  });

  it("loses unmet demand instead of backordering it", () => {
    const first = step(CONFIGS.easy, shop(3), 0, 7);
    expect(first.record).toMatchObject({ sales: 3, lost: 4, stockEnd: 0, stockoutCost: 40, holdingCost: 0 });
    // Nothing is owed the next day: a quiet day with fresh stock sells nothing extra.
    const second = step(CONFIGS.easy, first.state, 5, 0);
    expect(second.record).toMatchObject({ sales: 0, lost: 0, stockEnd: 5 });
  });

  it("charges h · stock_end + p · lost + K · [q > 0] + c · q", () => {
    // Medium: 5 on the shelf, 2 arriving today; order 6 and meet 4 customers.
    const { record } = step(CONFIGS.medium, shop(5, [2, 0]), 6, 4);
    expect(record).toMatchObject({
      arrived: 2,
      sales: 4,
      lost: 0,
      stockEnd: 3,
      holdingCost: 3,
      stockoutCost: 0,
      orderCost: 5 + 2 * 6,
      cost: 3 + 17,
    });
    // A hand-worked three days on easy: arrival, a stock-out, then holding only.
    const config = CONFIGS.easy;
    let state = shop(2);
    const costs: number[] = [];
    for (const [order, demand] of [
      [4, 5],
      [0, 3],
      [10, 2],
    ]) {
      const next = step(config, state, order, demand);
      costs.push(next.record.cost);
      state = next.state;
    }
    // Day 1: 6 on hand, 5 sold, 1 left: 1 + 0 + 5 + 8. Day 2: 1 sold, 2 lost: 0 + 20. Day 3: 10 in, 2 sold: 8 + 5 + 20.
    expect(costs).toEqual([14, 20, 33]);
    expect(() => step(config, state, 21, 0)).toThrow(RangeError);
    expect(() => step(config, state, 2.5, 0)).toThrow(RangeError);
  });

  it("orders up to S on the inventory position once it falls to s", () => {
    const medium = ruleFor("medium");
    expect(medium(shop(13), CONFIGS.medium)).toBe(0);
    expect(medium(shop(12), CONFIGS.medium)).toBe(6);
    // The pipeline counts: 4 on the shelf and 8 on the way is a position of 12.
    expect(inventoryPosition(shop(4, [5, 3]))).toBe(12);
    expect(medium(shop(4, [5, 3]), CONFIGS.medium)).toBe(6);
    expect(medium(shop(4, [5, 4]), CONFIGS.medium)).toBe(0);
    // Hard: from an empty position the jump to S = 29 is capped at 20.
    expect(ruleFor("hard")(shop(0, [0, 0, 0, 0]), CONFIGS.hard)).toBe(20);
    expect(ruleFor("easy")(shop(3), CONFIGS.easy)).toBe(6);
  });

  it("runs 100-day episodes whose costs match the project's published averages", () => {
    for (const key of DIFFICULTIES) {
      const seeds = Array.from({ length: 200 }, (_, i) => i + 1);
      const costs = seeds.map((seed) => totals(runEpisode(createScenario(key, seed), ruleFor(key))).total);
      costs.forEach((cost) => {
        expect(cost).toBeGreaterThan(1000);
        expect(cost).toBeLessThan(3500);
      });
      const mean = costs.reduce((a, b) => a + b, 0) / costs.length;
      expect(Math.abs(mean - PUBLISHED[key].sS) / PUBLISHED[key].sS).toBeLessThan(0.03);

      const randomMean =
        seeds.slice(0, 20).reduce((sum, seed) => sum + totals(runEpisode(createScenario(key, seed), randomPolicy(seed))).total, 0) / 20;
      expect(randomMean).toBeGreaterThan(PUBLISHED[key].random * 0.9);
      expect(randomMean).toBeLessThan(PUBLISHED[key].random * 1.1);
    }
  });

  it("keeps the running totals and the cumulative line consistent", () => {
    const records = runEpisode(createScenario("hard", 3), ruleFor("hard"));
    const sum = totals(records);
    const line = cumulativeCost(records);
    expect(line).toHaveLength(101);
    expect(line[100]).toBe(sum.total);
    expect(sum.holding + sum.stockout + sum.ordering).toBe(sum.total);
    expect(sum.sales + sum.lost).toBe(sum.demand);
    expect(totals(records, 10).total).toBe(line[10]);
    expect(initialState(createScenario("hard", 3)).pipeline).toEqual([0, 0, 0, 0]);
  });
});

describe("Inventory demo", () => {
  it("labels the controls and states what is simplified", () => {
    render(<InventoryDemo seed={7} />);
    expect(screen.getByRole("region", { name: "Inventory RL demo" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Day 1 of 100" })).toBeInTheDocument();
    const slider = screen.getByRole("slider", { name: "Today's order" });
    expect(slider).toHaveValue("0");
    expect(slider).toHaveAttribute("aria-valuetext", "0 units");
    expect(screen.getByRole("button", { name: /^Medium/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("spinbutton", { name: "Scenario" })).toHaveValue(7);
    expect(screen.getByText(/PPO is not run in your browser/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /^Cumulative cost after 0 days/ })).toBeInTheDocument();
    expect(screen.getByText(/Deliveries take 2 days/)).toBeInTheDocument();
  });

  it("plays a day with the chosen order and matches the environment", () => {
    render(<InventoryDemo seed={7} />);
    const scenario = createScenario("medium", 7);
    fireEvent.change(screen.getByRole("slider", { name: "Today's order" }), { target: { value: "6" } });
    expect(screen.getByText("Costs 5 + 2 × 6 = 17 today")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next day" }));

    const { record, state } = step(CONFIGS.medium, initialState(scenario), 6, scenario.demands[0]);
    expect(screen.getByRole("heading", { name: "Day 2 of 100" })).toBeInTheDocument();
    expect(readout("Total cost")).toBe(String(record.cost));
    expect(screen.getByText(/^Day 1: ordered 6/)).toHaveAttribute("aria-live", "polite");
    // Today's order sits at the back of the pipeline.
    expect(state.pipeline).toEqual([0, 6]);
    expect(screen.getByText("in 1d").previousElementSibling).toHaveTextContent("6");
    expect(screen.getByText("today").previousElementSibling).toHaveTextContent("0");

    // Enter on the slider plays the next day.
    const slider = screen.getByRole("slider", { name: "Today's order" });
    fireEvent.keyDown(slider, { key: "Enter" });
    expect(screen.getByRole("heading", { name: "Day 3 of 100" })).toBeInTheDocument();
  });

  it("shows the rule's order on request", () => {
    render(<InventoryDemo seed={7} />);
    const scenario = createScenario("medium", 7);
    const expected = ruleFor("medium")(initialState(scenario), CONFIGS.medium);
    fireEvent.click(screen.getByRole("button", { name: "Show the rule's order" }));
    expect(screen.getByRole("button", { name: "Show the rule's order" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/^\(s, S\) would order/)).toHaveTextContent(
      expected > 0 ? `(s, S) would order ${expected}:` : "(s, S) would order nothing",
    );
  });

  it("lets the rule finish the shop and ranks the visitor", () => {
    render(<InventoryDemo seed={11} difficulty="hard" />);
    fireEvent.click(screen.getByRole("button", { name: "Rule plays the rest" }));
    const ruleTotal = totals(runEpisode(createScenario("hard", 11), ruleFor("hard"))).total;
    expect(screen.getByText("Day 100 · the shop closes")).toBeInTheDocument();
    // The rule played every day for the visitor, so the costs are identical.
    expect(screen.getByText("A dead heat with the textbook rule.")).toBeInTheDocument();
    expect(screen.getByText(/so this was the rule racing itself\./)).toBeInTheDocument();
    const ranking = screen.getByRole("list", { name: "Ranking on these customers" });
    expect(within(ranking).getAllByRole("listitem")).toHaveLength(3);
    expect(within(ranking).getAllByRole("listitem")[0]).toHaveTextContent(`1You${ruleTotal.toLocaleString("en-GB")}`);
    expect(screen.getByText(/PPO averaged 2,361 ± 44.1 on hard over 30/)).toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: "Today's order" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Replay these customers" }));
    expect(screen.getByRole("heading", { name: "Day 1 of 100" })).toBeInTheDocument();
  });

  it("states the rule's winning margin when the visitor never orders", () => {
    render(<InventoryDemo seed={5} difficulty="easy" />);
    for (let i = 0; i < 100; i += 1) fireEvent.click(screen.getByRole("button", { name: "Next day" }));
    const scenario = createScenario("easy", 5);
    const yours = totals(runEpisode(scenario, () => 0)).total;
    const rule = totals(runEpisode(scenario, ruleFor("easy"))).total;
    expect(yours).toBeGreaterThan(rule);
    expect(screen.getByText(/^The textbook rule won by/)).toHaveTextContent(
      `The textbook rule won by ${(yours - rule).toLocaleString("en-GB")}`,
    );
    expect(screen.getByText(/^Day 100, the shop closes/)).toHaveAttribute("aria-live", "polite");
    // A hundred rendered days: allow for a busy machine.
  }, 20_000);

  it("runs the autopilot on a timer, pauses it, and rests while the tab is hidden", () => {
    vi.useFakeTimers();
    render(<InventoryDemo seed={3} />);
    fireEvent.click(screen.getByRole("button", { name: "Autopilot" }));
    for (let i = 0; i < 3; i += 1) {
      act(() => {
        vi.advanceTimersByTime(260);
      });
    }
    expect(screen.getByRole("heading", { name: "Day 4 of 100" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next day" })).toBeDisabled();

    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByRole("heading", { name: "Day 4 of 100" })).toBeInTheDocument();

    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    act(() => {
      vi.advanceTimersByTime(260);
    });
    expect(screen.getByRole("heading", { name: "Day 5 of 100" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pause autopilot" }));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByRole("heading", { name: "Day 5 of 100" })).toBeInTheDocument();
    // Autopilot days follow the rule, so the visitor's cost still equals the rule's.
    expect(readout("Total cost")).toBe(
      String(cumulativeCost(runEpisode(createScenario("medium", 3), ruleFor("medium")))[4]),
    );
  });

  it("keeps the autopilot off while the page's motion is paused", () => {
    vi.useFakeTimers();
    setMotionPaused(true);
    render(<InventoryDemo seed={3} />);
    expect(screen.getByRole("button", { name: "Autopilot" })).toBeDisabled();
    expect(screen.getByText(/Motion is paused on this page/)).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByRole("heading", { name: "Day 1 of 100" })).toBeInTheDocument();
  });

  it("switches difficulty and scenario, and Reset starts over without a network call", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    render(<InventoryDemo seed={7} />);
    fireEvent.click(screen.getByRole("button", { name: "Next day" }));
    fireEvent.click(screen.getByRole("button", { name: /^Hard/ }));
    expect(screen.getByRole("button", { name: /^Hard/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Day 1 of 100" })).toBeInTheDocument();
    expect(screen.getByText(/Deliveries take 4 days; demand swings ±50% over the week/)).toBeInTheDocument();
    const pipeline = screen.getByRole("list", { name: /^Deliveries on the way/ });
    expect(within(pipeline).getAllByRole("listitem")).toHaveLength(5);
    expect(within(pipeline).getAllByRole("listitem")[4]).toHaveTextContent("in 4d (today's order)");

    fireEvent.change(screen.getByRole("spinbutton", { name: "Scenario" }), { target: { value: "123" } });
    expect(screen.getByRole("spinbutton", { name: "Scenario" })).toHaveValue(123);
    fireEvent.click(screen.getByRole("button", { name: "New scenario" }));
    // 1 + floor(0.5 × 9999) = 5000.
    expect(screen.getByRole("spinbutton", { name: "Scenario" })).toHaveValue(5000);

    fireEvent.click(screen.getByRole("button", { name: /^Easy/ }));
    expect(screen.getByText(/No lead time/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("button", { name: /^Medium/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("spinbutton", { name: "Scenario" })).toHaveValue(7);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

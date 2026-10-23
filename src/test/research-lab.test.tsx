import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { memoryStrategies } from "@/data/portfolio";
import { setMotionPaused } from "@/lib/motion-pause";
import {
  LAST_TURN,
  MEMORY_RECORDS,
  MemoryLab,
  RetryLab,
  STRATEGY_IDS,
  TOY_QUEUE,
  audienceCheck,
  boundaryF,
  contextCells,
  estimateTokens,
  memoryContext,
  memoryView,
  netImprovement,
  promptText,
  queueOutcome,
  retryRegion,
  shouldRetry,
  summaryAt,
  toneCheck,
  type StrategyId,
} from "@/sites/ordo/components/ResearchLab";

afterEach(() => {
  cleanup();
  setMotionPaused(false);
  vi.useRealTimers();
});

const checks = (id: StrategyId, turn: number) => {
  const context = memoryContext(id, turn);
  return [audienceCheck(context).state, toneCheck(context).state];
};

describe("memory model", () => {
  it("reproduces the data file's final turn for every strategy", () => {
    expect(STRATEGY_IDS).toEqual(memoryStrategies.map((strategy) => strategy.id));
    for (const strategy of memoryStrategies) {
      const context = memoryContext(strategy.id as StrategyId, LAST_TURN);
      expect(context.sent).toEqual(strategy.sends);
      expect(context.summary).toBe(strategy.summary);
      expect(context.records.map((record) => record.label)).toEqual(strategy.records);
    }
  });

  it("derives earlier turns by rule", () => {
    expect(memoryContext("full", 4).sent).toEqual([1, 2, 3, 4]);
    expect(memoryContext("window", 4).sent).toEqual([1, 2, 3, 4]);
    expect(memoryContext("window", 8).sent).toEqual([3, 4, 5, 6, 7, 8]);
    expect(memoryContext("summary", 5)).toMatchObject({ sent: [4, 5], summarised: [1, 2, 3] });
    expect(memoryContext("adaptive", 9).sent).toEqual([4, 5, 6, 7, 8, 9]);
  });

  it("grows the rolling summary as older messages are folded in", () => {
    expect(summaryAt(2)).toBeNull();
    expect(summaryAt(3)).toBe("Formal lesson on photosynthesis.");
    expect(summaryAt(5)).toBe("Formal lesson on photosynthesis for school students, friendly tone.");
    expect(summaryAt(8)).toBe(
      "Formal lesson on photosynthesis for school students, friendly tone, quiz.",
    );
  });

  it("records a revision at once and other constraints as they leave the window", () => {
    const labels = (turn: number) =>
      memoryContext("adaptive", turn).records.map((record) => record.label);
    const [task, audience, tone, quiz] = MEMORY_RECORDS.map((record) => record.label);
    expect(labels(2)).toEqual([]);
    expect(labels(3)).toEqual([tone]);
    expect(labels(6)).toEqual([tone]);
    expect(labels(7)).toEqual([task, tone]);
    expect(labels(9)).toEqual([task, audience, tone]);
    expect(labels(10)).toEqual([task, audience, tone]);
    expect(labels(11)).toEqual([task, audience, tone, quiz]);
  });

  it("marks recorded and superseded messages in the adaptive row", () => {
    const cells = contextCells(memoryContext("adaptive", LAST_TURN));
    expect(cells.filter((cell) => cell.recorded).map((cell) => cell.id)).toEqual([1, 3, 5]);
    expect(cells.filter((cell) => cell.superseded).map((cell) => cell.id)).toEqual([1]);
    expect(cells.filter((cell) => cell.state === "sent").map((cell) => cell.id)).toEqual([
      6, 7, 8, 9, 10, 11,
    ]);
    expect(contextCells(memoryContext("summary", 5)).map((cell) => cell.state)).toEqual([
      "summarised",
      "summarised",
      "summarised",
      "sent",
      "sent",
      ...Array(6).fill("future"),
    ]);
  });

  it("estimates prompt size from the text sent", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
    for (const id of STRATEGY_IDS) {
      const view = memoryView(id, LAST_TURN);
      expect(view.tokens).toBe(Math.ceil(promptText(view.lines).length / 4));
    }
    const tokens = (id: StrategyId) => memoryView(id, LAST_TURN).tokens;
    expect(tokens("full")).toBeGreaterThan(tokens("adaptive"));
    expect(tokens("adaptive")).toBeGreaterThan(tokens("window"));
    expect(tokens("window")).toBeGreaterThan(tokens("summary"));
    // Early on the records cost more than they save: nothing hides this.
    expect(memoryView("adaptive", 3).tokens).toBeGreaterThan(memoryView("full", 3).tokens);
  });

  it("computes both checks from what each strategy sends", () => {
    expect(checks("full", 2)).toEqual(["pending", "pending"]);
    expect(checks("full", LAST_TURN)).toEqual(["pass", "fail"]);
    expect(checks("window", 6)).toEqual(["pass", "fail"]);
    expect(checks("window", 8)).toEqual(["pass", "pass"]);
    expect(checks("window", 9)).toEqual(["fail", "pass"]);
    expect(checks("summary", 4)).toEqual(["pass", "fail"]);
    expect(checks("summary", LAST_TURN)).toEqual(["pass", "fail"]);
    expect(checks("adaptive", 4)).toEqual(["pass", "pass"]);
    expect(checks("adaptive", LAST_TURN)).toEqual(["pass", "pass"]);
    expect(toneCheck(memoryContext("summary", LAST_TURN)).text).toBe(
      "Old tone kept · summary says formal",
    );
  });
});

describe("retry model", () => {
  it("applies the proposal's rule", () => {
    expect(netImprovement(0.7, 0.4, 0.05)).toBeCloseTo(0.085);
    expect(shouldRetry({ c: 0.7, f: 0.4, b: 0.05, k: 0.1 })).toBe(false);
    expect(shouldRetry({ c: 0.5, f: 0.4, b: 0.05, k: 0.1 })).toBe(true);
    // 0.3 × 0.45 − 0.7 × 0.05 is exactly 0.10: a tie returns, despite floating point.
    expect(shouldRetry({ c: 0.7, f: 0.45, b: 0.05, k: 0.1 })).toBe(false);
  });

  it("puts the boundary where the improvement equals the cost", () => {
    for (const c of [0, 0.3, 0.6]) {
      expect(netImprovement(c, boundaryF(c, 0.05, 0.1), 0.05)).toBeCloseTo(0.1);
    }
    expect(boundaryF(1, 0.05, 0.1)).toBe(Infinity);
    const region = retryRegion(0.05, 0.1);
    expect(region[0]).toEqual([0, 0.1]);
    expect(region[region.length - 2][1]).toBeCloseTo(1);
    expect(region[region.length - 1]).toEqual([0, 1]);
    expect(retryRegion(0.05, 1)).toEqual([]);
  });

  it("keeps the toy queue honest about the trade-off", () => {
    const never = queueOutcome(TOY_QUEUE, 0.05, 0.1, "never");
    const rule = queueOutcome(TOY_QUEUE, 0.05, 0.1, "rule");
    const always = queueOutcome(TOY_QUEUE, 0.05, 0.1, "always");
    expect(never).toMatchObject({ retries: 0, spend: 0, fixed: 0, broken: 0, net: 0 });
    expect(rule.retries).toBe(5);
    expect(always.retries).toBe(TOY_QUEUE.length);
    // Always retrying fixes more but costs more; the rule spends less for most of the gain.
    expect(always.right).toBeGreaterThan(rule.right);
    expect(always.spend).toBeGreaterThan(rule.spend);
    expect(always.broken).toBeGreaterThan(rule.broken);
  });

  it("only beats the baselines by construction when the estimates are exact", () => {
    for (const b of [0, 0.05, 0.2, 0.5]) {
      for (const k of [0, 0.1, 0.3, 0.5]) {
        const rule = queueOutcome(TOY_QUEUE, b, k, "rule").net;
        expect(rule).toBeGreaterThanOrEqual(queueOutcome(TOY_QUEUE, b, k, "always").net - 1e-9);
        expect(rule).toBeGreaterThanOrEqual(-1e-9);
      }
    }
  });
});

describe("MemoryLab", () => {
  const row = (name: string) => screen.getByRole("button", { name });

  it("scrubs the conversation and recomputes each strategy's checks", async () => {
    render(<MemoryLab />);
    const slider = screen.getByRole("slider", { name: "Turn" });
    expect(slider).toHaveValue(String(LAST_TURN));
    expect(row("Last 6 messages")).toHaveAccessibleDescription(
      /does not know the audience: message 3 is not sent/,
    );
    expect(row("Adaptive memory")).toHaveAccessibleDescription(
      /Sends messages 6 to 11 plus 4 records.*record of message 3.*marks the old formal tone as superseded/,
    );

    fireEvent.change(slider, { target: { value: "8" } });
    expect(row("Last 6 messages")).toHaveAccessibleDescription(/knows the audience: message 3 is sent/);
    fireEvent.click(screen.getByRole("button", { name: "Next turn" }));
    expect(slider).toHaveValue("9");
    expect(row("Last 6 messages")).toHaveAccessibleDescription(/does not know the audience/);
    expect(
      await screen.findByText(/^Turn 9 of 11\. User: Describe the leaf diagram in words\./),
    ).toBeInTheDocument();

    fireEvent.change(slider, { target: { value: "1" } });
    expect(screen.getByRole("button", { name: "Previous turn" })).toBeDisabled();
    expect(row("Full history")).toHaveAccessibleDescription(/audience is not stated until message 3/);
  });

  it("shows what the selected strategy would send", () => {
    render(<MemoryLab />);
    const transcript = () => screen.getByRole("figure", { name: /What the model would see/ });
    expect(row("Adaptive memory")).toHaveAttribute("aria-pressed", "true");
    for (const label of MEMORY_RECORDS.map((record) => record.label)) {
      expect(transcript()).toHaveTextContent(label);
    }
    expect(transcript()).toHaveTextContent("Not sent: #1–#5");

    fireEvent.click(row("Rolling summary"));
    expect(row("Rolling summary")).toHaveAttribute("aria-pressed", "true");
    expect(row("Adaptive memory")).toHaveAttribute("aria-pressed", "false");
    const summary = memoryStrategies.find((strategy) => strategy.id === "summary")?.summary ?? "";
    expect(transcript()).toHaveTextContent(summary);
    expect(transcript()).toHaveTextContent("Folded into the summary: #1–#9");
    expect(transcript()).not.toHaveTextContent("Tone: friendly");
    expect(screen.getByText(/Whether adaptive memory pays for itself is what the study will test/)).toBeInTheDocument();
  });

  it("plays a turn every 1.2 seconds and stops for the page-wide pause", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    render(<MemoryLab />);
    const slider = screen.getByRole("slider", { name: "Turn" });
    fireEvent.click(screen.getByRole("button", { name: "Play the conversation" }));
    expect(slider).toHaveValue("1");
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(slider).toHaveValue("2");
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(slider).toHaveValue("3");

    act(() => setMotionPaused(true));
    act(() => {
      vi.advanceTimersByTime(3600);
    });
    expect(slider).toHaveValue("3");
    expect(screen.getByRole("button", { name: "Play the conversation" })).toBeDisabled();
    expect(screen.getByText(/Autoplay is off/)).toBeInTheDocument();
    // Transitions and enter animations switch off too, not only the timer.
    expect(
      screen.getByRole("region", { name: "What each memory strategy would send" }),
    ).toHaveAttribute("data-still");
  });
});

describe("RetryLab", () => {
  const slider = (name: RegExp) => screen.getByRole("slider", { name });

  it("works the rule through with the live numbers", () => {
    render(<RetryLab />);
    const decision = screen.getByRole("group", { name: "Decision" });
    const equation = screen.getByRole("group", { name: "Worked equation" });
    expect(decision).toHaveTextContent("Return");
    expect(equation).toHaveTextContent("= (1 − 0.70) × 0.40 − 0.70 × 0.05");
    expect(equation).toHaveTextContent("0.120");
    expect(equation).toHaveTextContent("0.035");
    expect(equation).toHaveTextContent("Retry if 0.085 > k = 0.10: no");

    fireEvent.change(slider(/Chance the first answer is right/), { target: { value: "50" } });
    expect(decision).toHaveTextContent("Retry");
    expect(equation).toHaveTextContent("Retry if 0.175 > k = 0.10: yes");
    expect(screen.getByRole("img", { name: "Decision map" })).toHaveAccessibleDescription(
      /c 0\.50 and f 0\.40, is in the Retry area/,
    );

    fireEvent.change(slider(/Retry cost/), { target: { value: "20" } });
    expect(decision).toHaveTextContent("Return");
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(slider(/Retry cost/)).toHaveValue("10");
    expect(screen.getByText(/Toy numbers that only illustrate the rule/)).toBeInTheDocument();
  });

  it("marks which toy questions would retry and compares the policies", () => {
    render(<RetryLab />);
    const totals = screen.getByRole("table", { name: /Toy queue totals/ });
    const policy = (name: RegExp) => within(totals).getByRole("row", { name });
    expect(policy(/Never retry/)).toHaveTextContent("0/10");
    expect(policy(/This rule/)).toHaveTextContent("5/10");
    expect(policy(/Always retry/)).toHaveTextContent("10/10");
    expect(screen.getByRole("button", { name: /^Q3 .*Retry$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Q1 .*Return$/ })).toBeInTheDocument();

    // A cost above every toy question's net improvement stops the rule retrying.
    fireEvent.change(slider(/Retry cost/), { target: { value: "50" } });
    expect(policy(/This rule/)).toHaveTextContent("0/10");
    expect(policy(/Always retry/)).toHaveTextContent("10/10");

    fireEvent.click(screen.getByRole("button", { name: /^Q3 / }));
    expect(slider(/Chance the first answer is right/)).toHaveValue("50");
    expect(slider(/Chance a retry fixes a wrong answer/)).toHaveValue("62");
    expect(screen.getByRole("button", { name: /^Q3 / })).toHaveAttribute("aria-pressed", "true");
  });
});

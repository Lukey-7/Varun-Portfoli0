import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { memoryConversation, memoryStrategies } from "@/data/portfolio";
import { setMotionPaused } from "@/lib/motion-pause";
import { CyanResearch } from "@/sites/cyan/components/CyanSections";
import { approxTokens, contextCost, savingPercent } from "@/sites/cyan/components/tokens";

// framer-motion reads the media query once per module, so a test sets this instead.
const reduced = vi.hoisted(() => ({ value: false }));
vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => reduced.value,
}));

beforeAll(() => {
  class Observer {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("IntersectionObserver", Observer);
  vi.stubGlobal("ResizeObserver", Observer);
});

afterEach(() => {
  cleanup();
  reduced.value = false;
  setMotionPaused(false);
});

// Read from disk: the test runner turns imported stylesheets into empty ones.
const css = readFileSync(resolve(__dirname, "../sites/cyan/cyan.css"), "utf8");

const strategyById = (id: string) => memoryStrategies.find((strategy) => strategy.id === id)!;
/** The same sum, written out from the raw data, so the helper is not checked against itself. */
const expectedSent = (id: string) => {
  const strategy = strategyById(id);
  const chars = (text: string) => Math.ceil(text.length / 4);
  return (
    memoryConversation.filter((m) => (strategy.sends as readonly number[]).includes(m.id)).reduce((n, m) => n + chars(m.text), 0) +
    strategy.records.reduce((n, record) => n + chars(record), 0) +
    (strategy.summary ? chars(strategy.summary) : 0)
  );
};
const expectedFull = memoryConversation.reduce((n, m) => n + Math.ceil(m.text.length / 4), 0);
const outputText = (container: HTMLElement) => container.querySelector("output")!.textContent;
const pick = (name: RegExp) => fireEvent.click(screen.getByRole("radio", { name }));
const gaugeParts = (container: HTMLElement) => ({
  root: container.querySelector<HTMLElement>(".context-gauge")!,
  fill: container.querySelector<HTMLElement>(".context-gauge-fill")!,
});

describe("approxTokens", () => {
  it("is characters divided by four, rounded up", () => {
    expect(approxTokens("abcd")).toBe(1);
    expect(approxTokens("abcde")).toBe(2);
    expect(approxTokens("a")).toBe(1);
    expect(approxTokens("")).toBe(0);
    expect(approxTokens("x".repeat(400))).toBe(100);
  });
});

describe("contextCost", () => {
  it("counts every message for the full-history strategy, so sent equals full", () => {
    const full = strategyById("full");
    expect(full.sends).toHaveLength(11);
    const cost = contextCost(full);
    expect(cost.sent).toBe(cost.full);
    expect(cost.full).toBe(expectedFull);
  });

  it("counts the sent messages, the records and the summary against the whole conversation", () => {
    for (const strategy of memoryStrategies) {
      expect(contextCost(strategy)).toEqual({ sent: expectedSent(strategy.id), full: expectedFull });
    }
  });

  it("adds the summary on top of the messages it still sends", () => {
    const summary = strategyById("summary");
    const messagesOnly = contextCost({ ...summary, summary: null }).sent;
    expect(contextCost(summary).sent).toBe(messagesOnly + approxTokens(summary.summary!));
  });

  it("adds each record on top of the messages the adaptive policy still sends", () => {
    const adaptive = strategyById("adaptive");
    const messagesOnly = contextCost({ ...adaptive, records: [] }).sent;
    const records = adaptive.records.reduce((n, record) => n + approxTokens(record), 0);
    expect(records).toBeGreaterThan(0);
    expect(contextCost(adaptive).sent).toBe(messagesOnly + records);
  });

  it("sends fewer tokens than the full history when messages are dropped", () => {
    const { full } = contextCost(strategyById("full"));
    expect(contextCost(strategyById("window")).sent).toBeLessThan(full);
    expect(contextCost(strategyById("summary")).sent).toBeLessThan(full);
  });
});

describe("savingPercent", () => {
  it("is the share of the full history left out, rounded to a whole percent", () => {
    expect(savingPercent({ sent: 25, full: 100 })).toBe(75);
    expect(savingPercent({ sent: 100, full: 100 })).toBe(0);
    expect(savingPercent({ sent: 1, full: 3 })).toBe(67);
  });

  it("never goes below zero when a strategy sends more than the full history", () => {
    expect(savingPercent({ sent: 120, full: 100 })).toBe(0);
  });

  it("is zero for an empty history rather than not-a-number", () => {
    expect(savingPercent({ sent: 0, full: 0 })).toBe(0);
  });
});

describe("Context gauge in the research lab", () => {
  it("states what the chosen strategy sends against the full history", () => {
    const { container } = render(<CyanResearch />);
    // The lab opens on "Last 6 messages".
    const sent = expectedSent("window");
    const saving = Math.round((1 - sent / expectedFull) * 100);
    expect(outputText(container)).toBe(`≈ ${sent} of ${expectedFull} tokens · ${saving}% fewer`);
  });

  it("changes the reading when a different strategy is chosen, and keeps the caption", () => {
    const { container } = render(<CyanResearch />);
    const before = outputText(container);

    pick(/Full history/);
    expect(outputText(container)).toBe(`≈ ${expectedFull} of ${expectedFull} tokens · 0% fewer`);
    expect(outputText(container)).not.toBe(before);

    pick(/Rolling summary/);
    const sent = expectedSent("summary");
    expect(outputText(container)).toBe(
      `≈ ${sent} of ${expectedFull} tokens · ${Math.round((1 - sent / expectedFull) * 100)}% fewer`,
    );

    expect(screen.getByText("Rough estimate: characters ÷ 4. Illustration, not a measured result.")).toBeInTheDocument();
    expect(screen.getByText("Illustration of the research question. Not a measured result.")).toBeInTheDocument();
  });

  it("sits inside the context panel beside the existing caption, with the rest of the panel intact", () => {
    const { container } = render(<CyanResearch />);
    const panel = container.querySelector(".memory-context")!;
    expect(panel.contains(container.querySelector("output"))).toBe(true);
    expect(panel.querySelector(".context-gauge")).toBeInTheDocument();
    expect(panel.querySelectorAll(".memory-chip").length).toBeGreaterThan(0);
    expect(panel.textContent).toContain(strategyById("window").note);
    expect(screen.getByRole("radiogroup", { name: "Memory strategy" })).toBeInTheDocument();
  });

  it("sizes the bar to the share of the full history that is sent", () => {
    const { container } = render(<CyanResearch />);
    const width = () => gaugeParts(container).fill.style.width;
    pick(/Full history/);
    expect(width()).toBe("100%");
    pick(/Last 6 messages/);
    const share = (expectedSent("window") / expectedFull) * 100;
    expect(parseFloat(width())).toBeCloseTo(share, 1);
    expect(parseFloat(width())).toBeLessThan(100);
  });

  it("hides the bar from assistive technology, because the reading says the same in words", () => {
    const { container } = render(<CyanResearch />);
    expect(container.querySelector(".context-gauge-bar")).toHaveAttribute("aria-hidden", "true");
  });

  it("lets the width ease between strategies when motion is allowed", () => {
    const { container } = render(<CyanResearch />);
    expect(gaugeParts(container).root).not.toHaveAttribute("data-still");
  });

  it("drops the width transition under reduced motion", () => {
    reduced.value = true;
    const { container } = render(<CyanResearch />);
    expect(gaugeParts(container).root).toHaveAttribute("data-still");
  });

  it("drops the width transition when the site-wide pause is on, and restores it when it is off", () => {
    const { container } = render(<CyanResearch />);
    act(() => setMotionPaused(true));
    expect(gaugeParts(container).root).toHaveAttribute("data-still");
    act(() => setMotionPaused(false));
    expect(gaugeParts(container).root).not.toHaveAttribute("data-still");
  });
});

describe("Context gauge styles", () => {
  /** Every rule whose selector mentions the gauge. */
  const rules = css.match(/[^{}]*\.context-gauge[^{}]*\{[^}]*\}/g) ?? [];

  it("has styles of its own", () => {
    expect(rules.length).toBeGreaterThan(3);
  });

  it("uses the accent colour and never the amber kept for measurements", () => {
    const text = rules.join("\n");
    expect(text).toContain("var(--accent)");
    expect(text).not.toContain("--phosphor");
  });

  it("switches the width transition off when motion is reduced or paused", () => {
    const stillRule = rules.find((rule) => rule.includes("[data-still]") && rule.includes("transition"));
    expect(stillRule).toMatch(/transition:\s*none/);
    // The media query covers a visitor whose preference changes before the script has run.
    const blocks = mediaBlocks("@media (prefers-reduced-motion: reduce)");
    const gaugeBlock = blocks.find((block) => block.includes(".context-gauge"));
    expect(gaugeBlock).toMatch(/\.context-gauge[^{]*\{[^}]*transition:\s*none/);
  });
});

/** The body of every `@media` block that starts with the given prelude, found by matching braces. */
function mediaBlocks(prelude: string) {
  const found: string[] = [];
  let from = css.indexOf(prelude);
  while (from !== -1) {
    const open = css.indexOf("{", from);
    let depth = 0;
    let end = open;
    for (; end < css.length; end += 1) {
      if (css[end] === "{") depth += 1;
      else if (css[end] === "}" && --depth === 0) break;
    }
    found.push(css.slice(open + 1, end));
    from = css.indexOf(prelude, end);
  }
  return found;
}

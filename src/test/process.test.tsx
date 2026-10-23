import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrdoProcess } from "@/sites/ordo/components/OrdoProcess";
import { setMotionPaused } from "@/lib/motion-pause";

/** Whether the stubbed IntersectionObserver reports the section on screen. */
let onScreen = true;

class FakeIntersectionObserver {
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    this.callback(
      [{ isIntersecting: onScreen, target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const originalMatchMedia = window.matchMedia;
const mockReducedMotion = (reduce: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion: reduce"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
};

const tab = (name: string) => screen.getByRole("tab", { name });
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

beforeEach(() => {
  onScreen = true;
  vi.useFakeTimers();
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
});

afterEach(() => {
  cleanup();
  setMotionPaused(false);
  window.matchMedia = originalMatchMedia;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ORDO process section", () => {
  it("draws the four stages as one tablist, in loop order", () => {
    render(<OrdoProcess />);
    expect(screen.getByText("[ 04 / PROCESS ]")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /How I ship an AI feature/ })).toBeInTheDocument();

    const list = screen.getByRole("tablist", { name: "Stages of the loop" });
    const tabs = within(list).getAllByRole("tab");
    expect(tabs).toHaveLength(4);
    ["Configure", "Build", "Evaluate", "Deploy"].forEach((name, index) =>
      expect(tabs[index]).toBe(tab(name)),
    );

    const panel = screen.getByRole("tabpanel");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[0]).toHaveAttribute("tabindex", "0");
    tabs.slice(1).forEach((node) => {
      expect(node).toHaveAttribute("aria-selected", "false");
      expect(node).toHaveAttribute("tabindex", "-1");
    });
    tabs.forEach((node) => expect(node).toHaveAttribute("aria-controls", panel.id));
    expect(panel).toHaveAttribute("aria-labelledby", tabs[0].id);

    // Both loop-backs are spelled out, not only drawn.
    expect(screen.getByText(/A change only ships if it beats the baseline/)).toBeInTheDocument();
    expect(
      screen.getByText(/What I learn in production becomes the next requirement/),
    ).toBeInTheDocument();
  });

  it("moves round the loop with the arrow keys, Home and End", () => {
    render(<OrdoProcess />);
    fireEvent.keyDown(tab("Configure"), { key: "ArrowRight" });
    expect(tab("Build")).toHaveAttribute("aria-selected", "true");
    expect(tab("Build")).toHaveFocus();

    fireEvent.keyDown(tab("Build"), { key: "ArrowDown" });
    expect(tab("Evaluate")).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(tab("Evaluate"), { key: "End" });
    expect(tab("Deploy")).toHaveAttribute("aria-selected", "true");

    // Deploy leads back to Configure: a loop, not a line.
    fireEvent.keyDown(tab("Deploy"), { key: "ArrowRight" });
    expect(tab("Configure")).toHaveAttribute("aria-selected", "true");
    expect(tab("Configure")).toHaveFocus();

    fireEvent.keyDown(tab("Configure"), { key: "ArrowUp" });
    expect(tab("Deploy")).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(tab("Deploy"), { key: "Home" });
    expect(tab("Configure")).toHaveAttribute("aria-selected", "true");
    expect(tab("Configure")).toHaveAttribute("tabindex", "0");
    expect(tab("Deploy")).toHaveAttribute("tabindex", "-1");
  });

  it("swaps the stage details and announces them only after a manual choice", () => {
    render(<OrdoProcess />);
    const panel = screen.getByRole("tabpanel");
    const live = panel.querySelector("[aria-live]");
    expect(live).toHaveAttribute("aria-live", "off");
    expect(panel).toHaveTextContent("Agree the contract before the code.");

    fireEvent.click(tab("Evaluate"));
    expect(panel).toHaveAttribute("aria-labelledby", tab("Evaluate").id);
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(within(panel).getByRole("heading", { level: 3 })).toHaveTextContent(
      "Score every change against the baseline.",
    );
    expect(panel).toHaveTextContent("33 labelled queries");
    expect(panel).toHaveTextContent("a development check, not a held-out benchmark");
    expect(panel).toHaveTextContent("37 of 39 book paragraphs");
    expect(screen.getByText("Tour stopped at Evaluate.")).toBeInTheDocument();
  });

  it("tours the loop while on screen and stops when a stage is chosen", () => {
    render(<OrdoProcess />);
    expect(tab("Configure")).toHaveAttribute("aria-selected", "true");

    // The contract takes 5.8 s, then the finished stage holds for 2.4 s.
    advance(9000);
    expect(tab("Build")).toHaveAttribute("aria-selected", "true");
    expect(tab("Configure")).toHaveAttribute("data-status", "passed");

    fireEvent.click(tab("Deploy"));
    advance(60000);
    expect(tab("Deploy")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("every check passed");

    // Resuming hands the finished Deploy stage back to Configure (loop B).
    fireEvent.click(screen.getByRole("button", { name: "Resume tour" }));
    advance(3000);
    expect(tab("Configure")).toHaveAttribute("aria-selected", "true");
  });

  it("waits while the section is off screen", () => {
    onScreen = false;
    render(<OrdoProcess />);
    advance(20000);
    expect(tab("Configure")).toHaveAttribute("aria-selected", "true");
    expect(tab("Configure")).toHaveAttribute("data-status", "ready");
  });

  it("holds still while the page-wide pause is on", () => {
    render(<OrdoProcess />);
    advance(2000);
    act(() => setMotionPaused(true));
    advance(20000);
    expect(tab("Configure")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Paused by the page's animation switch.")).toBeInTheDocument();

    act(() => setMotionPaused(false));
    advance(9000);
    expect(tab("Build")).toHaveAttribute("aria-selected", "true");
  });

  it("shows a stage's result rather than an empty first frame while paused", () => {
    setMotionPaused(true);
    render(<OrdoProcess />);
    expect(screen.getByText("contract ready")).toBeInTheDocument();

    fireEvent.click(tab("Evaluate"));
    expect(screen.getByText("33 / 33")).toBeInTheDocument();
    advance(20000);
    expect(tab("Evaluate")).toHaveAttribute("aria-selected", "true");
  });

  it("keeps a finished stage up while the pointer is over its panel", () => {
    render(<OrdoProcess />);
    fireEvent.pointerEnter(screen.getByRole("tabpanel"));
    advance(15000);
    expect(tab("Configure")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Tour waiting while you read.")).toBeInTheDocument();

    fireEvent.pointerLeave(screen.getByRole("tabpanel"));
    advance(3000);
    expect(tab("Build")).toHaveAttribute("aria-selected", "true");
  });

  it("replays a stage's animation from the start", () => {
    render(<OrdoProcess />);
    advance(6000);
    expect(screen.getByText("contract ready")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Replay the Configure animation" }));
    expect(screen.queryByText("contract ready")).not.toBeInTheDocument();
    expect(screen.getByText("drafting · 0 / 4 fields")).toBeInTheDocument();

    advance(6000);
    expect(screen.getByText("contract ready")).toBeInTheDocument();
    expect(tab("Configure")).toHaveAttribute("aria-selected", "true");
  });

  it("sends Evaluate's misses back to Build before the hybrid run passes the gate", () => {
    const { container } = render(<OrdoProcess />);
    fireEvent.click(tab("Evaluate"));

    advance(2200);
    expect(screen.getByText("27 / 33")).toBeInTheDocument();
    expect(screen.getByText("0.82")).toBeInTheDocument();

    advance(1000);
    expect(screen.getByText("↺ 6 misses go back to Build")).toBeInTheDocument();
    expect(container.querySelectorAll(".proc-cells .proc-cell.is-sent")).toHaveLength(6);
    expect(container.querySelector('.proc-link.is-back[data-on="true"] b')).toHaveTextContent("A");

    advance(4000);
    expect(screen.getByText("33 / 33")).toBeInTheDocument();
    expect(screen.getByText("✓ beats the baseline → 04 Deploy")).toBeInTheDocument();
    expect(container.querySelectorAll(".proc-cells .proc-cell.is-fixed")).toHaveLength(6);
  });

  it("shows every finished artifact and runs no tour under reduced motion", () => {
    mockReducedMotion(true);
    render(<OrdoProcess />);
    const panel = screen.getByRole("tabpanel");
    expect(screen.getByText("contract ready")).toBeInTheDocument();
    expect(panel).toHaveTextContent("Gate passed");
    expect(screen.queryByRole("button", { name: /Replay/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Animations are off/)).toBeInTheDocument();

    advance(30000);
    expect(tab("Configure")).toHaveAttribute("aria-selected", "true");

    fireEvent.click(tab("Build"));
    ["S1", "S2", "B1"].forEach((cite) => expect(screen.getByText(cite)).toBeInTheDocument());
    expect(screen.getByText(/cited answer returned/)).toBeInTheDocument();

    fireEvent.click(tab("Evaluate"));
    expect(screen.getByText("27 / 33")).toBeInTheDocument();
    expect(screen.getByText("33 / 33")).toBeInTheDocument();
    expect(screen.getByText("0.82")).toBeInTheDocument();
    expect(screen.getByText("0.89")).toBeInTheDocument();
    expect(screen.getAllByText("1.00")).toHaveLength(2);

    fireEvent.click(tab("Deploy"));
    expect(screen.getByText("155 passed")).toBeInTheDocument();
    expect(screen.getByText("30 passed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resume tour" })).not.toBeInTheDocument();
  });
});

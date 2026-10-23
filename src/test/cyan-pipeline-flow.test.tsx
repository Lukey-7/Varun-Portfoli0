import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setMotionPaused } from "@/lib/motion-pause";
import { PipelineFlow } from "@/sites/cyan/motion/PipelineFlow";

// The three tabs of the approach section in CyanPage.
const FIND = ["Documents", "Dense + BM25", "Rerank", "Context"];
const CHECK = ["Context", "Generate", "Verify quotes", "Citations"];
const SHIP = ["API", "Tests", "Deploy", "Feedback"];

/** Whether the stubbed IntersectionObserver reports the diagram on screen. */
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

const diagram = (chips: string[]) => screen.getByRole("img", { name: chips.join(" then ") });
const shownLabels = (root: HTMLElement) =>
  Array.from(root.querySelectorAll(".flow-label"), (node) => node.textContent);
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

beforeEach(() => {
  onScreen = true;
  vi.useFakeTimers();
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
});

afterEach(() => {
  cleanup();
  setMotionPaused(false);
  window.matchMedia = originalMatchMedia;
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Cyan pipeline flow", () => {
  it("draws each chip as a module, labelled with the whole pipeline", () => {
    render(<PipelineFlow chips={FIND} step={0} />);
    const root = diagram(FIND);
    expect(root).toHaveAttribute("aria-label", "Documents then Dense + BM25 then Rerank then Context");
    expect(shownLabels(root)).toEqual(FIND);
    FIND.forEach((chip) => expect(screen.getByText(chip)).toBeInTheDocument());

    // Roles that hold for every tab, with the readout on the highlighted stage.
    expect(Array.from(root.querySelectorAll(".flow-role"), (node) => node.textContent)).toEqual([
      "IN",
      "STAGE 02",
      "ACTIVE",
      "OUT",
    ]);
    expect(root.querySelectorAll(".flow-module[data-active]")).toHaveLength(1);
    expect(screen.getByText("Rerank").closest(".flow-module")).toHaveAttribute("data-active");
    expect(screen.getByText("[ILLUSTRATION]")).toBeInTheDocument();

    // On screen with motion allowed, two packets run on each of the three traces.
    expect(root).toHaveAttribute("data-live");
    expect(root).not.toHaveAttribute("data-still");
    const traces = root.querySelectorAll(".flow-trace");
    expect(traces).toHaveLength(3);
    traces.forEach((trace) => expect(trace).toHaveAttribute("aria-hidden", "true"));
    expect(root.querySelectorAll(".flow-packet")).toHaveLength(6);
  });

  it("scrambles the old labels out and decodes the new ones in when the tab changes", () => {
    const frame = vi.spyOn(window, "requestAnimationFrame");
    const { rerender } = render(<PipelineFlow chips={FIND} step={0} />);
    expect(frame).not.toHaveBeenCalled();
    rerender(<PipelineFlow chips={CHECK} step={1} />);
    // The decode is the only scripted motion, and it runs only for the transition.
    expect(frame).toHaveBeenCalled();

    // Assistive technology gets the new pipeline at once.
    const root = diagram(CHECK);
    expect(root).toHaveAttribute("data-phase", "out");
    advance(120);
    const scrambling = shownLabels(root);
    expect(scrambling).not.toEqual(FIND);
    expect(scrambling.map((text) => text?.length)).toEqual(FIND.map((chip) => chip.length));

    // After 240ms the new labels arrive as noise and the route is traced again.
    advance(140);
    expect(root).toHaveAttribute("data-phase", "in");
    expect(shownLabels(root)).not.toEqual(CHECK);
    expect(root.querySelectorAll(".flow-route")).toHaveLength(3);
    expect(screen.queryByText("Generate")).not.toBeInTheDocument();

    // Within 700ms in all, the new pipeline reads in full.
    advance(460);
    expect(root).not.toHaveAttribute("data-phase");
    expect(shownLabels(root)).toEqual(CHECK);
    CHECK.forEach((chip) => expect(screen.getByText(chip)).toBeInTheDocument());
    expect(screen.queryByText("Documents")).not.toBeInTheDocument();
    expect(screen.getByText("Verify quotes").closest(".flow-module")).toHaveAttribute("data-active");
    expect(root.querySelectorAll(".flow-route")).toHaveLength(0);
  });

  it("lands on the latest tab when the visitor clicks through quickly", () => {
    const { rerender } = render(<PipelineFlow chips={FIND} step={0} />);
    rerender(<PipelineFlow chips={CHECK} step={1} />);
    advance(100);
    rerender(<PipelineFlow chips={SHIP} step={2} />);
    advance(400);
    rerender(<PipelineFlow chips={FIND} step={0} />);
    advance(800);

    const root = diagram(FIND);
    expect(root).not.toHaveAttribute("data-phase");
    expect(shownLabels(root)).toEqual(FIND);
  });

  it("renders a still, composed frame under reduced motion", () => {
    mockReducedMotion(true);
    const frame = vi.spyOn(window, "requestAnimationFrame");
    const { rerender } = render(<PipelineFlow chips={FIND} step={0} />);

    const root = diagram(FIND);
    expect(root).toHaveAttribute("data-still");
    expect(root).not.toHaveAttribute("data-live");
    const packets = root.querySelectorAll(".flow-packet");
    expect(packets).toHaveLength(3);
    packets.forEach((packet) => expect(packet).toHaveAttribute("data-parked"));
    expect(screen.getByText("Rerank").closest(".flow-module")).toHaveAttribute("data-active");

    // Another tab swaps the labels at once, without a scramble or animation frames.
    rerender(<PipelineFlow chips={SHIP} step={2} />);
    const next = diagram(SHIP);
    expect(next).not.toHaveAttribute("data-phase");
    expect(shownLabels(next)).toEqual(SHIP);
    expect(frame).not.toHaveBeenCalled();
  });

  it("parks the packets while motion is paused site-wide", () => {
    const { rerender } = render(<PipelineFlow chips={FIND} step={0} />);
    const root = diagram(FIND);
    expect(root.querySelectorAll(".flow-packet")).toHaveLength(6);

    act(() => setMotionPaused(true));
    expect(root).toHaveAttribute("data-still");
    expect(root).not.toHaveAttribute("data-live");
    expect(root.querySelectorAll(".flow-packet[data-parked]")).toHaveLength(3);
    rerender(<PipelineFlow chips={CHECK} step={1} />);
    expect(root).not.toHaveAttribute("data-phase");
    expect(shownLabels(root)).toEqual(CHECK);

    act(() => setMotionPaused(false));
    expect(root).toHaveAttribute("data-live");
    expect(root.querySelectorAll(".flow-packet")).toHaveLength(6);
  });

  it("holds its motion off screen and in a hidden tab", () => {
    onScreen = false;
    const { rerender, unmount } = render(<PipelineFlow chips={FIND} step={0} />);
    const root = diagram(FIND);
    expect(root).not.toHaveAttribute("data-live");
    expect(root).not.toHaveAttribute("data-still");
    // Nobody is watching, so a new tab swaps straight in.
    rerender(<PipelineFlow chips={SHIP} step={2} />);
    expect(root).not.toHaveAttribute("data-phase");
    expect(shownLabels(root)).toEqual(SHIP);
    unmount();

    onScreen = true;
    render(<PipelineFlow chips={FIND} step={0} />);
    const visible = diagram(FIND);
    expect(visible).toHaveAttribute("data-live");
    const hidden = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(visible).not.toHaveAttribute("data-live");
    hidden.mockRestore();
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(visible).toHaveAttribute("data-live");
  });
});

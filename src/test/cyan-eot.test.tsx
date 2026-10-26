import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { setMotionPaused } from "@/lib/motion-pause";
import CyanPage from "@/sites/cyan/CyanPage";
import { EndOfTransmission, pageReadyMs } from "@/sites/cyan/motion/EndOfTransmission";

// framer-motion reads the media query once per module, so a test sets this instead.
const reduced = vi.hoisted(() => ({ value: false }));
vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => reduced.value,
}));

/** An IntersectionObserver the test can fire by hand. */
const observers: FakeObserver[] = [];
class FakeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(private callback: IntersectionObserverCallback) {
    observers.push(this);
  }
  fire(isIntersecting = true) {
    this.callback([{ isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}
class QuietObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const LABEL = "END OF TRANSMISSION";
const MEASURE = "page ready in 412 ms";

/** Make the page report that DOMContentLoaded finished after `ms` milliseconds, or give no entry at all. */
function stubNavigation(ms: number | null) {
  vi.spyOn(performance, "getEntriesByType").mockImplementation((type: string) =>
    type === "navigation" && ms !== null ? [{ domContentLoadedEventEnd: ms } as unknown as PerformanceEntry] : [],
  );
}

/** Fake only the timers; faking `performance` as well would hide the navigation timing the test stubs. */
const fakeTimers = () => vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout"] });

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  stubNavigation(412.4);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  reduced.value = false;
  setMotionPaused(false);
});

const root = (container: HTMLElement) => container.querySelector<HTMLElement>(".eot")!;
const typed = (container: HTMLElement, line: "label" | "measure") =>
  container.querySelector(`.eot-${line} .eot-typed`)?.textContent ?? null;
const rest = (container: HTMLElement, line: "label" | "measure") =>
  container.querySelector(`.eot-${line} .eot-rest`)?.textContent ?? null;
const trace = (container: HTMLElement) => container.querySelector<SVGPathElement>(".eot-trace")!;

describe("pageReadyMs", () => {
  it("is null when the page has no navigation entry", () => {
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([]);
    expect(pageReadyMs()).toBeNull();
  });

  it("rounds when DOMContentLoaded finished, read from the navigation entry", () => {
    const spy = vi
      .spyOn(performance, "getEntriesByType")
      .mockReturnValue([{ domContentLoadedEventEnd: 412.4 } as unknown as PerformanceEntry]);
    expect(pageReadyMs()).toBe(412);
    expect(spy).toHaveBeenCalledWith("navigation");
  });

  it("is null when the value is 0, or one it cannot use", () => {
    // 0.3 rounds to 0, which would read "page ready in 0 ms".
    for (const value of [0, 0.3, undefined, Number.NaN, -3, Number.POSITIVE_INFINITY]) {
      vi.spyOn(performance, "getEntriesByType").mockReturnValue([
        { domContentLoadedEventEnd: value } as unknown as PerformanceEntry,
      ]);
      expect(pageReadyMs()).toBeNull();
    }
  });

  it("is null when the timing API throws", () => {
    vi.spyOn(performance, "getEntriesByType").mockImplementation(() => {
      throw new Error("no timing here");
    });
    expect(pageReadyMs()).toBeNull();
  });
});

describe("EndOfTransmission, once the sign-off is complete", () => {
  it("shows the full text at once when motion is paused", () => {
    setMotionPaused(true);
    const { container } = render(<EndOfTransmission />);
    expect(screen.getByText(LABEL, { selector: ".eot-typed" })).toBeInTheDocument();
    expect(typed(container, "label")).toBe(LABEL);
    expect(rest(container, "label")).toBe("");
    expect(root(container)).toHaveAttribute("data-still");
    expect(root(container)).toHaveAttribute("data-state", "done");
  });

  it("shows the measurement beside it, rounded, in its own element", () => {
    setMotionPaused(true);
    const { container } = render(<EndOfTransmission />);
    expect(typed(container, "measure")).toBe(MEASURE);
    expect(rest(container, "measure")).toBe("");
  });

  it("shows the full text at once under reduced motion", () => {
    reduced.value = true;
    const { container } = render(<EndOfTransmission />);
    expect(typed(container, "label")).toBe(LABEL);
    expect(typed(container, "measure")).toBe(MEASURE);
    expect(root(container)).toHaveAttribute("data-still");
    expect(root(container)).toHaveAttribute("data-state", "done");
  });

  it("leaves the measurement out when the page cannot report one", () => {
    stubNavigation(null);
    setMotionPaused(true);
    const { container } = render(<EndOfTransmission />);
    expect(typed(container, "label")).toBe(LABEL);
    expect(container.querySelector(".eot-measure")).toBeNull();
    expect(container).not.toHaveTextContent(/page ready/);
  });

  it("leaves the measurement out when the value is 0", () => {
    stubNavigation(0);
    setMotionPaused(true);
    const { container } = render(<EndOfTransmission />);
    expect(container.querySelector(".eot-measure")).toBeNull();
  });

  it("draws the whole trace and never sets up an observer when it is still", () => {
    setMotionPaused(true);
    const { container } = render(<EndOfTransmission />);
    expect(trace(container).style.strokeDashoffset).toBe("0");
    expect(observers).toHaveLength(0);
  });

  it("shows the full text at once when the browser has no IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container } = render(<EndOfTransmission />);
    expect(typed(container, "label")).toBe(LABEL);
    expect(typed(container, "measure")).toBe(MEASURE);
    expect(trace(container).style.strokeDashoffset).toBe("0");
  });

  it("gives a screen reader each line once, as real text, and hides the typed copy", () => {
    setMotionPaused(true);
    const { container } = render(<EndOfTransmission />);
    expect(screen.getByText(LABEL, { selector: ".sr-only" })).toBeInTheDocument();
    expect(screen.getByText(MEASURE, { selector: ".sr-only" })).toBeInTheDocument();
    expect(container.querySelector(".eot-label .eot-typed")!.closest("[aria-hidden='true']")).not.toBeNull();
    expect(container.querySelector(".eot-measure .eot-typed")!.closest("[aria-hidden='true']")).not.toBeNull();
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
  });
});

describe("EndOfTransmission, typing out when it scrolls into view", () => {
  it("waits, empty but with its room kept, until the sign-off is in view", () => {
    const { container } = render(<EndOfTransmission />);
    expect(observers).toHaveLength(1);
    expect(observers[0].observe).toHaveBeenCalledWith(root(container));
    expect(root(container)).toHaveAttribute("data-state", "idle");
    expect(root(container)).not.toHaveAttribute("data-still");
    expect(typed(container, "label")).toBe("");
    // The untyped text keeps the line's width, so nothing moves when it types.
    expect(rest(container, "label")).toBe(LABEL);
    expect(rest(container, "measure")).toBe(MEASURE);
    expect(trace(container).style.strokeDashoffset).toBe("1");
    // A screen reader still has the sign-off.
    expect(screen.getByText(LABEL, { selector: ".sr-only" })).toBeInTheDocument();
  });

  it("ignores an observer report that says it is not in view", () => {
    const { container } = render(<EndOfTransmission />);
    act(() => observers[0].fire(false));
    expect(root(container)).toHaveAttribute("data-state", "idle");
    expect(observers[0].disconnect).not.toHaveBeenCalled();
  });

  it("types the label, then the measurement, then stops", () => {
    fakeTimers();
    const { container } = render(<EndOfTransmission />);
    act(() => observers[0].fire());
    expect(root(container)).toHaveAttribute("data-state", "typing");
    expect(trace(container).style.strokeDashoffset).toBe("0");

    act(() => {
      vi.advanceTimersByTime(100);
    });
    const part = typed(container, "label")!;
    expect(part.length).toBeGreaterThan(0);
    expect(part.length).toBeLessThan(LABEL.length);
    expect(LABEL.startsWith(part)).toBe(true);
    // Typed text and the text still to come always add up to the whole line.
    expect(part + rest(container, "label")).toBe(LABEL);
    expect(typed(container, "measure")).toBe("");

    // The measurement waits for the label to finish.
    let sawLabelDone = false;
    for (let i = 0; i < 400 && root(container).getAttribute("data-state") !== "done"; i++) {
      act(() => {
        vi.advanceTimersByTime(10);
      });
      if (typed(container, "label") === LABEL) sawLabelDone = true;
      if (typed(container, "measure") !== "") expect(typed(container, "label")).toBe(LABEL);
    }
    expect(sawLabelDone).toBe(true);
    expect(root(container)).toHaveAttribute("data-state", "done");
    expect(typed(container, "label")).toBe(LABEL);
    expect(typed(container, "measure")).toBe(MEASURE);
    expect(rest(container, "measure")).toBe("");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("runs once: it stops watching, and a later report does not restart it", () => {
    fakeTimers();
    const { container } = render(<EndOfTransmission />);
    act(() => observers[0].fire());
    expect(observers[0].disconnect).toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(root(container)).toHaveAttribute("data-state", "done");
    act(() => observers[0].fire());
    expect(root(container)).toHaveAttribute("data-state", "done");
    expect(typed(container, "label")).toBe(LABEL);
    expect(observers).toHaveLength(1);
  });

  it("completes at once if the visitor pauses motion part-way through", () => {
    fakeTimers();
    const { container } = render(<EndOfTransmission />);
    act(() => observers[0].fire());
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(typed(container, "label")!.length).toBeLessThan(LABEL.length);
    act(() => setMotionPaused(true));
    expect(typed(container, "label")).toBe(LABEL);
    expect(typed(container, "measure")).toBe(MEASURE);
    expect(root(container)).toHaveAttribute("data-still");
    expect(root(container)).toHaveAttribute("data-state", "done");
    expect(trace(container).style.strokeDashoffset).toBe("0");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("completes at once if the visitor pauses motion before it is in view, and stays complete", () => {
    const { container } = render(<EndOfTransmission />);
    act(() => setMotionPaused(true));
    expect(typed(container, "label")).toBe(LABEL);
    expect(root(container)).toHaveAttribute("data-state", "done");
    expect(observers[0].disconnect).toHaveBeenCalled();
    act(() => setMotionPaused(false));
    expect(typed(container, "label")).toBe(LABEL);
    expect(root(container)).toHaveAttribute("data-state", "done");
    expect(observers).toHaveLength(1);
  });

  it("keeps the finished sign-off, and does not replay it, when motion resumes", () => {
    setMotionPaused(true);
    const { container } = render(<EndOfTransmission />);
    act(() => setMotionPaused(false));
    expect(root(container)).not.toHaveAttribute("data-still");
    expect(root(container)).toHaveAttribute("data-state", "done");
    expect(typed(container, "label")).toBe(LABEL);
    expect(typed(container, "measure")).toBe(MEASURE);
    expect(trace(container).style.strokeDashoffset).toBe("0");
    expect(observers).toHaveLength(0);
  });

  it("stops listening for the scroll if it is removed first", () => {
    const { unmount } = render(<EndOfTransmission />);
    unmount();
    expect(observers[0].disconnect).toHaveBeenCalled();
  });

  it("types nothing more after it is removed", () => {
    fakeTimers();
    const { unmount } = render(<EndOfTransmission />);
    act(() => observers[0].fire());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("EndOfTransmission and the load time", () => {
  // At first render the page is usually still parsing, and DOMContentLoaded has not finished.
  const whileLoading = () => vi.spyOn(document, "readyState", "get").mockReturnValue("interactive");
  const finishLoading = (ms: number) => {
    stubNavigation(ms);
    act(() => {
      window.dispatchEvent(new Event("load"));
    });
  };

  it("shows the measurement once the page has loaded, if it was not known before", () => {
    whileLoading();
    stubNavigation(0);
    setMotionPaused(true);
    const { container } = render(<EndOfTransmission />);
    expect(container.querySelector(".eot-measure")).toBeNull();
    finishLoading(587.6);
    expect(typed(container, "measure")).toBe("page ready in 588 ms");
    expect(typed(container, "label")).toBe(LABEL);
  });

  it("types a measurement that arrives after the label has finished", () => {
    fakeTimers();
    whileLoading();
    stubNavigation(null);
    const { container } = render(<EndOfTransmission />);
    act(() => observers[0].fire());
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(typed(container, "label")).toBe(LABEL);
    expect(root(container)).toHaveAttribute("data-state", "done");
    finishLoading(300);
    expect(root(container)).toHaveAttribute("data-state", "typing");
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(typed(container, "measure")).toBe("page ready in 300 ms");
    expect(root(container)).toHaveAttribute("data-state", "done");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reads the figure again if the page finished loading between the first render and the effect", () => {
    // The first read, while rendering, finds nothing. By the time the effect runs the page is
    // complete, so no `load` event will ever come and the effect has to read it for itself.
    vi.spyOn(document, "readyState", "get").mockReturnValue("complete");
    const listen = vi.spyOn(window, "addEventListener");
    vi.spyOn(performance, "getEntriesByType")
      .mockReturnValueOnce([])
      .mockReturnValue([{ domContentLoadedEventEnd: 412.4 } as unknown as PerformanceEntry]);
    setMotionPaused(true);
    const { container } = render(<EndOfTransmission />);
    expect(typed(container, "measure")).toBe(MEASURE);
    expect(root(container)).toHaveAttribute("data-state", "done");
    expect(listen).not.toHaveBeenCalledWith("load", expect.anything(), expect.anything());
  });

  it("leaves the measurement out, and does not loop, if a complete page still reports nothing", () => {
    vi.spyOn(document, "readyState", "get").mockReturnValue("complete");
    const read = vi.spyOn(performance, "getEntriesByType").mockReturnValue([]);
    setMotionPaused(true);
    const { container } = render(<EndOfTransmission />);
    expect(container.querySelector(".eot-measure")).toBeNull();
    expect(read.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it("does not wait for a load event that has already happened", () => {
    const listen = vi.spyOn(window, "addEventListener");
    stubNavigation(null);
    setMotionPaused(true);
    render(<EndOfTransmission />);
    expect(listen).not.toHaveBeenCalledWith("load", expect.anything(), expect.anything());
  });
});

describe("end-of-transmission.css", () => {
  const css = readFileSync(resolve(__dirname, "../sites/cyan/motion/end-of-transmission.css"), "utf8");
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, "").split("}");

  it("uses amber for the measurement alone", () => {
    const amber = rules.filter((rule) => /phosphor/.test(rule));
    expect(amber.length).toBeGreaterThan(0);
    for (const rule of amber) expect(rule).toMatch(/\.eot-measure/);
  });

  it("hides the text still to come without changing the line's width", () => {
    expect(css).toMatch(/\.eot-rest\s*\{[^}]*visibility:\s*hidden/);
  });

  it("draws the trace with a transition that the still frame turns off", () => {
    expect(css).toMatch(/\.eot-trace\s*\{[^}]*transition:\s*stroke-dashoffset/);
    expect(css).toMatch(/\.eot\[data-still\][^{]*\{[^}]*transition:\s*none/);
  });

  it("also draws a complete frame under prefers-reduced-motion if script has not run", () => {
    const block = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(block).toMatch(/transition:\s*none/);
    expect(block).toMatch(/stroke-dashoffset:\s*0/);
  });

  it("does not loop anything", () => {
    expect(css).not.toMatch(/infinite/);
  });
});

describe("the footer of the cyan page", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", QuietObserver);
    vi.stubGlobal("ResizeObserver", QuietObserver);
    HTMLCanvasElement.prototype.getContext = () => null;
    Element.prototype.scrollIntoView = () => {};
  });

  const renderFooter = () => {
    render(
      <MemoryRouter>
        <CyanPage />
      </MemoryRouter>,
    );
    return document.querySelector<HTMLElement>(".portfolio-footer")!;
  };

  it("keeps everything it already had", () => {
    const footer = renderFooter();
    expect(footer).toHaveTextContent(`© ${new Date().getFullYear()} Varun Darji`);
    expect(within(footer).getByRole("button", { name: "Press ? for shortcuts" })).toBeInTheDocument();
    expect(within(footer).getByRole("link", { name: "Skill map" })).toHaveAttribute("href", "/vault");
    expect(within(footer).getByRole("link", { name: /Interactive terminal/ })).toHaveAttribute("href", "/terminal");
    expect(within(footer).getByRole("link", { name: /Back to top/ })).toHaveAttribute("href", "#main");
  });

  it("ends with the sign-off", () => {
    const footer = renderFooter();
    const eot = footer.querySelector(".eot")!;
    expect(eot).toBeInTheDocument();
    expect(eot.parentElement).toBe(footer);
    expect(footer.lastElementChild).toBe(eot);
    expect(within(footer).getByText(LABEL, { selector: ".sr-only" })).toBeInTheDocument();
  });

  it("completes the sign-off at once on a page whose motion is paused", () => {
    setMotionPaused(true);
    const footer = renderFooter();
    expect(footer.querySelector(".eot-label .eot-typed")).toHaveTextContent(LABEL);
    expect(footer.querySelector(".eot-measure .eot-typed")).toHaveTextContent(MEASURE);
  });
});

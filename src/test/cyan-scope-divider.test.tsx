import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { githubSnapshot } from "@/data/github-activity";
import { setMotionPaused } from "@/lib/motion-pause";
import { ScopeDivider, githubSeries, type ScopeSeries } from "@/sites/cyan/motion/ScopeDivider";

/** Keeps every live observer, so a test can move the strip in and out of view. */
class FakeIntersectionObserver {
  static live = new Set<FakeIntersectionObserver>();
  targets: Element[] = [];
  constructor(readonly callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.live.add(this);
  }
  observe(target: Element) {
    this.targets.push(target);
  }
  unobserve() {}
  disconnect() {
    FakeIntersectionObserver.live.delete(this);
  }
  takeRecords() {
    return [];
  }
}

const setInView = (isIntersecting: boolean) =>
  act(() => {
    for (const observer of [...FakeIntersectionObserver.live]) {
      const entries = observer.targets.map(
        (target) =>
          ({ target, isIntersecting, intersectionRatio: isIntersecting ? 1 : 0 }) as unknown as IntersectionObserverEntry,
      );
      observer.callback(entries, observer as unknown as IntersectionObserver);
    }
  });

class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

/** jsdom has no PointerEvent; React reads clientX and pointerType from this. */
class FakePointerEvent extends MouseEvent {
  readonly pointerType: string;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerType = init.pointerType ?? "mouse";
  }
}

/** Accepts every call the scope makes on a 2D context. */
function fakeContext() {
  const gradient = { addColorStop: vi.fn() };
  return {
    fillStyle: "#000000",
    strokeStyle: "#000000",
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    setLineDash: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    createRadialGradient: vi.fn(() => gradient),
  };
}

/** Animation frames run only when a test plays them, at a steady 60fps. */
const frames = new Map<number, FrameRequestCallback>();
let frameId = 0;
function playFrames(from: number, to: number) {
  for (let now = from; now <= to; now += 16) {
    const due = [...frames.values()];
    frames.clear();
    due.forEach((callback) => callback(now));
  }
}

const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalMatchMedia = window.matchMedia;
const mockReducedMotion = () => {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("prefers-reduced-motion: reduce"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
};

const calendarFrom = (start: string, counts: number[]) =>
  counts.map((count, index) => ({
    date: new Date(Date.parse(`${start}T00:00:00Z`) + index * 86_400_000).toISOString().slice(0, 10),
    count,
  }));

const sample: ScopeSeries = {
  label: "Test signal",
  unit: "units",
  tag: "[Illustration]",
  points: [
    { date: "2026-09-12", value: 3 },
    { date: "2026-09-13", value: 9 },
    { date: "2026-09-14", value: 5 },
  ],
};

const readout = (container: HTMLElement) => container.querySelector('[aria-live="polite"]')?.textContent;

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  vi.stubGlobal("PointerEvent", FakePointerEvent);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  HTMLCanvasElement.prototype.getContext = (() => fakeContext()) as unknown as HTMLCanvasElement["getContext"];
});

afterEach(() => {
  cleanup();
  frames.clear();
  FakeIntersectionObserver.live.clear();
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  window.matchMedia = originalMatchMedia;
  setMotionPaused(false);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("githubSeries", () => {
  it("sums each day with the six before it, once a week has filled", () => {
    const series = githubSeries(calendarFrom("2026-01-01", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), "2026-01-10T08:30:00.000Z");
    expect(series.points).toEqual([
      { date: "2026-01-07", value: 28 },
      { date: "2026-01-08", value: 35 },
      { date: "2026-01-09", value: 42 },
      { date: "2026-01-10", value: 49 },
    ]);
    expect(series).toMatchObject({
      label: "GitHub contributions",
      unit: "contributions / 7 days",
      tag: "[Snapshot · 10 Jan 2026]",
    });
  });

  it("counts missing days as zero, sorts the calendar and crosses the year end", () => {
    const series = githubSeries([
      { date: "2026-01-03", count: 4 },
      { date: "2025-12-26", count: 2 },
      { date: "2025-12-30", count: 1 },
    ]);
    // 26 Dec to 3 Jan is nine days: 2, 0, 0, 0, 1, 0, 0, 0, 4.
    expect(series.points).toEqual([
      { date: "2026-01-01", value: 3 },
      { date: "2026-01-02", value: 1 },
      { date: "2026-01-03", value: 5 },
    ]);
    // Without fetchedAt, the tag dates the calendar's last day.
    expect(series.tag).toBe("[Snapshot · 3 Jan 2026]");
  });

  it("reports nothing until a whole week is covered", () => {
    expect(githubSeries(calendarFrom("2026-05-01", [5, 5, 5, 5, 5, 5])).points).toEqual([]);
    expect(githubSeries([]).tag).toBe("[Snapshot]");
  });

  it("matches a brute-force sum over the real snapshot", () => {
    const { calendar, fetchedAt } = githubSnapshot;
    const series = githubSeries(calendar, fetchedAt);
    expect(series.points).toHaveLength(calendar.length - 6);
    series.points.forEach((point, index) => {
      const week = calendar.slice(index, index + 7);
      expect(point.date).toBe(week[6].date);
      expect(point.value).toBe(week.reduce((sum, day) => sum + day.count, 0));
    });
    expect(series.tag).toMatch(/^\[Snapshot · \d{1,2} [A-Z][a-z]{2} \d{4}\]$/);
    expect(series.tag).toContain(fetchedAt.slice(0, 4));
  });
});

describe("ScopeDivider", () => {
  it("summarises the GitHub snapshot by default", () => {
    const { container } = render(<ScopeDivider />);
    const expected = githubSeries(githubSnapshot.calendar, githubSnapshot.fetchedAt);
    const peak = expected.points.reduce((best, point) => (point.value > best.value ? point : best));
    const strip = screen.getByRole("group", { name: /^GitHub contributions \(contributions \/ 7 days\), / });
    expect(strip).toHaveAccessibleName(new RegExp(`Highest ${peak.value} on `));
    expect(strip).toHaveAccessibleName(/Snapshot, \d{1,2} [A-Z][a-z]{2} \d{4}\.$/);
    expect(screen.getByText(expected.tag)).toBeInTheDocument();
    expect(container.querySelector("canvas")).toHaveAttribute("aria-hidden", "true");
  });

  it("gives the strip a text equivalent, a key hint and a live readout", () => {
    const { container } = render(<ScopeDivider series={sample} caption="Three readings." />);
    const strip = screen.getByRole("group");
    expect(strip).toHaveAccessibleName(
      "Test signal (units), 12 Sep 2026 to 14 Sep 2026. Highest 9 on 13 Sep 2026; latest 5 on 14 Sep 2026. Illustration.",
    );
    expect(strip).toHaveAccessibleDescription(/left and right arrow keys/);
    expect(strip).toHaveAttribute("tabindex", "0");
    expect(container.querySelector('[aria-live="polite"]')).toBeEmptyDOMElement();
    expect(screen.getByText("Three readings.").tagName).toBe("FIGCAPTION");
  });

  it("moves the read cursor with the keyboard and announces each reading", () => {
    const { container } = render(<ScopeDivider series={sample} />);
    const strip = screen.getByRole("group");
    act(() => strip.focus());
    expect(readout(container)).toBe("14 Sep 2026 · 5 units");
    expect(strip).toHaveAttribute("data-probe", "on");

    expect(fireEvent.keyDown(strip, { key: "ArrowLeft" })).toBe(false);
    expect(readout(container)).toBe("13 Sep 2026 · 9 units");
    fireEvent.keyDown(strip, { key: "Home" });
    expect(readout(container)).toBe("12 Sep 2026 · 3 units");
    fireEvent.keyDown(strip, { key: "ArrowLeft" });
    expect(readout(container)).toBe("12 Sep 2026 · 3 units");
    fireEvent.keyDown(strip, { key: "ArrowRight", shiftKey: true });
    expect(readout(container)).toBe("14 Sep 2026 · 5 units");

    // Page scrolling and browser shortcuts are left alone.
    expect(fireEvent.keyDown(strip, { key: "ArrowDown" })).toBe(true);
    expect(fireEvent.keyDown(strip, { key: "ArrowLeft", altKey: true })).toBe(true);
    expect(readout(container)).toBe("14 Sep 2026 · 5 units");

    fireEvent.keyDown(strip, { key: "Escape" });
    expect(readout(container)).toBe("");
    expect(strip).toHaveAttribute("data-probe", "off");
  });

  it("snaps the read cursor to the point nearest the pointer", () => {
    const { container } = render(<ScopeDivider series={sample} />);
    const strip = screen.getByRole("group");
    // 224px wide with 12px margins: the three points sit 12, 112 and 212px in.
    vi.spyOn(strip, "getBoundingClientRect").mockReturnValue({
      left: 100,
      right: 324,
      top: 0,
      bottom: 130,
      width: 224,
      height: 130,
      x: 100,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    fireEvent.pointerMove(strip, { clientX: 250 });
    expect(readout(container)).toBe("13 Sep 2026 · 9 units");
    fireEvent.pointerMove(strip, { clientX: 270 });
    expect(readout(container)).toBe("14 Sep 2026 · 5 units");
    fireEvent.pointerMove(strip, { clientX: 0 });
    expect(readout(container)).toBe("12 Sep 2026 · 3 units");
    fireEvent.pointerLeave(strip);
    expect(readout(container)).toBe("");
  });

  it("sweeps once on scroll-in, waits off screen, then rests on a still trace", () => {
    vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(800);
    vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(130);
    render(<ScopeDivider series={sample} />);
    const strip = screen.getByRole("group");
    expect(strip).toHaveAttribute("data-sweep", "waiting");

    setInView(true);
    expect(strip).toHaveAttribute("data-sweep", "sweeping");
    playFrames(0, 400);
    setInView(false);
    playFrames(416, 432);
    expect(frames.size).toBe(0);
    expect(strip).toHaveAttribute("data-sweep", "sweeping");

    setInView(true);
    expect(frames.size).toBe(1);
    playFrames(448, 3600);
    expect(strip).toHaveAttribute("data-sweep", "done");
    expect(frames.size).toBe(0);

    // Scrolling back does not replay it.
    setInView(true);
    playFrames(3616, 3632);
    expect(strip).toHaveAttribute("data-sweep", "done");
  });

  it("draws the whole trace at once under reduced motion or the site-wide pause", () => {
    mockReducedMotion();
    const reduced = render(<ScopeDivider series={sample} />);
    expect(screen.getByRole("group")).toHaveAttribute("data-sweep", "done");
    reduced.unmount();

    window.matchMedia = originalMatchMedia;
    render(<ScopeDivider series={sample} />);
    const strip = screen.getByRole("group");
    setInView(true);
    playFrames(0, 160);
    expect(strip).toHaveAttribute("data-sweep", "sweeping");
    setMotionPaused(true);
    playFrames(176, 192);
    expect(strip).toHaveAttribute("data-sweep", "done");
    expect(frames.size).toBe(0);
  });

  it("still reads out values when the browser gives no 2D context", () => {
    HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement["getContext"];
    const { container } = render(<ScopeDivider series={sample} />);
    const strip = screen.getByRole("group");
    act(() => strip.focus());
    expect(readout(container)).toBe("14 Sep 2026 · 5 units");
    expect(strip).not.toHaveAttribute("data-sweep");
  });
});

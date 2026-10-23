import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CyanResultsInstrument } from "@/sites/cyan/motion/EvalMeters";
import { evidence, testCounts } from "@/data/portfolio";
import { setMotionPaused } from "@/lib/motion-pause";

/** Whether the stubbed IntersectionObserver reports its targets on screen. */
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

/** A prefers-reduced-motion query whose answer a test can change later. */
function mockMotionQuery(reduce: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches: reduce,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  };
  window.matchMedia = ((media: string) =>
    media.includes("prefers-reduced-motion")
      ? query
      : { ...query, matches: false, media }) as unknown as typeof window.matchMedia;
  return {
    set(next: boolean) {
      query.matches = next;
      listeners.forEach((listener) => listener());
    },
  };
}

/** What a reader should find in each row, written out rather than recomputed. */
const expected = [
  {
    project: "StudyForge",
    metric: "Recall@1",
    scope: "33 labelled queries",
    before: "0.82",
    after: "1.00",
    delta: "+0.18",
    lit: 40,
  },
  {
    project: "StudyForge",
    metric: "MRR@10",
    scope: "33 labelled queries",
    before: "0.89",
    after: "1.00",
    delta: "+0.11",
    lit: 40,
  },
  {
    project: "MARA",
    metric: "Recall@5",
    scope: "35 queries over 317 chunks, vs dense-only",
    before: "0.857",
    after: "0.929",
    delta: "+0.072",
    lit: 37,
  },
  {
    project: "MARA",
    metric: "MRR@10",
    scope: "35 queries over 317 chunks, vs dense-only",
    before: "0.809",
    after: "0.871",
    delta: "+0.062",
    lit: 34,
  },
];

const rows = () =>
  within(screen.getByRole("list", { name: "Retrieval results" })).getAllByRole("listitem");
const meterOf = (row: HTMLElement) => row.querySelector<HTMLElement>(".eval-meter")!;
const segmentsOf = (row: HTMLElement) => Array.from(row.querySelectorAll<HTMLElement>(".eval-seg"));
const peakOf = (row: HTMLElement) =>
  Number.parseFloat(meterOf(row).style.getPropertyValue("--eval-peak"));
/** Segments the script is holding fully lit right now. */
const litNow = (row: HTMLElement) =>
  segmentsOf(row).filter((segment) => segment.style.getPropertyValue("--eval-g") === "1").length;
/** True once the script has handed the row back to its rendered final frame. */
const atRest = (row: HTMLElement) =>
  meterOf(row).style.getPropertyValue("--eval-g") === "" &&
  meterOf(row).style.getPropertyValue("--eval-peak") === "" &&
  segmentsOf(row).every((segment) => segment.style.getPropertyValue("--eval-g") === "");
const detailsOf = (row: HTMLElement) =>
  document.getElementById(row.getAttribute("aria-describedby") ?? "")!;
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

describe("cyan Results instrument", () => {
  it("keeps the section's anchor, heading, intro and honesty tag", () => {
    render(<CyanResultsInstrument />);
    const section = screen.getByRole("region", { name: /Results\s*,\s*with their scope\./ });
    expect(section).toHaveAttribute("id", "results");
    expect(
      screen.getByText(
        "Each change measured against a baseline on a labelled set. These numbers describe those evaluations, not every document.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("[PRECOMPUTED · EVAL RESULTS FILES]")).toBeInTheDocument();
  });

  it("renders every evidence row with its numbers and scope as text", () => {
    render(<CyanResultsInstrument />);
    // The written-out expectations must describe the data the page ships.
    expect(evidence.map(({ project, metric, scope }) => [project, metric, scope])).toEqual(
      expected.map(({ project, metric, scope }) => [project, metric, scope]),
    );
    const list = rows();
    expect(list).toHaveLength(evidence.length);
    expected.forEach((row, index) => {
      const item = list[index];
      const change = row.delta.slice(1);
      expect(within(item).getByText(row.project)).toBeInTheDocument();
      expect(within(item).getByText(row.metric)).toBeInTheDocument();
      expect(within(item).getByText(row.scope)).toBeInTheDocument();
      expect(within(item).getByText(row.delta)).toBeInTheDocument();
      expect(item.querySelector(".eval-values")).toHaveTextContent(`${row.before} → ${row.after}`);
      expect(
        within(item).getByText(`${row.metric} rose from ${row.before} to ${row.after}, up ${change}.`),
      ).toBeInTheDocument();
      expect(item).toHaveAccessibleName(
        `${row.project} ${row.metric}: ${row.before} to ${row.after}, up ${change}, on ${row.scope}.`,
      );
      expect(item).toHaveAttribute("tabindex", "0");
      // 40 segments over 0–1; a segment lights only once the value reaches its top edge.
      expect(segmentsOf(item)).toHaveLength(40);
      expect(item.querySelectorAll(".eval-seg.is-on")).toHaveLength(row.lit);
    });

    const counts = screen.getByRole("list", { name: "Automated tests" });
    expect(screen.getByText("[SNAPSHOT]")).toBeInTheDocument();
    testCounts.forEach((count) => {
      const label = within(counts).getByText(`${count.project} tests`);
      const item = label.closest("li")!;
      expect(label).toHaveTextContent(`${count.count} ${count.project} tests`);
      expect(within(item).getByText(count.note)).toBeInTheDocument();
      expect(item.querySelector(".eval-count-num")).toHaveTextContent(
        String(count.count).padStart(4, "0"),
      );
    });
  });

  it("shows a row's evaluation set, n and baseline on keyboard focus; Escape hides them", () => {
    render(<CyanResultsInstrument />);
    const mara = rows()[2];
    expect(mara).not.toHaveAttribute("data-open");

    fireEvent.focus(mara);
    expect(mara).toHaveAttribute("data-open", "true");
    const details = detailsOf(mara);
    expect(within(details).getByText("35 labelled queries over 317 chunks")).toBeInTheDocument();
    expect(within(details).getByText("35 queries")).toBeInTheDocument();
    expect(within(details).getByText("Dense only 0.857")).toBeInTheDocument();
    expect(within(details).getByText("Hybrid search + cross-encoder rerank 0.929")).toBeInTheDocument();
    expect(mara).toHaveAccessibleDescription(/35 labelled queries over 317 chunks/);

    fireEvent.keyDown(mara, { key: "Escape" });
    expect(mara).not.toHaveAttribute("data-open");

    fireEvent.blur(mara);
    const studyforge = rows()[0];
    fireEvent.focus(studyforge);
    expect(studyforge).toHaveAttribute("data-open", "true");
    expect(
      within(detailsOf(studyforge)).getByText(
        "Written for the repo: a development check, not a held-out benchmark",
      ),
    ).toBeInTheDocument();
    fireEvent.blur(studyforge);
    expect(studyforge).not.toHaveAttribute("data-open");
  });

  it("shows the same details while the pointer is over a row", () => {
    render(<CyanResultsInstrument />);
    const row = rows()[1];
    fireEvent.pointerEnter(row);
    expect(row).toHaveAttribute("data-open", "true");
    expect(within(detailsOf(row)).getByText("Dense only 0.89")).toBeInTheDocument();
    fireEvent.pointerLeave(row);
    expect(row).not.toHaveAttribute("data-open");
  });

  it("renders the final reading at once under reduced motion", () => {
    mockMotionQuery(true);
    render(<CyanResultsInstrument />);
    rows().forEach((row, index) => {
      expect(row).not.toHaveAttribute("data-meter");
      expect(atRest(row)).toBe(true);
      expect(row.querySelectorAll(".eval-seg.is-on")).toHaveLength(expected[index].lit);
      expect(within(row).getByText(expected[index].delta)).toBeInTheDocument();
    });
    advance(3000);
    rows().forEach((row) => {
      expect(row).not.toHaveAttribute("data-meter");
      expect(atRest(row)).toBe(true);
    });
  });

  it("plays like a VU meter on scroll-in, then rests on the final frame", () => {
    mockMotionQuery(false);
    render(<CyanResultsInstrument />);
    const all = rows();
    const [first, , mara] = all;
    // Armed at zero before the first paint, with the change held back.
    all.forEach((row) => expect(row).toHaveAttribute("data-meter", "armed"));
    expect(meterOf(first).style.getPropertyValue("--eval-g")).toBe("0");

    advance(48);
    expect(first).toHaveAttribute("data-meter", "playing");
    // Rows that arrive together are staggered by 80 ms: MARA Recall@5 waits for 160 ms.
    expect(mara).toHaveAttribute("data-meter", "armed");

    // About half a second in, MARA's bar has kicked past 0.929 and is settling
    // back, while the peak tick still holds above it.
    advance(650);
    expect(mara).toHaveAttribute("data-meter", "playing");
    expect(litNow(mara)).toBeGreaterThan(expected[2].lit);
    expect(peakOf(mara)).toBeGreaterThan(0.95);

    // Then the tick drops onto the value and the change readout latches.
    advance(730);
    expect(mara).toHaveAttribute("data-meter", "latched");
    expect(peakOf(mara)).toBeCloseTo(0.929, 3);
    expect(litNow(mara)).toBe(expected[2].lit);

    // Once the afterglow has faded, every row is back on its rendered final frame.
    advance(3000);
    all.forEach((row, index) => {
      expect(row).toHaveAttribute("data-meter", "latched");
      expect(atRest(row)).toBe(true);
      expect(row.querySelectorAll(".eval-seg.is-on")).toHaveLength(expected[index].lit);
    });
  });

  it("waits until a row scrolls into view", () => {
    onScreen = false;
    render(<CyanResultsInstrument />);
    advance(3000);
    rows().forEach((row) => {
      expect(row).toHaveAttribute("data-meter", "armed");
      expect(litNow(row)).toBe(0);
    });
  });

  it("shows the true reading at once when the page-wide pause is switched on", () => {
    render(<CyanResultsInstrument />);
    advance(300);
    expect(rows()[0]).toHaveAttribute("data-meter", "playing");

    act(() => setMotionPaused(true));
    rows().forEach((row) => {
      expect(row).not.toHaveAttribute("data-meter");
      expect(atRest(row)).toBe(true);
    });
    advance(3000);
    rows().forEach((row) => expect(atRest(row)).toBe(true));
  });

  it("starts on the final frame when the page is already paused", () => {
    setMotionPaused(true);
    render(<CyanResultsInstrument />);
    rows().forEach((row) => {
      expect(row).not.toHaveAttribute("data-meter");
      expect(atRest(row)).toBe(true);
    });
  });

  it("composes the final frame if reduced motion is switched on mid-reveal", () => {
    const query = mockMotionQuery(false);
    render(<CyanResultsInstrument />);
    advance(300);
    expect(rows()[0]).toHaveAttribute("data-meter", "playing");

    act(() => query.set(true));
    rows().forEach((row) => {
      expect(row).not.toHaveAttribute("data-meter");
      expect(atRest(row)).toBe(true);
    });
  });
});

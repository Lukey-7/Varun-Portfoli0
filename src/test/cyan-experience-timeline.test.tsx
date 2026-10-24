import { useState } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { experience, type Experience } from "@/data/profile";
import { setMotionPaused } from "@/lib/motion-pause";
import CyanPage from "@/sites/cyan/CyanPage";
import { ExperienceTimeline, parsePeriod } from "@/sites/cyan/motion/ExperienceTimeline";

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
  HTMLCanvasElement.prototype.getContext = () => null;
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  cleanup();
  reduced.value = false;
  setMotionPaused(false);
});

const NOW = new Date(2026, 9, 24);
const css = readFileSync(resolve(__dirname, "../sites/cyan/motion/experience-timeline.css"), "utf8");

describe("parsePeriod", () => {
  it("reads a finished period, counting both end months", () => {
    const { start, end, months } = parsePeriod("Dec 2025 — Apr 2026", NOW);
    expect(start).toEqual(new Date(2026 - 1, 11, 1));
    expect(end).toEqual(new Date(2026, 3, 30));
    expect(months).toBe(5);
  });

  it("reads an older period across a year end", () => {
    const { start, end, months } = parsePeriod("Jul 2024 — Apr 2025", NOW);
    expect(start).toEqual(new Date(2024, 6, 1));
    expect(end).toEqual(new Date(2025, 3, 30));
    expect(months).toBe(10);
  });

  it("ends a current period today, counting the month it started and this one", () => {
    const { start, end, months } = parsePeriod("Aug 2026 — Present", NOW);
    expect(start).toEqual(new Date(2026, 7, 1));
    expect(end).toEqual(NOW);
    expect(months).toBe(3);
  });

  it("does not hand back the caller's own Date for the live end", () => {
    const { end } = parsePeriod("Aug 2026 — Present", NOW);
    expect(end).not.toBe(NOW);
  });

  it("accepts an em dash, an en dash or a hyphen, with or without spaces", () => {
    for (const dash of ["—", "–", "-"]) {
      expect(parsePeriod(`Dec 2025 ${dash} Apr 2026`, NOW).months).toBe(5);
      expect(parsePeriod(`Dec 2025${dash}Apr 2026`, NOW).months).toBe(5);
    }
  });

  it("is not fussy about case, or about a long month name", () => {
    // December 2025 to October 2026, both months counted.
    expect(parsePeriod("dec 2025 — present", NOW).months).toBe(11);
    expect(parsePeriod("December 2025 — April 2026", NOW).months).toBe(5);
  });

  it("counts a single month as one month, and never less than one", () => {
    expect(parsePeriod("Oct 2026 — Present", NOW).months).toBe(1);
    expect(parsePeriod("Apr 2026 — Apr 2026", NOW).months).toBe(1);
    // A start date after "now" cannot give a negative or zero length.
    const early = parsePeriod("Aug 2026 — Present", new Date(2026, 5, 1));
    expect(early.months).toBe(1);
    expect(early.end.getTime()).toBeGreaterThanOrEqual(early.start.getTime());
  });

  it("counts across several years", () => {
    expect(parsePeriod("Jan 2024 — Dec 2026", NOW).months).toBe(36);
  });

  it("says plainly when it cannot read a period, rather than guessing", () => {
    expect(() => parsePeriod("soon", NOW)).toThrow(RangeError);
    expect(() => parsePeriod("Foo 2025 — Apr 2026", NOW)).toThrow(RangeError);
    expect(() => parsePeriod("Apr 2026 — Dec 2025", NOW)).toThrow(RangeError);
    expect(() => parsePeriod("", NOW)).toThrow(RangeError);
  });

  it("reads every period in the profile data", () => {
    for (const job of experience) expect(() => parsePeriod(job.period, NOW)).not.toThrow();
  });
});

/** A controlled wrapper that keeps the active job, the way the page does. */
function Harness({ jobs = experience, spy }: { jobs?: Experience[]; spy?: (id: string | null) => void }) {
  const [active, setActive] = useState<string | null>(null);
  return (
    <ExperienceTimeline
      jobs={jobs}
      active={active}
      now={NOW}
      onActive={(id) => {
        spy?.(id);
        setActive(id);
      }}
    />
  );
}

const rectOf = (container: HTMLElement, id: string) => container.querySelector<SVGRectElement>(`rect[data-job="${id}"]`)!;
const num = (el: Element, name: string) => Number(el.getAttribute(name));
const readout = (container: HTMLElement) => container.querySelector("output")!;

describe("ExperienceTimeline", () => {
  it("draws one segment per job, labelled with role, company and months", () => {
    const { container } = render(<Harness />);
    expect(container.querySelectorAll("svg rect")).toHaveLength(experience.length);
    expect(screen.getByLabelText("AI Engineer, LetsTute, 3 months")).toBe(rectOf(container, "letstute"));
    expect(screen.getByLabelText("Java Backend Developer Intern, Tech IT Research, 5 months")).toBe(
      rectOf(container, "techit"),
    );
    expect(screen.getByLabelText("Student Intern, Somaiya Vidyavihar University, 10 months")).toBe(
      rectOf(container, "somaiya"),
    );
  });

  it("says '1 month' rather than '1 months'", () => {
    const jobs = [{ ...experience[0], period: "Oct 2026 — Present" }];
    render(<ExperienceTimeline jobs={jobs} active={null} onActive={() => {}} now={NOW} />);
    expect(screen.getByLabelText("AI Engineer, LetsTute, 1 month")).toBeInTheDocument();
  });

  it("is a responsive SVG with a viewBox and no fixed pixel size", () => {
    const { container } = render(<Harness />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("viewBox");
    expect(svg).not.toHaveAttribute("width");
    expect(svg).toHaveAttribute("role", "group");
    expect(svg).toHaveAccessibleName("Experience timeline");
    expect(css).toMatch(/\.experience-timeline-svg\s*\{[^}]*width:\s*100%/);
  });

  it("makes every segment keyboard focusable", () => {
    const { container } = render(<Harness />);
    for (const rect of container.querySelectorAll("rect")) expect(rect).toHaveAttribute("tabindex", "0");
  });

  it("places the segments in time order, to scale and inside the viewBox", () => {
    const { container } = render(<Harness />);
    const [minX, , width] = container.querySelector("svg")!.getAttribute("viewBox")!.split(" ").map(Number);
    const old = rectOf(container, "somaiya");
    const mid = rectOf(container, "techit");
    const now = rectOf(container, "letstute");
    // Somaiya, then Tech IT, then LetsTute, with no overlap.
    expect(num(old, "x") + num(old, "width")).toBeLessThan(num(mid, "x"));
    expect(num(mid, "x") + num(mid, "width")).toBeLessThan(num(now, "x"));
    // Tech IT (Dec 1 to Apr 30, 150 days) is half as long as Somaiya (Jul 1 to Apr 30, 303 days).
    expect(num(mid, "width") / num(old, "width")).toBeCloseTo(150 / 303, 1);
    for (const rect of [old, mid, now]) {
      expect(num(rect, "x")).toBeGreaterThanOrEqual(minX);
      expect(num(rect, "x") + num(rect, "width")).toBeLessThanOrEqual(minX + width);
      expect(num(rect, "width")).toBeGreaterThan(0);
    }
  });

  it("puts one tick on each calendar year from the earliest start to this year", () => {
    const { container } = render(<Harness />);
    const labels = [...container.querySelectorAll(".experience-timeline-year")].map((el) => el.textContent);
    expect(labels).toEqual(["2024", "2025", "2026"]);
    const ticks = [...container.querySelectorAll("line.experience-timeline-tick")];
    expect(ticks).toHaveLength(3);
    const xs = ticks.map((tick) => num(tick, "x1"));
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    // A year is the same width wherever it falls: 2025 has 365 days, 2024 has 366.
    expect((xs[2] - xs[1]) / (xs[1] - xs[0])).toBeCloseTo(365 / 366, 2);
    // Every tick lies on the axis, and each job starts after the tick for its own year.
    const [, , width] = container.querySelector("svg")!.getAttribute("viewBox")!.split(" ").map(Number);
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(width);
    }
    expect(num(rectOf(container, "somaiya"), "x")).toBeGreaterThan(xs[0]);
    expect(num(rectOf(container, "techit"), "x")).toBeLessThan(xs[2]);
    expect(num(rectOf(container, "letstute"), "x")).toBeGreaterThan(xs[2]);
  });

  it("adds a tick when the year turns", () => {
    const { container } = render(
      <ExperienceTimeline jobs={experience} active={null} onActive={() => {}} now={new Date(2027, 1, 3)} />,
    );
    expect([...container.querySelectorAll(".experience-timeline-year")].map((el) => el.textContent)).toEqual([
      "2024",
      "2025",
      "2026",
      "2027",
    ]);
  });

  it("lets the first year start the axis and draws the segments inside it", () => {
    const jobs = [{ ...experience[1], period: "Jan 2025 — Feb 2025" }];
    const { container } = render(<ExperienceTimeline jobs={jobs} active={null} onActive={() => {}} now={new Date(2025, 2, 1)} />);
    expect([...container.querySelectorAll(".experience-timeline-year")].map((el) => el.textContent)).toEqual(["2025"]);
    expect(num(rectOf(container, "techit"), "x")).toBeGreaterThanOrEqual(0);
  });

  it("calls onActive with the job's id when its segment is focused or hovered", () => {
    const spy = vi.fn();
    const { container } = render(<Harness spy={spy} />);
    act(() => rectOf(container, "techit").focus());
    expect(spy).toHaveBeenLastCalledWith("techit");
    act(() => rectOf(container, "techit").blur());
    expect(spy).toHaveBeenLastCalledWith(null);
    fireEvent.mouseEnter(rectOf(container, "somaiya"));
    expect(spy).toHaveBeenLastCalledWith("somaiya");
    fireEvent.mouseLeave(rectOf(container, "somaiya"));
    expect(spy).toHaveBeenLastCalledWith(null);
  });

  it("does not clear a different job that has since become active", () => {
    const spy = vi.fn();
    const { container } = render(<Harness spy={spy} />);
    fireEvent.mouseEnter(rectOf(container, "somaiya"));
    act(() => rectOf(container, "techit").focus());
    spy.mockClear();
    fireEvent.mouseLeave(rectOf(container, "somaiya"));
    expect(spy).not.toHaveBeenCalled();
    expect(rectOf(container, "techit")).toHaveAttribute("data-active");
  });

  it("shows the active job's months in the readout, and nothing when none is active", () => {
    const { container } = render(<Harness />);
    expect(readout(container)).toBeEmptyDOMElement();
    act(() => rectOf(container, "techit").focus());
    expect(readout(container)).toHaveTextContent("5 MONTHS");
    expect(screen.getByText("5 MONTHS")).toBe(readout(container));
    fireEvent.mouseEnter(rectOf(container, "letstute"));
    expect(readout(container)).toHaveTextContent("3 MONTHS");
    act(() => rectOf(container, "techit").blur());
    fireEvent.mouseLeave(rectOf(container, "letstute"));
    expect(readout(container)).toBeEmptyDOMElement();
  });

  it("says '1 MONTH' for a single month", () => {
    const jobs = [{ ...experience[0], period: "Oct 2026 — Present" }];
    const { container } = render(<ExperienceTimeline jobs={jobs} active="letstute" onActive={() => {}} now={NOW} />);
    expect(readout(container)).toHaveTextContent("1 MONTH");
    expect(readout(container).textContent).toBe("1 MONTH");
  });

  it("highlights the active segment and dims the others", () => {
    const { container, rerender } = render(
      <ExperienceTimeline jobs={experience} active={null} onActive={() => {}} now={NOW} />,
    );
    expect(container.querySelectorAll("[data-active]")).toHaveLength(0);
    expect(container.querySelector(".experience-timeline")).not.toHaveAttribute("data-has-active");
    rerender(<ExperienceTimeline jobs={experience} active="techit" onActive={() => {}} now={NOW} />);
    expect(rectOf(container, "techit")).toHaveAttribute("data-active");
    expect(rectOf(container, "somaiya")).not.toHaveAttribute("data-active");
    expect(container.querySelector(".experience-timeline")).toHaveAttribute("data-has-active");
  });

  it("ignores an id that matches no job", () => {
    const { container } = render(<ExperienceTimeline jobs={experience} active="ghost" onActive={() => {}} now={NOW} />);
    expect(container.querySelectorAll("[data-active]")).toHaveLength(0);
    expect(readout(container)).toBeEmptyDOMElement();
  });

  it("leaves out a job whose period it cannot read, and still draws the rest", () => {
    const jobs = [{ ...experience[1], id: "odd", period: "whenever" }, ...experience];
    const { container } = render(<ExperienceTimeline jobs={jobs} active={null} onActive={() => {}} now={NOW} />);
    expect(container.querySelectorAll("svg rect")).toHaveLength(experience.length);
    expect(rectOf(container, "odd")).toBeNull();
  });

  it("draws an empty axis rather than failing when there are no jobs", () => {
    const { container } = render(<ExperienceTimeline jobs={[]} active={null} onActive={() => {}} now={NOW} />);
    expect(container.querySelectorAll("svg rect")).toHaveLength(0);
    expect(readout(container)).toBeEmptyDOMElement();
  });
});

describe("ExperienceTimeline live end", () => {
  const live = (container: HTMLElement) => container.querySelectorAll(".experience-timeline-live");

  it("marks only the current job's end, at the end of its segment", () => {
    const { container } = render(<Harness />);
    expect(live(container)).toHaveLength(1);
    const rect = rectOf(container, "letstute");
    expect(num(live(container)[0], "x1")).toBeCloseTo(num(rect, "x") + num(rect, "width"), 1);
    expect(rect).toHaveAttribute("data-current");
    expect(rectOf(container, "techit")).not.toHaveAttribute("data-current");
  });

  it("has no live end when no job is current", () => {
    const jobs = experience.map((job) => ({ ...job, current: false }));
    const { container } = render(<ExperienceTimeline jobs={jobs} active={null} onActive={() => {}} now={NOW} />);
    expect(live(container)).toHaveLength(0);
  });

  it("pulses by default", () => {
    const { container } = render(<Harness />);
    expect(container.querySelector(".experience-timeline")).not.toHaveAttribute("data-still");
  });

  it("holds a complete, still frame under reduced motion", () => {
    reduced.value = true;
    const { container } = render(<Harness />);
    expect(container.querySelector(".experience-timeline")).toHaveAttribute("data-still");
    expect(live(container)).toHaveLength(1);
  });

  it("holds a complete, still frame when the site-wide pause is on, and resumes after", () => {
    const { container } = render(<Harness />);
    act(() => setMotionPaused(true));
    expect(container.querySelector(".experience-timeline")).toHaveAttribute("data-still");
    expect(live(container)).toHaveLength(1);
    expect(container.querySelectorAll("svg rect")).toHaveLength(experience.length);
    act(() => setMotionPaused(false));
    expect(container.querySelector(".experience-timeline")).not.toHaveAttribute("data-still");
  });

  it("is still when it starts paused", () => {
    setMotionPaused(true);
    const { container } = render(<Harness />);
    expect(container.querySelector(".experience-timeline")).toHaveAttribute("data-still");
  });
});

describe("experience-timeline.css", () => {
  it("stops the pulse and drops the animation when the timeline is still", () => {
    expect(css).toMatch(/\.experience-timeline\[data-still\][^{]*\{[^}]*animation:\s*none/);
  });

  it("stops the pulse under prefers-reduced-motion even if script has not run", () => {
    const block = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(block).toMatch(/animation:\s*none/);
  });

  it("uses amber for the months readout alone", () => {
    // Every mention of the amber, outside comments, sits in a rule for the readout.
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, "").split("}");
    const amber = rules.filter((rule) => /phosphor/.test(rule));
    expect(amber.length).toBeGreaterThan(0);
    for (const rule of amber) expect(rule).toMatch(/readout/);
  });

  it("keeps the tick labels from running past the right edge", () => {
    expect(css).toMatch(/\[data-flip\]/);
  });
});

describe("Experience section on the cyan page", () => {
  const renderSection = () => {
    const { container } = render(
      <MemoryRouter>
        <CyanPage />
      </MemoryRouter>,
    );
    return container.querySelector<HTMLElement>("#experience")!;
  };
  const rowOf = (section: HTMLElement, id: string) =>
    section.querySelector<HTMLElement>(`#job-${id}`)!.closest<HTMLElement>(".experience-item")!;
  const litRows = (section: HTMLElement) =>
    experience.map((job) => job.id).filter((id) => rowOf(section, id).hasAttribute("data-active"));
  const litSegments = (section: HTMLElement) =>
    experience.map((job) => job.id).filter((id) => rectOf(section, id).hasAttribute("data-active"));

  it("draws the timeline above the list, with a row for each job", () => {
    const section = renderSection();
    const timeline = section.querySelector(".experience-timeline")!;
    const list = section.querySelector(".experience-list")!;
    expect(timeline).toBeInTheDocument();
    expect(timeline.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(section.querySelectorAll(".experience-item")).toHaveLength(experience.length);
    expect(section.querySelectorAll("svg rect")).toHaveLength(experience.length);
  });

  it("lights the segment and the row together when a row is hovered or focused", () => {
    const section = renderSection();
    expect(litRows(section)).toEqual([]);
    expect(litSegments(section)).toEqual([]);

    fireEvent.mouseEnter(rowOf(section, "techit"));
    expect(litRows(section)).toEqual(["techit"]);
    expect(litSegments(section)).toEqual(["techit"]);
    expect(section.querySelector("output")).toHaveTextContent("5 MONTHS");
    fireEvent.mouseLeave(rowOf(section, "techit"));
    expect(litRows(section)).toEqual([]);
    expect(litSegments(section)).toEqual([]);

    const button = rowOf(section, "somaiya").querySelector("button")!;
    act(() => button.focus());
    expect(litRows(section)).toEqual(["somaiya"]);
    expect(litSegments(section)).toEqual(["somaiya"]);
    expect(section.querySelector("output")).toHaveTextContent("10 MONTHS");
    act(() => button.blur());
    expect(litRows(section)).toEqual([]);
    expect(section.querySelector("output")).toBeEmptyDOMElement();
  });

  it("lights the row when a segment is hovered or focused", () => {
    const section = renderSection();
    fireEvent.mouseEnter(rectOf(section, "letstute"));
    expect(litRows(section)).toEqual(["letstute"]);
    fireEvent.mouseLeave(rectOf(section, "letstute"));
    expect(litRows(section)).toEqual([]);
    act(() => rectOf(section, "techit").focus());
    expect(litRows(section)).toEqual(["techit"]);
    expect(litSegments(section)).toEqual(["techit"]);
    act(() => rectOf(section, "techit").blur());
    expect(litRows(section)).toEqual([]);
  });

  it("keeps the focused row lit when the pointer leaves a different row", () => {
    const section = renderSection();
    const hovered = rowOf(section, "letstute");
    const focused = rowOf(section, "techit").querySelector("button")!;
    fireEvent.mouseEnter(hovered);
    act(() => focused.focus());
    expect(litRows(section)).toEqual(["techit"]);
    fireEvent.mouseLeave(hovered);
    expect(litRows(section)).toEqual(["techit"]);
    expect(litSegments(section)).toEqual(["techit"]);
    act(() => focused.blur());
    expect(litRows(section)).toEqual([]);
  });

  it("leaves the accordion exactly as it was", () => {
    const section = renderSection();
    const button = (id: string) => rowOf(section, id).querySelector("button")!;
    // LetsTute starts open; hovering and focusing never change what is open.
    expect(button("letstute")).toHaveAttribute("aria-expanded", "true");
    expect(button("techit")).toHaveAttribute("aria-expanded", "false");
    fireEvent.mouseEnter(rowOf(section, "techit"));
    act(() => button("somaiya").focus());
    act(() => rectOf(section, "techit").focus());
    expect(button("letstute")).toHaveAttribute("aria-expanded", "true");
    expect(button("techit")).toHaveAttribute("aria-expanded", "false");
    expect(button("somaiya")).toHaveAttribute("aria-expanded", "false");
    // Clicking still opens and closes a row.
    fireEvent.click(button("techit"));
    expect(button("techit")).toHaveAttribute("aria-expanded", "true");
    expect(button("letstute")).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button("techit"));
    expect(button("techit")).toHaveAttribute("aria-expanded", "false");
    // Each row keeps its own title and period text.
    expect(rowOf(section, "techit")).toHaveTextContent("Dec 2025 - Apr 2026");
    expect(rowOf(section, "techit")).toHaveTextContent("Java Backend Developer Intern");
  });
});

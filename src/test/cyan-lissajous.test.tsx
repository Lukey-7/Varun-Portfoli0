import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { otherWork } from "@/data/portfolio";
import { setMotionPaused } from "@/lib/motion-pause";
import CyanPage from "@/sites/cyan/CyanPage";
import { Lissajous, lissajousFor, lissajousPath } from "@/sites/cyan/motion/Lissajous";

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

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const degrees = (phase: number) => Math.round((phase * 180) / Math.PI);
const readoutFor = (seed: string) => {
  const { a, b, phase } = lissajousFor(seed);
  return `${a}:${b} · φ ${degrees(phase)}°`;
};
/** The two paths the figure is made of: the dim whole figure, and the bright trace. */
const parts = (container: HTMLElement) => ({
  root: container.querySelector<HTMLElement>(".lissajous")!,
  ghost: container.querySelector<SVGPathElement>(".lissajous-ghost")!,
  trace: container.querySelector<SVGPathElement>(".lissajous-trace")!,
});

describe("lissajousFor", () => {
  it("same seed gives the same figure", () => {
    expect(lissajousFor("Sprachweg")).toEqual(lissajousFor("Sprachweg"));
    expect(lissajousFor("")).toEqual(lissajousFor(""));
  });

  it("gives the three Also built cards three different figures", () => {
    const figures = otherWork.map((project) => JSON.stringify(lissajousFor(project.name)));
    expect(new Set(figures).size).toBe(otherWork.length);
  });

  it("ratios are coprime and distinct", () => {
    const seeds = [...otherWork.map((project) => project.name), ...Array.from({ length: 300 }, (_, i) => `seed-${i}`)];
    for (const seed of seeds) {
      const { a, b, phase } = lissajousFor(seed);
      expect(Number.isInteger(a) && a >= 1 && a <= 5).toBe(true);
      expect(Number.isInteger(b) && b >= 1 && b <= 5).toBe(true);
      expect(a).not.toBe(b);
      expect(gcd(a, b)).toBe(1);
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(Math.PI);
    }
  });

  it("uses more than one ratio and phase across seeds", () => {
    const figures = Array.from({ length: 60 }, (_, i) => lissajousFor(`project ${i}`));
    expect(new Set(figures.map(({ a, b }) => `${a}:${b}`)).size).toBeGreaterThan(5);
    expect(new Set(figures.map(({ phase }) => degrees(phase))).size).toBeGreaterThan(20);
  });
});

describe("lissajousPath", () => {
  const points = (d: string) => [...d.matchAll(/[ML]\s*(-?[\d.]+)[ ,](-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);

  it("starts with M and has steps+1 points", () => {
    const d = lissajousPath(3, 2, Math.PI / 4, 40);
    expect(d.startsWith("M")).toBe(true);
    expect(points(d)).toHaveLength(241);
    expect(points(lissajousPath(1, 2, 0, 40, 12))).toHaveLength(13);
  });

  it("stays inside the square and closes on its starting point", () => {
    const size = 40;
    const list = points(lissajousPath(5, 4, 1, size));
    for (const [x, y] of list) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(size);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(size);
    }
    expect(list[list.length - 1][0]).toBeCloseTo(list[0][0], 1);
    expect(list[list.length - 1][1]).toBeCloseTo(list[0][1], 1);
  });

  it("follows x = sin(a·t + phase) and y = sin(b·t)", () => {
    // With a = b = 1 and no phase the curve is a diagonal line through the centre.
    const list = points(lissajousPath(1, 1, 0, 40, 4));
    expect(list[0]).toEqual([20, 20]);
    expect(list[1][0]).toBeCloseTo(40, 1);
    expect(list[1][1]).toBeCloseTo(0, 1);
    expect(list[3][0]).toBeCloseTo(0, 1);
    expect(list[3][1]).toBeCloseTo(40, 1);
  });
});

describe("Lissajous", () => {
  it("render shows the readout", () => {
    const { container } = render(<Lissajous seed="Sprachweg" active />);
    expect(screen.getByText(readoutFor("Sprachweg"))).toBeInTheDocument();
    expect(screen.getByText(readoutFor("Sprachweg"))).toHaveClass("lissajous-readout");
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("formats the readout as ratio, then phase in whole degrees", () => {
    render(<Lissajous seed="Sprachweg" active />);
    expect(screen.getByText(/^[1-5]:[1-5] · φ \d{1,3}°$/)).toBeInTheDocument();
  });

  it("draws the same figure on both paths, from the seed", () => {
    const { container } = render(<Lissajous seed="DND AI Game" active={false} />);
    const { ghost, trace } = parts(container);
    const { a, b, phase } = lissajousFor("DND AI Game");
    expect(ghost.getAttribute("d")).toBe(trace.getAttribute("d"));
    expect(ghost.getAttribute("d")!.startsWith("M")).toBe(true);
    expect(ghost.getAttribute("d")).toBe(lissajousPath(a, b, phase, 40));
  });

  it("rests as a dim whole figure, and traces itself when active", () => {
    const { container, rerender } = render(<Lissajous seed="Sprachweg" active={false} />);
    expect(parts(container).root).not.toHaveAttribute("data-active");
    expect(parts(container).trace.style.strokeDashoffset).toBe("1");
    rerender(<Lissajous seed="Sprachweg" active />);
    expect(parts(container).root).toHaveAttribute("data-active");
    expect(parts(container).trace.style.strokeDashoffset).toBe("0");
    rerender(<Lissajous seed="Sprachweg" active={false} />);
    expect(parts(container).root).not.toHaveAttribute("data-active");
    expect(parts(container).trace.style.strokeDashoffset).toBe("1");
  });

  it("draws the full figure at once under reduced motion", () => {
    reduced.value = true;
    const { container } = render(<Lissajous seed="Sprachweg" active />);
    const { root, trace } = parts(container);
    expect(root).toHaveAttribute("data-still");
    expect(trace.style.strokeDashoffset).toBe("0");
  });

  it("draws the full figure at once, even mid-trace, when the site-wide pause is on", () => {
    const { container } = render(<Lissajous seed="Sprachweg" active />);
    expect(parts(container).root).not.toHaveAttribute("data-still");
    act(() => setMotionPaused(true));
    expect(parts(container).root).toHaveAttribute("data-still");
    expect(parts(container).trace.style.strokeDashoffset).toBe("0");
    act(() => setMotionPaused(false));
    expect(parts(container).root).not.toHaveAttribute("data-still");
  });

  it("is still a complete figure when it is paused and nothing is active", () => {
    setMotionPaused(true);
    const { container } = render(<Lissajous seed="Sprachweg" active={false} />);
    const { root, ghost } = parts(container);
    expect(root).toHaveAttribute("data-still");
    expect(ghost.getAttribute("d")!.length).toBeGreaterThan(100);
  });
});

describe("Also built cards", () => {
  const renderSection = () => {
    const { container } = render(
      <MemoryRouter>
        <CyanPage />
      </MemoryRouter>,
    );
    return container.querySelector<HTMLElement>(".other-section")!;
  };
  /** The card for a project, found by its heading; role queries are slow on the whole page. */
  const cardOf = (section: HTMLElement, name: string) =>
    [...section.querySelectorAll<HTMLAnchorElement>("a.other-project")].find(
      (card) => card.querySelector("h3")?.textContent === name,
    )!;
  const litCards = (section: HTMLElement) =>
    otherWork
      .map((project) => project.name)
      .filter((name) => cardOf(section, name).querySelector(".lissajous")?.hasAttribute("data-active"));

  it("gives every card a signature that hover or keyboard focus lights, keeping its symbol", () => {
    const section = renderSection();
    expect(section.querySelectorAll("a.other-project")).toHaveLength(otherWork.length);
    for (const project of otherWork) {
      const card = cardOf(section, project.name);
      expect(card.querySelector(".other-symbol")).toBeInTheDocument();
      expect(within(card).getByText(readoutFor(project.name))).toBeInTheDocument();
      // The figure and its readout add nothing to what a screen reader hears from the card.
      expect(card.querySelector(".lissajous")).toHaveAttribute("aria-hidden", "true");
    }
    expect(litCards(section)).toEqual([]);

    const sprachweg = cardOf(section, "Sprachweg");
    fireEvent.mouseEnter(sprachweg);
    expect(litCards(section)).toEqual(["Sprachweg"]);
    fireEvent.mouseLeave(sprachweg);
    expect(litCards(section)).toEqual([]);

    const dnd = cardOf(section, "DND AI Game");
    act(() => dnd.focus());
    expect(litCards(section)).toEqual(["DND AI Game"]);
    act(() => dnd.blur());
    expect(litCards(section)).toEqual([]);
  });

  it("keeps the focused card lit when the pointer leaves a different card", () => {
    const section = renderSection();
    const hovered = cardOf(section, "Tetris / Lukey Arcade");
    const focused = cardOf(section, "Sprachweg");
    fireEvent.mouseEnter(hovered);
    act(() => focused.focus());
    expect(litCards(section)).toEqual(["Sprachweg"]);
    fireEvent.mouseLeave(hovered);
    expect(litCards(section)).toEqual(["Sprachweg"]);
    act(() => focused.blur());
    expect(litCards(section)).toEqual([]);
  });
});

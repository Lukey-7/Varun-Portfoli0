import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { otherWork, selectedWork } from "@/data/portfolio";
import { setMotionPaused } from "@/lib/motion-pause";
import {
  PcbSignalMap,
  assignLanes,
  describeSelection,
  layoutBoard,
  routeTrace,
} from "@/sites/cyan/motion/PcbSignalMap";

afterEach(() => {
  cleanup();
  setMotionPaused(false);
});

// Built from the data file the same way the original Signal map built it.
const projects = [
  ...selectedWork.map((p) => ({ name: p.name, tools: [...p.stack] })),
  ...otherWork
    .slice(0, 2)
    .map((p) => ({ name: p.name.split(" / ")[0], tools: p.tech.split(" / ") })),
];
const tools = Array.from(new Set(projects.flatMap((p) => p.tools)));
const usersOf = (tool: string) => projects.filter((p) => p.tools.includes(tool)).map((p) => p.name);
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const idle = `${plural(projects.length, "project")} · ${plural(tools.length, "tool")}`;

type Point = { x: number; y: number };

/** The corners of a path written with M, H, V and L commands. */
function corners(d: string): Point[] {
  const points: Point[] = [];
  let x = 0;
  let y = 0;
  for (const [, command, args] of d.matchAll(/([MHVL])([^MHVL]*)/g)) {
    const values = args.trim().split(/[\s,]+/).map(Number);
    if (command === "M" || command === "L") [x, y] = values;
    else if (command === "H") x = values[0];
    else y = values[0];
    points.push({ x, y });
  }
  return points;
}
const segments = (d: string) => corners(d).slice(1).map((end, k) => [corners(d)[k], end] as const);

// Board widths from a 320px phone (280) to the widest section (1312).
const WIDTHS = [280, 320, 335, 375, 414, 599, 600, 704, 960, 1312];

/**
 * The buttons of both lists, looked up once: naming every button on each
 * query is slow in jsdom. The first test checks they follow the data's order.
 */
function parts() {
  const projectButtons = within(screen.getByRole("list", { name: "Projects" })).getAllByRole("button");
  const toolButtons = within(screen.getByRole("list", { name: "Tools" })).getAllByRole("button");
  return {
    projectButtons,
    toolButtons,
    project: (name: string) => projectButtons[projects.findIndex((p) => p.name === name)],
    tool: (name: string) => toolButtons[tools.indexOf(name)],
  };
}

describe("PcbSignalMap", () => {
  const status = () => screen.getByRole("status");
  const board = (container: HTMLElement) => container.querySelector(".pcb-board") as HTMLElement;

  it("renders every project and tool from the data under the original heading", () => {
    const { container } = render(<PcbSignalMap />);
    expect(container.querySelector("section#signal")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Signal map.");
    expect(
      screen.getByText(
        "Every project and the tools it runs on. Hover or focus a project to trace its stack, or a tool to see where it appears.",
      ),
    ).toBeInTheDocument();

    const { projectButtons, toolButtons } = parts();
    expect(projectButtons).toHaveLength(projects.length);
    projectButtons.forEach((button, k) => {
      const project = projects[k];
      expect(button).toHaveAccessibleName(project.name);
      expect(button).toHaveAttribute("aria-describedby", `signal-${project.name.replace(/\W/g, "")}`);
      expect(button).toHaveAccessibleDescription(`Uses ${project.tools.join(", ")}`);
    });
    expect(toolButtons).toHaveLength(tools.length);
    toolButtons.forEach((button, k) => {
      expect(button).toHaveAccessibleName(tools[k]);
      expect(button).toHaveAccessibleDescription(`Used in ${usersOf(tools[k]).join(", ")}`);
    });

    const connections = projects.reduce((sum, p) => sum + p.tools.length, 0);
    expect(container.querySelectorAll(".pcb-trace")).toHaveLength(connections);
    expect(status()).toHaveTextContent(`${idle}. ${plural(connections, "connection")}`);
    expect(container.querySelectorAll(".is-lit")).toHaveLength(0);
  });

  it("focusing a project lights its tools and traces, dims the rest and states it in the readout", () => {
    const { container } = render(<PcbSignalMap />);
    const project = projects[0];
    const map = parts();
    const button = map.project(project.name);
    act(() => button.focus());

    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveClass("is-lit");
    for (const other of projects.slice(1)) expect(map.project(other.name)).not.toHaveClass("is-lit");
    for (const tool of tools) {
      if (project.tools.includes(tool)) expect(map.tool(tool)).toHaveClass("is-lit");
      else expect(map.tool(tool)).not.toHaveClass("is-lit");
    }
    const lit = Array.from(container.querySelectorAll(".pcb-lit.is-lit"));
    expect(lit.map((path) => path.getAttribute("data-project"))).toEqual(project.tools.map(() => project.name));
    expect(lit.map((path) => path.getAttribute("data-tool")).sort()).toEqual([...project.tools].sort());
    expect(container.querySelectorAll(".pcb-pulse")).toHaveLength(project.tools.length);
    expect(board(container)).toHaveClass("has-focus");
    expect(board(container)).toHaveAttribute("data-flow", "out");
    expect(status()).toHaveTextContent(
      `${project.name} · ${plural(project.tools.length, "tool")}. ${project.tools.join(", ")}`,
    );

    act(() => button.blur());
    expect(status()).toHaveTextContent(idle);
    expect(container.querySelectorAll(".is-lit")).toHaveLength(0);
    expect(container.querySelectorAll(".pcb-pulse")).toHaveLength(0);
  });

  it("hovering a tool shows where it appears, with the pulse running towards it", () => {
    const { container } = render(<PcbSignalMap />);
    const map = parts();
    const shared = tools.find((tool) => usersOf(tool).length > 1) ?? tools[0];
    fireEvent.pointerEnter(map.tool(shared));

    const users = usersOf(shared);
    expect(map.tool(shared)).toHaveAttribute("aria-pressed", "true");
    expect(status()).toHaveTextContent(
      `${shared} · used in ${plural(users.length, "project")}. ${users.join(", ")}`,
    );
    for (const project of projects) {
      if (users.includes(project.name)) expect(map.project(project.name)).toHaveClass("is-lit");
      else expect(map.project(project.name)).not.toHaveClass("is-lit");
    }
    expect(container.querySelectorAll(".pcb-lit.is-lit")).toHaveLength(users.length);
    expect(board(container)).toHaveAttribute("data-flow", "in");

    fireEvent.pointerLeave(board(container));
    expect(status()).toHaveTextContent(idle);
  });

  it("follows keyboard focus from part to part and returns to it when the pointer leaves", () => {
    const { container } = render(<PcbSignalMap />);
    const map = parts();
    const first = map.project(projects[0].name);
    const second = map.project(projects[1].name);
    act(() => first.focus());
    act(() => second.focus());
    expect(first).toHaveAttribute("aria-pressed", "false");
    expect(second).toHaveAttribute("aria-pressed", "true");
    expect(status()).toHaveTextContent(`${projects[1].name} ·`);

    fireEvent.pointerEnter(map.tool(tools[0]));
    expect(status()).toHaveTextContent(`${tools[0]} · used in`);
    fireEvent.pointerLeave(board(container));
    expect(status()).toHaveTextContent(`${projects[1].name} ·`);
  });

  it("selects a part on a tap, for browsers that don't focus buttons on click", () => {
    render(<PcbSignalMap />);
    const last = tools[tools.length - 1];
    fireEvent.click(parts().tool(last));
    expect(status()).toHaveTextContent(`${last} · used in`);
  });

  it("draws at once and sends no pulse while motion is paused", () => {
    setMotionPaused(true);
    const { container } = render(<PcbSignalMap />);
    expect(board(container)).toHaveAttribute("data-still");
    expect(board(container)).toHaveAttribute("data-reveal", "done");
    act(() => parts().project(projects[0].name).focus());
    expect(container.querySelectorAll(".pcb-lit.is-lit")).toHaveLength(projects[0].tools.length);
    expect(container.querySelectorAll(".pcb-pulse")).toHaveLength(0);
  });

  it("gives every trace a path length of 1 so dashes are fractions of it", () => {
    const { container } = render(<PcbSignalMap />);
    act(() => parts().project(projects[0].name).focus());
    const paths = Array.from(container.querySelectorAll(".pcb-trace, .pcb-lit, .pcb-pulse"));
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) expect(path).toHaveAttribute("pathLength", "1");
  });
});

describe("routeTrace", () => {
  it("runs level, turns 45° into its lane, runs upright and turns back, with a via on each corner", () => {
    const route = routeTrace({ x: 0, y: 0 }, { x: 100, y: 40 }, 50, 6);
    expect(route.d).toBe("M0 0H44L50 6V34L56 40H100");
    expect(route.length).toBeCloseTo(116 + 12 * Math.SQRT2);
    expect(route.vias.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 47, y: 3 },
      { x: 53, y: 37 },
    ]);
    expect(route.vias[0].at).toBeCloseTo((44 + 3 * Math.SQRT2) / route.length);
    expect(routeTrace({ x: 0, y: 40 }, { x: 100, y: 0 }, 50, 6).d).toBe("M0 40H44L50 34V6L56 0H100");
  });

  it("makes a step smaller than two corners a single 45° jog and leaves a level trace straight", () => {
    const jog = routeTrace({ x: 0, y: 0 }, { x: 100, y: 4 }, 50, 6);
    expect(jog.d).toBe("M0 0H48L52 4H100");
    expect(jog.vias.map(({ x, y }) => ({ x, y }))).toEqual([{ x: 50, y: 2 }]);
    expect(routeTrace({ x: 10, y: 20 }, { x: 90, y: 20 }, 50, 6)).toEqual({
      d: "M10 20H90",
      length: 80,
      vias: [],
    });
  });
});

describe("assignLanes", () => {
  it("nests traces heading the same way instead of crossing them", () => {
    // Going down, the trace that starts higher turns later (further right).
    expect(assignLanes([{ from: 0, to: 50 }, { from: 10, to: 60 }], 10, 5)).toEqual([1, 0]);
    // Going up, the trace that starts lower turns later.
    expect(assignLanes([{ from: 50, to: 0 }, { from: 60, to: 10 }], 10, 5)).toEqual([0, 1]);
  });

  it("shares a lane between traces far apart and gives a level trace none", () => {
    expect(
      assignLanes([{ from: 0, to: 20 }, { from: 100, to: 120 }, { from: 70, to: 70 }], 10, 5),
    ).toEqual([0, 0, null]);
  });

  it("turns a trace whose pin is level with another trace's pad first", () => {
    expect(assignLanes([{ from: 50, to: 80 }, { from: 120, to: 52 }], 10, 5)).toEqual([0, 1]);
    expect(assignLanes([{ from: 120, to: 52 }, { from: 50, to: 80 }], 10, 5)).toEqual([1, 0]);
  });
});

describe("layoutBoard", () => {
  it("is deterministic", () => {
    for (const width of WIDTHS) expect(layoutBoard(width)).toEqual(layoutBoard(width));
  });

  it("lays out every connection in the data, one trace each", () => {
    const board = layoutBoard(960);
    expect(board.projects.map((p) => p.name)).toEqual(projects.map((p) => p.name));
    expect(board.tools.map((t) => t.name)).toEqual(tools);
    expect(board.traces.map((t) => `${t.project}→${t.tool}`).sort()).toEqual(
      projects.flatMap((p) => p.tools.map((tool) => `${p.name}→${tool}`)).sort(),
    );
  });

  it("runs every trace level, upright or at 45° from a chip pin to a tool pad, with vias on its corners", () => {
    for (const width of WIDTHS) {
      const board = layoutBoard(width);
      for (const trace of board.traces) {
        const chip = board.projects.find((p) => p.name === trace.project)?.box;
        const part = board.tools.find((t) => t.name === trace.tool)?.box;
        if (!chip || !part) throw new Error(`Missing part for ${trace.id}`);
        const points = corners(trace.d);
        const diagonals: (readonly [Point, Point])[] = [];
        for (const [a, b] of segments(trace.d)) {
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          expect(dx).toBeGreaterThanOrEqual(0);
          expect(dx === 0 || dy === 0 || Math.abs(Math.abs(dx) - Math.abs(dy)) < 0.02).toBe(true);
          if (dx !== 0 && dy !== 0) diagonals.push([a, b]);
        }
        expect(trace.pin.x).toBe(chip.x + chip.w);
        expect(points[0]).toEqual({ x: trace.pin.x + trace.pin.w, y: trace.pin.y + trace.pin.h / 2 });
        expect(points[0].y).toBeGreaterThan(chip.y);
        expect(points[0].y).toBeLessThan(chip.y + chip.h);
        expect(trace.pad.x + trace.pad.w).toBe(part.x);
        expect(points[points.length - 1]).toEqual({ x: trace.pad.x, y: trace.pad.y + trace.pad.h / 2 });
        expect(points[points.length - 1].y).toBeGreaterThan(part.y);
        expect(points[points.length - 1].y).toBeLessThan(part.y + part.h);

        expect(trace.vias).toHaveLength(trace.lane === null ? 0 : diagonals.length);
        trace.vias.forEach((via, k) => {
          const [a, b] = diagonals[k];
          expect(via.x).toBeCloseTo((a.x + b.x) / 2, 1);
          expect(via.y).toBeCloseTo((a.y + b.y) / 2, 1);
        });
      }
    }
  });

  it("never lays two traces along the same line", () => {
    for (const width of WIDTHS) {
      const runs = layoutBoard(width).traces.flatMap((trace) =>
        segments(trace.d).map(([a, b]) => ({ id: trace.id, a, b })),
      );
      for (let i = 0; i < runs.length; i++) {
        for (let j = i + 1; j < runs.length; j++) {
          const p = runs[i];
          const q = runs[j];
          if (p.id === q.id) continue;
          const level = (r: typeof p) => r.a.y === r.b.y;
          const upright = (r: typeof p) => r.a.x === r.b.x;
          const shared = (a1: number, a2: number, b1: number, b2: number) =>
            Math.min(Math.max(a1, a2), Math.max(b1, b2)) - Math.max(Math.min(a1, a2), Math.min(b1, b2));
          if (level(p) && level(q) && Math.abs(p.a.y - q.a.y) < 3) {
            expect(shared(p.a.x, p.b.x, q.a.x, q.b.x), `${p.id} / ${q.id} at ${width}px`).toBeLessThanOrEqual(0);
          }
          if (upright(p) && upright(q) && Math.abs(p.a.x - q.a.x) < 3) {
            expect(shared(p.a.y, p.b.y, q.a.y, q.b.y), `${p.id} / ${q.id} at ${width}px`).toBeLessThanOrEqual(0);
          }
        }
      }
    }
  });

  it("places each chip so at least one of its traces runs level", () => {
    for (const width of WIDTHS) {
      const board = layoutBoard(width);
      for (const project of projects) {
        expect(board.traces.some((t) => t.project === project.name && t.lane === null)).toBe(true);
      }
    }
  });

  it("fits a phone screen without sideways scrolling", () => {
    for (const width of [280, 335, 375, 414]) {
      const board = layoutBoard(width);
      expect(board.size).toBe("compact");
      const boxes = [...board.projects.map((p) => p.box), ...board.tools.map((t) => t.box)];
      for (const box of boxes) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.w).toBeLessThanOrEqual(width);
        expect(box.y + box.h).toBeLessThanOrEqual(board.height);
      }
      for (const trace of board.traces) {
        for (const point of corners(trace.d)) {
          expect(point.x).toBeGreaterThan(0);
          expect(point.x).toBeLessThan(width);
        }
      }
      const chipsEnd = Math.max(...board.projects.map((p) => p.box.x + p.box.w));
      const toolsStart = Math.min(...board.tools.map((t) => t.box.x));
      // Room for the routing channel between the two columns.
      expect(toolsStart - chipsEnd).toBeGreaterThanOrEqual(56);
      const chips = board.projects.map((p) => p.box).sort((a, b) => a.y - b.y);
      chips.slice(1).forEach((box, k) => expect(box.y).toBeGreaterThanOrEqual(chips[k].y + chips[k].h));
    }
    expect(layoutBoard(1312).size).toBe("wide");
  });
});

describe("describeSelection", () => {
  it("words the readout for one or many", () => {
    const connections = projects.reduce((sum, p) => sum + p.tools.length, 0);
    expect(describeSelection(null)).toEqual({ value: idle, detail: plural(connections, "connection") });
    const single = tools.find((tool) => usersOf(tool).length === 1) ?? tools[0];
    expect(describeSelection({ kind: "tool", name: single })).toEqual({
      value: `${single} · used in 1 project`,
      detail: usersOf(single)[0],
    });
    expect(
      describeSelection({ kind: "project", name: "Solo" }, [{ name: "Solo", tools: ["Rust"] }]),
    ).toEqual({ value: "Solo · 1 tool", detail: "Rust" });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { skills } from "@/data/profile";
import { setMotionPaused } from "@/lib/motion-pause";
import Vault from "@/pages/Vault";
import { EDGES, NODES, edgePath, focusLayout, nextInDirection, pointOnEdge, skyLayout, usedIn, wrapLabel } from "./graph";

class QuietObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", QuietObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
  setMotionPaused(false);
});

describe("the skill chart's geometry", () => {
  it("places every skill once, in both layouts and both sizes", () => {
    expect(NODES.map((n) => n.id).sort()).toEqual(skills.map((s) => s.id).sort());
    for (const compact of [false, true]) {
      const sky = skyLayout(compact);
      const focus = focusLayout("python", compact);
      for (const node of NODES) {
        expect(sky[node.id]).toBeDefined();
        expect(focus[node.id]).toBeDefined();
      }
      expect(focus.python).toMatchObject({ x: 0, y: 0 });
    }
  });

  it("joins each linked pair once, whichever side lists the link", () => {
    const pairs = new Set(
      skills.flatMap((s) => s.connections.map((c) => [s.id, c].sort().join("~"))),
    );
    expect(EDGES.map((e) => e.id).sort()).toEqual([...pairs].sort());
  });

  it("starts and ends every line exactly at its stars' centres", () => {
    const d = edgePath(10, -20, 200, 40);
    expect(d.startsWith("M10 -20")).toBe(true);
    expect(d.endsWith(" 200 40")).toBe(true);
    expect(pointOnEdge(10, -20, 200, 40, 0)).toEqual({ x: 10, y: -20 });
    expect(pointOnEdge(10, -20, 200, 40, 1)).toEqual({ x: 200, y: 40 });
  });

  it("lists a project only where its stack names the skill exactly", () => {
    const python = skills.find((s) => s.id === "python")!;
    const cpp = skills.find((s) => s.id === "cpp")!;
    expect(usedIn(python).map((p) => p.name)).toEqual(["StudyForge", "AxiomQuant", "ReconPilot", "Inventory RL"]);
    // "C++20" is not "C++": no guessing.
    expect(usedIn(cpp)).toEqual([]);
  });

  it("wraps long names onto two lines and moves by arrow key towards the nearest star", () => {
    expect(wrapLabel("LangChain / LlamaIndex / Haystack")).toHaveLength(2);
    expect(wrapLabel("Docker")).toEqual(["Docker"]);
    const layout = focusLayout("python", false);
    const ids = NODES.map((n) => n.id);
    const right = nextInDirection("python", 1, 0, layout, ids);
    expect(right).not.toBeNull();
    expect(layout[right!].x).toBeGreaterThan(0);
  });
});

describe("the skill map page", () => {
  const renderAt = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Vault />
      </MemoryRouter>,
    );

  it("lists every skill and its description in the index", () => {
    act(() => setMotionPaused(true));
    renderAt("/vault");
    for (const skill of skills) expect(screen.getAllByText(skill.description).length).toBeGreaterThan(0);
  });

  it("opens the readout for the skill in the address and moves it from a linked chip", () => {
    act(() => setMotionPaused(true));
    renderAt("/vault?skill=python");
    const dossier = screen.getByRole("complementary", { name: "Selected skill" });
    expect(within(dossier).getByRole("heading", { name: "Python" })).toBeInTheDocument();
    expect(within(dossier).getByText("StudyForge")).toBeInTheDocument();
    fireEvent.click(within(dossier).getByRole("button", { name: /RAG & Retrieval/ }));
    expect(screen.getByRole("button", { name: /^RAG & Retrieval, AI\/ML/, pressed: true })).toBeInTheDocument();
  });

  it("selects a star with the keyboard and returns to the full chart with Escape", () => {
    act(() => setMotionPaused(true));
    renderAt("/vault");
    const star = screen.getByRole("button", { name: /^Docker, Cloud & DevOps/ });
    fireEvent.keyDown(star, { key: "Enter" });
    expect(screen.getByRole("button", { name: /^Docker, Cloud & DevOps/, pressed: true })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: /^Docker, Cloud & DevOps/ }), { key: "Escape" });
    expect(screen.getByRole("button", { name: /^Docker, Cloud & DevOps/, pressed: false })).toBeInTheDocument();
  });
});

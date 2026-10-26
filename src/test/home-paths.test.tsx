import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { OrdoRoutes } from "@/sites/ordo/App";

beforeAll(() => {
  class Observer {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("IntersectionObserver", Observer);
  vi.stubGlobal("ResizeObserver", Observer);
  HTMLCanvasElement.prototype.getContext = () => null;
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
});
afterEach(cleanup);

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <OrdoRoutes />
    </MemoryRouter>,
  );

describe("home", () => {
  it("offers an engineering path and a research path", () => {
    renderAt("/");
    const paths = screen.getByRole("region", { name: /two ways in|start here/i });

    const headings = within(paths).getAllByRole("heading");
    expect(headings).toHaveLength(2);
    expect(headings[0]).toHaveTextContent(/Hiring an AI engineer\?/);
    expect(headings[0]).toHaveTextContent(/Start with the projects\./);
    expect(headings[1]).toHaveTextContent(/Here for the research\?/);
    expect(headings[1]).toHaveTextContent(/Start with the proposal\./);

    // One list of three links under each heading, in the order the headings come.
    const lists = within(paths).getAllByRole("list");
    expect(lists).toHaveLength(2);
    const targets = (list: HTMLElement) =>
      within(list)
        .getAllByRole("link")
        .map((link) => [link.textContent?.trim(), link.getAttribute("href")]);
    expect(targets(lists[0])).toEqual([
      ["Projects with working demos", "/#work"],
      ["Client work at LetsTute", "/about#experience"],
      ["Public GitHub activity", "/#activity"],
    ]);
    expect(targets(lists[1])).toEqual([
      ["The proposal and its two studies", "/research"],
      ["Research log", "/research#research-log"],
      ["Write-ups", "/writing"],
    ]);
  });

  it("puts the two paths straight after the hero, before the first section", () => {
    const { container } = renderAt("/");
    const paths = screen.getByRole("region", { name: /two ways in|start here/i });
    const heroAction = screen.getByRole("link", { name: /See the projects/ });
    const firstSection = container.querySelector("#capabilities, #work");
    expect(firstSection).not.toBeNull();

    expect(heroAction.compareDocumentPosition(paths) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(paths.compareDocumentPosition(firstSection!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

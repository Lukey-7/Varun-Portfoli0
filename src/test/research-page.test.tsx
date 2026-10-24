import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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

describe("research page", () => {
  it("states interests, not plans", () => {
    const { container } = renderAt("/research");
    expect(screen.getByText("Research interests")).toBeInTheDocument();
    expect(screen.queryByText(/What I am looking for/)).toBeNull();

    // The shared layout's contact and footer copy is out of scope; check the page itself.
    const page = container.querySelector("article.research-page");
    expect(page).not.toBeNull();
    expect(page?.textContent).not.toMatch(/research position|open to|looking for|PhD|relocat/i);
  });
});

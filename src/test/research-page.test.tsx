import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { OrdoRoutes } from "@/sites/ordo/App";
import { researchLog } from "@/sites/ordo/researchLog";
import { ResearchLog } from "@/sites/ordo/components/ResearchLog";

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

  it("lists the research log newest first", () => {
    renderAt("/research");
    const log = screen.getByRole("region", { name: /research log/i });
    expect(log).toHaveAttribute("id", "research-log");
    // The label shown on the page names the section; there is no screen-reader-only text.
    expect(within(log).getByText("[ RESEARCH LOG ]")).toBeInTheDocument();
    expect(log.querySelector(".sr-only")).toBeNull();

    const entries = log.querySelectorAll(".research-log-entry");
    expect(entries).toHaveLength(researchLog.length);

    const first = entries[0] as HTMLElement;
    expect(within(first).getByRole("link")).toHaveAttribute("href", researchLog[0].to);

    // Dates are "YYYY-MM" or "YYYY"; a year on its own sorts before that year's months.
    const sortKey = (date: string) => date.padEnd(7, "-00");
    const dates = [...entries].map((entry) => entry.querySelector("time")?.getAttribute("datetime") ?? "");
    expect(dates.every(Boolean)).toBe(true);
    for (let i = 1; i < dates.length; i += 1) {
      expect(sortKey(dates[i - 1]) >= sortKey(dates[i])).toBe(true);
    }
  });

  it("puts the log between the hero and the studies, and gives the studies an anchor", () => {
    const { container } = renderAt("/research");
    const page = container.querySelector("article.research-page");
    const hero = page?.querySelector("header.page-hero");
    const log = page?.querySelector("#research-log");
    const studies = page?.querySelector("#studies");
    expect(hero && log && studies).toBeTruthy();
    expect(hero!.compareDocumentPosition(log!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(log!.compareDocumentPosition(studies!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders nothing for the slots an entry leaves empty", () => {
    const { container } = render(
      <MemoryRouter>
        <ResearchLog
          entries={[
            { date: "2026", kind: "reading", title: "A paper, no link, no note" },
            { date: "2025-03", kind: "experiment", title: "Outside link", href: "https://example.com/a" },
          ]}
        />
      </MemoryRouter>,
    );
    const [bare, outside] = [...container.querySelectorAll(".research-log-entry")];
    expect(bare.querySelector("a")).toBeNull();
    expect(bare.querySelector("p")).toBeNull();
    expect(bare.querySelector("time")).toHaveTextContent("2026");
    expect(outside.querySelector("p")).toBeNull();
    expect(outside.querySelector("a")).toHaveAttribute("href", "https://example.com/a");
    expect(outside.querySelector("a")).toHaveAttribute("rel", "noreferrer");
    expect(outside.querySelector("time")).toHaveTextContent("Mar 2025");
  });

  it("renders no section at all when the log is empty", () => {
    const { container } = render(
      <MemoryRouter>
        <ResearchLog entries={[]} />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("invites a role or a project without implying a research position", () => {
    renderAt("/research");
    expect(screen.getByText("research or a project.")).toBeInTheDocument();
    expect(screen.queryByText(/a research position or a project/i)).toBeNull();
  });
});

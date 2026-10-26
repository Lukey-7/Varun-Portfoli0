import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { OrdoRoutes } from "@/sites/ordo/App";
import { formatJourneyDate, journey } from "@/sites/ordo/journey";
import { applyShareHead, sharePages, siteUrl, sitemap } from "@/sites/ordo/share";

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

describe("journey", () => {
  it("formats known months and bare years", () => {
    expect(formatJourneyDate("2026-10")).toBe("Oct 2026");
    expect(formatJourneyDate("2024")).toBe("2024");
  });

  it("lists every entry and filters by kind", () => {
    const { container } = renderAt("/journey");
    expect(screen.getByRole("heading", { level: 1, name: /Work, projects and study/ })).toBeInTheDocument();
    expect(container.querySelectorAll(".journey-entry")).toHaveLength(journey.length);

    fireEvent.click(screen.getByRole("button", { name: /^Research/ }));
    expect(screen.getByRole("button", { name: /^Research/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/1 entry in research/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Research proposal on cutting LLM inference cost/ })).toHaveAttribute(
      "href",
      "/research",
    );
    // It says the proposal is written, not what is planned for it.
    expect(screen.getByText(/written up as a proposal\./)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/supervis/i);
  });
});

describe("writing", () => {
  it("renders the StudyForge write-up with its results", () => {
    renderAt("/writing/studyforge-evaluation");
    expect(screen.getByRole("heading", { level: 1, name: /What 33 questions showed/ })).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getByRole("rowheader", { name: "BM25 only" })).toBeInTheDocument();
    expect(screen.getByText("30 / 33")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /The project and its demo/ })).toHaveAttribute("href", "/work/studyforge");
  });

  it("lists write-ups and links each project to its own", () => {
    renderAt("/writing");
    expect(screen.getByRole("link", { name: /What 33 questions showed/ })).toHaveAttribute(
      "href",
      "/writing/studyforge-evaluation",
    );
    cleanup();
    renderAt("/work/studyforge");
    expect(screen.getByRole("link", { name: /Read the write-up/ })).toHaveAttribute(
      "href",
      "/writing/studyforge-evaluation",
    );
  });

  it("shows the site's not-found page for an unknown write-up", () => {
    renderAt("/writing/nope");
    expect(screen.getByRole("heading", { name: /Nothing here/ })).toBeInTheDocument();
  });
});

describe("share previews", () => {
  it("cover every page with its own image", () => {
    const paths = sharePages.map((page) => page.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(new Set(sharePages.map((page) => page.image)).size).toBe(sharePages.length);
    for (const path of ["/", "/research", "/journey", "/writing/studyforge-evaluation", "/work/arcade"]) {
      expect(paths).toContain(path);
    }
    expect(paths.filter((path) => path.startsWith("/work/"))).toHaveLength(6);
  });

  it("write the page's title and absolute share tags into the head", () => {
    const template =
      '<html><head><title>Old</title><meta name="description" content="old" />' +
      '<meta property="og:title" content="old" /><meta name="twitter:card" content="old" /></head></html>';
    const page = sharePages.find((item) => item.path === "/work/fintrack")!;
    const html = applyShareHead(template, page, "https://example.com");
    expect(html).toContain("<title>FinTrack | Varun Darji</title>");
    expect(html).toContain('<meta property="og:image" content="https://example.com/og/work-fintrack.png" />');
    expect(html).toContain('<link rel="canonical" href="https://example.com/work/fintrack" />');
    expect(html.match(/property="og:title"/g)).toHaveLength(1);
    expect(html.match(/name="twitter:card"/g)).toHaveLength(1);
    expect(sitemap("https://example.com", "2026-10-23")).toContain("<loc>https://example.com/journey</loc>");
  });

  it("take the site address from SITE_URL, then VITE_ORDO_URL, then Vercel", () => {
    expect(siteUrl({ SITE_URL: "https://a.dev/", VITE_ORDO_URL: "https://b.dev" })).toBe("https://a.dev");
    expect(siteUrl({ VITE_ORDO_URL: "https://b.dev" })).toBe("https://b.dev");
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "c.vercel.app" })).toBe("https://c.vercel.app");
  });
});

describe("site copy", () => {
  // The site never names the tools used to write or build it.
  it("does not mention AI writing or coding assistants", () => {
    const root = resolve(__dirname, "../..");
    const banned = new RegExp(["cla" + "ude", "anth" + "ropic", "chat" + "gpt", "copi" + "lot", "co" + "dex"].join("|"), "i");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(tsx?|css|md|json|html)$/.test(name) && name !== "github-activity.ts") files.push(path);
      }
    };
    walk(join(root, "src"));
    walk(join(root, "docs"));
    files.push(join(root, "README.md"), join(root, "index.html"));
    const offenders = files.filter((file) => banned.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});

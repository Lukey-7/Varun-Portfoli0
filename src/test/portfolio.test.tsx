import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CyanPage from "@/sites/cyan/CyanPage";
import { OrdoRoutes } from "@/sites/ordo/App";
import { OrdoWorkflow } from "@/sites/ordo/components/OrdoSections";
import { OrdoConsole } from "@/sites/ordo/components/OrdoExtras";

beforeAll(() => {
  class Observer {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("IntersectionObserver", Observer);
  vi.stubGlobal("ResizeObserver", Observer);
  // jsdom has no canvas; the artwork components skip drawing without a context.
  HTMLCanvasElement.prototype.getContext = () => null;
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
  // cmdk scrolls the highlighted item into view.
  Element.prototype.scrollIntoView = () => {};
  window.scrollTo = () => {};
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const renderOrdo = (path = "/") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <OrdoRoutes />
    </MemoryRouter>,
  );
const renderPortfolio = () =>
  render(
    <MemoryRouter>
      <CyanPage />
    </MemoryRouter>,
  );

describe("portfolio visitor journeys", () => {
  it("opens a FinTrack case study and closes it without losing the page", () => {
    renderPortfolio();
    fireEvent.click(
      screen.getByRole("button", { name: "Read FinTrack case study" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "FinTrack" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", { name: "View source" }),
    ).toHaveAttribute(
      "href",
      "https://github.com/Lukey-7/Personal_Finance_app",
    );
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Close case study" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("supports keyboard workflow navigation and changes the visible explanation", () => {
    render(<OrdoWorkflow />);
    fireEvent.keyDown(screen.getByRole("tab", { name: /Build/ }), {
      key: "ArrowDown",
    });
    expect(screen.getByRole("tab", { name: /Evaluate/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel")).toHaveTextContent(
      "33 labelled queries",
    );
    fireEvent.keyDown(screen.getByRole("tab", { name: /Evaluate/ }), {
      key: "End",
    });
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Docker + CI");
  });

  it("closes the mobile menu after choosing a section and switches appearance", () => {
    renderPortfolio();
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    fireEvent.click(
      within(
        screen.getByRole("navigation", { name: "Mobile navigation" }),
      ).getByRole("link", { name: /About/ }),
    );
    expect(
      screen.queryByRole("navigation", { name: "Mobile navigation" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Switch to light mode" }),
    );
    expect(document.documentElement.dataset.portfolioTheme).toBe("light");
  });

  it("copies the current contact address and reports clipboard failure", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderPortfolio();
    fireEvent.click(screen.getByRole("button", { name: "Copy email address" }));
    expect(
      await screen.findByRole("button", { name: "Email copied" }),
    ).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith("varun.darji07@gmail.com");
    cleanup();
    writeText.mockRejectedValue(new Error("Clipboard unavailable"));
    renderPortfolio();
    fireEvent.click(screen.getByRole("button", { name: "Copy email address" }));
    expect(
      await screen.findByText("Select the address to copy it."),
    ).toBeInTheDocument();
  });

  it("shows earlier employment details when its disclosure is opened", () => {
    renderPortfolio();
    const button = screen.getByRole("button", {
      name: /Java Backend Developer Intern Tech IT Research/,
    });
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText(
        "Integrated the PayPal AddTracking API for shipment and order tracking.",
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /AI Engineer LetsTute/ }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("answers console commands from the shared résumé data", () => {
    render(
      <MemoryRouter>
        <OrdoConsole />
      </MemoryRouter>,
    );
    const input = screen.getByRole("textbox", { name: "Terminal command" });
    fireEvent.change(input, { target: { value: "research" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText(/Adaptive conversation memory/)).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "xyz" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText(/Command not found: xyz/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ai" }));
    expect(screen.getByRole("button", { name: "ai" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText(/Document intelligence/)).toBeInTheDocument();
  });

  it("opens a case study from the cyan command palette", async () => {
    renderPortfolio();
    fireEvent.click(screen.getByRole("button", { name: "Open command palette" }));
    const palette = screen.getByRole("dialog", { name: "Command palette" });
    fireEvent.change(await within(palette).findByRole("combobox", {}, { timeout: 5000 }), {
      target: { value: "fintrack" },
    });
    fireEvent.click(within(palette).getByRole("option", { name: /FinTrack/ }));
    expect(
      screen.getByRole("heading", { name: "FinTrack", level: 2 }),
    ).toBeInTheDocument();
  });

  it("shows which messages each memory strategy sends", () => {
    renderPortfolio();
    expect(screen.getByRole("radio", { name: /Last 6 messages/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByText(/message 3 has left the window/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Adaptive memory/ }));
    expect(
      screen.getByText("Audience: school students · active · from #3"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Not a measured result/)).toBeInTheDocument();
  });

  it("lets Tab leave the terminal once a command is complete", () => {
    render(
      <MemoryRouter>
        <OrdoConsole />
      </MemoryRouter>,
    );
    const input = screen.getByRole("textbox", { name: "Terminal command" });
    fireEvent.change(input, { target: { value: "hel" } });
    expect(fireEvent.keyDown(input, { key: "Tab" })).toBe(false);
    expect(input).toHaveValue("help");
    // Already complete: Tab is not intercepted, so focus can move on (WCAG 2.1.2).
    expect(fireEvent.keyDown(input, { key: "Tab" })).toBe(true);
    expect(fireEvent.keyDown(input, { key: "Tab", shiftKey: true })).toBe(true);
  });

  it("presents the research proposal in full, as hypotheses", () => {
    renderOrdo("/research");
    expect(
      screen.getByRole("heading", { level: 1, name: /Can an LLM assistant cost less/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Calibrated retry policy" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/hypotheses to be tested/)).toBeInTheDocument();
  });

  it("links the home page to project pages and the full research proposal", () => {
    renderOrdo("/");
    expect(screen.getByRole("heading", { name: "Generative media" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sprachweg View project" })).toHaveAttribute(
      "href",
      "/work/sprachweg",
    );
    expect(screen.getByRole("link", { name: /Read the full proposal/ })).toHaveAttribute(
      "href",
      "/research",
    );
  });

  it("shows Sprachweg's page without a source link", () => {
    renderOrdo("/work/sprachweg");
    expect(screen.getByRole("heading", { level: 1, name: "Sprachweg" })).toBeInTheDocument();
    expect(screen.getByText(/not currently public/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /View on GitHub/ })).toBeNull();
  });

  it("links each project page to its neighbours", () => {
    renderOrdo("/work/fintrack");
    expect(screen.getByRole("heading", { level: 1, name: "FinTrack" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Next project.*MARA/ })).toHaveAttribute(
      "href",
      "/work/mara",
    );
    expect(screen.getByRole("link", { name: /Previous project.*StudyForge/ })).toHaveAttribute(
      "href",
      "/work/studyforge",
    );
  });

  it("shows a 404 for an unknown project", () => {
    renderOrdo("/work/nope");
    expect(screen.getByRole("heading", { name: /Nothing here/ })).toBeInTheDocument();
  });

  it("pauses every animation from the header pause button", () => {
    renderOrdo("/");
    fireEvent.click(screen.getAllByRole("button", { name: "Pause all animations" })[0]);
    expect(document.documentElement.dataset.motion).toBe("paused");
    fireEvent.click(screen.getAllByRole("button", { name: "Play all animations" })[0]);
    expect(document.documentElement.dataset.motion).toBeUndefined();
  });
});

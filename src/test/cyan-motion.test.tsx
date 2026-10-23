import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CyanPage from "@/sites/cyan/CyanPage";
import HeroField from "@/sites/cyan/motion/HeroField";
import { decodeFrame } from "@/sites/cyan/motion/DecodeText";
import { LocalClock } from "@/sites/cyan/motion/LocalClock";
import { setMotionPaused } from "@/lib/motion-pause";

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
  setMotionPaused(false);
});

describe("decode effect", () => {
  it("keeps spaces, scrambles the rest, then lands on the text", () => {
    const text = "AI ENGINEER / MUMBAI";
    const start = decodeFrame(text, 0, () => 0);
    expect(start).toHaveLength(text.length);
    expect([...start].filter((char, i) => text[i] === " ").every((char) => char === " ")).toBe(true);
    expect(decodeFrame(text, 0.5, () => 0).startsWith(text.slice(0, 10))).toBe(true);
    expect(decodeFrame(text, 1)).toBe(text);
  });
});

describe("hero field", () => {
  it("falls back to a vector outline without WebGL2 and toggles its form", () => {
    const { container } = render(<HeroField />);
    expect(container.querySelector(".hero-field-gl")).toHaveAttribute("data-gl", "off");
    expect(container.querySelector(".hero-field-fallback path")).toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Scatter into clusters" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Re-form the knot" })).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelector(".hero-field-hud")).toHaveTextContent("6 CLUSTERS");
  });
});

describe("cyan page", () => {
  it("shows Mumbai time as a 24-hour readout", () => {
    render(<LocalClock />);
    expect(screen.getByText(/^\d{2}:\d{2} IST$/)).toBeInTheDocument();
  });

  it("has one switch that pauses every animation", () => {
    render(
      <MemoryRouter>
        <CyanPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Pause all animations" }));
    expect(document.documentElement.dataset.motion).toBe("paused");
    expect(screen.getByRole("button", { name: "Play all animations" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /mesh sculpture/i })).toBeNull();
  });
});

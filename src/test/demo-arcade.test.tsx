import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ArcadeDemo, { ArcadeCabinet } from "@/sites/ordo/demos/ArcadeDemo";
import { setMotionPaused } from "@/lib/motion-pause";

/** Records every ResizeObserver so a test can report a new width. */
class FakeResizeObserver {
  static all: FakeResizeObserver[] = [];
  target: Element | null = null;
  constructor(public callback: ResizeObserverCallback) {
    FakeResizeObserver.all.push(this);
  }
  observe(target: Element) {
    this.target = target;
  }
  unobserve() {}
  disconnect() {
    this.target = null;
  }
}

/** Pretend the cabinet's screen area is `width` pixels wide. */
function resizeFit(width: number) {
  const live = FakeResizeObserver.all.filter((observer) => observer.target);
  const observer = live[live.length - 1];
  expect(observer?.target).toHaveClass("arcade-cabinet__fit");
  act(() => {
    observer.callback(
      [{ contentRect: { width } } as unknown as ResizeObserverEntry],
      observer as unknown as ResizeObserver,
    );
  });
}

const cartridge = (name: string) => screen.getByRole("button", { name });
const pressStart = () => fireEvent.click(screen.getByRole("button", { name: /press start/i }));
const legend = () => screen.getByRole("group", { name: "Controls" });
const rowFor = (action: string) => within(legend()).getByText(action).closest(".arcade-cabinet__key-row");

beforeAll(() => {
  window.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
});
afterEach(() => {
  cleanup();
  FakeResizeObserver.all = [];
  setMotionPaused(false);
});

describe("Lukey Arcade cabinet", () => {
  it("shows two cartridges and loads nothing until the visitor presses start", () => {
    const { container } = render(<ArcadeCabinet />);
    expect(screen.getByRole("group", { name: "Choose a game" })).toBeInTheDocument();
    expect(cartridge("Tetris-89 Mini")).toHaveAttribute("aria-pressed", "true");
    expect(cartridge("Star Vanguard Mini")).toHaveAttribute("aria-pressed", "false");
    expect(cartridge("Tetris-89 Mini")).toHaveAccessibleDescription(
      /Modes Marathon\s?, 40-Line Sprint\s?, 2-Minute Blitz\s?, Zen\s?, Daily/,
    );
    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.getByText("P1 / Ready")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /restart/i })).toBeDisabled();
  });

  it("creates the game-only page on start and hands it the keyboard", async () => {
    render(<ArcadeCabinet />);
    pressStart();
    const frame = screen.getByTitle("Tetris-89 Mini (playable game)");
    expect(frame).toHaveAttribute("src", "/play/arcade/popup.html");
    expect(frame).toHaveAttribute("width", "380");
    expect(frame).toHaveAttribute("height", "640");
    expect(document.activeElement).toBe(frame);
    expect(frame).toHaveAccessibleDescription(/Click the game to give it the keyboard/);
    await waitFor(() => expect(screen.getByText("P1 / Playing")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /open the full arcade/i })).toHaveAttribute(
      "href",
      "/play/arcade/index.html",
    );
  });

  it("restart reloads the game in a fresh frame", () => {
    render(<ArcadeCabinet />);
    pressStart();
    const first = screen.getByTitle("Tetris-89 Mini (playable game)");
    fireEvent.click(screen.getByRole("button", { name: /restart/i }));
    const second = screen.getByTitle("Tetris-89 Mini (playable game)");
    expect(second).not.toBe(first);
    expect(first.isConnected).toBe(false);
    expect(document.activeElement).toBe(second);
  });

  it("switching cartridges returns to the cover for the new game", () => {
    const { container } = render(<ArcadeCabinet />);
    pressStart();
    fireEvent.click(cartridge("Star Vanguard Mini"));
    expect(cartridge("Star Vanguard Mini")).toHaveAttribute("aria-pressed", "true");
    expect(cartridge("Tetris-89 Mini")).toHaveAttribute("aria-pressed", "false");
    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.getByRole("button", { name: /press start/i })).toHaveAccessibleName(
      /Star Vanguard Mini/,
    );
    pressStart();
    const frame = screen.getByTitle("Star Vanguard Mini (playable game)");
    expect(frame).toHaveAttribute("src", "/play/arcade/space_popup.html");
    expect(frame).toHaveAttribute("width", "480");
    expect(frame).toHaveAttribute("height", "700");
    const link = screen.getByRole("link", { name: /open the full arcade/i });
    expect(link).toHaveAttribute("href", "/play/arcade/space.html");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("scales the native page uniformly to the measured width, capped at 1.25x", () => {
    const { container } = render(<ArcadeCabinet />);
    const screenBox = () => container.querySelector<HTMLElement>(".arcade-cabinet__screen")!;
    resizeFit(304);
    expect(screenBox().style.width).toBe("304px");
    expect(screenBox().style.height).toBe("512px");
    pressStart();
    const frame = screen.getByTitle("Tetris-89 Mini (playable game)");
    expect(frame.style.width).toBe("380px");
    expect(frame.style.height).toBe("640px");
    expect(frame.style.transform).toBe("scale(0.8)");

    resizeFit(900);
    expect(frame.style.transform).toBe("scale(1.25)");
    expect(screenBox().style.width).toBe("475px");
    expect(screenBox().style.height).toBe("800px");

    fireEvent.click(cartridge("Star Vanguard Mini"));
    resizeFit(384);
    expect(screenBox().style.width).toBe("384px");
    expect(screenBox().style.height).toBe("560px");
  });

  it("lists the verified keys for each game", () => {
    render(<ArcadeCabinet />);
    expect(rowFor("Hard drop")).toHaveTextContent("Space");
    expect(rowFor("Hold")).toHaveTextContent(/C\s*\/\s*or\s*Shift/);
    expect(rowFor("Pause")).toHaveTextContent(/P.*Escape/);
    expect(rowFor("Mute")).toHaveTextContent("M");
    expect(within(legend()).getByText(/flick down to drop/)).toBeInTheDocument();

    fireEvent.click(cartridge("Star Vanguard Mini"));
    expect(rowFor("Nova bomb")).toHaveTextContent(/X.*B/);
    expect(rowFor("Fire (hold)")).toHaveTextContent(/Space.*Z/);
    // The game has no mute or restart key while playing, so none is listed.
    expect(within(legend()).queryByText("Mute")).toBeNull();
    expect(within(legend()).queryByText("Restart")).toBeNull();
    expect(within(legend()).getByText(/right-click for a Nova bomb/)).toBeInTheDocument();
  });

  it("stops the game's scroll keys from scrolling the page around it", () => {
    render(<ArcadeCabinet initialGame="space" />);
    pressStart();
    const frame = screen.getByTitle<HTMLIFrameElement>("Star Vanguard Mini (playable game)");
    const win = frame.contentWindow as Window & typeof globalThis;
    const doc = frame.contentDocument!;
    // jsdom loads no subresources: give the empty frame a body, and a focus().
    win.focus = () => {};
    if (!doc.documentElement) doc.appendChild(doc.createElement("html"));
    if (!doc.body) doc.documentElement.appendChild(doc.createElement("body"));
    fireEvent.load(frame);
    const press = (target: EventTarget, key: string) => {
      const event = new win.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(press(doc.body, "ArrowDown")).toBe(true);
    expect(press(doc.body, " ")).toBe(true);
    expect(press(doc.body, "a")).toBe(false);
    const field = doc.createElement("select");
    doc.body.appendChild(field);
    expect(press(field, "ArrowDown")).toBe(false);
  });

  it("adds the details panel only at full size", () => {
    render(<ArcadeCabinet size="full" />);
    const details = screen.getByRole("group", { name: "About this game" });
    expect(details).toHaveTextContent(/Web Audio/);
    expect(details).toHaveTextContent(/Game Boy, NES, Cyberpunk Neon and Matrix Phosphor/);
    cleanup();
    render(<ArcadeCabinet />);
    expect(screen.queryByRole("group", { name: "About this game" })).toBeNull();
  });

  it("stops its blinking light when the page-wide motion pause is on", () => {
    const { container } = render(<ArcadeCabinet />);
    const root = container.querySelector(".arcade-cabinet")!;
    expect(root).not.toHaveClass("is-still");
    act(() => setMotionPaused(true));
    expect(root).toHaveClass("is-still");
  });

  it("wraps the compact cabinet in the shared demo shell", () => {
    render(<ArcadeDemo />);
    const frame = screen.getByRole("region", { name: "Lukey Arcade demo" });
    expect(frame).toHaveClass("arcade-demo");
    expect(within(frame).getByText(/TRY IT \/ LUKEY ARCADE/)).toBeInTheDocument();
    expect(within(frame).getByText(/Saves and settings stay in your browser/)).toBeInTheDocument();
    expect(frame.querySelector(".arcade-cabinet")).toHaveClass("is-compact");
  });
});

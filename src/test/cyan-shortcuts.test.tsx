import { useState, type ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CyanPage from "@/sites/cyan/CyanPage";
import { setMotionPaused } from "@/lib/motion-pause";
import { SHORTCUTS, ShortcutsDialog, useShortcuts } from "@/sites/cyan/components/Shortcuts";

// framer-motion reads the media query once per module, so a test sets this instead.
const reduced = vi.hoisted(() => ({ value: false }));
vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => reduced.value,
}));

// The site never names the tools used to write or build it. Split so this file passes its own scan.
const banned = new RegExp(["cla" + "ude", "anth" + "ropic", "chat" + "gpt", "copi" + "lot", "co" + "dex"].join("|"), "i");

const scrollIntoView = vi.fn();

beforeAll(() => {
  class Observer {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("IntersectionObserver", Observer);
  vi.stubGlobal("ResizeObserver", Observer);
  HTMLCanvasElement.prototype.getContext = () => null;
  // jsdom has no modal dialogs; model what the page relies on.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
  Element.prototype.scrollIntoView = scrollIntoView;
  window.scrollTo = () => {};
});
beforeEach(() => {
  scrollIntoView.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  reduced.value = false;
  setMotionPaused(false);
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <CyanPage />
    </MemoryRouter>,
  );

const press = (key: string, init: KeyboardEventInit = {}, target: Element = document.body) =>
  fireEvent.keyDown(target, { key, ...init });

function makeActions() {
  return {
    toggleTheme: vi.fn(),
    toggleMotion: vi.fn(),
    showHelp: vi.fn(),
    go: vi.fn(),
  };
}

function Harness({ actions, children }: { actions: ReturnType<typeof makeActions>; children?: ReactNode }) {
  useShortcuts(actions);
  return <div>{children}</div>;
}

// This must stay the first test: the once-only flag is per module, so it is the
// first page render in this file that logs.
describe("console note", () => {
  it("logs one plain line when the page mounts, and only once", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { unmount } = renderPage();
    unmount();
    renderPage();
    expect(info).toHaveBeenCalledTimes(1);
    const line = String(info.mock.calls[0][0]);
    expect(line).toMatch(/Press \? for shortcuts/);
    expect(line).not.toMatch(banned);
  });

  it("logs once however often it is asked", async () => {
    vi.resetModules();
    const fresh = await import("@/sites/cyan/components/Shortcuts");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    fresh.logConsoleNote();
    fresh.logConsoleNote();
    expect(info).toHaveBeenCalledTimes(1);
  });
});

describe("useShortcuts", () => {
  it("lists the palette keys for the help sheet but leaves them to the palette", () => {
    expect(SHORTCUTS.map((item) => item.keys)).toEqual(
      expect.arrayContaining(["/", "Ctrl K", "?", "t", ".", "g w", "g r", "g e", "g c"]),
    );
    const actions = makeActions();
    render(<Harness actions={actions} />);
    // Neither is handled here, so neither is cancelled: the palette's own listener does that.
    expect(press("/")).toBe(true);
    expect(press("k", { ctrlKey: true })).toBe(true);
    expect(press("k", { metaKey: true })).toBe(true);
    for (const fn of Object.values(actions)) expect(fn).not.toHaveBeenCalled();
  });

  it("switches theme on t from the page", () => {
    const actions = makeActions();
    render(<Harness actions={actions} />);
    press("t");
    expect(actions.toggleTheme).toHaveBeenCalledTimes(1);
  });

  it("accepts a capital letter, for caps lock", () => {
    const actions = makeActions();
    render(<Harness actions={actions} />);
    press("T", { shiftKey: true });
    expect(actions.toggleTheme).toHaveBeenCalledTimes(1);
  });

  it("toggles motion on . and opens the help on ?", () => {
    const actions = makeActions();
    render(<Harness actions={actions} />);
    press(".");
    expect(actions.toggleMotion).toHaveBeenCalledTimes(1);
    press("?", { shiftKey: true });
    expect(actions.showHelp).toHaveBeenCalledTimes(1);
  });

  it("ignores a held key", () => {
    const actions = makeActions();
    render(<Harness actions={actions} />);
    press("t", { repeat: true });
    expect(actions.toggleTheme).not.toHaveBeenCalled();
  });

  it("does nothing while the visitor types in a field", () => {
    const actions = makeActions();
    render(
      <Harness actions={actions}>
        <input aria-label="name" />
        <textarea aria-label="message" />
        <select aria-label="pick">
          <option>one</option>
        </select>
        <div contentEditable="true" suppressContentEditableWarning aria-label="notes" />
      </Harness>,
    );
    for (const element of [
      screen.getByLabelText("name"),
      screen.getByLabelText("message"),
      screen.getByLabelText("pick"),
      screen.getByLabelText("notes"),
    ]) {
      press("t", {}, element);
      press(".", {}, element);
      press("?", {}, element);
      press("g", {}, element);
      press("r", {}, element);
    }
    for (const fn of Object.values(actions)) expect(fn).not.toHaveBeenCalled();
  });

  it("does nothing inside an open dialog", () => {
    const actions = makeActions();
    render(
      <Harness actions={actions}>
        <dialog open>
          <button>inside</button>
        </dialog>
      </Harness>,
    );
    press("t", {}, screen.getByRole("button", { name: "inside" }));
    expect(actions.toggleTheme).not.toHaveBeenCalled();
  });

  it("does nothing while any dialog is open, even if focus has fallen back to the page", () => {
    const actions = makeActions();
    render(
      <Harness actions={actions}>
        <dialog open>
          <button>inside</button>
        </dialog>
      </Harness>,
    );
    press("t");
    expect(actions.toggleTheme).not.toHaveBeenCalled();
  });

  it.each([
    ["ctrlKey", { ctrlKey: true }],
    ["metaKey", { metaKey: true }],
    ["altKey", { altKey: true }],
  ])("leaves browser shortcuts alone with %s", (_name, modifier) => {
    const actions = makeActions();
    render(<Harness actions={actions} />);
    press("t", modifier);
    press(".", modifier);
    press("g", modifier);
    press("r", modifier);
    for (const fn of Object.values(actions)) expect(fn).not.toHaveBeenCalled();
  });

  it.each([
    ["w", "#work"],
    ["r", "#research"],
    ["e", "#experience"],
    ["c", "#contact"],
  ])("g then %s jumps to %s", (second, hash) => {
    const actions = makeActions();
    render(<Harness actions={actions} />);
    press("g");
    press(second);
    expect(actions.go).toHaveBeenCalledTimes(1);
    expect(actions.go).toHaveBeenCalledWith(hash);
  });

  it("waits a full second for the second key, but not longer", () => {
    vi.useFakeTimers();
    const actions = makeActions();
    render(<Harness actions={actions} />);
    press("g");
    act(() => {
      vi.advanceTimersByTime(900);
    });
    press("r");
    expect(actions.go).toHaveBeenCalledWith("#research");

    actions.go.mockClear();
    press("g");
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    press("r");
    expect(actions.go).not.toHaveBeenCalled();
  });

  it("uses each g once: a second r after the jump does nothing", () => {
    const actions = makeActions();
    render(<Harness actions={actions} />);
    press("g");
    press("r");
    press("r");
    expect(actions.go).toHaveBeenCalledTimes(1);
  });

  it("drops a pending g when another key comes, which keeps its own meaning", () => {
    const actions = makeActions();
    render(<Harness actions={actions} />);
    press("g");
    press("t");
    expect(actions.toggleTheme).toHaveBeenCalledTimes(1);
    press("r");
    expect(actions.go).not.toHaveBeenCalled();
  });

  it("lets a modifier pause the pending g but not a bare Shift", () => {
    const actions = makeActions();
    render(<Harness actions={actions} />);
    press("g");
    press("Shift", { shiftKey: true });
    press("R", { shiftKey: true });
    expect(actions.go).toHaveBeenCalledWith("#research");
    actions.go.mockClear();
    press("g");
    press("r", { ctrlKey: true });
    press("r");
    expect(actions.go).not.toHaveBeenCalled();
  });

  it("stops listening when the page goes away", () => {
    const actions = makeActions();
    const { unmount } = render(<Harness actions={actions} />);
    unmount();
    press("t");
    expect(actions.toggleTheme).not.toHaveBeenCalled();
  });

  it("calls the latest actions, not the ones it first saw", () => {
    const first = makeActions();
    const second = makeActions();
    const { rerender } = render(<Harness actions={first} />);
    rerender(<Harness actions={second} />);
    press("t");
    expect(first.toggleTheme).not.toHaveBeenCalled();
    expect(second.toggleTheme).toHaveBeenCalledTimes(1);
  });
});

describe("ShortcutsDialog", () => {
  it("is empty and closed until it is opened", () => {
    render(<ShortcutsDialog open={false} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("lists every shortcut with its keys", () => {
    render(<ShortcutsDialog open onClose={() => {}} />);
    const dialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    for (const { label } of SHORTCUTS) expect(within(dialog).getByText(label)).toBeInTheDocument();
    expect(within(within(dialog).getByRole("list")).getAllByText("g")).toHaveLength(4);
  });

  it("closes with Escape, the close button or a click on the backdrop", () => {
    const onClose = vi.fn();
    render(<ShortcutsDialog open onClose={onClose} />);
    const dialog = screen.getByRole("dialog");
    // Escape reaches a <dialog> as a cancel event.
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole("button", { name: "Close keyboard shortcuts" }));
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(3);
    fireEvent.click(within(dialog).getByRole("heading", { name: "Keyboard shortcuts" }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("moves focus in on open and gives it back to the opener on close", () => {
    const Host = () => {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>opener</button>
          <ShortcutsDialog open={open} onClose={() => setOpen(false)} />
        </>
      );
    };
    render(<Host />);
    const opener = screen.getByRole("button", { name: "opener" });
    opener.focus();
    fireEvent.click(opener);
    const close = screen.getByRole("button", { name: "Close keyboard shortcuts" });
    expect(close).toHaveFocus();
    fireEvent.click(close);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});

describe("shortcuts on the cyan page", () => {
  it("opens the help sheet on ? and lists every shortcut", () => {
    renderPage();
    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).not.toBeInTheDocument();
    press("?", { shiftKey: true });
    const dialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    for (const { label } of SHORTCUTS) expect(within(dialog).getByText(label)).toBeInTheDocument();
  });

  it("closes the help sheet with Escape and puts focus back on the footer hint", () => {
    renderPage();
    const hint = screen.getByRole("button", { name: "Press ? for shortcuts" });
    hint.focus();
    fireEvent.click(hint);
    const dialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).not.toBeInTheDocument();
    expect(hint).toHaveFocus();
  });

  it("does not act on keys typed inside the help sheet", () => {
    renderPage();
    press("?", { shiftKey: true });
    const dialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    const root = document.querySelector(".cyan-edition")!;
    press("t", {}, within(dialog).getByRole("button", { name: "Close keyboard shortcuts" }));
    expect(root).toHaveAttribute("data-theme", "dark");
  });

  it("switches theme on t", () => {
    renderPage();
    const root = document.querySelector(".cyan-edition")!;
    expect(root).toHaveAttribute("data-theme", "dark");
    press("t");
    expect(root).toHaveAttribute("data-theme", "light");
    press("t");
    expect(root).toHaveAttribute("data-theme", "dark");
  });

  it("pauses and resumes motion on . like the header button", () => {
    renderPage();
    expect(screen.getByRole("button", { name: "Pause all animations" })).toBeInTheDocument();
    press(".");
    expect(document.documentElement.dataset.motion).toBe("paused");
    expect(screen.getByRole("button", { name: "Play all animations" })).toBeInTheDocument();
    press(".");
    expect(document.documentElement.dataset.motion).toBeUndefined();
    expect(screen.getByRole("button", { name: "Pause all animations" })).toBeInTheDocument();
  });

  it("leaves motion alone when the visitor already asked for reduced motion", () => {
    reduced.value = true;
    renderPage();
    press(".");
    expect(document.documentElement.dataset.motion).toBeUndefined();
  });

  it.each([
    ["w", "work"],
    ["r", "research"],
    ["e", "experience"],
    ["c", "contact"],
  ])("jumps to #%s with g then the letter", (letter, id) => {
    renderPage();
    press("g");
    press(letter);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect((scrollIntoView.mock.contexts[0] as HTMLElement).id).toBe(id);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth" });
  });

  it("jumps without easing under reduced motion", () => {
    reduced.value = true;
    renderPage();
    press("g");
    press("r");
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto" });
  });

  it("shows the hint in the footer", () => {
    renderPage();
    const footer = document.querySelector(".portfolio-footer") as HTMLElement;
    expect(within(footer).getByRole("button", { name: "Press ? for shortcuts" })).toBeInTheDocument();
  });
});

describe("shortcuts and the command palette", () => {
  it("ignores keys typed into the palette's search box", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Open command palette" }));
    const palette = screen.getByRole("dialog", { name: "Command palette" });
    const input = await within(palette).findByRole("combobox", {}, { timeout: 5000 });
    const root = document.querySelector(".cyan-edition")!;
    fireEvent.change(input, { target: { value: "t" } });
    press("t", {}, input);
    press("?", { shiftKey: true }, input);
    press(".", {}, input);
    expect(root).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement.dataset.motion).toBeUndefined();
    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).not.toBeInTheDocument();
  });

  it("opens the shortcuts from the palette", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Open command palette" }));
    const palette = screen.getByRole("dialog", { name: "Command palette" });
    fireEvent.change(await within(palette).findByRole("combobox", {}, { timeout: 5000 }), {
      target: { value: "shortcuts" },
    });
    fireEvent.click(within(palette).getByRole("option", { name: /Show keyboard shortcuts/ }));
    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
  });

  it("pauses and resumes motion from the palette", async () => {
    renderPage();
    for (const expected of ["paused", undefined]) {
      fireEvent.click(screen.getByRole("button", { name: "Open command palette" }));
      const palette = screen.getByRole("dialog", { name: "Command palette" });
      fireEvent.change(await within(palette).findByRole("combobox", {}, { timeout: 5000 }), {
        target: { value: "motion" },
      });
      fireEvent.click(within(palette).getByRole("option", { name: /Pause \/ resume motion/ }));
      expect(document.documentElement.dataset.motion).toBe(expected);
    }
  });
});

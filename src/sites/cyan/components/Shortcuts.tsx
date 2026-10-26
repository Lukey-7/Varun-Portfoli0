import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import "./shortcuts.css";

/**
 * Every key the page answers to, for the help sheet. `/` and `Ctrl K` belong to
 * the command palette, which listens for them itself; they are listed here only
 * so the sheet is complete. Labels are unique: the sheet and its test key on them.
 */
// eslint-disable-next-line react-refresh/only-export-components -- the key list is shared with the page's tests
export const SHORTCUTS: readonly { keys: string; label: string }[] = [
  { keys: "/", label: "Open the command palette" },
  { keys: "Ctrl K", label: "Open or close it from anywhere (⌘ K on a Mac)" },
  { keys: "?", label: "Show this list" },
  { keys: "t", label: "Switch between light and dark" },
  { keys: ".", label: "Pause or resume motion" },
  { keys: "g w", label: "Jump to Selected work" },
  { keys: "g r", label: "Jump to Research" },
  { keys: "g e", label: "Jump to Experience" },
  { keys: "g c", label: "Jump to Contact" },
];

/** The key after `g`, and the section it jumps to. */
const GO_TARGETS: ReadonlyMap<string, string> = new Map([
  ["w", "#work"],
  ["r", "#research"],
  ["e", "#experience"],
  ["c", "#contact"],
]);

/** Keys typed here, or while a dialog is up, belong to that control and not to the page. */
const IGNORED_TARGETS = "input, textarea, select, [contenteditable=true], dialog[open]";

/** How long `g` waits for its second key. */
const CHORD_WINDOW_MS = 1000;

export interface ShortcutActions {
  toggleTheme: () => void;
  toggleMotion: () => void;
  showHelp: () => void;
  go: (hash: string) => void;
}

/**
 * Single-key shortcuts for the whole page: `t` theme, `.` motion, `?` help and
 * `g` then `w`, `r`, `e` or `c` to jump to a section. Nothing fires while the
 * visitor is typing, while a dialog is open or with Ctrl, Cmd or Alt held, so
 * the browser's own shortcuts and every form field keep working.
 */
// eslint-disable-next-line react-refresh/only-export-components -- the hook lives beside the help sheet it documents
export function useShortcuts(actions: ShortcutActions): void {
  // The listener is added once; it always calls the actions from the latest render.
  const latest = useRef(actions);
  useEffect(() => {
    latest.current = actions;
  });

  useEffect(() => {
    let armed: ReturnType<typeof setTimeout> | undefined;
    const disarm = () => {
      clearTimeout(armed);
      armed = undefined;
    };

    const onKey = (event: KeyboardEvent) => {
      // A held key repeats, and a bare Shift is only half of `?` or a capital.
      if (event.repeat || event.isComposing || event.key === "Shift") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return disarm();
      const target = event.target;
      // A modal makes the page inert, but focus can still fall back to <body>.
      if (
        (target instanceof Element && target.closest(IGNORED_TARGETS)) ||
        document.querySelector("dialog[open]")
      ) {
        return disarm();
      }

      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (armed !== undefined) {
        disarm();
        const hash = GO_TARGETS.get(key);
        if (hash) return latest.current.go(hash);
      }
      switch (key) {
        case "g":
          armed = setTimeout(() => {
            armed = undefined;
          }, CHORD_WINDOW_MS);
          break;
        case "t":
          latest.current.toggleTheme();
          break;
        case ".":
          latest.current.toggleMotion();
          break;
        case "?":
          latest.current.showHelp();
          break;
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      disarm();
    };
  }, []);
}

/**
 * The help sheet: a native modal <dialog> like the command palette. Escape and
 * a click on the backdrop close it, and focus goes back to whatever opened it.
 */
export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  // What the page last asked for. A dialog that closes while this is still `true` was closed by the
  // browser and not by the page, so the page has not heard of it yet.
  const asked = useRef(open);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    asked.current = open;
    if (open) {
      wasOpen.current = true;
      if (!dialog.open) {
        opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        dialog.showModal();
        closeRef.current?.focus();
      }
    } else {
      if (dialog.open) dialog.close();
      if (wasOpen.current) {
        wasOpen.current = false;
        // Browsers do this on close(); doing it here as well covers the ones that do not.
        if (opener.current?.isConnected) opener.current.focus();
        opener.current = null;
      }
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="shortcuts-dialog"
      aria-label="Keyboard shortcuts"
      onCancel={onClose}
      // Escape normally cancels first, but a browser can close a modal without it. Either way `close`
      // follows, so the page hears of it here. When the page itself closed the dialog (or Escape was
      // already reported through `cancel`) `asked` is false by now and nothing is reported twice.
      onClose={() => {
        if (asked.current) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {open && (
        <div className="shortcuts-body">
          <div className="shortcuts-head">
            <h2>Keyboard shortcuts</h2>
            <button
              ref={closeRef}
              type="button"
              className="icon-button shortcuts-close"
              onClick={onClose}
              aria-label="Close keyboard shortcuts"
            >
              <X size={18} />
            </button>
          </div>
          <ul className="shortcuts-list">
            {SHORTCUTS.map(({ keys, label }) => (
              <li key={keys}>
                <span className="shortcuts-keys">
                  {keys.split(" ").map((key) => (
                    <kbd key={key} className="mono">
                      {key}
                    </kbd>
                  ))}
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ul>
          <p className="shortcuts-note">
            For <kbd className="mono">g</kbd> shortcuts, press the second key within a second. Letter
            shortcuts wait while you type in a field or have a dialog open.
          </p>
        </div>
      )}
    </dialog>
  );
}

const CONSOLE_NOTE =
  "Hello. This page is built with React, WebGL2, Canvas and SVG. Press ? for shortcuts.";
let noted = false;

/** One plain line in the browser console, the first time the page mounts. */
// eslint-disable-next-line react-refresh/only-export-components -- a plain helper, exported so the page and its tests can call it
export function logConsoleNote(): void {
  if (noted) return;
  noted = true;
  console.info(CONSOLE_NOTE);
}

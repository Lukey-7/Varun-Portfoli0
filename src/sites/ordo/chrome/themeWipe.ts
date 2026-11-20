import { flushSync } from "react-dom";
import { isMotionPaused } from "@/lib/motion-pause";

const WIPE_CLASS = "ordo-theme-wipe";

/**
 * Applies a theme change as one clean top-to-bottom wipe, like a sheet being
 * turned, where the browser supports view transitions. Otherwise, under
 * reduced motion or with animations paused, the change is simply instant.
 */
export function withThemeWipe(update: () => void, reduced: boolean) {
  const root = document.documentElement;
  if (reduced || isMotionPaused() || typeof document.startViewTransition !== "function") {
    update();
    return;
  }
  root.classList.add(WIPE_CLASS);
  // The browser runs the update once it has a frame to capture; a page that is
  // not painting would leave the button feeling dead, so never wait long.
  let applied = false;
  const apply = () => {
    if (applied) return;
    applied = true;
    flushSync(update);
  };
  const fallback = window.setTimeout(apply, 300);
  try {
    const transition = document.startViewTransition(apply);
    const done = () => {
      window.clearTimeout(fallback);
      root.classList.remove(WIPE_CLASS);
    };
    transition.finished.then(done, done);
    // A wipe cut short by a second click rejects these; that is expected.
    transition.ready.catch(() => {});
    transition.updateCallbackDone.catch(() => {});
  } catch {
    window.clearTimeout(fallback);
    root.classList.remove(WIPE_CLASS);
    apply();
  }
}

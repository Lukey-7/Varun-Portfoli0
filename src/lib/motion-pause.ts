import { useEffect, useState } from "react";

/**
 * One switch that pauses every looping animation on the page (WCAG 2.2.2).
 * The state lives on <html data-motion="paused"> so CSS animations can pause
 * too; canvas loops and timers read it through these helpers.
 */
const listeners = new Set<(paused: boolean) => void>();

export const isMotionPaused = () =>
  typeof document !== "undefined" && document.documentElement.dataset.motion === "paused";

export function setMotionPaused(paused: boolean) {
  if (paused) document.documentElement.dataset.motion = "paused";
  else delete document.documentElement.dataset.motion;
  listeners.forEach((listener) => listener(paused));
}

export function useMotionPaused() {
  const [paused, setPaused] = useState(isMotionPaused);
  useEffect(() => {
    listeners.add(setPaused);
    return () => {
      listeners.delete(setPaused);
    };
  }, []);
  return paused;
}

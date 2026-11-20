import { useCallback, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useReducedMotion } from "framer-motion";
import { useMotionPaused } from "@/lib/motion-pause";

/** True when decorative motion may run: no reduced-motion preference and not paused. */
export function useMotionAllowed() {
  const reduced = useReducedMotion();
  const paused = useMotionPaused();
  return !reduced && !paused;
}

/**
 * A horizontal swipe on touch or pen. Mouse drags are left alone so a click
 * still opens the full-screen view. `consumed()` tells a click handler that
 * the pointer has just swiped, so the swipe does not also count as a tap.
 */
export function useSwipe(onSwipe: (step: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  const onPointerDown = useCallback((event: ReactPointerEvent) => {
    if (event.pointerType === "mouse") return;
    start.current = { x: event.clientX, y: event.clientY };
    swiped.current = false;
  }, []);

  const onPointerUp = useCallback(
    (event: ReactPointerEvent) => {
      const from = start.current;
      start.current = null;
      if (!from) return;
      const dx = event.clientX - from.x;
      const dy = event.clientY - from.y;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        swiped.current = true;
        onSwipe(dx < 0 ? 1 : -1);
      }
    },
    [onSwipe],
  );

  const onPointerCancel = useCallback(() => {
    start.current = null;
  }, []);

  const consumed = useCallback(() => {
    const was = swiped.current;
    swiped.current = false;
    return was;
  }, []);

  return { handlers: { onPointerDown, onPointerUp, onPointerCancel }, consumed };
}

/** Keys that flip a gallery: ←/→ step, Home/End jump. Returns the step, or null. */
export function galleryKey(key: string, index: number, count: number): number | null {
  if (key === "ArrowRight") return (index + 1) % count;
  if (key === "ArrowLeft") return (index - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

export const pad = (n: number) => String(n).padStart(2, "0");

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { useMotionPaused } from "@/lib/motion-pause";

/**
 * A dot matrix behind the page that only shows near a mouse pointer, its dots
 * swelling towards the centre like the dotted wordmark. It sits under every
 * panel, so it appears only on open paper. Two small lenses move by transform;
 * the only work is one frame per pointer move, so an idle pointer costs nothing.
 * Off for touch, reduced motion and the pause switch.
 */
export function PointerField() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const paused = useMotionPaused();

  useEffect(() => {
    const field = ref.current;
    if (!field || reduced || paused) return;
    const fine = window.matchMedia?.("(hover: hover) and (pointer: fine)");
    if (!fine?.matches) return;

    let frame = 0;
    let x = 0;
    let y = 0;
    const write = () => {
      frame = 0;
      field.style.setProperty("--fx", `${x}px`);
      field.style.setProperty("--fy", `${y}px`);
      field.dataset.live = "true";
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      x = event.clientX;
      y = event.clientY;
      if (!frame) frame = requestAnimationFrame(write);
    };
    const rest = () => {
      delete field.dataset.live;
    };
    const leave = (event: PointerEvent) => {
      if (!event.relatedTarget) rest();
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerout", leave);
    window.addEventListener("blur", rest);
    document.addEventListener("visibilitychange", rest);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerout", leave);
      window.removeEventListener("blur", rest);
      document.removeEventListener("visibilitychange", rest);
      rest();
    };
  }, [reduced, paused]);

  return (
    <div ref={ref} className="chrome-field" aria-hidden="true">
      <span className="chrome-field-fine" />
      <span className="chrome-field-bold" />
    </div>
  );
}

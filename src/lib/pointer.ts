import type { PointerEvent } from "react";

/**
 * Writes the pointer position into --mx/--my (pixels) and --px/--py (-0.5..0.5)
 * on the element, for CSS-only spotlight and tilt effects.
 */
export function trackPointer(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== "mouse") return;
  const el = event.currentTarget;
  const box = el.getBoundingClientRect();
  const x = event.clientX - box.left;
  const y = event.clientY - box.top;
  el.style.setProperty("--mx", `${x}px`);
  el.style.setProperty("--my", `${y}px`);
  el.style.setProperty("--px", (x / box.width - 0.5).toFixed(3));
  el.style.setProperty("--py", (y / box.height - 0.5).toFixed(3));
}

export function resetPointer(event: PointerEvent<HTMLElement>) {
  const el = event.currentTarget;
  el.style.setProperty("--px", "0");
  el.style.setProperty("--py", "0");
}

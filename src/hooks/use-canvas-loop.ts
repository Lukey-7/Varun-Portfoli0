import { useEffect, useRef } from "react";

export interface CanvasPointer {
  x: number;
  y: number;
  inside: boolean;
}

export interface CanvasFrame {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  /** Milliseconds of animated time; frozen at 0 under reduced motion. */
  time: number;
  pointer: CanvasPointer;
  /** Ink colour with the given alpha, from the canvas's CSS `color`. */
  ink: (alpha?: number) => string;
  /** The page background, from the `--page` custom property. */
  page: string;
  reduced: boolean;
}

/**
 * Drives a 2D canvas at ~30fps while it is on screen. Pointer coordinates are
 * in CSS pixels. Reduced-motion users get a single static frame that still
 * redraws when the pointer moves or the canvas resizes.
 */
export function useCanvasLoop(draw: (frame: CanvasFrame) => void) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer: CanvasPointer = { x: 0, y: 0, inside: false };
    let width = 0,
      height = 0,
      frame = 0,
      visible = true,
      dirty = true,
      last = 0,
      clock = 0,
      colourAge = 0,
      rgb = "34,36,32",
      page = "#fafaf8";

    const readColours = () => {
      const style = getComputedStyle(canvas);
      const match = style.color.match(/\d+(\.\d+)?/g);
      if (match) rgb = match.slice(0, 3).join(",");
      page = style.getPropertyValue("--page").trim() || page;
    };
    const ink = (alpha = 1) => `rgba(${rgb},${alpha})`;
    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.max(1, width * ratio);
      canvas.height = Math.max(1, height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      readColours();
      dirty = true;
    };
    const move = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      pointer.x = event.clientX - box.left;
      pointer.y = event.clientY - box.top;
      pointer.inside = true;
      dirty = true;
    };
    const leave = () => {
      pointer.inside = false;
      dirty = true;
    };
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (!visible || document.hidden || now - last < 32) return;
      const dt = last ? Math.min(now - last, 64) : 0;
      last = now;
      if (++colourAge > 30) {
        colourAge = 0;
        readColours();
      }
      if (media.matches && !dirty) return;
      if (!media.matches) clock += dt;
      dirty = false;
      ctx.clearRect(0, 0, width, height);
      drawRef.current({
        ctx,
        width,
        height,
        time: clock,
        pointer,
        ink,
        page,
        reduced: media.matches,
      });
    };
    const resizer = new ResizeObserver(resize);
    resizer.observe(canvas);
    const observer = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      dirty = true;
    });
    observer.observe(canvas);
    // Listen on the parent so hovering anywhere on a card drives its artwork.
    const target = canvas.parentElement ?? canvas;
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerleave", leave);
    resize();
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      resizer.disconnect();
      observer.disconnect();
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerleave", leave);
    };
  }, []);

  return canvasRef;
}

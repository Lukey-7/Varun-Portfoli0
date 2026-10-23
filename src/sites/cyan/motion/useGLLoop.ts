import { useEffect, useRef } from "react";
import { isMotionPaused } from "@/lib/motion-pause";

export interface GLPointer {
  /** Device pixels from the canvas centre, y up (matches clip space). */
  x: number;
  y: number;
  inside: boolean;
  down: boolean;
}

export interface GLFrame {
  gl: WebGL2RenderingContext;
  /** Canvas size in device pixels (or cells, with cellSize). */
  width: number;
  height: number;
  /** Canvas pixels per CSS pixel. */
  dpr: number;
  /** Seconds of animated time; frozen while motion is reduced or paused. */
  time: number;
  dt: number;
  pointer: GLPointer;
  /** True while motion is reduced or paused: draw a still frame. */
  still: boolean;
}

export interface GLLoopOptions {
  /** Highest device pixel ratio to render at. */
  maxDpr?: number;
  /**
   * Render one pixel per cell of this many CSS pixels instead of at the device
   * ratio, for dithered, pixel-art fields scaled up with image-rendering: pixelated.
   */
  cellSize?: number;
  /** Element that drives the pointer; defaults to the canvas's parent. */
  pointerTarget?: () => HTMLElement | null;
}

/** Compile and link a program, throwing with the driver's log on failure. */
export function createProgram(gl: WebGL2RenderingContext, vertex: string, fragment: string) {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) ?? "shader failed to compile");
    }
    return shader;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "program failed to link");
  }
  return program;
}

/**
 * Runs a WebGL2 canvas at the display's frame rate while it is on screen and
 * the tab is visible. Reduced motion and the site-wide pause freeze the clock;
 * a still frame is still redrawn when the pointer moves or the size changes.
 * Without WebGL2 the canvas gets data-gl="off" so CSS can show a fallback.
 */
export function useGLLoop<State>(
  setup: (gl: WebGL2RenderingContext) => State,
  draw: (frame: GLFrame, state: State) => void,
  options: GLLoopOptions = {},
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const setupRef = useRef(setup);
  setupRef.current = setup;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", { antialias: true, premultipliedAlpha: true, alpha: true });
    if (!gl) {
      canvas.dataset.gl = "off";
      return;
    }
    let state: State;
    try {
      state = setupRef.current(gl);
    } catch (error) {
      canvas.dataset.gl = "off";
      console.warn("Motion graphic disabled:", error);
      return;
    }
    canvas.dataset.gl = "on";
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer: GLPointer = { x: 0, y: 0, inside: false, down: false };
    let width = 1,
      height = 1,
      dpr = 1,
      frame = 0,
      visible = true,
      dirty = true,
      last = 0,
      clock = 0,
      lost = false;

    const resize = () => {
      const cell = optionsRef.current.cellSize;
      dpr = cell ? 1 / cell : Math.min(window.devicePixelRatio || 1, optionsRef.current.maxDpr ?? 1.5);
      width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      canvas.width = width;
      canvas.height = height;
      dirty = true;
    };
    const target = optionsRef.current.pointerTarget?.() ?? canvas.parentElement ?? canvas;
    const move = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      pointer.x = (event.clientX - box.left - box.width / 2) * dpr;
      pointer.y = (box.height / 2 - (event.clientY - box.top)) * dpr;
      pointer.inside = true;
      dirty = true;
    };
    const leave = () => {
      pointer.inside = false;
      pointer.down = false;
      dirty = true;
    };
    const press = () => {
      pointer.down = true;
    };
    const release = () => {
      pointer.down = false;
    };
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (lost || !visible || document.hidden) {
        last = 0;
        return;
      }
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      const still = media.matches || isMotionPaused();
      if (!still) clock += dt;
      if (still && !dirty) return;
      dirty = false;
      gl.viewport(0, 0, width, height);
      drawRef.current({ gl, width, height, dpr, time: clock, dt: still ? 0 : dt, pointer, still }, state);
    };
    const onLost = (event: Event) => {
      event.preventDefault();
      lost = true;
    };
    const onRestored = () => {
      try {
        state = setupRef.current(gl);
        lost = false;
        dirty = true;
      } catch {
        canvas.dataset.gl = "off";
      }
    };

    const resizer = new ResizeObserver(resize);
    resizer.observe(canvas);
    const observer = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      dirty = true;
    });
    observer.observe(canvas);
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerleave", leave);
    target.addEventListener("pointerdown", press);
    window.addEventListener("pointerup", release);
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    resize();
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      resizer.disconnect();
      observer.disconnect();
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerleave", leave);
      target.removeEventListener("pointerdown", press);
      window.removeEventListener("pointerup", release);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
    };
  }, []);

  return canvasRef;
}

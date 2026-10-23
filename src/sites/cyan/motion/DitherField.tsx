import { useEffect, useRef } from "react";
import { isMotionPaused } from "@/lib/motion-pause";
import { createProgram, useGLLoop } from "./useGLLoop";
import "./dither-field.css";

/*
 * A Bayer-dithered signal field: drifting, domain-warped noise thresholded
 * through an 8×8 Bayer matrix and drawn one fragment per 6px cell, so it reads
 * as a display rather than a gradient. The pointer raises the density around
 * it, and a click sends a ring outward. It stays on one side, away from copy.
 */

const CELL = 6;

const VERTEX = `#version 300 es
void main() {
  // One triangle that covers the screen, from the vertex id alone.
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uSize;
uniform float uTime;
uniform vec2 uPointer;
uniform float uPointerOn;
uniform vec4 uRipples[4];
uniform vec3 uColor;
uniform float uSide;
out vec4 outColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + 17.1;
    a *= 0.5;
  }
  return v;
}
float bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x / 2.0 + a.y * a.y * 0.75);
}
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }

void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  vec2 uv = cell / uSize;
  vec2 c = cell - uSize * 0.5;
  // Warp the field by itself once so it flows instead of scrolling.
  vec2 p = cell * 0.045;
  vec2 warp = vec2(fbm(p + uTime * 0.05), fbm(p + 5.2 - uTime * 0.04));
  float n = fbm(p + warp * 1.6 + vec2(uTime * 0.02, 0.0));
  // Keep the copy clear: one side of the section, fading at the top and bottom.
  float side = uSide < 0.5
    ? smoothstep(0.38, 0.95, uv.x)
    : uSide < 1.5
      ? smoothstep(0.62, 0.05, uv.x)
      : 1.0 - smoothstep(0.08, 0.3, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
  float edge = smoothstep(0.0, 0.2, uv.y) * smoothstep(1.0, 0.8, uv.y);
  float v = smoothstep(0.53, 0.86, n) * side * edge;
  float d = length(c - uPointer);
  v += uPointerOn * 0.5 * exp(-d * d / 260.0);
  for (int i = 0; i < 4; i++) {
    vec4 r = uRipples[i];
    if (r.w < 0.5) continue;
    float age = uTime - r.z;
    float dist = length(c - r.xy);
    v += 0.9 * exp(-pow((dist - age * 38.0) * 0.22, 2.0)) * exp(-age * 1.4);
  }
  // Strictly above the threshold, or every cell where the matrix is 0 lights up.
  float on = step(bayer8(cell) + 0.001, v);
  outColor = vec4(uColor * on, on);
}`;

const SIDES = { right: 0, left: 1, edges: 2 } as const;

export function DitherField({ side = "right", className }: { side?: keyof typeof SIDES; className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef(0);
  // Four ring slots, reused round-robin: x, y (cells from centre), start time, active.
  const ripples = useRef(new Float32Array(16));
  const nextRipple = useRef(0);

  const canvasRef = useGLLoop(
    (gl) => {
      const program = createProgram(gl, VERTEX, FRAGMENT);
      const vao = gl.createVertexArray();
      const names = ["uSize", "uTime", "uPointer", "uPointerOn", "uRipples", "uColor", "uSide"];
      const u = Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)]));
      return { program, vao, u, colour: [0.33, 0.85, 0.81], age: 99 };
    },
    (frame, state) => {
      const { gl, width, height, time, pointer } = frame;
      timeRef.current = time;
      if (++state.age > 45 && wrapRef.current) {
        state.age = 0;
        const match = getComputedStyle(wrapRef.current).color.match(/\d+(\.\d+)?/g);
        if (match) state.colour = match.slice(0, 3).map((value) => Number(value) / 255);
      }
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(state.program);
      gl.bindVertexArray(state.vao);
      gl.uniform2f(state.u.uSize, width, height);
      gl.uniform1f(state.u.uTime, time);
      gl.uniform2f(state.u.uPointer, pointer.x, pointer.y);
      gl.uniform1f(state.u.uPointerOn, pointer.inside ? 1 : 0);
      gl.uniform4fv(state.u.uRipples, ripples.current);
      gl.uniform3fv(state.u.uColor, state.colour);
      gl.uniform1f(state.u.uSide, SIDES[side]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    { cellSize: CELL, pointerTarget: () => wrapRef.current?.parentElement ?? null },
  );

  // A click anywhere in the section (except on its links and buttons) sends a ring.
  useEffect(() => {
    const section = wrapRef.current?.parentElement;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;
    const press = (event: PointerEvent) => {
      if ((event.target as Element).closest("a, button, input")) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || isMotionPaused()) return;
      const box = canvas.getBoundingClientRect();
      const slot = nextRipple.current++ % 4;
      ripples.current.set(
        [
          (event.clientX - box.left - box.width / 2) / CELL,
          (box.height / 2 - (event.clientY - box.top)) / CELL,
          timeRef.current,
          1,
        ],
        slot * 4,
      );
    };
    section.addEventListener("pointerdown", press);
    return () => section.removeEventListener("pointerdown", press);
  }, [canvasRef]);

  return (
    <div ref={wrapRef} className={`dither-field${className ? ` ${className}` : ""}`} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}

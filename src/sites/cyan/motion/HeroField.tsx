import { useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { createProgram, useGLLoop, type GLFrame } from "./useGLLoop";
import "./hero-field.css";

/*
 * The hero: a trefoil knot made of streaming points of light. The cursor is a
 * query vector: points near it brighten and the nearest five are linked to it
 * with their similarity, like retrieval in an embedding space. Clicking
 * scatters the knot into six clusters (a latent space) and back.
 *
 * Every point's position comes from one formula, written twice: in GLSL to
 * draw all of them, and in TypeScript for a sample the overlay labels.
 */

const TAU = Math.PI * 2;
/** Six cluster centres for the "latent space" form, roughly on a sphere. */
const CLUSTERS = [
  [0.86, 0.36, 0.14],
  [-0.8, 0.46, -0.24],
  [0.12, -0.8, 0.46],
  [-0.5, -0.42, -0.64],
  [0.62, -0.3, -0.68],
  [-0.18, 0.84, 0.64],
] as const;
const CAMERA = 3.4;
const CLUSTER_DATA = new Float32Array(CLUSTERS.flat());

const VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec4 aSeed;
layout(location = 1) in float aKind;
uniform float uTime;
uniform float uMix;
uniform mat3 uRot;
uniform vec2 uHalf;
uniform float uScale;
uniform float uDpr;
uniform vec2 uQuery;
uniform float uQueryOn;
uniform float uRadius;
uniform float uFade;
uniform vec3 uClusters[6];
out float vAlpha;
out float vGlow;

const float TAU = 6.28318530718;

vec3 knot(float t) {
  float u = t * TAU;
  float r = 2.0 + cos(3.0 * u);
  return vec3(r * cos(2.0 * u), r * sin(2.0 * u), 1.15 * sin(3.0 * u)) * 0.36;
}

void main() {
  vec3 p;
  if (aKind > 1.5) {
    // Dust: a faint volume of drifting points behind everything.
    p = (aSeed.xyz * 2.0 - 1.0) * vec3(1.9, 1.3, 1.4);
    p += 0.06 * vec3(sin(uTime * 0.21 + aSeed.w * 40.0), cos(uTime * 0.17 + aSeed.x * 30.0), sin(uTime * 0.13 + aSeed.y * 20.0));
  } else {
    float speed = mix(0.012, 0.03, aSeed.w) * (aKind > 0.5 ? 2.6 : 1.0);
    float t = fract(aSeed.x + uTime * speed);
    vec3 c = knot(t);
    vec3 T = normalize(knot(t + 0.002) - knot(t - 0.002));
    vec3 R = normalize(vec3(c.xy, 0.0) + vec3(1e-4));
    vec3 B = normalize(cross(T, R));
    vec3 N = cross(B, T);
    float angle = aSeed.y * TAU;
    float tube = 0.11 * (0.35 + 0.65 * aSeed.z) * (aKind > 0.5 ? 0.55 : 1.0);
    vec3 onKnot = c + tube * (cos(angle) * N + sin(angle) * B);

    int k = int(floor(fract(aSeed.x * 7.13 + aSeed.z * 3.7) * 6.0));
    vec3 jitter = vec3(
      cos(angle) * sin(aSeed.x * 40.0),
      sin(angle) * cos(aSeed.z * 31.0),
      cos(aSeed.w * 17.0 + angle)
    );
    vec3 drift = 0.03 * vec3(sin(uTime * 0.6 + aSeed.x * 20.0), cos(uTime * 0.5 + aSeed.z * 20.0), sin(uTime * 0.4 + aSeed.w * 20.0));
    vec3 inCloud = uClusters[k] + jitter * (0.09 + 0.07 * aSeed.z) + drift;
    float m = smoothstep(0.0, 1.0, clamp(uMix * 1.4 - aSeed.z * 0.4, 0.0, 1.0));
    p = mix(onKnot, inCloud, m);
  }

  vec3 v = uRot * p;
  float persp = ${CAMERA.toFixed(1)} / (${CAMERA.toFixed(1)} - v.z);
  vec2 screen = v.xy * persp * uScale;
  gl_Position = vec4(screen / uHalf, 0.0, 1.0);

  float d = length(screen - uQuery);
  vGlow = uQueryOn * (1.0 - smoothstep(0.0, uRadius, d));
  float near = clamp((v.z + 1.2) / 2.4, 0.0, 1.0);
  float base = aKind > 1.5 ? 1.1 : (aKind > 0.5 ? 3.0 : 1.7);
  gl_PointSize = min(base * uDpr * persp * (1.0 + 0.8 * vGlow), 10.0 * uDpr);
  float alpha = aKind > 1.5 ? 0.16 : (aKind > 0.5 ? 1.0 : mix(0.2, 0.85, near));
  vAlpha = alpha * uFade;
}`;

const FRAGMENT = `#version 300 es
precision mediump float;
in float vAlpha;
in float vGlow;
uniform vec3 uColor;
uniform vec3 uHot;
out vec4 outColor;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(q, q);
  if (r2 > 1.0) discard;
  float soft = exp(-r2 * 3.2);
  vec3 colour = mix(uColor, uHot, vGlow * 0.55);
  float a = soft * min(1.0, vAlpha + vGlow * 0.22);
  outColor = vec4(colour * a, a);
}`;

const fract = (x: number) => x - Math.floor(x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

function knot(t: number): [number, number, number] {
  const u = t * TAU;
  const r = 2 + Math.cos(3 * u);
  return [r * Math.cos(2 * u) * 0.36, r * Math.sin(2 * u) * 0.36, 1.15 * Math.sin(3 * u) * 0.36];
}

/** The vertex shader's position for one stream point, in TypeScript. */
function streamPoint(seed: ArrayLike<number>, i: number, time: number, mixAmount: number): [number, number, number] {
  const sx = seed[i],
    sy = seed[i + 1],
    sz = seed[i + 2],
    sw = seed[i + 3];
  const t = fract(sx + time * (0.012 + 0.018 * sw));
  const c = knot(t);
  const a = knot(t + 0.002),
    b = knot(t - 0.002);
  let tx = a[0] - b[0],
    ty = a[1] - b[1],
    tz = a[2] - b[2];
  const tl = Math.hypot(tx, ty, tz) || 1;
  tx /= tl;
  ty /= tl;
  tz /= tl;
  const rl = Math.hypot(c[0], c[1]) || 1;
  const rx = c[0] / rl,
    ry = c[1] / rl;
  // B = normalize(T × R), N = B × T
  let bx = ty * 0 - tz * ry,
    by = tz * rx - tx * 0,
    bz = tx * ry - ty * rx;
  const bl = Math.hypot(bx, by, bz) || 1;
  bx /= bl;
  by /= bl;
  bz /= bl;
  const nx = by * tz - bz * ty,
    ny = bz * tx - bx * tz,
    nz = bx * ty - by * tx;
  const angle = sy * TAU;
  const tube = 0.11 * (0.35 + 0.65 * sz);
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  const knotP = [c[0] + tube * (cos * nx + sin * bx), c[1] + tube * (cos * ny + sin * by), c[2] + tube * (cos * nz + sin * bz)];
  const k = Math.floor(fract(sx * 7.13 + sz * 3.7) * 6);
  const centre = CLUSTERS[k];
  const spread = 0.09 + 0.07 * sz;
  const cloud = [
    centre[0] + Math.cos(angle) * Math.sin(sx * 40) * spread + 0.03 * Math.sin(time * 0.6 + sx * 20),
    centre[1] + Math.sin(angle) * Math.cos(sz * 31) * spread + 0.03 * Math.cos(time * 0.5 + sz * 20),
    centre[2] + Math.cos(sw * 17 + angle) * spread + 0.03 * Math.sin(time * 0.4 + sw * 20),
  ];
  const m = smooth(mixAmount * 1.4 - sz * 0.4);
  return [knotP[0] + (cloud[0] - knotP[0]) * m, knotP[1] + (cloud[1] - knotP[1]) * m, knotP[2] + (cloud[2] - knotP[2]) * m];
}

/** Rotation about Y (yaw) then X (pitch), column-major for uniformMatrix3fv. */
function rotation(yaw: number, pitch: number) {
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw),
    cx = Math.cos(pitch),
    sx = Math.sin(pitch);
  // Rows of Rx * Ry
  const m = [
    [cy, 0, sy],
    [sx * sy, cx, -sx * cy],
    [-cx * sy, sx, cx * cy],
  ];
  return {
    columns: new Float32Array([m[0][0], m[1][0], m[2][0], m[0][1], m[1][1], m[2][1], m[0][2], m[1][2], m[2][2]]),
    apply: (p: readonly number[]) =>
      [m[0][0] * p[0] + m[0][1] * p[1] + m[0][2] * p[2], m[1][0] * p[0] + m[1][1] * p[1] + m[1][2] * p[2], m[2][0] * p[0] + m[2][1] * p[1] + m[2][2] * p[2]] as const,
  };
}

const rgb = (css: string, fallback: [number, number, number]): [number, number, number] => {
  const match = css.match(/\d+(\.\d+)?/g);
  return match && match.length >= 3 ? [Number(match[0]) / 255, Number(match[1]) / 255, Number(match[2]) / 255] : fallback;
};

export default function HeroField() {
  const reduced = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const rateRef = useRef<HTMLSpanElement>(null);
  const [scattered, setScattered] = useState(false);
  const scatteredRef = useRef(false);
  scatteredRef.current = scattered;
  // Drag spins the knot; a press without much travel toggles the form.
  const drag = useRef({ active: false, x: 0, y: 0, travel: 0, yaw: 0, pitch: 0, velocity: 0 });

  const count = useMemo(() => {
    if (typeof window === "undefined") return 9000;
    const small = window.matchMedia("(max-width: 767px)").matches;
    return small ? 6500 : 14000;
  }, []);

  const canvasRef = useGLLoop(
    (gl) => {
      const program = createProgram(gl, VERTEX, FRAGMENT);
      const seeds = new Float32Array(count * 4);
      const kinds = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        seeds.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
        const roll = Math.random();
        kinds[i] = roll < 0.1 ? 2 : roll < 0.14 ? 1 : 0;
      }
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const seedBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, seedBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
      const kindBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, kindBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, kinds, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0);
      const names = ["uTime", "uMix", "uRot", "uHalf", "uScale", "uDpr", "uQuery", "uQueryOn", "uRadius", "uFade", "uClusters", "uColor", "uHot"];
      const u = Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)]));
      // Every 12th stream point is mirrored on the CPU for the overlay.
      const sample: number[] = [];
      for (let i = 0; i < count; i += 12) if (kinds[i] === 0) sample.push(i * 4);
      return { program, vao, u, seeds, sample, frames: 0, elapsed: 0, mix: 0, colour: [0.33, 0.85, 0.81] as [number, number, number], hot: [0.93, 0.96, 0.95] as [number, number, number], light: false, age: 99, yaw: 0.6 };
    },
    (frame: GLFrame, state) => {
      const { gl, width, height, dpr, time, dt, pointer, still } = frame;
      const wrap = wrapRef.current;
      // Re-read the theme colours now and then; the theme can switch at runtime.
      if (++state.age > 45 && wrap) {
        state.age = 0;
        const style = getComputedStyle(wrap);
        state.colour = rgb(style.getPropertyValue("--field-colour") || style.color, state.colour);
        state.hot = rgb(style.getPropertyValue("--field-hot"), state.hot);
        state.light = style.getPropertyValue("--field-mode").trim() === "light";
      }
      // A real measurement for the HUD: frames per second, refreshed twice a second.
      state.frames++;
      state.elapsed += dt;
      if (state.elapsed > 0.5 || still) {
        if (rateRef.current) rateRef.current.textContent = still ? "PAUSED" : `${Math.round(state.frames / Math.max(state.elapsed, 1e-3))} FPS`;
        state.frames = 0;
        state.elapsed = 0;
      }
      const target = scatteredRef.current ? 1 : 0;
      state.mix = still ? target : state.mix + (target - state.mix) * (1 - Math.exp(-dt * 2.4));

      const d = drag.current;
      if (!d.active && Math.abs(d.velocity) > 1e-4) {
        d.yaw += d.velocity;
        d.velocity *= Math.exp(-dt * 3);
      }
      state.yaw += dt * 0.12;
      const yaw = state.yaw + d.yaw + (pointer.inside ? (pointer.x / width) * 0.5 : 0);
      const pitch = 0.42 + d.pitch + (pointer.inside ? (-pointer.y / height) * 0.35 : 0);
      const rot = rotation(yaw, pitch);
      const scale = (Math.min(width, height) * 0.43) / 1.15;
      // Scrolling away dissolves the knot towards its clusters and fades it.
      const box = wrap?.getBoundingClientRect();
      const progress = box ? clamp01(-box.top / Math.max(1, box.height)) : 0;
      const mixAmount = Math.max(state.mix, progress * 0.7);
      const fade = 1 - progress * 0.6;
      const radius = 95 * dpr;
      const queryOn = pointer.inside && !d.active ? 1 : 0;

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      // Light on dark adds up; on the light theme, ink is layered normally.
      if (state.light) gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      else gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(state.program);
      gl.bindVertexArray(state.vao);
      const u = state.u;
      gl.uniform1f(u.uTime, time);
      gl.uniform1f(u.uMix, mixAmount);
      gl.uniformMatrix3fv(u.uRot, false, rot.columns);
      gl.uniform2f(u.uHalf, width / 2, height / 2);
      gl.uniform1f(u.uScale, scale);
      gl.uniform1f(u.uDpr, dpr);
      gl.uniform2f(u.uQuery, pointer.x, pointer.y);
      gl.uniform1f(u.uQueryOn, queryOn);
      gl.uniform1f(u.uRadius, radius);
      gl.uniform1f(u.uFade, fade);
      gl.uniform3fv(u.uClusters, CLUSTER_DATA);
      gl.uniform3fv(u.uColor, state.colour);
      gl.uniform3fv(u.uHot, state.hot);
      gl.drawArrays(gl.POINTS, 0, count);

      // The overlay: the query and its five nearest points, with similarity.
      const overlay = overlayRef.current;
      const ctx = overlay?.getContext("2d");
      if (!overlay || !ctx) return;
      if (overlay.width !== width || overlay.height !== height) {
        overlay.width = width;
        overlay.height = height;
      }
      ctx.clearRect(0, 0, width, height);
      if (!queryOn) return;
      const cx = width / 2,
        cy = height / 2;
      const nearest: { x: number; y: number; d: number }[] = [];
      for (const index of state.sample) {
        const v = rot.apply(streamPoint(state.seeds, index, time, mixAmount));
        const persp = CAMERA / (CAMERA - v[2]);
        const sx = v[0] * persp * scale,
          sy = v[1] * persp * scale;
        const dist = Math.hypot(sx - pointer.x, sy - pointer.y);
        if (dist > radius * 1.6) continue;
        nearest.push({ x: cx + sx, y: cy - sy, d: dist });
      }
      nearest.sort((a, b) => a.d - b.d);
      const picks: typeof nearest = [];
      const gap = 40 * dpr;
      for (const point of nearest) {
        if (picks.length === 5) break;
        if (point.d < 24 * dpr) continue;
        if (picks.every((other) => Math.hypot(other.x - point.x, other.y - point.y) > gap)) picks.push(point);
      }
      const qx = cx + pointer.x,
        qy = cy - pointer.y;
      const ink = `rgba(${state.hot.map((c) => Math.round(c * 255)).join(",")},`;
      const accent = `rgba(${state.colour.map((c) => Math.round(c * 255)).join(",")},`;
      ctx.lineWidth = 1 * dpr;
      ctx.font = `${10 * dpr}px "IBM Plex Mono", monospace`;
      const backing = state.light ? "rgba(250,251,249,0.82)" : "rgba(9,17,16,0.78)";
      picks.forEach((point, rank) => {
        const similarity = Math.exp(-((point.d / radius) ** 2));
        ctx.strokeStyle = `${accent}${0.95 - rank * 0.12})`;
        ctx.setLineDash([3 * dpr, 3 * dpr]);
        ctx.beginPath();
        ctx.moveTo(qx, qy);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = `${ink}0.9)`;
        ctx.strokeRect(point.x - 3 * dpr, point.y - 3 * dpr, 6 * dpr, 6 * dpr);
        const label = similarity.toFixed(2);
        const lx = point.x + 7 * dpr,
          ly = point.y - 5 * dpr;
        ctx.fillStyle = backing;
        ctx.fillRect(lx - 3 * dpr, ly - 10 * dpr, ctx.measureText(label).width + 6 * dpr, 14 * dpr);
        ctx.fillStyle = `${ink}0.95)`;
        ctx.fillText(label, lx, ly);
      });
      // The query itself: a crosshair with its label.
      ctx.strokeStyle = `${ink}0.95)`;
      ctx.beginPath();
      ctx.arc(qx, qy, 9 * dpr, 0, TAU);
      ctx.moveTo(qx - 16 * dpr, qy);
      ctx.lineTo(qx - 11 * dpr, qy);
      ctx.moveTo(qx + 11 * dpr, qy);
      ctx.lineTo(qx + 16 * dpr, qy);
      ctx.moveTo(qx, qy - 16 * dpr);
      ctx.lineTo(qx, qy - 11 * dpr);
      ctx.moveTo(qx, qy + 11 * dpr);
      ctx.lineTo(qx, qy + 16 * dpr);
      ctx.stroke();
      const caption = `TOP ${picks.length} · SIMILARITY`;
      ctx.fillStyle = backing;
      ctx.fillRect(qx + 11 * dpr, qy + 12 * dpr, ctx.measureText(caption).width + 8 * dpr, 28 * dpr);
      ctx.fillStyle = `${ink}0.95)`;
      ctx.fillText("QUERY", qx + 15 * dpr, qy + 23 * dpr);
      ctx.fillStyle = `${accent}0.95)`;
      ctx.fillText(caption, qx + 15 * dpr, qy + 36 * dpr);
    },
    { maxDpr: 1.75, pointerTarget: () => wrapRef.current },
  );

  return (
    <div
      ref={wrapRef}
      className="hero-field"
      onPointerDown={(event) => {
        // The controls handle their own clicks.
        if (event.button !== 0 || (event.target as Element).closest("button")) return;
        drag.current = { ...drag.current, active: true, x: event.clientX, y: event.clientY, travel: 0, velocity: 0 };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const d = drag.current;
        if (!d.active) return;
        const dx = event.clientX - d.x,
          dy = event.clientY - d.y;
        d.x = event.clientX;
        d.y = event.clientY;
        d.travel += Math.abs(dx) + Math.abs(dy);
        d.yaw += dx * 0.008;
        d.pitch = Math.max(-0.8, Math.min(0.8, d.pitch + dy * 0.005));
        d.velocity = reduced ? 0 : dx * 0.008;
      }}
      onPointerUp={() => {
        const d = drag.current;
        if (d.active && d.travel < 6) setScattered((value) => !value);
        d.active = false;
      }}
      onPointerCancel={() => {
        drag.current.active = false;
      }}
    >
      <div className="hero-field-hud mono" aria-hidden="true">
        <span>LATENT SPACE · {count.toLocaleString("en-IN")} PTS · {scattered ? "6 CLUSTERS" : "KNOT"}</span>
        <span>
          [LIVE] <span ref={rateRef} className="hero-field-rate">— FPS</span>
        </span>
      </div>
      <canvas ref={canvasRef} className="hero-field-gl" aria-hidden="true" />
      <canvas ref={overlayRef} className="hero-field-overlay" aria-hidden="true" />
      <svg className="hero-field-fallback" viewBox="-1.3 -1.3 2.6 2.6" aria-hidden="true">
        <path d={fallbackPath()} />
      </svg>
      <div className="hero-field-controls">
        <button type="button" className="hero-field-toggle mono" aria-pressed={scattered} onClick={() => setScattered((value) => !value)}>
          {scattered ? "Re-form the knot" : "Scatter into clusters"}
        </button>
        <span className="mono">Move to query · drag to spin · click to scatter</span>
      </div>
    </div>
  );
}

/** A flat outline of the knot, for browsers without WebGL2. */
function fallbackPath() {
  const steps = 360;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const [x, y] = knot(i / steps);
    d += `${i ? "L" : "M"}${x.toFixed(3)} ${(-y).toFixed(3)}`;
  }
  return d;
}

import { useEffect, useRef } from "react";
import type { MotionValue } from "framer-motion";
import { position } from "./geometry";

/** Scroll progress → how assembled the knot is (0 scattered, 1 formed). */
const assembly = (progress: number) => {
  const smooth = (x: number) => x * x * (3 - 2 * x);
  if (progress < 0.12) return 0;
  if (progress < 0.45) return smooth((progress - 0.12) / 0.33);
  if (progress < 0.72) return 1;
  if (progress < 0.95) return smooth(1 - (progress - 0.72) / 0.23);
  return 0;
};

/**
 * Particle study for the black section. Points scatter into a cloud, gather
 * into the knot as the section scrolls, and part around the cursor.
 */
export default function ParticleField({
  progress,
  count,
}: {
  progress: MotionValue<number>;
  count: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const m = 36;
    const n = Math.round(count / m);
    const total = n * m;
    const knot = new Float32Array(total * 3);
    const cloud = new Float32Array(total * 3);
    const seed = (i: number) => {
      const x = Math.sin(i * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };
    for (let i = 0; i < total; i++) {
      const [x, y, z] = position(
        (Math.floor(i / m) / n) * Math.PI * 2,
        ((i % m) / m) * Math.PI * 2,
        0,
      );
      knot.set([x, y, z], i * 3);
      // A loose spherical cloud, denser towards the middle like the reference.
      const r = 0.35 + Math.pow(seed(i), 1.35) * 2.4;
      const theta = seed(i + 7.1) * Math.PI * 2;
      const phi = Math.acos(seed(i + 3.3) * 2 - 1);
      cloud.set(
        [
          r * Math.sin(phi) * Math.cos(theta) * 1.35,
          r * Math.cos(phi) * 0.9,
          r * Math.sin(phi) * Math.sin(theta),
        ],
        i * 3,
      );
    }
    const sx = new Float32Array(total),
      sy = new Float32Array(total),
      sz = new Float32Array(total);
    const pointer = { x: -9999, y: -9999, strength: 0 };
    let width = 0,
      height = 0,
      frame = 0,
      visible = true,
      last = 0,
      angle = 0.4;

    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.max(1, width * ratio);
      canvas.height = Math.max(1, height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const host = canvas.parentElement ?? canvas;
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const box = canvas.getBoundingClientRect();
      pointer.x = event.clientX - box.left;
      pointer.y = event.clientY - box.top;
      pointer.strength = 1;
    };
    const leave = () => {
      pointer.strength = 0;
    };
    const buckets = 10;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (!visible || document.hidden || now - last < 32) return;
      const dt = last ? Math.min(now - last, 64) : 0;
      last = now;
      const reduced = media.matches;
      const a = reduced ? 1 : assembly(progress.get());
      if (!reduced) angle += dt * 0.00011 * (1.6 - a);
      const cosY = Math.cos(angle),
        sinY = Math.sin(angle),
        cosX = Math.cos(0.42),
        sinX = Math.sin(0.42);
      const scale = Math.min(width, height) * 0.24;
      const cx = width * 0.55,
        cy = height * 0.46;
      const radius = Math.min(width, height) * 0.16;
      for (let i = 0; i < total; i++) {
        const k = i * 3;
        // Scattered particles drift; assembled ones settle onto the knot.
        const drift = reduced ? 0 : (1 - a) * 0.12 * Math.sin(now * 0.0006 + i);
        const x = cloud[k] + (knot[k] - cloud[k]) * a + drift;
        const y = cloud[k + 1] + (knot[k + 1] - cloud[k + 1]) * a;
        const z = cloud[k + 2] + (knot[k + 2] - cloud[k + 2]) * a;
        const zz = -x * sinY + z * cosY;
        const rx = x * cosY + z * sinY;
        const ry = y * cosX - zz * sinX;
        const rz = y * sinX + zz * cosX;
        const p = 6 / (6 - rz);
        let px = cx + rx * scale * p;
        let py = cy + ry * scale * p;
        if (pointer.strength) {
          const dx = px - pointer.x,
            dy = py - pointer.y;
          const d = Math.hypot(dx, dy);
          if (d < radius && d > 0.01) {
            const push = ((radius - d) / radius) * radius * 0.85;
            px += (dx / d) * push;
            py += (dy / d) * push;
          }
        }
        sx[i] = px;
        sy[i] = py;
        sz[i] = rz;
      }
      ctx.clearRect(0, 0, width, height);
      const dot = width < 500 ? 0.9 : 1.15;
      for (let b = 0; b < buckets; b++) {
        ctx.fillStyle = `rgba(232,236,226,${0.18 + ((b + 0.5) / buckets) * 0.72})`;
        ctx.beginPath();
        for (let i = 0; i < total; i++) {
          const level = Math.min(buckets - 1, Math.max(0, Math.floor(((sz[i] + 2.4) / 4.8) * buckets)));
          if (level === b) ctx.rect(sx[i], sy[i], dot, dot);
        }
        ctx.fill();
      }
    };
    const resizer = new ResizeObserver(resize);
    resizer.observe(canvas);
    const observer = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
    });
    observer.observe(canvas);
    host.addEventListener("pointermove", move);
    host.addEventListener("pointerleave", leave);
    resize();
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      resizer.disconnect();
      observer.disconnect();
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerleave", leave);
    };
  }, [progress, count]);

  return (
    <canvas
      ref={canvasRef}
      className="particle-field"
      role="img"
      aria-label="Particle study: a scattered cloud gathers into a knot as you scroll"
    />
  );
}

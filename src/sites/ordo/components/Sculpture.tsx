import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { motion, type MotionStyle } from "framer-motion";
import { setMotionPaused, useMotionPaused } from "@/lib/motion-pause";
import { position, type Point } from "./geometry";

const forms = ["Knot", "Sphere", "Wave"] as const;

/** An actual interactive particle study, inspired by the supplied ORDO video. */
export default function Sculpture({
  dark = false,
  canvasStyle,
  autoCycle = false,
  bare = false,
  shape,
  detail,
}: {
  dark?: boolean;
  /** Motion applied to the canvas only, so the controls stay put. */
  canvasStyle?: MotionStyle;
  /** Morph through the forms on a timer until the visitor picks one. */
  autoCycle?: boolean;
  /** Canvas only, without the shape and pause controls. */
  bare?: boolean;
  /** Controlled form index; overrides the visitor's choice. */
  shape?: number;
  /** Rings around the surface; lower is cheaper. */
  detail?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const formRef = useRef(0);
  const pointerRef = useRef({ x: 0, y: 0 });
  const [chosen, setChosen] = useState(0);
  const [picked, setPicked] = useState(false);
  const form = shape ?? chosen;
  // The hero's pause button pauses every animation on the page.
  const paused = useMotionPaused();
  const pausedRef = useRef(paused);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    formRef.current = form;
  }, [form]);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    if (!autoCycle || picked || paused || reduced) return;
    const timer = setInterval(() => setChosen((value) => (value + 1) % forms.length), 7000);
    return () => clearInterval(timer);
  }, [autoCycle, picked, paused, reduced]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncReduced = () => setReduced(media.matches);
    syncReduced();
    media.addEventListener("change", syncReduced);
    let width = 0,
      height = 0,
      frame = 0,
      visible = true,
      dirty = true;
    const n = detail ?? (window.innerWidth < 700 ? 82 : 130),
      m = 36;
    const points = Array.from({ length: n * m }, (_, index) => ({
      u: (Math.floor(index / m) / n) * Math.PI * 2,
      v: ((index % m) / m) * Math.PI * 2,
    }));
    const shapes = [0, 1, 2].map((shape) =>
      points.map((p) => position(p.u, p.v, shape)),
    );
    const current = shapes[formRef.current].map((point) => [...point] as Point);
    let lastForm = formRef.current,
      morphing = false,
      lastTime = 0,
      previousPointer = "";
    const count = n * m;
    // Reused per-frame buffers: rotated coordinates and screen positions.
    const rx = new Float32Array(count),
      ry = new Float32Array(count),
      rz = new Float32Array(count),
      sx = new Float32Array(count),
      sy = new Float32Array(count),
      sp = new Float32Array(count);
    const faceCache = new Map<number, Uint32Array>();
    const facesFor = (shape: number) => {
      let faces = faceCache.get(shape);
      if (faces) return faces;
      const list: number[] = [];
      for (let i = 0; i < n - (shape === 2 ? 1 : 0); i++) {
        for (let j = 0; j < m - (shape === 0 ? 0 : 1); j++) {
          list.push(i * m + j, ((i + 1) % n) * m + j, ((i + 1) % n) * m + ((j + 1) % m), i * m + ((j + 1) % m));
        }
      }
      faces = Uint32Array.from(list);
      faceCache.set(shape, faces);
      return faces;
    };
    let faceOrder: number[] = [];
    let faceDepth = new Float32Array(0);
    const buckets = 12;
    const resize = () => {
      // Layout size, not transformed size, so parallax scaling never resizes the buffer.
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      dirty = true;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    const intersection = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
    });
    intersection.observe(canvas);
    let angle = 0.45;
    const draw = (time = 0) => {
      frame = requestAnimationFrame(draw);
      if (!visible || document.hidden) return;
      // Cache geometry and render at 30fps; static/reduced-motion frames do no drawing.
      if (time - lastTime < 32) return;
      const dt = Math.min(time - lastTime, 50);
      lastTime = time;
      if (lastForm !== formRef.current) {
        lastForm = formRef.current;
        morphing = true;
        dirty = true;
      }
      const pointer = `${pointerRef.current.x},${pointerRef.current.y}`;
      if (pointer !== previousPointer) {
        previousPointer = pointer;
        dirty = true;
      }
      const animating = !pausedRef.current && !media.matches;
      if (!animating && !morphing && !dirty) return;
      if (animating) angle += dt * 0.00012;
      if (morphing) {
        let delta = 0;
        const target = shapes[lastForm];
        for (let i = 0; i < count; i++) {
          const point = current[i];
          for (let j = 0; j < 3; j++) {
            const gap = target[i][j] - point[j];
            point[j] += gap * (media.matches ? 1 : 0.12);
            delta += Math.abs(gap);
          }
        }
        morphing = delta > 0.1;
      }
      dirty = false;
      const ax = 0.36 + pointerRef.current.y * 0.2;
      const ay = angle + pointerRef.current.x * 0.3;
      const cosX = Math.cos(ax),
        sinX = Math.sin(ax),
        cosY = Math.cos(ay),
        sinY = Math.sin(ay);
      const scale = Math.min(width, height) * 0.235;
      const cx = width * 0.5,
        cy = height * 0.48;
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < count; i++) {
        const [x, y, z] = current[i];
        const zz = -x * sinY + z * cosY;
        rx[i] = x * cosY + z * sinY;
        ry[i] = y * cosX - zz * sinX;
        rz[i] = y * sinX + zz * cosX;
        sp[i] = 5.5 / (5.5 - rz[i]);
        sx[i] = cx + rx[i] * scale * sp[i];
        sy[i] = cy + ry[i] * scale * sp[i];
      }
      // Painter-sorted mesh faces give the light study the reference's opaque,
      // finely gridded surface; the dark study keeps its particle-cloud treatment.
      if (!dark) {
        const faces = facesFor(lastForm);
        const faceCount = faces.length / 4;
        if (faceOrder.length !== faceCount) {
          faceOrder = Array.from({ length: faceCount }, (_, i) => i);
          faceDepth = new Float32Array(faceCount);
        }
        for (let f = 0; f < faceCount; f++) {
          const k = f * 4;
          faceDepth[f] = rz[faces[k]] + rz[faces[k + 1]] + rz[faces[k + 2]] + rz[faces[k + 3]];
        }
        faceOrder.sort((a, b) => faceDepth[a] - faceDepth[b]);
        ctx.lineWidth = 0.42;
        ctx.strokeStyle = "rgba(30,33,28,.65)";
        for (const f of faceOrder) {
          const k = f * 4;
          const a = faces[k], b = faces[k + 1], c = faces[k + 2], d = faces[k + 3];
          const abx = rx[b] - rx[a], aby = ry[b] - ry[a], abz = rz[b] - rz[a];
          const acx = rx[c] - rx[a], acy = ry[c] - ry[a], acz = rz[c] - rz[a];
          const nx = aby * acz - abz * acy,
            ny = abz * acx - abx * acz,
            nz = abx * acy - aby * acx;
          const length = Math.hypot(nx, ny, nz) || 1;
          const light = Math.abs((nx * 0.3 - ny * 0.5 + nz * 0.8) / length);
          const shade = Math.round(185 + 65 * light);
          ctx.fillStyle = `rgb(${shade},${shade},${shade - 2})`;
          ctx.beginPath();
          ctx.moveTo(sx[a], sy[a]);
          ctx.lineTo(sx[b], sy[b]);
          ctx.lineTo(sx[c], sy[c]);
          ctx.lineTo(sx[d], sy[d]);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        return;
      }
      // Fine cross-section lines keep the surface legible between particles.
      ctx.strokeStyle = "rgba(221,228,216,.10)";
      ctx.lineWidth = 0.45;
      ctx.beginPath();
      for (let ring = 0; ring < n; ring += 2) {
        for (let j = 0; j <= m; j++) {
          const index = ring * m + (j % m);
          if (j === 0) ctx.moveTo(sx[index], sy[index]);
          else ctx.lineTo(sx[index], sy[index]);
        }
      }
      ctx.stroke();
      // Opacity rises with depth, so drawing depth buckets back to front
      // replaces a full sort and batches each bucket into one fill.
      const dot = width < 400 ? 0.8 : 1.05;
      for (let bucket = 0; bucket < buckets; bucket++) {
        ctx.fillStyle = `rgba(221,228,216,${0.22 + ((bucket + 0.5) / buckets) * 0.7})`;
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const level = Math.min(buckets - 1, Math.max(0, Math.floor(((rz[i] + 2) / 4) * buckets)));
          if (level !== bucket) continue;
          const size = dot * sp[i];
          ctx.rect(sx[i], sy[i], size, size);
        }
        ctx.fill();
      }
    };
    resize();
    draw();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
      media.removeEventListener("change", syncReduced);
    };
  }, [dark, detail]);

  return (
    <div className="sculpture">
      <motion.canvas
        ref={canvasRef}
        style={canvasStyle}
        role={bare ? undefined : "img"}
        aria-hidden={bare || undefined}
        aria-label={bare ? undefined : `Interactive ${forms[form].toLowerCase()} particle sculpture`}
        onPointerMove={(event) => {
          if (reduced || event.pointerType !== "mouse") return;
          const bounds = event.currentTarget.getBoundingClientRect();
          pointerRef.current = {
            x: (event.clientX - bounds.left) / bounds.width - 0.5,
            y: (event.clientY - bounds.top) / bounds.height - 0.5,
          };
        }}
        onPointerLeave={() => {
          pointerRef.current = { x: 0, y: 0 };
        }}
      />
      {!bare && (
      <div className="sculpture-controls">
        <div role="group" aria-label="Sculpture shape">
          {forms.map((name, index) => (
            <button
              key={name}
              aria-pressed={index === form}
              onClick={() => {
                setChosen(index);
                setPicked(true);
              }}
            >
              {name}
            </button>
          ))}
        </div>
        <button
          className="icon-button"
          aria-label={paused || reduced ? "Play all animations" : "Pause all animations"}
          title={paused ? "Play all animations" : "Pause all animations"}
          disabled={reduced}
          onClick={() => setMotionPaused(!paused)}
        >
          {paused || reduced ? <Play size={14} /> : <Pause size={14} />}
        </button>
      </div>
      )}
    </div>
  );
}

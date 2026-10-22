import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { motion, type MotionStyle } from "framer-motion";
import { setMotionPaused, useMotionPaused } from "@/lib/motion-pause";
import { position, type Point } from "./geometry";

const forms = ["Knot", "Sphere", "Wave"] as const;

/** Pointer state shared by the event handlers and the render loop. */
interface PointerState {
  /** Mouse position from the canvas centre, in half-canvas units (clamped to ±1.5). */
  x: number;
  y: number;
  /** Mouse position in canvas pixels, for the bulge under the cursor. */
  px: number;
  py: number;
  inside: boolean;
  dragging: boolean;
  /** Distance moved since the press; a short one counts as a click. */
  travel: number;
  lastX: number;
  lastY: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

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
  /** Canvas only, without the shape and pause controls, drag or click. */
  bare?: boolean;
  /** Controlled form index; overrides the visitor's choice. */
  shape?: number;
  /** Rings around the surface; lower is cheaper. */
  detail?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const formRef = useRef(0);
  const pointerRef = useRef<PointerState>({
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    inside: false,
    dragging: false,
    travel: 0,
    lastX: 0,
    lastY: 0,
  });
  // Rotation added by dragging, plus the spin left over after letting go.
  const spinRef = useRef({ yaw: 0, pitch: 0, velocity: 0 });
  const [chosen, setChosen] = useState(0);
  const [picked, setPicked] = useState(false);
  const form = shape ?? chosen;
  const interactive = !bare;
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
      lastTime = 0;
    const count = n * m;
    // Surface coordinates drive the slow ripple across the skin.
    const ripplePhase = Float32Array.from(points, (p) => 3 * p.u + 2 * p.v);
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

    // The shape leans toward the mouse anywhere on the page, not only over the canvas.
    const pointer = pointerRef.current;
    const onMouseMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !visible || media.matches) return;
      const bounds = canvas.getBoundingClientRect();
      pointer.px = event.clientX - bounds.left;
      pointer.py = event.clientY - bounds.top;
      pointer.x = clamp((pointer.px / bounds.width - 0.5) * 2, -1.5, 1.5);
      pointer.y = clamp((pointer.py / bounds.height - 0.5) * 2, -1.5, 1.5);
      pointer.inside =
        pointer.px >= 0 && pointer.px <= bounds.width && pointer.py >= 0 && pointer.py <= bounds.height;
    };
    const onMouseOut = (event: PointerEvent) => {
      if (event.relatedTarget) return;
      pointer.x = pointer.y = 0;
      pointer.inside = false;
    };
    window.addEventListener("pointermove", onMouseMove, { passive: true });
    document.addEventListener("pointerout", onMouseOut);

    // How far the shape reaches from the centre across a full turn, so the
    // wave (far wider than the knot) never leaves the frame and the size
    // stays steady while it spins. Recomputed only when the tilt or form changes.
    let envelopeKey = "",
      envelope: [number, number] = [1, 1];
    const envelopeFor = (ax: number): [number, number] => {
      const key = `${lastForm}:${Math.round(ax * 40)}`;
      if (key === envelopeKey && !morphing) return envelope;
      envelopeKey = key;
      const cosX = Math.cos(ax),
        sinX = Math.sin(ax);
      let halfWidth = 0,
        halfHeight = 0;
      for (let step = 0; step < 12; step++) {
        const cosY = Math.cos((step * Math.PI) / 6),
          sinY = Math.sin((step * Math.PI) / 6);
        for (let i = 0; i < count; i += 2) {
          const [x, y, z] = current[i];
          const zz = -x * sinY + z * cosY;
          const depth = 5.5 / (5.5 - (y * sinX + zz * cosX));
          halfWidth = Math.max(halfWidth, Math.abs((x * cosY + z * sinY) * depth));
          halfHeight = Math.max(halfHeight, Math.abs((y * cosX - zz * sinX) * depth));
        }
      }
      // Headroom for the ripple and the in-between angles.
      envelope = [halfWidth * 1.06, halfHeight * 1.06];
      return envelope;
    };
    let angle = 0.45,
      phase = 0,
      tiltX = 0,
      tiltY = 0,
      bulge = 0,
      fit = 0,
      fitting = true;
    const draw = (time = 0) => {
      frame = requestAnimationFrame(draw);
      if (!visible || document.hidden) return;
      // Cache geometry and render at 30fps; settled, paused frames do no drawing.
      if (time - lastTime < 32) return;
      const dt = Math.min(time - lastTime, 50);
      lastTime = time;
      if (lastForm !== formRef.current) {
        lastForm = formRef.current;
        morphing = true;
        dirty = true;
      }
      const still = media.matches;
      const spin = spinRef.current;
      const animating = !pausedRef.current && !still;

      // Ease toward the pointer, and let a released drag coast to a stop.
      const targetTiltX = still ? 0 : pointer.y;
      const targetTiltY = still ? 0 : pointer.x;
      tiltX += (targetTiltX - tiltX) * 0.14;
      tiltY += (targetTiltY - tiltY) * 0.14;
      const targetBulge = interactive && pointer.inside && !pointer.dragging && !still ? 1 : 0;
      bulge += (targetBulge - bulge) * 0.18;
      if (!pointer.dragging) {
        if (Math.abs(spin.velocity) > 0.0005) {
          spin.yaw += spin.velocity;
          spin.velocity *= 0.93;
        } else spin.velocity = 0;
        if (!still) spin.pitch *= 0.96;
      }
      const settling =
        pointer.dragging ||
        fitting ||
        spin.velocity !== 0 ||
        Math.abs(spin.pitch) > 0.002 ||
        Math.abs(targetTiltX - tiltX) > 0.002 ||
        Math.abs(targetTiltY - tiltY) > 0.002 ||
        Math.abs(targetBulge - bulge) > 0.01;
      if (!animating && !morphing && !dirty && !settling) return;
      if (animating) {
        angle += dt * 0.00022;
        phase += dt * 0.0016;
      }
      if (morphing) {
        let delta = 0;
        const target = shapes[lastForm];
        for (let i = 0; i < count; i++) {
          const point = current[i];
          for (let j = 0; j < 3; j++) {
            const gap = target[i][j] - point[j];
            point[j] += gap * (still ? 1 : 0.12);
            delta += Math.abs(gap);
          }
        }
        morphing = delta > 0.1;
      }
      dirty = false;
      const ax = 0.36 + tiltX * 0.3 + spin.pitch;
      const ay = angle + spin.yaw + tiltY * 0.55;
      const cosX = Math.cos(ax),
        sinX = Math.sin(ax),
        cosY = Math.cos(ay),
        sinY = Math.sin(ay);
      const ripple = still ? 0 : 0.03;
      for (let i = 0; i < count; i++) {
        const k = 1 + ripple * Math.sin(ripplePhase[i] + phase);
        const x = current[i][0] * k,
          y = current[i][1] * k,
          z = current[i][2] * k;
        const zz = -x * sinY + z * cosY;
        rx[i] = x * cosY + z * sinY;
        ry[i] = y * cosX - zz * sinX;
        rz[i] = y * sinX + zz * cosX;
        sp[i] = 5.5 / (5.5 - rz[i]);
      }
      const [halfWidth, halfHeight] = envelopeFor(ax);
      const targetFit = Math.min((width * 0.47) / halfWidth, (height * 0.46) / halfHeight);
      // Shrink quickly so nothing clips; grow gently.
      fit = fit === 0 ? targetFit : fit + (targetFit - fit) * (targetFit < fit ? 0.35 : 0.1);
      fitting = Math.abs(targetFit - fit) > targetFit * 0.002;
      const cx = width * 0.5,
        cy = height * 0.5;
      const radius = Math.min(width, height) * 0.24,
        push = 22 * bulge;
      for (let i = 0; i < count; i++) {
        let x = cx + rx[i] * fit * sp[i],
          y = cy + ry[i] * fit * sp[i];
        // The surface swells away from the cursor like a lens.
        if (push > 0.5) {
          const dx = x - pointer.px,
            dy = y - pointer.py,
            d2 = dx * dx + dy * dy;
          if (d2 < radius * radius && d2 > 0.01) {
            const d = Math.sqrt(d2),
              falloff = 1 - d / radius,
              s = (falloff * falloff * push) / d;
            x += dx * s;
            y += dy * s;
          }
        }
        sx[i] = x;
        sy[i] = y;
      }
      ctx.clearRect(0, 0, width, height);
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
      window.removeEventListener("pointermove", onMouseMove);
      document.removeEventListener("pointerout", onMouseOut);
      media.removeEventListener("change", syncReduced);
    };
  }, [dark, detail, interactive]);

  const nextForm = () => {
    if (shape !== undefined) return;
    setChosen((form + 1) % forms.length);
    setPicked(true);
  };

  return (
    <div className="sculpture">
      <motion.canvas
        ref={canvasRef}
        style={canvasStyle}
        data-interactive={interactive || undefined}
        role={bare ? undefined : "img"}
        aria-hidden={bare || undefined}
        aria-label={
          bare
            ? undefined
            : `Interactive ${forms[form].toLowerCase()} sculpture. Drag to spin it, click to change shape.`
        }
        onPointerDown={(event) => {
          if (!interactive) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          Object.assign(pointerRef.current, {
            dragging: true,
            travel: 0,
            lastX: event.clientX,
            lastY: event.clientY,
          });
          spinRef.current.velocity = 0;
        }}
        onPointerMove={(event) => {
          const pointer = pointerRef.current;
          if (!pointer.dragging) return;
          const dx = event.clientX - pointer.lastX,
            dy = event.clientY - pointer.lastY;
          pointer.travel += Math.abs(dx) + Math.abs(dy);
          pointer.lastX = event.clientX;
          pointer.lastY = event.clientY;
          const spin = spinRef.current;
          spin.yaw += dx * 0.01;
          spin.pitch = clamp(spin.pitch + dy * 0.006, -0.9, 0.9);
          spin.velocity = dx * 0.01;
        }}
        onPointerUp={() => {
          const pointer = pointerRef.current;
          if (!pointer.dragging) return;
          pointer.dragging = false;
          if (pointer.travel < 6) {
            spinRef.current.velocity = 0;
            nextForm();
          }
        }}
        onPointerCancel={() => {
          pointerRef.current.dragging = false;
          spinRef.current.velocity = 0;
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

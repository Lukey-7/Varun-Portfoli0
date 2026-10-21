import { useCanvasLoop, type CanvasFrame } from "@/hooks/use-canvas-loop";

/**
 * Illustrative, procedurally drawn diagrams for the ORDO capability grid.
 * They depict how each system works; they are not product screenshots.
 */

const MONO = '"IBM Plex Mono", monospace';
const within = (f: CanvasFrame) =>
  f.pointer.inside &&
  f.pointer.x >= 0 &&
  f.pointer.y >= 0 &&
  f.pointer.x <= f.width &&
  f.pointer.y <= f.height;

/* Retrieval: a query point and its nearest neighbours on an embedding sphere. */
const spherePoints = Array.from({ length: 340 }, (_, i) => {
  const y = 1 - (i / 339) * 2;
  const r = Math.sqrt(1 - y * y);
  const a = i * 2.39996;
  return [Math.cos(a) * r, y, Math.sin(a) * r] as const;
});
function drawRetrieval(f: CanvasFrame) {
  const { ctx, width: w, height: h, time, pointer } = f;
  const hover = within(f);
  const yaw = time * 0.00035 + (hover ? (pointer.x / w - 0.5) * 1.6 : 0);
  const pitch = 0.35 + (hover ? (pointer.y / h - 0.5) * 0.8 : 0);
  const R = Math.min(w, h) * 0.38;
  const cx = w / 2,
    cy = h / 2;
  const q = [Math.cos(time * 0.0006), 0.35, Math.sin(time * 0.0006)];
  const ql = Math.hypot(...q);
  const cy1 = Math.cos(yaw),
    sy1 = Math.sin(yaw),
    cp = Math.cos(pitch),
    sp = Math.sin(pitch);
  const projected = spherePoints.map(([x, y, z]) => {
    const xx = x * cy1 + z * sy1,
      zz = -x * sy1 + z * cy1;
    const yy = y * cp - zz * sp,
      zzz = y * sp + zz * cp;
    const score = (x * q[0] + y * q[1] + z * q[2]) / ql;
    return { px: cx + xx * R, py: cy + yy * R, z: zzz, score };
  });
  const threshold = [...projected].sort((a, b) => b.score - a.score)[7].score;
  const anchor = projected.reduce((best, p) => (p.score > best.score ? p : best));
  ctx.strokeStyle = f.ink(0.35);
  ctx.lineWidth = 0.6;
  for (const p of projected) {
    const near = p.score >= threshold;
    if (near && p !== anchor) {
      ctx.beginPath();
      ctx.moveTo(anchor.px, anchor.py);
      ctx.lineTo(p.px, p.py);
      ctx.stroke();
    }
    ctx.fillStyle = f.ink(near ? 1 : 0.18 + (p.z + 1) * 0.32);
    const size = near ? 3.2 : 0.8 + (p.z + 1) * 0.7;
    ctx.fillRect(p.px - size / 2, p.py - size / 2, size, size);
  }
  ctx.strokeStyle = f.ink(1);
  ctx.strokeRect(anchor.px - 5, anchor.py - 5, 10, 10);
}

/* Agents: a supervisor hands work to five specialised agents in turn. */
const AGENTS = ["PLAN", "RESEARCH", "SUMMARY", "CRITIC", "WRITE"];
function drawAgents(f: CanvasFrame) {
  const { ctx, width: w, height: h, time, pointer } = f;
  const cx = w / 2,
    cy = h / 2;
  const rx = w * 0.36,
    ry = h * 0.34;
  const nodes = AGENTS.map((label, i) => {
    const a = -Math.PI / 2 + (i / AGENTS.length) * Math.PI * 2;
    return { label, x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
  });
  let active = Math.floor(time / 1100) % AGENTS.length;
  let progress = (time % 1100) / 1100;
  if (within(f)) {
    active = nodes.reduce(
      (best, n, i) =>
        Math.hypot(n.x - pointer.x, n.y - pointer.y) <
        Math.hypot(nodes[best].x - pointer.x, nodes[best].y - pointer.y)
          ? i
          : best,
      0,
    );
    progress = 0.5 + 0.5 * Math.sin(time * 0.006);
  }
  ctx.lineWidth = 0.8;
  nodes.forEach((n, i) => {
    ctx.setLineDash(i === active ? [] : [3, 4]);
    ctx.strokeStyle = f.ink(i === active ? 0.9 : 0.35);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(n.x, n.y);
    ctx.stroke();
  });
  ctx.setLineDash([]);
  const target = nodes[active];
  ctx.fillStyle = f.ink(1);
  ctx.fillRect(
    cx + (target.x - cx) * progress - 2.5,
    cy + (target.y - cy) * progress - 2.5,
    5,
    5,
  );
  ctx.font = `8px ${MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  nodes.forEach((n, i) => {
    const boxW = ctx.measureText(n.label).width + 12;
    ctx.fillStyle = i === active ? f.ink(1) : f.page;
    ctx.fillRect(n.x - boxW / 2, n.y - 9, boxW, 18);
    ctx.strokeStyle = f.ink(0.8);
    ctx.strokeRect(n.x - boxW / 2, n.y - 9, boxW, 18);
    ctx.fillStyle = i === active ? f.page : f.ink(0.85);
    ctx.fillText(n.label, n.x, n.y + 0.5);
  });
  ctx.fillStyle = f.page;
  ctx.beginPath();
  ctx.arc(cx, cy, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = f.ink(0.9);
  ctx.stroke();
  ctx.fillStyle = f.ink(0.75);
  for (let gx = -2; gx <= 2; gx++)
    for (let gy = -2; gy <= 2; gy++)
      if (gx * gx + gy * gy <= 5) ctx.fillRect(cx + gx * 5 - 0.8, cy + gy * 5 - 0.8, 1.6, 1.6);
}

/* Evaluation: 35 labelled queries checked by a sweeping evaluation run. */
function drawEvaluation(f: CanvasFrame) {
  const { ctx, width: w, height: h, time, pointer } = f;
  const cols = 7,
    rows = 5;
  const gap = 5;
  const cell = Math.min((w * 0.82 - gap * (cols - 1)) / cols, (h * 0.72 - gap * (rows - 1)) / rows);
  const gridW = cols * cell + (cols - 1) * gap;
  const gridH = rows * cell + (rows - 1) * gap;
  const x0 = (w - gridW) / 2,
    y0 = (h - gridH) / 2 - 6;
  const sweep = ((time / 2600) % 1.25) * cols;
  let hovered = -1;
  for (let i = 0; i < cols * rows; i++) {
    const c = i % cols,
      r = Math.floor(i / cols);
    const x = x0 + c * (cell + gap),
      y = y0 + r * (cell + gap);
    const over =
      within(f) && pointer.x >= x && pointer.x <= x + cell && pointer.y >= y && pointer.y <= y + cell;
    if (over) hovered = i;
    const lit = Math.max(0, 1 - Math.abs(sweep - c - 0.5));
    if (over) {
      ctx.strokeStyle = f.ink(1);
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
      ctx.beginPath();
      ctx.moveTo(x + cell * 0.28, y + cell * 0.52);
      ctx.lineTo(x + cell * 0.44, y + cell * 0.68);
      ctx.lineTo(x + cell * 0.74, y + cell * 0.34);
      ctx.stroke();
    } else {
      ctx.fillStyle = f.ink(0.72 + lit * 0.28);
      ctx.fillRect(x, y, cell, cell);
    }
  }
  ctx.font = `8px ${MONO}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = f.ink(0.7);
  ctx.fillText(
    hovered >= 0 ? `QUERY ${String(hovered + 1).padStart(2, "0")} / 35 · EVALUATED` : "SUITE mara-eval · 35 QUERIES",
    x0,
    y0 + gridH + 16,
  );
}

/* Documents: a scan line reads a bill and fills validated fields. */
const FIELDS = ["VENDOR", "DATE", "TOTAL", "TAX"];
function drawDocuments(f: CanvasFrame) {
  const { ctx, width: w, height: h, time, pointer } = f;
  const docX = w * 0.1,
    docY = h * 0.1,
    docW = w * 0.32,
    docH = h * 0.8;
  const auto = (Math.sin(time * 0.0012) * 0.5 + 0.5) * docH;
  const scan = within(f) ? Math.min(docH, Math.max(0, pointer.y - docY)) : auto;
  ctx.strokeStyle = f.ink(0.85);
  ctx.lineWidth = 1;
  ctx.strokeRect(docX, docY, docW, docH);
  const lines = 9;
  for (let i = 0; i < lines; i++) {
    const ly = docY + 14 + (i * (docH - 28)) / (lines - 1);
    const lw = docW * (i % 3 === 0 ? 0.62 : i % 3 === 1 ? 0.78 : 0.45);
    ctx.fillStyle = f.ink(ly - docY < scan ? 0.8 : 0.22);
    ctx.fillRect(docX + 10, ly, lw - 10, 3);
  }
  ctx.fillStyle = f.ink(0.08);
  ctx.fillRect(docX, docY, docW, scan);
  ctx.strokeStyle = f.ink(1);
  ctx.beginPath();
  ctx.moveTo(docX - 6, docY + scan);
  ctx.lineTo(docX + docW + 6, docY + scan);
  ctx.stroke();
  ctx.font = `8px ${MONO}`;
  ctx.textBaseline = "middle";
  FIELDS.forEach((name, i) => {
    const fy = docY + 18 + (i * (docH - 36)) / (FIELDS.length - 1);
    const done = scan > (i + 0.6) * (docH / FIELDS.length);
    const fx = w * 0.54;
    ctx.setLineDash(done ? [] : [3, 3]);
    ctx.strokeStyle = f.ink(done ? 0.7 : 0.3);
    ctx.beginPath();
    ctx.moveTo(docX + docW + 8, fy);
    ctx.lineTo(fx - 6, fy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = f.ink(done ? 0.95 : 0.4);
    ctx.textAlign = "left";
    ctx.fillText(name, fx, fy - 7);
    ctx.fillStyle = f.ink(done ? 0.85 : 0.15);
    ctx.fillRect(fx, fy + 2, w * 0.24, 4);
    ctx.textAlign = "right";
    ctx.fillStyle = f.ink(done ? 1 : 0.3);
    ctx.fillText(done ? "✓" : "·", w * 0.92, fy);
  });
}

/* Media: a clip timeline with joins and a playhead you can scrub. */
function drawMedia(f: CanvasFrame) {
  const { ctx, width: w, height: h, time, pointer } = f;
  const frames = 5;
  const fx0 = w * 0.08,
    fw = (w * 0.84 - (frames - 1) * 6) / frames,
    fy = h * 0.14,
    fh = fw * 0.75;
  const tlY = fy + fh + h * 0.16;
  const tlX = fx0,
    tlW = w * 0.84;
  const play = within(f)
    ? Math.min(1, Math.max(0, (pointer.x - tlX) / tlW))
    : (time / 5200) % 1;
  const activeFrame = Math.min(frames - 1, Math.floor(play * frames));
  for (let i = 0; i < frames; i++) {
    const x = fx0 + i * (fw + 6);
    ctx.lineWidth = i === activeFrame ? 1.6 : 0.8;
    ctx.strokeStyle = f.ink(i === activeFrame ? 1 : 0.45);
    ctx.strokeRect(x, fy, fw, fh);
    const local = (play * frames - i + 1) / 3;
    ctx.fillStyle = f.ink(i === activeFrame ? 0.9 : 0.35);
    ctx.beginPath();
    ctx.arc(x + fw * (0.25 + 0.5 * Math.max(0, Math.min(1, local))), fy + fh * 0.55, fh * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x, fy + fh * 0.8, fw, 1);
  }
  const joins = [0.38, 0.7];
  ctx.fillStyle = f.ink(0.16);
  ctx.fillRect(tlX, tlY - 6, tlW, 12);
  ctx.fillStyle = f.ink(0.75);
  ctx.fillRect(tlX, tlY - 6, tlW * play, 12);
  ctx.fillStyle = f.page;
  joins.forEach((j) => ctx.fillRect(tlX + tlW * j - 1, tlY - 8, 2, 16));
  ctx.strokeStyle = f.ink(1);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tlX + tlW * play, fy + fh + 6);
  ctx.lineTo(tlX + tlW * play, tlY + 12);
  ctx.stroke();
  ctx.font = `8px ${MONO}`;
  ctx.fillStyle = f.ink(0.65);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("CLIP A", tlX, tlY + 14);
  ctx.fillText("EXTEND", tlX + tlW * joins[0] + 4, tlY + 14);
  ctx.fillText("JOIN", tlX + tlW * joins[1] + 4, tlY + 14);
}

/* On-device: transaction messages are parsed and sorted by flow, on the phone. */
const FLOWS = ["EXPENSE", "REFUND", "TRANSFER"];
function drawOnDevice(f: CanvasFrame) {
  const { ctx, width: w, height: h, time } = f;
  const t = time * (within(f) ? 0.35 : 1);
  const px = w * 0.1,
    py = h * 0.08,
    pw = w * 0.28,
    ph = h * 0.84;
  ctx.strokeStyle = f.ink(0.85);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 10);
  ctx.stroke();
  ctx.fillRect(px + pw * 0.35, py + 6, pw * 0.3, 2);
  const period = 1400;
  const step = Math.floor(t / period);
  const phase = (t % period) / period;
  ctx.save();
  ctx.beginPath();
  ctx.rect(px + 4, py + 14, pw - 8, ph - 22);
  ctx.clip();
  for (let k = 0; k < 6; k++) {
    const my = py + ph - 26 - k * 22 - phase * 22;
    ctx.fillStyle = f.ink(k === 0 ? 0.9 : 0.35);
    ctx.fillRect(px + 10, my, pw * (k % 2 ? 0.58 : 0.7), 12);
  }
  ctx.restore();
  const counts = [0, 0, 0];
  for (let s = 0; s <= step; s++) counts[(s * 7 + (s >> 1)) % 3]++;
  const bx = w * 0.56,
    bw = w * 0.34;
  ctx.font = `8px ${MONO}`;
  ctx.textBaseline = "bottom";
  ctx.textAlign = "left";
  const max = Math.max(...counts, 1);
  FLOWS.forEach((name, i) => {
    const by = py + 24 + i * (ph / 3);
    ctx.fillStyle = f.ink(0.7);
    ctx.fillText(name, bx, by - 4);
    ctx.fillStyle = f.ink(0.15);
    ctx.fillRect(bx, by, bw, 8);
    ctx.fillStyle = f.ink(0.85);
    ctx.fillRect(bx, by, bw * (0.15 + 0.85 * (counts[i] / max)), 8);
  });
  const target = (step * 7 + (step >> 1)) % 3;
  const sx = px + pw * 0.75,
    sy = py + ph - 20;
  const tx = bx,
    ty = py + 28 + target * (ph / 3);
  ctx.fillStyle = f.ink(1);
  ctx.fillRect(sx + (tx - sx) * phase - 2.5, sy + (ty - sy) * phase - 2.5, 5, 5);
}

const DRAWERS: Record<string, (f: CanvasFrame) => void> = {
  retrieval: drawRetrieval,
  agents: drawAgents,
  evaluation: drawEvaluation,
  documents: drawDocuments,
  media: drawMedia,
  ondevice: drawOnDevice,
};

export default function CapabilityArt({ kind }: { kind: string }) {
  const ref = useCanvasLoop(DRAWERS[kind] ?? drawRetrieval);
  return <canvas ref={ref} className="capability-canvas" aria-hidden="true" />;
}

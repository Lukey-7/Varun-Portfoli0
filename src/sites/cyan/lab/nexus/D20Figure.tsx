import { useEffect, useRef } from "react";
import { useLiveMotion } from "./useLiveMotion";

/*
 * A generated figure for the one project without screenshots: a wireframe
 * twenty-sided die, drawn in SVG and turned slowly in 3D. It is labelled as a
 * figure wherever it appears, so nobody mistakes it for a screenshot.
 */
const PHI = (1 + Math.sqrt(5)) / 2;
const VERTICES: [number, number, number][] = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
];
const EDGES: [number, number][] = [];
for (let i = 0; i < VERTICES.length; i++)
  for (let j = i + 1; j < VERTICES.length; j++) {
    const [a, b] = [VERTICES[i], VERTICES[j]];
    const d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
    if (Math.abs(d - 4) < 1e-6) EDGES.push([i, j]);
  }

function project(yaw: number, pitch: number) {
  const [cy, sy, cp, sp] = [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch)];
  return VERTICES.map(([x, y, z]) => {
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    const y2 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    const s = 5 / (5 - z2);
    return [x1 * s, y2 * s, z2] as const;
  });
}

export function D20Figure({ className }: { className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const live = useLiveMotion();

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const lines = Array.from(svg.querySelectorAll<SVGLineElement>("[data-edge]"));
    const dots = Array.from(svg.querySelectorAll<SVGCircleElement>("[data-vertex]"));
    let yaw = 0.55;
    let pitch = 0.38;
    const draw = () => {
      const pts = project(yaw, pitch);
      EDGES.forEach(([i, j], k) => {
        const [a, b] = [pts[i], pts[j]];
        const line = lines[k];
        line.setAttribute("x1", a[0].toFixed(3));
        line.setAttribute("y1", a[1].toFixed(3));
        line.setAttribute("x2", b[0].toFixed(3));
        line.setAttribute("y2", b[1].toFixed(3));
        const depth = (a[2] + b[2]) / 2 / PHI; // -1 back .. 1 front
        line.style.opacity = (0.28 + 0.36 * (depth + 1)).toFixed(3);
      });
      pts.forEach((p, k) => {
        dots[k].setAttribute("cx", p[0].toFixed(3));
        dots[k].setAttribute("cy", p[1].toFixed(3));
        dots[k].style.opacity = (0.3 + 0.35 * (p[2] / PHI + 1)).toFixed(3);
      });
    };
    draw();
    if (!live) return;

    // Turns only while on screen, and stops when paused or unmounted.
    let frame = 0;
    let last = 0;
    let visible = false;
    const tick = (now: number) => {
      const dt = last ? Math.min(64, now - last) : 16;
      last = now;
      yaw += dt * 0.00032;
      pitch = 0.38 + Math.sin(now * 0.0004) * 0.18;
      draw();
      frame = requestAnimationFrame(tick);
    };
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            cancelAnimationFrame(frame);
            last = 0;
            if (visible) frame = requestAnimationFrame(tick);
          });
    observer?.observe(svg);
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [live]);

  return (
    <svg ref={svgRef} className={`nx-d20 ${className ?? ""}`} viewBox="-2.6 -2.6 5.2 5.2" aria-hidden="true" focusable="false">
      <g className="nx-d20-rings">
        <circle r="2.35" />
        <circle r="2.05" strokeDasharray="0.04 0.12" />
        <line x1="-2.55" x2="-2.25" y1="0" y2="0" />
        <line x1="2.25" x2="2.55" y1="0" y2="0" />
        <line y1="-2.55" y2="-2.25" x1="0" x2="0" />
        <line y1="2.25" y2="2.55" x1="0" x2="0" />
      </g>
      <g className="nx-d20-edges">
        {EDGES.map(([i, j]) => (
          <line key={`${i}-${j}`} data-edge="" />
        ))}
      </g>
      <g className="nx-d20-vertices">
        {VERTICES.map((_, i) => (
          <circle key={i} data-vertex="" r="0.05" />
        ))}
      </g>
    </svg>
  );
}

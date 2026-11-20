import { useRef } from "react";
import { useInView } from "framer-motion";
import type { Education } from "@/data/profile";
import { pointerLight } from "../kit";
import { educationOldestFirst, pad2, readGrade } from "./data";
import { useStill } from "./hooks";

/*
 * Education as a calibration record: one panel per qualification, oldest
 * first like the trace. Where the résumé gives a grade, a gauge reads it out;
 * the needle swings to the value once, when the panel comes into view. The
 * grade is a measurement, so it is the only thing in amber.
 */

const CX = 80;
const CY = 82;
const R = 64;
const MAX = 10;

const polar = (value: number, radius: number) => {
  const angle = Math.PI - (value / MAX) * Math.PI;
  return { x: CX + Math.cos(angle) * radius, y: CY - Math.sin(angle) * radius };
};

function Gauge({ value, label }: { value: number; label: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const still = useStill();
  const shown = still || inView;
  const ticks = Array.from({ length: MAX * 2 + 1 }, (_, i) => i / 2);

  return (
    <div className="logs-gauge" data-shown={shown ? "" : undefined}>
      <svg ref={ref} viewBox="0 0 160 96" role="img" aria-label={`${label} out of ${MAX}`}>
        <path className="logs-gauge-track" d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} />
        <path
          className="logs-gauge-value"
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          pathLength={1}
          style={{ strokeDasharray: `${shown ? value / MAX : 0} 1` }}
        />
        <g aria-hidden="true">
          {ticks.map((tick) => {
            const major = tick % 5 === 0;
            const outer = polar(tick, R - 7);
            const inner = polar(tick, R - (major ? 15 : Number.isInteger(tick) ? 12 : 10));
            return (
              <line
                key={tick}
                className={major ? "logs-gauge-tick major" : "logs-gauge-tick"}
                x1={outer.x}
                y1={outer.y}
                x2={inner.x}
                y2={inner.y}
              />
            );
          })}
          {[0, 5, 10].map((tick) => {
            const at = polar(tick, R - 25);
            return (
              <text key={tick} className="logs-gauge-label" x={at.x} y={at.y + 3} textAnchor="middle">
                {tick}
              </text>
            );
          })}
          <g transform={`translate(${CX} ${CY})`}>
            <g className="logs-needle" style={{ transform: `rotate(${shown ? (value / MAX) * 180 : 0}deg)` }}>
              <line x1={0} y1={0} x2={-(R - 6)} y2={0} />
            </g>
            <circle className="logs-needle-hub" r={3.5} />
          </g>
        </g>
      </svg>
      <p className="logs-gauge-readout mono" aria-hidden="true">
        <span className="lab-readout">{value.toFixed(1)}</span>
        <span>/ {MAX} CGPA</span>
      </p>
    </div>
  );
}

function Plate({ item, index }: { item: Education; index: number }) {
  const grade = readGrade(item);
  return (
    <li className="logs-cal lab-panel" {...pointerLight}>
      <p className="logs-cal-head mono">
        <span>Cal. {pad2(index + 1)}</span>
        <time dateTime={item.year}>{item.year}</time>
      </p>
      <h3 className="logs-cal-title">{item.degree}</h3>
      <p className="logs-cal-place">{item.institution}</p>
      {grade !== null && item.detail ? (
        <Gauge value={grade} label={item.detail} />
      ) : (
        <div className="logs-cal-year" aria-hidden="true">
          <span className="mono">Year</span>
          <strong>{item.year}</strong>
        </div>
      )}
    </li>
  );
}

export function Calibration() {
  const items = educationOldestFirst();
  return (
    <ol className="logs-cal-grid">
      {items.map((item, index) => (
        <Plate key={item.id} item={item} index={index} />
      ))}
    </ol>
  );
}

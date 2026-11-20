import type { CSSProperties } from "react";
import { softSkills } from "@/data/profile";
import { pointerLight } from "../kit";
import { pad2 } from "./data";

/*
 * How I work, as a bank of channels on the instrument: every channel is on,
 * each with its own carrier running at its own rate. A selector lamp steps
 * across them in turn. There are no levels or scores here on purpose: these
 * are ways of working, not measurements, so nothing is amber.
 */

const WIDTH = 120;
const HEIGHT = 18;

/** Two periods of a sine, drawn twice so it can scroll seamlessly. */
function carrier(cycles: number) {
  const steps = 96;
  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = t * WIDTH * 2;
    const y = HEIGHT / 2 - Math.sin(t * Math.PI * 2 * cycles * 2) * (HEIGHT / 2 - 2);
    points.push(`${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return points.join(" ");
}

export function OperatingModes() {
  return (
    <div className="logs-modes lab-panel" {...pointerLight}>
      <div className="logs-modes-head mono">
        <span>Channel bank</span>
        <span>
          <span className="lab-readout">{pad2(softSkills.length)}</span> channels, all on
        </span>
      </div>
      <ul className="logs-modes-grid" style={{ "--channels": softSkills.length } as CSSProperties}>
        {softSkills.map((skill, index) => (
          <li key={skill} className="logs-mode" style={{ "--i": index } as CSSProperties}>
            <span className="logs-mode-top mono" aria-hidden="true">
              <span>CH {pad2(index + 1)}</span>
              <span className="logs-led" />
            </span>
            <span className="logs-mode-name">{skill}</span>
            <span className="logs-carrier" aria-hidden="true">
              <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" focusable="false">
                <path d={carrier(index + 1)} />
              </svg>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

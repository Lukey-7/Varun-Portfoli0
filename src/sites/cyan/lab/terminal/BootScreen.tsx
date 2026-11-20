import type { ReactNode } from "react";
import { bootText, type BootLine } from "./boot";

/**
 * The typed cold-start report. `typed` counts characters across every line;
 * a line that has not begun is not drawn, and a block caret rides the end of
 * the line being typed. The whole block is decorative: the page announces
 * "ready" once, through the terminal's own status region.
 */
export function BootScreen({ lines, typed, done }: { lines: BootLine[]; typed: number; done: boolean }) {
  let budget = done ? Number.POSITIVE_INFINITY : typed;
  const rows: ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (budget <= 0) break;
    const { label, leader, value } = bootText(lines[i]);
    const total = label.length + leader.length + value.length;
    const take = (text: string) => {
      const part = text.slice(0, Math.max(0, budget));
      budget -= text.length;
      return part;
    };
    const typing = budget < total;
    const shownLabel = take(label);
    const shownLeader = take(leader);
    const shownValue = take(value);
    const header = lines[i].value === undefined;
    rows.push(
      <span key={i} className={`term-boot-line${header ? " is-header" : ""}`}>
        <span className="term-boot-label">{shownLabel}</span>
        <span className="term-boot-leader">{shownLeader}</span>
        <span className="term-boot-value">{shownValue}</span>
        {typing && !done && <span className="term-boot-caret" />}
      </span>,
    );
  }

  return (
    <pre className="term-boot" aria-hidden="true">
      {rows}
    </pre>
  );
}

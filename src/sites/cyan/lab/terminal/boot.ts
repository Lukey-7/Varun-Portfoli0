/**
 * The terminal's cold-start sequence. Every value is read from the visitor's
 * own browser or from the command table itself, so the boot screen reports
 * real state rather than decoration.
 */

export interface BootLine {
  /** A header line is drawn in the accent colour and has no value. */
  label: string;
  value?: string;
}

/** Labels are padded with leader dots to this column, so the values line up. */
const COLUMN = 15;

const clockFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function buildBootLines({
  commandCount,
  games,
  theme,
  motion,
  finePointer,
}: {
  commandCount: number;
  games: string[];
  theme: string;
  motion: string;
  finePointer: boolean;
}): BootLine[] {
  const width = typeof window === "undefined" ? 0 : window.innerWidth;
  const height = typeof window === "undefined" ? 0 : window.innerHeight;
  return [
    { label: "LAB/04 TERMINAL · COLD START" },
    { label: "power", value: "ok" },
    { label: "command set", value: `${commandCount} commands` },
    { label: "game links", value: games.join(", ") },
    { label: "clock", value: `${clockFormat.format(new Date())} IST, Mumbai` },
    { label: "display", value: `${width}×${height} · ${theme}` },
    { label: "pointer", value: finePointer ? "fine" : "coarse" },
    { label: "motion", value: motion },
    { label: "ready." },
  ];
}

/** The line as it is typed: label, leader dots, value. */
export function bootText(line: BootLine) {
  if (line.value === undefined) return { label: line.label, leader: "", value: "" };
  const dots = Math.max(3, COLUMN - line.label.length);
  return { label: line.label, leader: ` ${".".repeat(dots)} `, value: line.value };
}

export const bootLength = (lines: BootLine[]) =>
  lines.reduce((sum, line) => {
    const text = bootText(line);
    return sum + text.label.length + text.leader.length + text.value.length;
  }, 0);

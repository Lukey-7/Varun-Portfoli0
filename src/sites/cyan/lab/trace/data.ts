import { experience, education, type Education, type Experience } from "@/data/profile";
import { formatJourneyDate, journey, journeyKinds, type JourneyKind } from "@/sites/ordo/journey";
import { parsePeriod } from "../../motion/ExperienceTimeline";

/*
 * Everything the logs page draws, worked out from the résumé data and the
 * journey log. Nothing here is typed in by hand: counts, months and spans are
 * all derived, so the instruments can never disagree with the data.
 */

export type LogKind = JourneyKind;

/** A role from the résumé, with its length in months worked out from its period. */
export interface LogRole extends Experience {
  months: number;
  start: Date;
}

export interface LogEntry {
  id: string;
  /** "YYYY-MM" or "YYYY", as in the journey log. */
  date: string;
  year: string;
  /** "Sep 2026", or "2026" when only the year is known. */
  label: string;
  kind: LogKind;
  title: string;
  text?: string;
  /** A page on the monochrome site. */
  to?: string;
  href?: string;
  /** Set when this entry is the start of a role, so the row can open its highlights. */
  role?: LogRole;
}

const KIND_SINGULAR: Record<LogKind, string> = {
  work: "Work",
  project: "Project",
  research: "Research",
  writing: "Writing",
  education: "Education",
  site: "Site",
};

export const kindLabel = (kind: LogKind) => KIND_SINGULAR[kind];

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export function readRoles(now: Date): LogRole[] {
  return experience.flatMap((job) => {
    try {
      const { months, start } = parsePeriod(job.period, now);
      return [{ ...job, months, start }];
    } catch {
      return [];
    }
  });
}

/** The journey, oldest first, so the trace runs forward in time and ends at the present. */
export function readLog(now: Date): LogEntry[] {
  const roles = readRoles(now);
  return [...journey].reverse().map((item, index) => ({
    id: `log-${index}`,
    date: item.date,
    year: item.date.slice(0, 4),
    label: formatJourneyDate(item.date),
    kind: item.kind,
    title: item.title,
    text: item.text,
    to: item.to,
    href: item.href,
    role: item.kind === "work" ? roles.find((role) => monthKey(role.start) === item.date) : undefined,
  }));
}

/** The kinds in the order the journey log lists them, with how many entries each has. */
export function readKinds(entries: LogEntry[]) {
  return journeyKinds
    .map((kind) => ({ ...kind, label: kind.id === "site" ? KIND_SINGULAR.site : kind.label, count: entries.filter((entry) => entry.kind === kind.id).length }))
    .filter((kind) => kind.count > 0);
}

export interface Quarter {
  label: string;
  count: number;
}

/** Dated entries per calendar quarter, from the first quarter of the earliest year to the current one. */
export function readQuarters(entries: LogEntry[], now: Date): Quarter[] {
  const dated = entries.filter((entry) => entry.date.length === 7);
  if (!dated.length) return [];
  const firstYear = Math.min(...dated.map((entry) => Number(entry.year)));
  const lastIndex = now.getFullYear() * 4 + Math.floor(now.getMonth() / 3);
  const quarters: Quarter[] = [];
  for (let index = firstYear * 4; index <= lastIndex; index++) {
    const year = Math.floor(index / 4);
    const quarter = index % 4;
    const count = dated.filter((entry) => {
      const month = Number(entry.date.slice(5, 7)) - 1;
      return Number(entry.year) === year && Math.floor(month / 3) === quarter;
    }).length;
    quarters.push({ label: `Q${quarter + 1} ${year}`, count });
  }
  return quarters;
}

export function readSummary(now: Date) {
  const entries = readLog(now);
  const roles = readRoles(now);
  const years = entries.map((entry) => Number(entry.year));
  return {
    entries: entries.length,
    roles: roles.length,
    monthsAtWork: roles.reduce((sum, role) => sum + role.months, 0),
    firstYear: Math.min(...years),
    lastYear: Math.max(now.getFullYear(), ...years),
    quarters: readQuarters(entries, now),
    current: roles.find((role) => role.current),
  };
}

/** "8.6" from "CGPA 8.6", for the gauge; null when the detail is not a grade. */
export function readGrade(item: Education): number | null {
  const match = /CGPA\s*([\d.]+)/i.exec(item.detail ?? "");
  const value = match ? Number(match[1]) : NaN;
  return Number.isFinite(value) && value >= 0 && value <= 10 ? value : null;
}

/** Education oldest first, to read in the same direction as the trace. */
export const educationOldestFirst = () => [...education].sort((a, b) => a.year.localeCompare(b.year));

export const pad2 = (value: number) => String(value).padStart(2, "0");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const formatMonth = (date: Date) => `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;

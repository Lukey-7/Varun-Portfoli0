import { useMemo } from "react";
import { useReducedMotion } from "framer-motion";
import type { Experience } from "@/data/profile";
import { useMotionPaused } from "@/lib/motion-pause";
import "./experience-timeline.css";

/*
 * The experience section as a time axis. Each job is a segment on the axis, drawn
 * to scale, with a tick for every calendar year. The job you are working at has a
 * live end that pulses; under reduced motion or the site-wide pause the pulse
 * stops and the end is simply drawn, lit. Hovering or focusing a segment, or the
 * matching row of the list below, lights the pair and reads out its length in
 * months. The months are worked out from the résumé dates, so they are a real
 * figure and the only thing drawn in amber; the rest is accent colour.
 */

const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "Dec 2025 — Apr 2026" or "Aug 2026 — Present", with an em dash, an en dash or a hyphen. */
const PERIOD = /^\s*([a-z]{3,9})\.?\s+(\d{4})\s*[—–-]\s*(?:(present|now)|([a-z]{3,9})\.?\s+(\d{4}))\s*$/i;

const monthIndex = (name: string) => MONTH_NAMES.indexOf(name.slice(0, 3).toLowerCase());

/**
 * Reads a résumé period. `start` is the first day of the first month. `end` is the
 * last day of the last month, or `now` for a period still running. `months` counts
 * both end months, so Dec 2025 to Apr 2026 is 5, and is never less than 1. A period
 * it cannot read throws a RangeError: dates are data, and a wrong one should be
 * seen, not guessed at.
 */
// eslint-disable-next-line react-refresh/only-export-components -- the timeline's date maths and its tests share this helper
export function parsePeriod(period: string, now: Date): { start: Date; end: Date; months: number } {
  const match = PERIOD.exec(period);
  const startMonth = match ? monthIndex(match[1]) : -1;
  if (!match || startMonth < 0) throw new RangeError(`Cannot read the period "${period}"`);

  const start = new Date(Number(match[2]), startMonth, 1);
  const startIndex = start.getFullYear() * 12 + start.getMonth();

  if (match[3]) {
    const months = Math.max(1, now.getFullYear() * 12 + now.getMonth() - startIndex + 1);
    return { start, end: new Date(Math.max(now.getTime(), start.getTime())), months };
  }

  const endMonth = monthIndex(match[4]);
  if (endMonth < 0) throw new RangeError(`Cannot read the period "${period}"`);
  const endYear = Number(match[5]);
  const months = endYear * 12 + endMonth - startIndex + 1;
  if (months < 1) throw new RangeError(`The period "${period}" ends before it starts`);
  return { start, end: new Date(endYear, endMonth + 1, 0), months };
}

/** The axis is drawn in these units and scaled to the width of its box. */
const WIDTH = 1000;
const HEIGHT = 56;
const SEGMENT_Y = 10;
const SEGMENT_HEIGHT = 26;
const AXIS_Y = 44;
const TICK_HALF = 4;
/** A tick label this close to the right edge is set to the left of its tick instead. */
const FLIP_FROM = 880;

const round = (value: number) => Math.round(value * 100) / 100;
const monthsLabel = (months: number) => `${months} ${months === 1 ? "month" : "months"}`;

export function ExperienceTimeline({
  jobs,
  active,
  onActive,
  now,
}: {
  jobs: Experience[];
  active: string | null;
  onActive: (id: string | null) => void;
  now?: Date;
}) {
  const reduced = useReducedMotion();
  const paused = useMotionPaused();
  const still = Boolean(reduced) || paused;

  const { segments, ticks } = useMemo(() => {
    const clock = now ?? new Date();
    // A job whose period cannot be read is left off the axis; the rest still draw.
    const parsed = jobs.flatMap((job) => {
      try {
        return [{ job, ...parsePeriod(job.period, clock) }];
      } catch {
        return [];
      }
    });
    const latest = Math.max(clock.getTime(), ...parsed.map((item) => item.end.getTime()));
    const earliest = Math.min(clock.getTime(), ...parsed.map((item) => item.start.getTime()));
    // The axis starts on 1 January of the earliest year, so every year tick sits at its true place,
    // and ends with the current month, which leaves the live end room to show.
    const first = new Date(new Date(earliest).getFullYear(), 0, 1).getTime();
    const lastDate = new Date(latest);
    const last = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 1).getTime();
    const place = (time: number) => round(((time - first) / (last - first)) * WIDTH);

    const years: number[] = [];
    for (let year = new Date(first).getFullYear(); year <= lastDate.getFullYear(); year++) years.push(year);

    return {
      ticks: years.map((year) => ({ year, x: place(new Date(year, 0, 1).getTime()) })),
      segments: parsed.map((item) => {
        const left = place(item.start.getTime());
        return { ...item, x: left, width: Math.max(2, round(place(item.end.getTime()) - left)) };
      }),
    };
  }, [jobs, now]);

  const activeSegment = segments.find((segment) => segment.job.id === active);
  // Leaving one job must not clear the job that has since taken over.
  const release = (id: string) => {
    if (active === id) onActive(null);
  };

  return (
    <div
      className="experience-timeline"
      data-has-active={activeSegment ? "" : undefined}
      data-still={still ? "" : undefined}
    >
      <div className="experience-timeline-head">
        <span className="experience-timeline-caption">Time on each role</span>
        {/* Focusing a segment already announces its length, so the readout does not announce it again. */}
        <output className="experience-timeline-readout" aria-live="off">
          {activeSegment ? monthsLabel(activeSegment.months).toUpperCase() : null}
        </output>
      </div>
      <div className="experience-timeline-plot">
        {/* preserveAspectRatio="none" stretches the axis to the width of its box and keeps its height in pixels. */}
        <svg
          className="experience-timeline-svg"
          role="group"
          aria-label="Experience timeline"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
        >
          <g aria-hidden="true">
            <line className="experience-timeline-axis" x1={0} x2={WIDTH} y1={AXIS_Y} y2={AXIS_Y} />
            {ticks.map((tick) => (
              <line
                key={tick.year}
                className="experience-timeline-tick"
                x1={tick.x}
                x2={tick.x}
                y1={AXIS_Y - TICK_HALF}
                y2={AXIS_Y + TICK_HALF}
              />
            ))}
          </g>
          {segments.map(({ job, months, x: left, width }) => (
            <rect
              key={job.id}
              className="experience-timeline-seg"
              data-job={job.id}
              data-active={active === job.id ? "" : undefined}
              data-current={job.current ? "" : undefined}
              x={left}
              y={SEGMENT_Y}
              width={width}
              height={SEGMENT_HEIGHT}
              tabIndex={0}
              role="img"
              aria-label={`${job.role}, ${job.company}, ${monthsLabel(months)}`}
              onMouseEnter={() => onActive(job.id)}
              onMouseLeave={() => release(job.id)}
              onFocus={() => onActive(job.id)}
              onBlur={() => release(job.id)}
            />
          ))}
          {/* The live end of the current job: a bar on its last edge and a halo that breathes. */}
          <g aria-hidden="true">
            {segments
              .filter(({ job }) => job.current)
              .map(({ job, x: left, width }) => {
                const end = round(left + width);
                return (
                  <g key={job.id}>
                    <line
                      className="experience-timeline-halo"
                      x1={end}
                      x2={end}
                      y1={SEGMENT_Y - 2}
                      y2={SEGMENT_Y + SEGMENT_HEIGHT + 2}
                    />
                    <line
                      className="experience-timeline-live"
                      x1={end}
                      x2={end}
                      y1={SEGMENT_Y - 2}
                      y2={SEGMENT_Y + SEGMENT_HEIGHT + 2}
                    />
                  </g>
                );
              })}
          </g>
        </svg>
        <div className="experience-timeline-years" aria-hidden="true">
          {ticks.map((tick) => (
            <span
              key={tick.year}
              className="experience-timeline-year"
              data-flip={tick.x > FLIP_FROM ? "" : undefined}
              style={{ left: `${round((tick.x / WIDTH) * 100)}%` }}
            >
              {tick.year}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

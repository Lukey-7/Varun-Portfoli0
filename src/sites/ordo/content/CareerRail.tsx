import { useMemo, useState, type CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { education, experience } from "@/data/profile";
import { spotlight } from "../spotlight";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const EASE = [0.16, 1, 0.3, 1] as const;

interface RailItem {
  key: string;
  lane: "work" | "study";
  /** Months from January of the first year on the axis. */
  from: number;
  to: number;
  short: string;
  title: string;
  place: string;
  when: string;
  note?: string;
  /** The spotlight target further down the page. */
  target: string;
  current?: boolean;
}

/** "Aug 2026" -> months since January of `origin`. */
function monthIndex(text: string, origin: number) {
  const [month, year] = text.trim().split(/\s+/);
  const m = MONTHS.indexOf(month.slice(0, 3));
  return (Number(year) - origin) * 12 + Math.max(0, m);
}

/**
 * Roles and qualifications on one time axis, from the résumé data. Roles are
 * drawn from their first to their last month; a qualification only has the
 * year it was completed, so it marks that whole year rather than a guessed
 * span. Choosing a bar outlines the matching entry further down the page.
 */
export function CareerRail() {
  const reduced = useReducedMotion();
  const now = new Date();

  const { items, years, nowAt, span } = useMemo(() => {
    const starts = [
      ...experience.map((job) => Number(job.period.split(/\s[—–-]\s/)[0].trim().split(/\s+/)[1])),
      ...education.map((item) => Number(item.year)),
    ];
    const first = Math.min(...starts);
    const last = Math.max(now.getFullYear(), ...education.map((item) => Number(item.year)));
    const total = (last - first + 1) * 12;
    const nowMonths = (now.getFullYear() - first) * 12 + now.getMonth() + now.getDate() / 31;

    const work: RailItem[] = experience.map((job) => {
      const [start, end] = job.period.split(/\s[—–-]\s/);
      const from = monthIndex(start, first);
      const to = job.current || /present/i.test(end ?? "") ? nowMonths : monthIndex(end, first) + 1;
      return {
        key: job.id,
        lane: "work",
        from,
        to: Math.max(to, from + 0.6),
        short: job.company,
        title: job.role,
        place: `${job.company} · ${job.location}`,
        when: job.period.replace(/\s[—–-]\s/, " – "),
        target: job.id,
        current: job.current,
      };
    });
    const study: RailItem[] = education.map((item) => {
      const from = (Number(item.year) - first) * 12;
      return {
        key: `edu-${item.id}`,
        lane: "study",
        from,
        to: from + 12,
        short: item.degree,
        title: item.degree,
        place: item.institution,
        when: item.year,
        note: item.detail,
        target: `edu-${item.id}`,
      };
    });
    return {
      items: [...work, ...study],
      years: Array.from({ length: last - first + 1 }, (_, index) => first + index),
      nowAt: Math.min(1, nowMonths / total),
      span: total,
    };
    // `now` is read once per mount; the axis does not need to tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [active, setActive] = useState(() => items.find((item) => item.current)?.key ?? items[0].key);
  const shown = items.find((item) => item.key === active) ?? items[0];

  const lane = (name: RailItem["lane"], label: string) => (
    <div className="ct-rail-lane" data-lane={name}>
      <span className="ct-rail-lane-label mono">{label}</span>
      <div className="ct-rail-track">
        {items
          .filter((item) => item.lane === name)
          .map((item, index) => {
            const style = {
              left: `${(item.from / span) * 100}%`,
              width: `${((item.to - item.from) / span) * 100}%`,
            } as CSSProperties;
            return (
              <motion.button
                key={item.key}
                type="button"
                className={`ct-rail-bar${item.current ? " is-current" : ""}`}
                style={style}
                aria-pressed={item.key === active}
                aria-label={`${item.title}, ${item.place}, ${item.when}. Show it below.`}
                onMouseEnter={() => setActive(item.key)}
                onFocus={() => setActive(item.key)}
                onClick={() => {
                  setActive(item.key);
                  spotlight(item.target, "From the timeline");
                }}
                initial={reduced ? false : { scaleX: 0, opacity: 0 }}
                whileInView={{ scaleX: 1, opacity: 1 }}
                viewport={{ once: true, amount: 0.8 }}
                transition={{ duration: 0.9, delay: 0.15 + index * 0.12, ease: EASE }}
              >
                <span>{item.short}</span>
              </motion.button>
            );
          })}
      </div>
    </div>
  );

  return (
    <section className="ct-rail section-wrap" aria-labelledby="ct-rail-label">
      <div className="ordo-section-label">
        <span id="ct-rail-label">[ ABOUT / TIMELINE ]</span>
        <span>
          {years[0]} — NOW
        </span>
      </div>
      <div className="ct-rail-chart">
        <div className="ct-rail-years" aria-hidden="true">
          {years.map((year, index) => (
            <span key={year} style={{ left: `${(index / years.length) * 100}%`, width: `${100 / years.length}%` }}>
              {year}
            </span>
          ))}
        </div>
        <div className="ct-rail-lanes" role="group" aria-label="Roles and qualifications over time">
          {lane("work", "Work")}
          {lane("study", "Study")}
          <span className="ct-rail-now" style={{ left: `${nowAt * 100}%` }} aria-hidden="true">
            <span className="mono">Now</span>
          </span>
        </div>
      </div>
      <div className="ct-rail-readout" aria-live="polite">
        <span className="mono ct-rail-when">{shown.when}</span>
        <strong>{shown.title}</strong>
        <span className="ct-rail-place">
          {shown.place}
          {shown.note ? ` · ${shown.note}` : ""}
        </span>
        <span className="mono ct-rail-hint" aria-hidden="true">
          Choose a bar to find it below ↓
        </span>
      </div>
    </section>
  );
}

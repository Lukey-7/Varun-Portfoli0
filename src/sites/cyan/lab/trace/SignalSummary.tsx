import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { motion } from "framer-motion";
import { pointerLight } from "../kit";
import { pad2, readSummary } from "./data";
import { useCountUp, useStill } from "./hooks";

/*
 * The hero's instrument: what the log holds, counted from the data. The
 * figures count up once like a meter settling. Below them a histogram of
 * dated entries per quarter can be read with the pointer or the arrow keys;
 * its readout is amber, because it is a measurement.
 */

const entriesLabel = (count: number) => `${count} ${count === 1 ? "entry" : "entries"}`;

export function SignalSummary({ now }: { now: Date }) {
  const id = useId();
  const still = useStill();
  const summary = useMemo(() => readSummary(now), [now]);
  const { quarters, current } = summary;
  const [probe, setProbe] = useState<number | null>(null);
  const peak = Math.max(1, ...quarters.map((quarter) => quarter.count));

  const entries = useCountUp(summary.entries, 1100);
  const roles = useCountUp(summary.roles, 900, 120);
  const months = useCountUp(summary.monthsAtWork, 1200, 220);

  const probed = probe === null ? null : quarters[probe];
  const histogramLabel =
    `Dated entries per quarter, ${quarters[0]?.label ?? ""} to ${quarters[quarters.length - 1]?.label ?? ""}: ` +
    quarters.map((quarter) => `${quarter.label} ${quarter.count}`).join(", ") +
    ". Use the left and right arrow keys to read each quarter.";

  const indexAt = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientX - box.left) / Math.max(1, box.width);
    return Math.max(0, Math.min(quarters.length - 1, Math.floor(fraction * quarters.length)));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const last = quarters.length - 1;
    const at = probe ?? last;
    const next =
      event.key === "ArrowLeft"
        ? at - 1
        : event.key === "ArrowRight"
          ? at + 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    setProbe(Math.max(0, Math.min(last, next)));
  };

  return (
    <div className="logs-summary lab-panel" {...pointerLight}>
      <span className="logs-corner tl" aria-hidden="true" />
      <span className="logs-corner br" aria-hidden="true" />
      <div className="logs-summary-head mono">
        <span>Signal summary</span>
        <span className="logs-live">Live</span>
      </div>

      <dl className="logs-summary-grid">
        <div>
          <dt className="mono">Entries</dt>
          <dd className="lab-readout">
            <span aria-hidden="true">{pad2(entries)}</span>
            <span className="sr-only">{summary.entries}</span>
          </dd>
        </div>
        <div>
          <dt className="mono">Roles</dt>
          <dd className="lab-readout">
            <span aria-hidden="true">{pad2(roles)}</span>
            <span className="sr-only">{summary.roles}</span>
          </dd>
        </div>
        <div>
          <dt className="mono">Months at work</dt>
          <dd className="lab-readout">
            <span aria-hidden="true">{pad2(months)}</span>
            <span className="sr-only">{summary.monthsAtWork}</span>
          </dd>
        </div>
        <div>
          <dt className="mono">Span</dt>
          <dd className="lab-readout">
            {summary.firstYear}
            <span className="logs-arrow" aria-hidden="true">
              {" "}
              →{" "}
            </span>
            <span className="sr-only"> to </span>
            {summary.lastYear}
          </dd>
        </div>
      </dl>

      <div className="logs-hist-head mono">
        <span>Entries / quarter</span>
        <output className="lab-readout" aria-live="polite">
          {probed ? `${probed.label} · ${entriesLabel(probed.count)}` : ""}
        </output>
      </div>
      <div
        id={`${id}-hist`}
        className="logs-hist"
        role="group"
        tabIndex={0}
        aria-label={histogramLabel}
        data-probe={probe === null ? undefined : ""}
        onPointerMove={(event) => setProbe(indexAt(event))}
        onPointerDown={(event) => setProbe(indexAt(event))}
        onPointerLeave={(event) => {
          if (event.pointerType !== "touch" && document.activeElement !== event.currentTarget) setProbe(null);
        }}
        onFocus={() => setProbe((value) => value ?? quarters.length - 1)}
        onBlur={() => setProbe(null)}
        onKeyDown={onKeyDown}
      >
        {quarters.map((quarter, index) => (
          <span
            key={quarter.label}
            className="logs-hist-col"
            data-active={probe === index ? "" : undefined}
            data-year-start={quarter.label.startsWith("Q1") ? "" : undefined}
          >
            <motion.span
              className="logs-hist-bar"
              style={{ height: `${Math.max(4, (quarter.count / peak) * 100)}%` }}
              data-empty={quarter.count === 0 ? "" : undefined}
              initial={still ? false : { scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.7, delay: 0.35 + index * 0.04, ease: [0.16, 1, 0.3, 1] }}
            />
          </span>
        ))}
      </div>
      <div className="logs-hist-axis mono" aria-hidden="true">
        <span>{quarters[0]?.label}</span>
        <span>{quarters[quarters.length - 1]?.label}</span>
      </div>

      {current && (
        <p className="logs-summary-now mono">
          <span className="logs-dot" aria-hidden="true" />
          <span>
            Now: {current.role}, {current.company}
          </span>
          <span className="lab-readout">Month {pad2(current.months)}</span>
        </p>
      )}
    </div>
  );
}

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useSpring, type Variants } from "framer-motion";
import { content } from "../content";
import { formatJourneyDate } from "../journey";
import { researchLog, researchLogKinds, type ResearchLogEntry } from "../researchLog";
import { EntryTitle } from "./EntryTitle";

const EASE = [0.16, 1, 0.3, 1] as const;

const entryVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  shown: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: Math.min(index, 5) * 0.06, ease: EASE },
  }),
};
const nodeVariants: Variants = {
  hidden: { scale: 0 },
  shown: (index: number) => ({
    scale: 1,
    transition: { type: "spring", stiffness: 420, damping: 18, delay: 0.15 + Math.min(index, 5) * 0.06 },
  }),
};

/**
 * The dated research log, newest first, between the hero and the studies on
 * /research. An entry's text and link are optional; a slot it leaves empty
 * renders nothing, and so does a log with no entries. The rail inks itself in
 * as the log scrolls past.
 */
export function ResearchLog({ entries = researchLog }: { entries?: ResearchLogEntry[] }) {
  return entries.length === 0 ? null : <ResearchLogList entries={entries} />;
}

function ResearchLogList({ entries }: { entries: ResearchLogEntry[] }) {
  const listRef = useRef<HTMLOListElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: listRef, offset: ["start 80%", "end 55%"] });
  const ink = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });
  const { label, title, intro } = content.researchLog;

  return (
    <section id="research-log" className="research-log section-wrap" aria-labelledby="research-log-label">
      <div className="ordo-section-label">
        <span id="research-log-label">{label[0]}</span>
        <span>{label[1]}</span>
      </div>
      <motion.div
        className="research-log-head"
        initial={reduced ? false : { opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <h2>
          {title[0]}
          <br />
          <span>{title[1]}</span>
        </h2>
        <p>{intro}</p>
      </motion.div>
      <ol className="research-log-list" ref={listRef}>
        <motion.i className="ct-log-ink" aria-hidden="true" style={reduced ? undefined : { scaleY: ink }} />
        {entries.map((entry, index) => (
          <motion.li
            key={`${entry.date}-${entry.title}`}
            className={`research-log-entry is-${entry.kind}`}
            custom={index}
            variants={entryVariants}
            initial={reduced ? false : "hidden"}
            whileInView="shown"
            viewport={{ once: true, amount: 0.4 }}
          >
            <time className="research-log-date mono" dateTime={entry.date}>
              {formatJourneyDate(entry.date)}
            </time>
            <motion.span
              className="research-log-node"
              aria-hidden="true"
              custom={index}
              variants={reduced ? undefined : nodeVariants}
            />
            <div className="research-log-copy">
              <span className="research-log-kind mono">{researchLogKinds[entry.kind]}</span>
              <h3>
                <EntryTitle entry={entry} />
              </h3>
              {entry.text && <p>{entry.text}</p>}
            </div>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}

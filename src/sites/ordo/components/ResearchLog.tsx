import { content } from "../content";
import { formatJourneyDate } from "../journey";
import { researchLog, researchLogKinds, type ResearchLogEntry } from "../researchLog";
import { EntryTitle } from "./EntryTitle";

/**
 * The dated research log, newest first, between the hero and the studies on
 * /research. An entry's text and link are optional; a slot it leaves empty
 * renders nothing, and so does a log with no entries.
 */
export function ResearchLog({ entries = researchLog }: { entries?: ResearchLogEntry[] }) {
  if (entries.length === 0) return null;
  const { label, title, intro } = content.researchLog;

  return (
    <section id="research-log" className="research-log section-wrap" aria-labelledby="research-log-label">
      <div className="ordo-section-label">
        <span id="research-log-label">{label[0]}</span>
        <span>{label[1]}</span>
      </div>
      <div className="research-log-head">
        <h2>
          {title[0]}
          <br />
          <span>{title[1]}</span>
        </h2>
        <p>{intro}</p>
      </div>
      <ol className="research-log-list">
        {entries.map((entry) => (
          <li key={`${entry.date}-${entry.title}`} className={`research-log-entry is-${entry.kind}`}>
            <time className="research-log-date mono" dateTime={entry.date}>
              {formatJourneyDate(entry.date)}
            </time>
            <span className="research-log-node" aria-hidden="true" />
            <div className="research-log-copy">
              <span className="research-log-kind mono">{researchLogKinds[entry.kind]}</span>
              <h3>
                <EntryTitle entry={entry} />
              </h3>
              {entry.text && <p>{entry.text}</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { content } from "../content";
import { formatJourneyDate, journey, journeyKinds, type JourneyEntry, type JourneyKind } from "../journey";
import "./journey.css";

const kindLabel = (kind: JourneyKind) => journeyKinds.find((item) => item.id === kind)?.label ?? kind;

function EntryTitle({ entry }: { entry: JourneyEntry }) {
  if (entry.to) return <Link to={entry.to}>{entry.title}</Link>;
  if (entry.href)
    return (
      <a href={entry.href} target="_blank" rel="noreferrer">
        {entry.title} <ArrowUpRight size={14} aria-hidden="true" />
      </a>
    );
  return <>{entry.title}</>;
}

/** The dated log: newest first, grouped by year, filterable by kind. */
export default function JourneyPage() {
  const { journeyPage, heroTerminal } = content;
  const [kind, setKind] = useState<JourneyKind | "all">("all");
  const reduced = useReducedMotion();
  useEffect(() => {
    document.title = "Journey | Varun Darji";
  }, []);

  const entries = kind === "all" ? journey : journey.filter((entry) => entry.kind === kind);
  const years = useMemo(() => {
    const groups = new Map<string, JourneyEntry[]>();
    for (const entry of entries) {
      const year = entry.date.slice(0, 4);
      groups.set(year, [...(groups.get(year) ?? []), entry]);
    }
    return [...groups];
  }, [entries]);

  return (
    <article className="journey-page">
      <header className="page-hero section-wrap">
        <div className="ordo-section-label">
          <span>{journeyPage.label[0]}</span>
          <span>UPDATED {content.updated.toUpperCase()}</span>
        </div>
        <div className="journey-head">
          <div>
            <span className="mono project-category">{journeyPage.category}</span>
            <h1>
              {journeyPage.title[0]}
              <br />
              <span>{journeyPage.title[1]}</span>
            </h1>
            <p className="project-lede">{journeyPage.intro}</p>
          </div>
          <aside className="journey-now" aria-label="What I am doing now">
            <span className="mono">{journeyPage.now}</span>
            <dl>
              {heroTerminal.rows.map(([key, value]) => (
                <div key={key}>
                  <dt className="mono">{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </header>

      <section className="section-wrap journey-body" aria-label="Journey log">
        <div className="journey-filters" role="group" aria-label="Show entries of one kind">
          {[{ id: "all" as const, label: "All" }, ...journeyKinds].map((item) => {
            const count =
              item.id === "all" ? journey.length : journey.filter((entry) => entry.kind === item.id).length;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={kind === item.id}
                onClick={() => setKind(item.id)}
              >
                {item.label} <span className="mono">{count}</span>
              </button>
            );
          })}
        </div>
        <p className="journey-count mono" aria-live="polite">
          {entries.length} {entries.length === 1 ? "entry" : "entries"}
          {kind === "all" ? "" : ` in ${kindLabel(kind).toLowerCase()}`}
        </p>

        {years.map(([year, items]) => (
          <section className="journey-year" key={`${kind}-${year}`} aria-labelledby={`journey-${year}`}>
            <h2 id={`journey-${year}`} className="journey-year-label">
              {year}
            </h2>
            <ol>
              {items.map((entry, index) => (
                <motion.li
                  key={`${entry.date}-${entry.title}`}
                  className={`journey-entry is-${entry.kind}`}
                  initial={reduced ? false : { opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.45, delay: Math.min(index, 4) * 0.05 }}
                >
                  <span className="journey-date mono">{formatJourneyDate(entry.date)}</span>
                  <span className="journey-node" aria-hidden="true" />
                  <div className="journey-copy">
                    <span className="journey-kind mono">{kindLabel(entry.kind)}</span>
                    <h3>
                      <EntryTitle entry={entry} />
                    </h3>
                    {entry.text && <p>{entry.text}</p>}
                  </div>
                </motion.li>
              ))}
            </ol>
          </section>
        ))}
      </section>
    </article>
  );
}

/** The home page's latest three entries, linking to the full log. */
export function JourneyTeaser() {
  const { journeyTeaser } = content;
  return (
    <section id="journey" className="journey-teaser section-wrap">
      <div className="ordo-section-label">
        <span>{journeyTeaser.label[0]}</span>
        <span>{journeyTeaser.label[1]}</span>
      </div>
      <div className="journey-teaser-grid">
        <h2>
          {journeyTeaser.title[0]}
          <br />
          <span>{journeyTeaser.title[1]}</span>
        </h2>
        <div>
          <ol className="journey-teaser-list">
            {journey.slice(0, 3).map((entry) => (
              <li key={`${entry.date}-${entry.title}`}>
                <span className="journey-date mono">{formatJourneyDate(entry.date)}</span>
                <span className="journey-kind mono">{kindLabel(entry.kind)}</span>
                <h3>
                  <EntryTitle entry={entry} />
                </h3>
              </li>
            ))}
          </ol>
          <Link to="/journey" className="section-link">
            {journeyTeaser.link} <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

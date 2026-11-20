import { forwardRef, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  type Variants,
} from "framer-motion";
import { EntryTitle } from "../components/EntryTitle";
import { content } from "../content";
import { MaskTitle } from "../content/MaskTitle";
import { useHeaderHeight, useScrollSpy } from "../content/hooks";
import { formatJourneyDate, journey, journeyKinds, type JourneyEntry, type JourneyKind } from "../journey";
import "./journey.css";
import "../content/content.css";

const kindLabel = (kind: JourneyKind) => journeyKinds.find((item) => item.id === kind)?.label ?? kind;
const EASE = [0.16, 1, 0.3, 1] as const;
const yearAnchor = (year: string) => `journey-year-${year}`;

const entryVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  shown: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, delay: Math.min(index, 4) * 0.05, ease: EASE },
  }),
};
// The node pops in just after its entry, as if the rail had reached it.
const nodeVariants: Variants = {
  hidden: { scale: 0 },
  shown: (index: number) => ({
    scale: 1,
    transition: { type: "spring", stiffness: 420, damping: 18, delay: 0.15 + Math.min(index, 4) * 0.05 },
  }),
};

/** One year: its sticky label and its entries, with a rail that inks itself in as you scroll. */
const JourneyYear = forwardRef<
  HTMLElement,
  { year: string; items: JourneyEntry[]; reduced: boolean }
>(function JourneyYear({ year, items, reduced }, ref) {
  const listRef = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: listRef, offset: ["start 80%", "end 55%"] });
  const ink = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });

  return (
    <motion.section
      ref={ref}
      layout={reduced ? false : "position"}
      id={yearAnchor(year)}
      className="journey-year"
      aria-labelledby={`journey-${year}`}
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduced ? undefined : { opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <h2 id={`journey-${year}`} className="journey-year-label">
        {year}
        <span className="journey-year-count mono" aria-hidden="true">
          {String(items.length).padStart(2, "0")} {items.length === 1 ? "entry" : "entries"}
        </span>
      </h2>
      <ol ref={listRef}>
        <motion.i className="journey-rail-ink" aria-hidden="true" style={reduced ? undefined : { scaleY: ink }} />
        <AnimatePresence initial={false} mode="popLayout">
          {items.map((entry, index) => (
            <motion.li
              key={`${entry.date}-${entry.title}`}
              layout={reduced ? false : "position"}
              custom={index}
              variants={entryVariants}
              className={`journey-entry is-${entry.kind}`}
              initial={reduced ? false : "hidden"}
              whileInView="shown"
              viewport={{ once: true, amount: 0.4 }}
              exit={reduced ? undefined : { opacity: 0, x: -10, transition: { duration: 0.18 } }}
              transition={{ layout: { duration: 0.45, ease: EASE } }}
            >
              <span className="journey-date mono">{formatJourneyDate(entry.date)}</span>
              <motion.span
                className="journey-node"
                aria-hidden="true"
                custom={index}
                variants={reduced ? undefined : nodeVariants}
              />
              <div className="journey-copy">
                <span className="journey-kind mono">{kindLabel(entry.kind)}</span>
                <h3>
                  <EntryTitle entry={entry} />
                </h3>
                {entry.text && <p>{entry.text}</p>}
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </motion.section>
  );
});

/** The dated log: newest first, grouped by year, filterable by kind. */
export default function JourneyPage() {
  const { journeyPage, heroTerminal } = content;
  const [kind, setKind] = useState<JourneyKind | "all">("all");
  const reduced = Boolean(useReducedMotion());
  const header = useHeaderHeight();
  useEffect(() => {
    document.title = "Journey | Varun Darji";
  }, []);

  const entries = useMemo(
    () => (kind === "all" ? journey : journey.filter((entry) => entry.kind === kind)),
    [kind],
  );
  const years = useMemo(() => {
    const groups = new Map<string, JourneyEntry[]>();
    for (const entry of entries) {
      const year = entry.date.slice(0, 4);
      groups.set(year, [...(groups.get(year) ?? []), entry]);
    }
    return [...groups];
  }, [entries]);
  const activeYear = useScrollSpy(
    years.map(([year]) => yearAnchor(year)),
    header + 90,
  );

  // A filter chosen deep in the log brings the shorter list back under the toolbar.
  const bodyRef = useRef<HTMLElement>(null);
  const choose = (next: JourneyKind | "all") => {
    setKind(next);
    const body = bodyRef.current;
    if (!body) return;
    const top = body.getBoundingClientRect().top + window.scrollY - header;
    if (window.scrollY > top) window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
  };

  const jumpTo = (year: string) => {
    const section = document.getElementById(yearAnchor(year));
    if (!section) return;
    const top = section.getBoundingClientRect().top + window.scrollY - header - 70;
    window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <article className="journey-page" style={{ "--ct-header": `${header}px` } as CSSProperties}>
      <header className="page-hero section-wrap">
        <div className="ordo-section-label">
          <span>{journeyPage.label[0]}</span>
          <span>UPDATED {content.updated.toUpperCase()}</span>
        </div>
        <div className="journey-head">
          <div>
            <span className="mono project-category">{journeyPage.category}</span>
            <MaskTitle lines={journeyPage.title} />
            <p className="project-lede">{journeyPage.intro}</p>
          </div>
          <aside className="journey-now" aria-label="What I am doing now">
            <span className="mono">{journeyPage.now}</span>
            <dl>
              {/* The rows print in one after another, like a status readout. */}
              {heroTerminal.rows.map(([key, value], index) => (
                <motion.div
                  key={key}
                  initial={reduced ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.45, delay: 0.5 + index * 0.1, ease: EASE }}
                >
                  <dt className="mono">{key}</dt>
                  <dd>{value}</dd>
                </motion.div>
              ))}
            </dl>
          </aside>
        </div>
      </header>

      <section ref={bodyRef} className="section-wrap journey-body" aria-label="Journey log">
        <div className="journey-toolbar">
          <LayoutGroup id="journey-filters">
            <div className="journey-filters" role="group" aria-label="Show entries of one kind">
              {[{ id: "all" as const, label: "All" }, ...journeyKinds].map((item) => {
                const count =
                  item.id === "all" ? journey.length : journey.filter((entry) => entry.kind === item.id).length;
                const pressed = kind === item.id;
                return (
                  <button key={item.id} type="button" aria-pressed={pressed} onClick={() => choose(item.id)}>
                    {pressed && (
                      <motion.span
                        className="journey-filter-pill"
                        layoutId="journey-filter-pill"
                        aria-hidden="true"
                        transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 480, damping: 38 }}
                      />
                    )}
                    <span className="journey-filter-text">
                      {item.label} <span className="mono">{count}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </LayoutGroup>
          <nav className="journey-years" aria-label="Jump to a year">
            {years.map(([year]) => (
              <button
                key={year}
                type="button"
                className="mono"
                aria-current={activeYear === yearAnchor(year) ? "true" : undefined}
                onClick={() => jumpTo(year)}
              >
                {year}
              </button>
            ))}
          </nav>
        </div>
        <p className="journey-count mono" aria-live="polite">
          {entries.length} {entries.length === 1 ? "entry" : "entries"}
          {kind === "all" ? "" : ` in ${kindLabel(kind).toLowerCase()}`}
        </p>

        <div className="journey-years-list">
          <AnimatePresence initial={false} mode="popLayout">
            {years.map(([year, items]) => (
              <JourneyYear key={year} year={year} items={items} reduced={reduced} />
            ))}
          </AnimatePresence>
        </div>
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

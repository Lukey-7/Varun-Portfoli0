import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowUpRight } from "lucide-react";
import { githubSnapshot } from "@/data/github-activity";
import { content } from "../content";
import {
  activityStats,
  contributionLevel,
  fetchLiveActivity,
  type ContributionDay,
} from "@/lib/github-activity";

const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const monthFormat = new Intl.DateTimeFormat("en-GB", { month: "short" });
const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const parseDay = (date: string) => new Date(`${date}T00:00:00`);

function pushedAgo(iso: string) {
  const days = Math.round((Date.parse(iso) - Date.now()) / 86_400_000);
  if (days > -1) return "today";
  if (days > -30) return relative.format(days, "day");
  return relative.format(Math.round(days / 30), "month");
}

/** Weeks of seven days, Sunday first, with blanks before the first day. */
function toWeeks(calendar: ContributionDay[]) {
  const cells: (ContributionDay | null)[] = calendar.length
    ? Array(parseDay(calendar[0].date).getDay()).fill(null)
    : [];
  cells.push(...calendar);
  const weeks: (ContributionDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** A year of public GitHub contributions, drawn in the site's monochrome grid. */
export function OrdoActivity() {
  const [activity, setActivity] = useState(githubSnapshot);
  const [live, setLive] = useState(false);
  const [inView, setInView] = useState(false);
  const [hovered, setHovered] = useState<ContributionDay | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const weeks = useMemo(() => toWeeks(activity.calendar), [activity.calendar]);
  const stats = useMemo(() => activityStats(activity.calendar), [activity.calendar]);
  // A month label sits over the week holding its first day.
  const months = useMemo(() => {
    const labels: { index: number; label: string }[] = [];
    weeks.forEach((week, index) => {
      const opening = week.find((day) => day?.date.endsWith("-01"));
      if (!opening || (labels.length && index - labels.at(-1)!.index < 3)) return;
      labels.push({ index, label: monthFormat.format(parseDay(opening.date)) });
    });
    return labels;
  }, [weeks]);
  const latest = activity.repos[0];
  const first = activity.calendar[0]?.date;
  const last = activity.calendar.at(-1)?.date;

  useEffect(() => {
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        setInView(true);
        observer.disconnect();
      },
      { rootMargin: "0px 0px -20% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Ask GitHub for today's numbers once the section is on screen.
  useEffect(() => {
    if (!inView || typeof fetch === "undefined") return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    fetchLiveActivity(githubSnapshot, controller.signal)
      .then((next) => {
        setActivity(next);
        setLive(next.fetchedAt !== githubSnapshot.fetchedAt);
      })
      .catch(() => {})
      .finally(() => clearTimeout(timeout));
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [inView]);

  // On narrow screens the calendar scrolls sideways; start at the latest week.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollLeft = scroller.scrollWidth;
  }, [weeks.length]);

  const readout = hovered
    ? `${hovered.count === 0 ? "No" : hovered.count} contribution${hovered.count === 1 ? "" : "s"} · ${dayFormat.format(parseDay(hovered.date))}`
    : `${stats.total} contributions in the last twelve months`;

  return (
    <section
      id="activity"
      ref={sectionRef}
      className={`ordo-activity section-wrap${inView ? " is-visible" : ""}`}
    >
      <div className="ordo-section-label">
        <span>{content.activity.label[0]}</span>
        <span>GITHUB / @{activity.login.toUpperCase()}</span>
      </div>
      <div className="activity-heading">
        <h2>
          {content.activity.title[0]}
          <br />
          <span>{content.activity.title[1]}</span>
        </h2>
        <p>{content.activity.intro}</p>
      </div>

      <dl className="activity-stats">
        <div>
          <dt>Contributions, last 12 months</dt>
          <dd>{stats.total}</dd>
        </div>
        <div>
          <dt>Days with a contribution</dt>
          <dd>{stats.activeDays}</dd>
        </div>
        {latest && (
          <div>
            <dt>Latest push</dt>
            <dd className="is-text">
              {pushedAgo(latest.pushedAt)} <small>{latest.name}</small>
            </dd>
          </div>
        )}
        <div>
          <dt>Public repositories</dt>
          <dd>{activity.publicRepos}</dd>
        </div>
      </dl>

      <div className="activity-calendar-frame">
        <div className="activity-calendar-head mono">
          <span aria-hidden="true">{readout}</span>
          <span>
            {live ? (
              <>
                <i className="live-dot" aria-hidden="true" /> Live from GitHub
              </>
            ) : (
              `Updated ${dayFormat.format(new Date(activity.fetchedAt))}`
            )}
          </span>
        </div>
        <div className="activity-scroller" ref={scrollerRef}>
          <div
            className="activity-calendar"
            role="img"
            aria-label={`${stats.total} contributions on ${stats.activeDays} days between ${first ? dayFormat.format(parseDay(first)) : ""} and ${last ? dayFormat.format(parseDay(last)) : ""}.`}
            style={{ "--weeks": weeks.length } as CSSProperties}
            onPointerLeave={() => setHovered(null)}
          >
            {months.map((month) => (
              <span
                key={`${month.label}-${month.index}`}
                className="activity-month mono"
                style={{ gridColumn: month.index + 1 }}
              >
                {month.label}
              </span>
            ))}
            {weeks.map((week, w) =>
              Array.from({ length: 7 }, (_, d) => {
                const day = week[d];
                return (
                  <i
                    key={`${w}-${d}`}
                    className={day ? `cell level-${contributionLevel(day.count)}` : "cell is-blank"}
                    style={{ gridColumn: w + 1, gridRow: d + 2, "--w": w } as CSSProperties}
                    onPointerEnter={day ? () => setHovered(day) : undefined}
                  />
                );
              }),
            )}
          </div>
        </div>
        <div className="activity-legend mono" aria-hidden="true">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <i key={level} className={`cell level-${level}`} />
          ))}
          <span>More</span>
        </div>
      </div>

      <div className="activity-bottom">
        <div className="activity-languages">
          <h3>Code by language</h3>
          <div className="language-bar" aria-hidden="true">
            {activity.languages.map((language, index) => (
              <span
                key={language.name}
                style={{ width: `${language.share}%`, "--shade": index } as CSSProperties}
              />
            ))}
          </div>
          <ul>
            {activity.languages.map((language, index) => (
              <li key={language.name}>
                <i style={{ "--shade": index } as CSSProperties} aria-hidden="true" />
                {language.name}
                <span className="mono">{language.share}%</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="activity-recent">
          <h3>Recently pushed</h3>
          <ul>
            {activity.repos.slice(0, 5).map((repo) => (
              <li key={repo.name}>
                <a href={repo.url} target="_blank" rel="noreferrer">
                  {repo.name}
                  <ArrowUpRight size={14} aria-hidden="true" />
                </a>
                <span className="mono">{repo.language ?? "—"}</span>
                <span className="mono">{pushedAgo(repo.pushedAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <a className="section-link" href={activity.url} target="_blank" rel="noreferrer">
        See the full profile on GitHub <ArrowUpRight size={14} aria-hidden="true" />
      </a>
    </section>
  );
}

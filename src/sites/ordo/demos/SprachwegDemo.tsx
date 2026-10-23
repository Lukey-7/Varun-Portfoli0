import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useReducedMotion } from "framer-motion";
import { useMotionPaused } from "@/lib/motion-pause";
import DemoFrame from "./DemoFrame";
import {
  GRADES,
  GRADE_LABELS,
  dueQueue,
  formatInterval,
  previewReview,
  retrievability,
  type Grade,
  type MemoryState,
} from "./fsrs";
import "./sprachweg.css";

interface Word {
  id: string;
  article: "der" | "die" | "das";
  noun: string;
  meaning: string;
  example: string;
  translation: string;
  level: "A1" | "A2";
}

interface Progress {
  state: MemoryState;
  lastReview: number;
  due: number;
  /** Every interval this card has been given, oldest first. */
  intervals: number[];
  lastGrade: Grade;
}

/** A sample deck written for this demo. */
const DECK: Word[] = [
  {
    id: "bahnhof",
    article: "der",
    noun: "Bahnhof",
    meaning: "the railway station",
    example: "Der Bahnhof ist nur zehn Minuten entfernt.",
    translation: "The station is only ten minutes away.",
    level: "A1",
  },
  {
    id: "wohnung",
    article: "die",
    noun: "Wohnung",
    meaning: "the flat",
    example: "Unsere Wohnung hat drei Zimmer und einen Balkon.",
    translation: "Our flat has three rooms and a balcony.",
    level: "A1",
  },
  {
    id: "fahrrad",
    article: "das",
    noun: "Fahrrad",
    meaning: "the bicycle",
    example: "Ich fahre jeden Tag mit dem Fahrrad zur Arbeit.",
    translation: "I cycle to work every day.",
    level: "A1",
  },
  {
    id: "termin",
    article: "der",
    noun: "Termin",
    meaning: "the appointment",
    example: "Mein Termin beim Zahnarzt ist um neun Uhr.",
    translation: "My appointment at the dentist's is at nine.",
    level: "A1",
  },
  {
    id: "fahrkarte",
    article: "die",
    noun: "Fahrkarte",
    meaning: "the ticket",
    example: "Die Fahrkarte kannst du am Automaten kaufen.",
    translation: "You can buy the ticket from the machine.",
    level: "A1",
  },
  {
    id: "gewitter",
    article: "das",
    noun: "Gewitter",
    meaning: "the thunderstorm",
    example: "Gestern Abend gab es ein starkes Gewitter.",
    translation: "There was a heavy thunderstorm yesterday evening.",
    level: "A2",
  },
  {
    id: "ausflug",
    article: "der",
    noun: "Ausflug",
    meaning: "the day trip",
    example: "Am Samstag machen wir einen Ausflug an den See.",
    translation: "On Saturday we are taking a trip to the lake.",
    level: "A2",
  },
  {
    id: "erkaeltung",
    article: "die",
    noun: "Erkältung",
    meaning: "a cold (the illness)",
    example: "Ich habe eine Erkältung und bleibe heute zu Hause.",
    translation: "I have a cold, so I am staying at home today.",
    level: "A2",
  },
];

// The app's session order: FSRS review, a grammar lesson with drills, sentence
// mining, speaking feedback, graded reading.
const STEPS = ["FSRS review", "Grammar lesson", "Sentence mining", "Speaking feedback", "Graded reading"];

const pad = (n: number) => String(n).padStart(2, "0");
const percent = (recall: number) => `${Math.round(recall * 100)}%`;
const german = (word: Word) => `${word.article} ${word.noun}`;

/** Recall over time since the last review, with the 90% target and the due day marked. */
function ForgettingCurve({ progress, today }: { progress: Progress; today: number }) {
  const { stability } = progress.state;
  const dueAfter = progress.due - progress.lastReview;
  const nowAfter = today - progress.lastReview;
  const span = Math.max(dueAfter * 2, nowAfter * 1.15, 4);
  const [left, right, top, bottom, floor] = [34, 294, 7, 46, 0.6];
  const x = (days: number) => left + (Math.min(days, span) / span) * (right - left);
  const y = (recall: number) => top + ((1 - Math.max(recall, floor)) / (1 - floor)) * (bottom - top);
  const points = Array.from({ length: 61 }, (_, i) => {
    const days = (i / 60) * span;
    return `${x(days).toFixed(1)},${y(retrievability(days, stability)).toFixed(1)}`;
  }).join(" ");
  return (
    <svg className="sw-curve" viewBox="0 0 300 60" aria-hidden="true" focusable="false">
      <line className="sw-curve-axis" x1={left} x2={right} y1={bottom} y2={bottom} />
      <line className="sw-curve-target" x1={left} x2={right} y1={y(0.9)} y2={y(0.9)} />
      <text x={left - 5} y={y(1) + 3} textAnchor="end">
        100%
      </text>
      <text x={left - 5} y={y(0.9) + 3} textAnchor="end">
        90%
      </text>
      <line className="sw-curve-due" x1={x(dueAfter)} x2={x(dueAfter)} y1={top - 2} y2={bottom} />
      <polyline className="sw-curve-line" points={points} />
      <circle className="sw-curve-now" cx={x(nowAfter)} cy={y(retrievability(nowAfter, stability))} r={2.6} />
      {x(dueAfter) - left > 50 && (
        <text x={left} y={57} textAnchor="start">
          day {progress.lastReview}
        </text>
      )}
      <text x={x(dueAfter)} y={57} textAnchor="middle">
        day {progress.due}
      </text>
    </svg>
  );
}

/** Sprachweg: the FSRS review step, with simulated days so intervals can grow. */
export default function SprachwegDemo() {
  const reduced = useReducedMotion();
  const paused = useMotionPaused();
  const still = Boolean(reduced) || paused;
  const ids = useId();

  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [today, setToday] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [lastId, setLastId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const cardRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  const queue = dueQueue(DECK, progress, today, focusId);
  const current = queue[0] ?? null;
  const currentProgress = current ? progress[current.id] : undefined;
  const elapsed = currentProgress ? today - currentProgress.lastReview : 0;
  const options = current ? previewReview(currentProgress?.state ?? null, elapsed) : null;

  const scheduled = DECK.filter((word) => progress[word.id]).sort(
    (a, b) => progress[a.id].due - progress[b.id].due,
  );
  const groups: { day: number; words: Word[] }[] = [];
  for (const word of scheduled) {
    const day = progress[word.id].due;
    const group = groups[groups.length - 1];
    if (group && group.day === day) group.words.push(word);
    else groups.push({ day, words: [word] });
  }
  const nextUp = scheduled.find((word) => progress[word.id].due > today) ?? null;
  const last = DECK.find((word) => word.id === lastId) ?? null;
  const lastProgress = last ? progress[last.id] : undefined;

  // After a rating the pressed button is disabled; give focus back to the card.
  useEffect(() => {
    if (!restoreFocus.current) return;
    restoreFocus.current = false;
    (cardRef.current ?? nextRef.current)?.focus({ preventScroll: true });
  });

  const flip = () => {
    if (!current) return;
    setFlipped(!flipped);
    setAnnouncement(flipped ? "" : `${german(current)}. ${current.example} ${current.translation}`);
  };

  const rate = (grade: Grade) => {
    if (!current || !flipped || !options) return;
    const { state, interval } = options[grade];
    const due = today + interval;
    setProgress((all) => ({
      ...all,
      [current.id]: {
        state,
        lastReview: today,
        due,
        intervals: [...(all[current.id]?.intervals ?? []), interval],
        lastGrade: grade,
      },
    }));
    setLastId(current.id);
    setFlipped(false);
    setFocusId(null);
    setAnnouncement(`${GRADE_LABELS[grade]}: ${german(current)} comes back on day ${due}, in ${formatInterval(interval)}.`);
    restoreFocus.current = true;
  };

  // Move the simulated clock to the card's due day, so the time since its
  // last review is exactly the interval it was given.
  const reviewLater = (id: string) => {
    const card = progress[id];
    const word = DECK.find((item) => item.id === id);
    if (!card || !word) return;
    const day = Math.max(today, card.due);
    setToday(day);
    setFocusId(id);
    setFlipped(false);
    setAnnouncement(`Day ${day}. ${german(word)} is up for review, ${formatInterval(day - card.lastReview)} after it was last seen.`);
    restoreFocus.current = true;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || !/^[1-4]$/.test(event.key)) return;
    if (!flipped || !current) return;
    event.preventDefault();
    rate(Number(event.key) as Grade);
  };

  const reset = () => {
    setProgress({});
    setToday(0);
    setFlipped(false);
    setFocusId(null);
    setLastId(null);
    setAnnouncement("");
  };

  const meta = !current
    ? `Day ${today} · nothing due`
    : currentProgress
      ? `Day ${today} · review · last seen day ${currentProgress.lastReview}, ${formatInterval(elapsed)} ago · recall now ${percent(retrievability(elapsed, currentProgress.state.stability))}`
      : `Day ${today} · new card · ${queue.length} due`;

  return (
    <DemoFrame
      project="Sprachweg"
      title="Review German words the FSRS way"
      intro="Flip a card and rate it. Each button shows the interval FSRS would schedule."
      note="Scheduling uses the published FSRS-4.5 formulas with default parameters and a 90% recall target. Days are simulated so you can watch intervals grow, and same-day learning steps are left out; the app keeps real review history. The eight-word deck is a sample written for this demo."
      onReset={reset}
      className={`sw-demo${still ? " is-still" : ""}`}
    >
      <div onKeyDown={onKeyDown}>
        <ol className="sw-steps" aria-label="Sprachweg's daily session">
          {STEPS.map((step, i) => (
            <li key={step} aria-current={i === 0 ? "step" : undefined}>
              <span className="sw-step-num" aria-hidden="true">
                {pad(i + 1)}
              </span>
              {step}
            </li>
          ))}
        </ol>
        <p className="sw-steps-note">
          The app's daily session. Only the review step runs here; the other four are not part of this demo.
        </p>

        <div className="sw-layout">
          <div className="sw-main">
            <p className="sw-card-meta">{meta}</p>
            {current ? (
              <div key={still ? "card" : `${current.id}-${today}`} className={`sw-card-wrap${still ? "" : " is-arriving"}`}>
                <button
                  ref={cardRef}
                  type="button"
                  className={`sw-card${flipped ? " is-flipped" : ""}`}
                  aria-describedby={`${ids}-hint`}
                  onClick={flip}
                >
                  <span className="sw-face sw-front" aria-hidden={flipped}>
                    <span className="sw-face-top">
                      <span className="sw-level">{current.level}</span>
                      <span>{currentProgress ? "Review" : "New"}</span>
                    </span>
                    <span className="sw-prompt">What is the German for</span>
                    <span className="sw-meaning">{current.meaning}</span>
                  </span>
                  <span className="sw-face sw-back" aria-hidden={!flipped}>
                    <span className="sw-face-top">
                      <span className="sw-level">{current.level}</span>
                      <span>{current.meaning}</span>
                    </span>
                    <span className="sw-word" lang="de">
                      <span className="sw-article">{current.article}</span> {current.noun}
                    </span>
                    <span className="sw-example" lang="de">
                      {current.example}
                    </span>
                    <span className="sw-translation">{current.translation}</span>
                  </span>
                </button>
              </div>
            ) : (
              <div className="sw-done">
                <p>Nothing else is due on day {today}.</p>
                {nextUp && (
                  <button ref={nextRef} type="button" className="demo-btn" onClick={() => reviewLater(nextUp.id)}>
                    Skip to day {progress[nextUp.id].due}: {german(nextUp)}
                  </button>
                )}
              </div>
            )}
            {current && options && (
              <>
                <p className="sw-hint" id={`${ids}-hint`}>
                  Click the card, or press Space or Enter, to flip it. Then rate it with a button or keys 1 to 4.
                </p>
                <div className="sw-rates" role="group" aria-label="How well did you remember it?">
                  {GRADES.map((grade) => (
                    <button
                      key={grade}
                      type="button"
                      className="sw-rate"
                      disabled={!flipped}
                      aria-keyshortcuts={String(grade)}
                      onClick={() => rate(grade)}
                    >
                      <span className="sw-rate-name">{GRADE_LABELS[grade]}</span>
                      <span className="sw-rate-gap">{formatInterval(options[grade].interval)}</span>
                      <kbd aria-hidden="true">{grade}</kbd>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="sw-memory" role="group" aria-labelledby={`${ids}-memory`}>
            <span className="demo-label" id={`${ids}-memory`}>
              Memory state
            </span>
            <div className="sw-memory-box">
              {last && lastProgress ? (
                <>
                  <p className="sw-memory-title">
                    <span lang="de">{german(last)}</span>{" "}
                    <span className="sw-memory-sub">
                      rated {GRADE_LABELS[lastProgress.lastGrade]} on day {lastProgress.lastReview}
                    </span>
                  </p>
                  <dl className="sw-stats">
                    <div>
                      <dt>Stability</dt>
                      <dd>{lastProgress.state.stability.toFixed(1)} days</dd>
                    </div>
                    <div>
                      <dt>Difficulty</dt>
                      <dd>{lastProgress.state.difficulty.toFixed(1)} of 10</dd>
                    </div>
                    <div>
                      <dt>Retrievability</dt>
                      <dd>
                        {percent(retrievability(today - lastProgress.lastReview, lastProgress.state.stability))} now ·{" "}
                        {percent(retrievability(lastProgress.due - lastProgress.lastReview, lastProgress.state.stability))}{" "}
                        on day {lastProgress.due}
                      </dd>
                    </div>
                  </dl>
                  <ForgettingCurve progress={lastProgress} today={today} />
                  <p className="sw-memory-note">
                    Intervals so far: {lastProgress.intervals.join(" → ")} days. Rounding to whole days puts recall on
                    the due day near, not exactly at, 90%.
                  </p>
                  <button type="button" className="demo-btn is-ghost sw-later" onClick={() => reviewLater(last.id)}>
                    {lastProgress.due <= today ? "Review it now" : `Review again on day ${lastProgress.due}`}
                  </button>
                </>
              ) : (
                <dl className="sw-glossary">
                  <div>
                    <dt>Stability</dt>
                    <dd>Days until the chance of recall falls to 90%.</dd>
                  </div>
                  <div>
                    <dt>Difficulty</dt>
                    <dd>1 to 10. Harder cards grow their intervals more slowly.</dd>
                  </div>
                  <div>
                    <dt>Retrievability</dt>
                    <dd>The chance you would recall the card right now.</dd>
                  </div>
                </dl>
              )}
            </div>
          </div>

          <div className="sw-upcoming" role="group" aria-labelledby={`${ids}-upcoming`}>
            <span className="demo-label" id={`${ids}-upcoming`}>
              Upcoming reviews · today is day {today}
            </span>
            {groups.length === 0 ? (
              <p className="sw-empty">Each card you rate appears here on the day it is due.</p>
            ) : (
              <ol className="sw-timeline">
                {groups.map((group) => (
                  <li key={group.day} className={group.day <= today ? "is-due" : undefined}>
                    <span className="sw-tl-day">
                      Day {group.day} · {group.day <= today ? "due now" : `in ${formatInterval(group.day - today)}`}
                    </span>
                    <span className="sw-tl-words">
                      {group.words.map((word) => (
                        <button key={word.id} type="button" className="sw-tl-word" onClick={() => reviewLater(word.id)}>
                          <span lang="de">{german(word)}</span>
                          <span className="sw-tl-gaps">{progress[word.id].intervals.join(" → ")} d</span>
                          <span className="sw-sr">
                            {group.day <= today ? ": review it now" : `: skip to day ${group.day} and review it`}
                          </span>
                        </button>
                      ))}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
        <p className="sw-sr" aria-live="polite">
          {announcement}
        </p>
      </div>
    </DemoFrame>
  );
}

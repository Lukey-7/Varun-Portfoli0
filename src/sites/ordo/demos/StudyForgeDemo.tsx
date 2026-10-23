import { Fragment, useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useMotionPaused } from "@/lib/motion-pause";
import DemoFrame from "./DemoFrame";
import {
  createBm25Index,
  createTrigramIndex,
  hybridRank,
  isStopword,
  mmrSelect,
  splitSentences,
  stem,
  termCoverage,
  tokenize,
  words,
  type MmrPick,
  type Scored,
} from "./retrieval";
import "./studyforge.css";

export type Mode = "keyword" | "similarity" | "hybrid";

interface Note {
  id: string;
  title: string;
  text: string;
  /** Shown in bold; the flashcards blank these out. */
  keyTerms: string[];
}

/** Sample lecture notes on database indexing, written for this demo. */
const NOTES: Note[] = [
  {
    id: "S1",
    title: "Full table scans",
    text: "Without a usable index, the database answers a query with a full table scan: it reads every row and checks the condition on each one. The work grows in step with the size of the table, so a lookup that is instant on a thousand rows can take seconds on a hundred million. For small tables, or for queries that return most of the rows, a scan can still be the cheapest plan.",
    keyTerms: ["full table scan", "size of the table", "most of the rows"],
  },
  {
    id: "S2",
    title: "What an index is",
    text: "An index is a separate structure that lets the database find rows without reading the whole table, much like the index at the back of a textbook. It maps values from one or more columns to the locations of the rows that hold them. Most relational databases use a B+ tree as their default index structure.",
    keyTerms: ["separate structure", "locations", "B+ tree"],
  },
  {
    id: "S3",
    title: "B+ trees",
    text: "A B+ tree is a balanced search tree that keeps its keys in sorted order. Internal nodes hold only keys that guide the search, while the leaf nodes hold the indexed values with pointers to the rows, and each leaf links to the next. Because every node has hundreds of children, a tree over millions of keys is usually only three or four levels deep. The linked leaves make range queries efficient: the database finds the first matching key, then walks along the leaves in order.",
    keyTerms: ["balanced search tree", "leaf nodes", "three or four levels"],
  },
  {
    id: "S4",
    title: "Hash indexes",
    text: "A hash index applies a hash function to the key and stores a pointer to the row in the matching bucket. An equality lookup, such as finding the row where id = 42, takes roughly constant time on average. Hashing scatters neighbouring keys across unrelated buckets, so a hash index cannot answer range queries or return rows in sorted order.",
    keyTerms: ["hash function", "constant time", "range queries"],
  },
  {
    id: "S5",
    title: "Clustered indexes",
    text: "A clustered index decides the physical order of the table: the rows themselves are stored in the leaf level, sorted by the index key. Rows can only be stored in one order, so a table can have only one clustered index. In MySQL's InnoDB engine, the primary key is the clustered index. Range scans on the clustered key are fast because matching rows sit together on the same or neighbouring pages.",
    keyTerms: ["physical order", "only one clustered index", "primary key"],
  },
  {
    id: "S6",
    title: "Non-clustered indexes",
    text: "A non-clustered index, also called a secondary index, is stored apart from the table. Each entry holds a key and a reference to the full row, so a lookup searches the index first and then follows the reference to fetch the other columns. A table can have many non-clustered indexes. When an index already contains every column a query needs, it is a covering index, and the database can skip the trip back to the table.",
    keyTerms: ["secondary index", "reference to the full row", "covering index"],
  },
  {
    id: "S7",
    title: "Composite indexes",
    text: "A composite index covers several columns, for example (last_name, first_name). Entries are sorted by the first column, then by the second within each first value. The index helps a filter on last_name alone or on both columns, but it does little for a filter on first_name alone, because those values are scattered across the index. This is known as the leftmost-prefix rule.",
    keyTerms: ["several columns", "first column", "leftmost-prefix rule"],
  },
  {
    id: "S8",
    title: "What indexes cost",
    text: "Indexes are not free. Every insert, update or delete must also change each index on the table, so a table with many indexes is slower to write. Each index also takes disk space and memory. An index on a column with few distinct values, such as a yes-or-no flag, rarely helps, because the query planner will usually prefer a full table scan.",
    keyTerms: ["insert, update or delete", "disk space and memory", "few distinct values"],
  },
];

/**
 * Preset questions with the passage that answers each, labelled by hand for
 * this demo. The first two are worded so that a single retriever on its own
 * ranks a different passage first; what each mode returns is computed, not
 * scripted (the tests pin it).
 */
const PRESETS: { question: string; best: string | null }[] = [
  { question: "Why are B-tree lookups fast on huge tables?", best: "S3" },
  { question: "Does column order matter in a multi-column index?", best: "S7" },
  { question: "Why can't a hash index answer range queries?", best: "S4" },
  { question: "How do I create an index in PostgreSQL?", best: null },
];

const MODES: { id: Mode; label: string }[] = [
  { id: "keyword", label: "Keyword only" },
  { id: "similarity", label: "Similarity only" },
  { id: "hybrid", label: "Hybrid" },
];

/** Each retriever hands its top five to rank fusion. */
const FUSION_DEPTH = 5;
/** MMR weight: 70% relevance, 30% difference from passages already picked. */
const MMR_LAMBDA = 0.7;
/**
 * Below both of these, the best passage shares too little with the question
 * and the demo says so instead of stitching an answer together.
 */
const MIN_COVERAGE = 0.3;
const MIN_SIMILARITY = 0.12;

// Headings are indexed with the text, as they would be in real notes.
const DOCS = NOTES.map((note) => ({ id: note.id, text: `${note.title}. ${note.text}` }));
const DOC_TEXT = new Map(DOCS.map((doc) => [doc.id, doc.text]));
const SENTENCES = new Map(NOTES.map((note) => [note.id, splitSentences(note.text)]));
const TITLES = new Map(NOTES.map((note) => [note.id, note.title]));
const KEYWORD = createBm25Index(DOCS);
const SIMILARITY = createTrigramIndex(DOCS);
const VOCABULARY = new Set(DOCS.flatMap((doc) => tokenize(doc.text)));

export interface AnswerSentence {
  noteId: string;
  /** Position of the sentence inside its passage. */
  index: number;
  text: string;
}

export interface AskResult {
  question: string;
  mode: Mode;
  keyword: Scored[];
  similarity: Scored[];
  /** Reciprocal rank fusion over both top-five lists. */
  fused: Scored[];
  /** MMR's three picks from the fused list. */
  picks: MmrPick[];
  mmrNote: string;
  /** Every retrieved passage, in each mode's order. */
  orders: Record<Mode, string[]>;
  /** Verbatim sentences with their passage; empty when nothing answers. */
  answer: AnswerSentence[];
  /** Why there is no answer, when there is none. */
  reason: string | null;
}

function describeMmr(fused: Scored[], picks: MmrPick[]): string {
  if (!picks.length) return "";
  const top = fused.slice(0, picks.length).map((hit) => hit.id);
  const picked = picks.map((pick) => pick.id);
  const left = top.filter((id) => !picked.includes(id));
  if (!left.length) {
    return picked.every((id, index) => id === top[index])
      ? "MMR kept the fused order."
      : "MMR kept the same three passages in a different order.";
  }
  const parts = left.map((id) => {
    const nearest = picks
      .map((pick) => ({ id: pick.id, similarity: SIMILARITY.between(id, pick.id) }))
      .sort((a, b) => b.similarity - a.similarity)[0];
    return `${id}, which overlaps ${nearest.id} (${nearest.similarity.toFixed(2)})`;
  });
  return `MMR left out ${parts.join(" and ")}.`;
}

function weakReason(question: string, closest: string): string {
  const unknown = [
    ...new Set(words(question).filter((word) => !isStopword(word) && !VOCABULARY.has(stem(word)))),
  ];
  if (unknown.length) {
    const quoted = unknown.slice(0, 3).map((word) => `“${word}”`);
    const list = quoted.length > 1 ? `${quoted.slice(0, -1).join(", ")} or ${quoted[quoted.length - 1]}` : quoted[0];
    return `No passage mentions ${list}, and the closest one, ${closest}, shares too little with the question.`;
  }
  return `The closest passage, ${closest}, shares too little with the question.`;
}

function extractAnswer(question: string, terms: string[], top: string[]): AnswerSentence[] {
  // Later passages count for less, so the answer leans on the best one.
  const weights = [1, 0.85, 0.7];
  const scored = top.map((noteId, rank) =>
    (SENTENCES.get(noteId) ?? []).map((text, index) => ({
      noteId,
      index,
      text,
      score:
        (0.6 * termCoverage(terms, text, KEYWORD.idf) + 0.4 * SIMILARITY.compare(question, text)) * weights[rank],
    })),
  );
  // Two sentences from the top passage, in their original order...
  const lead = [...scored[0]]
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .sort((a, b) => a.index - b.index);
  const leadBest = Math.max(...lead.map((sentence) => sentence.score));
  // ...and one from the next passages only if it scores at least as well.
  const extra = scored
    .slice(1)
    .flat()
    .filter(
      (sentence) =>
        sentence.score >= leadBest && lead.every((chosen) => SIMILARITY.compare(chosen.text, sentence.text) < 0.6),
    )
    .sort((a, b) => b.score - a.score)[0];
  return (extra ? [...lead, extra] : lead).map(({ noteId, index, text }) => ({ noteId, index, text }));
}

/** Runs the whole pipeline for one question; pure and deterministic. */
function askNotes(question: string, mode: Mode): AskResult {
  const ranking = hybridRank(question, KEYWORD, SIMILARITY, { depth: FUSION_DEPTH });
  const picks = mmrSelect(ranking.fused, SIMILARITY.between, { k: 3, lambda: MMR_LAMBDA });
  const picked = picks.map((pick) => pick.id);
  const orders: Record<Mode, string[]> = {
    keyword: ranking.keyword.map((hit) => hit.id),
    similarity: ranking.similarity.map((hit) => hit.id),
    hybrid: [...picked, ...ranking.fused.map((hit) => hit.id).filter((id) => !picked.includes(id))],
  };
  const base = { question, mode, ...ranking, picks, mmrNote: describeMmr(ranking.fused, picks), orders };
  const order = orders[mode];
  const terms = tokenize(question);

  if (!terms.length) {
    return { ...base, answer: [], reason: "The question has no specific words to search for. Try naming a topic, such as hash indexes." };
  }
  if (!order.length) {
    return {
      ...base,
      answer: [],
      reason: mode === "keyword" ? "No passage shares a keyword with the question." : "No passage is similar to the question.",
    };
  }
  const leadText = DOC_TEXT.get(order[0]) ?? "";
  const coverage = termCoverage(terms, leadText, KEYWORD.idf);
  const similarity = SIMILARITY.compare(question, leadText);
  if (coverage < MIN_COVERAGE && similarity < MIN_SIMILARITY) {
    return { ...base, answer: [], reason: weakReason(question, order[0]) };
  }
  return { ...base, answer: extractAnswer(question, terms, order.slice(0, 3)), reason: null };
}

export interface Flashcard {
  noteId: string;
  /** The blanked words, as written in the passage. */
  term: string;
  before: string;
  after: string;
}

/** Three cloze cards: each blanks one of the passage's key terms. */
function makeFlashcards(noteId: string): Flashcard[] {
  const note = NOTES.find((entry) => entry.id === noteId);
  const sentences = SENTENCES.get(noteId) ?? [];
  if (!note) return [];
  return note.keyTerms
    .flatMap((term) => {
      const sentence = sentences.find((entry) => entry.toLowerCase().includes(term.toLowerCase()));
      if (!sentence) return [];
      const at = sentence.toLowerCase().indexOf(term.toLowerCase());
      return [{ noteId, term: sentence.slice(at, at + term.length), before: sentence.slice(0, at), after: sentence.slice(at + term.length) }];
    })
    .slice(0, 3);
}

// eslint-disable-next-line react-refresh/only-export-components -- pure logic and sample data, exported for tests
export { askNotes, makeFlashcards, NOTES, PRESETS };

const ordinal = (n: number) => {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
};

/** Bold key terms inside one sentence of the notes. */
function withKeyTerms(sentence: string, terms: string[]): ReactNode[] {
  const lower = sentence.toLowerCase();
  const spans: { start: number; end: number }[] = [];
  terms.forEach((term) => {
    const start = lower.indexOf(term.toLowerCase());
    if (start >= 0) spans.push({ start, end: start + term.length });
  });
  spans.sort((a, b) => a.start - b.start);
  const parts: ReactNode[] = [];
  let cursor = 0;
  spans.forEach((span) => {
    if (span.start < cursor) return;
    parts.push(sentence.slice(cursor, span.start), <strong key={span.start}>{sentence.slice(span.start, span.end)}</strong>);
    cursor = span.end;
  });
  parts.push(sentence.slice(cursor));
  return parts;
}

type StageKey = Mode;

/** One sentence of one passage. */
interface Spot {
  noteId: string;
  index: number;
}
const sameSpot = (a: Spot | null, b: Spot | null) => Boolean(a && b && a.noteId === b.noteId && a.index === b.index);

export default function StudyForgeDemo() {
  const uid = useId();
  const [draft, setDraft] = useState(PRESETS[0].question);
  const [asked, setAsked] = useState(PRESETS[0].question);
  const [askCount, setAskCount] = useState(0);
  const [mode, setMode] = useState<Mode>("hybrid");
  // Hover or focus previews a citation's sentence; a click pins it, so the
  // highlight stays while the visitor moves over to read the notes.
  const [hovered, setHovered] = useState<Spot | null>(null);
  const [pinned, setPinned] = useState<Spot | null>(null);
  const highlight = hovered ?? pinned;
  const [cardsFor, setCardsFor] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const reduced = useReducedMotion();
  const paused = useMotionPaused();
  const still = Boolean(reduced) || paused;

  const result = useMemo(() => askNotes(asked, mode), [asked, mode]);
  const preset = PRESETS.find((entry) => entry.question === asked);
  const labelled = preset?.best ?? null;
  const cited = new Set(result.answer.map((sentence) => `${sentence.noteId}:${sentence.index}`));
  const citedNotes = new Set(result.answer.map((sentence) => sentence.noteId));
  const leadNote = result.answer[0]?.noteId ?? null;
  const used = result.orders[mode].slice(0, 3);

  const clearHighlight = () => {
    setHovered(null);
    setPinned(null);
    setCardsFor(null);
  };
  const ask = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;
    setDraft(trimmed);
    setAsked(trimmed);
    setAskCount((count) => count + 1);
    clearHighlight();
  };
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    ask(draft);
  };
  const reset = () => {
    setDraft(PRESETS[0].question);
    setAsked(PRESETS[0].question);
    setMode("hybrid");
    setAskCount((count) => count + 1);
    clearHighlight();
  };
  const chooseMode = (next: Mode) => {
    setMode(next);
    clearHighlight();
  };

  // Keep the highlighted sentence visible inside the notes list. This scrolls
  // the list only, never the page, so hovering a citation cannot move the page.
  useEffect(() => {
    const list = listRef.current;
    if (!highlight || !list) return;
    const target = list.querySelector<HTMLElement>(`[data-sentence="${highlight.noteId}-${highlight.index}"]`);
    if (!target) return;
    const box = list.getBoundingClientRect();
    const spot = target.getBoundingClientRect();
    if (spot.top < box.top || spot.bottom > box.bottom) {
      list.scrollTo?.({ top: list.scrollTop + spot.top - box.top - 12, behavior: still ? "auto" : "smooth" });
    }
  }, [highlight, still]);

  // Pinning also brings the passage on screen, which matters on phones,
  // where the notes sit below the answer.
  const togglePin = (spot: Spot) => {
    if (sameSpot(pinned, spot)) {
      setPinned(null);
      return;
    }
    setPinned(spot);
    listRef.current
      ?.querySelector<HTMLElement>(`[data-note="${spot.noteId}"]`)
      ?.scrollIntoView?.({ block: "nearest", behavior: still ? "auto" : "smooth" });
  };

  const stageState = (key: StageKey): { state: "on" | "feeds" | "off"; label: string } => {
    if (key === mode) return { state: "on", label: "In use" };
    if (mode === "hybrid") return { state: "feeds", label: "Into fusion" };
    return { state: "off", label: "Not used" };
  };

  const stages: {
    key: StageKey;
    number: string;
    name: string;
    method: string;
    hits: Scored[];
    digits: number;
    empty: string;
  }[] = [
    { key: "keyword", number: "01", name: "Keyword", method: "BM25", hits: result.keyword.slice(0, 3), digits: 2, empty: "No shared keywords" },
    { key: "similarity", number: "02", name: "Similarity", method: "Trigram cosine", hits: result.similarity.slice(0, 3), digits: 2, empty: "Nothing similar" },
    { key: "hybrid", number: "03", name: "Fused", method: "RRF, then MMR", hits: result.picks, digits: 4, empty: "Nothing to fuse" },
  ];

  const rankText = (key: Mode) => {
    if (!labelled) return "";
    const position = result.orders[key].indexOf(labelled);
    return position < 0 ? "not retrieved" : ordinal(position + 1);
  };

  const fade = (delay: number) =>
    still
      ? { initial: false as const }
      : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.28, delay } };

  return (
    <DemoFrame
      project="StudyForge"
      title="Ask your notes a question"
      intro="Eight passages of sample lecture notes on database indexing. Compare what keyword search, a similarity score and their fusion retrieve, and which sentences the answer quotes."
      note="A small in-browser version: keyword scoring, a character-similarity stand-in for the embedding model, rank fusion with MMR, and answers stitched from the cited sentences. It can still give a poor answer to a question that only shares words with the notes. The real app uses an embedding model, an LLM reranker and generated answers."
      onReset={reset}
      className="sf-demo"
    >
      <div className="sf-layout">
        <div className="sf-ask">
          <form className="sf-form" onSubmit={onSubmit}>
            <label className="demo-label sf-inline-label" htmlFor={`${uid}-question`}>
              Your question
            </label>
            <div className="sf-form-row">
              <input
                id={`${uid}-question`}
                className="demo-input"
                type="text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="What does a B+ tree keep in its leaves?"
                autoComplete="off"
                maxLength={160}
              />
              <button type="submit" className="demo-btn" disabled={!draft.trim()}>
                Ask
              </button>
            </div>
          </form>
          <div className="demo-chips sf-presets" role="group" aria-labelledby={`${uid}-presets`}>
            <span className="demo-label sf-inline-label" id={`${uid}-presets`}>
              Or try
            </span>
            {PRESETS.map((entry) => (
              <button
                key={entry.question}
                type="button"
                className="demo-chip"
                aria-pressed={asked === entry.question}
                onClick={() => ask(entry.question)}
              >
                {entry.question}
              </button>
            ))}
          </div>
        </div>

        <div className="sf-grid">
          <div className="sf-main">
            <div className="sf-retrieval">
              <div className="sf-retrieval-head">
                <h4 className="demo-label" id={`${uid}-retrieval`}>
                  Retrieval · top three per step
                </h4>
                <div className="sf-modes">
                  <span className="demo-label" id={`${uid}-modes`}>
                    Answer from
                  </span>
                  <div className="demo-chips" role="group" aria-labelledby={`${uid}-modes`}>
                    {MODES.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        className="demo-chip"
                        aria-pressed={mode === entry.id}
                        onClick={() => chooseMode(entry.id)}
                      >
                        {entry.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="sf-stages">
                {stages.map((stage, stageIndex) => {
                  const status = stageState(stage.key);
                  const max = Math.max(0, ...stage.hits.map((hit) => hit.score)) || 1;
                  return (
                    <motion.div
                      key={`${askCount}-${stage.key}`}
                      className="sf-stage"
                      data-state={status.state}
                      role="group"
                      aria-label={`${stage.number} ${stage.name}, ${stage.method}: ${status.label.toLowerCase()}`}
                      {...fade(stageIndex * 0.12)}
                    >
                      <header className="sf-stage-head">
                        <span className="sf-stage-name">
                          <b>{stage.number}</b> {stage.name} <span className="sf-stage-method">{stage.method}</span>
                        </span>
                        <span className="sf-stage-status">{status.label}</span>
                      </header>
                      {stage.hits.length ? (
                        <ol className="sf-hits">
                          {stage.hits.map((hit) => (
                            <li key={hit.id} className="sf-hit">
                              <span className={`demo-tag${hit.id === labelled ? " is-labelled" : ""}`}>{hit.id}</span>
                              <span className="sf-hit-title">{TITLES.get(hit.id)}</span>
                              <span className="sf-hit-score">{hit.score.toFixed(stage.digits)}</span>
                              <i className="sf-hit-bar" style={{ width: `${(hit.score / max) * 100}%` }} aria-hidden="true" />
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="sf-stage-empty">{stage.empty}</p>
                      )}
                    </motion.div>
                  );
                })}
              </div>
              {result.mmrNote && <p className="sf-stage-foot">03 · {result.mmrNote}</p>}
              {preset && (
                <p className="sf-labelled">
                  {labelled ? (
                    <>
                      <span className="demo-tag is-labelled">{labelled}</span> answers this question (labelled for
                      the demo). Keyword ranks it {rankText("keyword")}, similarity {rankText("similarity")}, hybrid{" "}
                      {rankText("hybrid")}.
                    </>
                  ) : (
                    <>None of the passages covers this question (labelled for the demo).</>
                  )}
                </p>
              )}
            </div>

            <div className="sf-answer">
              <div className="sf-answer-head">
                <h4 className="demo-label" id={`${uid}-answer`}>
                  Answer · {MODES.find((entry) => entry.id === mode)?.label} · quoted from the notes
                </h4>
                {leadNote && (
                  <button
                    type="button"
                    className="demo-btn is-ghost sf-cards-toggle"
                    aria-expanded={cardsFor === leadNote}
                    aria-controls={cardsFor === leadNote ? `${uid}-cards` : undefined}
                    onClick={() => setCardsFor((current) => (current === leadNote ? null : leadNote))}
                  >
                    {cardsFor === leadNote ? "Hide flashcards" : `Make 3 flashcards from ${leadNote}`}
                  </button>
                )}
              </div>
              {/* The live region stays mounted; only its content is swapped. */}
              <div aria-live="polite">
                <motion.div key={`${askCount}-${mode}`} {...fade(0.36)}>
                  {result.answer.length ? (
                    <p className="sf-answer-text">
                      {result.answer.map((sentence) => {
                        const key = `${sentence.noteId}-${sentence.index}`;
                        const spot = { noteId: sentence.noteId, index: sentence.index };
                        return (
                          <Fragment key={key}>
                            <span className={sameSpot(highlight, spot) ? "is-active" : undefined}>{sentence.text}</span>{" "}
                            <button
                              type="button"
                              className="sf-cite"
                              aria-label={`Source ${sentence.noteId}, ${TITLES.get(sentence.noteId)}: show the quoted sentence`}
                              aria-pressed={sameSpot(pinned, spot)}
                              onMouseEnter={() => setHovered(spot)}
                              onMouseLeave={() => setHovered(null)}
                              onFocus={() => setHovered(spot)}
                              onBlur={() => setHovered(null)}
                              onClick={() => togglePin(spot)}
                            >
                              {sentence.noteId}
                            </button>{" "}
                          </Fragment>
                        );
                      })}
                    </p>
                  ) : (
                    <div className="sf-none">
                      <p>Nothing in these notes answers that.</p>
                      {result.reason && <p className="sf-none-why">{result.reason}</p>}
                    </div>
                  )}
                </motion.div>
              </div>
              {leadNote && cardsFor === leadNote && (
                <ol className="sf-cards" id={`${uid}-cards`} aria-label={`Flashcards from ${leadNote}`}>
                  {makeFlashcards(leadNote).map((card, index) => (
                    <li key={card.term} className="sf-card">
                      <span className="sf-card-label">
                        Card {index + 1} / 3 · bold term from {card.noteId}
                      </span>
                      <p>
                        {card.before}
                        <span className="sf-blank" aria-hidden="true">
                          ______
                        </span>
                        <span className="sf-sr">blank</span>
                        {card.after}
                      </p>
                      <details>
                        <summary>
                          <span className="sf-show">Show answer</span>
                          <span className="sf-hide">Hide answer</span>
                        </summary>
                        <p className="sf-card-answer">{card.term}</p>
                      </details>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>

          <div className="sf-notes">
            <h4 className="demo-label" id={`${uid}-notes`}>
              Sample notes · written for this demo
            </h4>
            <ol className="sf-notes-list" ref={listRef} tabIndex={0} aria-labelledby={`${uid}-notes`}>
              {NOTES.map((note) => {
                const rank = used.indexOf(note.id);
                return (
                  <li key={note.id} data-note={note.id}>
                    <div className="sf-note-head">
                      <span className={`demo-tag${note.id === labelled ? " is-labelled" : ""}`}>{note.id}</span>
                      <span className="sf-note-title">{note.title}</span>
                      <span className="sf-note-flags">
                        {rank >= 0 && <span>Rank {rank + 1}</span>}
                        {citedNotes.has(note.id) && <span>Cited</span>}
                      </span>
                    </div>
                    <p>
                      {(SENTENCES.get(note.id) ?? []).map((sentence, index) => {
                        const key = `${note.id}-${index}`;
                        const content = withKeyTerms(sentence, note.keyTerms);
                        return (
                          <Fragment key={key}>
                            {sameSpot(highlight, { noteId: note.id, index }) ? (
                              <mark data-sentence={key}>{content}</mark>
                            ) : (
                              <span data-sentence={key} className={cited.has(`${note.id}:${index}`) ? "is-quoted" : undefined}>
                                {content}
                              </span>
                            )}{" "}
                          </Fragment>
                        );
                      })}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </DemoFrame>
  );
}

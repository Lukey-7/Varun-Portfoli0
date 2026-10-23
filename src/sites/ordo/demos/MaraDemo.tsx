import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useMotionPaused } from "@/lib/motion-pause";
import DemoFrame from "./DemoFrame";
import {
  createBm25Index,
  createTrigramIndex,
  hybridRank,
  isStopword,
  splitSentences,
  stem,
  tokenize,
  type Scored,
} from "./retrieval";
import "./mara.css";

interface Chunk {
  id: string;
  doc: string;
  text: string;
}

/** A small sample library written for this demo: three topics, four chunks each. */
const LIBRARY: Chunk[] = [
  {
    id: "P1",
    doc: "The printing press",
    text: "Johannes Gutenberg built a printing press with movable metal type in Mainz around 1450. Each letter was cast as a separate piece of metal, so the same type could be set into lines, inked, printed and then reused for the next page.",
  },
  {
    id: "P2",
    doc: "The printing press",
    text: "Before printing, books in Europe were copied by hand, and a single copy could take a scribe months to finish. A press could turn out hundreds of identical copies of a text, so books became cheaper and far more widely available.",
  },
  {
    id: "P3",
    doc: "The printing press",
    text: "The Gutenberg Bible, finished in the mid-1450s, was the first major book printed with movable type in Europe. Fewer than fifty copies are known to survive, and most of them are held by libraries.",
  },
  {
    id: "P4",
    doc: "The printing press",
    text: "Printing spread quickly across Europe. By 1500, presses were working in more than two hundred towns and cities, and books printed before 1501 are known as incunabula.",
  },
  {
    id: "C1",
    doc: "Coral reefs",
    text: "Reef-building corals are animals that live in partnership with tiny algae called zooxanthellae. The algae live inside the coral's tissue and supply most of its food through photosynthesis, which is why reefs grow in clear, shallow, sunlit water.",
  },
  {
    id: "C2",
    doc: "Coral reefs",
    text: "When the water stays too warm for too long, corals expel the algae from their tissue and turn white. This is called coral bleaching. A bleached coral is not yet dead, but it is starving, and it can die if the heat lasts.",
  },
  {
    id: "C3",
    doc: "Coral reefs",
    text: "Coral reefs cover less than one percent of the ocean floor, yet they are home to roughly a quarter of all known marine species. Reefs also protect coastlines by breaking up waves before they reach the shore.",
  },
  {
    id: "C4",
    doc: "Coral reefs",
    text: "The Great Barrier Reef, off the coast of Queensland in Australia, is the largest coral reef system in the world. It stretches for more than 2,000 kilometres and is made up of thousands of individual reefs.",
  },
  {
    id: "M1",
    doc: "Mars rovers",
    text: "Sojourner, the first wheeled rover to drive on Mars, arrived with the Mars Pathfinder mission in 1997. It was about the size of a microwave oven and stayed close to its lander, which relayed its signals to Earth.",
  },
  {
    id: "M2",
    doc: "Mars rovers",
    text: "Spirit and Opportunity landed in 2004 on missions planned to last about 90 Martian days. Opportunity kept working until 2018, when a planet-wide dust storm blocked the sunlight its solar panels needed, and it fell silent.",
  },
  {
    id: "M3",
    doc: "Mars rovers",
    text: "Curiosity, which landed in Gale Crater in 2012, gets its power from a radioisotope generator rather than from sunlight. The generator turns heat from decaying plutonium into electricity, so dust storms do not cut its supply.",
  },
  {
    id: "M4",
    doc: "Mars rovers",
    text: "Perseverance landed in Jezero Crater in 2021 and collects rock cores in sealed tubes so that a later mission could return them to Earth. It also carried Ingenuity, a small helicopter that made the first powered, controlled flight on another planet.",
  },
];

/** Three questions the library can answer and one it cannot. */
const PRESETS: { label: string; question: string }[] = [
  { label: "Printing press", question: "When was Gutenberg's press built, and why did books become cheaper?" },
  { label: "Coral reefs", question: "Why do corals turn white, and how much of the ocean floor do reefs cover?" },
  { label: "Mars rovers", question: "Why did Opportunity go silent in 2018, and how does Curiosity get its power?" },
  { label: "Rover budget", question: "How much did the Perseverance rover cost, and who paid for it?" },
];

const LANES = ["Planner", "Researcher", "Summariser", "Critic", "Writer"] as const;
const STEP_MS = 1200;
/**
 * Which lane is open after `step` lanes have finished: the newest one. The
 * writer's output goes to the answer panel, so at the end the critic's
 * coverage report stays open beside it.
 */
const openAfter = (step: number) => (step > 0 ? Math.min(step, 4) - 1 : null);

// Chunks are indexed with their document title, as MARA keeps document metadata.
const CHUNKS = new Map(LIBRARY.map((chunk) => [chunk.id, chunk]));
const DOCS = LIBRARY.map((chunk) => ({ id: chunk.id, text: `${chunk.doc}. ${chunk.text}` }));
const KEYWORD = createBm25Index(DOCS);
const SIMILARITY = createTrigramIndex(DOCS);

export interface KeyWord {
  word: string;
  stem: string;
  /** Capitalised inside the sentence, so treated as a name. */
  name: boolean;
}

export interface Plan {
  subQuestions: string[];
  rule: string;
}

export interface MaraNote {
  id: string;
  /** Index of the sub-question the note supports. */
  sub: number;
  chunkId: string;
  quote: string;
  matched: string[];
  /** The simulated summariser slip: a quote reworded from memory. */
  slip: boolean;
  /** The summariser's code check: the quote appears verbatim in its chunk. */
  verified: boolean;
  /** Where a dropped quote parts from its source, word for word. */
  noteSays?: string;
  sourceSays?: string;
}

export interface MaraTrace {
  question: string;
  plan: Plan;
  research: Scored[][];
  /** Every note the summariser proposed, with its quote-check result. */
  notes: MaraNote[];
  /** Sub-questions the summariser found no supporting sentence for. */
  gaps: { sub: number; missing: string[] }[];
  /** The critic's coverage: verified note ids per sub-question; empty means a gap. */
  coverage: string[][];
  /** Pairs of verified notes on one sub-question that give different figures. */
  conflicts: [string, string][];
  answer: {
    sentences: { text: string; source: number }[];
    sources: { n: number; chunkId: string; quotes: string[] }[];
    /** Sub-questions left without verified evidence. */
    unanswered: number[];
    /** Key words no retrieved sentence contained, for the no-evidence message. */
    missing: string[];
  };
}

/** MARA's rule: a note's quote must appear verbatim in the chunk it cites. This check ignores only case and spacing. */
function quoteAppears(quote: string, chunkText: string): boolean {
  const normalise = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase();
  const target = normalise(quote);
  return target.length > 0 && normalise(chunkText).includes(target);
}

function keyWords(question: string): KeyWord[] {
  const raw = question.replace(/['’]s\b/g, "").match(/[A-Za-z0-9]+\+*/g) ?? [];
  const seen = new Set<string>();
  return raw.flatMap((word, index) => {
    const lower = word.toLowerCase();
    if (isStopword(lower) || (lower.length < 2 && !/\d/.test(lower))) return [];
    const root = stem(lower);
    if (seen.has(root)) return [];
    seen.add(root);
    return [{ word: lower, stem: root, name: index > 0 && /^[A-Z]/.test(word) }];
  });
}

/** Rule-based planner: split a compound question at "and" before a question word. */
function planQuestion(question: string): Plan {
  const trimmed = question.trim().replace(/\?+$/, "");
  const parts = trimmed
    .split(/,?\s+and\s+(?=(?:how|what|when|where|which|who|why|did|does|do|is|are|was|were|can)\b)/i)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) {
    return { subQuestions: [`${trimmed}?`], rule: "No second question found, so the planner keeps it whole." };
  }
  // "it" in a later part means the first name in the first part.
  const subject = parts[0]
    .split(/\s+/)
    .slice(1)
    .find((word) => /^[A-Z]/.test(word))
    ?.replace(/['’]s$/, "");
  let rule = "Split at “and” before a question word.";
  const subQuestions = parts.map((part, index) => {
    let text = part;
    if (index > 0 && subject && /\bit\b/.test(text)) {
      text = text.replace(/\bit\b/, subject);
      rule += ` Read “it” as ${subject}.`;
    }
    return `${text.charAt(0).toUpperCase()}${text.slice(1)}?`;
  });
  return { subQuestions, rule };
}

// Rewordings a summariser might produce when it quotes from memory.
const REWORDINGS: [string, string][] = [
  ["turn out", "produce"],
  ["less than", "under"],
  ["more than", "over"],
  ["rather than", "instead of"],
  ["landed", "touched down"],
  ["built", "made"],
  ["kept working", "kept going"],
  ["fell silent", "went quiet"],
  ["turn white", "go white"],
  ["copied by hand", "written out by hand"],
  ["finished", "completed"],
  ["quickly", "rapidly"],
  ["cheaper", "less expensive"],
  ["tiny", "very small"],
  ["supply", "provide"],
  ["expel", "push out"],
  ["largest", "biggest"],
  ["about", "roughly"],
  ["roughly", "about"],
  ["around", "about"],
  ["carried", "brought"],
  ["collects", "gathers"],
];

/** Rewords the earliest phrase it knows; returns the quote unchanged if none applies. */
function reword(quote: string): string {
  let best: { at: number; from: string; to: string } | null = null;
  for (const [from, to] of REWORDINGS) {
    const at = quote.search(new RegExp(`\\b${from}\\b`, "i"));
    if (at >= 0 && (!best || at < best.at)) best = { at, from, to };
  }
  if (!best) return quote;
  return `${quote.slice(0, best.at)}${best.to}${quote.slice(best.at + best.from.length)}`;
}

/** The middle span where two sentences differ, after their shared start and end. */
function difference(noteQuote: string, source: string): { noteSays: string; sourceSays: string } {
  const a = noteQuote.split(/\s+/);
  const b = source.split(/\s+/);
  const same = (x: string, y: string) => x.toLowerCase() === y.toLowerCase();
  let start = 0;
  while (start < a.length && start < b.length && same(a[start], b[start])) start += 1;
  let endA = a.length - 1;
  let endB = b.length - 1;
  while (endA >= start && endB >= start && same(a[endA], b[endB])) {
    endA -= 1;
    endB -= 1;
  }
  return { noteSays: a.slice(start, endA + 1).join(" "), sourceSays: b.slice(start, endB + 1).join(" ") };
}

function closestSentence(chunkText: string, quote: string): string {
  const target = new Set(tokenize(quote));
  return splitSentences(chunkText)
    .map((sentence) => ({ sentence, shared: tokenize(sentence).filter((term) => target.has(term)).length }))
    .sort((x, y) => y.shared - x.shared)[0].sentence;
}

/** The critic's conflict rule here: two notes on one sub-question whose figures share nothing. */
function findConflicts(notes: MaraNote[]): [string, string][] {
  const figures = (text: string) => new Set(text.match(/\d[\d,.]*\d|\d/g) ?? []);
  const pairs: [string, string][] = [];
  notes.forEach((first, index) =>
    notes.slice(index + 1).forEach((second) => {
      if (first.sub !== second.sub) return;
      const a = figures(first.quote);
      const b = figures(second.quote);
      if (a.size && b.size && ![...a].some((figure) => b.has(figure))) pairs.push([first.id, second.id]);
    }),
  );
  return pairs;
}

type Proposal = Omit<MaraNote, "verified" | "noteSays" | "sourceSays">;

/** The whole five-agent run for one question; pure and deterministic. */
function runMara(question: string): MaraTrace {
  const plan = planQuestion(question);
  const research = plan.subQuestions.map((sub) => hybridRank(sub, KEYWORD, SIMILARITY, { depth: 5 }).fused.slice(0, 3));

  // Summariser, part one: one note per sub-question, from the sentence that
  // holds more than half of its key words (names do not count, so
  // "Perseverance" alone cannot support a claim about Perseverance's cost).
  const notes: Proposal[] = [];
  const gaps: MaraTrace["gaps"] = [];
  const allMissing = new Set<string>();
  plan.subQuestions.forEach((sub, subIndex) => {
    const words = keyWords(sub);
    const focus = words.some((word) => !word.name) ? words.filter((word) => !word.name) : words;
    const candidates = research[subIndex].flatMap((hit, rank) =>
      splitSentences(CHUNKS.get(hit.id)?.text ?? "").map((text, index) => {
        const present = new Set(tokenize(text));
        return { chunkId: hit.id, rank, index, text, matched: focus.filter((word) => present.has(word.stem)) };
      }),
    );
    const best = candidates
      .filter((candidate) => focus.length > 0 && candidate.matched.length / focus.length > 0.5)
      .filter((candidate) => !notes.some((note) => note.quote === candidate.text))
      .sort((x, y) => y.matched.length - x.matched.length || x.rank - y.rank || x.index - y.index)[0];
    if (best) {
      notes.push({
        id: `N${notes.length + 1}`,
        sub: subIndex,
        chunkId: best.chunkId,
        quote: best.text,
        matched: best.matched.map((word) => word.word),
        slip: false,
      });
    } else {
      const missing = focus
        .filter((word) => !candidates.some((candidate) => candidate.matched.includes(word)))
        .map((word) => word.word);
      missing.forEach((word) => allMissing.add(word));
      gaps.push({ sub: subIndex, missing });
    }
  });

  // The simulated slip: the last note restated with its quote reworded, the
  // kind of near-miss a language model makes when it quotes from memory.
  const last = notes[notes.length - 1];
  if (last) {
    const reworded = reword(last.quote);
    if (reworded !== last.quote) notes.push({ ...last, id: `N${notes.length + 1}`, quote: reworded, slip: true });
  }

  // Summariser, part two: the code check MARA runs before a note leaves the
  // summariser. A quote that is not in its chunk verbatim is dropped.
  const checked: MaraNote[] = notes.map((note) => {
    const text = CHUNKS.get(note.chunkId)?.text ?? "";
    if (quoteAppears(note.quote, text)) return { ...note, verified: true };
    return { ...note, verified: false, ...difference(note.quote, closestSentence(text, note.quote)) };
  });
  const verified = checked.filter((note) => note.verified);

  // Critic: sees only verified notes and reports coverage and conflicts.
  const coverage = plan.subQuestions.map((_, subIndex) =>
    verified.filter((note) => note.sub === subIndex).map((note) => note.id),
  );
  const conflicts = findConflicts(verified);

  // Writer: verified notes only, each source numbered once in order of first use.
  const sources: MaraTrace["answer"]["sources"] = [];
  const sentences = verified.map((note) => {
    let source = sources.find((entry) => entry.chunkId === note.chunkId);
    if (!source) {
      source = { n: sources.length + 1, chunkId: note.chunkId, quotes: [] };
      sources.push(source);
    }
    if (!source.quotes.includes(note.quote)) source.quotes.push(note.quote);
    return { text: note.quote, source: source.n };
  });
  const unanswered = coverage.flatMap((ids, subIndex) => (ids.length ? [] : [subIndex]));

  return {
    question,
    plan,
    research,
    notes: checked,
    gaps,
    coverage,
    conflicts,
    answer: { sentences, sources, unanswered, missing: [...allMissing] },
  };
}

// eslint-disable-next-line react-refresh/only-export-components -- pure logic and sample data, exported for tests
export { LIBRARY, PRESETS, planQuestion, quoteAppears, reword, runMara };

const quoted = (items: string[]) => {
  const marks = items.map((item) => `“${item}”`);
  return marks.length > 1 ? `${marks.slice(0, -1).join(", ")} or ${marks[marks.length - 1]}` : marks[0] ?? "";
};

/** A chunk's text with its quoted sentences marked. */
function markQuotes(text: string, quotes: string[]): ReactNode[] {
  return splitSentences(text).flatMap((sentence, index) => [
    quotes.includes(sentence) ? <mark key={index}>{sentence}</mark> : <span key={index}>{sentence}</span>,
    " ",
  ]);
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

function laneSummary(lane: number, trace: MaraTrace): string {
  const dropped = trace.notes.filter((note) => !note.verified).length;
  const covered = trace.coverage.filter((ids) => ids.length > 0).length;
  const gaps = trace.coverage.length - covered;
  switch (lane) {
    case 0:
      return plural(trace.plan.subQuestions.length, "sub-question");
    case 1:
      return `Top ${trace.research[0]?.length ?? 0} chunks for each sub-question`;
    case 2:
      if (!trace.notes.length) return "No sentence supports a note";
      return `${plural(trace.notes.length, "note")} proposed, ${
        dropped ? `${dropped} dropped by the quote check` : "all passed the quote check"
      }`;
    case 3:
      return `${covered} of ${plural(trace.coverage.length, "sub-question")} covered${gaps ? `, ${plural(gaps, "gap")}` : ""}${
        trace.conflicts.length ? `, ${plural(trace.conflicts.length, "conflict")}` : ""
      }`;
    default:
      return trace.answer.sentences.length
        ? `Answer with ${trace.answer.sources.length} source${trace.answer.sources.length === 1 ? "" : "s"}`
        : "No evidence found, so no answer";
  }
}

export default function MaraDemo() {
  const uid = useId();
  const [question, setQuestion] = useState(PRESETS[0].question);
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const reduced = useReducedMotion();
  const paused = useMotionPaused();
  const still = Boolean(reduced) || paused;
  const trace = useMemo(() => runMara(question), [question]);

  // Timed playback, one agent per tick. Reduced motion or the page-wide pause
  // ends it at once and shows the finished trace instead.
  useEffect(() => {
    if (!running) return;
    if (still || step >= LANES.length) {
      setRunning(false);
      setStep(LANES.length);
      setOpen(openAfter(LANES.length));
      return;
    }
    const timer = window.setTimeout(
      () => {
        setStep(step + 1);
        setOpen(openAfter(step + 1));
      },
      step === 0 ? 200 : STEP_MS,
    );
    return () => window.clearTimeout(timer);
  }, [running, step, still]);

  const reveal = (next: number) => {
    setStep(next);
    setOpen(openAfter(next));
  };
  const choose = (next: string) => {
    setQuestion(next);
    setStep(0);
    setRunning(false);
    setOpen(null);
  };
  const run = () => {
    if (running) {
      setRunning(false);
      return;
    }
    if (still) {
      reveal(LANES.length);
      return;
    }
    if (step >= LANES.length) {
      setStep(0);
      setOpen(null);
    }
    setRunning(true);
  };
  const nextStep = () => {
    setRunning(false);
    reveal(Math.min(LANES.length, step + 1));
  };
  const reset = () => choose(PRESETS[0].question);

  const passed = trace.notes.filter((note) => note.verified).length;
  const status =
    step === 0
      ? "Ready. Run plays the five agents in turn; Next step moves one at a time."
      : step < LANES.length
        ? `Step ${step} of 5: ${LANES[step - 1].toLowerCase()}. ${laneSummary(step - 1, trace)}.`
        : trace.answer.sentences.length
          ? `Done. ${passed} of ${trace.notes.length} notes passed the quote check; the answer cites ${plural(trace.answer.sources.length, "source")}.`
          : "Done. No sub-question has verified evidence, so the writer reports that no evidence was found.";
  const runLabel = running ? "Pause" : step >= LANES.length ? "Run again" : step > 0 ? "Run the rest" : "Run";
  const revealMotion = still
    ? { initial: false as const }
    : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3 } };
  const subTag = (index: number) => `Q${index + 1}`;
  const chunkLabel = (id: string) => `${id} · ${CHUNKS.get(id)?.doc ?? ""}`;

  const laneBody = (lane: number): ReactNode => {
    switch (lane) {
      case 0:
        return (
          <>
            <p className="mara-rule">{trace.plan.rule}</p>
            <ol className="mara-list">
              {trace.plan.subQuestions.map((sub, index) => (
                <li key={sub}>
                  <span className="demo-tag">{subTag(index)}</span> {sub}
                </li>
              ))}
            </ol>
          </>
        );
      case 1:
        return (
          <>
            <p className="mara-rule">
              Keyword (BM25) and character-similarity search over the 12 chunks, fused by reciprocal rank. There is
              no cross-encoder reranker in this demo.
            </p>
            <ol className="mara-list">
              {trace.research.map((hits, index) => (
                <li key={index} className="mara-hits">
                  <span className="demo-tag">{subTag(index)}</span>
                  {hits.map((hit) => (
                    <span key={hit.id} className="mara-hit">
                      {hit.id} <b>{hit.score.toFixed(4)}</b>
                    </span>
                  ))}
                </li>
              ))}
            </ol>
            <p className="mara-foot">Scores are fused ranks, not probabilities: 1/(60 + rank), summed over both searches.</p>
          </>
        );
      case 2:
        return (
          <>
            <p className="mara-rule">
              A note needs one sentence holding more than half of its sub-question&apos;s key words; names do not
              count. Before a note leaves the summariser, code checks that its quote appears word for word in the
              chunk it cites (case and spacing ignored) and drops it if not.
            </p>
            {trace.notes.length > 0 && (
              <ol className="mara-list">
                {trace.notes.map((note) => (
                  <li key={note.id} className={note.verified ? "mara-note" : "mara-note is-dropped"}>
                    <span className="mara-note-meta">
                      <span className="demo-tag">{note.id}</span>
                      <span className="mara-badge">{note.verified ? "Verified" : "Dropped"}</span>
                      for {subTag(note.sub)} · from {note.chunkId}
                      {note.slip ? (
                        <strong className="mara-flag">Quote reworded · a simulated slip</strong>
                      ) : (
                        <span className="mara-matched"> · key words: {note.matched.join(", ")}</span>
                      )}
                    </span>
                    {note.verified ? (
                      <q>{note.quote}</q>
                    ) : (
                      <>
                        <s className="mara-struck-quote">{note.quote}</s>
                        <span className="mara-diff">
                          The note says “{note.noteSays}”; {note.chunkId} says “{note.sourceSays}”. The
                          summariser&apos;s code check drops it, so it never reaches the critic or the writer.
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {trace.gaps.map((gap) => (
              <p key={gap.sub} className="mara-gap">
                {subTag(gap.sub)}: no note.{" "}
                {gap.missing.length
                  ? `No retrieved sentence mentions ${quoted(gap.missing)}.`
                  : "No single sentence holds enough of its key words."}
              </p>
            ))}
          </>
        );
      case 3: {
        const verifiedCount = trace.notes.filter((note) => note.verified).length;
        const hasGap = trace.coverage.some((ids) => ids.length === 0);
        return (
          <>
            <p className="mara-rule">
              Sees only the {plural(verifiedCount, "note")} that passed the quote check. It reports which
              sub-questions have evidence and which are gaps, and flags two notes on one sub-question whose figures
              disagree.
            </p>
            <ol className="mara-list">
              {trace.coverage.map((ids, index) => (
                <li key={index} className={ids.length ? "mara-cover" : "mara-cover is-gap"}>
                  <span className="mara-note-meta">
                    <span className="demo-tag">{subTag(index)}</span>
                    <span className="mara-badge">{ids.length ? "Evidence" : "Gap"}</span>
                    {ids.length ? `verified ${ids.length === 1 ? "note" : "notes"} ${ids.join(", ")}` : "no verified note"}
                  </span>
                  <span className="mara-cover-question">{trace.plan.subQuestions[index]}</span>
                </li>
              ))}
            </ol>
            <p className="mara-foot">
              Conflicts:{" "}
              {trace.conflicts.length
                ? trace.conflicts.map(([first, second]) => `${first} and ${second} give different figures`).join("; ")
                : "none"}
              .
              {hasGap && " A real run can ask up to 3 new sub-questions to fill a gap; this demo does not loop."}
            </p>
          </>
        );
      }
      default:
        return null;
    }
  };

  return (
    <DemoFrame
      project="MARA"
      title="Watch five agents answer, with receipts"
      intro="A planner, researcher, summariser, critic and writer answer a question from a small sample library. Every note must quote its chunk word for word, or the summariser's code check drops it. One question asks for a figure the library does not hold."
      note="Simulated agents: the plan, the notes and the critic's coverage review come from simple rules, not a language model, and retrieval is keyword plus character similarity with no reranker. The quote check is real string matching, the rule MARA's summariser applies in code."
      onReset={reset}
      className="mara-demo"
    >
      <div className="mara-layout">
        <div className="mara-controls">
          <div className="demo-chips mara-presets" role="group" aria-labelledby={`${uid}-questions`}>
            <span className="demo-label mara-inline-label" id={`${uid}-questions`}>
              Question
            </span>
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="demo-chip"
                aria-pressed={question === preset.question}
                onClick={() => choose(preset.question)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <p className="mara-question">{question}</p>
          <div className="mara-actions">
            <button type="button" className="demo-btn" onClick={run}>
              {runLabel}
            </button>
            <button type="button" className="demo-btn is-ghost" onClick={nextStep} disabled={step >= LANES.length}>
              Next step
            </button>
            <p className="mara-status" aria-live="polite">
              {status}
            </p>
          </div>
        </div>

        <div className="mara-stage">
          <ol className="mara-lanes" aria-label="Agent trace">
            {LANES.map((lane, index) => {
              const done = step > index;
              const isNext = step === index;
              const expandable = done && index < 4;
              const isOpen = expandable && open === index;
              const state = done ? "Done" : isNext ? "Next" : "Waiting";
              const head = (
                <>
                  <span className="mara-lane-num">{String(index + 1).padStart(2, "0")}</span>
                  <span className="mara-lane-name">{lane}</span>
                  <span className="mara-lane-sum">{done ? laneSummary(index, trace) : "—"}</span>
                  <span className="mara-lane-state">{state}</span>
                </>
              );
              return (
                <li
                  key={lane}
                  className="mara-lane"
                  data-state={done ? "done" : isNext ? "next" : "waiting"}
                  data-open={isOpen || undefined}
                >
                  {expandable ? (
                    <button
                      type="button"
                      className="mara-lane-head"
                      aria-expanded={isOpen}
                      aria-controls={`${uid}-lane-${index}`}
                      onClick={() => setOpen(isOpen ? null : index)}
                    >
                      {head}
                    </button>
                  ) : (
                    <div className="mara-lane-head">{head}</div>
                  )}
                  {expandable && (
                    <div id={`${uid}-lane-${index}`} className="mara-lane-body" hidden={!isOpen}>
                      {isOpen && (
                        <motion.div key={`${question}-${index}`} {...revealMotion}>
                          {laneBody(index)}
                        </motion.div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          <div className="mara-output">
            <h4 className="demo-label">Writer · answer</h4>
            <div aria-live="polite">
              {step < LANES.length ? (
                <p className="mara-wait">The writer&apos;s answer appears here after step 5.</p>
              ) : (
                <motion.div key={question} {...revealMotion}>
                  {trace.answer.sentences.length ? (
                    <>
                      <p className="mara-answer">
                        {trace.answer.sentences.map((sentence) => (
                          <span key={sentence.text}>
                            {sentence.text} <span className="mara-cite">[{sentence.source}]</span>{" "}
                          </span>
                        ))}
                      </p>
                      {trace.answer.unanswered.length > 0 && (
                        <p className="mara-gap">
                          No verified evidence for{" "}
                          {trace.answer.unanswered.map((sub) => trace.plan.subQuestions[sub]).join(" or ")}
                        </p>
                      )}
                      <h4 className="demo-label mara-sources-label">Sources · quoted sentence marked</h4>
                      <ol className="mara-sources">
                        {trace.answer.sources.map((source) => (
                          <li key={source.chunkId}>
                            <span className="mara-source-head">
                              <span className="mara-cite">[{source.n}]</span> {chunkLabel(source.chunkId)}
                            </span>
                            <p>{markQuotes(CHUNKS.get(source.chunkId)?.text ?? "", source.quotes)}</p>
                          </li>
                        ))}
                      </ol>
                    </>
                  ) : (
                    <div className="mara-none">
                      <p>No evidence was found in the sample library for this question.</p>
                      <p className="mara-gap">
                        {trace.answer.missing.length
                          ? `No retrieved sentence mentions ${quoted(trace.answer.missing)}, so the writer gives no figure rather than guess.`
                          : "No note passed the quote check, so the writer gives no answer rather than guess."}
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
            <details className="mara-library">
              <summary>Sample library · 12 chunks written for this demo</summary>
              <ul>
                {LIBRARY.map((chunk) => (
                  <li key={chunk.id}>
                    <span className="demo-tag">{chunk.id}</span> <span className="mara-library-doc">{chunk.doc}</span>{" "}
                    {chunk.text}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </div>
      </div>
    </DemoFrame>
  );
}

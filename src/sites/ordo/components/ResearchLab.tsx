/* eslint-disable react-refresh/only-export-components -- the explainers' pure model is exported beside them so it can be tested */
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Minus,
  Pause,
  Play,
  RotateCcw,
  X,
  type LucideIcon,
} from "lucide-react";
import { memoryConversation, memoryStrategies } from "@/data/portfolio";
import { useMotionPaused } from "@/lib/motion-pause";
import "./research-lab.css";

/*
 * Interactive explainers for the two studies in the research proposal. Both
 * illustrate the proposed ideas with the proposal's own example and toy
 * numbers. Neither shows a measured result.
 */

/* ----------------------------------------------------------------- shared */

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Fixed decimals with a true minus sign, and never "−0.00". */
function num(value: number, digits = 2) {
  const text = Math.abs(value).toFixed(digits);
  return value < 0 && Number(text) !== 0 ? `−${text}` : text;
}

function signed(value: number, digits = 2) {
  const text = num(value, digits);
  return value > 0 && Number(text) !== 0 ? `+${text}` : text;
}

/** How much of a range track is filled, for its gradient. */
const fillStyle = (share: number) =>
  ({ "--rlab-fill": `${clamp(share, 0, 1) * 100}%` }) as CSSProperties;

/** The value once it stops changing, so a dragged slider is announced once rather than at every step. */
function useSettled<T>(value: T, delay = 450) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

/** No motion when the visitor prefers less of it, or has paused the page's animations. */
function useStill() {
  const reduced = useReducedMotion();
  const paused = useMotionPaused();
  return { still: Boolean(reduced) || paused, paused };
}

/* ---------------------------------------------- Study 01: the memory model */

export type StrategyId = "full" | "window" | "summary" | "adaptive";
export const STRATEGY_IDS: readonly StrategyId[] = ["full", "window", "summary", "adaptive"];

type Strategy = (typeof memoryStrategies)[number];
type Message = (typeof memoryConversation)[number];

function strategyById(id: StrategyId): Strategy {
  const found = memoryStrategies.find((item) => item.id === id);
  if (!found) throw new Error(`No "${id}" memory strategy in the portfolio data`);
  return found;
}

function messageById(id: number): Message {
  const found = memoryConversation.find((item) => item.id === id);
  if (!found) throw new Error(`No message #${id} in the example conversation`);
  return found;
}

export const LAST_TURN: number = memoryConversation.length;
/** Recent messages the window and adaptive strategies keep: six in the data's final turn. */
export const WINDOW_SIZE = strategyById("window").sends.length;
/** Recent messages the rolling summary keeps word for word: two in the data's final turn. */
export const SUMMARY_KEEPS = strategyById("summary").sends.length;

// The example's one revision: #3 ("Actually, it's for school students. Make it
// friendly.") sets the audience and replaces #1's formal tone.
const REVISION_TURN = 3;
const AUDIENCE_FROM = 3;
const AUDIENCE_PHRASE = "school students";
const OLD_TONE_FROM = 1;

/**
 * What the rolling summary keeps of each instruction once its message is
 * folded in. Joined, the parts give the data file's final summary, which also
 * loses #9's diagram request to compression.
 */
const SUMMARY_PARTS = [
  { from: 1, text: "Formal lesson on photosynthesis" },
  { from: 3, text: " for school students, friendly tone" },
  { from: 5, text: ", quiz" },
  { from: 7, text: ", metric units" },
];

export interface MemoryRecord {
  /** The data file's wording, e.g. "Audience: school students · active · from #3". */
  label: string;
  /** Message the record cites as its source ("from #3"). */
  from?: number;
  /** Message whose instruction the record marks as superseded ("replaces formal (#1)"). */
  supersedes?: number;
  /** First turn at which adaptive memory holds the record. */
  since: number;
}

const cited = (label: string, pattern: RegExp) => {
  const match = pattern.exec(label);
  return match ? Number(match[1]) : undefined;
};

/**
 * Adaptive memory's constraint records, worded exactly as in the data's final
 * turn. A revision is recorded as soon as it is made; any other constraint only
 * once the message that set it leaves the recent-message window.
 */
export const MEMORY_RECORDS: MemoryRecord[] = strategyById("adaptive").records.map((label) => {
  const from = cited(label, /from #(\d+)/);
  const supersedes = cited(label, /replaces [^(]*\(#(\d+)\)/);
  const since =
    supersedes !== undefined ? REVISION_TURN : from !== undefined ? from + WINDOW_SIZE : LAST_TURN;
  return { label, from, supersedes, since };
});

export interface MemoryContext {
  strategy: StrategyId;
  turn: number;
  /** Messages sent word for word, oldest first. */
  sent: number[];
  /** Older messages folded into the rolling summary. */
  summarised: number[];
  summary: string | null;
  records: MemoryRecord[];
}

export const clampTurn = (turn: number) => clamp(Math.round(turn), 1, LAST_TURN);

/** The rolling summary at a turn: everything older than the messages it keeps, compressed. */
export function summaryAt(turn: number): string | null {
  const folded = clampTurn(turn) - SUMMARY_KEEPS;
  const parts = SUMMARY_PARTS.filter((part) => part.from <= folded);
  return parts.length ? `${parts.map((part) => part.text).join("")}.` : null;
}

/** What a strategy would send at a turn, derived by rule from the conversation so far. */
export function memoryContext(strategy: StrategyId, turn: number): MemoryContext {
  const now = clampTurn(turn);
  const said: number[] = memoryConversation.map((message) => message.id).filter((id) => id <= now);
  const latest = (count: number) => said.slice(Math.max(0, said.length - count));
  const context: MemoryContext = {
    strategy,
    turn: now,
    sent: said,
    summarised: [],
    summary: null,
    records: [],
  };
  if (strategy === "window") context.sent = latest(WINDOW_SIZE);
  if (strategy === "summary") {
    context.sent = latest(SUMMARY_KEEPS);
    context.summarised = said.filter((id) => !context.sent.includes(id));
    context.summary = summaryAt(now);
  }
  if (strategy === "adaptive") {
    context.sent = latest(WINDOW_SIZE);
    context.records = MEMORY_RECORDS.filter((record) => record.since <= now);
  }
  return context;
}

export type LineKind = "summary" | "record" | "user" | "assistant";

export interface PromptLine {
  /** Stable across turns and strategies, so a line keeps its identity while it moves. */
  key: string;
  kind: LineKind;
  text: string;
  /** Source message, for conversation lines. */
  ref?: number;
}

/** The prompt in the order it would be assembled: memory first, then recent messages. */
export function promptLines(context: MemoryContext): PromptLine[] {
  const lines: PromptLine[] = [];
  if (context.summary) lines.push({ key: "summary", kind: "summary", text: context.summary });
  context.records.forEach((record) =>
    lines.push({ key: `record ${record.label}`, kind: "record", text: record.label }),
  );
  context.sent.forEach((id) => {
    const message = messageById(id);
    lines.push({ key: `message ${id}`, kind: message.role, text: message.text, ref: id });
  });
  return lines;
}

/** Rough prompt size: about four characters per token. */
export const estimateTokens = (text: string) => Math.ceil(text.length / 4);
export const promptText = (lines: PromptLine[]) => lines.map((line) => line.text).join("\n");

export type CheckState = "pass" | "fail" | "pending";

export interface MemoryCheck {
  state: CheckState;
  /** Compact wording for the strategy row. */
  text: string;
  /** The same result as a sentence, for screen readers. */
  spoken: string;
}

/** "Knows the audience is school students (#3)?", judged from the text actually sent. */
export function audienceCheck(context: MemoryContext): MemoryCheck {
  if (context.turn < AUDIENCE_FROM)
    return {
      state: "pending",
      text: "Audience not stated yet",
      spoken: `The audience is not stated until message ${AUDIENCE_FROM}`,
    };
  const carrier = promptLines(context).find((line) => line.text.includes(AUDIENCE_PHRASE));
  if (!carrier)
    return {
      state: "fail",
      text: `Audience unknown · #${AUDIENCE_FROM} not sent`,
      spoken: `It does not know the audience: message ${AUDIENCE_FROM} is not sent`,
    };
  if (carrier.kind === "summary")
    return {
      state: "pass",
      text: "Audience known · in summary",
      spoken: "It knows the audience from the summary",
    };
  if (carrier.kind === "record")
    return {
      state: "pass",
      text: `Audience known · record from #${AUDIENCE_FROM}`,
      spoken: `It knows the audience from a record of message ${AUDIENCE_FROM}`,
    };
  return {
    state: "pass",
    text: `Audience known · #${carrier.ref} sent`,
    spoken: `It knows the audience: message ${carrier.ref} is sent`,
  };
}

/** "Old 'formal tone' instruction cleared or marked superseded?", judged from the text actually sent. */
export function toneCheck(context: MemoryContext): MemoryCheck {
  if (context.turn < REVISION_TURN)
    return {
      state: "pending",
      text: "Tone not revised yet",
      spoken: `The tone is not revised until message ${REVISION_TURN}`,
    };
  const lines = promptLines(context);
  const saysFormal = (line: PromptLine) => /formal/i.test(line.text);
  if (lines.some((line) => line.kind === "record" && /replaces formal/i.test(line.text)))
    return {
      state: "pass",
      text: "Old tone marked superseded",
      spoken: "A record marks the old formal tone as superseded",
    };
  // Assistant replies only report what was done; the instruction itself is a user message.
  const instruction = lines.find((line) => line.kind === "user" && saysFormal(line));
  if (instruction)
    return {
      state: "fail",
      text: `Old tone still sent · #${instruction.ref} unmarked`,
      spoken: `The old formal tone is still sent, unmarked, in message ${instruction.ref}`,
    };
  if (lines.some((line) => line.kind === "summary" && saysFormal(line)))
    return {
      state: "fail",
      text: "Old tone kept · summary says formal",
      spoken: "The summary still says formal",
    };
  return {
    state: "pass",
    text: `Old tone cleared · #${OLD_TONE_FROM} not sent`,
    spoken: `The old formal tone is cleared: message ${OLD_TONE_FROM} is not sent`,
  };
}

export type CellState = "future" | "sent" | "summarised" | "dropped";

export interface ContextCell {
  id: number;
  state: CellState;
  /** A record cites this message as its source. */
  recorded: boolean;
  /** A record marks this message's instruction as superseded. */
  superseded: boolean;
}

export function contextCells(context: MemoryContext): ContextCell[] {
  return memoryConversation.map(({ id }) => {
    let state: CellState = "dropped";
    if (id > context.turn) state = "future";
    else if (context.sent.includes(id)) state = "sent";
    else if (context.summarised.includes(id)) state = "summarised";
    return {
      id,
      state,
      recorded: context.records.some((record) => record.from === id),
      superseded: context.records.some((record) => record.supersedes === id),
    };
  });
}

export interface MemoryView {
  id: StrategyId;
  name: string;
  note: string;
  context: MemoryContext;
  lines: PromptLine[];
  tokens: number;
  cells: ContextCell[];
  audience: MemoryCheck;
  tone: MemoryCheck;
}

export function memoryView(id: StrategyId, turn: number): MemoryView {
  const { name, note } = strategyById(id);
  const context = memoryContext(id, turn);
  const lines = promptLines(context);
  return {
    id,
    name,
    note,
    context,
    lines,
    tokens: estimateTokens(promptText(lines)),
    cells: contextCells(context),
    audience: audienceCheck(context),
    tone: toneCheck(context),
  };
}

/** "6 messages + 3 records", for the row. */
export function sentCount(context: MemoryContext) {
  return [
    plural(context.sent.length, "message"),
    context.summary ? "summary" : "",
    context.records.length ? plural(context.records.length, "record") : "",
  ]
    .filter(Boolean)
    .join(" + ");
}

function spokenSent(context: MemoryContext) {
  const { sent } = context;
  const first = sent[0];
  const last = sent[sent.length - 1];
  const messages =
    sent.length === 1
      ? `message ${first}`
      : sent.length === 2
        ? `messages ${first} and ${last}`
        : `messages ${first} to ${last}`;
  const extras = [
    context.summary ? "a summary" : "",
    context.records.length ? plural(context.records.length, "record") : "",
  ].filter(Boolean);
  return extras.length ? `${messages} plus ${extras.join(" and ")}` : messages;
}

/** One strategy at one turn, in plain sentences for the live region. */
export function describeMemoryTurn(view: MemoryView) {
  const message = messageById(view.context.turn);
  return [
    `Turn ${view.context.turn} of ${LAST_TURN}. ${capitalise(message.role)}: ${message.text}`,
    `${view.name} sends ${spokenSent(view.context)}, about ${view.tokens} tokens.`,
    `${view.audience.spoken}.`,
    `${view.tone.spoken}.`,
  ].join(" ");
}

/** The longest prompt in the example, so every bar shares one scale. */
const FULL_TOKENS = memoryView("full", LAST_TURN).tokens;

/* --------------------------------------------------- Study 01: the explainer */

const PLAY_STEP_MS = 1200;

/** What each user message changes, so the scrubber's story reads on its own. */
const MESSAGE_NOTES: Partial<Record<number, string>> = {
  1: "Sets the task and a formal tone.",
  3: "Sets the audience and replaces the formal tone.",
  5: "Adds a quiz.",
  7: "Adds metric units.",
  9: "Asks for a diagram description.",
  11: "Asks for the full chapter.",
};

const STRATEGY_RULES: Record<StrategyId, string> = {
  full: "Rule: send every message so far.",
  window: `Rule: send the latest ${WINDOW_SIZE} messages and drop the rest.`,
  summary: `Rule: send the latest ${SUMMARY_KEEPS} messages and fold older ones into one summary line.`,
  adaptive: `Rule: send the latest ${WINDOW_SIZE} messages plus constraint records. A revision is recorded when it is made; any other constraint once its message leaves the window.`,
};

const CHECK_ICONS: Record<CheckState, LucideIcon> = { pass: Check, fail: X, pending: Minus };

function CheckLine({ check }: { check: MemoryCheck }) {
  const Icon = CHECK_ICONS[check.state];
  return (
    <span className="rlab-check" data-state={check.state}>
      <span className="rlab-check-mark" aria-hidden="true">
        <Icon size={10} strokeWidth={2.5} />
      </span>
      <span aria-hidden="true">{check.text}</span>
      <span className="rlab-sr">{check.spoken}.</span>
    </span>
  );
}

function StrategyRow({
  view,
  selected,
  onSelect,
}: {
  view: MemoryView;
  selected: boolean;
  onSelect: () => void;
}) {
  const uid = useId();
  const { sent } = view.context;
  // The frame around the messages sent word for word; it slides as the window moves.
  const frame = {
    "--rlab-cols": view.cells.length,
    "--rlab-from": sent[0] - 1,
    "--rlab-count": sent.length,
  } as CSSProperties;
  return (
    <li>
      <button
        type="button"
        className="rlab-row"
        aria-pressed={selected}
        aria-labelledby={`${uid}-name`}
        aria-describedby={`${uid}-sent ${uid}-checks`}
        onClick={onSelect}
      >
        <span className="rlab-row-head">
          <span id={`${uid}-name`} className="rlab-row-name">
            {view.name}
          </span>
          <span className="rlab-row-tag" aria-hidden="true">
            {selected ? "Viewing" : "View"}
          </span>
        </span>
        <span className="rlab-row-meta">
          <span aria-hidden="true">{sentCount(view.context)}</span>
          <span aria-hidden="true" className="rlab-row-tokens">
            ≈ {view.tokens} tok
          </span>
          <span id={`${uid}-sent`} className="rlab-sr">
            Sends {spokenSent(view.context)}, about {view.tokens} tokens.
          </span>
        </span>
        <span className="rlab-cells" style={frame} aria-hidden="true">
          {view.cells.map((cell) => (
            <span
              key={cell.id}
              className="rlab-cell"
              data-state={cell.state}
              data-recorded={cell.recorded || undefined}
              data-superseded={cell.superseded || undefined}
            >
              {cell.id}
            </span>
          ))}
          <span className="rlab-window" />
        </span>
        <span className="rlab-bar" aria-hidden="true">
          <span style={{ transform: `scaleX(${Math.min(1, view.tokens / FULL_TOKENS)})` }} />
        </span>
        <span id={`${uid}-checks`} className="rlab-checks">
          <CheckLine check={view.audience} />
          <CheckLine check={view.tone} />
        </span>
      </button>
    </li>
  );
}

/** "Audience: school students · active · from #3", with its status set apart. */
function RecordText({ label }: { label: string }) {
  const [value, status, ...source] = label.split(" · ");
  if (!status) return <>{label}</>;
  return (
    <>
      {value}
      {" · "}
      <span className="rlab-status">{status}</span>
      {source.length > 0 && (
        <>
          {" · "}
          <span className="rlab-source">{source.join(" · ")}</span>
        </>
      )}
    </>
  );
}

function Transcript({ view, still }: { view: MemoryView; still: boolean }) {
  const uid = useId();
  const { context } = view;
  const unsent = memoryConversation
    .map((message) => message.id)
    .filter((id) => id <= context.turn && !context.sent.includes(id));
  const span = unsent.length === 1 ? `#${unsent[0]}` : `#${unsent[0]}–#${unsent[unsent.length - 1]}`;
  return (
    <figure className="rlab-transcript" aria-labelledby={`${uid}-caption`}>
      <figcaption id={`${uid}-caption`}>
        <span>What the model would see</span>
        <span>
          {view.name} · turn {context.turn} · ≈ {view.tokens} tokens
        </span>
      </figcaption>
      {unsent.length > 0 && (
        <p className="rlab-omitted">
          {context.summarised.length ? "Folded into the summary" : "Not sent"}: {span}
        </p>
      )}
      <ol className="rlab-lines">
        {view.lines.map((line) => (
          <motion.li
            key={line.key}
            className={`rlab-line is-${line.kind}`}
            layout={still ? false : "position"}
            initial={still ? false : { opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: still ? 0 : 0.32, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <span className="rlab-line-tag">{line.ref ? `#${line.ref} ${line.kind}` : line.kind}</span>
            <span className="rlab-line-text">
              {line.kind === "record" ? <RecordText label={line.text} /> : line.text}
            </span>
          </motion.li>
        ))}
      </ol>
      <div className="rlab-rule">
        <p>{STRATEGY_RULES[view.id]}</p>
        {context.turn === LAST_TURN && (
          <p>
            At turn {LAST_TURN}: {view.note}
          </p>
        )}
      </div>
    </figure>
  );
}

/** Study 01: which messages each memory strategy would send, turn by turn. */
export function MemoryLab() {
  const uid = useId();
  const { still, paused } = useStill();
  const [turn, setTurn] = useState(LAST_TURN);
  const [selected, setSelected] = useState<StrategyId>("adaptive");
  const [playing, setPlaying] = useState(false);

  const views = useMemo(() => STRATEGY_IDS.map((id) => memoryView(id, turn)), [turn]);
  const view = views.find((item) => item.id === selected) ?? views[0];
  const latest = messageById(turn);
  const note = MESSAGE_NOTES[latest.id];

  useEffect(() => {
    if (!playing) return;
    // The page-wide pause stops playback, as does reaching the last turn.
    if (paused || turn >= LAST_TURN) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setTurn((value) => Math.min(LAST_TURN, value + 1)), PLAY_STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, paused, turn]);

  const goTo = (next: number) => {
    setPlaying(false);
    setTurn(clampTurn(next));
  };
  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (turn >= LAST_TURN) setTurn(1);
    setPlaying(true);
  };

  // While playing, keep announcements short enough to finish before the next turn.
  const live = useSettled(
    playing ? `Turn ${turn} of ${LAST_TURN}. ${latest.text}` : describeMemoryTurn(view),
  );

  return (
    <section
      className="rlab-lab rlab-memory"
      aria-labelledby={`${uid}-title`}
      data-still={still || undefined}
    >
      <div className="rlab-kicker">
        <span>Study 01 · Try it</span>
        <span>
          Turn {String(turn).padStart(2, "0")} / {LAST_TURN}
        </span>
      </div>
      <div className="rlab-head">
        <h4 id={`${uid}-title`}>What each memory strategy would send</h4>
        <p>
          Step through the proposal's example conversation. Each row shows which messages a
          strategy would send at that turn and roughly how large the prompt would be. Choose a row
          to read the prompt itself.
        </p>
      </div>

      <div className="rlab-body">
        <div className="rlab-controls">
          <div className="rlab-transport">
            <button
              type="button"
              className="rlab-btn"
              onClick={() => goTo(turn - 1)}
              disabled={turn <= 1}
              aria-label="Previous turn"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="rlab-btn is-primary"
              onClick={togglePlay}
              disabled={paused}
              aria-label={playing ? "Pause the conversation" : "Play the conversation"}
            >
              {playing ? <Pause size={13} aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
              <span aria-hidden="true">{playing ? "Pause" : "Play"}</span>
            </button>
            <button
              type="button"
              className="rlab-btn"
              onClick={() => goTo(turn + 1)}
              disabled={turn >= LAST_TURN}
              aria-label="Next turn"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="rlab-scrub">
            <label htmlFor={`${uid}-turn`} className="rlab-label">
              Turn
            </label>
            <input
              id={`${uid}-turn`}
              className="rlab-range"
              type="range"
              min={1}
              max={LAST_TURN}
              step={1}
              value={turn}
              onChange={(event) => goTo(Number(event.target.value))}
              aria-valuetext={`Turn ${turn} of ${LAST_TURN}`}
              style={fillStyle((turn - 1) / (LAST_TURN - 1))}
            />
          </div>
        </div>
        {paused && (
          <p className="rlab-hint">
            Autoplay is off while the page's animations are paused. Use the arrows or the slider.
          </p>
        )}

        <p className="rlab-latest">
          <span className="rlab-latest-tag">
            #{latest.id} · {latest.role}
          </span>
          <span className="rlab-latest-text">“{latest.text}”</span>
          {note && <span className="rlab-latest-note">{note}</span>}
        </p>

        <div className="rlab-memory-main">
          <div className="rlab-memory-rows">
            <ul className="rlab-legend" aria-hidden="true">
              <li>
                <i className="rlab-cell" data-state="sent" /> Sent
              </li>
              <li>
                <i className="rlab-cell" data-state="summarised" /> In the summary
              </li>
              <li>
                <i className="rlab-cell" data-state="dropped" /> Not sent
              </li>
              <li>
                <i className="rlab-cell" data-state="dropped" data-recorded /> Kept as a record
              </li>
              <li>
                <i className="rlab-cell" data-state="dropped" data-superseded /> Marked superseded
              </li>
              <li>
                <i className="rlab-cell" data-state="future" /> Not said yet
              </li>
              <li>
                <i className="rlab-swatch" /> ≈ tokens, characters ÷ 4
              </li>
            </ul>
            <div className="rlab-checks-key">
              <span className="rlab-label">Checks at this turn</span>
              <ul>
                <li>Knows the audience is school students (#3)?</li>
                <li>Old “formal tone” instruction cleared or marked superseded?</li>
              </ul>
            </div>
            <ul className="rlab-rows" aria-label="Memory strategies">
              {views.map((item) => (
                <StrategyRow
                  key={item.id}
                  view={item}
                  selected={item.id === selected}
                  onSelect={() => setSelected(item.id)}
                />
              ))}
            </ul>
          </div>
          <Transcript view={view} still={still} />
        </div>
      </div>

      <p className="rlab-honesty">
        Illustration with the proposal's own example, not a measured result. Token counts are a
        rough rule of thumb. Whether adaptive memory pays for itself is what the study will test.
      </p>
      <p className="rlab-sr" aria-live="polite">
        {live}
      </p>
    </section>
  );
}

/* ----------------------------------------------- Study 02: the retry model */

export interface RetryEstimates {
  /** Chance the first, low-budget answer is right. */
  c: number;
  /** Chance a retry fixes a wrong answer. */
  f: number;
  /** Chance a retry breaks a right answer. */
  b: number;
  /** Retry cost, as a share of one correct answer's value. */
  k: number;
}

/** Expected change in right answers from one retry: wrong ones fixed minus right ones broken. */
export const netImprovement = (c: number, f: number, b: number) => (1 - c) * f - c * b;

/** The proposal's rule: retry only when the net improvement beats the cost. A tie returns. */
export const shouldRetry = ({ c, f, b, k }: RetryEstimates) =>
  // The margin keeps floating-point noise from turning an exact tie into a retry.
  netImprovement(c, f, b) - k > 1e-9;

/** The chance of fixing above which a retry pays, for a given c. */
export const boundaryF = (c: number, b: number, k: number) =>
  c >= 1 ? Infinity : (k + c * b) / (1 - c);

/**
 * The Retry region of the (c, f) square as a polygon: the boundary curve from
 * c = 0 to where it reaches f = 1, closed along the top edge. Empty when no
 * retry could pay.
 */
export function retryRegion(b: number, k: number, steps = 40): [number, number][] {
  if (k >= 1) return [];
  const edge = (1 - k) / (1 + b);
  const curve = Array.from({ length: steps + 1 }, (_, index): [number, number] => {
    const c = (edge * index) / steps;
    return [c, Math.min(1, boundaryF(c, b, k))];
  });
  return [...curve, [0, 1]];
}

export interface ToyQuestion {
  id: number;
  label: string;
  /** Made-up estimate of the chance the first answer is right. */
  c: number;
  /** Made-up estimate of the chance a retry fixes a wrong answer. */
  f: number;
}

/** Made-up questions with made-up estimates. They illustrate the rule; they are not data. */
export const TOY_QUEUE: readonly ToyQuestion[] = [
  { id: 1, label: "Add two invoice totals", c: 0.95, f: 0.3 },
  { id: 2, label: "Percentage change in revenue", c: 0.85, f: 0.45 },
  { id: 3, label: "Compound interest over five years", c: 0.5, f: 0.62 },
  { id: 4, label: "Current ratio from a balance sheet", c: 0.62, f: 0.5 },
  { id: 5, label: "Convert a price through two currencies", c: 0.4, f: 0.6 },
  { id: 6, label: "Year-on-year growth from a table", c: 0.78, f: 0.3 },
  { id: 7, label: "Monthly repayment on a loan", c: 0.3, f: 0.5 },
  { id: 8, label: "Unit price from a receipt", c: 0.9, f: 0.2 },
  { id: 9, label: "Weighted average share price", c: 0.5, f: 0.22 },
  { id: 10, label: "Net present value of three cash flows", c: 0.2, f: 0.35 },
];

export type RetryPolicy = "never" | "rule" | "always";

export interface PolicyOutcome {
  retries: number;
  /** Total retry cost, in units of one correct answer's value. */
  spend: number;
  /** Expected wrong answers that a retry fixes. */
  fixed: number;
  /** Expected right answers that a retry breaks. */
  broken: number;
  /** Expected right answers after the policy. */
  right: number;
  /** Fixed minus broken minus spend: the value gained over never retrying. */
  net: number;
}

/** A policy's expected outcome on a queue, taking each question's estimates as exact. */
export function queueOutcome(
  queue: readonly ToyQuestion[],
  b: number,
  k: number,
  policy: RetryPolicy,
): PolicyOutcome {
  const retried = queue.filter(
    (question) =>
      policy === "always" ||
      (policy === "rule" && shouldRetry({ c: question.c, f: question.f, b, k })),
  );
  const fixed = sum(retried.map((question) => (1 - question.c) * question.f));
  const broken = sum(retried.map((question) => question.c * b));
  const spend = retried.length * k;
  return {
    retries: retried.length,
    spend,
    fixed,
    broken,
    right: sum(queue.map((question) => question.c)) + fixed - broken,
    net: fixed - broken - spend,
  };
}

/* ------------------------------------------------ Study 02: the explainer */

type Hundredths = Record<keyof RetryEstimates, number>;

/** Starts just inside Return, so a small move shows the decision flip. */
const RETRY_START: Hundredths = { c: 70, f: 40, b: 5, k: 10 };

const RETRY_SLIDERS: { key: keyof RetryEstimates; label: string; max: number }[] = [
  { key: "c", label: "Chance the first answer is right", max: 100 },
  { key: "f", label: "Chance a retry fixes a wrong answer", max: 100 },
  { key: "b", label: "Chance a retry breaks a right answer", max: 50 },
  { key: "k", label: "Retry cost, as a share of one correct answer's value", max: 50 },
];

const POLICY_ROWS: [RetryPolicy, string][] = [
  ["never", "Never retry"],
  ["rule", "This rule"],
  ["always", "Always retry"],
];

// Decision map geometry, in SVG units: a square plot with room for axis labels.
const MAP_LEFT = 30;
const MAP_TOP = 8;
const MAP_PLOT = 208;
const MAP_W = MAP_LEFT + MAP_PLOT + 12;
const MAP_H = MAP_TOP + MAP_PLOT + 34;
const mapX = (c: number) => MAP_LEFT + c * MAP_PLOT;
const mapY = (f: number) => MAP_TOP + (1 - f) * MAP_PLOT;
const toPath = (points: [number, number][], close = false) =>
  points.length
    ? `M${points.map(([c, f]) => `${mapX(c).toFixed(1)} ${mapY(f).toFixed(1)}`).join("L")}${close ? "Z" : ""}`
    : "";
const TICKS = [0, 0.25, 0.5, 0.75, 1];

function DecisionMap({
  c,
  f,
  b,
  k,
  retry,
  retryCount,
  onPick,
}: {
  c: number;
  f: number;
  b: number;
  k: number;
  retry: boolean;
  retryCount: number;
  onPick: (c: number, f: number) => void;
}) {
  // useId's colons are awkward inside url(#…), so strip them for the pattern id.
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const region = useMemo(() => retryRegion(b, k), [b, k]);
  const inRetry = (pc: number, pf: number) => shouldRetry({ c: pc, f: pf, b, k });

  const pick = (event: { clientX: number; clientY: number }) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return;
    const x = ((event.clientX - rect.left) / rect.width) * MAP_W;
    const y = ((event.clientY - rect.top) / rect.height) * MAP_H;
    onPick(clamp((x - MAP_LEFT) / MAP_PLOT, 0, 1), clamp(1 - (y - MAP_TOP) / MAP_PLOT, 0, 1));
  };

  const px = mapX(c);
  const py = mapY(f);
  const tagLeft = c > 0.6;
  return (
    <figure className="rlab-mapwrap" aria-labelledby={`${uid}-caption`}>
      <figcaption id={`${uid}-caption`} className="rlab-label">
        Decision map · b = {num(b)} · k = {num(k)}
      </figcaption>
      <svg
        ref={svgRef}
        className="rlab-map"
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        role="img"
        aria-labelledby={`${uid}-title`}
        aria-describedby={`${uid}-desc`}
        // Mouse and pen can drag the point; touch only taps (via click), so the page still scrolls.
        onPointerDown={(event) => {
          if (event.pointerType === "touch") return;
          event.currentTarget.setPointerCapture(event.pointerId);
          pick(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture?.(event.pointerId)) pick(event);
        }}
        onClick={pick}
      >
        <title id={`${uid}-title`}>Decision map</title>
        <desc id={`${uid}-desc`}>
          {`Across: c, the chance the first answer is right. Up: f, the chance a retry fixes a wrong answer. Retry wherever (1 − c) × f − c × b is above k, which is the area above the curve. This answer, at c ${num(c)} and f ${num(f)}, is in the ${retry ? "Retry" : "Return"} area. ${retryCount} of ${TOY_QUEUE.length} toy questions are in the Retry area.`}
        </desc>
        <defs>
          <pattern
            id={`${uid}-hatch`}
            width="5"
            height="5"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="5" className="rlab-map-hatch" />
          </pattern>
        </defs>
        {TICKS.map((tick) => (
          <g key={tick}>
            <line x1={mapX(tick)} x2={mapX(tick)} y1={MAP_TOP} y2={MAP_TOP + MAP_PLOT} className="rlab-map-grid" />
            <line x1={MAP_LEFT} x2={MAP_LEFT + MAP_PLOT} y1={mapY(tick)} y2={mapY(tick)} className="rlab-map-grid" />
          </g>
        ))}
        {region.length > 0 && (
          <>
            <path d={toPath(region, true)} className="rlab-map-region" />
            <path d={toPath(region, true)} fill={`url(#${uid}-hatch)`} />
            <path d={toPath(region.slice(0, -1))} className="rlab-map-boundary" />
          </>
        )}
        <rect x={MAP_LEFT} y={MAP_TOP} width={MAP_PLOT} height={MAP_PLOT} className="rlab-map-frame" />
        {inRetry(0.04, 0.95) && (
          <text x={mapX(0.04)} y={mapY(0.94)} className="rlab-map-zone">
            RETRY
          </text>
        )}
        {!inRetry(0.96, 0.05) && (
          <text x={mapX(0.96)} y={mapY(0.04)} textAnchor="end" className="rlab-map-zone">
            RETURN
          </text>
        )}
        {TOY_QUEUE.map((question) => {
          const x = mapX(question.c);
          const y = mapY(question.f);
          return (
            <g
              key={question.id}
              className={`rlab-map-q${inRetry(question.c, question.f) ? " is-retry" : ""}`}
            >
              <rect x={x - 3} y={y - 3} width="6" height="6" />
              <text x={x + 5} y={y + 2.6}>
                {question.id}
              </text>
            </g>
          );
        })}
        <g className="rlab-map-point">
          <line x1={MAP_LEFT} x2={px} y1={py} y2={py} className="rlab-map-guide" />
          <line x1={px} x2={px} y1={py} y2={MAP_TOP + MAP_PLOT} className="rlab-map-guide" />
          <circle cx={px} cy={py} r="5.5" className="rlab-map-ring" />
          <circle cx={px} cy={py} r="1.8" className="rlab-map-core" />
          <text
            x={tagLeft ? px - 8 : px + 8}
            y={f > 0.9 ? py + 12 : py - 7}
            textAnchor={tagLeft ? "end" : "start"}
            className="rlab-map-tag"
          >
            this answer
          </text>
        </g>
        {[0, 0.5, 1].map((tick) => (
          <g key={tick} className="rlab-map-tick">
            <text x={mapX(tick)} y={MAP_TOP + MAP_PLOT + 11} textAnchor="middle">
              {tick}
            </text>
            <text x={MAP_LEFT - 4} y={mapY(tick) + 2.6} textAnchor="end">
              {tick}
            </text>
          </g>
        ))}
        <text x={MAP_LEFT + MAP_PLOT / 2} y={MAP_H - 4} textAnchor="middle" className="rlab-map-axis">
          c · first answer right →
        </text>
        <text
          x={-(MAP_TOP + MAP_PLOT / 2)}
          y={9}
          transform="rotate(-90)"
          textAnchor="middle"
          className="rlab-map-axis"
        >
          f · retry fixes a wrong one →
        </text>
      </svg>
      <p className="rlab-hint">
        Tap or drag on the map to move this answer. Numbered squares are the toy questions; filled
        ones would retry.
      </p>
    </figure>
  );
}

function TradeOff({ outcomes }: { outcomes: Record<RetryPolicy, PolicyOutcome> }) {
  const rows = POLICY_ROWS.map(([key, label]) => ({
    key,
    label,
    gain: Math.max(0, outcomes[key].fixed - outcomes[key].broken),
    spend: outcomes[key].spend,
  }));
  const scale = Math.max(0.01, ...rows.flatMap((row) => [row.gain, row.spend]));
  return (
    <div className="rlab-trade" aria-hidden="true">
      <div className="rlab-trade-key">
        <span>
          <i className="rlab-trade-swatch is-gain" /> Expected gain, fixed − broken
        </span>
        <span>
          <i className="rlab-trade-swatch is-spend" /> Retry spend
        </span>
      </div>
      {rows.map((row) => (
        <div key={row.key} className="rlab-trade-row" data-policy={row.key}>
          <span>{row.label}</span>
          <span className="rlab-trade-bars">
            <span className="rlab-trade-bar is-gain">
              <i style={{ transform: `scaleX(${row.gain / scale})` }} />
            </span>
            <span className="rlab-trade-bar is-spend">
              <i style={{ transform: `scaleX(${row.spend / scale})` }} />
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Study 02: the calibrated retry rule, worked through with live numbers. */
export function RetryLab() {
  const uid = useId();
  const { still } = useStill();
  const [values, setValues] = useState<Hundredths>(RETRY_START);
  const c = values.c / 100;
  const f = values.f / 100;
  const b = values.b / 100;
  const k = values.k / 100;
  const fixedPart = (1 - c) * f;
  const brokenPart = c * b;
  const net = netImprovement(c, f, b);
  const retry = shouldRetry({ c, f, b, k });
  const verdict = retry ? "Retry" : "Return";

  const outcomes = useMemo<Record<RetryPolicy, PolicyOutcome>>(
    () => ({
      never: queueOutcome(TOY_QUEUE, b, k, "never"),
      rule: queueOutcome(TOY_QUEUE, b, k, "rule"),
      always: queueOutcome(TOY_QUEUE, b, k, "always"),
    }),
    [b, k],
  );

  const setValue = (key: keyof RetryEstimates, value: number) =>
    setValues((current) => ({ ...current, [key]: value }));
  const setPoint = (nextC: number, nextF: number) =>
    setValues((current) => ({ ...current, c: Math.round(nextC * 100), f: Math.round(nextF * 100) }));

  const live = useSettled(
    `${verdict}. Net improvement ${num(net, 3)} is ${retry ? "above" : "not above"} the retry cost ${num(k)}. The rule retries ${outcomes.rule.retries} of ${TOY_QUEUE.length} toy questions.`,
  );

  return (
    <section
      className="rlab-lab rlab-retry"
      aria-labelledby={`${uid}-title`}
      data-still={still || undefined}
    >
      <div className="rlab-kicker">
        <span>Study 02 · Try it</span>
        <span>Toy numbers</span>
      </div>
      <div className="rlab-head">
        <h4 id={`${uid}-title`}>Return the answer, or pay for one retry?</h4>
        <p>
          After a low-budget answer, the rule estimates how likely one retry is to improve it and
          what that retry costs, then retries only when the expected improvement is larger. Move the
          estimates to see the decision change.
        </p>
      </div>

      <div className="rlab-body rlab-retry-top">
        <div className="rlab-retry-inputs">
          <div className="rlab-sliders">
            {RETRY_SLIDERS.map((slider) => {
              const id = `${uid}-${slider.key}`;
              const value = values[slider.key];
              return (
                <div key={slider.key} className="rlab-slider">
                  <div className="rlab-slider-head">
                    <label htmlFor={id} className="rlab-slider-label">
                      <span className="rlab-symbol">{slider.key}</span>
                      <span className="rlab-sr">, </span>
                      {slider.label}
                    </label>
                    <span className="rlab-value" aria-hidden="true">
                      {num(value / 100)}
                    </span>
                  </div>
                  <input
                    id={id}
                    className="rlab-range"
                    type="range"
                    min={0}
                    max={slider.max}
                    step={1}
                    value={value}
                    onChange={(event) => setValue(slider.key, Number(event.target.value))}
                    aria-valuetext={num(value / 100)}
                    style={fillStyle(value / slider.max)}
                  />
                </div>
              );
            })}
          </div>
          <button type="button" className="rlab-btn" onClick={() => setValues(RETRY_START)}>
            <RotateCcw size={13} aria-hidden="true" /> Reset
          </button>
        </div>

        <div className="rlab-retry-result">
          <div className="rlab-equation" role="group" aria-label="Worked equation">
            <span className="rlab-label">Net improvement</span>
            <p className="rlab-eq-formula">(1 − c) × f − c × b</p>
            <p>
              = (1 − {num(c)}) × {num(f)} − {num(c)} × {num(b)}
            </p>
            <p className="rlab-eq-terms">
              <span className="rlab-eq-op">=</span>
              <span>
                <b>{num(fixedPart, 3)}</b>
                <small>wrong answers fixed</small>
              </span>
              <span className="rlab-eq-op">−</span>
              <span>
                <b>{num(brokenPart, 3)}</b>
                <small>right answers broken</small>
              </span>
              <span className="rlab-eq-op">=</span>
              <span>
                <b>{num(net, 3)}</b>
                <small>net improvement</small>
              </span>
            </p>
            <p className="rlab-eq-compare">
              Retry if {num(net, 3)} &gt; k = {num(k)}: <strong>{retry ? "yes" : "no"}</strong>
            </p>
          </div>
          <div
            className="rlab-verdict"
            data-verdict={retry ? "retry" : "return"}
            role="group"
            aria-label="Decision"
          >
            <span className="rlab-label">Decision</span>
            <strong key={verdict} className={still ? undefined : "is-fresh"}>
              {verdict}
            </strong>
            <p>
              {retry
                ? `The expected improvement (${num(net, 3)}) is larger than the retry cost (${num(k)}).`
                : `The expected improvement (${num(net, 3)}) does not beat the retry cost (${num(k)}).`}
            </p>
          </div>
        </div>

        <DecisionMap
          c={c}
          f={f}
          b={b}
          k={k}
          retry={retry}
          retryCount={outcomes.rule.retries}
          onPick={setPoint}
        />
      </div>

      <div className="rlab-body rlab-retry-queue">
        <div>
          <span className="rlab-label">Toy queue · made-up questions and estimates</span>
          <p className="rlab-hint">
            Each question has its own c and f; b and k come from the sliders. Choose one to load it
            into the equation.
          </p>
          <ol className="rlab-queue">
            {TOY_QUEUE.map((question) => {
              const willRetry = shouldRetry({ c: question.c, f: question.f, b, k });
              const loaded =
                values.c === Math.round(question.c * 100) && values.f === Math.round(question.f * 100);
              return (
                <li key={question.id}>
                  <button
                    type="button"
                    className="rlab-q"
                    aria-pressed={loaded}
                    onClick={() => setPoint(question.c, question.f)}
                  >
                    <span className="rlab-q-id">Q{question.id}</span>{" "}
                    <span className="rlab-q-label">{question.label}</span>{" "}
                    <span className="rlab-q-nums">
                      c {num(question.c)} · f {num(question.f)} · net{" "}
                      {num(netImprovement(question.c, question.f, b), 3)}
                    </span>{" "}
                    <span className="rlab-q-verdict" data-verdict={willRetry ? "retry" : "return"}>
                      <i aria-hidden="true" />
                      {willRetry ? "Retry" : "Return"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
        <div>
          <div className="rlab-tablewrap">
            <table className="rlab-totals">
              <caption>
                Toy queue totals, with b = {num(b)} and k = {num(k)}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Policy</th>
                  <th scope="col">Retries</th>
                  <th scope="col">Spend</th>
                  <th scope="col">Fixed</th>
                  <th scope="col">Broken</th>
                  <th scope="col">Net</th>
                </tr>
              </thead>
              <tbody>
                {POLICY_ROWS.map(([key, label]) => {
                  const outcome = outcomes[key];
                  return (
                    <tr key={key} data-policy={key}>
                      <th scope="row">{label}</th>
                      <td>
                        {outcome.retries}/{TOY_QUEUE.length}
                      </td>
                      <td>{num(outcome.spend)}</td>
                      <td>{signed(outcome.fixed)}</td>
                      <td>{signed(-outcome.broken)}</td>
                      <td>{signed(outcome.net)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="rlab-hint">
            Fixed and broken are expected answers. Spend and net are in units of one correct
            answer's value. Expected right answers out of {TOY_QUEUE.length}: never{" "}
            {num(outcomes.never.right)}, this rule {num(outcomes.rule.right)}, always{" "}
            {num(outcomes.always.right)}.
          </p>
          <TradeOff outcomes={outcomes} />
        </div>
      </div>

      <p className="rlab-honesty">
        Toy numbers that only illustrate the rule, not results. If the estimates were exact, the
        rule would come out ahead by construction. The study measures whether real estimates are
        calibrated enough for it to save money.
      </p>
      <p className="rlab-sr" aria-live="polite">
        {live}
      </p>
    </section>
  );
}

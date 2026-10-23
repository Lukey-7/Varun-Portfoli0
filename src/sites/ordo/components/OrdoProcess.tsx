import {
  useEffect,
  useId,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Play, RotateCcw } from "lucide-react";
import { useMotionPaused } from "@/lib/motion-pause";
import "./process.css";

/* ---------- Timing ----------
   Each stage's live artifact is a script of times in ms from the start of
   the stage. One clock drives the script, the tab's progress rail and the
   connectors on the loop map, so the three always agree. */

/** One clock tick. */
const TICK = 40;
/** How long a finished stage stays up before the tour moves on. */
const HOLD = 2400;
/** Clock value that shows every finished state (reduced motion). */
const FINISHED = 1e9;

const CONTRACT = {
  /** Sources, outputs, study tools, retriever: [start, end] of each field. */
  fields: [
    [400, 1500],
    [1700, 2700],
    [2900, 4000],
    [4200, 5100],
  ] as const,
  ready: 5300,
  duration: 5800,
};

const PIPELINE = {
  /** When each part of the retrieval graph is built. */
  nodes: {
    docs: 300,
    chunks: 500,
    index: 700,
    query: 1300,
    dense: 1500,
    bm25: 1650,
    fusion: 2300,
    mmr: 2600,
    rerank: 2900,
    answer: 3400,
  },
  cites: 3600,
  /** Queries start flowing through the finished graph. */
  flow: 4200,
  /** An answer with citations has come back: the stage's gate. */
  candidate: 8200,
  duration: 8600,
};

const SCORE = {
  dense: [400, 1900] as const,
  denseResult: 2000,
  /** Misses travel back to Build along loop A. */
  feedback: [2600, 4200] as const,
  hybrid: [4300, 5800] as const,
  hybridResult: 5900,
  gate: 6300,
  duration: 6800,
};

const CI = {
  steps: [
    { label: "$ git push", result: "pushed", start: 0, end: 700 },
    { label: "GitHub Actions", result: "run started", start: 800, end: 1300 },
    { label: "backend · pytest", count: 155, start: 1400, end: 3600 },
    { label: "frontend tests", count: 30, start: 3700, end: 4700 },
    { label: "docker build", result: "image built", start: 4800, end: 6000 },
    { label: "/health", result: "check passed", start: 6100, end: 6800 },
  ],
  live: 7000,
  duration: 7400,
};

/* ---------- Content: one loop, StudyForge's real numbers ---------- */

type StageId = "configure" | "build" | "evaluate" | "deploy";

interface Stage {
  id: StageId;
  name: string;
  /** What the stage hands on, shown on its tab. */
  output: string;
  title: string;
  why: string;
  produce: string;
  gate: string;
  /** Name of the live artifact. */
  artifact: string;
  /** Visible notes under the artifact: scope and measured details. */
  caption: string[];
  /** The artifact's finished state in words, for screen readers. */
  summary: string;
  duration: number;
}

const STAGES: Stage[] = [
  {
    id: "configure",
    name: "Configure",
    output: "contract",
    title: "Agree the contract before the code.",
    why: "Fixing what goes in and what must come out gives every later stage something concrete to be tested against.",
    produce:
      "A contract listing the five source types, the outputs (a living book of cited sections and 16 study tools, each validated against a schema) and the retriever.",
    gate: "Every field is defined and every study tool has a schema to be checked against. Only then does Build start.",
    artifact: "Contract",
    caption: ["Concept maps are drawn by code, not by the model."],
    summary:
      "The contract. Sources: PDF, Word, notes, photos and audio. Outputs: a living book of cited sections. Study tools: 16, each validated against a schema. Retriever: dense embeddings and BM25, rank fusion, MMR and an LLM rerank. Contract ready.",
    duration: CONTRACT.duration,
  },
  {
    id: "build",
    name: "Build",
    output: "pipeline",
    title: "Build the pipeline the contract describes.",
    why: "Retrieval decides what the model gets to see, so I build it as separate steps that I can test and swap one at a time.",
    produce:
      "Hybrid retrieval: dense embeddings and BM25, rank fusion, MMR for diversity and an LLM rerank, answering with cited passages (S1, S2) and book sections (B1).",
    gate: "A query runs end to end and comes back with citations. That makes it a candidate for Evaluate, not yet an improvement.",
    artifact: "Retrieval pipeline",
    caption: [
      "Adding a second source rewrote only the sections it changed: 6 of 7 stayed untouched.",
    ],
    summary:
      "Documents are split into chunks and indexed. A query goes to dense retrieval and to BM25, rank fusion merges the two lists, MMR keeps a diverse set, an LLM reranks it, and the answer cites source passages S1 and S2 and book section B1.",
    duration: PIPELINE.duration,
  },
  {
    id: "evaluate",
    name: "Evaluate",
    output: "scorecard",
    title: "Score every change against the baseline.",
    why: "A change that looks better in a demo can still rank the right passage lower, so I measure it before I believe it.",
    produce:
      "A scorecard on 33 labelled queries: Recall@1 and MRR@10 for the change and for the dense-only baseline, side by side.",
    gate: "It has to beat the baseline on that set. If it does not, it goes back to Build (loop A).",
    artifact: "Scorecard · 33 labelled queries",
    caption: [
      "Each cell is one labelled query, in no set order. Results on this set, not a guarantee for unseen documents.",
      "A support check found 37 of 39 book paragraphs backed by their passages (95%). It is a self-check by the same model family, not an independent review.",
    ],
    summary:
      "Dense retrieval alone ranked the right passage first for 27 of 33 labelled queries: Recall@1 0.82, MRR@10 0.89. Misses go back to Build. The hybrid pipeline ranked it first for 33 of 33: Recall@1 1.00, MRR@10 1.00, so it beat the baseline.",
    duration: SCORE.duration,
  },
  {
    id: "deploy",
    name: "Deploy",
    output: "release",
    title: "Ship only what CI passes.",
    why: "Running the same checks on every push catches a broken build before it is deployed rather than after.",
    produce:
      "A GitHub Actions run on every push: 155 backend tests (pytest), 30 frontend tests, a Docker build and a /health check.",
    gate: "Every check passes, then it goes live. What I learn from real use becomes the next requirement (loop B).",
    artifact: "Docker + CI",
    caption: ["GitHub Actions runs this on every push."],
    summary:
      "On every push, GitHub Actions runs 155 backend tests with pytest and 30 frontend tests, builds the Docker image and checks /health. When all of them pass, the build goes live.",
    duration: CI.duration,
  },
];

const STATUS = {
  ready: { mark: "○", label: "Ready" },
  running: { mark: "●", label: "Running" },
  passed: { mark: "✓", label: "Passed" },
  queued: { mark: "○", label: "Queued" },
} as const;
type Status = keyof typeof STATUS;

/* ---------- Helpers ---------- */

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
/** How far t is through [start, end], from 0 to 1. */
const progress = (t: number, start: number, end: number) => clamp01((t - start) / (end - start));
const pad = (value: number) => String(value).padStart(2, "0");

const REDUCE = "(prefers-reduced-motion: reduce)";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(REDUCE).matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(REDUCE);
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

/** True while the middle of the viewport overlaps the element. */
function useOnScreen(ref: RefObject<HTMLElement>) {
  const [onScreen, setOnScreen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setOnScreen(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => setOnScreen(entries[entries.length - 1].isIntersecting),
      { rootMargin: "-15% 0px -15% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return onScreen;
}

function useWidth(ref: RefObject<HTMLElement>) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    setWidth(node.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) setWidth(box.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/* ---------- The tour: which stage is up and how far its script has run ---------- */

interface TourState {
  active: number;
  t: number;
  /** The visitor chose a stage, which stops the tour. */
  manual: boolean;
}

type TourAction =
  | { type: "tick"; holding: boolean }
  | { type: "choose"; index: number }
  | { type: "replay" }
  | { type: "resume" };

function tour(state: TourState, action: TourAction): TourState {
  const duration = STAGES[state.active].duration;
  switch (action.type) {
    case "tick":
      if (state.manual) {
        return state.t >= duration ? state : { ...state, t: Math.min(duration, state.t + TICK) };
      }
      // A finished stage waits while the visitor is reading or using the section.
      if (state.t >= duration && action.holding) return state;
      if (state.t >= duration + HOLD) {
        return { ...state, active: (state.active + 1) % STAGES.length, t: 0 };
      }
      return { ...state, t: state.t + TICK };
    case "choose":
      return {
        active: action.index,
        manual: true,
        t: action.index === state.active ? state.t : 0,
      };
    case "replay":
      return { ...state, manual: true, t: 0 };
    case "resume":
      return { ...state, manual: false };
    default:
      return state;
  }
}

/* ---------- Section ---------- */

type ArtMotion = "live" | "frozen" | "off";

/** Four gated stages drawn as a loop, each with a live artifact from StudyForge. */
export function OrdoProcess() {
  const sectionRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const uid = useId();
  const headingId = `${uid}-heading`;
  const panelId = `${uid}-panel`;
  const tabId = (index: number) => `${uid}-tab-${index}`;

  const reduced = usePrefersReducedMotion();
  const paused = useMotionPaused();
  const onScreen = useOnScreen(sectionRef);
  const [state, dispatch] = useReducer(tour, { active: 0, t: 0, manual: false });
  const [reading, setReading] = useState(false);
  const [focused, setFocused] = useState(false);
  const holding = reading || focused;
  const holdingRef = useRef(holding);
  holdingRef.current = holding;

  const stage = STAGES[state.active];
  // Reduced motion shows finished states. Under the page-wide pause a stage
  // that has not started shows its result; one mid-way freezes where it is.
  const t = reduced || (paused && state.t === 0) ? FINISHED : state.t;
  const done = t >= stage.duration;
  const playing = onScreen && !paused && !reduced && !(state.manual && done);
  const motion: ArtMotion = reduced ? "off" : onScreen && !paused ? "live" : "frozen";

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () => dispatch({ type: "tick", holding: holdingRef.current }),
      TICK,
    );
    return () => window.clearInterval(timer);
  }, [playing]);

  const statusOf = (index: number): Status =>
    index < state.active
      ? "passed"
      : index > state.active
        ? "queued"
        : done
          ? "passed"
          : t > 0
            ? "running"
            : "ready";

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = STAGES.length - 1;
    const next =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? (index + 1) % STAGES.length
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? (index + last) % STAGES.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : -1;
    if (next < 0) return;
    event.preventDefault();
    dispatch({ type: "choose", index: next });
    tabRefs.current[next]?.focus();
  };

  // A connector carries work once the stage before it has passed its gate.
  const links = {
    cb: state.active === 0 && done,
    be: state.active === 1 && done,
    ed: state.active === 2 && done,
    dc: state.active === 3 && done,
    retry: state.active === 2 && t >= SCORE.feedback[0] && t < SCORE.hybrid[0],
  };

  const tourText = reduced
    ? "Animations are off, so each stage shows its finished result."
    : paused
      ? "Paused by the page's animation switch."
      : state.manual
        ? `Tour stopped at ${stage.name}.`
        : done && holding
          ? "Tour waiting while you read."
          : `Tour: stage ${state.active + 1} of ${STAGES.length}. Choose a stage to stop it.`;
  const tourMark = reduced || state.manual ? "stopped" : paused || (done && holding) ? "waiting" : "running";
  const artState = reduced || done ? "Finished" : paused ? "Paused" : !onScreen ? "Waiting" : t > 0 ? "Playing" : "Ready";
  const barState = done ? { mark: "✓", label: "Gate passed" } : t > 0 ? STATUS.running : STATUS.ready;

  return (
    <section
      ref={sectionRef}
      aria-labelledby={headingId}
      className={[
        "ordo-flow proc-section",
        onScreen ? "" : "is-offscreen",
        paused || reduced ? "is-still" : "",
        state.manual ? "is-manual" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div className="section-wrap">
        <div className="ordo-section-label">
          <span>[ 04 / PROCESS ]</span>
          <span>CASE / STUDYFORGE</span>
        </div>
        <div className="proc-head">
          <h2 id={headingId} className="proc-h2">
            How I ship an AI feature,
            <br />
            <span>four gates, shown on StudyForge.</span>
          </h2>
          <p className="proc-intro">
            I put every feature through four stages, and each one ends in a
            gate. Work that fails a gate goes back rather than forward, and
            what production teaches me starts the next round. The numbers are
            StudyForge's own, and each says what it was measured on.
          </p>
        </div>

        <div className="proc-grid">
          <div className="proc-side">
            <div role="tablist" aria-label="Stages of the loop" className="proc-map">
              {STAGES.map((item, index) => {
                const status = statusOf(index);
                const selected = index === state.active;
                const fill = selected ? clamp01(t / item.duration) : status === "passed" ? 1 : 0;
                return (
                  <button
                    key={item.id}
                    ref={(node) => {
                      tabRefs.current[index] = node;
                    }}
                    type="button"
                    role="tab"
                    id={tabId(index)}
                    aria-selected={selected}
                    aria-controls={panelId}
                    tabIndex={selected ? 0 : -1}
                    className={`proc-tab is-${item.id}`}
                    data-status={status}
                    onClick={() => dispatch({ type: "choose", index })}
                    onKeyDown={(event) => onTabKey(event, index)}
                  >
                    <span className="proc-tab-top" aria-hidden="true">
                      <span>{pad(index + 1)}</span>
                      <span className="proc-tab-status">
                        {STATUS[status].mark} {STATUS[status].label}
                      </span>
                    </span>
                    <span className="proc-tab-name">{item.name}</span>
                    <span className="proc-tab-out" aria-hidden="true">
                      → {item.output}
                    </span>
                    <span className="proc-tab-rail" aria-hidden="true">
                      <span style={{ transform: `scaleX(${fill})` }} />
                    </span>
                  </button>
                );
              })}
              <span className="proc-link is-cb is-across" data-on={links.cb} aria-hidden="true">
                <i />
              </span>
              <span className="proc-rail is-be" aria-hidden="true">
                <span className="proc-link is-down" data-on={links.be}>
                  <i />
                </span>
                <span className="proc-link is-up is-back" data-on={links.retry}>
                  <i />
                  <b>A</b>
                </span>
              </span>
              <span className="proc-link is-ed is-across is-reverse" data-on={links.ed} aria-hidden="true">
                <i />
              </span>
              <span className="proc-rail is-dc" aria-hidden="true">
                <span className="proc-link is-up is-back" data-on={links.dc}>
                  <i />
                  <b>B</b>
                </span>
              </span>
              <span className="proc-hub" aria-hidden="true">
                <i />
              </span>
            </div>

            <ul className="proc-legend">
              <li>
                <b aria-hidden="true">A</b>
                <p>
                  <strong>Evaluate back to Build.</strong> A change only ships
                  if it beats the baseline.
                </p>
              </li>
              <li>
                <b aria-hidden="true">B</b>
                <p>
                  <strong>Deploy back to Configure.</strong> What I learn in
                  production becomes the next requirement.
                </p>
              </li>
            </ul>

            <div className="proc-tour">
              <span className="proc-tour-mark" data-state={tourMark} aria-hidden="true" />
              <p>{tourText}</p>
              {state.manual && !reduced && (
                <button type="button" className="proc-resume" onClick={() => dispatch({ type: "resume" })}>
                  <Play size={12} aria-hidden="true" /> Resume tour
                </button>
              )}
            </div>
          </div>

          <div
            role="tabpanel"
            id={panelId}
            aria-labelledby={tabId(state.active)}
            tabIndex={0}
            className={`proc-panel is-${stage.id}`}
            onPointerEnter={() => setReading(true)}
            onPointerLeave={() => setReading(false)}
          >
            <div className="proc-bar">
              <span className="proc-bar-stage">
                Stage {pad(state.active + 1)} <i aria-hidden="true">/</i> <strong>{stage.name}</strong>
              </span>
              <span className="proc-bar-project">StudyForge</span>
              <span className="proc-bar-state" data-done={done}>
                <i aria-hidden="true">{barState.mark}</i> {barState.label}
              </span>
              {!reduced && (
                <button
                  type="button"
                  className="proc-replay"
                  aria-label={`Replay the ${stage.name} animation`}
                  title="Replay"
                  onClick={() => dispatch({ type: "replay" })}
                >
                  <RotateCcw size={14} aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="proc-body">
              <div className="proc-copy" aria-live={state.manual ? "polite" : "off"}>
                <div key={stage.id} className="proc-swap">
                  <h3 className="proc-title">{stage.title}</h3>
                  <dl className="proc-spec">
                    <div>
                      <dt>Why</dt>
                      <dd>{stage.why}</dd>
                    </div>
                    <div>
                      <dt>I produce</dt>
                      <dd>{stage.produce}</dd>
                    </div>
                    <div>
                      <dt>Gate</dt>
                      <dd>{stage.gate}</dd>
                    </div>
                  </dl>
                </div>
              </div>
              <figure key={stage.id} className="proc-art proc-swap">
                <div className="proc-art-bar" aria-hidden="true">
                  <span>Artifact / {stage.artifact}</span>
                  <span>{artState}</span>
                </div>
                <div className="proc-art-body" aria-hidden="true">
                  <StageArt id={stage.id} t={t} motion={motion} />
                </div>
                <figcaption className="proc-art-caption">
                  <span className="proc-sr">{stage.summary}</span>
                  {stage.caption.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </figcaption>
              </figure>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StageArt({ id, t, motion }: { id: StageId; t: number; motion: ArtMotion }) {
  if (id === "configure") return <ContractArt t={t} />;
  if (id === "build") return <PipelineArt t={t} motion={motion} />;
  if (id === "evaluate") return <ScoreArt t={t} />;
  return <CiArt t={t} />;
}

/* ---------- Configure: the contract fills in field by field ---------- */

const SOURCES = ["PDF", "Word", "notes", "photos", "audio"];
const OUTPUTS = "living book of cited sections";
const RETRIEVER = "dense + BM25 → fusion → MMR → rerank";
const TOOLS = 16;

type FieldState = "pending" | "writing" | "set";
const FIELD_MARK: Record<FieldState, string> = { pending: "○", writing: "·", set: "✓" };
const fieldState = (t: number, [start, end]: readonly [number, number]): FieldState =>
  t < start ? "pending" : t < end ? "writing" : "set";

/** Text typed out over time; the full text is laid out invisibly so nothing reflows. */
function Typed({ text, share, caret }: { text: string; share: number; caret: boolean }) {
  return (
    <span className="proc-typed">
      <span className="proc-typed-ghost">{text}</span>
      <span>
        {text.slice(0, Math.round(share * text.length))}
        {caret && <span className="proc-caret" />}
      </span>
    </span>
  );
}

function Field({
  name,
  state,
  note,
  children,
}: {
  name: string;
  state: FieldState;
  note?: string;
  children: ReactNode;
}) {
  return (
    <div className="proc-field" data-state={state}>
      <span className="proc-field-key">{name}</span>
      <span className="proc-field-value">{children}</span>
      <span className="proc-field-mark">{FIELD_MARK[state]}</span>
      {note && <span className="proc-field-note">{note}</span>}
    </div>
  );
}

function ContractArt({ t }: { t: number }) {
  const [sources, outputs, tools, retriever] = CONTRACT.fields;
  const states = CONTRACT.fields.map((field) => fieldState(t, field));
  const chips = Math.ceil(progress(t, sources[0], sources[1] - 150) * SOURCES.length);
  const filled = Math.round(progress(t, tools[0], tools[1] - 200) * TOOLS);
  const set = states.filter((value) => value === "set").length;
  const ready = t >= CONTRACT.ready;
  return (
    <div className="proc-contract">
      <Field name="sources" state={states[0]}>
        <span className="proc-chips">
          {SOURCES.map((source, index) => (
            <span key={source} className={index < chips ? "is-on" : undefined}>
              {source}
            </span>
          ))}
        </span>
      </Field>
      <Field name="outputs" state={states[1]}>
        <Typed
          text={OUTPUTS}
          share={progress(t, outputs[0], outputs[1] - 150)}
          caret={states[1] === "writing"}
        />
      </Field>
      <Field
        name="study tools"
        state={states[2]}
        note={states[2] === "set" ? "quizzes, flashcards, a podcast script …" : " "}
      >
        <span className="proc-tools">
          {Array.from({ length: TOOLS }, (_, index) => (
            <i key={index} className={index < filled ? "is-on" : undefined} />
          ))}
        </span>
        <span className="proc-tools-count">{filled > 0 ? `${filled} · schema-validated` : ""}</span>
      </Field>
      <Field name="retriever" state={states[3]}>
        <Typed
          text={RETRIEVER}
          share={progress(t, retriever[0], retriever[1] - 150)}
          caret={states[3] === "writing"}
        />
      </Field>
      <div className="proc-contract-foot" data-ready={ready}>
        {ready ? (
          <span>
            <i aria-hidden="true">✓</i> contract ready
          </span>
        ) : (
          <span>drafting · {set} / 4 fields</span>
        )}
        <span>{ready ? "→ 02 Build" : ""}</span>
      </div>
    </div>
  );
}

/* ---------- Build: the graph assembles, then queries flow through it ---------- */

type Pt = readonly [number, number];
type NodeId = keyof typeof PIPELINE.nodes;

interface Graph {
  name: "wide" | "tall";
  view: readonly [number, number];
  nodes: { id: NodeId; x: number; y: number; w: number }[];
  /** The "hybrid retrieval" group around dense and BM25. */
  box: { x: number; y: number; w: number; h: number; lx: number; ly: number };
  edges: { d: string; at: number; route?: boolean; head?: false }[];
  /** Top-left of the first citation chip under the answer. */
  cites: Pt;
  /** Packet routes: query → dense → fusion, query → BM25 → fusion, fusion → answer. */
  routes: { dense: Pt[]; bm25: Pt[]; tail: Pt[] };
}

const NODE_LABEL: Record<NodeId, string> = {
  docs: "documents",
  chunks: "chunks",
  index: "index",
  query: "query",
  dense: "dense",
  bm25: "BM25",
  fusion: "rank fusion",
  mmr: "MMR",
  rerank: "LLM rerank",
  answer: "answer",
};

/** Left to right, for artifacts at least 560px wide. */
const WIDE: Graph = {
  name: "wide",
  view: [672, 226],
  nodes: [
    { id: "docs", x: 45, y: 30, w: 74 },
    { id: "chunks", x: 129, y: 30, w: 58 },
    { id: "index", x: 208, y: 30, w: 64 },
    { id: "query", x: 44, y: 150, w: 72 },
    { id: "dense", x: 208, y: 124, w: 88 },
    { id: "bm25", x: 208, y: 176, w: 88 },
    { id: "fusion", x: 338, y: 150, w: 92 },
    { id: "mmr", x: 432, y: 150, w: 56 },
    { id: "rerank", x: 524, y: 150, w: 88 },
    { id: "answer", x: 624, y: 150, w: 72 },
  ],
  box: { x: 152, y: 96, w: 112, h: 108, lx: 208, ly: 220 },
  edges: [
    { d: "M82 30H100", at: 400 },
    { d: "M158 30H176", at: 600 },
    { d: "M208 42V96", at: 1000 },
    { d: "M80 150H158V124H164", at: 1450, route: true },
    { d: "M158 150V176H164", at: 1600, route: true },
    { d: "M252 124H276V150H292", at: 2250, route: true },
    { d: "M252 176H276V150", at: 2250, route: true, head: false },
    { d: "M384 150H404", at: 2550, route: true },
    { d: "M460 150H480", at: 2850, route: true },
    { d: "M568 150H588", at: 3350, route: true },
  ],
  cites: [591, 168],
  routes: {
    dense: [[44, 150], [158, 150], [158, 124], [276, 124], [276, 150], [338, 150]],
    bm25: [[44, 150], [158, 150], [158, 176], [276, 176], [276, 150], [338, 150]],
    tail: [[338, 150], [624, 150]],
  },
};

/** Top to bottom, for phones and narrow panels. */
const TALL: Graph = {
  name: "tall",
  view: [320, 300],
  nodes: [
    { id: "docs", x: 44, y: 20, w: 80 },
    { id: "chunks", x: 142, y: 20, w: 72 },
    { id: "index", x: 232, y: 20, w: 64 },
    { id: "query", x: 44, y: 64, w: 72 },
    { id: "dense", x: 88, y: 124, w: 104 },
    { id: "bm25", x: 232, y: 124, w: 104 },
    { id: "fusion", x: 88, y: 200, w: 120 },
    { id: "mmr", x: 232, y: 200, w: 72 },
    { id: "rerank", x: 232, y: 252, w: 112 },
    { id: "answer", x: 88, y: 252, w: 96 },
  ],
  box: { x: 16, y: 88, w: 288, h: 72, lx: 160, ly: 153 },
  edges: [
    { d: "M84 20H106", at: 400 },
    { d: "M178 20H200", at: 600 },
    { d: "M232 32V88", at: 1000 },
    { d: "M44 76V100H88V112", at: 1450, route: true },
    { d: "M88 100H232V112", at: 1600, route: true },
    { d: "M88 136V188", at: 2250, route: true },
    { d: "M232 136V176H88", at: 2250, route: true, head: false },
    { d: "M148 200H196", at: 2550, route: true },
    { d: "M232 212V240", at: 2850, route: true },
    { d: "M176 252H136", at: 3350, route: true },
  ],
  cites: [55, 270],
  routes: {
    dense: [[44, 64], [44, 100], [88, 100], [88, 200]],
    bm25: [[44, 64], [44, 100], [232, 100], [232, 176], [88, 176], [88, 200]],
    tail: [[88, 200], [232, 200], [232, 252], [88, 252]],
  },
};

const CITES = ["S1", "S2", "B1"];

/** Packet speed in viewBox units per ms, a new query every PERIOD ms. */
const SPEED = 0.21;
const PERIOD = 1700;
const SLOTS = 3;

interface Polyline {
  points: Pt[];
  marks: number[];
  length: number;
}

function toPolyline(points: Pt[]): Polyline {
  const marks = [0];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    marks.push(marks[i - 1] + Math.hypot(x1 - x0, y1 - y0));
  }
  return { points, marks, length: marks[marks.length - 1] };
}

function pointAt(line: Polyline, distance: number): Pt {
  const d = Math.min(Math.max(distance, 0), line.length);
  let i = 1;
  while (i < line.marks.length - 1 && line.marks[i] < d) i++;
  const [x0, y0] = line.points[i - 1];
  const [x1, y1] = line.points[i];
  const k = (d - line.marks[i - 1]) / (line.marks[i] - line.marks[i - 1] || 1);
  return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k];
}

/**
 * Query packets, drawn straight to the DOM each frame. A query splits into a
 * dense and a BM25 packet; rank fusion waits for both lists, then a single
 * packet carries on through MMR and the rerank to the answer.
 */
function Packets({
  graph,
  running,
  answer,
}: {
  graph: Graph;
  running: boolean;
  answer: RefObject<SVGGElement>;
}) {
  const dense = useRef<(SVGRectElement | null)[]>([]);
  const bm25 = useRef<(SVGRectElement | null)[]>([]);
  const clock = useRef(0);

  useEffect(() => {
    const route = {
      dense: toPolyline([...graph.routes.dense]),
      bm25: toPolyline([...graph.routes.bm25]),
      tail: toPolyline([...graph.routes.tail]),
    };
    const toDense = route.dense.length / SPEED;
    const toBm25 = route.bm25.length / SPEED;
    const merged = Math.max(toDense, toBm25);
    const total = merged + route.tail.length / SPEED;
    const fusion = route.dense.points[route.dense.points.length - 1];
    const place = (node: SVGRectElement | null | undefined, point: Pt | null) => {
      if (!node) return;
      node.setAttribute("opacity", point ? "1" : "0");
      if (point) node.setAttribute("transform", `translate(${point[0].toFixed(1)} ${point[1].toFixed(1)})`);
    };
    const draw = (time: number) => {
      for (let slot = 0; slot < SLOTS; slot++) {
        place(dense.current[slot], null);
        place(bm25.current[slot], null);
      }
      const newest = Math.floor(time / PERIOD);
      for (let q = newest; q >= 0 && q > newest - SLOTS; q--) {
        const age = time - q * PERIOD;
        if (age > total) continue;
        const slot = q % SLOTS;
        place(
          dense.current[slot],
          age < toDense
            ? pointAt(route.dense, age * SPEED)
            : age < merged
              ? fusion
              : pointAt(route.tail, (age - merged) * SPEED),
        );
        place(bm25.current[slot], age < merged ? pointAt(route.bm25, Math.min(age, toBm25) * SPEED) : null);
      }
      // The citations light up each time a query reaches the answer.
      const sinceArrival = time >= total ? (time - total) % PERIOD : Infinity;
      answer.current?.classList.toggle("is-hit", sinceArrival < 520);
    };
    draw(clock.current);
    if (!running || typeof requestAnimationFrame !== "function") return;
    let frame = 0;
    let last = 0;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      if (last) clock.current += Math.min(now - last, 64);
      last = now;
      draw(clock.current);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [graph, running, answer]);

  return (
    <g className="proc-packets">
      {Array.from({ length: SLOTS }, (_, slot) => (
        <g key={slot}>
          <rect
            ref={(node) => {
              bm25.current[slot] = node;
            }}
            className="proc-packet"
            x="-3.5"
            y="-3.5"
            width="7"
            height="7"
            opacity="0"
          />
          <rect
            ref={(node) => {
              dense.current[slot] = node;
            }}
            className="proc-packet"
            x="-3.5"
            y="-3.5"
            width="7"
            height="7"
            opacity="0"
          />
        </g>
      ))}
    </g>
  );
}

function PipelineArt({ t, motion }: { t: number; motion: ArtMotion }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const answerRef = useRef<SVGGElement>(null);
  const width = useWidth(wrapRef);
  // Below 560px the wide graph's labels would drop under 9px, so stack it.
  const graph = width > 0 && width < 560 ? TALL : WIDE;
  const arrow = `proc-arrow-${useId().replace(/:/g, "")}`;
  const flowing = t >= PIPELINE.flow;
  const built = graph.nodes.filter((node) => t >= PIPELINE.nodes[node.id]).length;
  const status =
    t < PIPELINE.nodes.answer
      ? `assembling · ${built} / ${graph.nodes.length} parts`
      : !flowing
        ? "assembled · waiting for a query"
        : t < PIPELINE.candidate
          ? "query in flight · fusion waits for both lists"
          : "✓ cited answer returned → 03 Evaluate";
  const { box } = graph;
  return (
    <div ref={wrapRef} className={`proc-pipeline is-${graph.name}`}>
      <svg
        className={`proc-graph${flowing ? " is-flowing" : ""}`}
        viewBox={`0 0 ${graph.view[0]} ${graph.view[1]}`}
      >
        <defs>
          <marker
            id={arrow}
            viewBox="0 0 6 6"
            refX="5.5"
            refY="3"
            markerWidth="6"
            markerHeight="6"
            markerUnits="userSpaceOnUse"
            orient="auto"
          >
            <path d="M0 0.4L6 3L0 5.6Z" className="proc-arrowhead" />
          </marker>
        </defs>
        <rect
          className={`proc-graph-box${t >= PIPELINE.nodes.dense ? " is-on" : ""}`}
          x={box.x}
          y={box.y}
          width={box.w}
          height={box.h}
        />
        <text className="proc-graph-boxlabel" x={box.lx} y={box.ly}>
          hybrid retrieval
        </text>
        {graph.edges.map((edge) => (
          <g key={edge.d} className={edge.route ? "is-route" : undefined}>
            <path className="proc-edge-ghost" d={edge.d} />
            {t >= edge.at && (
              <path
                className="proc-edge"
                d={edge.d}
                pathLength={1}
                markerEnd={edge.head === false ? undefined : `url(#${arrow})`}
              />
            )}
          </g>
        ))}
        {graph.nodes.map((node) => (
          <g
            key={node.id}
            ref={node.id === "answer" ? answerRef : undefined}
            className={[
              "proc-node",
              t >= PIPELINE.nodes[node.id] ? "is-on" : "",
              node.id === "query" ? "is-input" : "",
              node.id === "answer" ? "is-output" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <rect x={node.x - node.w / 2} y={node.y - 12} width={node.w} height={24} />
            <text x={node.x} y={node.y + 3.5}>
              {NODE_LABEL[node.id]}
            </text>
          </g>
        ))}
        {CITES.map((cite, index) => (
          <g key={cite} className={`proc-cite${t >= PIPELINE.cites + index * 150 ? " is-on" : ""}`}>
            <rect x={graph.cites[0] + index * 23} y={graph.cites[1]} width={20} height={14} />
            <text x={graph.cites[0] + index * 23 + 10} y={graph.cites[1] + 10}>
              {cite}
            </text>
          </g>
        ))}
        {flowing && motion !== "off" && (
          <Packets graph={graph} running={motion === "live"} answer={answerRef} />
        )}
      </svg>
      <p className="proc-graph-status" data-done={t >= PIPELINE.candidate}>
        {status}
      </p>
    </div>
  );
}

/* ---------- Evaluate: 33 labelled queries, scored twice ---------- */

const QUERIES = 33;
/** Six cells stand for the queries dense retrieval missed; their order is illustrative. */
const MISSES = new Set([4, 10, 13, 21, 25, 30]);

type CellState = "idle" | "hit" | "miss" | "sent" | "fixed";
const CELL_GLYPH: Partial<Record<CellState, string>> = { miss: "×", sent: "↺" };

function ScoreArt({ t }: { t: number }) {
  const scoredA = Math.floor(progress(t, ...SCORE.dense) * QUERIES);
  const scoredB = Math.floor(progress(t, ...SCORE.hybrid) * QUERIES);
  let hitsA = 0;
  for (let i = 0; i < scoredA; i++) if (!MISSES.has(i)) hitsA++;
  const sweepingA = t >= SCORE.dense[0] && t < SCORE.dense[1];
  const sweepingB = t >= SCORE.hybrid[0] && t < SCORE.hybrid[1];
  const sentBack = t >= SCORE.feedback[0];
  const sending = sentBack && t < SCORE.hybrid[0];
  const passed = t >= SCORE.gate;

  const phase =
    t < SCORE.dense[0]
      ? "33 labelled queries · not scored yet"
      : sweepingA
        ? `run 1 · dense only · query ${pad(scoredA + 1)} / 33`
        : t < SCORE.feedback[0]
          ? `run 1 · dense only · ${hitsA} / 33 at rank 1`
          : sending
            ? `↺ ${MISSES.size} misses go back to Build`
            : sweepingB
              ? `run 2 · hybrid · query ${pad(scoredB + 1)} / 33`
              : `run 2 · hybrid · ${scoredB} / 33 at rank 1`;

  const runs = [
    {
      name: "Dense only",
      note: t >= SCORE.denseResult ? "baseline" : " ",
      hits: scoredA > 0 ? hitsA : null,
      mrr: t >= SCORE.denseResult ? "0.89" : "—",
    },
    {
      name: "Hybrid",
      note: passed ? "✓ beats baseline" : " ",
      hits: scoredB > 0 ? scoredB : null,
      mrr: t >= SCORE.hybridResult ? "1.00" : "—",
    },
  ];

  return (
    <div className="proc-score">
      <div className="proc-score-board">
        <p className="proc-score-phase">{phase}</p>
        <div className={`proc-cells${sending ? " is-sending" : ""}`}>
          {Array.from({ length: QUERIES }, (_, i) => {
            const miss = MISSES.has(i);
            const state: CellState =
              i < scoredB
                ? miss
                  ? "fixed"
                  : "hit"
                : i < scoredA
                  ? miss
                    ? sentBack
                      ? "sent"
                      : "miss"
                    : "hit"
                  : "idle";
            const cursor = (sweepingA && i === scoredA) || (sweepingB && i === scoredB);
            return (
              <i key={i} className={`proc-cell is-${state}${cursor ? " is-cursor" : ""}`}>
                {CELL_GLYPH[state] ?? ""}
              </i>
            );
          })}
        </div>
        <p className="proc-cell-key">
          <span>
            <i className="proc-cell is-hit" /> right passage first
          </span>
          <span>
            <i className="proc-cell is-miss">×</i> missed
          </span>
          <span>
            <i className="proc-cell is-fixed" /> fixed by hybrid
          </span>
        </p>
      </div>
      <div className="proc-score-table">
        <div className="proc-score-row is-head">
          <span>Run</span>
          <span>At rank 1</span>
          <span>Recall@1</span>
          <span>MRR@10</span>
        </div>
        {runs.map((run) => (
          <div key={run.name} className="proc-score-row">
            <span>
              {run.name}
              <small>{run.note}</small>
            </span>
            <span>{run.hits === null ? "—" : `${run.hits} / 33`}</span>
            <span>{run.hits === null ? "—" : (run.hits / QUERIES).toFixed(2)}</span>
            <span>{run.mrr}</span>
          </div>
        ))}
        <p className="proc-score-gate" data-pass={passed}>
          {passed
            ? "✓ beats the baseline → 04 Deploy"
            : sending
              ? "↺ loop A · back to 02 Build"
              : "gate · beat the dense-only baseline"}
        </p>
      </div>
    </div>
  );
}

/* ---------- Deploy: one CI run, from push to live ---------- */

/** A terminal spinner, in characters the site's mono font subset has. */
const SPINNER = ["|", "/", "-", "\\"];

function CiArt({ t }: { t: number }) {
  const shares = CI.steps.map((step) => progress(t, step.start, step.end));
  const finished = shares.filter((share) => share >= 1).length;
  const overall = shares.reduce((sum, share) => sum + share, 0) / CI.steps.length;
  const live = t >= CI.live;
  return (
    <div className="proc-ci">
      <ol className="proc-ci-log">
        {CI.steps.map((step, index) => {
          const share = shares[index];
          const state = t < step.start ? "queued" : share < 1 ? "running" : "done";
          const mark =
            state === "done" ? "✓" : state === "running" ? SPINNER[Math.floor(t / 120) % SPINNER.length] : "○";
          const result =
            state === "queued"
              ? "queued"
              : step.count
                ? state === "done"
                  ? `${step.count} passed`
                  : `${Math.floor(share * step.count)} / ${step.count}`
                : state === "done"
                  ? step.result
                  : "running";
          return (
            <li key={step.label} data-state={state}>
              <span className="proc-ci-mark">{mark}</span>
              <span className="proc-ci-label">
                {index === 0 ? (
                  <Typed text={step.label} share={share * 1.4} caret={state === "running"} />
                ) : (
                  step.label
                )}
              </span>
              <span className="proc-ci-result">{result}</span>
            </li>
          );
        })}
      </ol>
      <div className="proc-ci-progress">
        <span className="proc-ci-bar">
          <span style={{ transform: `scaleX(${overall})` }} />
        </span>
        <span>
          {finished} / {CI.steps.length} steps
        </span>
      </div>
      <p className="proc-ci-live" data-on={live}>
        <i className="proc-live-dot" /> {live ? "live · every check passed" : "not live yet"}
      </p>
    </div>
  );
}

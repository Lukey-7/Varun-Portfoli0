export const selectedWork = [
  {
    id: "studyforge",
    name: "StudyForge",
    category: "Retrieval & learning",
    visual: "retrieval",
    title: "Your documents. A better way to learn.",
    description:
      "A document-to-learning platform with hybrid retrieval, cited answers and 16 structured study tools.",
    stack: ["Python", "FastAPI", "Chroma", "Gemini"],
    github: "https://github.com/Lukey-7/StudyForge",
    facts: [
      ["33", "labelled evaluation queries"],
      ["185", "automated tests"],
    ],
    problem:
      "Useful learning material needs to stay connected to its source. A fluent answer is not enough if the retrieval step missed the right passage.",
    approach:
      "I combined dense and BM25 retrieval with rank fusion, diversity selection and reranking. Structured generation produces cited learning material and schema-validated study tools through a FastAPI backend.",
    evidence:
      "On a 33-query labelled evaluation, Recall@1 improved from 0.82 to 1.00 and MRR@10 from 0.89 to 1.00. These are results on that evaluation set, not a guarantee for unseen documents. The repository includes 185 tests and Docker CI.",
    ownership:
      "Independent project. Python API, retrieval pipeline, evaluation and application integration.",
  },
  {
    id: "fintrack",
    name: "FinTrack",
    category: "Mobile & on-device intelligence",
    visual: "finance",
    title: "A clearer picture of everyday money.",
    description:
      "A personal finance app that turns transaction messages into reviewed, organised records, with on-device OCR.",
    stack: ["Kotlin", "Jetpack Compose", "Room", "ML Kit"],
    github: "https://github.com/Lukey-7/Personal_Finance_app",
    facts: [
      ["786", "unit tests across 12 releases"],
      ["On-device", "bill OCR"],
    ],
    problem:
      "Transaction messages are inconsistent. Refunds, transfers and duplicate payment alerts make a simple expense total misleading.",
    approach:
      "I built a bank-agnostic SMS parser with transaction-flow classification, duplicate detection and a review queue. The app adds statement import with balance checks, spending insights and OCR-assisted bill splitting.",
    evidence:
      "The project has 786 unit tests across 12 releases, v1.0.0 to v1.5.2. Kotlin and Jetpack Compose power the Android interface; Room and SQLCipher support local storage. ML Kit handles on-device OCR.",
    ownership:
      "Independent Android application. Parsing, data model, interface and testing.",
  },
  {
    id: "mara",
    name: "MARA",
    category: "Agents & evidence verification",
    visual: "agents",
    title: "Research that keeps its receipts.",
    description:
      "Five cooperating agents plan, retrieve and synthesise research, with a source quote behind each note.",
    stack: ["LlamaIndex", "Haystack", "FastAPI", "Redis"],
    github: "https://github.com/Lukey-7/mara",
    facts: [
      ["5", "specialised agents"],
      ["35", "labelled evaluation queries"],
    ],
    problem:
      "Multi-agent output can sound convincing while losing the evidence behind a claim. More agents alone do not solve that problem.",
    approach:
      "A planner, researcher, summariser, critic and writer share a workflow backed by hybrid retrieval and cross-encoder reranking. Research notes are retained only when their quoted text appears in the source.",
    evidence:
      "On 35 labelled queries over 317 chunks, Recall@5 improved from 0.857 to 0.929 and MRR@10 from 0.809 to 0.871 against a dense-only baseline. The project includes 112 tests, run with a fake LLM and fake embeddings.",
    ownership:
      "Independent project. Agent orchestration, retrieval and quote-verification checks.",
  },
  {
    id: "axiomquant",
    name: "AxiomQuant",
    category: "C++ & quantitative systems",
    visual: "quant",
    title: "Backtests with fewer blind spots.",
    description:
      "A C++20 research engine for testing strategies, modelling costs and examining bias in historical results.",
    stack: ["C++20", "Python", "Eigen", "OpenMP"],
    github: "https://github.com/Lukey-7/AxiomQuant",
    facts: [
      ["606", "assets in the research universe"],
      ["11.7 years", "of historical data"],
    ],
    problem:
      "A strategy can look excellent in a backtest because of the data or evaluation method, rather than its ability to generalise.",
    approach:
      "I built an event-driven backtester with transaction costs, a point-in-time universe, walk-forward testing and statistical checks. Python bindings connect the numerical core to research workflows.",
    evidence:
      "Research uses 11.7 years of data and a 606-asset universe. Portfolio optimisation is cross-checked against cvxpy to 1e-8 in CI. 89 C++ test cases run on Linux GCC, macOS Clang, Windows MSVC and a sanitizer build, plus 34 Python tests on Linux. Historical research results are not investment recommendations.",
    ownership:
      "Independent engineering and research project. C++ numerical core, Python integration and validation.",
  },
];

export type SelectedWork = (typeof selectedWork)[number];

export const otherWork = [
  {
    name: "Sprachweg",
    category: "Personal learning app",
    description:
      "German learning from A0 to B2, with FSRS spaced repetition and Gemini-assisted practice.",
    tech: "TypeScript / Gemini / Prisma",
    href: "/nexus?project=language",
    kind: "language",
  },
  {
    name: "Tetris / Lukey Arcade",
    category: "Game project",
    description:
      "A retro arcade with Tetris, timed game modes, a floating companion and synthesised chiptune audio.",
    tech: "JavaScript / Canvas / Web Audio",
    href: "https://github.com/Lukey-7/Lukey-tetris",
    kind: "tetris",
  },
  {
    name: "DND AI Game",
    category: "Experimental application",
    description:
      "An LLM game master exploring narrative state and consistency across a tabletop campaign.",
    tech: "TypeScript / React / LLMs",
    href: "https://github.com/Lukey-7/DND-AI-Game-beta",
    kind: "game",
  },
];

export const deliveryWork = [
  {
    title: "Lead-generation platform",
    text: "Built and improved Webex, LetsTute's lead-generation platform, including its agent workflows, retrieval and evaluation.",
    tags: "Next.js / LangGraph / PostgreSQL",
  },
  {
    title: "ERP intelligence",
    text: "Leading implementation and testing of document extraction, validation and evidence-backed retrieval for a secured client ERP.",
    tags: "FastAPI / OCR / RAG",
  },
  {
    title: "KiranOS & deployment",
    text: "Developing the iOS application and new platform features, deploying on GCP, and gaining hands-on AWS deployment experience for clients.",
    tags: "React / Capacitor / GCP / AWS",
  },
];

/**
 * ORDO capability grid. Every line maps to a project or role on the resume;
 * `target` is the card or role a click scrolls to.
 */
export const aiCapabilities = [
  {
    id: "retrieval",
    name: "Hybrid retrieval",
    source: "StudyForge",
    target: { id: "studyforge", label: "StudyForge" },
    text: "Dense and BM25 search with rank fusion, diversity selection and reranking, so answers stay tied to their sources.",
    metaLeft: "33 TEST QUERIES",
    metaRight: "RIGHT PASSAGE FIRST: 27 → 33",
  },
  {
    id: "agents",
    name: "Agent orchestration",
    source: "MARA / Webex",
    target: { id: "mara", label: "MARA" },
    text: "Planner, researcher, summariser, critic and writer agents. In Webex, supervisor and worker agents run within token budgets and guardrails.",
    metaLeft: "5 AGENTS IN MARA",
    metaRight: "QUOTE MUST MATCH SOURCE",
  },
  {
    id: "evaluation",
    name: "Evaluation first",
    source: "MARA",
    target: { id: "mara", label: "MARA" },
    text: "Retrieval changes are scored on labelled queries against a dense-only baseline before I keep them. Notes are kept only if their quote appears in the source.",
    metaLeft: "35 QUERIES · 317 CHUNKS",
    metaRight: "RECALL@5 0.86 → 0.93",
  },
  {
    id: "documents",
    name: "Document intelligence",
    source: "KiranOS ERP",
    target: { id: "letstute", label: "my LetsTute role" },
    text: "Bill OCR with a self-hosted vision model, LLM field extraction with validation checks, and an assistant that cites its sources. I lead implementation and testing.",
    metaLeft: "AUDIT LOG OF MODEL CALLS",
    metaRight: "240+ TESTS",
  },
  {
    id: "media",
    name: "Generative media",
    source: "Webex studio",
    target: { id: "letstute", label: "my LetsTute role" },
    text: "Streamlined image and video generation (Gemini image models, Veo 3.1, Gemini Omni) into one studio workflow that can extend and join clips.",
    metaLeft: "IMAGE → VIDEO",
    metaRight: "CLIPS EXTEND AND JOIN",
  },
  {
    id: "ondevice",
    name: "On-device intelligence",
    source: "FinTrack",
    target: { id: "fintrack", label: "FinTrack" },
    text: "Bank-agnostic SMS parsing, transaction-flow classification and ML Kit OCR that run on the phone.",
    metaLeft: "7 TRANSACTION FLOWS",
    metaRight: "RUNS ON THE PHONE",
  },
] as const;

export type AiCapability = (typeof aiCapabilities)[number];

/** Research proposal submitted for supervisory review. Hypotheses, not results. */
export const research = {
  title: "Reducing inference cost in large language model assistants",
  status: "Research proposal for supervisory review · October 2026",
  note: "Both studies are hypotheses to be tested. Neither assumes a more elaborate policy will beat a well-tuned simple baseline.",
  costNote:
    "Cost means the total spend to complete a task successfully, including memory construction, retrieval, verification and generation.",
  studies: [
    {
      id: "memory",
      name: "Adaptive conversation memory",
      tag: "Study 01 · Starting point",
      summary:
        "Keep a user's changing requirements without resending the whole conversation.",
      question:
        "Does tracking revised constraints improve task success enough to justify the cost of maintaining memory?",
      method:
        "Recent messages plus selected original messages and compact constraint records, each linked to its source and revision history. An interpretable threshold policy picks the context budget.",
      evaluation:
        "LongMemEval, LoCoMo and LoCoMo-Plus, plus a 60-conversation prompt-revision pilot. Compared with full history, fixed windows, rolling summaries, raw-message retrieval and LightMem.",
      measure: "Total cost per successful task under a fixed quality constraint.",
    },
    {
      id: "retry",
      name: "Calibrated retry policy",
      tag: "Study 02 · Separate paper",
      summary: "Spend extra reasoning only when it is likely to help.",
      question:
        "After a low-budget answer, should the system return it or pay for one higher-budget attempt?",
      method:
        "Estimate the net probability that a retry improves the answer, and the retry's incremental cost; retry only when the benefit justifies the spend.",
      evaluation:
        "Financial numerical reasoning and an independent arithmetic set. Compared with fixed budgets, random and confidence-based retries, TALE and Plan-and-Budget.",
      measure:
        "Accuracy at matched cost, cost per correct answer, calibration, and how often retries damage a correct answer.",
    },
  ],
} as const;

/** Before/after retrieval results, always shown with the evaluation they came from. */
export const evidence = [
  {
    project: "StudyForge",
    metric: "Recall@1",
    before: 0.82,
    after: 1.0,
    scope: "33 labelled queries",
  },
  {
    project: "StudyForge",
    metric: "MRR@10",
    before: 0.89,
    after: 1.0,
    scope: "33 labelled queries",
  },
  {
    project: "MARA",
    metric: "Recall@5",
    before: 0.857,
    after: 0.929,
    scope: "35 queries over 317 chunks, vs dense-only",
  },
  {
    project: "MARA",
    metric: "MRR@10",
    before: 0.809,
    after: 0.871,
    scope: "35 queries over 317 chunks, vs dense-only",
  },
] as const;

export const testCounts = [
  { project: "FinTrack", count: 786, suffix: "", note: "across 12 releases" },
  { project: "StudyForge", count: 185, suffix: "", note: "with Docker CI" },
  { project: "MARA", count: 112, suffix: "", note: "with a fake LLM and embeddings" },
  { project: "AxiomQuant", count: 89, suffix: "", note: "C++ cases on four CI builds" },
] as const;

/**
 * The proposal's own example, used to illustrate which messages each memory
 * strategy would send. Illustrative only: no measured results.
 */
export const memoryConversation = [
  { id: 1, role: "user", text: "Draft a lesson summary on photosynthesis. Keep a formal tone." },
  { id: 2, role: "assistant", text: "Here is a formal draft." },
  { id: 3, role: "user", text: "Actually, it's for school students. Make it friendly." },
  { id: 4, role: "assistant", text: "Rewritten in a friendlier voice." },
  { id: 5, role: "user", text: "Add a short quiz at the end." },
  { id: 6, role: "assistant", text: "Added five questions." },
  { id: 7, role: "user", text: "Use metric units throughout." },
  { id: 8, role: "assistant", text: "Updated the units." },
  { id: 9, role: "user", text: "Describe the leaf diagram in words." },
  { id: 10, role: "assistant", text: "Added a diagram description." },
  { id: 11, role: "user", text: "Now write the full chapter." },
] as const;

export const memoryStrategies = [
  {
    id: "full",
    name: "Full history",
    sends: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    records: [] as string[],
    summary: null as string | null,
    note: "Every requirement survives, including the superseded one. The prompt grows with every turn.",
  },
  {
    id: "window",
    name: "Last 6 messages",
    sends: [6, 7, 8, 9, 10, 11],
    records: [] as string[],
    summary: null as string | null,
    note: "Cheap, but message 3 has left the window. Nothing tells the model the audience is school students.",
  },
  {
    id: "summary",
    name: "Rolling summary",
    sends: [10, 11],
    records: [] as string[],
    summary: "Formal lesson on photosynthesis for school students, friendly tone, quiz, metric units.",
    note: "Compact, but compression can merge the old and new instruction: formal and friendly at once.",
  },
  {
    id: "adaptive",
    name: "Adaptive memory",
    sends: [6, 7, 8, 9, 10, 11],
    records: [
      "Task: lesson summary on photosynthesis · active · from #1",
      "Audience: school students · active · from #3",
      "Tone: friendly · active · replaces formal (#1)",
      "Quiz at the end · active · from #5",
    ],
    summary: null as string | null,
    note: "The proposed policy: recent messages plus compact constraint records with their revision history. Whether it pays for itself is the hypothesis to test.",
  },
];

/** Shape the case-study dialog accepts; selected projects already match it. */
export interface CaseStudy {
  id: string;
  name: string;
  category: string;
  description: string;
  facts: readonly (readonly string[])[];
  problem?: string;
  approach?: string;
  evidence?: string;
  ownership?: string;
  github?: string;
}

/** Sprachweg's source is private, so its detail lives on the site itself. */
export const sprachwegCase: CaseStudy = {
  id: "sprachweg",
  name: "Sprachweg",
  category: "Personal learning app",
  description:
    "German learning from A0 to B2, with FSRS spaced repetition and Gemini-assisted practice.",
  facts: [
    ["A0 → B2", "German levels covered"],
    ["FSRS", "spaced repetition"],
  ],
  approach:
    "FSRS schedules each review and Gemini assists with practice. Built with TypeScript and Prisma.",
  ownership:
    "Personal learning application. The source code is not currently public.",
};

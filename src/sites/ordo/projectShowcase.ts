/**
 * Media and verified detail for the monochrome site's project dialogs.
 * Every number here was checked against the project's own repository or
 * README (October 2026). Screenshots come from those repositories and show
 * demo or synthetic data only.
 */

export interface ShowcaseMedia {
  src: string;
  alt: string;
  caption: string;
  /** "phone" renders in a tall frame; "wide" fills the stage. */
  shape: "wide" | "phone";
}

export interface ProjectShowcase {
  media: ShowcaseMedia[];
  highlights: string[];
  note?: string;
  /** A live demo hosted on this site. */
  play?: { label: string; src: string; title: string };
  links?: { label: string; href: string }[];
}

export const projectShowcase: Record<string, ProjectShowcase> = {
  studyforge: {
    media: [
      {
        src: "/projects/studyforge-workspace.webp",
        alt: "StudyForge workspace: sources on the left, the living textbook with its support check in the middle, chat on the right",
        caption: "Workspace: sources, the living book with its support check, and chat",
        shape: "wide",
      },
      {
        src: "/projects/studyforge-chat.webp",
        alt: "A chat answer about hash and B+ tree indexes with S2 and B1 citation marks after each claim",
        caption: "Chat answers cite source passages (S) and book sections (B)",
        shape: "phone",
      },
      {
        src: "/projects/studyforge-concept-map.webp",
        alt: "Concept map linking B+ tree, hash index, clustered and non-clustered indexes, full table scan and index",
        caption: "Concept maps are drawn by code, never by the model",
        shape: "wide",
      },
    ],
    highlights: [
      "Hybrid retrieval plus MMR and LLM reranking reached Recall@1 1.00 on 33 labelled questions; dense search alone scored 0.82.",
      "A support check found 37 of 39 book paragraphs backed by their passages (95%). It is a self-check by the same model family, and is reported as one.",
      "16 study formats generated from your own notes, from MCQ quizzes and flashcards to a podcast script.",
      "A new source rewrites only the sections it changes: adding a second source left 6 of 7 sections untouched.",
      "155 backend and 30 frontend tests.",
    ],
    note: "Screenshots show the app's demo mode with sample lecture notes.",
    links: [{ label: "Source on GitHub", href: "https://github.com/Lukey-7/StudyForge" }],
  },
  fintrack: {
    media: [
      {
        src: "/projects/fintrack-home.webp",
        alt: "FinTrack home: net spend of 800 rupees this month, a six-month bar chart, income, spent and savings tiles, and a review prompt",
        caption: "Home: net spend after refunds, with the month in context",
        shape: "phone",
      },
      {
        src: "/projects/fintrack-review.webp",
        alt: "Needs review screen: an SMS whose direction was unclear, with Add it and Not a transaction buttons",
        caption: "Unclear messages wait for review instead of being guessed",
        shape: "phone",
      },
      {
        src: "/projects/fintrack-split.webp",
        alt: "Split bills screen: 1,600 rupees owed by two people for a three-way dinner split",
        caption: "Bill splitting, where only your share counts as spend",
        shape: "phone",
      },
      {
        src: "/projects/fintrack-dark.webp",
        alt: "FinTrack home screen in dark mode",
        caption: "Dark mode; all 114 colour pairs pass WCAG AA",
        shape: "phone",
      },
    ],
    highlights: [
      "Every transaction gets a flow: expense, income, refund, transfer, investment, cash or settlement. Net spend subtracts refunds.",
      "Duplicates count once: matching UPI/IMPS reference numbers, or the same amount within 10 minutes from a different sender.",
      "Statement import (PDF, Excel, CSV or payment-app screenshots) checks the running balance on every row and can be undone.",
      "Bill OCR uses bundled Latin and Devanagari models, so it works offline.",
      "786 unit tests across 12 releases, v1.0.0 to v1.5.2.",
    ],
    note: "Screenshots use a synthetic test inbox; no real financial data.",
    links: [{ label: "Source on GitHub", href: "https://github.com/Lukey-7/Personal_Finance_app" }],
  },
  mara: {
    media: [
      {
        src: "/projects/mara-answer.webp",
        alt: "A MARA answer: the question as title, a five-stage plan, find, read, check and write track, the cited answer, and quoted sources in the margin",
        caption: "Every factual sentence cites a source; the quoted sentence is highlighted",
        shape: "wide",
      },
      {
        src: "/projects/mara-ask.webp",
        alt: "The MARA Ask screen: a question box, suggested questions, recent answers and library counts",
        caption: "Ask screen over the sample library: 18 documents, 317 passages",
        shape: "wide",
      },
    ],
    highlights: [
      "On 35 questions over 317 chunks, Recall@5 rose from 0.857 (dense only) to 0.929 with hybrid search and cross-encoder reranking. Reranking costs about 1.8 s per query on a CPU.",
      "Citation validity is 1.0 by construction: a note survives only if its quote appears verbatim in the cited chunk.",
      "The answer eval includes one deliberately unanswerable question. Every model replied that no evidence was found instead of inventing a figure.",
      "Five agents (planner, researcher, summariser, critic, writer) share one state object, with a trace per run.",
      "112 tests run with a fake LLM, fake embeddings and fakeredis.",
    ],
    note: "Screenshots from the project README, over its CC BY-SA Wikipedia sample corpus.",
    links: [{ label: "Source on GitHub", href: "https://github.com/Lukey-7/mara" }],
  },
  axiomquant: {
    media: [
      {
        src: "/projects/axiomquant/walk_forward.svg",
        alt: "Walk-forward chart over 19 folds comparing in-sample and out-of-sample Sharpe ratios",
        caption: "Walk-forward: fitted Sharpe 1.03 in sample, 0.38 out of sample",
        shape: "wide",
      },
      {
        src: "/projects/axiomquant/parameter_sweep.svg",
        alt: "Heatmap of in-sample Sharpe ratios for 41 moving-average parameter pairs",
        caption: "The best of 41 parameter pairs is the luckiest, not a forecast",
        shape: "wide",
      },
      {
        src: "/projects/axiomquant/benchmark.svg",
        alt: "Bar chart of C++ throughput relative to vectorised NumPy at one, two and four threads",
        caption: "C++ against vectorised NumPy, log scale",
        shape: "wide",
      },
    ],
    highlights: [
      "Walk-forward over 19 folds: mean in-sample Sharpe 1.03 against 0.38 out of sample, the cost of fitting parameters.",
      "Survivorship bias, measured: momentum returned +957.7% on five stocks picked with hindsight, but +106.6% on the point-in-time S&P 500 universe.",
      "The portfolio optimiser is cross-checked against cvxpy to 1e-8 in CI; the check found a real risk-parity bug.",
      "A stationary block bootstrap of Sharpe runs 7.1× faster than NumPy on four threads (2.7× on one).",
      "89 C++ test cases and 34 Python tests on Linux GCC, macOS Clang, Windows MSVC and a sanitizer build.",
    ],
    note: "Research and methodology figures, not investment advice.",
    links: [{ label: "Source on GitHub", href: "https://github.com/Lukey-7/AxiomQuant" }],
  },
  sprachweg: {
    media: [
      {
        src: "/projects/sprachweg-review.webp",
        alt: "FSRS memory review card asking for the German for the speed limit, with an example sentence",
        caption: "FSRS spaced-repetition review",
        shape: "wide",
      },
      {
        src: "/projects/sprachweg-dictionary.webp",
        alt: "Dictionary entry for fahren with pronunciation, CEFR level, definition and conjugation",
        caption: "Dictionary entry with conjugation and usage notes",
        shape: "wide",
      },
    ],
    highlights: [
      "A daily five-step session: FSRS review, a grammar lesson with drills, sentence mining, speaking feedback and graded reading.",
      "Installable PWA with offline caching; speech input uses the browser's Web Speech API.",
      "React and Vite on the client; Express as a single Vercel function; Postgres through Prisma. Gemini runs only on the server.",
      "118 server tests.",
    ],
    note: "Screenshots from an earlier build. The source is private.",
  },
  tetris: {
    media: [
      {
        src: "/projects/arcade-tetris.webp",
        alt: "Tetris-89 arcade portal in the Game Boy theme, with game modes and a game in progress",
        caption: "Tetris-89 in the Game Boy theme",
        shape: "wide",
      },
      {
        src: "/projects/arcade-star-vanguard.webp",
        alt: "Star Vanguard space shooter in the Cyberpunk Neon theme, at the start of stage one",
        caption: "Star Vanguard, the Galaga-style shooter in the same arcade",
        shape: "wide",
      },
    ],
    highlights: [
      "Modes: Marathon, 40-Line Sprint, 2-Minute Blitz, Zen and a Daily challenge.",
      "A chiptune jukebox with three tracks and six sound effects, synthesised with Web Audio; no audio files.",
      "A floating companion widget with a Pomodoro timer, four colour themes and rebindable keys.",
      "Plain HTML, CSS and JavaScript with no build step; an Android build wraps it in Flutter.",
    ],
    play: {
      label: "Play it here",
      src: "/play/arcade/index.html",
      title: "Lukey Arcade: Tetris-89, playable",
    },
    links: [{ label: "Source on GitHub", href: "https://github.com/Lukey-7/Lukey-tetris" }],
  },
};

/** Lukey Arcade's case entry; its source is public and a playable copy is hosted here. */
export const tetrisCase = {
  id: "tetris",
  name: "Tetris / Lukey Arcade",
  category: "Game project",
  description:
    "A retro arcade with Tetris, timed game modes, a floating companion and synthesised chiptune audio.",
  facts: [
    ["5", "Tetris game modes"],
    ["0", "audio files: all sound is synthesised"],
  ],
  ownership: "Independent project. Game engine, interface, audio and the Android wrapper.",
  github: "https://github.com/Lukey-7/Lukey-tetris",
};

/**
 * The words on the monochrome site, in one place. Edit copy here, not in the
 * components. Facts live elsewhere: resume facts in src/data/profile.ts,
 * project facts in src/data/portfolio.ts, and the checked numbers, screenshots
 * and pitch lines for each project in ./projectShowcase.ts.
 *
 * Style: plain sentences that say something only Varun could say. Numbers only
 * with their scope. No slogans. A heading has two lines: the claim, then the
 * context (the second line renders muted).
 */

/** When the words or facts last changed. Shown in the footer and the hero terminal. */
const UPDATED = "October 2026";

/** A section label: the bracketed index on the left, a short descriptor on the right. */
type Label = readonly [string, string];
/** A two-line heading: the claim, then the context. */
type Heading = readonly [string, string];

export const content = {
  updated: UPDATED,

  hero: {
    eyebrow: "AI engineer / LetsTute / Mumbai",
    title: ["I build AI that", "shows its sources."] as Heading,
    intro:
      "I'm Varun Darji, an AI engineer at LetsTute in Mumbai. I work on document extraction, retrieval and agent workflows for client systems. In my own projects I score every retrieval change against a baseline before I keep it.",
    now: {
      label: "Also",
      text: "I have written a research proposal on cutting the cost of running LLM assistants",
      href: "#research",
    },
    primary: "See the projects",
    secondary: "Resume",
    artLabel: ["KNOT / SPHERE / WAVE", "DRAG TO SPIN / CLICK TO MORPH"] as Label,
  },

  heroTerminal: {
    path: "~/varun",
    file: "now.txt",
    updated: UPDATED,
    rows: [
      ["role", "AI engineer, LetsTute"],
      ["work", "ERP extraction, agents"],
      ["study", "LLM inference cost"],
    ] as [string, string][],
    projects: [
      ["StudyForge", "answers that cite your notes"],
      ["FinTrack", "bank SMS to a clean ledger"],
      ["MARA", "notes that keep their quotes"],
    ] as [string, string][],
    link: "Open the full terminal",
  },

  stack: {
    intro: "What I reach for most days.",
    tools: ["Python", "FastAPI", "LangGraph", "TypeScript", "PostgreSQL", "Docker"],
  },

  capabilities: {
    label: ["[ 01 / AI CAPABILITIES ]", "FROM PROJECTS AND CLIENT WORK"] as Label,
    title: ["What I work on,", "and where I have used it."] as Heading,
    intro:
      "Six kinds of AI work, each from one of my projects or from client work at LetsTute. Choose a card to jump to where it was used.",
  },

  work: {
    label: ["[ 02 / SELECTED PROJECTS ]", "BUILT ON MY OWN"] as Label,
    title: ["Six projects I built on my own,", "each with a demo you can try."] as Heading,
    intro:
      "Open a project for screenshots, the idea behind it and a small working version that runs in your browser.",
    archive: { experimental: "Experimental: DND AI Game", all: "Browse the full archive" },
  },

  activity: {
    label: ["[ 03 / ACTIVITY ]"] as const,
    title: ["Public GitHub activity", "over the last twelve months."] as Heading,
    intro:
      "Commits, pull requests and issues in my public repositories. Client work lives in private repositories, so it is not counted here.",
  },

  research: {
    label: ["[ 06 / RESEARCH ]", "PROPOSAL / NOT YET RUN"] as Label,
    title: ["Can an LLM assistant cost less", "and answer just as well?"] as Heading,
    intro:
      "My research proposal sets out two studies on cutting inference cost, each a hypothesis to test. Neither has been run yet. Below each one, you can try the idea it tests.",
  },

  console: {
    label: ["[ 07 / TERMINAL ]", "KEYBOARD-FRIENDLY"] as Label,
    title: ["The same resume,", "as a terminal."] as Heading,
    intro: "Type help to see the commands. Every answer comes from the data behind this page.",
  },

  experience: {
    title: ["Where I work now,", "and what came before."] as Heading,
    intro:
      "I joined LetsTute as an AI engineer in August 2026. Before that I was a Java backend intern on a fintech platform and a student intern at my university.",
    confidential:
      "Client systems are private. I can talk through the architecture, my part and the engineering decisions without sharing confidential access or data.",
  },

  about: {
    label: "A little about me",
    title: ["Curious about the model.", "Responsible for the system."] as Heading,
    body: [
      "I'm Varun, an AI engineer in Mumbai. I enjoy the work between an interesting model and a useful application: retrieval, backend APIs, evaluation and the interface someone actually uses.",
      "Outside client work, I build learning tools and an on-device finance app, and study how to reduce LLM inference costs.",
    ],
    toolbox: [
      ["Build", "Python, FastAPI, TypeScript, React, Java, C++"],
      ["Reason", "RAG, LangGraph, LlamaIndex, hybrid retrieval, evaluation"],
      ["Deliver", "PostgreSQL, Docker, GitHub Actions, GCP, AWS"],
    ] as [string, string][],
  },

  /** Multi-page site only: the home page's pointer to /about. */
  aboutTeaser: {
    label: ["[ 09 / ABOUT ]", "MUMBAI / IST"] as Label,
    text: "I'm Varun, an AI engineer at LetsTute in Mumbai, with an M.Sc. in Computer Science. I enjoy the work between an interesting model and a useful application: retrieval, backend APIs, evaluation and the interface someone actually uses.",
    link: "Experience, education and toolbox",
  },

  /** Multi-page site only: the latest journey entries on the home page. */
  journeyTeaser: {
    label: ["[ 08 / JOURNEY ]", "LATEST ENTRIES"] as Label,
    title: ["What I have been doing,", "most recent first."] as Heading,
    link: "The whole journey",
  },

  /** Multi-page site only: /journey. */
  journeyPage: {
    label: ["[ JOURNEY / LOG ]", "NEWEST FIRST"] as Label,
    category: "A running log",
    title: ["Work, projects and study,", "dated as they happened."] as Heading,
    intro:
      "I add a line when something ships, starts or changes. Dates come from my résumé and from GitHub.",
    now: "Now",
  },

  /** Multi-page site only: /writing. */
  writingPage: {
    label: ["[ WRITING ]", "NOTES ON THE WORK"] as Label,
    title: ["Write-ups on what I built", "and what I measured."] as Heading,
    intro: "Longer notes behind the projects, with every number taken from the project's own results.",
  },

  /** Multi-page site only: the research page header. */
  researchPage: {
    label: ["[ RESEARCH / PROPOSAL ]", "TWO STUDIES / NOT YET RUN"] as Label,
    category: "Research proposal",
    intro:
      "My proposal, reducing inference cost in large language model assistants, sets out two studies on the cost of LLM assistants. Each is a hypothesis to test against simpler baselines, and neither has been run yet. Each study below has a small interactive version of its idea.",
    interests: {
      title: "Research interests",
      items: [
        "Efficient inference: what an LLM assistant can stop sending or recomputing without answering worse.",
        "Memory: keeping a user's changing requirements without resending the whole conversation.",
        "Evaluation: scoring retrieval and answers against simple baselines before trusting a change.",
      ],
    },
  },

  /** Multi-page site only: /play. */
  playPage: {
    label: ["[ PLAY / LUKEY ARCADE ]", "TWO GAMES / NO BUILD STEP"] as Label,
    title: ["Two games I built", "to play in the browser."] as Heading,
    intro:
      "A Game Boy-style Tetris with five modes and a Galaga-style space shooter. Plain HTML, CSS and JavaScript, with every sound synthesised by Web Audio. Pick a cartridge and press start.",
    link: "How they are built",
  },

  contact: {
    title: ["Write to me about a role,", "a research position or a project."] as Heading,
  },
} as const;

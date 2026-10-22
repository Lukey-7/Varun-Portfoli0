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

/** A section label: the bracketed index on the left, a short descriptor on the right. */
type Label = readonly [string, string];
/** A two-line heading: the claim, then the context. */
type Heading = readonly [string, string];

export const content = {
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
    /** Change this whenever the rows below change. */
    updated: "Oct 2026",
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

  contact: {
    title: ["Write to me about a project", "here, or about the research."] as Heading,
  },
} as const;

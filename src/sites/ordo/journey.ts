/**
 * The journey log, newest first. Add one entry when something ships or
 * changes; the /journey page, the home teaser and the share previews read it.
 *
 * `date` is "YYYY-MM" when the month is known, or "YYYY". Dates come from the
 * résumé, GitHub (repository and release dates) or the work itself.
 */
export type JourneyKind = "work" | "project" | "research" | "writing" | "education" | "site";

export interface JourneyEntry {
  date: string;
  kind: JourneyKind;
  title: string;
  text?: string;
  /** A page on this site. */
  to?: string;
  /** Somewhere else. */
  href?: string;
}

export const journeyKinds: { id: JourneyKind; label: string }[] = [
  { id: "work", label: "Work" },
  { id: "project", label: "Projects" },
  { id: "research", label: "Research" },
  { id: "writing", label: "Writing" },
  { id: "education", label: "Education" },
  { id: "site", label: "This site" },
];

export const journey: JourneyEntry[] = [
  {
    date: "2026-10",
    kind: "site",
    title: "Rebuilt this site around working demos",
    text: "Every project now has a small version you can try in the browser, next to its screenshots and the idea behind it.",
    to: "/#work",
  },
  {
    date: "2026-10",
    kind: "writing",
    title: "Wrote up what 33 questions showed about StudyForge's retrieval",
    text: "BM25 beat dense search at rank 1, and the reranker, not fusion, closed the gap.",
    to: "/writing/studyforge-evaluation",
  },
  {
    date: "2026-10",
    kind: "research",
    title: "Research proposal on cutting LLM inference cost",
    text: "Two studies, adaptive conversation memory and a calibrated retry policy, written up for supervisory review.",
    to: "/research",
  },
  {
    date: "2026-10",
    kind: "project",
    title: "FinTrack v1.5.2",
    text: "Twelve releases in a month, from v1.0.0 on 17 September, with 786 unit tests by the last one.",
    to: "/work/fintrack",
  },
  {
    date: "2026-09",
    kind: "project",
    title: "Built MARA",
    text: "Five agents answer research questions, and a note survives only if its quote appears word for word in the source.",
    to: "/work/mara",
  },
  {
    date: "2026-09",
    kind: "project",
    title: "Measured StudyForge's retrieval",
    text: "On 33 labelled questions, the LLM rerank layer took Recall@1 from 0.82 to 1.00.",
    to: "/writing/studyforge-evaluation",
  },
  {
    date: "2026-09",
    kind: "project",
    title: "Shipped FinTrack v1.0.0",
    text: "An Android app that turns bank SMS into a ledger on the phone.",
    to: "/work/fintrack",
  },
  {
    date: "2026-08",
    kind: "work",
    title: "Joined LetsTute as an AI engineer",
    text: "Agent workflows for a lead-generation platform, document extraction for a client ERP, and the KiranOS iOS app.",
    to: "/about#experience",
  },
  {
    date: "2026-08",
    kind: "project",
    title: "Started AxiomQuant",
    text: "A C++20 backtesting engine built to catch results that only look good because of luck, hindsight or unpaid costs.",
    to: "/work/axiomquant",
  },
  {
    date: "2026-08",
    kind: "project",
    title: "Built Lukey Arcade",
    text: "Tetris-89 and Star Vanguard, in plain JavaScript with every sound synthesised.",
    to: "/play",
  },
  {
    date: "2026",
    kind: "education",
    title: "M.Sc. Computer Science",
    text: "Somaiya Vidyavihar University, Mumbai. CGPA 8.6.",
    to: "/about",
  },
  {
    date: "2026-05",
    kind: "project",
    title: "Experimented with an LLM game master",
    text: "DND AI Game: keeping narrative state consistent across a tabletop campaign.",
    href: "https://github.com/Lukey-7/DND-AI-Game-beta",
  },
  {
    date: "2026-04",
    kind: "project",
    title: "Started StudyForge",
    text: "Upload notes, get a cited textbook, study tools and a chat that points to the passage behind each answer.",
    to: "/work/studyforge",
  },
  {
    date: "2026-04",
    kind: "work",
    title: "Finished the Java backend internship at Tech IT Research",
  },
  {
    date: "2025-12",
    kind: "work",
    title: "Java backend intern at Tech IT Research",
    text: "Spring Boot services for a fintech platform, including the PayPal AddTracking API.",
  },
  {
    date: "2025",
    kind: "education",
    title: "PG Diploma in Cyber Security",
    text: "St. Xavier's Technical Institute.",
  },
  {
    date: "2025-04",
    kind: "work",
    title: "Finished the student internship at Somaiya",
  },
  {
    date: "2024-07",
    kind: "work",
    title: "Student intern at Somaiya Vidyavihar University",
    text: "Automated administrative workflows and validated 500+ records a semester.",
  },
  {
    date: "2024",
    kind: "education",
    title: "BCA",
    text: "Tilak Maharashtra Vidyapeeth. CGPA 8.2.",
  },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10" → "Oct 2026"; "2026" → "2026". */
export function formatJourneyDate(date: string) {
  const [year, month] = date.split("-");
  return month ? `${MONTHS[Number(month) - 1]} ${year}` : year;
}

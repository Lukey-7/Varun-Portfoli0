/**
 * The research log, newest first. Add one entry when something is read, run or
 * written around the proposal; the /research page reads it.
 *
 * `date` is "YYYY-MM" when the month is known, or "YYYY", as in journey.ts.
 * Give an entry `to` for a page on this site (or a `#section` of /research),
 * `href` for somewhere else, or neither. `text` is one sentence with its scope.
 */
export type ResearchLogKind = "proposal" | "write-up" | "reading" | "experiment";

export interface ResearchLogEntry {
  date: string;
  kind: ResearchLogKind;
  title: string;
  text?: string;
  /** A page on this site, or a #section of the research page. */
  to?: string;
  /** Somewhere else. */
  href?: string;
}

export const researchLogKinds: Record<ResearchLogKind, string> = {
  proposal: "Proposal",
  "write-up": "Write-up",
  reading: "Reading",
  experiment: "Experiment",
};

export const researchLog: ResearchLogEntry[] = [
  {
    date: "2026-10",
    kind: "write-up",
    title: "What 33 questions showed about StudyForge's retrieval",
    text: "BM25 beat dense search at rank 1, and the reranker, not fusion, closed the gap.",
    to: "/writing/studyforge-evaluation",
  },
  {
    date: "2026-10",
    kind: "proposal",
    title: "Proposal: reducing inference cost in LLM assistants",
    text: "Two studies, adaptive conversation memory and a calibrated retry policy. Neither has been run yet.",
    to: "#studies",
  },
  // To add an entry, copy this to the top of the list (newest first) and fill it in:
  // {
  //   date: "2026-11",
  //   kind: "reading", // "proposal" | "write-up" | "reading" | "experiment"
  //   title: "What I read or ran, in a few words",
  //   text: "One sentence on what it showed, with its scope.",
  //   href: "https://example.org/the-paper", // or `to: "/writing/..."` for a page on this site
  // },
];

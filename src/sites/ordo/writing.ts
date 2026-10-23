/**
 * Write-ups, as structured blocks so they render in the site's own type.
 * Inline `code` in backticks is supported in paragraphs and list items.
 * Every number must come from the project's own results files.
 */
export type WritingBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "list"; items: string[] }
  | { type: "table"; caption: string; head: string[]; rows: string[][]; highlight?: number }
  | { type: "bars"; caption: string; max: number; bars: { label: string; value: number }[]; highlight?: number };

export interface Post {
  slug: string;
  /** Two lines, like every heading on the site. */
  title: [string, string];
  date: string;
  summary: string;
  readingMinutes: number;
  /** The project page this write-up belongs to, by slug. */
  project?: string;
  body: WritingBlock[];
  sources: { label: string; href: string }[];
}

export const posts: Post[] = [
  {
    slug: "studyforge-evaluation",
    title: ["What 33 questions showed", "about StudyForge's retrieval."],
    date: "2026-10",
    summary:
      "BM25 beat dense search at rank 1, rank fusion did not move it, and the LLM reranker closed the gap. Notes from a small benchmark, and what it does not prove.",
    readingMinutes: 4,
    project: "studyforge",
    body: [
      {
        type: "p",
        text: "StudyForge answers questions from your own notes and cites the passage behind each answer. If retrieval puts the wrong passage first, the answer cites the wrong source, so rank 1 matters most here.",
      },
      { type: "h2", text: "The benchmark" },
      {
        type: "p",
        text: "The repository has a small evaluation: three short study documents and 33 questions. Each question is labelled with an answer phrase rather than a chunk id, and a retrieved chunk counts as relevant if it contains that phrase, so the labels survive changes to the chunker. Questions are tagged keyword, when they reuse the document's words, or paraphrase, when they don't.",
      },
      {
        type: "p",
        text: "Chunks are 200 tokens with 15% overlap, smaller than in the app. At 600 tokens the three documents made only about a dozen chunks and every method looked perfect, so the benchmark could not tell the layers apart. It runs with `python -m eval.run_eval` and writes `eval/results.md`.",
      },
      { type: "h2", text: "The results" },
      {
        type: "table",
        caption: "33 questions over three documents (33 chunks), run on 29 September 2026.",
        head: ["Retrieval", "Recall@1", "Recall@5", "MRR@10"],
        rows: [
          ["Dense only", "0.82", "0.97", "0.89"],
          ["BM25 only", "0.91", "0.97", "0.94"],
          ["Hybrid (rank fusion)", "0.82", "1.00", "0.90"],
          ["Hybrid + MMR", "0.82", "1.00", "0.90"],
          ["Hybrid + MMR + LLM rerank", "1.00", "1.00", "1.00"],
        ],
        highlight: 4,
      },
      {
        type: "bars",
        caption: "Questions with the right passage ranked first, out of 33.",
        max: 33,
        bars: [
          { label: "Dense only", value: 27 },
          { label: "BM25 only", value: 30 },
          { label: "Hybrid", value: 27 },
          { label: "Hybrid + MMR", value: 27 },
          { label: "+ LLM rerank", value: 33 },
        ],
        highlight: 4,
      },
      { type: "h2", text: "What the numbers say" },
      {
        type: "list",
        items: [
          "BM25 alone beat dense search at rank 1: 30 of 33 against 27. The notes use exact textbook terms, and keyword search rewards that.",
          "Rank fusion fixed dense search's one top-5 miss (Recall@5 0.97 → 1.00) but did not move rank 1. MMR, which removes near-duplicate overlapping chunks, did not move it either.",
          "The LLM rerank layer did the work at rank 1, taking it from 27 to 33.",
          "By question type, dense search did a little better on paraphrased questions (MRR 0.91 against 0.88 on keyword ones), and BM25 better on keyword questions (0.97 against 0.91).",
        ],
      },
      { type: "h2", text: "What it does not show" },
      {
        type: "list",
        items: [
          "It is small. One question is three points of Recall@1, and 33 of 33 is still consistent with a true miss rate of about one in ten: the 95% interval for 33 out of 33 runs from 0.89 to 1.00.",
          "The questions and labels were written for the repository and used to compare layers, so this is a development check, not a held-out benchmark.",
          "1.00 means no misses on this set, not that retrieval is perfect on someone else's notes.",
          "It does not measure what the extra rerank call costs per question, in time or money.",
        ],
      },
      { type: "h2", text: "What I would change next" },
      {
        type: "list",
        items: [
          "A larger question set, written separately from development and kept back until the end.",
          "Labels checked by someone other than the person tuning the pipeline.",
          "Counts and intervals in every table, so a small set cannot pass for a big one.",
          "Latency and cost per question next to every accuracy number, so the reranker has to earn its place.",
        ],
      },
    ],
    sources: [
      { label: "The results file", href: "https://github.com/Lukey-7/StudyForge/blob/main/backend/eval/results.md" },
      { label: "StudyForge on GitHub", href: "https://github.com/Lukey-7/StudyForge" },
    ],
  },
];

export function findPost(slug: string | undefined) {
  return posts.find((post) => post.slug === slug);
}

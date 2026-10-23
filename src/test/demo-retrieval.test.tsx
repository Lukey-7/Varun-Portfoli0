import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBm25Index,
  createTrigramIndex,
  mmrSelect,
  reciprocalRankFusion,
  splitSentences,
  stem,
  termCoverage,
  tokenize,
} from "@/sites/ordo/demos/retrieval";
import StudyForgeDemo, { askNotes, makeFlashcards, NOTES, PRESETS } from "@/sites/ordo/demos/StudyForgeDemo";
import MaraDemo, {
  LIBRARY,
  PRESETS as MARA_PRESETS,
  planQuestion,
  quoteAppears,
  reword,
  runMara,
} from "@/sites/ordo/demos/MaraDemo";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete document.documentElement.dataset.motion;
});

describe("retrieval toolkit", () => {
  it("stems common inflections onto one form and drops stopwords", () => {
    expect(new Set(["indexes", "indexing", "indexed", "index", "indices"].map(stem))).toEqual(new Set(["index"]));
    expect(stem("queries")).toBe("query");
    expect(stem("scanning")).toBe(stem("scan"));
    expect(stem("leaves")).toBe(stem("leaf"));
    expect(stem("adding")).toBe(stem("add"));
    // Comparatives are left alone, which keyword search then misses.
    expect(stem("slower")).not.toBe(stem("slow"));
    expect(tokenize("What does a B+ tree keep in its leaves?")).toEqual(["b+", stem("tree"), "keep", "leaf"]);
  });

  it("splits sentences into exact slices of the text", () => {
    const text = "Rows take 2.5 ms. Indexes help! Do they cost? Yes, on writes.";
    const sentences = splitSentences(text);
    expect(sentences).toEqual(["Rows take 2.5 ms.", "Indexes help!", "Do they cost?", "Yes, on writes."]);
    sentences.forEach((sentence) => expect(text).toContain(sentence));
  });

  it("scores BM25 by rare terms and returns only passages that match", () => {
    const index = createBm25Index([
      { id: "a", text: "A hash index maps each key to a bucket." },
      { id: "b", text: "An index on a column speeds up a query." },
      { id: "c", text: "Coral reefs grow in shallow water." },
    ]);
    const hits = index.search("hash index");
    expect(hits.map((hit) => hit.id)).toEqual(["a", "b"]);
    expect(index.idf("hash")).toBeGreaterThan(index.idf("index"));
    expect(index.search("bread")).toEqual([]);
  });

  it("rewards shared word parts in the trigram similarity", () => {
    const similarity = createTrigramIndex([
      { id: "index", text: "Without an index the database reads every row." },
      { id: "reef", text: "Coral reefs protect coastlines from waves." },
    ]);
    const [top] = similarity.search("unindexed lookups");
    expect(top.id).toBe("index");
    expect(similarity.between("index", "index")).toBeCloseTo(1, 6);
    expect(similarity.compare("coral reef", "reefs of coral")).toBeGreaterThan(similarity.compare("coral reef", "hash bucket"));
  });

  it("fuses rankings with 1 / (60 + rank)", () => {
    const fused = reciprocalRankFusion([
      ["a", "b", "c"],
      ["b", "a", "d"],
    ]);
    expect(fused[0].score).toBeCloseTo(1 / 61 + 1 / 62, 12);
    // a and b tie; the first ranking breaks the tie.
    expect(fused.map((hit) => hit.id)).toEqual(["a", "b", "c", "d"]);
    expect(fused[2].score).toBeCloseTo(1 / 63, 12);
  });

  it("lets MMR skip a near-duplicate in favour of a different passage", () => {
    const similarity = (x: string, y: string) => (x + y === "AB" || x + y === "BA" ? 0.9 : 0.1);
    const picks = mmrSelect(
      [
        { id: "A", score: 1 },
        { id: "B", score: 0.95 },
        { id: "C", score: 0.9 },
      ],
      similarity,
      { k: 3, lambda: 0.7 },
    );
    expect(picks.map((pick) => pick.id)).toEqual(["A", "C", "B"]);
    expect(picks[2].redundancy).toBeCloseTo(0.9);
  });

  it("measures term coverage by idf weight", () => {
    const idf = (term: string) => (term === "hash" ? 3 : 1);
    expect(termCoverage(["hash", "index"], "a hash table", idf)).toBeCloseTo(0.75);
    expect(termCoverage([], "anything", idf)).toBe(0);
  });
});

describe("StudyForge pipeline", () => {
  const top = (question: string, mode: "keyword" | "similarity" | "hybrid") => askNotes(question, mode).orders[mode][0];
  const passageText = new Map(NOTES.map((note) => [note.id, note.text]));

  it("finds the labelled passage with hybrid retrieval where each retriever alone misses it", () => {
    const question = PRESETS[0].question;
    expect(PRESETS[0].best).toBe("S3");
    expect(top(question, "keyword")).toBe("S5");
    expect(top(question, "similarity")).toBe("S1");
    expect(top(question, "hybrid")).toBe("S3");
    const result = askNotes(question, "hybrid");
    expect(result.orders.keyword.indexOf("S3")).toBe(1);
    expect(result.orders.similarity.indexOf("S3")).toBe(1);
    expect(result.answer.every((sentence) => sentence.noteId === "S3")).toBe(true);
  });

  it("shows keyword search taking the wrong sense of a word", () => {
    const { question, best } = PRESETS[1];
    expect(best).toBe("S7");
    expect(top(question, "keyword")).not.toBe("S7");
    expect(top(question, "similarity")).toBe("S7");
    expect(top(question, "hybrid")).toBe("S7");
  });

  it("quotes 2-3 sentences verbatim from the passages it cites", () => {
    for (const { question, best } of PRESETS.filter((preset) => preset.best)) {
      for (const mode of ["keyword", "similarity", "hybrid"] as const) {
        const { answer } = askNotes(question, mode);
        expect(answer.length).toBeGreaterThanOrEqual(2);
        expect(answer.length).toBeLessThanOrEqual(3);
        answer.forEach((sentence) => {
          expect(passageText.get(sentence.noteId)).toContain(sentence.text);
          expect(splitSentences(passageText.get(sentence.noteId) ?? "")[sentence.index]).toBe(sentence.text);
        });
      }
      expect(askNotes(question, "hybrid").answer[0].noteId).toBe(best);
    }
  });

  it("says nothing answers a question the notes do not cover", () => {
    const question = PRESETS[3].question;
    for (const mode of ["keyword", "similarity", "hybrid"] as const) {
      const result = askNotes(question, mode);
      expect(result.answer).toEqual([]);
      expect(result.reason).toMatch(/postgresql/);
    }
    expect(askNotes("How do I bake bread?", "keyword").reason).toMatch(/No passage shares a keyword/);
    expect(askNotes("What is it?", "hybrid").answer).toEqual([]);
  });

  it("makes three cloze cards from a passage's key terms", () => {
    const cards = makeFlashcards("S4");
    expect(cards.map((card) => card.term)).toEqual(["hash function", "constant time", "range queries"]);
    const sentences = splitSentences(passageText.get("S4") ?? "");
    cards.forEach((card) => expect(sentences).toContain(`${card.before}${card.term}${card.after}`));
  });
});

describe("MARA pipeline", () => {
  const chunkText = new Map(LIBRARY.map((chunk) => [chunk.id, chunk.text]));

  it("checks quotes verbatim, ignoring only case and spacing", () => {
    const text = "Coral reefs cover less than one percent of the ocean floor.";
    expect(quoteAppears("coral reefs  cover LESS than one percent", text)).toBe(true);
    expect(quoteAppears("Coral reefs cover under one percent", text)).toBe(false);
    expect(quoteAppears("Coral reefs cover less than one percent of the ocean floor!", text)).toBe(false);
    expect(quoteAppears("   ", text)).toBe(false);
    expect(reword("A press could turn out copies.")).toBe("A press could produce copies.");
  });

  it("splits compound questions and reads a trailing 'it' as the first name", () => {
    expect(planQuestion(MARA_PRESETS[3].question).subQuestions).toEqual([
      "How much did the Perseverance rover cost?",
      "Who paid for Perseverance?",
    ]);
    expect(planQuestion("What is coral bleaching?").subQuestions).toEqual(["What is coral bleaching?"]);
  });

  it("drops the reworded note in the summariser, so the critic and writer see verified notes only", () => {
    for (const { question } of MARA_PRESETS.slice(0, 3)) {
      const trace = runMara(question);
      expect(trace.plan.subQuestions).toHaveLength(2);
      const dropped = trace.notes.filter((note) => !note.verified);
      expect(dropped).toHaveLength(1);
      expect(dropped[0].slip).toBe(true);
      trace.notes.forEach((note) => expect(note.verified).toBe(chunkText.get(note.chunkId)?.includes(note.quote)));
      // Coverage is computed from verified notes alone.
      expect(trace.coverage.every((ids) => ids.length > 0)).toBe(true);
      expect(trace.coverage.flat()).not.toContain(dropped[0].id);
      expect(trace.conflicts).toEqual([]);
      expect(trace.answer.sentences.map((sentence) => sentence.source)).toEqual([1, 2]);
      expect(trace.answer.sentences.map((sentence) => sentence.text)).not.toContain(dropped[0].quote);
      trace.answer.sources.forEach((source) =>
        source.quotes.forEach((quote) => expect(chunkText.get(source.chunkId)).toContain(quote)),
      );
    }
  });

  it("answers the unanswerable question with no evidence instead of a figure", () => {
    const trace = runMara(MARA_PRESETS[3].question);
    expect(trace.notes.filter((note) => note.verified)).toHaveLength(0);
    expect(trace.coverage).toEqual([[], []]);
    expect(trace.answer.sentences).toEqual([]);
    expect(trace.answer.missing).toEqual(expect.arrayContaining(["cost", "paid"]));
    expect(trace.research[0][0].id).toBe("M4");
  });
});

describe("demo interactions", () => {
  it("compares retrieval modes and highlights a cited sentence in its passage", () => {
    const { container } = render(<StudyForgeDemo />);
    expect(screen.getByRole("button", { name: PRESETS[0].question })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Keyword ranks it 2nd, similarity 2nd, hybrid 1st/)).toBeInTheDocument();
    const citation = screen.getAllByRole("button", { name: /^Source S3, B\+ trees/ })[0];
    const firstSentence = "A B+ tree is a balanced search tree that keeps its keys in sorted order.";
    fireEvent.focus(citation);
    expect(container.querySelector("mark")).toHaveTextContent(firstSentence);
    fireEvent.blur(citation);
    expect(container.querySelector("mark")).toBeNull();
    // A click pins the highlight, so it stays after focus moves on.
    fireEvent.click(citation);
    fireEvent.blur(citation);
    expect(citation).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelector("mark")).toHaveTextContent(firstSentence);

    fireEvent.click(screen.getByRole("button", { name: "Keyword only" }));
    expect(screen.getByRole("button", { name: "Keyword only" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("button", { name: /^Source S5/ }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Make 3 flashcards from S5/ }));
    expect(screen.getByRole("list", { name: "Flashcards from S5" }).children).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: PRESETS[3].question }));
    expect(screen.getByText("Nothing in these notes answers that.")).toBeInTheDocument();

    const input = screen.getByRole("textbox", { name: "Your question" });
    fireEvent.change(input, { target: { value: "What is a covering index?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(screen.getAllByRole("button", { name: /^Source S7/ }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Hybrid" }));
    expect(screen.getAllByRole("button", { name: /^Source S6/ }).length).toBeGreaterThan(0);
  });

  it("steps through the five agents: the summariser drops the reworded quote, the critic reports coverage", () => {
    render(<MaraDemo />);
    const next = screen.getByRole("button", { name: "Next step" });
    for (let i = 0; i < 3; i += 1) fireEvent.click(next);
    const trace = screen.getByRole("list", { name: "Agent trace" });
    expect(within(trace).getByText("Dropped")).toBeInTheDocument();
    expect(within(trace).getByText(/The note says “produce”; P2 says “turn out”/)).toBeInTheDocument();
    expect(within(trace).getByText("3 notes proposed, 1 dropped by the quote check")).toBeInTheDocument();

    fireEvent.click(next);
    expect(within(trace).getAllByText("Evidence")).toHaveLength(2);
    expect(within(trace).getByText(/^Conflicts:/)).toHaveTextContent("Conflicts: none.");
    expect(within(trace).queryByText(/struck/i)).toBeNull();
    expect(screen.getByText(/appears here after step 5/)).toBeInTheDocument();

    fireEvent.click(next);
    expect(next).toBeDisabled();
    expect(screen.getByText(/Done\. 2 of 3 notes passed the quote check/)).toBeInTheDocument();
    expect(trace).toHaveTextContent("Answer with 2 sources");
    expect(document.querySelectorAll(".mara-sources mark")).toHaveLength(2);
  });

  it("plays the run on a timer and shows the finished trace at once when motion is paused", () => {
    vi.useFakeTimers();
    render(<MaraDemo />);
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    // Each tick schedules the next one from an effect, so advance tick by tick.
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByText(/Step 1 of 5: planner/)).toBeInTheDocument();
    for (let tick = 0; tick < 4; tick += 1) {
      act(() => {
        vi.advanceTimersByTime(1200);
      });
    }
    expect(screen.getByText(/Done\. 2 of 3 notes passed the quote check/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run again" })).toBeInTheDocument();
    cleanup();

    document.documentElement.dataset.motion = "paused";
    render(<MaraDemo />);
    fireEvent.click(screen.getByRole("button", { name: "Rover budget" }));
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(screen.getByText("No evidence was found in the sample library for this question.")).toBeInTheDocument();
    expect(screen.getByText(/“cost” or “paid”/)).toBeInTheDocument();
    // The critic's report stays open at the end: both sub-questions are gaps.
    const trace = screen.getByRole("list", { name: "Agent trace" });
    expect(within(trace).getAllByText("Gap")).toHaveLength(2);
    expect(within(trace).getByText(/up to 3 new sub-questions to fill a gap; this demo does not loop/)).toBeInTheDocument();
  });
});

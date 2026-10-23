/**
 * A tiny retrieval toolkit shared by the StudyForge and MARA demos. It works
 * on a dozen short passages, so it favours clarity over speed: indexes are
 * plain maps, nothing is cached across calls and every score it produces can
 * be shown to the visitor. No network, no randomness.
 */

export interface Passage {
  id: string;
  text: string;
}

export interface Scored {
  id: string;
  score: number;
}

// A small English stopword list. Question words are included so "why" or
// "how" never count as evidence.
const STOPWORDS = new Set(
  (
    "a about above after again against all also am an and any are as at be because been before being below between " +
    "both but by can could did didn do does doesn doing don down during each etc even ever few for from further get " +
    "gets go goes got had has have having he her here hers him his how i if in into is isn it its itself just let like lot " +
    "lots may me might more most much must my no nor not now of off on once only or other our ours out over own " +
    "rather really same shall she should so some still such than that the their theirs them then there these they " +
    "this those through to too under until up us very via was wasn we were weren what when where which while who " +
    "whom why will with would you your yours"
  ).split(" "),
);

export function isStopword(word: string): boolean {
  return STOPWORDS.has(word.toLowerCase());
}

const VOWEL = /[aeiouy]/;
// "d" is left out so "adding" and "added" stay with "add".
const DOUBLE_END = /([bcfghjkmnpqrtvwx])\1$/;

/** Collapses a doubled final consonant left behind by a suffix ("scann" → "scan"). */
function undouble(word: string): string {
  return DOUBLE_END.test(word) ? word.slice(0, -1) : word;
}

// A few irregular forms that come up in questions about the sample texts.
const IRREGULAR: Record<string, string> = {
  leaves: "leaf",
  indices: "index",
  children: "child",
  built: "build",
  became: "become",
  fell: "fall",
  kept: "keep",
  made: "make",
  held: "hold",
};

/**
 * A light suffix stripper, much gentler than Porter: plurals, -ing, -ed and a
 * final -e, so "indexes", "indexing" and "indexed" all become "index". It
 * knows nothing about synonyms or comparatives ("slow" / "slower"), which is
 * part of why keyword search misses some paraphrases.
 */
export function stem(input: string): string {
  let word = input.toLowerCase();
  if (IRREGULAR[word]) word = IRREGULAR[word];
  if (word.length <= 3) return word;
  if (word.endsWith("ies") && word.length > 4) word = `${word.slice(0, -3)}y`;
  else if (word.endsWith("sses")) word = word.slice(0, -2);
  else if (/(?:x|ch|sh|z)es$/.test(word)) word = word.slice(0, -2);
  else if (word.endsWith("s") && !/(?:ss|us|is)$/.test(word)) word = word.slice(0, -1);

  if (word.endsWith("ied") && word.length > 4) word = `${word.slice(0, -3)}y`;
  else if (word.endsWith("ing") && word.length > 5 && VOWEL.test(word.slice(0, -3)))
    word = undouble(word.slice(0, -3));
  else if (word.endsWith("ed") && !word.endsWith("eed") && word.length > 4 && VOWEL.test(word.slice(0, -2)))
    word = undouble(word.slice(0, -2));

  if (word.endsWith("e") && word.length > 3) word = word.slice(0, -1);
  return word;
}

/** Lower-cased words with possessives removed. Keeps "b+" and "c++" whole. */
export function words(text: string): string[] {
  return (
    text
      .toLowerCase()
      .replace(/['’]s\b/g, "")
      .match(/[a-z0-9]+\+*/g) ?? []
  ).filter((word) => word.length > 1 || /\d/.test(word));
}

/** Content words only, stemmed: what keyword search matches on. */
export function tokenize(text: string): string[] {
  return words(text)
    .filter((word) => !STOPWORDS.has(word))
    .map(stem);
}

/**
 * Splits text into sentences at ., ! or ? followed by a capital or digit.
 * Every sentence is an exact slice of the input, so answers built from
 * these sentences quote their source verbatim.
 */
export function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  const boundary = /[.!?]["')\]]*\s+(?=["'([]?[A-Z0-9])/g;
  let start = 0;
  for (const match of text.matchAll(boundary)) {
    const index = match.index ?? 0;
    sentences.push(text.slice(start, index + match[0].trimEnd().length).trim());
    start = index + match[0].length;
  }
  const rest = text.slice(start).trim();
  if (rest) sentences.push(rest);
  return sentences;
}

function sortScored(scores: Scored[]): Scored[] {
  // Array.prototype.sort is stable, so ties keep the passages' own order.
  return scores.sort((a, b) => b.score - a.score);
}

/* ---------- BM25 ---------- */

export interface Bm25Index {
  /** Passages that share at least one term with the query, best first. */
  search(query: string): Scored[];
  /** Inverse document frequency of a stemmed term (unseen terms score highest). */
  idf(term: string): number;
}

export function createBm25Index(
  passages: Passage[],
  { k1 = 1.2, b = 0.75 }: { k1?: number; b?: number } = {},
): Bm25Index {
  const docs = passages.map((passage) => {
    const terms = tokenize(passage.text);
    const counts = new Map<string, number>();
    terms.forEach((term) => counts.set(term, (counts.get(term) ?? 0) + 1));
    return { id: passage.id, length: terms.length, counts };
  });
  const total = docs.length;
  const averageLength = docs.reduce((sum, doc) => sum + doc.length, 0) / Math.max(total, 1);
  const frequency = new Map<string, number>();
  docs.forEach((doc) => doc.counts.forEach((_, term) => frequency.set(term, (frequency.get(term) ?? 0) + 1)));

  // The Lucene form of BM25's idf, which never goes negative.
  const idf = (term: string) => {
    const df = frequency.get(term) ?? 0;
    return Math.log(1 + (total - df + 0.5) / (df + 0.5));
  };

  const search = (query: string) => {
    const terms = [...new Set(tokenize(query))];
    const scores = docs.map((doc) => {
      let score = 0;
      for (const term of terms) {
        const tf = doc.counts.get(term) ?? 0;
        if (!tf) continue;
        score += (idf(term) * (tf * (k1 + 1))) / (tf + k1 * (1 - b + (b * doc.length) / averageLength));
      }
      return { id: doc.id, score };
    });
    return sortScored(scores.filter((entry) => entry.score > 0));
  };

  return { search, idf };
}

/* ---------- Character-trigram similarity ---------- */

type Vector = Map<string, number>;

function trigrams(text: string): string[] {
  const grams: string[] = [];
  for (const word of words(text)) {
    if (STOPWORDS.has(word)) continue;
    const padded = ` ${word} `;
    for (let i = 0; i + 3 <= padded.length; i += 1) grams.push(padded.slice(i, i + 3));
  }
  return grams;
}

function cosine(a: Vector, b: Vector): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  a.forEach((weight, gram) => {
    normA += weight * weight;
    const other = b.get(gram);
    if (other) dot += weight * other;
  });
  b.forEach((weight) => {
    normB += weight * weight;
  });
  return normA && normB ? dot / Math.sqrt(normA * normB) : 0;
}

export interface SimilarityIndex {
  /** Passages with any trigram in common with the query, most similar first. */
  search(query: string): Scored[];
  /** Cosine similarity between two indexed passages. */
  between(idA: string, idB: string): number;
  /** Cosine similarity between any two texts, weighted by this corpus. */
  compare(textA: string, textB: string): number;
}

/**
 * TF-IDF over character trigrams, compared by cosine. It stands in for a
 * dense embedding model: it rewards shared word parts ("unindexed" and
 * "index") rather than exact terms, but it knows nothing about meaning.
 */
export function createTrigramIndex(passages: Passage[]): SimilarityIndex {
  const counted = passages.map((passage) => {
    const counts = new Map<string, number>();
    trigrams(passage.text).forEach((gram) => counts.set(gram, (counts.get(gram) ?? 0) + 1));
    return { id: passage.id, counts };
  });
  const total = counted.length;
  const frequency = new Map<string, number>();
  counted.forEach((doc) => doc.counts.forEach((_, gram) => frequency.set(gram, (frequency.get(gram) ?? 0) + 1)));
  // Smoothed idf, as in scikit-learn, so every trigram keeps some weight.
  const idf = (gram: string) => Math.log((1 + total) / (1 + (frequency.get(gram) ?? 0))) + 1;

  const weigh = (counts: Map<string, number>): Vector => {
    const vector: Vector = new Map();
    counts.forEach((tf, gram) => vector.set(gram, (1 + Math.log(tf)) * idf(gram)));
    return vector;
  };
  const vectorize = (text: string): Vector => {
    const counts = new Map<string, number>();
    trigrams(text).forEach((gram) => counts.set(gram, (counts.get(gram) ?? 0) + 1));
    return weigh(counts);
  };

  const vectors = new Map(counted.map((doc) => [doc.id, weigh(doc.counts)]));

  const search = (query: string) => {
    const target = vectorize(query);
    const scores = [...vectors].map(([id, vector]) => ({ id, score: cosine(target, vector) }));
    return sortScored(scores.filter((entry) => entry.score > 0));
  };
  const between = (idA: string, idB: string) => {
    const a = vectors.get(idA);
    const b = vectors.get(idB);
    return a && b ? cosine(a, b) : 0;
  };
  const compare = (textA: string, textB: string) => cosine(vectorize(textA), vectorize(textB));

  return { search, between, compare };
}

/* ---------- Fusion and diversity ---------- */

/**
 * Reciprocal rank fusion: each list adds 1 / (k + rank) for every passage it
 * returns, so a passage ranked well by both retrievers rises to the top
 * without having to compare BM25 scores with cosine similarities.
 */
export function reciprocalRankFusion(rankings: string[][], k = 60): Scored[] {
  const scores = new Map<string, number>();
  rankings.forEach((ranking) =>
    ranking.forEach((id, index) => scores.set(id, (scores.get(id) ?? 0) + 1 / (k + index + 1))),
  );
  // Map order is first appearance, so ties favour the first ranking.
  return sortScored([...scores].map(([id, score]) => ({ id, score })));
}

export interface MmrPick extends Scored {
  /** Relevance scaled so the best candidate is 1. */
  relevance: number;
  /** The highest similarity to a passage picked before it. */
  redundancy: number;
  mmr: number;
}

/**
 * Maximal marginal relevance: picks passages one at a time, trading
 * relevance against similarity to the passages already picked, so two
 * near-identical passages do not both take a slot.
 */
export function mmrSelect(
  candidates: Scored[],
  similarity: (a: string, b: string) => number,
  { k = candidates.length, lambda = 0.7 }: { k?: number; lambda?: number } = {},
): MmrPick[] {
  const best = Math.max(0, ...candidates.map((candidate) => candidate.score)) || 1;
  const pool = candidates.map((candidate) => ({ ...candidate, relevance: candidate.score / best }));
  const picked: MmrPick[] = [];
  while (picked.length < k && pool.length > 0) {
    let choice = 0;
    let choiceMmr = -Infinity;
    let choiceRedundancy = 0;
    pool.forEach((candidate, index) => {
      const redundancy = Math.max(0, ...picked.map((pick) => similarity(candidate.id, pick.id)));
      const mmr = lambda * candidate.relevance - (1 - lambda) * redundancy;
      if (mmr > choiceMmr) {
        choice = index;
        choiceMmr = mmr;
        choiceRedundancy = redundancy;
      }
    });
    const [chosen] = pool.splice(choice, 1);
    picked.push({ ...chosen, redundancy: choiceRedundancy, mmr: choiceMmr });
  }
  return picked;
}

/* ---------- Helpers both demos use ---------- */

export interface HybridRanking {
  keyword: Scored[];
  similarity: Scored[];
  fused: Scored[];
}

/**
 * Runs both retrievers and fuses their top `depth` results. Each list keeps
 * every passage it scored, so callers can report where a passage landed.
 */
export function hybridRank(
  query: string,
  keyword: Bm25Index,
  similarity: SimilarityIndex,
  { depth = 5, k = 60 }: { depth?: number; k?: number } = {},
): HybridRanking {
  const keywordHits = keyword.search(query);
  const similarityHits = similarity.search(query);
  const fused = reciprocalRankFusion(
    [keywordHits, similarityHits].map((hits) => hits.slice(0, depth).map((hit) => hit.id)),
    k,
  );
  return { keyword: keywordHits, similarity: similarityHits, fused };
}

/**
 * Share of the query's term weight that a piece of text contains, from 0 to
 * 1. Rare terms weigh more, so matching "hash" counts for more than "index".
 */
export function termCoverage(queryTerms: string[], text: string, idf: (term: string) => number): number {
  const unique = [...new Set(queryTerms)];
  const present = new Set(tokenize(text));
  const total = unique.reduce((sum, term) => sum + idf(term), 0);
  if (!total) return 0;
  return unique.reduce((sum, term) => sum + (present.has(term) ? idf(term) : 0), 0) / total;
}

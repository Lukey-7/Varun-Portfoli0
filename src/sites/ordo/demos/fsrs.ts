/**
 * FSRS-4.5 spaced-repetition scheduling for the Sprachweg demo.
 *
 * Formulas follow open-spaced-repetition's "The Algorithm": the FSRS v4
 * section for stability and difficulty, and the FSRS-4.5 section for the
 * forgetting curve, which is the only change 4.5 made.
 * https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm
 *
 * The page leaves three details open; these follow py-fsrs v2.5.1, the
 * FSRS-4.5 release of the reference scheduler (src/fsrs/fsrs.py):
 * - stability updates use the difficulty from before the review;
 * - review intervals are kept in order, Hard <= Good < Easy;
 * - intervals are capped at 36,500 days, and S0 has a 0.1-day floor.
 *
 * Unlike py-fsrs, there are no same-day learning steps here: every rating,
 * including the first, schedules whole days.
 */

export type Grade = 1 | 2 | 3 | 4;

export const GRADES: readonly Grade[] = [1, 2, 3, 4];

export const GRADE_LABELS: Record<Grade, string> = {
  1: "Again",
  2: "Hard",
  3: "Good",
  4: "Easy",
};

/** FSRS-4.5 default parameters, w0 to w16. */
export const DEFAULT_WEIGHTS: readonly number[] = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461,
  2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
];

export const DECAY = -0.5;
/** Chosen so that R(S, S) = 0.9: stability is the time until recall falls to 90%. */
export const FACTOR = 19 / 81;
export const DESIRED_RETENTION = 0.9;
export const MAX_INTERVAL = 36500;

export interface MemoryState {
  /** Days until the chance of recall falls to 90%. */
  stability: number;
  /** 1 (easy to remember) to 10 (hard). */
  difficulty: number;
}

export interface ReviewOption {
  state: MemoryState;
  /** Whole days until the next review. */
  interval: number;
}

type Weights = readonly number[];

const clampDifficulty = (difficulty: number) => Math.min(Math.max(difficulty, 1), 10);

/** R(t, S): the chance of recalling a card t days after its last review. */
export function retrievability(elapsedDays: number, stability: number): number {
  return Math.pow(1 + (FACTOR * Math.max(elapsedDays, 0)) / stability, DECAY);
}

/** I(r, S): days until recall falls to the target. At r = 0.9 this is S itself. */
export function nextInterval(stability: number, retention = DESIRED_RETENTION): number {
  const days = (stability / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
  return Math.min(Math.max(Math.round(days), 1), MAX_INTERVAL);
}

/** S0(G) = w[G - 1]. */
export function initialStability(grade: Grade, w: Weights = DEFAULT_WEIGHTS): number {
  return Math.max(w[grade - 1], 0.1);
}

/** D0(G) = w4 - (G - 3) * w5, clamped to [1, 10]. */
export function initialDifficulty(grade: Grade, w: Weights = DEFAULT_WEIGHTS): number {
  return clampDifficulty(w[4] - (grade - 3) * w[5]);
}

/** D' = w7 * D0(3) + (1 - w7) * (D - w6 * (G - 3)), clamped to [1, 10]. */
export function nextDifficulty(difficulty: number, grade: Grade, w: Weights = DEFAULT_WEIGHTS): number {
  const moved = difficulty - w[6] * (grade - 3);
  // Mean reversion pulls every card back towards D0(Good) = w4, so a run of
  // Again ratings cannot pin a card at maximum difficulty for good.
  return clampDifficulty(w[7] * w[4] + (1 - w[7]) * moved);
}

/** S'r: stability after a successful review (Hard, Good or Easy). */
export function recallStability(
  difficulty: number,
  stability: number,
  recall: number,
  grade: Exclude<Grade, 1>,
  w: Weights = DEFAULT_WEIGHTS,
): number {
  const hardPenalty = grade === 2 ? w[15] : 1;
  const easyBonus = grade === 4 ? w[16] : 1;
  return (
    stability *
    (Math.exp(w[8]) *
      (11 - difficulty) *
      Math.pow(stability, -w[9]) *
      (Math.exp(w[10] * (1 - recall)) - 1) *
      hardPenalty *
      easyBonus +
      1)
  );
}

/** S'f: stability after a lapse (Again). */
export function forgetStability(
  difficulty: number,
  stability: number,
  recall: number,
  w: Weights = DEFAULT_WEIGHTS,
): number {
  return (
    w[11] *
    Math.pow(difficulty, -w[12]) *
    (Math.pow(stability + 1, w[13]) - 1) *
    Math.exp(w[14] * (1 - recall))
  );
}

/** The memory state after rating a card; `state` is null for a new card. */
export function nextState(
  state: MemoryState | null,
  grade: Grade,
  elapsedDays: number,
  w: Weights = DEFAULT_WEIGHTS,
): MemoryState {
  if (!state) {
    return { stability: initialStability(grade, w), difficulty: initialDifficulty(grade, w) };
  }
  const recall = retrievability(elapsedDays, state.stability);
  const stability =
    grade === 1
      ? forgetStability(state.difficulty, state.stability, recall, w)
      : recallStability(state.difficulty, state.stability, recall, grade, w);
  return { stability, difficulty: nextDifficulty(state.difficulty, grade, w) };
}

/**
 * What each rating would do right now: the new memory state and the interval
 * it schedules. The interval shown on a button is the one it schedules.
 */
export function previewReview(
  state: MemoryState | null,
  elapsedDays: number,
  retention = DESIRED_RETENTION,
  w: Weights = DEFAULT_WEIGHTS,
): Record<Grade, ReviewOption> {
  const [again, hard, good, easy] = GRADES.map((grade) => nextState(state, grade, elapsedDays, w));
  // Rounding to whole days can collapse neighbouring ratings; keep them in order.
  const hardDays = Math.min(nextInterval(hard.stability, retention), nextInterval(good.stability, retention));
  const goodDays = Math.max(nextInterval(good.stability, retention), hardDays + 1);
  const easyDays = Math.max(nextInterval(easy.stability, retention), goodDays + 1);
  return {
    1: { state: again, interval: nextInterval(again.stability, retention) },
    2: { state: hard, interval: hardDays },
    3: { state: good, interval: goodDays },
    4: { state: easy, interval: easyDays },
  };
}

/**
 * Cards to show today: any card due on or before `today` and every new card
 * (no schedule yet). Reviews come first, earliest due first; `focusId` jumps
 * one card to the front.
 */
export function dueQueue<T extends { id: string }>(
  items: readonly T[],
  schedule: Readonly<Record<string, { due: number } | undefined>>,
  today: number,
  focusId: string | null = null,
): T[] {
  const reviews = items
    .filter((item) => schedule[item.id] && schedule[item.id]!.due <= today)
    .sort((a, b) => schedule[a.id]!.due - schedule[b.id]!.due);
  const fresh = items.filter((item) => !schedule[item.id]);
  const queue = [...reviews, ...fresh];
  const focused = queue.findIndex((item) => item.id === focusId);
  if (focused > 0) queue.unshift(...queue.splice(focused, 1));
  return queue;
}

/** "1 day", "15 days", "5 months", "1.1 years". */
export function formatInterval(days: number): string {
  if (days === 1) return "1 day";
  if (days < 60) return `${days} days`;
  if (days < 365) return `${Math.round(days / 30.4)} months`;
  const years = days / 365;
  return `${years < 10 ? years.toFixed(1) : Math.round(years)} years`;
}

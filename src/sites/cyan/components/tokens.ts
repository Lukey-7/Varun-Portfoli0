import { memoryConversation, memoryStrategies } from "@/data/portfolio";

/**
 * A rough token count: four characters to a token, rounded up. Real tokenisers
 * differ by model and by language, so this is only good for comparing one
 * strategy with another on the same text.
 */
export function approxTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

type Strategy = (typeof memoryStrategies)[number];

/**
 * What a memory strategy would send against what the whole conversation weighs.
 * `sent` counts the messages it keeps, each constraint record and the summary,
 * if it has one. `full` counts every message. Each piece is counted on its own,
 * the way it would reach the model as a separate item.
 */
export function contextCost(strategy: Strategy): { sent: number; full: number } {
  const kept = new Set<number>(strategy.sends);
  let sent = 0;
  let full = 0;
  for (const message of memoryConversation) {
    const tokens = approxTokens(message.text);
    full += tokens;
    if (kept.has(message.id)) sent += tokens;
  }
  for (const record of strategy.records) sent += approxTokens(record);
  if (strategy.summary) sent += approxTokens(strategy.summary);
  return { sent, full };
}

/** The whole-percent saving against the full history. Never negative, and 0 for an empty history. */
export function savingPercent({ sent, full }: { sent: number; full: number }): number {
  if (full <= 0) return 0;
  return Math.max(0, Math.round((1 - sent / full) * 100));
}

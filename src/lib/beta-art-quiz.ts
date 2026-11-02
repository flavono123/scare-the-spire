import type { BetaArtEntry } from "@/lib/vexing-puzzlebox-types";

export const BETA_ART_QUIZ_SET_SIZE = 10;
const QUIZ_SEED = 20261102;
/** A black screen with one dot: nothing to recognise. */
const QUIZ_EXCLUDED_KEYS = new Set(["card:PALE_BLUE_DOT"]);
/** Pools too small to give three wrong answers share one pool. */
const QUIZ_MERGED_COLORS = new Set(["curse", "status", "quest"]);

export type BetaArtQuizQuestion = {
  entry: BetaArtEntry;
  choices: BetaArtEntry[];
};

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const random = seededRandom(seed);
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

function quizPoolOf(entry: BetaArtEntry): string {
  const color = entry.color ?? "other";
  return QUIZ_MERGED_COLORS.has(color) ? "misc" : color;
}

/** Fixed sets, so a shared set link shows everyone the same questions. */
export function buildBetaArtQuizSets(entries: readonly BetaArtEntry[]): BetaArtQuizQuestion[][] {
  const eligible = entries.filter((entry) => entry.type === "card" && !QUIZ_EXCLUDED_KEYS.has(entry.key));
  const pools = new Map<string, BetaArtEntry[]>();
  for (const entry of eligible) {
    const pool = pools.get(quizPoolOf(entry)) ?? [];
    pool.push(entry);
    pools.set(quizPoolOf(entry), pool);
  }

  const questions = seededShuffle(eligible, QUIZ_SEED).map((entry, index) => {
    const pool = pools.get(quizPoolOf(entry)) ?? [];
    const wrong = seededShuffle(
      pool.filter((candidate) => candidate.key !== entry.key),
      QUIZ_SEED + index + 1,
    ).slice(0, 3);
    return {
      entry,
      choices: seededShuffle([entry, ...wrong], QUIZ_SEED - index - 1),
    };
  });

  const sets: BetaArtQuizQuestion[][] = [];
  for (let start = 0; start < questions.length; start += BETA_ART_QUIZ_SET_SIZE) {
    sets.push(questions.slice(start, start + BETA_ART_QUIZ_SET_SIZE));
  }
  return sets;
}

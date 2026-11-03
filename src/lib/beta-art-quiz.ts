import type { BetaArtEntry } from "@/lib/vexing-puzzlebox-types";

/** Wrong answers a set allows before it ends, like Connections mistakes. */
export const BETA_ART_QUIZ_LIVES = 3;
const QUIZ_SEED = 20261102;
/** A black screen with one dot: nothing to recognise. */
const QUIZ_EXCLUDED_KEYS = new Set(["card:PALE_BLUE_DOT"]);
/** Pools too small to give three wrong answers share one pool. */
const QUIZ_MERGED_COLORS = new Set(["curse", "status", "quest"]);
const OTHER_TYPES_POOL = "non-card";

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
  if (entry.type !== "card") return entry.type;
  const color = entry.color ?? "other";
  return QUIZ_MERGED_COLORS.has(color) ? "misc" : color;
}

/**
 * One set per beta art Shorts episode, in the episode's order, so a set matches a video.
 * Wrong answers come from the same pool: card color (small ones merged), or the art's type;
 * a type too small for three wrong answers borrows from every non-card type.
 */
export function buildBetaArtQuizSets(entries: readonly BetaArtEntry[]): BetaArtQuizQuestion[][] {
  const eligible = entries.filter((entry) => entry.episode !== null && !QUIZ_EXCLUDED_KEYS.has(entry.key));
  const pools = new Map<string, BetaArtEntry[]>();
  for (const entry of eligible) {
    for (const pool of [quizPoolOf(entry), ...(entry.type === "card" ? [] : [OTHER_TYPES_POOL])]) {
      pools.set(pool, [...(pools.get(pool) ?? []), entry]);
    }
  }
  const poolFor = (entry: BetaArtEntry) => {
    const own = pools.get(quizPoolOf(entry)) ?? [];
    return own.length >= 4 ? own : pools.get(OTHER_TYPES_POOL) ?? [];
  };

  const episodes = new Map<number, BetaArtEntry[]>();
  for (const entry of eligible) {
    episodes.set(entry.episode as number, [...(episodes.get(entry.episode as number) ?? []), entry]);
  }
  return [...episodes.entries()]
    .toSorted(([left], [right]) => left - right)
    .map(([episode, items]) => items
      .toSorted((left, right) => (left.episodeOrder ?? 0) - (right.episodeOrder ?? 0))
      .map((entry, index) => {
        const seed = QUIZ_SEED + episode * 100 + index;
        const wrong = seededShuffle(poolFor(entry).filter((candidate) => candidate.key !== entry.key), seed).slice(0, 3);
        return { entry, choices: seededShuffle([entry, ...wrong], -seed) };
      }));
}

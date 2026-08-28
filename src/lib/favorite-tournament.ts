import type { EntityInfo } from "@/components/patch-note-renderer";
import {
  resourceKey,
  type DecisionsDecisionsResourceRef,
} from "@/lib/decisions-decisions";
import sts2Meta from "../../data/sts2/meta.json";

export const FAVORITE_TOURNAMENT_HREF = "/this-or-that/worldcup";
export const FAVORITE_TOURNAMENT_TOKEN_SRC =
  "/images/sts2/potions/fortifier.webp";
export const FAVORITE_TOURNAMENT_BACKGROUND_SRC =
  "/images/sts2/events/this_or_that.webp";

export const FAVORITE_TOURNAMENT_TABLE = "favorite_tournament_posts";
export const FAVORITE_TOURNAMENT_STATS_TABLE =
  "favorite_tournament_candidate_stats";
export const FAVORITE_TOURNAMENT_PLAYS_TABLE = "favorite_tournament_plays";
export const FAVORITE_TOURNAMENT_FEED_SERVICE = "favorite_tournament";

export const FAVORITE_TOURNAMENT_GAME_VERSION = sts2Meta.version;

export const FAVORITE_TOURNAMENT_TITLE_MIN_CHARS = 1;
export const FAVORITE_TOURNAMENT_TITLE_MAX_CHARS = 80;
export const FAVORITE_TOURNAMENT_NOTE_MAX_CHARS = 500;
export const FAVORITE_TOURNAMENT_MIN_POOL = 2;

export type FavoriteTournamentResourceRef = DecisionsDecisionsResourceRef;

export type FavoriteTournamentPost = {
  id: string;
  user_id: string;
  nickname: string;
  title: string;
  note: string;
  preset_key: string;
  game_version: string;
  pool: FavoriteTournamentResourceRef[];
  env: string;
  like_count?: number;
  comment_count?: number;
  play_count?: number;
  created_at: string;
};

export type FavoriteTournamentRankSnapshot = {
  at: string;
  rank: number;
};

export type FavoriteTournamentCandidateStats = {
  resource_type: FavoriteTournamentResourceRef["type"];
  resource_id: string;
  match_appearances: number;
  match_wins: number;
  championships: number;
  current_rank: number | null;
  rank_history: FavoriteTournamentRankSnapshot[];
};

export type FavoriteTournamentMatchRecord = {
  left: FavoriteTournamentResourceRef;
  right: FavoriteTournamentResourceRef;
  winner: "left" | "right";
};

export type PlayContestant = FavoriteTournamentResourceRef | "bye";

export type FavoriteTournamentPlayRound = {
  size: number;
  pairs: Array<{
    left: PlayContestant;
    right: PlayContestant;
  }>;
};

function isResourceRef(value: unknown): value is FavoriteTournamentResourceRef {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.type === "string" && typeof record.id === "string";
}

export function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 1;
  return 2 ** Math.ceil(Math.log2(n));
}

export function byeCountForSize(size: number): number {
  if (size < 2) return 0;
  return nextPowerOfTwo(size) - size;
}

/** PIKU-style start options: actual N, then 2^k down to 4. */
export function playRoundOptions(poolSize: number): number[] {
  if (poolSize < FAVORITE_TOURNAMENT_MIN_POOL) return [];
  const options = [poolSize];
  for (let size = 2 ** Math.floor(Math.log2(poolSize)); size >= 4; size >>= 1) {
    if (size !== poolSize) options.push(size);
  }
  return options;
}

export function formatRoundLabel(
  size: number,
  locale: "ko" | "en",
): string {
  return locale === "ko" ? `${size}강` : `Round of ${size}`;
}

export function shuffleInPlace<T>(
  items: T[],
  random: () => number = Math.random,
): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const swap = items[i];
    items[i] = items[j]!;
    items[j] = swap!;
  }
  return items;
}

export function samplePool(
  pool: FavoriteTournamentResourceRef[],
  size: number,
  random: () => number = Math.random,
): FavoriteTournamentResourceRef[] {
  const unique: FavoriteTournamentResourceRef[] = [];
  const seen = new Set<string>();
  for (const ref of pool) {
    const key = resourceKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(ref);
  }
  if (size >= unique.length) return shuffleInPlace([...unique], random);
  return shuffleInPlace([...unique], random).slice(0, size);
}

/**
 * First round of a single-elim bracket. Non-2^n sizes get byes, matching PIKU:
 * some candidates skip the opening matches and wait in the next power-of-two round.
 */
export function buildOpeningRound(
  contestants: FavoriteTournamentResourceRef[],
): FavoriteTournamentPlayRound {
  const size = contestants.length;
  const bracketSize = nextPowerOfTwo(size);
  const byeCount = bracketSize - size;
  const firstRoundSlots = bracketSize / 2;
  const playingCount = (size - byeCount);
  const pairs: FavoriteTournamentPlayRound["pairs"] = [];

  let index = 0;
  const realMatchCount = playingCount / 2;
  for (let i = 0; i < realMatchCount; i += 1) {
    pairs.push({
      left: contestants[index]!,
      right: contestants[index + 1]!,
    });
    index += 2;
  }
  while (pairs.length < firstRoundSlots) {
    const player = contestants[index];
    pairs.push({
      left: player ?? "bye",
      right: "bye",
    });
    if (player) index += 1;
  }

  return { size, pairs };
}

export function isBye(contestant: PlayContestant): contestant is "bye" {
  return contestant === "bye";
}

export function openingAutoAdvances(
  round: FavoriteTournamentPlayRound,
): FavoriteTournamentResourceRef[] {
  const advanced: FavoriteTournamentResourceRef[] = [];
  for (const pair of round.pairs) {
    if (!isBye(pair.left) && isBye(pair.right)) advanced.push(pair.left);
    else if (isBye(pair.left) && !isBye(pair.right)) advanced.push(pair.right);
  }
  return advanced;
}

export function openingPlayablePairs(
  round: FavoriteTournamentPlayRound,
): Array<{
  left: FavoriteTournamentResourceRef;
  right: FavoriteTournamentResourceRef;
}> {
  return round.pairs.filter(
    (pair): pair is {
      left: FavoriteTournamentResourceRef;
      right: FavoriteTournamentResourceRef;
    } => !isBye(pair.left) && !isBye(pair.right),
  );
}

export function pairNextRound(
  winners: FavoriteTournamentResourceRef[],
): Array<{
  left: FavoriteTournamentResourceRef;
  right: FavoriteTournamentResourceRef;
}> {
  const pairs: Array<{
    left: FavoriteTournamentResourceRef;
    right: FavoriteTournamentResourceRef;
  }> = [];
  for (let i = 0; i < winners.length; i += 2) {
    const left = winners[i];
    const right = winners[i + 1];
    if (!left || !right) break;
    pairs.push({ left, right });
  }
  return pairs;
}

export function championshipRate(
  championships: number,
  playCount: number,
): number {
  if (playCount <= 0) return 0;
  return championships / playCount;
}

export function matchWinRate(wins: number, appearances: number): number {
  if (appearances <= 0) return 0;
  return wins / appearances;
}

export function formatPercent(rate: number, digits = 2): string {
  return `${(rate * 100).toFixed(digits)}%`;
}

export function rankedCandidateStats(
  stats: FavoriteTournamentCandidateStats[],
): FavoriteTournamentCandidateStats[] {
  return [...stats].sort((left, right) => {
    if (right.championships !== left.championships) {
      return right.championships - left.championships;
    }
    const leftRate = matchWinRate(left.match_wins, left.match_appearances);
    const rightRate = matchWinRate(right.match_wins, right.match_appearances);
    if (rightRate !== leftRate) return rightRate - leftRate;
    if (right.match_appearances !== left.match_appearances) {
      return right.match_appearances - left.match_appearances;
    }
    return resourceKey({
      type: left.resource_type,
      id: left.resource_id,
    }).localeCompare(resourceKey({
      type: right.resource_type,
      id: right.resource_id,
    }));
  });
}

export function normalizeFavoriteTournamentPost(row: unknown): FavoriteTournamentPost {
  const record = (row ?? {}) as Record<string, unknown>;
  const pool = Array.isArray(record.pool)
    ? record.pool.filter(isResourceRef)
    : [];
  return {
    id: String(record.id ?? ""),
    user_id: String(record.user_id ?? ""),
    nickname: String(record.nickname ?? ""),
    title: String(record.title ?? ""),
    note: String(record.note ?? ""),
    preset_key: String(record.preset_key ?? "custom"),
    game_version: String(record.game_version ?? FAVORITE_TOURNAMENT_GAME_VERSION),
    pool,
    env: String(record.env ?? ""),
    like_count: typeof record.like_count === "number" ? record.like_count : 0,
    comment_count: typeof record.comment_count === "number" ? record.comment_count : 0,
    play_count: typeof record.play_count === "number" ? record.play_count : 0,
    created_at: String(record.created_at ?? ""),
  };
}

export function normalizeCandidateStats(row: unknown): FavoriteTournamentCandidateStats | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  if (typeof record.resource_type !== "string" || typeof record.resource_id !== "string") {
    return null;
  }
  const history = Array.isArray(record.rank_history)
    ? record.rank_history.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const item = entry as Record<string, unknown>;
      if (typeof item.at !== "string" || typeof item.rank !== "number") return [];
      return [{ at: item.at, rank: item.rank }];
    })
    : [];
  return {
    resource_type: record.resource_type as FavoriteTournamentResourceRef["type"],
    resource_id: record.resource_id,
    match_appearances: typeof record.match_appearances === "number" ? record.match_appearances : 0,
    match_wins: typeof record.match_wins === "number" ? record.match_wins : 0,
    championships: typeof record.championships === "number" ? record.championships : 0,
    current_rank: typeof record.current_rank === "number" ? record.current_rank : null,
    rank_history: history,
  };
}

export function entityForRef(
  ref: FavoriteTournamentResourceRef,
  entityMap: Map<string, EntityInfo>,
): EntityInfo | undefined {
  return entityMap.get(resourceKey(ref)) ?? entityMap.get(`${ref.type}:${ref.id}`);
}

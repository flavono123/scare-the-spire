import type { RunDisplay } from "@/lib/vexing-puzzlebox-score";

const STORAGE_KEY = "sts-vexing-puzzlebox-v1";

export type ConnectionsProgress = {
  /** Levels of each submitted group's members, in submit order. */
  guesses: number[][];
  /** Member keys of each submitted group, to refuse a repeated guess. Missing in older saves. */
  guessKeys?: string[][];
  solvedLevels: number[];
  mistakes: number;
  /** Times this puzzle was started over, which Vakuu counts. */
  retries?: number;
  /** Potion belt slots still holding a rock. Missing in older saves means a full belt. */
  potions?: boolean[];
  /** Rocks thrown at the board this run; discarded rocks do not count. */
  rocksThrown?: number;
  /** Everything put on screen since the run began, for the display bonus. */
  shown?: RunDisplay;
};

/** A board's best local score; retries never lower it. */
export type LocalBestScore = { best: number; perfect: boolean; last: number };

type VexingPuzzleboxRecord = {
  v: 1;
  connections: Record<string, ConnectionsProgress>;
  betaArtSets: Record<string, boolean[]>;
  /** Best scores by game, then board number. Missing in older saves. */
  scores?: Partial<Record<"connections" | "beta-quiz", Record<string, LocalBestScore>>>;
};

function emptyRecord(): VexingPuzzleboxRecord {
  return { v: 1, connections: {}, betaArtSets: {} };
}

export function readLocalBestScores(game: "connections" | "beta-quiz"): Record<string, LocalBestScore> {
  return readVexingPuzzleboxRecord().scores?.[game] ?? {};
}

/** Keeps the higher score and remembers the latest one. Returns the updated scores. */
export function recordLocalScore(
  game: "connections" | "beta-quiz",
  board: number,
  score: number,
  perfect: boolean,
): Record<string, LocalBestScore> {
  let next: Record<string, LocalBestScore> = {};
  updateVexingPuzzleboxRecord((record) => {
    const scores = { ...(record.scores?.[game] ?? {}) };
    const previous = scores[board];
    scores[board] = previous && previous.best >= score
      ? { ...previous, last: score }
      : { best: score, perfect, last: score };
    record.scores = { ...record.scores, [game]: scores };
    next = scores;
  });
  return next;
}

export function readVexingPuzzleboxRecord(): VexingPuzzleboxRecord {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return emptyRecord();
    const parsed = JSON.parse(stored) as Partial<VexingPuzzleboxRecord>;
    if (parsed.v !== 1) return emptyRecord();
    return { ...emptyRecord(), ...parsed };
  } catch {
    return emptyRecord();
  }
}

export function updateVexingPuzzleboxRecord(
  update: (record: VexingPuzzleboxRecord) => void,
): void {
  try {
    const record = readVexingPuzzleboxRecord();
    update(record);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Play continues without saved progress when storage is blocked.
  }
}

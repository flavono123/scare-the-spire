const STORAGE_KEY = "sts-vexing-puzzlebox-v1";

export type ConnectionsProgress = {
  /** Levels of each submitted group's members, in submit order. */
  guesses: number[][];
  solvedLevels: number[];
  mistakes: number;
};

type VexingPuzzleboxRecord = {
  v: 1;
  connections: Record<string, ConnectionsProgress>;
  betaArtSets: Record<string, boolean[]>;
};

function emptyRecord(): VexingPuzzleboxRecord {
  return { v: 1, connections: {}, betaArtSets: {} };
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

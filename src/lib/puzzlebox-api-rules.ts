/**
 * The puzzlebox group's query format (docs/supabase-exit/STEP1_DESIGN.md 9.5),
 * shared by the score hooks and the Worker. No imports: the Worker bundle uses it.
 *
 * The page sends the boards it knows with their top score ({"1": 4, ...}); the
 * RPCs rank nothing else. In a query string that map is `1:4,2:4`.
 */

export const PUZZLEBOX_API_GAMES = ["connections", "beta-quiz"] as const;
export type PuzzleboxApiGame = (typeof PUZZLEBOX_API_GAMES)[number];

export const PUZZLEBOX_MAX_BOARDS = 500;
export const PUZZLEBOX_MAX_OFFSET = 100_000;

const BOARD = /^\d{1,4}$/;
const MAX_SCORE = /^\d{1,6}$/;

export function isPuzzleboxGame(value: string): value is PuzzleboxApiGame {
  return (PUZZLEBOX_API_GAMES as readonly string[]).includes(value);
}

/** `1:4,2:4`; null when a board or score is malformed (the RPCs accept these shapes only). */
export function encodePuzzleboxBoards(boards: Record<string, number>): string | null {
  const entries = Object.entries(boards);
  if (entries.length === 0 || entries.length > PUZZLEBOX_MAX_BOARDS) return null;
  const parts: string[] = [];
  for (const [board, max] of entries) {
    const score = String(max);
    if (!BOARD.test(board) || !MAX_SCORE.test(score)) return null;
    parts.push(`${board}:${score}`);
  }
  return parts.join(",");
}

export function parsePuzzleboxBoards(value: string): Record<string, number> | null {
  if (!value) return null;
  const entries = value.split(",");
  if (entries.length > PUZZLEBOX_MAX_BOARDS) return null;
  const boards: Record<string, number> = {};
  for (const entry of entries) {
    const [board, score, extra] = entry.split(":");
    if (extra !== undefined || !BOARD.test(board ?? "") || !MAX_SCORE.test(score ?? "") || board in boards) return null;
    boards[board] = Number(score);
  }
  return boards;
}

export function isPuzzleboxBoardParam(value: string): boolean {
  return value === "total" || BOARD.test(value);
}

export function isPuzzleboxOffset(value: string): boolean {
  return /^\d{1,6}$/.test(value) && Number(value) <= PUZZLEBOX_MAX_OFFSET;
}

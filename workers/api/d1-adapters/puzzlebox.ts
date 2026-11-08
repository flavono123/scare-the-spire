import { isPuzzleboxGame, parsePuzzleboxBoards, PUZZLEBOX_MAX_OFFSET } from "../../../src/lib/puzzlebox-api-rules";
import { md5Hex } from "./md5";
import { Q_X2, Q_X2s, Q_X4 } from "./queries";
import { AdapterInputError, bool, json, query, readAll, ts, type AdapterContext, type Row } from "./rows";

/**
 * D1 adapters of the puzzlebox group (design 4.5, 6): get_puzzlebox_leaderboard (X2, X2s) and
 * get_my_puzzlebox_standings (X4), as the jsonb those RPCs build.
 */

const STATS_COLUMNS = [
  "board", "players", "cleared", "perfect", "score_sum", "mistakes_sum", "rocks_sum", "purple_first", "level_solved",
  "question_wrong", "wrong_picks", "speed_sum",
] as const;
const ARRAY_STATS = new Set(["level_solved", "question_wrong", "wrong_picks"]);

function boardsOf(url: URL): { game: string; boards: Record<string, number> } {
  const game = url.searchParams.get("game") ?? "";
  const boards = parsePuzzleboxBoards(url.searchParams.get("boards") ?? "");
  if (!isPuzzleboxGame(game) || !boards) throw new AdapterInputError("game or boards");
  return { game, boards };
}

function leaderboardRow(row: Row, userId: string | null): Row {
  return {
    rank: row.rank,
    score: row.score,
    perfect: bool(row.perfect),
    perfect_count: row.perfect_count,
    boards: row.boards,
    attempts: row.attempts,
    achieved_at: ts(row.achieved_at),
    nickname: row.nickname,
    tag: md5Hex(String(row.user_id)).slice(0, 4),
    avatar_id: row.avatar_id ?? null,
    avatar_kind: row.avatar_kind ?? null,
    palette_id: row.palette_id ?? null,
    palette_swapped: bool(row.palette_swapped),
    is_me: userId !== null && row.user_id === userId,
  };
}

/** read.puzzlebox.leaderboard and me.puzzlebox.leaderboard (userId set: is_me, me, around_me). */
export async function leaderboardAdapter(context: AdapterContext): Promise<Row> {
  const { url, userId } = context;
  const { game, boards } = boardsOf(url);
  const boardParam = url.searchParams.get("board") ?? "total";
  const board = boardParam === "total" ? null : boardParam;
  const offset = Number(url.searchParams.get("offset") ?? "0");
  const aroundMe = url.searchParams.get("around_me") === "1" ? 1 : 0;
  const boardsJson = JSON.stringify(boards);
  const reads = [query(Q_X2, boardsJson, board, game, userId, aroundMe, offset)];
  if (board !== null) reads.push(query(Q_X2s, game, board));
  const [rows, statsRows] = await readAll(context.db, reads);

  let players = rows.length ? Number(rows[0].total_players) : 0;
  if (!rows.length) {
    // A page past the end: X2 at the first page tells whether anyone is ranked at all.
    const [first] = await readAll(context.db, [query(Q_X2, boardsJson, board, game, userId, 0, 0)]);
    players = first.length ? Number(first[0].total_players) : 0;
  }
  const start = rows.length ? Number(rows[0].start) : Math.max(0, Math.min(offset, PUZZLEBOX_MAX_OFFSET));
  const page = rows.filter((row) => Number(row.rank) > start && Number(row.rank) <= start + 10);
  const mine = userId === null ? undefined : rows.find((row) => row.user_id === userId);
  let stats: Row | null = null;
  if (board !== null && statsRows?.[0]) {
    stats = {};
    for (const name of STATS_COLUMNS) stats[name] = ARRAY_STATS.has(name) ? json(statsRows[0][name]) : statsRows[0][name];
  }
  return {
    v: 1,
    env: context.dataEnv,
    leaderboard: {
      players,
      offset: start,
      rows: page.map((row) => leaderboardRow(row, userId)),
      me: mine ? leaderboardRow(mine, userId) : null,
      stats,
    },
  };
}

/** me.puzzlebox.standings: the caller's rank on each valid board. */
export async function standingsAdapter(context: AdapterContext): Promise<Row> {
  if (!context.userId) throw new AdapterInputError("user");
  const { game, boards } = boardsOf(context.url);
  const [rows] = await readAll(context.db, [query(Q_X4, context.userId, game, JSON.stringify(boards))]);
  return {
    v: 1,
    env: context.dataEnv,
    standings: rows.map((row) => ({
      board: row.board,
      score: row.score,
      perfect: bool(row.perfect),
      rank: row.rank,
      players: row.players,
    })),
  };
}

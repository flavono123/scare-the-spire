import { isPuzzleboxGame } from "../../../../src/lib/puzzlebox-api-rules";
import { apiError } from "../../http";
import { json, type D1WriteContext } from "../context";
import { rowsOf, runBatch, stmt, tsFromMs, writeFailureCode, type D1Statement } from "../db";
import { outboxStatement, readPayload } from "../outbox";
import { normalizePuzzleboxPlayer, puzzleboxScoreRun, PuzzleboxRunError } from "../puzzlebox-score";

/**
 * 짜증나는 퍼즐상자 submit on D1 (submit_puzzlebox_run ported, queries.sql X1a-X1e, design 4.5).
 * Scoring is the TypeScript port of puzzlebox_score_run; the rate rules (one run of a board every
 * 3 s, 500 a day) are X1a's conditions, counted inside this env's D1 (design 10.7). Every later
 * statement is guarded by the run row's existence, so a refused run changes nothing and answers 429.
 */

const BURST_MS = 3_000;
const DAY_MS = 24 * 60 * 60 * 1000;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** A run id in [2^40, 2^53): above every Supabase identity value, exact in a JS number (design 3.2). */
export function puzzleboxRunId(): number {
  const words = new Uint32Array(2);
  crypto.getRandomValues(words);
  const span = 2 ** 53 - 2 ** 40;
  const value = (words[0] & 0x1fffff) * 2 ** 32 + words[1];
  return 2 ** 40 + (value % span);
}

/** level_solved / question_wrong / wrong_picks: element-wise sum, the longer length kept (the RPC pads). */
function addArrays(column: string, param: string): string {
  return (
    `(SELECT json_group_array(coalesce(json_extract(${column}, '$[' || i || ']'), 0) + coalesce(json_extract(${param}, '$[' || i || ']'), 0) ORDER BY i) ` +
    `FROM (SELECT key AS i FROM json_each(CASE WHEN json_array_length(${column}) >= json_array_length(${param}) THEN ${column} ELSE ${param} END)))`
  );
}

export async function submitRun(write: D1WriteContext): Promise<Response> {
  const body = write.context.body;
  if (!isPlainObject(body)) return apiError("invalid");
  const { game, board, run, player } = body;
  if (typeof game !== "string" || !isPuzzleboxGame(game)) return apiError("invalid");
  if (typeof board !== "string" || !/^\d{1,4}$/.test(board)) return apiError("invalid");
  if (!isPlainObject(run) || !isPlainObject(player)) return apiError("invalid");
  // The RPC's own board check (22023).
  if (!/^[1-9][0-9]{0,2}$/.test(board)) return apiError("invalid");
  let scored;
  let token;
  try {
    scored = puzzleboxScoreRun(game, run);
    token = normalizePuzzleboxPlayer(player);
  } catch (error) {
    if (error instanceof PuzzleboxRunError) return apiError("invalid");
    throw error;
  }

  const runId = puzzleboxRunId();
  const exists = { sql: "EXISTS (SELECT 1 FROM puzzlebox_runs WHERE id = ?6)", params: [runId] };
  const levelDelta = [0, 0, 0, 0];
  let questionDelta: number[] = [];
  let pickDelta: number[] = [];
  let purpleFirst = 0;
  if (game === "connections") {
    for (const level of scored.solved ?? []) levelDelta[level] = 1;
    purpleFirst = scored.solved?.[0] === 3 ? 1 : 0;
  } else {
    const questions = scored.questions ?? 0;
    questionDelta = Array.from({ length: questions }, () => 0);
    pickDelta = Array.from({ length: questions * 4 }, () => 0);
    (scored.picks ?? []).forEach((pick, index) => {
      if (scored.corrects?.[index]) return;
      questionDelta[index] += 1;
      pickDelta[index * 4 + pick] += 1;
    });
  }

  const statements: D1Statement[] = [
    // X1a
    stmt(
      "INSERT INTO puzzlebox_runs (id, game, board, user_id, attempt, score, perfect, run, created_at) " +
        "SELECT ?1, ?2, ?3, ?4, coalesce((SELECT attempts FROM puzzlebox_best WHERE game = ?2 AND board = ?3 AND user_id = ?4), 0) + 1, " +
        "?5, ?6, ?7, ?8 " +
        "WHERE NOT EXISTS (SELECT 1 FROM puzzlebox_runs WHERE user_id = ?4 AND created_at > ?9 AND game = ?2 AND board = ?3) " +
        "AND (SELECT count(*) FROM puzzlebox_runs WHERE user_id = ?4 AND created_at > ?10) < 500",
      runId, game, board, write.uid, scored.score, scored.perfect ? 1 : 0, JSON.stringify(scored.run), write.now,
      tsFromMs(write.nowMs - BURST_MS), tsFromMs(write.nowMs - DAY_MS),
    ),
    // X1b
    stmt(
      "INSERT INTO puzzlebox_players (user_id, nickname, avatar_id, avatar_kind, palette_id, palette_swapped, updated_at) " +
        "SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7 WHERE EXISTS (SELECT 1 FROM puzzlebox_runs WHERE id = ?8) " +
        "ON CONFLICT (user_id) DO UPDATE SET nickname = excluded.nickname, avatar_id = excluded.avatar_id, " +
        "avatar_kind = excluded.avatar_kind, palette_id = excluded.palette_id, " +
        "palette_swapped = excluded.palette_swapped, updated_at = excluded.updated_at",
      write.uid, token.nickname, token.avatar_id, token.avatar_kind, token.palette_id, token.palette_swapped ? 1 : 0, write.now, runId,
    ),
    // X1c
    stmt(
      "INSERT INTO puzzlebox_best (game, board, user_id, score, perfect, run_id, achieved_at, attempts) " +
        "SELECT game, board, user_id, score, perfect, id, created_at, attempt FROM puzzlebox_runs WHERE id = ?1 " +
        "ON CONFLICT (game, board, user_id) DO UPDATE SET attempts = excluded.attempts, " +
        "perfect = CASE WHEN excluded.score > score THEN excluded.perfect ELSE perfect END, " +
        "run_id = CASE WHEN excluded.score > score THEN excluded.run_id ELSE run_id END, " +
        "achieved_at = CASE WHEN excluded.score > score THEN excluded.achieved_at ELSE achieved_at END, " +
        "score = CASE WHEN excluded.score > score THEN excluded.score ELSE score END",
      runId,
    ),
    // The board's stats row, created on its first player (the RPC's insert ... on conflict do nothing).
    stmt(
      "INSERT INTO puzzlebox_board_stats (game, board) SELECT ?1, ?2 WHERE EXISTS (SELECT 1 FROM puzzlebox_runs WHERE id = ?3 AND attempt = 1) " +
        "ON CONFLICT (game, board) DO NOTHING",
      game, board, runId,
    ),
    // X1d with the RPC's element-wise array updates.
    stmt(
      "UPDATE puzzlebox_board_stats SET players = players + 1, cleared = cleared + ?4, perfect = perfect + ?5, " +
        "score_sum = score_sum + ?6, mistakes_sum = mistakes_sum + ?7, rocks_sum = rocks_sum + ?8, " +
        "purple_first = purple_first + ?9, speed_sum = speed_sum + ?10, " +
        `level_solved = ${addArrays("level_solved", "?11")}, question_wrong = ${addArrays("question_wrong", "?12")}, ` +
        `wrong_picks = ${addArrays("wrong_picks", "?13")} ` +
        "WHERE game = ?1 AND board = ?2 AND EXISTS (SELECT 1 FROM puzzlebox_runs WHERE id = ?3 AND attempt = 1)",
      game, board, runId, scored.cleared ? 1 : 0, scored.perfect ? 1 : 0, scored.score, scored.mistakes, scored.rocks,
      purpleFirst, scored.speed ?? 0, JSON.stringify(levelDelta), JSON.stringify(questionDelta), JSON.stringify(pickDelta),
    ),
    outboxStatement({ table: "puzzlebox_runs", op: "insert", match: { id: runId }, payload: readPayload("puzzlebox_runs") }, write.nowMs, exists),
  ];
  // puzzlebox_players has no env in Supabase: only the production Worker mirrors it (design 5.5).
  if (write.dataEnv === "production") {
    statements.push(outboxStatement(
      { table: "puzzlebox_players", op: "upsert", match: { user_id: write.uid }, payload: readPayload("puzzlebox_players") },
      write.nowMs,
      exists,
    ));
  }
  statements.push(
    outboxStatement(
      { table: "puzzlebox_best", op: "upsert", match: { game, board, user_id: write.uid }, payload: readPayload("puzzlebox_best") },
      write.nowMs,
      exists,
    ),
    outboxStatement(
      { table: "puzzlebox_board_stats", op: "upsert", match: { game, board }, payload: readPayload("puzzlebox_board_stats") },
      write.nowMs,
      { sql: "EXISTS (SELECT 1 FROM puzzlebox_runs WHERE id = ?6 AND attempt = 1)", params: [runId] },
    ),
    // X1e
    stmt(
      "SELECT r.attempt, b.score AS best, b.perfect AS best_perfect, (b.run_id = r.id) AS improved, " +
        "1 + (SELECT count(*) FROM puzzlebox_best o JOIN puzzlebox_players p ON p.user_id = o.user_id AND p.hidden = 0 " +
        "WHERE o.game = ?1 AND o.board = ?2 AND (o.score > b.score OR (o.score = b.score AND o.achieved_at < b.achieved_at))) AS rank, " +
        "(SELECT count(*) FROM puzzlebox_best o JOIN puzzlebox_players p ON p.user_id = o.user_id AND p.hidden = 0 " +
        "WHERE o.game = ?1 AND o.board = ?2) AS players " +
        "FROM puzzlebox_runs r JOIN puzzlebox_best b ON b.game = r.game AND b.board = r.board AND b.user_id = r.user_id WHERE r.id = ?3",
      game, board, runId,
    ),
  );
  let results;
  try {
    results = await runBatch(write.db, statements);
  } catch (error) {
    return apiError(writeFailureCode(error));
  }
  const answer = rowsOf<{ attempt: number; best: number; best_perfect: number; improved: number; rank: number; players: number }>(
    results[results.length - 1],
  )[0];
  // No run row: the 3 s or 500-a-day rule (54000 today -> 429).
  if (!answer) return apiError("rate_limited");
  return json({
    v: 1,
    env: write.dataEnv,
    result: {
      score: scored.score,
      perfect: scored.perfect,
      attempt: Number(answer.attempt),
      improved: Number(answer.improved) === 1,
      best: Number(answer.best),
      best_perfect: Number(answer.best_perfect) === 1,
      rank: Number(answer.rank),
      players: Number(answer.players),
    },
  });
}

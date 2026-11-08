import {
  isPuzzleboxBoardParam,
  isPuzzleboxGame,
  isPuzzleboxOffset,
  parsePuzzleboxBoards,
} from "../../../src/lib/puzzlebox-api-rules";
import { apiError, jsonResponse } from "../http";
import type { ApiRoute, PublicRouteContext, UserRouteContext } from "../router";
import { postgrest, type SupabaseApiConfig } from "../supabase-rest";
import { HANDLER_BUDGET_MS, restErrorCode } from "./comments";

/**
 * The puzzlebox group (docs/supabase-exit/STEP1_DESIGN.md 9.5): the rankings,
 * the player's standings and run submission. The three RPCs are SECURITY
 * DEFINER and read auth.uid(); personal answers go only to /api/me and writes.
 */

const RUN_BODY_MAX_BYTES = 64 * 1024;

const leaderboardQuery = {
  game: isPuzzleboxGame,
  boards: (value: string) => parsePuzzleboxBoards(value) !== null,
  board: isPuzzleboxBoardParam,
  offset: isPuzzleboxOffset,
  around_me: (value: string) => value === "0" || value === "1",
};

async function leaderboard(context: PublicRouteContext | UserRouteContext, config: SupabaseApiConfig, token: string | null): Promise<Response> {
  const { url } = context;
  const game = url.searchParams.get("game") ?? "";
  const boards = parsePuzzleboxBoards(url.searchParams.get("boards") ?? "");
  if (!isPuzzleboxGame(game) || !boards) return apiError("invalid");
  const board = url.searchParams.get("board") ?? "total";
  if (!context.allowUpstream) return jsonResponse({ v: 1, env: config.dataEnv });
  const result = await postgrest<unknown>(config, {
    method: "POST",
    path: "rpc/get_puzzlebox_leaderboard",
    token,
    deadline: Date.now() + HANDLER_BUDGET_MS,
    body: {
      p_env: config.dataEnv,
      p_game: game,
      p_boards: boards,
      p_board: board === "total" ? null : board,
      p_offset: Number(url.searchParams.get("offset") ?? "0"),
      p_around_me: url.searchParams.get("around_me") === "1",
    },
  });
  if (!result.ok) return apiError(restErrorCode(result));
  return jsonResponse({ v: 1, env: config.dataEnv, leaderboard: result.data ?? null });
}

async function handleStandings(context: UserRouteContext): Promise<Response> {
  const { config, token, url } = context;
  const game = url.searchParams.get("game") ?? "";
  const boards = parsePuzzleboxBoards(url.searchParams.get("boards") ?? "");
  if (!isPuzzleboxGame(game) || !boards) return apiError("invalid");
  if (!context.allowUpstream) return jsonResponse({ v: 1, env: config.dataEnv });
  const result = await postgrest<unknown>(config, {
    method: "POST",
    path: "rpc/get_my_puzzlebox_standings",
    token,
    deadline: Date.now() + HANDLER_BUDGET_MS,
    body: { p_env: config.dataEnv, p_game: game, p_boards: boards },
  });
  if (!result.ok) return apiError(restErrorCode(result));
  return jsonResponse({ v: 1, env: config.dataEnv, standings: Array.isArray(result.data) ? result.data : [] });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function handleSubmit(context: UserRouteContext): Promise<Response> {
  const body = context.body;
  if (!isPlainObject(body)) return apiError("invalid");
  const { game, board, run, player } = body;
  // The RPC scores the run itself (puzzlebox_score_run) and checks the board and player.
  if (typeof game !== "string" || !isPuzzleboxGame(game)) return apiError("invalid");
  if (typeof board !== "string" || !/^\d{1,4}$/.test(board)) return apiError("invalid");
  if (!isPlainObject(run) || !isPlainObject(player)) return apiError("invalid");
  const { config, token } = context;
  const result = await postgrest<unknown>(config, {
    method: "POST",
    path: "rpc/submit_puzzlebox_run",
    token,
    deadline: Date.now() + HANDLER_BUDGET_MS,
    body: { p_env: config.dataEnv, p_game: game, p_board: board, p_run: run, p_player: player },
  });
  if (!result.ok) {
    // 54000: the RPC's own limit (one run every 3 s, 500 a day); 22023: unknown board or env.
    if (result.code === "54000") return apiError("rate_limited");
    if (result.code === "22023") return apiError("invalid");
    return apiError(restErrorCode(result));
  }
  return jsonResponse({ v: 1, env: config.dataEnv, result: result.data ?? null });
}

export const puzzleboxRoutes: readonly ApiRoute[] = [
  {
    id: "read.puzzlebox.leaderboard",
    method: "GET",
    path: "/api/read/puzzlebox/leaderboard",
    group: "puzzlebox",
    access: "public",
    query: leaderboardQuery,
    rateLimit: "ip",
    handle: (context) => leaderboard(context, context.config, null),
  },
  {
    id: "me.puzzlebox.leaderboard",
    method: "GET",
    path: "/api/me/puzzlebox/leaderboard",
    group: "puzzlebox",
    access: "me",
    query: leaderboardQuery,
    handle: (context) => leaderboard(context, context.config, context.token),
  },
  {
    id: "me.puzzlebox.standings",
    method: "GET",
    path: "/api/me/puzzlebox/standings",
    group: "puzzlebox",
    access: "me",
    query: { game: isPuzzleboxGame, boards: (value: string) => parsePuzzleboxBoards(value) !== null },
    handle: handleStandings,
  },
  {
    id: "write.puzzlebox.runs",
    method: "POST",
    path: "/api/write/puzzlebox/runs",
    group: "puzzlebox",
    access: "write",
    query: {},
    body: { maxBytes: RUN_BODY_MAX_BYTES },
    handle: handleSubmit,
  },
];

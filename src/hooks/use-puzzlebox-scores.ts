"use client";

import { useEffect, useState } from "react";
import { apiFetch, shouldUseLegacy, writeMayGoLegacy } from "@/lib/api-client";
import { apiFetchAsUser, currentAccessToken } from "@/lib/api-session";
import { encodePuzzleboxBoards } from "@/lib/puzzlebox-api-rules";
import { surfacePath } from "@/lib/runtime-flags";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { SUPABASE_AUTH_TIMEOUT_MS, withSupabaseTimeout } from "@/lib/supabase-timeout";
import {
  currentAuthorProfileToken,
  hasStoredUserProfile,
  readStoredUserProfile,
  USER_PROFILE_STORAGE_KEY,
} from "@/lib/user-profile";
import type { BetaQuizRun, ConnectionsRun, PuzzleboxGame } from "@/lib/vexing-puzzlebox-score";

/** Every board the page knows, with the most it can score. The server ranks nothing else. */
export type PuzzleboxBoards = Record<string, number>;

export type PuzzleboxSubmitResult = {
  score: number;
  perfect: boolean;
  attempt: number;
  improved: boolean;
  best: number;
  best_perfect: boolean;
  rank: number;
  players: number;
};

export type PuzzleboxRankRow = {
  rank: number;
  score: number;
  perfect: boolean;
  perfect_count: number;
  boards: number;
  attempts: number;
  achieved_at: string;
  nickname: string;
  tag: string;
  avatar_id: string | null;
  avatar_kind: string | null;
  palette_id: string | null;
  palette_swapped: boolean;
  is_me: boolean;
};

export type PuzzleboxBoardStats = {
  board: string;
  players: number;
  cleared: number;
  perfect: number;
  score_sum: number;
  mistakes_sum: number;
  rocks_sum: number;
  purple_first: number;
  level_solved: number[];
  question_wrong: number[];
  wrong_picks: number[];
  speed_sum: number;
};

export type PuzzleboxLeaderboard = {
  players: number;
  offset: number;
  rows: PuzzleboxRankRow[];
  me: PuzzleboxRankRow | null;
  stats: PuzzleboxBoardStats | null;
};

export type PuzzleboxStanding = { board: string; score: number; perfect: boolean; rank: number; players: number };

const CACHE_PREFIX = "sts-puzzlebox-rank:";
const CACHE_MS = 5 * 60 * 1000;

function readCache<T>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; value: T };
    return Date.now() - parsed.at < CACHE_MS ? parsed.value : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: unknown) {
  try {
    window.sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), value }));
  } catch {
    // Without storage every visit asks again.
  }
}

/** A new score makes that game's cached rankings stale. */
function clearGameCache(game: PuzzleboxGame) {
  try {
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(`${CACHE_PREFIX}${supabaseEnv}:${game}:`)) window.sessionStorage.removeItem(key);
    }
  } catch {
    // Nothing cached.
  }
}

/** Who the run belongs to on the rankings: the profile nickname and token, or the default nickname. */
export function puzzleboxPlayer(defaultNickname: string) {
  let stored = false;
  try {
    stored = hasStoredUserProfile(window.localStorage.getItem(USER_PROFILE_STORAGE_KEY));
  } catch {
    stored = false;
  }
  const nickname = stored ? readStoredUserProfile().nickname.trim() : "";
  return { nickname: nickname || defaultNickname, ...currentAuthorProfileToken() };
}

/**
 * Sends a finished run. Signs in anonymously when needed, like a comment does.
 * Returns null when Supabase is off or down; the game never waits on it.
 */
export async function submitPuzzleboxRun(input: {
  ensureUser: () => Promise<string | null>;
  game: PuzzleboxGame;
  board: number;
  run: ConnectionsRun | BetaQuizRun;
  player: ReturnType<typeof puzzleboxPlayer>;
}): Promise<PuzzleboxSubmitResult | null> {
  if (!supabaseEnabled) return null;
  try {
    const userId = await input.ensureUser();
    if (!userId) return null;
    // docs/supabase-exit/STEP1_DESIGN.md 9.5. The game never waits on a failure: null, as before.
    if (surfacePath("puzzlebox") === "api") {
      try {
        const body = await apiFetchAsUser<{ v?: number; result?: PuzzleboxSubmitResult | null }>(
          "puzzlebox",
          "/api/write/puzzlebox/runs",
          { method: "POST", body: { game: input.game, board: String(input.board), run: input.run, player: input.player } },
        );
        if (body?.v !== 1 || !body.result) return null;
        clearGameCache(input.game);
        return body.result;
      } catch (error) {
        if (!writeMayGoLegacy(error)) return null;
      }
    }
    const { data, error } = await withSupabaseTimeout(
      "rpc.submit_puzzlebox_run",
      supabase.rpc("submit_puzzlebox_run", {
        p_env: supabaseEnv,
        p_game: input.game,
        p_board: String(input.board),
        p_run: input.run,
        p_player: input.player,
      }),
    );
    if (error || !data) return null;
    clearGameCache(input.game);
    return data as PuzzleboxSubmitResult;
  } catch {
    return null;
  }
}

async function hasSession(): Promise<boolean> {
  try {
    const { data } = await withSupabaseTimeout(
      "auth.getSession",
      supabase.auth.getSession(),
      SUPABASE_AUTH_TIMEOUT_MS,
    );
    return Boolean(data.session?.user);
  } catch {
    return false;
  }
}

type LoadState<T> = { data: T | null; loading: boolean; failed: boolean };

/** One page of ten rows: a board's, or the game's totals when `board` is null. */
export function usePuzzleboxLeaderboard(input: {
  game: PuzzleboxGame;
  boards: PuzzleboxBoards;
  board: string | null;
  offset: number;
  aroundMe: boolean;
}): LoadState<PuzzleboxLeaderboard> {
  const { game, boards, board, offset, aroundMe } = input;
  const boardsKey = JSON.stringify(boards);
  const [state, setState] = useState<LoadState<PuzzleboxLeaderboard>>({ data: null, loading: true, failed: false });

  useEffect(() => {
    const encodedBoards = encodePuzzleboxBoards(JSON.parse(boardsKey) as PuzzleboxBoards);
    const viaApi = surfacePath("puzzlebox") === "api" && encodedBoards !== null;
    if (!supabaseEnabled && !viaApi) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- nothing to fetch without Supabase
      setState({ data: null, loading: false, failed: true });
      return;
    }
    let cancelled = false;
    const cacheKey = `${supabaseEnv}:${game}:${board ?? "total"}:${aroundMe ? "me" : offset}`;
    const cached = readCache<PuzzleboxLeaderboard>(cacheKey);
    if (cached) {
      setState({ data: cached, loading: false, failed: false });
      return;
    }
    setState((current) => ({ data: current.data, loading: true, failed: false }));
    (async () => {
      if (viaApi) {
        try {
          // With a session the RPC marks this player's rows (is_me, me), as supabase-js did with its token.
          const token = await currentAccessToken().catch(() => null);
          const query = new URLSearchParams({
            game,
            boards: encodedBoards as string,
            board: board ?? "total",
            offset: String(offset),
            around_me: aroundMe ? "1" : "0",
          });
          const body = token
            ? await apiFetchAsUser<{ v?: number; leaderboard?: PuzzleboxLeaderboard | null }>("puzzlebox", `/api/me/puzzlebox/leaderboard?${query}`)
            : await apiFetch<{ v?: number; leaderboard?: PuzzleboxLeaderboard | null }>("puzzlebox", `/api/read/puzzlebox/leaderboard?${query}`);
          if (cancelled) return;
          if (body?.v !== 1 || !body.leaderboard) {
            setState({ data: null, loading: false, failed: true });
            return;
          }
          writeCache(cacheKey, body.leaderboard);
          setState({ data: body.leaderboard, loading: false, failed: false });
          return;
        } catch (error) {
          if (cancelled) return;
          if (!shouldUseLegacy(error) || !supabaseEnabled) {
            setState({ data: null, loading: false, failed: true });
            return;
          }
        }
      }
      try {
        const { data, error } = await withSupabaseTimeout(
          "rpc.get_puzzlebox_leaderboard",
          supabase.rpc("get_puzzlebox_leaderboard", {
            p_env: supabaseEnv,
            p_game: game,
            p_boards: JSON.parse(boardsKey) as PuzzleboxBoards,
            p_board: board,
            p_offset: offset,
            p_around_me: aroundMe,
          }),
        );
        if (cancelled) return;
        if (error || !data) {
          setState({ data: null, loading: false, failed: true });
          return;
        }
        writeCache(cacheKey, data);
        setState({ data: data as PuzzleboxLeaderboard, loading: false, failed: false });
      } catch {
        if (!cancelled) setState({ data: null, loading: false, failed: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [game, boardsKey, board, offset, aroundMe]);

  return state;
}

/** The player's rank on each board they finished, for the lists. Never signs anyone in. */
export function useMyPuzzleboxStandings(game: PuzzleboxGame, boards: PuzzleboxBoards, refresh = 0) {
  const boardsKey = JSON.stringify(boards);
  const [standings, setStandings] = useState<Record<string, PuzzleboxStanding>>({});

  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancelled = false;
    const cacheKey = `${supabaseEnv}:${game}:standings`;
    const cached = readCache<PuzzleboxStanding[]>(cacheKey);
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- cached rows from session storage
      setStandings(Object.fromEntries(cached.map((row) => [row.board, row])));
      return;
    }
    (async () => {
      if (!(await hasSession()) || cancelled) return;
      const encodedBoards = encodePuzzleboxBoards(JSON.parse(boardsKey) as PuzzleboxBoards);
      if (surfacePath("puzzlebox") === "api" && encodedBoards !== null) {
        try {
          const query = new URLSearchParams({ game, boards: encodedBoards });
          const body = await apiFetchAsUser<{ v?: number; standings?: PuzzleboxStanding[] }>(
            "puzzlebox",
            `/api/me/puzzlebox/standings?${query}`,
          );
          if (cancelled || body?.v !== 1 || !Array.isArray(body.standings)) return;
          writeCache(cacheKey, body.standings);
          setStandings(Object.fromEntries(body.standings.map((row) => [row.board, row])));
          return;
        } catch (error) {
          // Lists show local scores only, unless the Worker sent this group back to the legacy path.
          if (cancelled || !shouldUseLegacy(error)) return;
        }
      }
      try {
        const { data, error } = await withSupabaseTimeout(
          "rpc.get_my_puzzlebox_standings",
          supabase.rpc("get_my_puzzlebox_standings", {
            p_env: supabaseEnv,
            p_game: game,
            p_boards: JSON.parse(boardsKey) as PuzzleboxBoards,
          }),
        );
        if (cancelled || error || !Array.isArray(data)) return;
        writeCache(cacheKey, data);
        setStandings(Object.fromEntries((data as PuzzleboxStanding[]).map((row) => [row.board, row])));
      } catch {
        // Lists show local scores only.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [game, boardsKey, refresh]);

  return standings;
}

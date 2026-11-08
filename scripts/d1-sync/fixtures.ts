/** Synthetic Supabase rows (valid for every D1 CHECK) for the step-2 sync specs. No real data. */
import type { Row } from "./fake-postgrest";

export const ENV = "development";
export const OTHER_ENV = "production";

/** A deterministic uuid from a number. */
export const U = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const TS = "2026-11-08T02:00:00.123456+00:00";

const author = { avatar_id: "IRONCLAD", avatar_kind: "character", palette_id: "red", palette_swapped: false };

export function comment(n: number, story: string, user = U(1), extra: Row = {}): Row {
  return {
    id: U(100_000 + n), story_id: story, user_id: user, nickname: "닉", content: `댓글 ${n}`, created_at: TS,
    env: ENV, content_blocks: null, parent_id: null, meta: null, ...author, ...extra,
  };
}

export function like(story: string, user: string, extra: Row = {}): Row {
  return { id: U(200_000 + Number(user.slice(0, 8))), story_id: story, user_id: user, created_at: TS, env: ENV, reaction_type: "thumb_up", ...extra };
}

export function commentLike(commentId: string, user: string): Row {
  return { id: U(300_000 + Number(user.slice(0, 8))), comment_id: commentId, user_id: user, created_at: TS };
}

export function combo(n: number, extra: Row = {}): Row {
  return {
    id: U(400_000 + n), user_id: U(1), nickname: "닉", content: [], content_text: `콤보 ${n}`,
    resources: [{ type: "card", id: "bash" }, { type: "relic", id: "anchor" }], env: ENV, created_at: TS, like_count: 0,
    comment_count: 0, ...author, ...extra,
  };
}

export function thisOrThat(n: number, extra: Row = {}): Row {
  return {
    id: U(410_000 + n), user_id: U(1), nickname: "닉", left_type: "card", left_id: "bash", right_type: "card", right_id: "strike",
    reason: "이유가 있다", env: ENV, created_at: TS, like_count: 0, comment_count: 0, left_vote_count: 0, right_vote_count: 0,
    vote_rate_bps: 0, ...author, ...extra,
  };
}

export function thisOrThatLike(postId: string, user: string, env = ENV): Row {
  return { id: U(420_000 + Number(user.slice(0, 8))), post_id: postId, user_id: user, env, created_at: TS };
}

export function tournament(n: number, poolSize: number, extra: Row = {}): Row {
  return {
    id: U(430_000 + n), user_id: null, nickname: "닉", title: "월드컵", note: "", preset_key: "builtin:cards", game_version: "0.107.1",
    pool: Array.from({ length: poolSize }, (_, i) => ({ type: "card", id: `card-${i}` })), env: ENV, like_count: 0,
    comment_count: 0, play_count: 0, created_at: TS, ...author, ...extra,
  };
}

export function tournamentPlay(n: number, tournamentId: string, size: number): Row {
  const matches = Array.from({ length: size - 1 }, (_, i) => ({
    left_type: "card", left_id: `card-${(2 * i) % size}`, right_type: "card", right_id: `card-${(2 * i + 1) % size}`, winner: "left",
  }));
  return {
    id: U(440_000 + n), tournament_id: tournamentId, user_id: U(2), env: ENV, starting_size: size, champion_type: "card",
    champion_id: "card-0", matches, created_at: TS,
  };
}

export function candidateStat(tournamentId: string, index: number, rank: number): Row {
  return {
    tournament_id: tournamentId, env: ENV, resource_type: "card", resource_id: `card-${index}`, match_appearances: 1,
    match_wins: index % 2 === 0 ? 1 : 0, championships: index === 0 ? 1 : 0, current_rank: rank,
    rank_history: [{ at: "2026-11-08 02:00:00.123456", rank }],
  };
}

export const RAW = JSON.stringify({ seed: "SEED", players: [{ character: "CHARACTER.IRONCLAD" }], map_point_history: [] });

export function run(n: number, extra: Row = {}): Row {
  return {
    id: `r${String(n).padStart(16, "0")}`, raw: RAW, seed: `SEED${n}`, build: "v0.107.1", character: "CHARACTER.IRONCLAD",
    ascension: 5, win: true, start_time: 1762560000 + n, run_time: 1234, acts_count: 3, donor_user_id: U(1), created_at: TS,
    total_floors: 48, env: ENV, badges: [], highlight_card: null, highlight_relic: null, note_blocks: null, cover_spec: null,
    like_count: 0, comment_count: 0, donor_nickname: "기증자", ...extra,
  };
}

export function body(service: string, postId: string, extra: Row = {}): Row {
  return {
    env: ENV, source_service: service, source_id: postId, user_id: U(1), nickname: "닉", content: [], content_text: "조각 본문",
    created_at: TS, updated_at: TS, ...extra,
  };
}

export function story(n: number, extra: Row = {}): Row {
  return {
    id: U(500_000 + n), user_id: U(1), nickname: "닉", sentence: "이야기 한 줄", game: "sts2", env: ENV, created_at: TS,
    static_story_id: null, entity_type: "card", entity_id: "bash", change_id: null, patch_line_id: null, source: null,
    tags: [], linked_entities: [], ...author, ...extra,
  };
}

export function pagestorm(n: number, contentBytes: number): Row {
  return {
    id: U(510_000 + n), user_id: U(1), nickname: "닉", title: "서류", content: { type: "doc", text: "가".repeat(Math.ceil(contentBytes / 3)) },
    content_text: "본문", env: ENV, like_count: 0, comment_count: 0, created_at: TS, ...author,
  };
}

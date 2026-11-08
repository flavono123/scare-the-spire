import { ApiError, ApiUnavailableError, apiFetch, requireApiVersion } from "@/lib/api-client";
import { apiFetchAsUser } from "@/lib/api-session";
import { surfacePath } from "@/lib/runtime-flags";
import { cursorQuery, type ToyboxPostService } from "@/lib/toybox-api-rules";

/**
 * Browser calls for the toybox-feed group (docs/supabase-exit/STEP1_DESIGN.md 9.8).
 * Each helper is the api twin of one legacy supabase-js query; callers keep the
 * legacy query and redo it when `shouldUseLegacy(error)` (reads) or
 * `writeMayGoLegacy(error)` (writes). Feeds, posts and post writes answer with
 * PostgREST's array as is; the rest answer `{ v: 1, ... }`.
 */

export const TOYBOX_GROUP = "toybox-feed" as const;
const READ_MS = 20_000;
const UPLOAD_MS = 30_000;

type Row = Record<string, unknown>;
type Cursor = { score: number; createdAt: string; id: string } | null;

export function toyboxViaApi(): boolean {
  return surfacePath(TOYBOX_GROUP) === "api";
}

/** A passthrough answer: the array, or a v1 answer without rows (the Worker may not reach Supabase). */
function rowsOf(data: unknown, write = false): Row[] {
  if (Array.isArray(data)) return data as Row[];
  requireApiVersion(TOYBOX_GROUP, data as { v?: unknown } | null, write);
  throw new ApiUnavailableError(200, "no_upstream");
}

/** The PostgREST codes behind the Worker's write error codes (workers/api/routes/comments.ts restErrorCode). */
const POSTGREST_CODES: Readonly<Record<string, string>> = {
  check_violation: "23514",
  duplicate: "23505",
  not_found: "23503",
  forbidden: "42501",
};

/**
 * An api write error shaped like the legacy PostgREST error, so `isCheckViolation`
 * and the defragment panel's `isDatabaseRejection` read the same code. Other codes
 * (`invalid`, `unavailable`, `token_invalid`, `too_large`) stay as they are.
 */
export function toyboxWriteError(error: unknown): Error & { code?: string } {
  if (!(error instanceof ApiError)) return error instanceof Error ? error : new Error(String(error));
  return Object.assign(new Error(error.code), { code: POSTGREST_CODES[error.code] ?? error.code });
}

/** `write`: the answer to a write, which ran; an unknown version then demotes without a resend. */
function v1<T extends { v?: unknown }>(data: T, write = false): T {
  requireApiVersion(TOYBOX_GROUP, data, write);
  return data;
}

function ids(list: readonly string[]): string {
  return encodeURIComponent(list.join(","));
}

// --- Feeds -------------------------------------------------------------------------

export async function apiToyboxFeed(service: string, sort: string, cursor: Cursor): Promise<Row[]> {
  const query = new URLSearchParams({ service, sort, ...cursorQuery(cursor) });
  return rowsOf(await apiFetch(TOYBOX_GROUP, `/api/read/toybox-feed?${query}`, { timeoutMs: READ_MS }));
}

export async function apiDefragmentFeed(sort: string, cursor: Cursor): Promise<Row[]> {
  const query = new URLSearchParams({ sort, ...cursorQuery(cursor) });
  return rowsOf(await apiFetch(TOYBOX_GROUP, `/api/read/defragment-feed?${query}`, { timeoutMs: READ_MS }));
}

export async function apiDefragmentRuns(sort: string, cursor: Cursor): Promise<Row[]> {
  const query = new URLSearchParams({ sort, ...cursorQuery(cursor) });
  return rowsOf(await apiFetch(TOYBOX_GROUP, `/api/read/defragment-runs?${query}`, { timeoutMs: READ_MS }));
}

// --- Posts -------------------------------------------------------------------------

/** One post of this env, or null when there is none. */
export async function apiToyboxPost(service: ToyboxPostService, id: string): Promise<Row | null> {
  const query = new URLSearchParams({ service, id });
  const rows = rowsOf(await apiFetch(TOYBOX_GROUP, `/api/read/toybox-post?${query}`, { timeoutMs: READ_MS }));
  return rows[0] ?? null;
}

/** Inserts the row the legacy insert would send (user_id and env included; RLS checks user_id). */
export async function apiCreateToyboxPost(service: ToyboxPostService, row: Row): Promise<Row> {
  const rows = rowsOf(await apiFetchAsUser(TOYBOX_GROUP, `/api/write/toybox-post?service=${service}`, {
    method: "POST",
    body: row,
    timeoutMs: UPLOAD_MS,
  }), true);
  if (!rows[0]) throw new ApiUnavailableError(201, "empty_insert");
  return rows[0];
}

/** Updates the caller's own post; null when no row matched (not theirs or gone). */
export async function apiUpdateToyboxPost(service: ToyboxPostService, id: string, patch: Row): Promise<Row | null> {
  const query = new URLSearchParams({ service, id });
  const rows = rowsOf(await apiFetchAsUser(TOYBOX_GROUP, `/api/write/toybox-post?${query}`, {
    method: "PATCH",
    body: patch,
    timeoutMs: UPLOAD_MS,
  }), true);
  return rows[0] ?? null;
}

/** Deletes the caller's own post; false when no row matched. */
export async function apiDeleteToyboxPost(service: ToyboxPostService, id: string): Promise<boolean> {
  const query = new URLSearchParams({ service, id });
  const body = v1(await apiFetchAsUser<{ v?: number; deleted?: boolean }>(TOYBOX_GROUP, `/api/write/toybox-post?${query}`, { method: "DELETE" }), true);
  return body.deleted === true;
}

// --- Favorite tournament -----------------------------------------------------------

export async function apiTournamentPresets(): Promise<Row[]> {
  return rowsOf(await apiFetch(TOYBOX_GROUP, "/api/read/favorite-tournament/presets", { timeoutMs: READ_MS }));
}

export async function apiTournamentStats(id: string): Promise<Row[]> {
  return rowsOf(await apiFetch(TOYBOX_GROUP, `/api/read/favorite-tournament/stats?id=${encodeURIComponent(id)}`, { timeoutMs: READ_MS }));
}

export async function apiTournamentPlay(play: {
  tournamentId: string;
  startingSize: number;
  championType: string;
  championId: string;
  matches: unknown[];
}): Promise<unknown> {
  const body = v1(await apiFetchAsUser<{ v?: number; result?: unknown }>(TOYBOX_GROUP, "/api/write/favorite-tournament/play", {
    method: "POST",
    body: play,
  }), true);
  return body.result ?? null;
}

// --- Pagestorm ---------------------------------------------------------------------

export async function apiPagestormPosts(): Promise<Row[]> {
  return rowsOf(await apiFetch(TOYBOX_GROUP, "/api/read/pagestorm/posts", { timeoutMs: READ_MS }));
}

/** The caller's latest 20 drafts (list columns). */
export async function apiMyPagestormDrafts(): Promise<Row[]> {
  return rowsOf(await apiFetchAsUser(TOYBOX_GROUP, "/api/me/pagestorm/drafts", { timeoutMs: READ_MS }));
}

/** One draft of the caller (every column), or null. */
export async function apiMyPagestormDraft(id: string): Promise<Row | null> {
  const rows = rowsOf(await apiFetchAsUser(TOYBOX_GROUP, `/api/me/pagestorm/drafts?id=${encodeURIComponent(id)}`, { timeoutMs: READ_MS }));
  return rows[0] ?? null;
}

export async function apiCreatePagestormDraft(row: Row): Promise<Row> {
  const rows = rowsOf(await apiFetchAsUser(TOYBOX_GROUP, "/api/write/pagestorm/drafts", { method: "POST", body: row, timeoutMs: UPLOAD_MS }), true);
  if (!rows[0]) throw new ApiUnavailableError(201, "empty_insert");
  return rows[0];
}

export async function apiUpdatePagestormDraft(id: string, patch: Row): Promise<Row | null> {
  const rows = rowsOf(await apiFetchAsUser(TOYBOX_GROUP, `/api/write/pagestorm/drafts?id=${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: patch,
    timeoutMs: UPLOAD_MS,
  }), true);
  return rows[0] ?? null;
}

export async function apiDeletePagestormDraft(id: string): Promise<boolean> {
  const body = v1(await apiFetchAsUser<{ v?: number; deleted?: boolean }>(TOYBOX_GROUP, `/api/write/pagestorm/drafts?id=${encodeURIComponent(id)}`, { method: "DELETE" }), true);
  return body.deleted === true;
}

// --- Defragment bodies -------------------------------------------------------------

export async function apiDefragmentBody(sourceService: string, sourceId: string): Promise<Row | null> {
  const query = new URLSearchParams({ service: sourceService, id: sourceId });
  const rows = rowsOf(await apiFetch(TOYBOX_GROUP, `/api/read/defragment-body?${query}`, { timeoutMs: READ_MS }));
  return rows[0] ?? null;
}

/** Upserts on (env, source_service, source_id); the row carries user_id and env like the legacy upsert. */
export async function apiUpsertDefragmentBody(row: Row): Promise<Row | null> {
  const rows = rowsOf(await apiFetchAsUser(TOYBOX_GROUP, "/api/write/defragment-body", { method: "PUT", body: row, timeoutMs: UPLOAD_MS }), true);
  return rows[0] ?? null;
}

// --- This or that ------------------------------------------------------------------

export async function apiThisOrThatLikeCounts(postIds: readonly string[]): Promise<{ post_id: string; like_count: number }[]> {
  const body = v1(await apiFetch<{ v?: number; rows?: { post_id: string; like_count: number }[] }>(TOYBOX_GROUP, `/api/read/this-or-that/like-counts?ids=${ids(postIds)}`));
  return body.rows ?? [];
}

export async function apiMyThisOrThatLikes(postIds: readonly string[]): Promise<string[]> {
  const body = v1(await apiFetchAsUser<{ v?: number; rows?: { post_id: string }[] }>(TOYBOX_GROUP, `/api/me/this-or-that/likes?ids=${ids(postIds)}`));
  return (body.rows ?? []).map((row) => row.post_id);
}

export async function apiSetThisOrThatLike(postId: string, liked: boolean): Promise<void> {
  v1(await apiFetchAsUser<{ v?: number }>(TOYBOX_GROUP, `/api/write/this-or-that/like?id=${encodeURIComponent(postId)}`, {
    method: liked ? "PUT" : "DELETE",
  }), true);
}

export async function apiThisOrThatVoteSummaries(postIds: readonly string[]): Promise<Row[]> {
  const body = v1(await apiFetch<{ v?: number; rows?: Row[] }>(TOYBOX_GROUP, `/api/read/this-or-that/vote-summaries?ids=${ids(postIds)}`));
  return body.rows ?? [];
}

export async function apiMyThisOrThatVotes(postIds: readonly string[]): Promise<{ post_id: string; choice: string }[]> {
  const body = v1(await apiFetchAsUser<{ v?: number; rows?: { post_id: string; choice: string }[] }>(TOYBOX_GROUP, `/api/me/this-or-that/votes?ids=${ids(postIds)}`));
  return body.rows ?? [];
}

export async function apiThisOrThatVote(postId: string, choice: "left" | "right", surface: "index" | "detail"): Promise<void> {
  v1(await apiFetchAsUser<{ v?: number }>(TOYBOX_GROUP, `/api/write/this-or-that/vote?id=${encodeURIComponent(postId)}`, {
    method: "PUT",
    body: { choice, surface },
  }), true);
}

export async function apiThisOrThatUnvote(postId: string): Promise<void> {
  v1(await apiFetchAsUser<{ v?: number }>(TOYBOX_GROUP, `/api/write/this-or-that/vote?id=${encodeURIComponent(postId)}`, { method: "DELETE" }), true);
}

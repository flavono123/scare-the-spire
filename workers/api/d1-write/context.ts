import type { D1Database } from "../d1";
import { apiError, jsonResponse } from "../http";
import type { UserRouteContext } from "../router";
import type { ApiDataEnv } from "../supabase-rest";
import { stmt, tsFromMs, type D1Statement } from "./db";

/**
 * What a step 5 D1 write handler gets (docs/SUPABASE_EXIT_PLAN.md 5.2): the route context, the D1
 * binding, the caller's uid, the Worker's data env and one clock reading for the whole write.
 */

export type D1WriteContext = {
  context: UserRouteContext;
  db: D1Database;
  uid: string;
  dataEnv: ApiDataEnv;
  nowMs: number;
  /** Canonical D1 timestamp of nowMs (design 3.3). */
  now: string;
};

export type D1WriteHandler = (write: D1WriteContext) => Promise<Response>;

/**
 * The caller's uid. Step 4 replaces the default with the signed-cookie identity (plan 5.3); until
 * then it is the verified Supabase token's subject, so the D1 path owns rows exactly as RLS does
 * (auth.uid() = user_id). null means "no identity": the write answers 401.
 */
export type UidResolver = (context: UserRouteContext) => Promise<string | null>;

const tokenSubject: UidResolver = async (context) => {
  const id = context.user?.userId;
  return typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id) ? id : null;
};

let uidResolver: UidResolver = tokenSubject;

export function setUidResolver(next: UidResolver | null): void {
  uidResolver = next ?? tokenSubject;
}

export function resolveUid(context: UserRouteContext): Promise<string | null> {
  return uidResolver(context);
}

/** One clock reading for the whole write: Unix ms and its canonical timestamp (nowTs's form). */
export function writeClock(nowMs = Date.now()): { nowMs: number; now: string } {
  return { nowMs, now: tsFromMs(nowMs) };
}

export function dbOrUnavailable(context: UserRouteContext): D1Database | Response {
  return context.db ?? apiError("unavailable");
}

export { apiError, jsonResponse };

// --- Thread keys --------------------------------------------------------------------------------

/** Thread key prefix -> posts.service (design 3.4; Supabase admin_story_service). */
export const THREAD_PREFIX_SERVICES: Readonly<Record<string, string>> = {
  "c-c-c-combo": "combo",
  "chemical-x": "chemical_x",
  transfigure: "transfigure",
  "this-or-that": "this_or_that",
  "favorite-tournament": "favorite_tournament",
  "decisions-decisions": "decisions_decisions",
  pagestorm: "pagestorm",
  "history-course": "history_course",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The post a thread key counts for, as apply_toybox_thread_engagement_delta finds it: the prefix
 * names the service, split_part(key, ':', 2) the id (a uuid for Toy Box posts, the run id for runs).
 */
export function threadOwner(key: string): { service: string; id: string } | null {
  const parts = key.split(":");
  const service = THREAD_PREFIX_SERVICES[parts[0]];
  if (!service || parts.length < 2) return null;
  const id = parts[1];
  if (service === "history_course") return id ? { service, id } : null;
  return UUID.test(id) ? { service, id: id.toLowerCase() } : null;
}

/** E13c: copy the thread's counts to its post (a this-or-that like count is its like rows). */
export function ownerCopyStatement(key: string): D1Statement | null {
  const owner = threadOwner(key);
  if (!owner) return null;
  return stmt(
    "UPDATE posts SET " +
      "like_count = CASE WHEN service = 'this_or_that' " +
      "THEN (SELECT count(*) FROM this_or_that_post_likes WHERE service = 'this_or_that' AND post_id = ?2) " +
      "ELSE coalesce((SELECT like_count FROM threads WHERE thread_key = ?1), 0) END, " +
      "comment_count = coalesce((SELECT comment_count FROM threads WHERE thread_key = ?1), 0) " +
      "WHERE service = ?3 AND id = ?2",
    key,
    owner.id,
    owner.service,
  );
}

/** E13a */
export function commentRecountStatement(key: string, nowMs: number): D1Statement {
  return stmt(
    "INSERT INTO threads (thread_key, comment_count, last_comment_at, updated_at) " +
      "SELECT ?1, count(*), max(created_at), ?2 FROM comments WHERE story_id = ?1 " +
      "ON CONFLICT (thread_key) DO UPDATE SET comment_count = excluded.comment_count, " +
      "last_comment_at = excluded.last_comment_at, updated_at = excluded.updated_at " +
      "WHERE threads.comment_count IS NOT excluded.comment_count OR threads.last_comment_at IS NOT excluded.last_comment_at " +
      "RETURNING comment_count",
    key,
    nowMs,
  );
}

/** E13b */
export function likeRecountStatement(key: string, nowMs: number): D1Statement {
  return stmt(
    "INSERT INTO threads (thread_key, like_count, updated_at) " +
      "SELECT ?1, count(*), ?2 FROM likes WHERE story_id = ?1 " +
      "ON CONFLICT (thread_key) DO UPDATE SET like_count = excluded.like_count, updated_at = excluded.updated_at " +
      "WHERE threads.like_count IS NOT excluded.like_count " +
      "RETURNING like_count",
    key,
    nowMs,
  );
}

export function json(body: unknown, status = 200): Response {
  return jsonResponse(body, { status });
}

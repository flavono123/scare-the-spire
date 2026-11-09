/**
 * Reads of the /dev pages and /api/dev routes of `next dev` (docs/SUPABASE_EXIT_PLAN.md 5.7): the
 * same rows they read from Supabase, from each env's D1 (scripts/lib/d1-remote.ts), handed back in
 * the PostgREST shapes the pages already take (booleans, parsed JSON, `+00:00` timestamps, env).
 * get_rls_activity_metrics has no D1 counterpart: it stays a Supabase RPC, over fetch.
 *
 * Supabase envs live in different D1 databases (production -> slseoun-prod, development ->
 * slseoun-testbed), so an env filter becomes the choice of database and a read of both envs reads both.
 */
import {
  COMMENT_OTHER_PREFIXES,
  commentStoryFilter,
  type AdminPostService,
} from "../../src/lib/admin-rls-activity";
import type { CommentThreadService } from "../../src/lib/comment-threads";
import { postgrestTs } from "../../src/lib/d1-time";
import { WRITE_PAUSED_KEY } from "../../src/lib/write-source-flags";
import { GATE_SQL, parseGateRows, type WriteGate } from "../../workers/api/d1-write/gate";
import { Q_F1, Q_P1 } from "../../workers/api/d1-adapters/queries";
import { DATA_ENV_OF, D1_ENVS, type D1EnvName, type D1Remote, type D1Rows } from "../lib/d1-remote";
import { supabaseRest, type RestFetch, type SupabaseAdminConfig } from "../lib/supabase-admin";
import type { D1Statement } from "../../src/lib/d1-sync/statements";

type Row = Record<string, unknown>;

export interface ReadResult<T> {
  data: T;
  count?: number;
  error?: string;
}

const message = (error: unknown) => (error instanceof Error ? error.message : "Unknown D1 error");

/** D1 values -> today's PostgREST values for the named columns. */
export function pgRow(row: Row, kinds: { bool?: readonly string[]; json?: readonly string[]; ts?: readonly string[] }, extra: Row = {}): Row {
  const out: Row = { ...row };
  for (const name of kinds.bool ?? []) {
    if (out[name] !== null && out[name] !== undefined) out[name] = Number(out[name]) !== 0;
  }
  for (const name of kinds.json ?? []) {
    if (typeof out[name] === "string") out[name] = JSON.parse(String(out[name]));
  }
  for (const name of kinds.ts ?? []) {
    if (out[name] !== null && out[name] !== undefined) out[name] = postgrestTs(out[name]) ?? out[name];
  }
  return { ...out, ...extra };
}

const stmt = (sql: string, ...params: Array<string | number | null>): D1Statement => ({ sql, params });

/** A Postgres LIKE pattern (case sensitive; % and _ wildcards, no escapes) as a SQLite GLOB pattern. */
export function likeToGlob(pattern: string): string {
  let out = "";
  for (const ch of pattern) {
    if (ch === "%") out += "*";
    else if (ch === "_") out += "?";
    else if (ch === "*" || ch === "?" || ch === "[") out += `[${ch}]`;
    else out += ch;
  }
  return out;
}

function countOf(rows: D1Rows | undefined): number {
  return Number(rows?.[0]?.n ?? 0);
}

// ------------------------------------------------------------------------------------------- /dev/admin

export const ADMIN_ROW_LIMIT = 50;
export const ADMIN_CONTACT_ROW_LIMIT = 100;
/** The admin page reads production's community data (ADMIN_DATA_ENV). */
export const ADMIN_D1_ENV: D1EnvName = "production";

const AUTHOR_BOOL = ["palette_swapped"] as const;

/** The comment filter of the page (commentStoryFilter) as SQL over D1 comments. */
export function commentWhere(service: CommentThreadService | null): { sql: string; params: string[] } {
  const filter = commentStoryFilter(service);
  if (!filter) return { sql: "", params: [] };
  if (filter.kind === "eq") return { sql: "WHERE story_id = ?1", params: [filter.value] };
  if (filter.kind === "like") return { sql: "WHERE story_id GLOB ?1", params: [likeToGlob(filter.value)] };
  const params = COMMENT_OTHER_PREFIXES.map((prefix) => likeToGlob(`${prefix}%`));
  return {
    sql: `WHERE story_id <> 'byrdispatch' AND ${params.map((_, i) => `story_id NOT GLOB ?${i + 1}`).join(" AND ")}`,
    params,
  };
}

export async function readAdminComments(d1: D1Remote, service: CommentThreadService | null): Promise<ReadResult<Row[]>> {
  const where = commentWhere(service);
  try {
    const [rows, total] = await d1.run([
      stmt(
        "SELECT id, story_id, user_id, nickname, content, content_blocks, created_at, avatar_id, avatar_kind, palette_id, palette_swapped " +
          `FROM comments ${where.sql} ORDER BY created_at DESC LIMIT ${ADMIN_ROW_LIMIT}`,
        ...where.params,
      ),
      stmt(`SELECT count(*) AS n FROM comments ${where.sql}`, ...where.params),
    ]);
    return {
      data: rows.map((row) => pgRow(row, { bool: AUTHOR_BOOL, json: ["content_blocks"], ts: ["created_at"] }, { env: DATA_ENV_OF[d1.env] })),
      count: countOf(total),
    };
  } catch (error) {
    return { data: [], error: message(error) };
  }
}

const AUTHOR_COLUMNS = "p.avatar_id, p.avatar_kind, p.palette_id, p.palette_swapped";

function servicePosts(service: string, columns: string): string {
  return (
    `SELECT p.id AS id, p.user_id AS user_id, p.nickname AS nickname, ${columns}, p.created_at AS created_at, ${AUTHOR_COLUMNS} ` +
    `FROM posts p JOIN post_${service} s ON s.service = p.service AND s.post_id = p.id WHERE p.service = '${service}'`
  );
}

/** The columns each service tab selected from its Supabase table, from D1. */
export const ADMIN_POST_READS: Readonly<Record<AdminPostService, { sql: string; json?: readonly string[]; bool?: readonly string[] }>> = {
  stories: {
    sql:
      "SELECT id, user_id, nickname, sentence, created_at, avatar_id, avatar_kind, palette_id, palette_swapped " +
      "FROM community_stories WHERE static_story_id IS NULL",
  },
  combo: { sql: servicePosts("combo", "s.content AS content, s.content_text AS content_text"), json: ["content"] },
  transfigure: {
    sql: servicePosts(
      "transfigure",
      "s.resource_type AS resource_type, s.resource_id AS resource_id, s.content AS content, s.content_text AS content_text, " +
        "p.title AS title, s.transformed_name AS transformed_name",
    ),
    json: ["content"],
  },
  this_or_that: {
    sql: servicePosts(
      "this_or_that",
      "s.left_type AS left_type, s.left_id AS left_id, s.right_type AS right_type, s.right_id AS right_id, s.reason AS reason",
    ),
  },
  chemical_x: { sql: servicePosts("chemical_x", "s.content AS content, s.content_text AS content_text"), json: ["content"] },
  decisions_decisions: { sql: servicePosts("decisions_decisions", "p.title AS title, s.note AS note") },
  favorite_tournament: { sql: servicePosts("favorite_tournament", "p.title AS title, s.note AS note") },
  pagestorm: { sql: servicePosts("pagestorm", "p.title AS title, s.content_text AS content_text") },
  history_course: {
    sql:
      "SELECT p.id AS id, p.user_id AS donor_user_id, h.\"character\" AS \"character\", h.ascension AS ascension, h.win AS win, " +
      "p.created_at AS created_at FROM posts p JOIN post_history_course h ON h.service = p.service AND h.post_id = p.id " +
      "WHERE p.service = 'history_course'",
    bool: ["win"],
  },
};

/** The latest 50 posts of each service and each total, in one D1 call. */
export async function readAdminServicePosts(
  d1: D1Remote,
  services: readonly AdminPostService[],
): Promise<Record<AdminPostService, ReadResult<Row[]>>> {
  const out = {} as Record<AdminPostService, ReadResult<Row[]>>;
  try {
    const results = await d1.run(services.flatMap((service) => {
      const base = ADMIN_POST_READS[service].sql;
      return [
        stmt(`SELECT * FROM (${base}) ORDER BY created_at DESC LIMIT ${ADMIN_ROW_LIMIT}`),
        stmt(`SELECT count(*) AS n FROM (${base})`),
      ];
    }));
    services.forEach((service, index) => {
      const spec = ADMIN_POST_READS[service];
      out[service] = {
        data: results[index * 2].map((row) => pgRow(row, { bool: [...AUTHOR_BOOL, ...(spec.bool ?? [])], json: spec.json, ts: ["created_at"] })),
        count: countOf(results[index * 2 + 1]),
      };
    });
  } catch (error) {
    for (const service of services) out[service] = { data: [], error: message(error) };
  }
  return out;
}

/** Contact inquiries of both envs (each env's D1), newest first, with the total. */
export async function readAdminContactInquiries(d1Of: (env: D1EnvName) => D1Remote): Promise<ReadResult<Row[]>> {
  const parts = await Promise.all(D1_ENVS.map(async (env) => {
    try {
      const [rows, total] = await d1Of(env).run([
        stmt(
          "SELECT id, user_id, category, message, reply_email, page_path, service_locale, game_locale, status, admin_response, responded_at, created_at " +
            `FROM contact_inquiries ORDER BY created_at DESC LIMIT ${ADMIN_CONTACT_ROW_LIMIT}`,
        ),
        stmt("SELECT count(*) AS n FROM contact_inquiries"),
      ]);
      return { rows: rows.map((row) => pgRow(row, { ts: ["responded_at", "created_at"] }, { env: DATA_ENV_OF[env] })), count: countOf(total) };
    } catch (error) {
      return { rows: [] as Row[], count: 0, error: `${DATA_ENV_OF[env]}: ${message(error)}` };
    }
  }));
  const errors = parts.flatMap((part) => ("error" in part && part.error ? [part.error] : []));
  const data = parts
    .flatMap((part) => part.rows)
    .sort((left, right) => Date.parse(String(right.created_at)) - Date.parse(String(left.created_at)))
    .slice(0, ADMIN_CONTACT_ROW_LIMIT);
  return { data, count: parts.reduce((sum, part) => sum + part.count, 0), error: errors.length ? errors.join(" · ") : undefined };
}

/** The nickname pool rows (env-less: production's copy) and production's write gate, in one call. */
export async function readAdminNicknamePools(d1: D1Remote): Promise<{ rows: Row[]; gate: WriteGate | null; error?: string }> {
  try {
    const [rows, gate] = await d1.run([stmt(Q_P1), stmt(GATE_SQL, WRITE_PAUSED_KEY)]);
    return { rows: rows.map((row) => pgRow(row, { json: ["nicknames"] })), gate: parseGateRows(gate) };
  } catch (error) {
    return { rows: [], gate: null, error: message(error) };
  }
}

export const RLS_METRICS_TIMEOUT_MS = 20_000;

/** get_rls_activity_metrics(p_env) on Supabase with the secret key (no D1 counterpart). */
export async function readRlsActivityMetricsRpc(
  config: SupabaseAdminConfig,
  env: string,
  options: { fetch?: RestFetch } = {},
): Promise<{ data: unknown; error: { code?: string; message: string } | null }> {
  const result = await supabaseRest(
    config,
    { method: "POST", path: "rpc/get_rls_activity_metrics", body: { p_env: env } },
    { fetch: options.fetch, timeoutMs: RLS_METRICS_TIMEOUT_MS },
  );
  return result.ok ? { data: result.data, error: null } : { data: null, error: result.error };
}

// ------------------------------------------------------------------------------------------- /api/dev

/** Inquiries still in the "new" state, both envs (the dev mailbox pip). */
export async function countUncheckedInquiries(d1Of: (env: D1EnvName) => D1Remote): Promise<number> {
  const counts = await Promise.all(D1_ENVS.map(async (env) => {
    const [rows] = await d1Of(env).run([stmt("SELECT count(*) AS n FROM contact_inquiries WHERE status = 'new'")]);
    return countOf(rows);
  }));
  return counts.reduce((sum, value) => sum + value, 0);
}

export const PROD_RUN_LIMIT = 100;

const RUN_SUMMARY_SQL =
  "SELECT p.id AS id, h.seed AS seed, h.build AS build, h.\"character\" AS \"character\", h.ascension AS ascension, h.win AS win, " +
  "h.start_time AS start_time, h.run_time AS run_time, h.acts_count AS acts_count, h.total_floors AS total_floors, p.created_at AS created_at " +
  "FROM posts p JOIN post_history_course h ON h.service = p.service AND h.post_id = p.id WHERE p.service = 'history_course'";

/** The latest 100 production runs and the total (prod-runs-dev-section, toybox preview). */
export async function listProductionRuns(d1: D1Remote): Promise<{ runs: Row[]; count: number }> {
  const [rows, total] = await d1.run([
    stmt(`${RUN_SUMMARY_SQL} ORDER BY p.created_at DESC LIMIT ${PROD_RUN_LIMIT}`),
    stmt("SELECT count(*) AS n FROM posts WHERE service = 'history_course'"),
  ]);
  return { runs: rows.map((row) => pgRow(row, { bool: ["win"], ts: ["created_at"] })), count: countOf(total) };
}

/** One production run with its raw, or null when D1 has no run (or not its raw yet). */
export async function readProductionRun(d1: D1Remote, runId: string): Promise<Row | null> {
  const [rows] = await d1.run([
    stmt(
      "SELECT p.id AS id, f.raw AS raw, h.seed AS seed, h.build AS build, h.\"character\" AS \"character\", h.ascension AS ascension, " +
        "h.win AS win, h.start_time AS start_time, h.run_time AS run_time, h.acts_count AS acts_count, h.total_floors AS total_floors, " +
        "p.created_at AS created_at FROM posts p JOIN post_history_course h ON h.service = p.service AND h.post_id = p.id " +
        "LEFT JOIN post_history_course_file f ON f.service = p.service AND f.post_id = p.id " +
        "WHERE p.service = 'history_course' AND p.id = ?1",
      runId,
    ),
  ]);
  const row = rows[0];
  if (!row || typeof row.raw !== "string") return null;
  return pgRow(row, { bool: ["win"], ts: ["created_at"] });
}

/** /dev/colorful-philosophers: the env's latest 100 posts (the week list the Worker serves, F1). */
export async function listPhilosopherPosts(d1: D1Remote): Promise<Row[]> {
  const [rows] = await d1.run([stmt(Q_F1)]);
  return rows;
}

/** The slots of a week's production posts (the dev menu's "next week is not full" dot). */
export async function philosopherWeekSlots(d1: D1Remote, weekStart: string): Promise<string[]> {
  const [rows] = await d1.run([stmt("SELECT slot FROM colorful_philosopher_posts WHERE week_start = ?1", weekStart)]);
  return rows.map((row) => String(row.slot));
}

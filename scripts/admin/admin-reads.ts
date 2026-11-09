/**
 * Reads of the /dev pages and /api/dev routes of `next dev` (docs/SUPABASE_EXIT_PLAN.md 5.7): the
 * same rows they read from Supabase, from each env's D1 (scripts/lib/d1-remote.ts), handed back in
 * the PostgREST shapes the pages already take (booleans, parsed JSON, `+00:00` timestamps, env).
 * get_rls_activity_metrics has no D1 counterpart: it stays a Supabase RPC, over fetch.
 *
 * Supabase envs live in different D1 databases (production -> slseoun-prod, development ->
 * slseoun-testbed), so an env filter becomes the choice of database and a read of both envs reads both.
 *
 * Reads of rows an operator write changes (contact inquiries, nickname pools, philosopher posts) follow
 * that write's store instead (see "Reads that follow the operator write" below): while the write goes
 * to Supabase, D1 only gets it on the next step 2 sync, so the page reads Supabase and shows the save.
 */
import {
  COMMENT_OTHER_PREFIXES,
  commentStoryFilter,
  type AdminPostService,
} from "../../src/lib/admin-rls-activity";
import type { CommentThreadService } from "../../src/lib/comment-threads";
import { postgrestTs } from "../../src/lib/d1-time";
import type { WriteSource } from "../../src/lib/write-source-flags";
import { anyD1Source, parseGateRows, type WriteGate } from "../../workers/api/d1-write/gate";
import { Q_F1, Q_P1 } from "../../workers/api/d1-adapters/queries";
import { DATA_ENV_OF, D1_ENVS, GATE_STATEMENT, type D1EnvName, type D1Remote, type D1Rows, type DataEnv } from "../lib/d1-remote";
import { supabaseRest, type RestFetch, type RestRequest, type SupabaseAdminConfig } from "../lib/supabase-admin";
import type { D1Statement } from "../../src/lib/d1-sync/statements";
import { NICKNAME_POOLS_TABLE, PHILOSOPHER_POSTS_TABLE, PHILOSOPHER_SELECT, type AdminDeps } from "./admin-writes";

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

// ------------------------------------------------------------------------------------------- reads that follow the operator write

/**
 * The stores of the dev server: each env's D1, and Supabase with the secret key (null without one).
 * AdminDeps (admin-deps.ts) is one.
 */
export type AdminReadDeps = Pick<AdminDeps, "d1" | "supabase" | "fetch">;

export const SUPABASE_KEY_MISSING = "SUPABASE_SECRET_KEY is not configured";

/** A read that has to go to Supabase while the server has no secret key. */
export class SupabaseKeyMissingError extends Error {
  constructor() {
    super(SUPABASE_KEY_MISSING);
    this.name = "SupabaseKeyMissingError";
  }
}

/**
 * One D1 call of an env: its write gate (readGate's statement and parser, the gate the operator writes
 * go by) and then the D1 rows, so a read on the D1 path costs no extra round trip. When the gate sends
 * the matching write to Supabase, the caller drops the D1 rows and reads Supabase.
 */
async function gatedD1(d1: D1Remote, statements: D1Statement[]): Promise<{ gate: WriteGate; results: D1Rows[] }> {
  const [gateRows, ...results] = await d1.run([GATE_STATEMENT, ...statements]);
  return { gate: parseGateRows(gateRows ?? []), results };
}

/** A Supabase read with the secret key (PostgREST over fetch). Throws on a missing key or a failed request. */
async function restRead(deps: AdminReadDeps, request: RestRequest): Promise<{ data: unknown; count: number | null }> {
  if (!deps.supabase) throw new SupabaseKeyMissingError();
  const result = await supabaseRest(deps.supabase, request, { fetch: deps.fetch });
  if (!result.ok) throw Object.assign(new Error(result.error.message), { code: result.error.code });
  return { data: result.data, count: result.count };
}

const rowsOf = (data: unknown): Row[] => (Array.isArray(data) ? (data as Row[]) : []);

/**
 * The envs whose source is supabase, as one Supabase read: no env filter when every env is on
 * Supabase (the request the page made before D1), else one read per env with its `env` filter.
 */
function supabaseEnvFilters(envs: readonly D1EnvName[]): Array<DataEnv | undefined> {
  if (envs.length === 0) return [];
  return envs.length === D1_ENVS.length ? [undefined] : envs.map((env) => DATA_ENV_OF[env]);
}

// contact_inquiries: replyToContactInquiry goes by source.contact of the inquiry's env.

export const CONTACT_INQUIRY_SELECT =
  "id,user_id,category,message,reply_email,page_path,service_locale,game_locale,env,status,admin_response,responded_at,created_at";

/** The page's Supabase read before D1: the latest 100 inquiries with the exact total. */
export function contactInquiriesRequest(dataEnv?: DataEnv): RestRequest {
  return {
    method: "GET",
    path: "contact_inquiries",
    query: { select: CONTACT_INQUIRY_SELECT, ...(dataEnv ? { env: `eq.${dataEnv}` } : {}), order: "created_at.desc", limit: String(ADMIN_CONTACT_ROW_LIMIT) },
    prefer: ["count=exact"],
  };
}

/** The mailbox pip's Supabase count before D1 (supabase-js head: true). */
export function uncheckedInquiriesRequest(dataEnv?: DataEnv): RestRequest {
  return {
    method: "HEAD",
    path: "contact_inquiries",
    query: { select: "id", ...(dataEnv ? { env: `eq.${dataEnv}` } : {}), status: "eq.new" },
    prefer: ["count=exact"],
  };
}

/**
 * Contact inquiries of both envs, newest first, with the total: each env from the store its reply
 * writes to. Null when that is Supabase for every env and the server has no secret key (the page's
 * "server key needed" state, as before D1).
 */
export async function readAdminContactInquiries(deps: AdminReadDeps): Promise<ReadResult<Row[]> | null> {
  type Part = { env: D1EnvName; source: WriteSource | null; rows: Row[]; count: number; error?: string };
  const parts: Part[] = await Promise.all(D1_ENVS.map(async (env): Promise<Part> => {
    try {
      const { gate, results: [rows, total] } = await gatedD1(deps.d1(env), [
        stmt(
          "SELECT id, user_id, category, message, reply_email, page_path, service_locale, game_locale, status, admin_response, responded_at, created_at " +
            `FROM contact_inquiries ORDER BY created_at DESC LIMIT ${ADMIN_CONTACT_ROW_LIMIT}`,
        ),
        stmt("SELECT count(*) AS n FROM contact_inquiries"),
      ]);
      return {
        env,
        source: gate.sources.contact,
        rows: rows.map((row) => pgRow(row, { ts: ["responded_at", "created_at"] }, { env: DATA_ENV_OF[env] })),
        count: countOf(total),
      };
    } catch (error) {
      return { env, source: null, rows: [], count: 0, error: `${DATA_ENV_OF[env]}: ${message(error)}` };
    }
  }));

  const onSupabase = parts.filter((part) => part.source === "supabase").map((part) => part.env);
  if (onSupabase.length === D1_ENVS.length) {
    if (!deps.supabase) return null;
    try {
      const { data, count } = await restRead(deps, contactInquiriesRequest());
      return { data: rowsOf(data), count: count ?? undefined };
    } catch (error) {
      return { data: [], error: message(error) };
    }
  }
  for (const part of parts) {
    if (part.source !== "supabase") continue;
    try {
      const { data, count } = await restRead(deps, contactInquiriesRequest(DATA_ENV_OF[part.env]));
      Object.assign(part, { rows: rowsOf(data), count: count ?? rowsOf(data).length });
    } catch (error) {
      Object.assign(part, { rows: [], count: 0, error: `${DATA_ENV_OF[part.env]}: ${message(error)}` });
    }
  }
  const errors = parts.flatMap((part) => (part.error ? [part.error] : []));
  const data = parts
    .flatMap((part) => part.rows)
    .sort((left, right) => Date.parse(String(right.created_at)) - Date.parse(String(left.created_at)))
    .slice(0, ADMIN_CONTACT_ROW_LIMIT);
  return { data, count: parts.reduce((sum, part) => sum + part.count, 0), error: errors.length ? errors.join(" · ") : undefined };
}

// profile_character_nickname_pools: env-less; saveProfileNicknamePools writes Supabase or production
// D1 by production's source.profile (the testbed copy only follows), so production's gate decides.

/** The page's Supabase read before D1. */
export function nicknamePoolsRequest(): RestRequest {
  return { method: "GET", path: NICKNAME_POOLS_TABLE, query: { select: "character_id,locale,nicknames" } };
}

/**
 * The nickname pool rows from the store the save writes to, with production's write gate. Null when
 * that is Supabase and the server has no secret key (defaults, not editable, as before D1).
 */
export async function readAdminNicknamePools(deps: AdminReadDeps): Promise<{ rows: Row[]; gate: WriteGate | null; error?: string } | null> {
  let gate: WriteGate;
  let d1Rows: D1Rows;
  try {
    ({ gate, results: [d1Rows] } = await gatedD1(deps.d1(ADMIN_D1_ENV), [stmt(Q_P1)]));
  } catch (error) {
    return { rows: [], gate: null, error: message(error) };
  }
  if (gate.sources.profile === "d1") return { rows: d1Rows.map((row) => pgRow(row, { json: ["nicknames"] })), gate };
  if (!deps.supabase) return null;
  try {
    return { rows: rowsOf((await restRead(deps, nicknamePoolsRequest())).data), gate };
  } catch (error) {
    return { rows: [], gate, error: message(error) };
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

/**
 * Inquiries still in the "new" state, both envs (the dev mailbox pip), each env from the store its
 * reply writes to. Throws SupabaseKeyMissingError when that is Supabase and there is no secret key.
 */
export async function countUncheckedInquiries(deps: AdminReadDeps): Promise<number> {
  const parts = await Promise.all(D1_ENVS.map(async (env) => {
    const { gate, results: [rows] } = await gatedD1(deps.d1(env), [stmt("SELECT count(*) AS n FROM contact_inquiries WHERE status = 'new'")]);
    return { env, source: gate.sources.contact, count: countOf(rows) };
  }));
  const onSupabase = parts.filter((part) => part.source === "supabase").map((part) => part.env);
  let total = parts.filter((part) => part.source === "d1").reduce((sum, part) => sum + part.count, 0);
  for (const dataEnv of supabaseEnvFilters(onSupabase)) {
    total += (await restRead(deps, uncheckedInquiriesRequest(dataEnv))).count ?? 0;
  }
  return total;
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

// colorful_philosopher_posts: saveColorfulPhilosopherPostRow writes D1 while some group of the env is on
// d1 (anyD1Source), Supabase otherwise.

export const PHILOSOPHER_WEEK_LIMIT = 100;

/** The week list's Supabase read before D1 (useColorfulPhilosopherWeek): the env's latest 100 posts. */
export function philosopherWeekRequest(dataEnv: DataEnv): RestRequest {
  return {
    method: "GET",
    path: PHILOSOPHER_POSTS_TABLE,
    query: { select: PHILOSOPHER_SELECT.replace(/ /g, ""), env: `eq.${dataEnv}`, order: "week_start.desc", limit: String(PHILOSOPHER_WEEK_LIMIT) },
  };
}

/** The dev menu dot's Supabase read before D1 (useColorfulPhilosophersNextWeekOpen). */
export function philosopherSlotsRequest(dataEnv: DataEnv, weekStart: string): RestRequest {
  return { method: "GET", path: PHILOSOPHER_POSTS_TABLE, query: { select: "slot", env: `eq.${dataEnv}`, week_start: `eq.${weekStart}` } };
}

/** /dev/colorful-philosophers: the env's latest 100 posts, from the store the save writes to (D1: the Worker's F1). */
export async function listPhilosopherPosts(deps: AdminReadDeps, env: D1EnvName): Promise<Row[]> {
  const { gate, results: [rows] } = await gatedD1(deps.d1(env), [stmt(Q_F1)]);
  if (anyD1Source(gate)) return rows;
  return rowsOf((await restRead(deps, philosopherWeekRequest(DATA_ENV_OF[env]))).data);
}

/** The slots of a week's production posts (the dev menu's "next week is not full" dot), from the store the save writes to. */
export async function philosopherWeekSlots(deps: AdminReadDeps, weekStart: string): Promise<string[]> {
  const env: D1EnvName = "production";
  const { gate, results: [rows] } = await gatedD1(deps.d1(env), [stmt("SELECT slot FROM colorful_philosopher_posts WHERE week_start = ?1", weekStart)]);
  const slots = anyD1Source(gate) ? rows : rowsOf((await restRead(deps, philosopherSlotsRequest(DATA_ENV_OF[env], weekStart))).data);
  return slots.map((row) => String(row.slot));
}

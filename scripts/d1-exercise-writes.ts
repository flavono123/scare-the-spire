/**
 * The step-2 exit check of the Supabase -> D1 exit (docs/SUPABASE_EXIT_PLAN.md, step 2 "넘어갈 조건";
 * docs/supabase-exit/D1_SCHEMA_DESIGN.md 5.3): for every table d1_change_log logs, one INSERT, one
 * UPDATE and one DELETE of a test row in development data, through PostgREST with the service key,
 * then the 1-minute sync (workers/sync/run-sync.ts) must carry each change into the testbed D1
 * (slseoun-testbed) within 2 minutes.
 *
 *   pnpm d1:exercise --target testbed
 *
 * It writes to the real Supabase project (shared by testbed and production) and reads the testbed D1,
 * so no test chain runs it. What it keeps to:
 *   - Only rows it creates: env 'development', ids from the fixed range 00000000-0000-4000-8000-0000d1e0xxxx,
 *     the test user 00000000-0000-4000-8000-00000000e2e0, text and keys marked d1-exercise (D1_EXERCISE,
 *     run id d1-exercise-run, puzzlebox board 999, philosophers week 2000-01-03). Every write goes through
 *     one guard: an env table's row and filters carry env 'development', and every PATCH and DELETE
 *     filters by one of those markers.
 *   - The test user must exist in auth.users (every user_id has an FK there): it is created through the
 *     Auth admin API at the start (no password; the API needs an email, so an undeliverable .invalid
 *     address, confirmed so no mail goes out) and deleted at the end.
 *   - Tables without env take only the test user's own row under a development parent (comment_likes) or
 *     keyed by the test user (puzzlebox_players), and are deleted before their parent, so no change-log
 *     row of this run has env null except the player row. profile_character_nickname_pools is skipped:
 *     CHECKs fix its key to 5 characters x 2 locales, all 10 rows exist, and production reads them.
 *   - Tables written only by RPC (tournament plays and candidate stats; puzzlebox runs, players, best
 *     and board stats) are inserted through the service-only worker_* wrappers the step-4 Worker calls,
 *     so the RPC's counters and statistics run as they do for users. Their UPDATE and DELETE are direct
 *     service-key writes on the test rows.
 *   - Idempotent: leftovers of an earlier run are deleted first (development only) and the D1 copy is
 *     awaited clean; at the end every test row is gone from Supabase and D1. Two D1 rows the sync never
 *     deletes are removed here: the test thread key's threads row once it is 0/0 (threads keeps zero
 *     rows, design 4.2), and the test run's sync_pending_raw row once the run is gone from the copy (a
 *     raw that could not be fetched stays queued; the queue row goes only on an empty answer).
 *
 * The run raw (heavy_changed, design 5.3 item 9) has its own probe, "(runs raw file, heavy_changed)":
 * the raw must land in post_history_course_file. As of 2026-11-09 it does not: Supabase PostgREST
 * answers the sync's Accept: text/plain read with 406 PGRST107, so this probe times out.
 *
 * Tables go in four groups so each change set fits one sync run's batch (MAIN_BATCH_MAX): per group,
 * INSERT, wait, UPDATE, wait, DELETE, wait. A wait reads the Supabase rows (the expected copy) once,
 * then polls one D1 query every 2 s until the D1 copy matches; the lag is first match minus the
 * Supabase write's answer.
 *
 * Environment (values are never printed):
 *   NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL                 the Supabase project URL
 *   SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY         the service key
 *   CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_D1_API_TOKEN          optional; else the wrangler OAuth login
 *
 * Exit 0: every change reached D1 within 2 minutes, no open sync reject, and sync_state.fail_count did
 * not rise during the run (it only grows). Exit 1: otherwise or an error. Exit 2: bad arguments or
 * missing environment.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { summaryText } from "../src/lib/d1-sync/row-mapper";
import { canonicalTs } from "../src/lib/d1-time";
import { d1HttpClient, type D1HttpClient, type FetchLike } from "./d1-sync/d1-http-client";
import { isNewFormatKey } from "./d1-sync/postgrest-reader";
import { d1DatabaseId } from "./d1-sync/reconcile";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

type Row = Record<string, unknown>;
type Filters = Record<string, string | number>;
type Phase = "I" | "U" | "D";

const ENV = "development";
const LAG_LIMIT_MS = 2 * 60_000;
const WAIT_TIMEOUT_MS = 4 * 60_000;
const POLL_MS = 2_000;

// ------------------------------------------------------------------------------------------- fixtures

const USER = "00000000-0000-4000-8000-00000000e2e0";
const TEST_USER_EMAIL = "d1-exercise-e2e0@example.invalid";
const ID_PREFIX = "00000000-0000-4000-8000-0000d1e0";
const fixedId = (n: number) => `${ID_PREFIX}${n.toString(16).padStart(4, "0")}`;
const IDS = {
  comment: fixedId(1),
  commentLike: fixedId(2),
  like: fixedId(3),
  story: fixedId(4),
  draft: fixedId(5),
  inquiry: fixedId(6),
  philosopher: fixedId(7),
  combo: fixedId(0x10),
  transfigure: fixedId(0x11),
  chemical: fixedId(0x12),
  decisions: fixedId(0x13),
  pagestorm: fixedId(0x14),
  thisOrThat: fixedId(0x20),
  thisOrThatLike: fixedId(0x21),
  tournament: fixedId(0x22),
};
const NICK = "d1-exercise";
const MARK = "d1-exercise";
const THREAD = "d1-exercise:thread";
const RUN_ID = "d1-exercise-run";
const RES = "D1_EXERCISE";
const RES_A = "D1_EXERCISE_A";
const RES_B = "D1_EXERCISE_B";
const RES_C = "D1_EXERCISE_C";
const GAME_VERSION = "d1-exercise";
const PUZZLE_GAME = "connections";
const PUZZLE_BOARD = "999";
const WEEK = "2000-01-03"; // a Monday (D1 CHECK), far from any real week
const TS_EDIT = "2001-02-03T04:05:06.123456+00:00";

/** Tables with an env column (every logged table but these three). */
const ENVLESS = new Set(["comment_likes", "puzzlebox_players", "profile_character_nickname_pools"]);
/** Env-less tables this script may write (its own rows only). */
const ENVLESS_WRITABLE = new Set(["comment_likes", "puzzlebox_players"]);
const LOGGED_TABLES = [
  "comments", "comment_likes", "likes", "this_or_that_post_likes", "this_or_that_post_votes",
  "favorite_tournament_plays", "resource_reactions", "resource_reaction_counts", "runs", "combo_posts",
  "transfigure_posts", "this_or_that_posts", "chemical_posts", "decisions_decisions_posts",
  "favorite_tournament_posts", "pagestorm_posts", "favorite_tournament_candidate_stats", "community_stories",
  "defragment_bodies", "pagestorm_drafts", "contact_inquiries", "colorful_philosopher_posts",
  "profile_character_nickname_pools", "puzzlebox_players", "puzzlebox_runs", "puzzlebox_best",
  "puzzlebox_board_stats",
] as const;
const SKIPPED: Record<string, string> = {
  profile_character_nickname_pools:
    "no env; CHECKs fix the key to 5 characters x 2 locales and all 10 rows exist, so an INSERT is impossible " +
    "and an UPDATE or DELETE would change a real row the production profile page reads",
};

function isMarker(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return (
    value === USER ||
    value.startsWith(ID_PREFIX) ||
    value.startsWith(MARK) ||
    value.startsWith(RES) ||
    value === PUZZLE_BOARD
  );
}

// ------------------------------------------------------------------------------------------- Supabase

class Supabase {
  readonly base: string;
  constructor(
    url: string,
    private readonly key: string,
  ) {
    this.base = url.replace(/\/+$/, "");
  }

  private headers(json: boolean, prefer?: string): Record<string, string> {
    return {
      apikey: this.key,
      // A legacy service_role key is a JWT and also goes as the bearer (scripts/d1-sync/postgrest-reader.ts).
      ...(isNewFormatKey(this.key) ? {} : { authorization: `Bearer ${this.key}` }),
      accept: "application/json",
      ...(json ? { "content-type": "application/json" } : {}),
      ...(prefer ? { prefer } : {}),
    };
  }

  async call(method: string, path: string, body?: unknown, prefer?: string): Promise<{ status: number; data: unknown }> {
    const response = await fetch(`${this.base}${path}`, {
      method,
      headers: this.headers(body !== undefined, prefer),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: response.status, data };
  }

  async rest(method: string, table: string, query: URLSearchParams, body?: unknown): Promise<Row[]> {
    const qs = query.toString();
    const { status, data } = await this.call(method, `/rest/v1/${table}${qs ? `?${qs}` : ""}`, body, "return=representation");
    if (status < 200 || status >= 300) {
      const info = data && typeof data === "object" ? (data as { code?: string; message?: string }) : {};
      throw new Error(`PostgREST ${method} ${table} ${status}: ${info.code ?? ""} ${info.message ?? String(data).slice(0, 200)}`.trim());
    }
    if (status === 204 || data === null) return [];
    if (!Array.isArray(data)) return [data as Row];
    return data as Row[];
  }

  select(table: string, select: string, filters: Filters, opts: { order?: string; limit?: number } = {}): Promise<Row[]> {
    const query = filterQuery(filters);
    query.set("select", select);
    if (opts.order) query.set("order", opts.order);
    if (opts.limit !== undefined) query.set("limit", String(opts.limit));
    return this.rest("GET", table, query);
  }
}

function filterQuery(filters: Filters): URLSearchParams {
  const query = new URLSearchParams();
  for (const [column, value] of Object.entries(filters)) query.set(column, `eq.${value}`);
  return query;
}

/** The only write path: refuses anything that is not a development test row. */
class GuardedWriter {
  constructor(private readonly sb: Supabase) {}

  private checkTable(table: string) {
    if (!(LOGGED_TABLES as readonly string[]).includes(table)) throw new Error(`refusing to write ${table}: not a logged table`);
    if (ENVLESS.has(table) && !ENVLESS_WRITABLE.has(table)) throw new Error(`refusing to write ${table}: shared table`);
  }

  private checkFilters(table: string, filters: Filters) {
    this.checkTable(table);
    if (!ENVLESS.has(table) && filters.env !== ENV) throw new Error(`refusing to write ${table} without env=eq.${ENV}`);
    if (ENVLESS.has(table) && "env" in filters) throw new Error(`${table} has no env column`);
    if (!Object.values(filters).some(isMarker)) throw new Error(`refusing to write ${table} without a test marker filter`);
  }

  async insert(table: string, row: Row): Promise<Row[]> {
    this.checkTable(table);
    if (!ENVLESS.has(table) && row.env !== ENV) throw new Error(`refusing to insert into ${table} with env ${String(row.env)}`);
    if (ENVLESS.has(table) && "env" in row) throw new Error(`${table} has no env column`);
    if (!Object.values(row).some(isMarker)) throw new Error(`refusing to insert an unmarked row into ${table}`);
    const rows = await this.sb.rest("POST", table, new URLSearchParams(), row);
    if (rows.length !== 1) throw new Error(`insert into ${table} returned ${rows.length} rows`);
    return rows;
  }

  async update(table: string, filters: Filters, patch: Row, expectRows = 1): Promise<Row[]> {
    this.checkFilters(table, filters);
    if ("env" in patch) throw new Error("refusing to change env");
    const rows = await this.sb.rest("PATCH", table, filterQuery(filters), patch);
    if (rows.length !== expectRows) throw new Error(`update of ${table} changed ${rows.length} rows, expected ${expectRows}`);
    return rows;
  }

  async remove(table: string, filters: Filters, expectRows: number | "any" = 1): Promise<Row[]> {
    this.checkFilters(table, filters);
    const rows = await this.sb.rest("DELETE", table, filterQuery(filters));
    if (expectRows !== "any" && rows.length !== expectRows) {
      throw new Error(`delete from ${table} removed ${rows.length} rows, expected ${expectRows}`);
    }
    return rows;
  }

  /** The two service-only RPC wrappers of the step-4 Worker, for the test user in development only. */
  async rpc(fn: "worker_complete_favorite_tournament_play" | "worker_submit_puzzlebox_run", args: Row): Promise<unknown> {
    if (args.p_actor !== USER || args.p_env !== ENV) throw new Error(`refusing ${fn} outside the test user in ${ENV}`);
    const { status, data } = await this.sb.call("POST", `/rest/v1/rpc/${fn}`, args);
    if (status < 200 || status >= 300) {
      const info = data && typeof data === "object" ? (data as { code?: string; message?: string }) : {};
      throw new Error(`rpc ${fn} ${status}: ${info.code ?? ""} ${info.message ?? ""}`.trim());
    }
    return data;
  }
}

// ------------------------------------------------------------------------------------------- the test user

async function ensureTestUser(sb: Supabase): Promise<"created" | "reused"> {
  const got = await sb.call("GET", `/auth/v1/admin/users/${USER}`);
  if (got.status === 200) return "reused";
  if (got.status !== 404) throw new Error(`auth admin read ${got.status}`);
  // The admin API needs an email or a phone. A reserved, undeliverable domain (RFC 6761 .invalid),
  // confirmed up front, so no mail is ever sent; there is no password, so nobody can sign in as it.
  const made = await sb.call("POST", "/auth/v1/admin/users", {
    id: USER,
    email: TEST_USER_EMAIL,
    email_confirm: true,
    user_metadata: { purpose: "d1-exercise (scripts/d1-exercise-writes.ts)" },
  });
  if (made.status < 200 || made.status >= 300) {
    const info = made.data && typeof made.data === "object" ? (made.data as { msg?: string; message?: string }) : {};
    throw new Error(`auth admin create ${made.status}: ${info.msg ?? info.message ?? ""}`);
  }
  return "created";
}

async function deleteTestUser(sb: Supabase): Promise<void> {
  const gone = await sb.call("DELETE", `/auth/v1/admin/users/${USER}`);
  if (gone.status !== 200 && gone.status !== 404) throw new Error(`auth admin delete ${gone.status}`);
}

// ------------------------------------------------------------------------------------------- probes

/** SQL text literal for the fixed test constants above (never user input). */
function lit(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function ts(value: unknown): string {
  const out = canonicalTs(value);
  if (!out) throw new Error(`not a timestamp: ${String(value)}`);
  return out;
}

function nonEmpty(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function bool01(value: unknown): number {
  return value === true ? 1 : 0;
}

function joinSorted(items: string[]): string | null {
  if (items.length === 0) return null;
  return [...items].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).join(",");
}

interface Probe {
  /** Report row: a Supabase table, or a derived row in parentheses. */
  name: string;
  /** For a derived row: the Supabase table it is reported under. */
  under?: string;
  /** Scalar D1 SQL: the copy's fingerprint, NULL when the row is gone. */
  d1: string;
  /** The same fingerprint from the Supabase rows (the expected copy). */
  expected: (sb: Supabase) => Promise<string | null>;
}

async function first(sb: Supabase, table: string, select: string, filters: Filters): Promise<Row | null> {
  return (await sb.select(table, select, filters))[0] ?? null;
}

function postSql(service: string, serviceTable: string, fields: string, id: string): string {
  return (
    `SELECT ${fields} FROM posts p JOIN ${serviceTable} s ON s.service = p.service AND s.post_id = p.id ` +
    `WHERE p.service = ${lit(service)} AND p.id = ${lit(id)}`
  );
}

const ENGAGEMENT_PROBES: Probe[] = [
  {
    name: "comments",
    d1: `SELECT content || '|' || like_count FROM comments WHERE id = ${lit(IDS.comment)}`,
    expected: async (sb) => {
      const row = await first(sb, "comments", "content", { id: IDS.comment, env: ENV });
      if (!row) return null;
      const likes = await sb.select("comment_likes", "id", { comment_id: IDS.comment });
      return `${str(row.content)}|${likes.length}`;
    },
  },
  {
    name: "comment_likes",
    d1: `SELECT created_at FROM comment_likes WHERE comment_id = ${lit(IDS.comment)} AND user_id = ${lit(USER)}`,
    expected: async (sb) => {
      const row = await first(sb, "comment_likes", "created_at", { comment_id: IDS.comment, user_id: USER });
      return row ? ts(row.created_at) : null;
    },
  },
  {
    name: "likes",
    d1: `SELECT created_at FROM likes WHERE story_id = ${lit(THREAD)} AND user_id = ${lit(USER)}`,
    expected: async (sb) => {
      const row = await first(sb, "likes", "created_at", { story_id: THREAD, user_id: USER, env: ENV });
      return row ? ts(row.created_at) : null;
    },
  },
  {
    name: "(threads, derived)",
    under: "likes",
    d1: `SELECT coalesce((SELECT like_count || '/' || comment_count FROM threads WHERE thread_key = ${lit(THREAD)}), '0/0')`,
    expected: async (sb) => {
      const likes = await sb.select("likes", "id", { story_id: THREAD, env: ENV });
      const comments = await sb.select("comments", "id", { story_id: THREAD, env: ENV });
      return `${likes.length}/${comments.length}`;
    },
  },
  {
    name: "resource_reactions",
    d1:
      `SELECT kind FROM resource_reactions WHERE resource_id = ${lit(RES)} AND resource_type = 'card' ` +
      `AND game_version = ${lit(GAME_VERSION)} AND user_id = ${lit(USER)}`,
    expected: async (sb) => {
      const row = await first(sb, "resource_reactions", "kind", {
        env: ENV, resource_type: "card", resource_id: RES, game_version: GAME_VERSION, user_id: USER,
      });
      return row ? str(row.kind) : null;
    },
  },
  {
    name: "resource_reaction_counts",
    d1:
      `SELECT buff_count || '/' || nerf_count || '/' || rework_count FROM resource_reaction_counts ` +
      `WHERE resource_id = ${lit(RES)} AND resource_type = 'card' AND game_version = ${lit(GAME_VERSION)}`,
    expected: async (sb) => {
      const row = await first(sb, "resource_reaction_counts", "buff_count,nerf_count,rework_count", {
        env: ENV, resource_type: "card", resource_id: RES, game_version: GAME_VERSION,
      });
      return row ? `${row.buff_count}/${row.nerf_count}/${row.rework_count}` : null;
    },
  },
  {
    name: "community_stories",
    d1: `SELECT sentence FROM community_stories WHERE id = ${lit(IDS.story)}`,
    expected: async (sb) => {
      const row = await first(sb, "community_stories", "sentence", { id: IDS.story, env: ENV });
      return row ? str(row.sentence) : null;
    },
  },
  {
    name: "contact_inquiries",
    d1: `SELECT status || '|' || message FROM contact_inquiries WHERE id = ${lit(IDS.inquiry)}`,
    expected: async (sb) => {
      const row = await first(sb, "contact_inquiries", "status,message", { id: IDS.inquiry, env: ENV });
      return row ? `${str(row.status)}|${str(row.message)}` : null;
    },
  },
  {
    name: "pagestorm_drafts",
    d1: `SELECT title || '|' || content_text FROM pagestorm_drafts WHERE id = ${lit(IDS.draft)}`,
    expected: async (sb) => {
      const row = await first(sb, "pagestorm_drafts", "title,content_text", { id: IDS.draft, env: ENV });
      return row ? `${str(row.title)}|${str(row.content_text)}` : null;
    },
  },
  {
    name: "colorful_philosopher_posts",
    d1: `SELECT body || '|' || week_start FROM colorful_philosopher_posts WHERE id = ${lit(IDS.philosopher)}`,
    expected: async (sb) => {
      const row = await first(sb, "colorful_philosopher_posts", "body,week_start", { id: IDS.philosopher, env: ENV });
      return row ? `${str(row.body)}|${str(row.week_start)}` : null;
    },
  },
];

const POST_PROBES: Probe[] = [
  {
    name: "combo_posts",
    d1: postSql(
      "combo",
      "post_combo",
      "p.nickname || '|' || p.summary || '|' || s.content_text || '|' || " +
        "(SELECT count(*) FROM post_combo_resources r WHERE r.service = 'combo' AND r.post_id = p.id)",
      IDS.combo,
    ),
    expected: async (sb) => {
      const row = await first(sb, "combo_posts", "nickname,content_text,resources", { id: IDS.combo, env: ENV });
      if (!row) return null;
      const resources = Array.isArray(row.resources) ? row.resources.length : -1;
      return `${str(row.nickname)}|${summaryText(str(row.content_text))}|${str(row.content_text)}|${resources}`;
    },
  },
  {
    name: "defragment_bodies",
    d1: `SELECT content_text || '|' || updated_at FROM defragment_bodies WHERE service = 'combo' AND post_id = ${lit(IDS.combo)}`,
    expected: async (sb) => {
      const row = await first(sb, "defragment_bodies", "content_text,updated_at", {
        env: ENV, source_service: "combo", source_id: IDS.combo,
      });
      return row ? `${str(row.content_text)}|${ts(row.updated_at)}` : null;
    },
  },
  {
    name: "transfigure_posts",
    d1: postSql(
      "transfigure",
      "post_transfigure",
      "coalesce(p.title, '') || '|' || p.summary || '|' || s.content_text || '|' || s.resource_id",
      IDS.transfigure,
    ),
    expected: async (sb) => {
      const row = await first(sb, "transfigure_posts", "title,transformed_name,content_text,resource_id", {
        id: IDS.transfigure, env: ENV,
      });
      if (!row) return null;
      const summary = summaryText(nonEmpty(row.title) ?? nonEmpty(row.transformed_name) ?? str(row.content_text));
      return `${str(row.title ?? "")}|${summary}|${str(row.content_text)}|${str(row.resource_id)}`;
    },
  },
  {
    name: "chemical_posts",
    d1: postSql("chemical_x", "post_chemical_x", "p.summary || '|' || s.content_text", IDS.chemical),
    expected: async (sb) => {
      const row = await first(sb, "chemical_posts", "content_text", { id: IDS.chemical, env: ENV });
      return row ? `${summaryText(str(row.content_text))}|${str(row.content_text)}` : null;
    },
  },
  {
    name: "decisions_decisions_posts",
    d1: postSql(
      "decisions_decisions",
      "post_decisions_decisions",
      "p.title || '|' || p.summary || '|' || s.note || '|' || s.preset_key",
      IDS.decisions,
    ),
    expected: async (sb) => {
      const row = await first(sb, "decisions_decisions_posts", "title,note,preset_key", { id: IDS.decisions, env: ENV });
      if (!row) return null;
      const summary = summaryText(nonEmpty(row.title) ?? str(row.note));
      return `${str(row.title)}|${summary}|${str(row.note)}|${str(row.preset_key)}`;
    },
  },
  {
    name: "pagestorm_posts",
    d1: postSql("pagestorm", "post_pagestorm", "p.title || '|' || p.summary || '|' || s.content_text", IDS.pagestorm),
    expected: async (sb) => {
      const row = await first(sb, "pagestorm_posts", "title,content_text", { id: IDS.pagestorm, env: ENV });
      if (!row) return null;
      const summary = summaryText(nonEmpty(row.title) ?? str(row.content_text));
      return `${str(row.title)}|${summary}|${str(row.content_text)}`;
    },
  },
  {
    name: "runs",
    d1: postSql(
      "history_course",
      "post_history_course",
      "p.nickname || '|' || p.summary || '|' || s.seed || '|' || s.ascension || '|' || s.summary_version",
      RUN_ID,
    ),
    expected: async (sb) => {
      const row = await first(sb, "runs", "id,donor_nickname,seed,ascension", { id: RUN_ID, env: ENV });
      if (!row) return null;
      const summary = summaryText(nonEmpty(row.seed) ?? str(row.id));
      // The sync never builds the run summary (design 4.4): a synced run is summary_version 0.
      return `${str(row.donor_nickname)}|${summary}|${str(row.seed)}|${str(row.ascension)}|0`;
    },
  },
  {
    name: "(runs raw file, heavy_changed)",
    under: "runs",
    d1:
      "SELECT length(CAST(raw AS BLOB)) || '' FROM post_history_course_file " +
      `WHERE service = 'history_course' AND post_id = ${lit(RUN_ID)}`,
    expected: async (sb) => {
      const row = await first(sb, "runs", "raw", { id: RUN_ID, env: ENV });
      return row ? String(Buffer.byteLength(str(row.raw), "utf8")) : null;
    },
  },
];

const VOTE_TOURNAMENT_PROBES: Probe[] = [
  {
    name: "this_or_that_posts",
    d1: postSql(
      "this_or_that",
      "post_this_or_that",
      "p.summary || '|' || s.reason || '|' || s.left_vote_count || '|' || s.right_vote_count || '|' || p.like_count",
      IDS.thisOrThat,
    ),
    expected: async (sb) => {
      const row = await first(sb, "this_or_that_posts", "reason,left_vote_count,right_vote_count,like_count", {
        id: IDS.thisOrThat, env: ENV,
      });
      if (!row) return null;
      return `${summaryText(str(row.reason))}|${str(row.reason)}|${row.left_vote_count}|${row.right_vote_count}|${row.like_count}`;
    },
  },
  {
    name: "this_or_that_post_likes",
    d1:
      "SELECT created_at FROM this_or_that_post_likes WHERE service = 'this_or_that' " +
      `AND post_id = ${lit(IDS.thisOrThat)} AND user_id = ${lit(USER)}`,
    expected: async (sb) => {
      const row = await first(sb, "this_or_that_post_likes", "created_at", { post_id: IDS.thisOrThat, user_id: USER, env: ENV });
      return row ? ts(row.created_at) : null;
    },
  },
  {
    name: "this_or_that_post_votes",
    d1:
      "SELECT choice || '|' || created_at FROM this_or_that_post_votes WHERE service = 'this_or_that' " +
      `AND post_id = ${lit(IDS.thisOrThat)} AND user_id = ${lit(USER)}`,
    expected: async (sb) => {
      const row = await first(sb, "this_or_that_post_votes", "choice,created_at", { post_id: IDS.thisOrThat, user_id: USER, env: ENV });
      return row ? `${str(row.choice)}|${ts(row.created_at)}` : null;
    },
  },
  {
    name: "favorite_tournament_posts",
    d1: postSql(
      "favorite_tournament",
      "post_favorite_tournament",
      "p.title || '|' || p.summary || '|' || s.note || '|' || s.play_count || '|' || " +
        "(SELECT count(*) FROM post_favorite_tournament_pool x WHERE x.service = 'favorite_tournament' AND x.post_id = p.id)",
      IDS.tournament,
    ),
    expected: async (sb) => {
      const row = await first(sb, "favorite_tournament_posts", "title,note,play_count,pool", { id: IDS.tournament, env: ENV });
      if (!row) return null;
      const summary = summaryText(nonEmpty(row.title) ?? str(row.note));
      const pool = Array.isArray(row.pool) ? row.pool.length : -1;
      return `${str(row.title)}|${summary}|${str(row.note)}|${row.play_count}|${pool}`;
    },
  },
  {
    name: "favorite_tournament_plays",
    d1:
      "SELECT group_concat(fp, ',') FROM (SELECT id || '|' || champion_id || '|' || created_at AS fp " +
      `FROM favorite_tournament_plays WHERE service = 'favorite_tournament' AND tournament_id = ${lit(IDS.tournament)} ORDER BY fp)`,
    expected: async (sb) => {
      const rows = await sb.select("favorite_tournament_plays", "id,champion_id,created_at", { tournament_id: IDS.tournament, env: ENV });
      return joinSorted(rows.map((row) => `${str(row.id)}|${str(row.champion_id)}|${ts(row.created_at)}`));
    },
  },
  {
    name: "favorite_tournament_candidate_stats",
    d1:
      "SELECT group_concat(fp, ',') FROM (SELECT resource_type || ':' || resource_id || ':' || match_appearances || ':' || " +
      "match_wins || ':' || championships || ':' || coalesce(current_rank, '-') AS fp FROM favorite_tournament_candidate_stats " +
      `WHERE service = 'favorite_tournament' AND tournament_id = ${lit(IDS.tournament)} ORDER BY fp)`,
    expected: async (sb) => {
      const rows = await sb.select(
        "favorite_tournament_candidate_stats",
        "resource_type,resource_id,match_appearances,match_wins,championships,current_rank",
        { tournament_id: IDS.tournament, env: ENV },
      );
      return joinSorted(
        rows.map(
          (row) =>
            `${str(row.resource_type)}:${str(row.resource_id)}:${row.match_appearances}:${row.match_wins}:` +
            `${row.championships}:${row.current_rank ?? "-"}`,
        ),
      );
    },
  },
];

const PUZZLEBOX_PROBES: Probe[] = [
  {
    name: "puzzlebox_players",
    d1: `SELECT nickname || '|' || hidden FROM puzzlebox_players WHERE user_id = ${lit(USER)}`,
    expected: async (sb) => {
      const row = await first(sb, "puzzlebox_players", "nickname,hidden", { user_id: USER });
      return row ? `${str(row.nickname)}|${bool01(row.hidden)}` : null;
    },
  },
  {
    name: "puzzlebox_runs",
    d1:
      "SELECT group_concat(fp, ',') FROM (SELECT id || ':' || board || ':' || score || ':' || attempt AS fp " +
      `FROM puzzlebox_runs WHERE user_id = ${lit(USER)} ORDER BY fp)`,
    expected: async (sb) => {
      const rows = await sb.select("puzzlebox_runs", "id,board,score,attempt", { user_id: USER, env: ENV });
      return joinSorted(rows.map((row) => `${row.id}:${str(row.board)}:${row.score}:${row.attempt}`));
    },
  },
  {
    name: "puzzlebox_best",
    d1:
      "SELECT score || '|' || attempts || '|' || run_id || '|' || perfect FROM puzzlebox_best " +
      `WHERE game = ${lit(PUZZLE_GAME)} AND board = ${lit(PUZZLE_BOARD)} AND user_id = ${lit(USER)}`,
    expected: async (sb) => {
      const row = await first(sb, "puzzlebox_best", "score,attempts,run_id,perfect", {
        env: ENV, game: PUZZLE_GAME, board: PUZZLE_BOARD, user_id: USER,
      });
      return row ? `${row.score}|${row.attempts}|${row.run_id}|${bool01(row.perfect)}` : null;
    },
  },
  {
    name: "puzzlebox_board_stats",
    d1:
      "SELECT players || '|' || cleared || '|' || score_sum || '|' || speed_sum || '|' || level_solved " +
      `FROM puzzlebox_board_stats WHERE game = ${lit(PUZZLE_GAME)} AND board = ${lit(PUZZLE_BOARD)}`,
    expected: async (sb) => {
      const row = await first(sb, "puzzlebox_board_stats", "players,cleared,score_sum,speed_sum,level_solved", {
        env: ENV, game: PUZZLE_GAME, board: PUZZLE_BOARD,
      });
      return row ? `${row.players}|${row.cleared}|${row.score_sum}|${row.speed_sum}|${JSON.stringify(row.level_solved)}` : null;
    },
  },
];

// ------------------------------------------------------------------------------------------- groups

type Marks = Map<string, number>;

function mark(marks: Marks, ...names: string[]) {
  const now = Date.now();
  for (const name of names) marks.set(name, now);
}

interface Context {
  w: GuardedWriter;
  sb: Supabase;
  /** The development run whose raw and metadata the test run copies. */
  runSource: Row;
}

interface Group {
  name: string;
  probes: Probe[];
  steps: Record<Phase, (ctx: Context, marks: Marks) => Promise<void>>;
}

const COMMENT_FILTER = { id: IDS.comment, env: ENV };
const COMMENT_LIKE_FILTER = { id: IDS.commentLike, comment_id: IDS.comment, user_id: USER };
const LIKE_FILTER = { id: IDS.like, story_id: THREAD, env: ENV };
const REACTION_FILTER = { env: ENV, resource_type: "card", resource_id: RES, game_version: GAME_VERSION, user_id: USER };
const REACTION_COUNT_FILTER = { env: ENV, resource_type: "card", resource_id: RES, game_version: GAME_VERSION };
const BODY_FILTER = { env: ENV, source_service: "combo", source_id: IDS.combo };
const TOT_LIKE_FILTER = { id: IDS.thisOrThatLike, post_id: IDS.thisOrThat, env: ENV };
const VOTE_FILTER = { post_id: IDS.thisOrThat, user_id: USER, env: ENV };
const PUZZLE_FILTER = { env: ENV, game: PUZZLE_GAME, board: PUZZLE_BOARD };

const ENGAGEMENT: Group = {
  name: "engagement, stories, inquiries, drafts, philosophers",
  probes: ENGAGEMENT_PROBES,
  steps: {
    I: async ({ w }, m) => {
      await w.insert("comments", {
        id: IDS.comment, story_id: THREAD, user_id: USER, nickname: NICK, content: "d1-exercise comment", env: ENV,
      });
      mark(m, "comments", "(threads, derived)");
      await w.insert("comment_likes", { id: IDS.commentLike, comment_id: IDS.comment, user_id: USER });
      mark(m, "comment_likes", "comments");
      await w.insert("likes", { id: IDS.like, story_id: THREAD, user_id: USER, env: ENV });
      mark(m, "likes", "(threads, derived)");
      // The counts trigger inserts the counts row (I) and adds the buff (U).
      await w.insert("resource_reactions", { ...REACTION_FILTER, kind: "buff" });
      mark(m, "resource_reactions", "resource_reaction_counts");
      await w.insert("community_stories", {
        id: IDS.story, user_id: USER, nickname: NICK, sentence: "d1-exercise story", game: "sts2", env: ENV,
      });
      mark(m, "community_stories");
      await w.insert("contact_inquiries", {
        id: IDS.inquiry, user_id: USER, category: "other", message: "d1-exercise test inquiry", page_path: "/d1-exercise",
        service_locale: "ko", game_locale: "kor", env: ENV,
      });
      mark(m, "contact_inquiries");
      await w.insert("pagestorm_drafts", {
        id: IDS.draft, user_id: USER, nickname: NICK, title: "d1-exercise draft", content: {}, content_text: "d1-exercise draft text",
        env: ENV,
      });
      mark(m, "pagestorm_drafts");
      await w.insert("colorful_philosopher_posts", {
        id: IDS.philosopher, env: ENV, week_start: WEEK, slot: "card", resource_type: "card", resource_id: RES,
        name_ko: "d1-exercise", name_en: "d1-exercise", body: "d1-exercise body", game_version: GAME_VERSION,
      });
      mark(m, "colorful_philosopher_posts");
    },
    U: async ({ w }, m) => {
      await w.update("comments", COMMENT_FILTER, { content: "d1-exercise comment edited" });
      mark(m, "comments");
      await w.update("comment_likes", COMMENT_LIKE_FILTER, { created_at: TS_EDIT });
      mark(m, "comment_likes");
      await w.update("likes", LIKE_FILTER, { created_at: TS_EDIT });
      mark(m, "likes");
      // The counts trigger moves the count from buff to nerf (U).
      await w.update("resource_reactions", REACTION_FILTER, { kind: "nerf" });
      mark(m, "resource_reactions", "resource_reaction_counts");
      await w.update("community_stories", { id: IDS.story, env: ENV }, { sentence: "d1-exercise story edited" });
      mark(m, "community_stories");
      await w.update("contact_inquiries", { id: IDS.inquiry, env: ENV }, { status: "reviewing" });
      mark(m, "contact_inquiries");
      await w.update("pagestorm_drafts", { id: IDS.draft, env: ENV }, { title: "d1-exercise draft edited" });
      mark(m, "pagestorm_drafts");
      await w.update("colorful_philosopher_posts", { id: IDS.philosopher, env: ENV }, { body: "d1-exercise body edited" });
      mark(m, "colorful_philosopher_posts");
    },
    D: async ({ w }, m) => {
      // Children first: a comment like deleted with its comment would log env null (every env).
      await w.remove("comment_likes", COMMENT_LIKE_FILTER);
      mark(m, "comment_likes", "comments");
      await w.remove("comments", COMMENT_FILTER);
      mark(m, "comments", "(threads, derived)");
      await w.remove("likes", LIKE_FILTER);
      mark(m, "likes", "(threads, derived)");
      await w.remove("resource_reactions", REACTION_FILTER);
      mark(m, "resource_reactions");
      // The trigger left the counts row at 0/0/0; the test owns it, so it goes too.
      await w.remove("resource_reaction_counts", REACTION_COUNT_FILTER);
      mark(m, "resource_reaction_counts");
      await w.remove("community_stories", { id: IDS.story, env: ENV });
      mark(m, "community_stories");
      await w.remove("contact_inquiries", { id: IDS.inquiry, env: ENV });
      mark(m, "contact_inquiries");
      await w.remove("pagestorm_drafts", { id: IDS.draft, env: ENV });
      mark(m, "pagestorm_drafts");
      await w.remove("colorful_philosopher_posts", { id: IDS.philosopher, env: ENV });
      mark(m, "colorful_philosopher_posts");
    },
  },
};

const RUN_COPY_COLUMNS = [
  "raw", "seed", "build", "character", "ascension", "win", "start_time", "run_time", "acts_count", "total_floors",
  "badges", "cover_spec",
] as const;

const POSTS: Group = {
  name: "posts, 조각모음 body, runs",
  probes: POST_PROBES,
  steps: {
    I: async ({ w, runSource }, m) => {
      const block = [{ type: "text", text: "d1-exercise" }];
      await w.insert("combo_posts", {
        id: IDS.combo, user_id: USER, nickname: NICK, content: block, content_text: "d1-exercise combo",
        resources: [{ type: "card", id: RES_A }, { type: "card", id: RES_B }], env: ENV,
      });
      mark(m, "combo_posts");
      await w.insert("defragment_bodies", {
        ...BODY_FILTER, user_id: USER, nickname: NICK, content: block, content_text: "d1-exercise body",
      });
      mark(m, "defragment_bodies");
      await w.insert("transfigure_posts", {
        id: IDS.transfigure, user_id: USER, nickname: NICK, resource_type: "card", resource_id: RES,
        source_text: "d1-exercise source", source_game_locale: "kor", content: [], content_text: "d1-exercise transfigure",
        env: ENV,
      });
      mark(m, "transfigure_posts");
      await w.insert("chemical_posts", {
        id: IDS.chemical, user_id: USER, nickname: NICK, content: block, content_text: "d1-exercise chem", env: ENV,
      });
      mark(m, "chemical_posts");
      await w.insert("decisions_decisions_posts", {
        id: IDS.decisions, user_id: USER, nickname: NICK, title: "d1-exercise decisions", note: "d1-exercise note",
        preset_key: "d1-exercise", game_version: GAME_VERSION, rows: [], placements: [], extra_ids: [], env: ENV,
      });
      mark(m, "decisions_decisions_posts");
      await w.insert("pagestorm_posts", {
        id: IDS.pagestorm, user_id: USER, nickname: NICK, title: "d1-exercise pagestorm", content: {},
        content_text: "d1-exercise page", env: ENV,
      });
      mark(m, "pagestorm_posts");
      const copied: Row = Object.fromEntries(RUN_COPY_COLUMNS.map((column) => [column, runSource[column] ?? null]));
      await w.insert("runs", { ...copied, id: RUN_ID, env: ENV, donor_user_id: USER, donor_nickname: NICK });
      mark(m, "runs", "(runs raw file, heavy_changed)");
    },
    U: async ({ w }, m) => {
      await w.update("combo_posts", { id: IDS.combo, env: ENV }, {
        content_text: "d1-exercise combo edited",
        resources: [{ type: "card", id: RES_A }, { type: "card", id: RES_B }, { type: "card", id: RES_C }],
      });
      mark(m, "combo_posts");
      await w.update("defragment_bodies", BODY_FILTER, { content_text: "d1-exercise body edited", updated_at: new Date().toISOString() });
      mark(m, "defragment_bodies");
      await w.update("transfigure_posts", { id: IDS.transfigure, env: ENV }, { title: "d1-exercise title" });
      mark(m, "transfigure_posts");
      await w.update("chemical_posts", { id: IDS.chemical, env: ENV }, { content_text: "d1-exercise chem 2" });
      mark(m, "chemical_posts");
      await w.update("decisions_decisions_posts", { id: IDS.decisions, env: ENV }, { title: "d1-exercise decisions edited" });
      mark(m, "decisions_decisions_posts");
      await w.update("pagestorm_posts", { id: IDS.pagestorm, env: ENV }, { title: "d1-exercise pagestorm edited" });
      mark(m, "pagestorm_posts");
      await w.update("runs", { id: RUN_ID, env: ENV }, { donor_nickname: "d1-exercise-edited" });
      mark(m, "runs");
    },
    D: async ({ w }, m) => {
      await w.remove("defragment_bodies", BODY_FILTER);
      mark(m, "defragment_bodies");
      await w.remove("combo_posts", { id: IDS.combo, env: ENV });
      mark(m, "combo_posts");
      await w.remove("transfigure_posts", { id: IDS.transfigure, env: ENV });
      mark(m, "transfigure_posts");
      await w.remove("chemical_posts", { id: IDS.chemical, env: ENV });
      mark(m, "chemical_posts");
      await w.remove("decisions_decisions_posts", { id: IDS.decisions, env: ENV });
      mark(m, "decisions_decisions_posts");
      await w.remove("pagestorm_posts", { id: IDS.pagestorm, env: ENV });
      mark(m, "pagestorm_posts");
      await w.remove("runs", { id: RUN_ID, env: ENV });
      mark(m, "runs", "(runs raw file, heavy_changed)");
    },
  },
};

const VOTES_TOURNAMENTS: Group = {
  name: "이거 아님 저거? and 이아저? 월드컵",
  probes: VOTE_TOURNAMENT_PROBES,
  steps: {
    I: async ({ w }, m) => {
      await w.insert("this_or_that_posts", {
        id: IDS.thisOrThat, user_id: USER, nickname: NICK, left_type: "card", left_id: RES_A, right_type: "card", right_id: RES_B,
        reason: "d1-exercise reason", env: ENV,
      });
      mark(m, "this_or_that_posts");
      // Count triggers add the like and the vote to the post (U).
      await w.insert("this_or_that_post_likes", { ...TOT_LIKE_FILTER, user_id: USER });
      mark(m, "this_or_that_post_likes", "this_or_that_posts");
      await w.insert("this_or_that_post_votes", { ...VOTE_FILTER, choice: "left", created_surface: "detail" });
      mark(m, "this_or_that_post_votes", "this_or_that_posts");
      await w.insert("favorite_tournament_posts", {
        id: IDS.tournament, user_id: USER, nickname: NICK, title: "d1-exercise tournament", note: "d1-exercise note",
        preset_key: "d1-exercise", game_version: GAME_VERSION, pool: [{ type: "card", id: RES_A }, { type: "card", id: RES_B }],
        env: ENV,
      });
      mark(m, "favorite_tournament_posts");
      // The app's path: the RPC inserts the play, bumps play_count and writes the candidate stats.
      await w.rpc("worker_complete_favorite_tournament_play", {
        p_actor: USER, p_tournament_id: IDS.tournament, p_env: ENV, p_starting_size: 2, p_champion_type: "card",
        p_champion_id: RES_A, p_matches: [{ left_type: "card", left_id: RES_A, right_type: "card", right_id: RES_B, winner: "left" }],
      });
      mark(m, "favorite_tournament_plays", "favorite_tournament_candidate_stats", "favorite_tournament_posts");
    },
    U: async ({ w }, m) => {
      await w.update("this_or_that_posts", { id: IDS.thisOrThat, env: ENV }, { reason: "d1-exercise reason edited" });
      mark(m, "this_or_that_posts");
      await w.update("this_or_that_post_likes", TOT_LIKE_FILTER, { created_at: TS_EDIT });
      mark(m, "this_or_that_post_likes");
      await w.update("this_or_that_post_votes", VOTE_FILTER, { choice: "right" });
      mark(m, "this_or_that_post_votes");
      await w.update("favorite_tournament_posts", { id: IDS.tournament, env: ENV }, { title: "d1-exercise tournament edited" });
      mark(m, "favorite_tournament_posts");
      await w.update("favorite_tournament_plays", { tournament_id: IDS.tournament, user_id: USER, env: ENV }, { created_at: TS_EDIT });
      mark(m, "favorite_tournament_plays");
      await w.update(
        "favorite_tournament_candidate_stats",
        { tournament_id: IDS.tournament, env: ENV, resource_type: "card", resource_id: RES_A },
        { current_rank: 9 },
      );
      mark(m, "favorite_tournament_candidate_stats");
    },
    D: async ({ w }, m) => {
      await w.remove("this_or_that_post_likes", TOT_LIKE_FILTER);
      mark(m, "this_or_that_post_likes", "this_or_that_posts");
      await w.remove("this_or_that_post_votes", VOTE_FILTER);
      mark(m, "this_or_that_post_votes", "this_or_that_posts");
      await w.remove("favorite_tournament_candidate_stats", { tournament_id: IDS.tournament, env: ENV }, 2);
      mark(m, "favorite_tournament_candidate_stats");
      await w.remove("favorite_tournament_plays", { tournament_id: IDS.tournament, env: ENV });
      mark(m, "favorite_tournament_plays");
      await w.remove("this_or_that_posts", { id: IDS.thisOrThat, env: ENV });
      mark(m, "this_or_that_posts");
      await w.remove("favorite_tournament_posts", { id: IDS.tournament, env: ENV });
      mark(m, "favorite_tournament_posts");
    },
  },
};

const PUZZLE_RUN = {
  guesses: [[0, 0, 0, 0], [1, 1, 1, 1], [2, 2, 2, 2], [3, 3, 3, 3]],
  rocks: 0,
  rocksLeft: 3,
  shown: { token: true, local: true, original: true },
};

const PUZZLEBOX: Group = {
  name: "짜증나는 퍼즐상자",
  probes: PUZZLEBOX_PROBES,
  steps: {
    I: async ({ w }, m) => {
      // The app's path: the RPC upserts the player and writes the run, the best row and the board stats.
      await w.rpc("worker_submit_puzzlebox_run", {
        p_actor: USER, p_env: ENV, p_game: PUZZLE_GAME, p_board: PUZZLE_BOARD, p_run: PUZZLE_RUN, p_player: { nickname: NICK },
      });
      mark(m, "puzzlebox_players", "puzzlebox_runs", "puzzlebox_best", "puzzlebox_board_stats");
    },
    U: async ({ w }, m) => {
      await w.update("puzzlebox_players", { user_id: USER }, { nickname: "d1-exercise-2" });
      mark(m, "puzzlebox_players");
      await w.update("puzzlebox_runs", { ...PUZZLE_FILTER, user_id: USER }, { score: 1 });
      mark(m, "puzzlebox_runs");
      await w.update("puzzlebox_best", { ...PUZZLE_FILTER, user_id: USER }, { attempts: 5 });
      mark(m, "puzzlebox_best");
      await w.update("puzzlebox_board_stats", PUZZLE_FILTER, { speed_sum: 7 });
      mark(m, "puzzlebox_board_stats");
    },
    D: async ({ w }, m) => {
      // D1 puzzlebox_best references the run and the player (no cascade): best first.
      await w.remove("puzzlebox_best", { ...PUZZLE_FILTER, user_id: USER });
      mark(m, "puzzlebox_best");
      await w.remove("puzzlebox_runs", { ...PUZZLE_FILTER, user_id: USER });
      mark(m, "puzzlebox_runs");
      await w.remove("puzzlebox_board_stats", PUZZLE_FILTER);
      mark(m, "puzzlebox_board_stats");
      await w.remove("puzzlebox_players", { user_id: USER });
      mark(m, "puzzlebox_players");
    },
  },
};

const GROUPS: Group[] = [ENGAGEMENT, POSTS, VOTES_TOURNAMENTS, PUZZLEBOX];
const ALL_PROBES = GROUPS.flatMap((group) => group.probes);

// ------------------------------------------------------------------------------------------- cleanup

/**
 * Deletes every test row an earlier run may have left, children first (development only). The
 * puzzlebox board stats row is removed only when no other player has a run on the test board.
 */
async function cleanup(w: GuardedWriter, sb: Supabase): Promise<number> {
  let removed = 0;
  const del = async (table: string, filters: Filters) => {
    removed += (await w.remove(table, filters, "any")).length;
  };
  await del("comment_likes", { comment_id: IDS.comment, user_id: USER });
  await del("comments", COMMENT_FILTER);
  await del("likes", { story_id: THREAD, user_id: USER, env: ENV });
  await del("resource_reactions", REACTION_FILTER);
  const reactions = await sb.select("resource_reactions", "user_id", REACTION_COUNT_FILTER);
  if (reactions.length > 0) {
    throw new Error(`the test resource ${RES} has ${reactions.length} reactions of other users in ${ENV}: stopping`);
  }
  await del("resource_reaction_counts", REACTION_COUNT_FILTER);
  await del("community_stories", { id: IDS.story, env: ENV });
  await del("contact_inquiries", { id: IDS.inquiry, env: ENV });
  await del("pagestorm_drafts", { id: IDS.draft, env: ENV });
  await del("colorful_philosopher_posts", { id: IDS.philosopher, env: ENV });
  await del("defragment_bodies", BODY_FILTER);
  await del("this_or_that_post_likes", { post_id: IDS.thisOrThat, env: ENV });
  await del("this_or_that_post_votes", { post_id: IDS.thisOrThat, env: ENV });
  await del("favorite_tournament_candidate_stats", { tournament_id: IDS.tournament, env: ENV });
  await del("favorite_tournament_plays", { tournament_id: IDS.tournament, env: ENV });
  for (const [table, id] of [
    ["combo_posts", IDS.combo],
    ["transfigure_posts", IDS.transfigure],
    ["chemical_posts", IDS.chemical],
    ["decisions_decisions_posts", IDS.decisions],
    ["pagestorm_posts", IDS.pagestorm],
    ["this_or_that_posts", IDS.thisOrThat],
    ["favorite_tournament_posts", IDS.tournament],
  ] as const) {
    await del(table, { id, env: ENV });
  }
  await del("runs", { id: RUN_ID, env: ENV });
  await del("puzzlebox_best", { env: ENV, user_id: USER });
  await del("puzzlebox_runs", { env: ENV, user_id: USER });
  const others = await sb.select("puzzlebox_runs", "id", PUZZLE_FILTER);
  if (others.length > 0) {
    throw new Error(`puzzlebox board ${PUZZLE_BOARD} has ${others.length} runs of other players in ${ENV}: not a test board, stopping`);
  }
  await del("puzzlebox_board_stats", PUZZLE_FILTER);
  await del("puzzlebox_players", { user_id: USER });
  return removed;
}

/** Rows that would make an INSERT touch or collide with a row that is not the test's. */
async function preflightConflicts(sb: Supabase): Promise<string[]> {
  const problems: string[] = [];
  const week = await sb.select("colorful_philosopher_posts", "id", { env: ENV, week_start: WEEK, slot: "card" });
  if (week.length > 0) problems.push(`colorful_philosopher_posts already has (${ENV}, ${WEEK}, card)`);
  const stats = await sb.select("puzzlebox_board_stats", "board", PUZZLE_FILTER);
  if (stats.length > 0) problems.push(`puzzlebox_board_stats already has (${ENV}, ${PUZZLE_GAME}, ${PUZZLE_BOARD})`);
  return problems;
}

// ------------------------------------------------------------------------------------------- waiting

interface ProbeResult {
  /** synced: reached after the write; unchanged: no write this phase; already: D1 held it before the write. */
  state: "synced" | "unchanged" | "already" | "timeout" | "error";
  lagMs?: number;
  detail?: string;
}

function d1Text(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

async function readD1(d1: D1HttpClient, probes: Probe[]): Promise<Array<string | null>> {
  const sql = `SELECT ${probes.map((probe, index) => `(${probe.d1}) AS p${index}`).join(", ")}`;
  const { rows } = await d1.query(sql);
  const row = rows[0] ?? {};
  return probes.map((_, index) => d1Text(row[`p${index}`]));
}

const log = (line: string) => console.error(`[d1-exercise] ${line}`);

async function waitForCopy(
  d1: D1HttpClient,
  sb: Supabase,
  label: string,
  probes: Probe[],
  marks: Marks,
  before: Array<string | null> = [],
): Promise<Map<string, ProbeResult>> {
  const expected = await Promise.all(probes.map((probe) => probe.expected(sb)));
  const results = new Map<string, ProbeResult>();
  const started = Date.now();
  const deadline = started + WAIT_TIMEOUT_MS;
  let last: Array<string | null> = [];
  for (;;) {
    try {
      last = await readD1(d1, probes);
    } catch (error) {
      const message = (error as Error).message;
      // A refused statement (a probe bug) never heals; network, 429 and 5xx answers do.
      if (/D1 HTTP API (?:200|4(?!29)\d\d)/.test(message)) throw error;
      log(`${label}: D1 read failed, retrying: ${message}`);
    }
    const now = Date.now();
    probes.forEach((probe, index) => {
      if (results.has(probe.name) || last.length === 0 || last[index] !== expected[index]) return;
      const at = marks.get(probe.name);
      if (at === undefined) results.set(probe.name, { state: "unchanged" });
      else if (before.length > 0 && before[index] === expected[index]) {
        results.set(probe.name, { state: "already", detail: "the D1 copy held this value before the write" });
      } else results.set(probe.name, { state: "synced", lagMs: now - at });
    });
    if (results.size === probes.length) break;
    if (now >= deadline) {
      probes.forEach((probe, index) => {
        if (results.has(probe.name)) return;
        results.set(probe.name, {
          state: "timeout",
          detail: `D1 ${JSON.stringify(last[index] ?? null)} vs Supabase ${JSON.stringify(expected[index])}`,
        });
      });
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  const synced = [...results.values()].filter((r) => r.state === "synced").map((r) => r.lagMs ?? 0);
  log(`${label}: ${results.size} probes settled in ${((Date.now() - started) / 1000).toFixed(1)} s` +
    (synced.length > 0 ? `, max lag ${(Math.max(...synced) / 1000).toFixed(1)} s` : ""));
  return results;
}

// ------------------------------------------------------------------------------------------- main

function usage(message: string): never {
  console.error(message);
  console.error("Usage: pnpm d1:exercise --target testbed");
  process.exit(2);
}

/**
 * The testbed D1 over the HTTP API. With the wrangler OAuth login the token expires within the hour, so
 * an auth refusal (401, 403) re-reads the login once (wrangler whoami refreshes it) and retries.
 */
async function d1Client(): Promise<D1HttpClient> {
  const databaseId = d1DatabaseId("testbed", readFileSync(join(ROOT, "wrangler.jsonc"), "utf8"));
  const envAccount = process.env.CLOUDFLARE_ACCOUNT_ID;
  const envToken = process.env.CLOUDFLARE_D1_API_TOKEN;
  const open = async (): Promise<D1HttpClient> => {
    if (envAccount && envToken) {
      return d1HttpClient({ accountId: envAccount, databaseId, token: envToken, fetch: fetch as unknown as FetchLike });
    }
    const { resolveAuthentication } = await import("./cloudflare-auth.mjs");
    const auth = resolveAuthentication() as { accountId: string; token: string };
    return d1HttpClient({ accountId: auth.accountId, databaseId, token: auth.token, fetch: fetch as unknown as FetchLike });
  };
  let client = await open();
  const usage = { queries: 0, rowsRead: 0, rowsWritten: 0 };
  return {
    usage,
    async query(sql, params) {
      try {
        return await client.query(sql, params);
      } catch (error) {
        if (envToken || !/D1 HTTP API (?:401|403)/.test((error as Error).message)) throw error;
        log("D1 refused the OAuth token: refreshing the wrangler login and retrying once");
        client = await open();
        return client.query(sql, params);
      }
    },
  };
}

async function syncState(d1: D1HttpClient): Promise<{ state: Row | null; rejects: Row[] }> {
  const state = await d1.query(
    "SELECT low_watermark, high_seen, last_lag_ms, fail_count, last_error FROM sync_state WHERE name = 'supabase_in'",
  );
  const rejects = await d1.query("SELECT reason, count(*) AS open FROM sync_rejects WHERE resolved_at IS NULL GROUP BY reason");
  return { state: state.rows[0] ?? null, rejects: rejects.rows };
}

function cell(result: ProbeResult | undefined): string {
  if (!result) return "-";
  if (result.state === "synced") return `${((result.lagMs ?? 0) / 1000).toFixed(1)} s`;
  if (result.state === "unchanged") return "= (no change)";
  if (result.state === "already") return "already equal";
  return result.state;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === "--") argv.shift();
  const targetIndex = argv.indexOf("--target");
  if (targetIndex < 0 || argv[targetIndex + 1] !== "testbed") usage("--target testbed is required (only the testbed is exercised)");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) usage("missing environment: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)");

  const sb = new Supabase(url, key);
  const w = new GuardedWriter(sb);
  const d1 = await d1Client();

  const flag = await d1.query("SELECT value FROM runtime_flags WHERE key = 'sync.enabled'");
  if (flag.rows[0]?.value !== "on") throw new Error("sync.enabled is not on in the testbed D1: nothing would carry the changes");
  const before = await syncState(d1);
  log(`sync_state before: ${JSON.stringify(before.state)}; open rejects: ${JSON.stringify(before.rejects)}`);

  const results = new Map<string, Partial<Record<Phase, ProbeResult>>>();
  const failures: string[] = [];
  let userMade = false;
  try {
    log(`test user ${USER}: ${await ensureTestUser(sb)}`);
    userMade = true;
    const leftovers = await cleanup(w, sb);
    log(`leftovers of an earlier run deleted: ${leftovers}`);
    const conflicts = await preflightConflicts(sb);
    if (conflicts.length > 0) throw new Error(`refusing to start: ${conflicts.join("; ")}`);
    const clean = await waitForCopy(d1, sb, "start: D1 copy clean", ALL_PROBES, new Map());
    const dirty = [...clean].filter(([, r]) => r.state !== "unchanged");
    if (dirty.length > 0) throw new Error(`the D1 copy does not match Supabase before the run: ${dirty.map(([n, r]) => `${n} ${r.detail ?? ""}`).join("; ")}`);

    const source = await sb.select("runs", RUN_COPY_COLUMNS.join(","), { env: ENV }, { order: "created_at.desc,id.asc", limit: 5 });
    const runSource = source.find((row) => typeof row.raw === "string" && row.raw.length > 0);
    if (!runSource) throw new Error(`no ${ENV} run with a raw file to copy`);
    const ctx: Context = { w, sb, runSource };

    for (const group of GROUPS) {
      for (const phase of ["I", "U", "D"] as const) {
        const marks: Marks = new Map();
        const before = await readD1(d1, group.probes);
        log(`${group.name}: ${phase}`);
        await group.steps[phase](ctx, marks);
        const phaseResults = await waitForCopy(d1, sb, `${group.name} ${phase}`, group.probes, marks, before);
        for (const [name, result] of phaseResults) {
          results.set(name, { ...(results.get(name) ?? {}), [phase]: result });
          if (result.state === "timeout" || result.state === "error") failures.push(`${name} ${phase}: ${result.detail ?? result.state}`);
          if (result.state === "synced" && (result.lagMs ?? 0) > LAG_LIMIT_MS) {
            failures.push(`${name} ${phase}: lag ${((result.lagMs ?? 0) / 1000).toFixed(1)} s > ${LAG_LIMIT_MS / 1000} s`);
          }
        }
      }
    }

    // Everything is gone from Supabase and from the D1 copy.
    const remaining = (await Promise.all(ALL_PROBES.map((probe) => probe.expected(sb)))).filter(
      (value, index) => value !== null && !(ALL_PROBES[index].name === "(threads, derived)" && value === "0/0"),
    );
    if (remaining.length > 0) failures.push(`Supabase still holds ${remaining.length} test rows`);
    const copy = await readD1(d1, ALL_PROBES);
    const copyLeft = copy.filter((value, index) => value !== null && !(ALL_PROBES[index].name === "(threads, derived)" && value === "0/0"));
    if (copyLeft.length > 0) failures.push(`D1 still holds ${copyLeft.length} test rows`);
  } catch (error) {
    failures.push(`error: ${(error as Error).message}`);
    log(`error, cleaning up: ${(error as Error).message}`);
    try {
      await cleanup(w, sb);
    } catch (cleanupError) {
      failures.push(`cleanup error: ${(cleanupError as Error).message}`);
    }
  } finally {
    // threads keeps zero rows by design (design 4.2): the test's own key goes once it is 0/0.
    try {
      const gone = await d1.query("DELETE FROM threads WHERE thread_key = ?1 AND like_count = 0 AND comment_count = 0", [THREAD]);
      log(`D1 threads row of the test key removed: ${gone.changes}`);
    } catch (error) {
      failures.push(`threads cleanup: ${(error as Error).message}`);
    }
    // A raw the sync could not fetch stays queued after its run is deleted (the queue row goes only on
    // an empty answer): the test run's row goes once the run is gone from the copy.
    try {
      const queued = await d1.query(
        "DELETE FROM sync_pending_raw WHERE post_id = ?1 AND NOT EXISTS " +
          "(SELECT 1 FROM posts WHERE service = 'history_course' AND id = ?1) RETURNING attempts, last_error",
        [RUN_ID],
      );
      if (queued.rows.length > 0) {
        log(`D1 sync_pending_raw row of the test run removed (attempts ${String(queued.rows[0].attempts)}, ${String(queued.rows[0].last_error)})`);
      }
    } catch (error) {
      failures.push(`sync_pending_raw cleanup: ${(error as Error).message}`);
    }
    if (userMade) {
      try {
        await deleteTestUser(sb);
        log(`test user ${USER} deleted`);
      } catch (error) {
        failures.push(`test user delete: ${(error as Error).message}`);
      }
    }
  }

  let after: { state: Row | null; rejects: Row[] } = { state: null, rejects: [] };
  try {
    after = await syncState(d1);
  } catch (error) {
    failures.push(`sync_state read: ${(error as Error).message}`);
  }
  // fail_count only grows and S11 keeps last_error: a failed sync run during this run shows as a rise.
  const failsBefore = Number(before.state?.fail_count ?? 0);
  const failsAfter = Number(after.state?.fail_count ?? 0);
  if (failsAfter > failsBefore) {
    failures.push(`sync_state fail_count rose ${failsBefore} -> ${failsAfter} during the run: ${String(after.state?.last_error ?? "")}`);
  }
  if (after.rejects.length > 0) failures.push(`open sync rejects: ${JSON.stringify(after.rejects)}`);

  const lines: string[] = [];
  lines.push("table | I | U | D");
  for (const table of LOGGED_TABLES) {
    if (SKIPPED[table]) {
      lines.push(`${table} | skipped: ${SKIPPED[table]}`);
      continue;
    }
    for (const probe of ALL_PROBES.filter((p) => p.name === table || p.under === table)) {
      const r = results.get(probe.name) ?? {};
      lines.push(`${probe.name} | ${cell(r.I)} | ${cell(r.U)} | ${cell(r.D)}`);
    }
  }
  const lags = [...results.values()].flatMap((r) => Object.values(r)).filter((r) => r.state === "synced").map((r) => r.lagMs ?? 0);
  lines.push(`max Supabase write -> D1 visible: ${lags.length > 0 ? (Math.max(...lags) / 1000).toFixed(1) : "-"} s (limit ${LAG_LIMIT_MS / 1000} s)`);
  lines.push(`sync_state after: ${JSON.stringify(after.state)}`);
  lines.push(`open sync rejects after: ${after.rejects.length === 0 ? "none" : JSON.stringify(after.rejects)}`);
  lines.push(`result: ${failures.length === 0 ? "ok" : "failed"}`);
  for (const failure of failures) lines.push(`  - ${failure}`);
  for (const line of lines) console.log(line);
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(`d1 exercise error: ${(error as Error).message}`);
  process.exit(1);
});

/**
 * The daily reconcile of the D1 shadow (docs/supabase-exit/D1_SCHEMA_DESIGN.md 5.4) and the run
 * summary fill it runs first (4.4: RF1 -> R3r -> extractRunListSummary -> RF2, D1 only).
 *
 * One target is one Supabase env against its own D1 (testbed: 'development' vs slseoun-testbed,
 * production: 'production' vs slseoun-prod). Supabase is read through PostgREST with the service key,
 * D1 through the D1 HTTP API; both clients are injected, so the spec runs against fakes.
 *
 * Normalizing: every Supabase row goes through the shared row mapper into a local in-memory SQLite
 * copy of the D1 schema (foreign keys off: it is only a normalizer), so both sides are compared as D1
 * rows that one function turns into lines (D1-only columns left out, JSON re-written with sorted
 * keys, rank_history[].at through canonicalTs, the run raw as its sha-256). Lines are sorted by byte
 * order in the job before hashing, never by ORDER BY. A Supabase row the mapper (or a D1 CHECK)
 * refuses is a difference, as the 1-minute sync would have refused it too (design 3.1).
 *
 * Failures (the job exits non-zero): any rows difference, a derived difference (threads against the
 * D1 recount and rpc/get_engagement_counts, comments.like_count against the comment_likes recount),
 * a run whose list inputs from the summary columns differ from today's from the raw, an open reject.
 * Reported only: summary_version 0 runs after the fill (expected 0), known kinds (orphan bodies,
 * cross-env this-or-that likes), post and run counts against threads (tasks/010 #68).
 *
 * Writes go to D1 only: RF2 (the fill) and one sync_checks upsert per run.
 */
import { createHash } from "node:crypto";
import { canonicalTs, postgrestTs } from "../../src/lib/d1-time";
import {
  d1TableFor,
  mapRow,
  POST_TABLE_SERVICES,
  runSummaryFillStatement,
  SUPABASE_TABLES,
  type RowImage,
} from "../../src/lib/d1-sync/row-mapper";
import type { D1Statement, D1Value } from "../../src/lib/d1-sync/statements";
import { RECENT_DONATED_RUNS_LIMIT } from "../../src/lib/history-runs-api-rules";
import {
  extractRunListSummary,
  listInputsFromRawRow,
  listInputsFromSummaryRow,
  RUN_SUMMARY_VERSION,
  type RunSummaryListRow,
} from "../../src/lib/run-list-summary";
import type { RunRow } from "../../src/lib/run-summary-row";
import type { D1HttpClient, D1Usage } from "./d1-http-client";
import type { PostgrestFilter, PostgrestReader, PostgrestUsage } from "./postgrest-reader";
import { comparable, compareListInputs, popularElements, summaryRowFromD1 } from "./run-summary-compare";
import { openD1TestDb, rows as localRows, type SqliteDb } from "./test-db";

// ------------------------------------------------------------------------------------------- targets

export type TargetName = "testbed" | "production";

export const TARGETS: Record<TargetName, { supabaseEnv: string; databaseName: string; wranglerEnv: string | null }> = {
  testbed: { supabaseEnv: "development", databaseName: "slseoun-testbed", wranglerEnv: "testbed" },
  production: { supabaseEnv: "production", databaseName: "slseoun-prod", wranglerEnv: null },
};

export function isTargetName(value: unknown): value is TargetName {
  return value === "testbed" || value === "production";
}

/** The D1 database id of a target, from wrangler.jsonc (the binding the Worker uses). */
export function d1DatabaseId(target: TargetName, wranglerJsonc: string): string {
  const config = JSON.parse(wranglerJsonc.replace(/^\s*\/\/.*$/gm, "")) as {
    d1_databases?: Array<{ binding: string; database_name: string; database_id: string }>;
    env?: Record<string, { d1_databases?: Array<{ binding: string; database_name: string; database_id: string }> }>;
  };
  const spec = TARGETS[target];
  const list = spec.wranglerEnv ? config.env?.[spec.wranglerEnv]?.d1_databases : config.d1_databases;
  const db = list?.find((entry) => entry.binding === "DB");
  if (!db?.database_id || db.database_name !== spec.databaseName) {
    throw new Error(`wrangler.jsonc has no DB binding named ${spec.databaseName} for ${target}`);
  }
  return db.database_id;
}

// ------------------------------------------------------------------------------------------- statements (queries.sql)

/** RF1, verbatim from docs/supabase-exit/d1-schema/queries.sql. */
export const RF1_SQL =
  "SELECT post_id FROM post_history_course WHERE service = 'history_course' AND summary_version < ?1 ORDER BY post_id LIMIT 50;";
const RF1_LIMIT = 50;
/** R3r, verbatim. */
export const R3R_SQL = "SELECT raw FROM post_history_course_file WHERE service = 'history_course' AND post_id = ?1;";
/** S4, verbatim. */
export const S4_SQL =
  "SELECT direction, ref, table_name, d1_table, row_key, op, reason, attempts FROM sync_rejects\n" +
  "WHERE resolved_at IS NULL ORDER BY last_at LIMIT 10;";

/** One sync_checks row per (source table, D1 table, kind) and day; the rows come as one JSON array. */
export const SYNC_CHECKS_UPSERT_SQL =
  "INSERT INTO sync_checks (check_date, source_table, d1_table, kind, d1_rows, supabase_rows, d1_hash, supabase_hash, " +
  "diff_count, diff_sample, checked_at) " +
  "SELECT ?1, json_extract(value, '$.source_table'), json_extract(value, '$.d1_table'), json_extract(value, '$.kind'), " +
  "json_extract(value, '$.d1_rows'), json_extract(value, '$.supabase_rows'), json_extract(value, '$.d1_hash'), " +
  "json_extract(value, '$.supabase_hash'), json_extract(value, '$.diff_count'), json_extract(value, '$.diff_sample'), ?2 " +
  "FROM json_each(?3) WHERE true " +
  "ON CONFLICT (check_date, source_table, d1_table, kind) DO UPDATE SET d1_rows = excluded.d1_rows, " +
  "supabase_rows = excluded.supabase_rows, d1_hash = excluded.d1_hash, supabase_hash = excluded.supabase_hash, " +
  "diff_count = excluded.diff_count, diff_sample = excluded.diff_sample, checked_at = excluded.checked_at";

// ------------------------------------------------------------------------------------------- plan

/** Supabase order (its primary key or unique key, env left out) for stable paging. */
export const SUPABASE_ORDER: Readonly<Record<string, string>> = {
  comments: "id",
  comment_likes: "comment_id,user_id",
  likes: "story_id,user_id",
  resource_reactions: "resource_type,resource_id,game_version,user_id",
  resource_reaction_counts: "resource_type,resource_id,game_version",
  community_stories: "id",
  chemical_posts: "id",
  combo_posts: "id",
  transfigure_posts: "id",
  this_or_that_posts: "id",
  favorite_tournament_posts: "id",
  decisions_decisions_posts: "id",
  pagestorm_posts: "id",
  runs: "id",
  this_or_that_post_votes: "post_id,user_id",
  this_or_that_post_likes: "post_id,user_id",
  favorite_tournament_candidate_stats: "tournament_id,resource_type,resource_id",
  favorite_tournament_plays: "id",
  pagestorm_drafts: "id",
  defragment_bodies: "source_service,source_id",
  profile_character_nickname_pools: "character_id,locale",
  contact_inquiries: "id",
  puzzlebox_runs: "id",
  puzzlebox_players: "user_id",
  puzzlebox_best: "game,board,user_id",
  puzzlebox_board_stats: "game,board",
  colorful_philosopher_posts: "id",
};

/** Tables without env in Supabase: every D1 holds every row (design 4.5). */
const ENVLESS = new Set(["profile_character_nickname_pools", "puzzlebox_players"]);

/** Any write source on D1 (step 5): the runtime_flags rows the write gate reads (d1-write/gate.ts). */
const SOURCE_D1_SQL = "SELECT key FROM runtime_flags WHERE key >= 'source.' AND key < 'source/' AND value = 'd1' LIMIT 1";

/** D1-only columns left out of the rows comparison (design 5.4): built in D1, compared elsewhere. */
export const D1_ONLY_COLUMNS: Readonly<Record<string, readonly string[]>> = {
  posts: ["summary"],
  comments: ["like_count"],
  post_history_course: ["summary_version", "badges", "characters", "game_mode", "game_elements", "list_facts"],
};

/** Columns compared by their sha-256 (the run raw, design 5.4). */
const HASHED: Readonly<Record<string, string>> = { post_history_course_file: "raw" };

/** Thread key prefix of each post service (design 3.4, threadOwner). */
export const THREAD_PREFIX: Readonly<Record<string, string>> = {
  combo: "c-c-c-combo",
  chemical_x: "chemical-x",
  transfigure: "transfigure",
  this_or_that: "this-or-that",
  favorite_tournament: "favorite-tournament",
  decisions_decisions: "decisions-decisions",
  pagestorm: "pagestorm",
  history_course: "history-course",
};

const SUPABASE_PAGE = 1000;
const SUPABASE_RUN_PAGE = 20;
const D1_PAGE = 250;
const D1_FILE_PAGE = 10;
const LOCAL_PAGE = 1_000_000;

interface TableInfo {
  name: string;
  columns: string[];
  pk: string[];
  json: Set<string>;
}

export interface Part {
  d1Table: string;
  /** posts holds every service: each post mapper compares its own service's rows. */
  filter: { column: string; value: string } | null;
}

export interface SourcePlan {
  table: string;
  parts: Part[];
}

function tableInfo(db: SqliteDb, name: string): TableInfo {
  const info = localRows(db, `PRAGMA table_info(${name})`);
  if (info.length === 0) throw new Error(`the D1 schema has no table ${name}`);
  const sql = String((localRows(db, "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?1", name)[0] ?? {}).sql ?? "");
  return {
    name,
    columns: info.map((column) => String(column.name)),
    pk: info
      .filter((column) => Number(column.pk) > 0)
      .sort((a, b) => Number(a.pk) - Number(b.pk))
      .map((column) => String(column.name)),
    json: new Set([...sql.matchAll(/json_valid\("?(\w+)"?\)/g)].map((match) => match[1])),
  };
}

/** Which D1 tables (and posts service) each Supabase table's rows land in. */
export function comparePlan(db: SqliteDb): SourcePlan[] {
  const tables = localRows(db, "SELECT name FROM sqlite_master WHERE type = 'table'").map((row) => String(row.name));
  return SUPABASE_TABLES.map((table) => {
    const service = POST_TABLE_SERVICES[table];
    if (!service) return { table, parts: [{ d1Table: d1TableFor(table), filter: null }] };
    const children = tables.filter((name) => name.startsWith(`post_${service}_`)).sort();
    return {
      table,
      parts: [
        { d1Table: "posts", filter: { column: "service", value: service } },
        { d1Table: `post_${service}`, filter: null },
        ...children.map((d1Table) => ({ d1Table, filter: null })),
      ],
    };
  });
}

function supabaseQuery(table: string, env: string): { select: string; filters: PostgrestFilter[]; embed: string | null } {
  if (table === "comment_likes") {
    // No env column: the parent comment's env (design 5.4).
    return { select: "*,comments!inner(env)", filters: [{ column: "comments.env", op: "eq", value: env }], embed: "comments" };
  }
  if (table === "this_or_that_post_likes") {
    // Only likes whose post has the same env; the rest are cross_env (design 2.2).
    return {
      select: "*,this_or_that_posts!inner(env)",
      filters: [
        { column: "env", op: "eq", value: env },
        { column: "this_or_that_posts.env", op: "eq", value: env },
      ],
      embed: "this_or_that_posts",
    };
  }
  if (ENVLESS.has(table)) return { select: "*", filters: [], embed: null };
  return { select: "*", filters: [{ column: "env", op: "eq", value: env }], embed: null };
}

// ------------------------------------------------------------------------------------------- lines

function q(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(object)
        .sort()
        .map((key) => [key, sorted(object[key])]),
    );
  }
  return value;
}

/** JSON with sorted keys, so two encodings of one value give one text. */
export function stableJson(value: unknown): string {
  return JSON.stringify(sorted(value));
}

/** rank_history[].at keeps Postgres timestamp::text (UTC, no offset); compared through canonicalTs. */
function normalizeRankHistory(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((entry) => {
    if (entry === null || typeof entry !== "object" || typeof (entry as Record<string, unknown>).at !== "string") return entry;
    const at = (entry as Record<string, string>).at;
    return { ...(entry as Record<string, unknown>), at: canonicalTs(at) ?? canonicalTs(`${at}Z`) ?? at };
  });
}

function normalizedValue(info: TableInfo, column: string, value: unknown): unknown {
  if (typeof value !== "string" || !info.json.has(column)) return value;
  try {
    const parsed = JSON.parse(value) as unknown;
    return stableJson(column === "rank_history" ? normalizeRankHistory(parsed) : parsed);
  } catch {
    return value;
  }
}

function compareColumns(info: TableInfo): string[] {
  const skip = new Set(D1_ONLY_COLUMNS[info.name] ?? []);
  return info.columns.filter((column) => !skip.has(column));
}

function keyText(pk: readonly string[], row: Record<string, unknown>): string {
  return JSON.stringify(pk.map((column) => row[column] ?? null));
}

interface Line {
  line: string;
  values: unknown[];
}

function linesOf(info: TableInfo, columns: readonly string[], rows: ReadonlyArray<Record<string, unknown>>): Map<string, Line> {
  const out = new Map<string, Line>();
  for (const row of rows) {
    const values = columns.map((column) => normalizedValue(info, column, row[column] ?? null));
    out.set(keyText(info.pk, row), { line: JSON.stringify(values), values });
  }
  return out;
}

/** sha-256 of the lines sorted by UTF-8 byte order (not by any database collation). */
export function hashLines(lines: Iterable<string>): string {
  const buffers = [...lines].map((line) => Buffer.from(line, "utf8")).sort(Buffer.compare);
  const hash = createHash("sha256");
  buffers.forEach((buffer, index) => {
    if (index > 0) hash.update("\n");
    hash.update(buffer);
  });
  return hash.digest("hex");
}

// ------------------------------------------------------------------------------------------- reading

type SqlAll = (sql: string, params: D1Value[]) => Promise<Array<Record<string, unknown>>>;

/** Every row of one D1 table (or one posts service), keyset-paged on the primary key: each row is read once. */
async function readTable(
  all: SqlAll,
  info: TableInfo,
  filter: Part["filter"],
  pageSize: number,
): Promise<Array<Record<string, unknown>>> {
  const keys = info.pk.filter((column) => column !== filter?.column);
  const heavy = HASHED[info.name];
  const select = `SELECT ${info.columns.map(q).join(", ")} FROM ${info.name}`;
  const out: Array<Record<string, unknown>> = [];
  let last: D1Value[] | null = null;
  for (;;) {
    const where: string[] = [];
    const params: D1Value[] = [];
    if (filter) {
      params.push(filter.value);
      where.push(`${q(filter.column)} = ?${params.length}`);
    }
    if (last) {
      const from = params.length;
      params.push(...last);
      where.push(`(${keys.map(q).join(", ")}) > (${keys.map((_, i) => `?${from + i + 1}`).join(", ")})`);
    }
    const sql = `${select}${where.length > 0 ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY ${keys.map(q).join(", ")} LIMIT ${pageSize}`;
    const page = await all(sql, params);
    if (page.length > 0) last = keys.map((column) => page[page.length - 1][column] as D1Value);
    for (const row of page) {
      const copy = { ...row };
      if (heavy && typeof copy[heavy] === "string") copy[heavy] = sha256(copy[heavy] as string);
      out.push(copy);
    }
    if (page.length < pageSize) return out;
  }
}

interface LocalReject {
  d1Table: string;
  key: string;
  reason: string;
}

/** Supabase rows -> the local normalizer through the row mapper; refused rows are rejects. */
function loadLocal(db: SqliteDb, table: string, images: readonly RowImage[], infos: Map<string, TableInfo>, nowMs: number) {
  const rejects: LocalReject[] = [];
  let orphans = 0;
  images.forEach((image, index) => {
    const result = mapRow(table, image, { nowMs });
    const keyOf = (d1Table: string, rowKey: Record<string, D1Value> | null) =>
      rowKey ? keyText(infos.get(d1Table)?.pk ?? Object.keys(rowKey), rowKey) : `"row ${index} without a key"`;
    if (!result.ok) {
      rejects.push({ d1Table: result.reject.d1Table, key: keyOf(result.reject.d1Table, result.reject.rowKey), reason: result.reject.reason });
      return;
    }
    db.exec("SAVEPOINT reconcile_row");
    try {
      let orphan = false;
      for (const statement of result.statements) {
        const changes = Number(db.prepare(statement.sql).run(...statement.params).changes);
        if (changes === 0 && statement.zeroRows === "orphan") orphan = true;
      }
      db.exec("RELEASE reconcile_row");
      if (orphan) orphans += 1;
    } catch {
      db.exec("ROLLBACK TO reconcile_row");
      db.exec("RELEASE reconcile_row");
      rejects.push({ d1Table: result.d1Table, key: keyOf(result.d1Table, result.rowKey), reason: "check" });
    }
  });
  return { rejects, orphans };
}

// ------------------------------------------------------------------------------------------- checks

export interface DiffEntry {
  key: string;
  reason: string;
}

export interface KnownKind {
  known: "orphan" | "cross_env";
  count: number;
}

export interface CheckRow {
  source_table: string;
  d1_table: string;
  kind: "rows" | "derived";
  d1_rows: number;
  supabase_rows: number;
  d1_hash: string;
  supabase_hash: string;
  diff_count: number;
  /** Up to 20 differing keys with a short reason, then the known kinds. */
  diff_sample: Array<DiffEntry | KnownKind>;
  /** Every difference reason with its count (the report prints these, never keys or values). */
  reasons: Record<string, number>;
}

const SAMPLE = 20;

function checkRow(
  base: Pick<CheckRow, "source_table" | "d1_table" | "kind" | "d1_rows" | "supabase_rows" | "d1_hash" | "supabase_hash">,
  diffs: DiffEntry[],
  known: KnownKind[] = [],
): CheckRow {
  const ordered = [...diffs].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const reasons: Record<string, number> = {};
  for (const diff of ordered) reasons[diff.reason] = (reasons[diff.reason] ?? 0) + 1;
  return { ...base, diff_count: ordered.length, diff_sample: [...ordered.slice(0, SAMPLE), ...known], reasons };
}

function compareRows(
  source: string,
  info: TableInfo,
  d1Rows: ReadonlyArray<Record<string, unknown>>,
  supabaseRows: ReadonlyArray<Record<string, unknown>>,
  rejects: readonly LocalReject[],
  known: KnownKind[],
): CheckRow {
  const columns = compareColumns(info);
  const d1 = linesOf(info, columns, d1Rows);
  const supabase = linesOf(info, columns, supabaseRows);
  const refused = new Map(rejects.map((reject) => [reject.key, reject.reason]));
  const diffs: DiffEntry[] = [];
  for (const [key, entry] of supabase) {
    const other = d1.get(key);
    if (!other) diffs.push({ key, reason: "missing_in_d1" });
    else if (other.line !== entry.line) {
      const differing = columns.filter((_, i) => JSON.stringify(entry.values[i]) !== JSON.stringify(other.values[i]));
      diffs.push({ key, reason: `differs: ${differing.join(", ")}` });
    }
  }
  for (const key of d1.keys()) {
    if (supabase.has(key)) continue;
    diffs.push({ key, reason: refused.has(key) ? `supabase_reject:${refused.get(key)}` : "missing_in_supabase" });
  }
  for (const [key, reason] of refused) {
    if (!d1.has(key)) diffs.push({ key, reason: `supabase_reject:${reason}` });
  }
  return checkRow(
    {
      source_table: source,
      d1_table: info.name,
      kind: "rows",
      d1_rows: d1.size,
      supabase_rows: supabase.size + refused.size,
      d1_hash: hashLines([...d1.values()].map((entry) => entry.line)),
      supabase_hash: hashLines([...supabase.values()].map((entry) => entry.line)),
    },
    diffs,
    known,
  );
}

function countBy<T>(items: readonly T[], key: (item: T) => string): Map<string, number> {
  const out = new Map<string, number>();
  for (const item of items) out.set(key(item), (out.get(key(item)) ?? 0) + 1);
  return out;
}

/** threads against the D1 recount (likes, comments rows) and rpc/get_engagement_counts (design 5.4). */
function threadsCheck(
  threads: ReadonlyArray<Record<string, unknown>>,
  likes: ReadonlyArray<Record<string, unknown>>,
  comments: ReadonlyArray<Record<string, unknown>>,
  rpc: ReadonlyArray<Record<string, unknown>>,
): CheckRow {
  const recount = new Map<string, { like: number; comment: number; last: string | null }>();
  const slot = (key: string) => {
    let entry = recount.get(key);
    if (!entry) recount.set(key, (entry = { like: 0, comment: 0, last: null }));
    return entry;
  };
  for (const like of likes) slot(String(like.story_id)).like += 1;
  for (const comment of comments) {
    const entry = slot(String(comment.story_id));
    entry.comment += 1;
    const at = String(comment.created_at);
    if (entry.last === null || at > entry.last) entry.last = at;
  }
  const stored = new Map(
    threads.map((row) => [
      String(row.thread_key),
      { like: Number(row.like_count), comment: Number(row.comment_count), last: (row.last_comment_at as string | null) ?? null },
    ]),
  );
  const reasons = new Map<string, string[]>();
  const add = (key: string, reason: string) => reasons.set(key, [...(reasons.get(key) ?? []), reason]);
  for (const key of new Set([...stored.keys(), ...recount.keys()])) {
    const a = stored.get(key) ?? { like: 0, comment: 0, last: null };
    const b = recount.get(key) ?? { like: 0, comment: 0, last: null };
    if (a.like !== b.like || a.comment !== b.comment || a.last !== b.last) add(key, "threads_vs_recount");
  }
  const nonzero = [...stored].filter(([, value]) => value.like > 0 || value.comment > 0);
  const d1Counts = new Map(nonzero.map(([key, value]) => [key, `${value.like}/${value.comment}`]));
  const rpcCounts = new Map(rpc.map((row) => [String(row.story_id), `${Number(row.like_count)}/${Number(row.comment_count)}`]));
  for (const key of new Set([...d1Counts.keys(), ...rpcCounts.keys()])) {
    if (d1Counts.get(key) !== rpcCounts.get(key)) add(key, "threads_vs_rpc");
  }
  return checkRow(
    {
      source_table: "get_engagement_counts",
      d1_table: "threads",
      kind: "derived",
      d1_rows: d1Counts.size,
      supabase_rows: rpcCounts.size,
      d1_hash: hashLines([...d1Counts].map(([key, value]) => JSON.stringify([key, value]))),
      supabase_hash: hashLines([...rpcCounts].map(([key, value]) => JSON.stringify([key, value]))),
    },
    [...reasons].map(([key, list]) => ({ key: JSON.stringify([key]), reason: list.join(", ") })),
  );
}

/** comments.like_count against the comment_likes recount, in D1 and from Supabase's rows. */
function commentLikesCheck(
  d1Comments: ReadonlyArray<Record<string, unknown>>,
  d1CommentLikes: ReadonlyArray<Record<string, unknown>>,
  supabaseComments: readonly RowImage[],
  supabaseCommentLikes: readonly RowImage[],
): CheckRow {
  const d1Recount = countBy(d1CommentLikes, (row) => String(row.comment_id));
  const supabaseRecount = countBy(supabaseCommentLikes, (row) => String(row.comment_id));
  const supabaseIds = new Set(supabaseComments.map((row) => String(row.id)));
  const diffs: DiffEntry[] = [];
  for (const row of d1Comments) {
    const id = String(row.id);
    const stored = Number(row.like_count);
    const reasons: string[] = [];
    if (stored !== (d1Recount.get(id) ?? 0)) reasons.push("like_count_vs_recount");
    if (supabaseIds.has(id) && stored !== (supabaseRecount.get(id) ?? 0)) reasons.push("like_count_vs_supabase");
    if (reasons.length > 0) diffs.push({ key: JSON.stringify([id]), reason: reasons.join(", ") });
  }
  return checkRow(
    {
      source_table: "comment_likes",
      d1_table: "comments",
      kind: "derived",
      d1_rows: d1Comments.length,
      supabase_rows: supabaseIds.size,
      d1_hash: hashLines(d1Comments.map((row) => JSON.stringify([String(row.id), Number(row.like_count)]))),
      supabase_hash: hashLines([...supabaseIds].map((id) => JSON.stringify([id, supabaseRecount.get(id) ?? 0]))),
    },
    diffs,
  );
}

/** Post and run counts against threads (this-or-that likes: their own rows). Reported only (design 5.4, #68). */
function postCountDrift(
  posts: ReadonlyArray<Record<string, unknown>>,
  threads: ReadonlyArray<Record<string, unknown>>,
  thisOrThatLikes: ReadonlyArray<Record<string, unknown>>,
): number {
  const byKey = new Map(threads.map((row) => [String(row.thread_key), row]));
  const ownLikes = countBy(thisOrThatLikes, (row) => String(row.post_id));
  let drift = 0;
  for (const post of posts) {
    const service = String(post.service);
    const thread = byKey.get(`${THREAD_PREFIX[service] ?? service}:${String(post.id)}`);
    const likes = service === "this_or_that" ? ownLikes.get(String(post.id)) ?? 0 : Number(thread?.like_count ?? 0);
    const comments = Number(thread?.comment_count ?? 0);
    if (Number(post.like_count) !== likes || Number(post.comment_count) !== comments) drift += 1;
  }
  return drift;
}

/** Supabase runs image -> today's list row (RUN_SUMMARY_COLUMNS with the raw). */
function rawRunRow(image: RowImage): RunRow | null {
  const createdAt = postgrestTs(canonicalTs(image.created_at));
  if (!createdAt || typeof image.raw !== "string") return null;
  return {
    id: String(image.id),
    raw: image.raw,
    seed: image.seed as string,
    build: image.build as string,
    character: image.character as string,
    ascension: image.ascension as number,
    win: image.win as boolean,
    start_time: image.start_time as number | null,
    run_time: image.run_time as number | null,
    acts_count: image.acts_count as number,
    total_floors: image.total_floors as number,
    cover_spec: image.cover_spec as RunRow["cover_spec"],
    donor_user_id: image.donor_user_id as string | null,
    created_at: createdAt,
  };
}

interface SummaryResult {
  check: CheckRow;
  compared: number;
  differing: number;
  popularLatest: boolean;
  popularAll: boolean;
  versionZero: number;
  belowVersion: number;
}

/** List inputs from the D1 summary columns against today's from the Supabase raw (design 5.4, 9). */
function summaryCheck(
  d1Posts: ReadonlyArray<Record<string, unknown>>,
  d1Runs: ReadonlyArray<Record<string, unknown>>,
  supabaseRuns: readonly RowImage[],
): SummaryResult {
  const postById = new Map(d1Posts.map((row) => [String(row.id), row]));
  const supabaseById = new Map(supabaseRuns.map((image) => [String(image.id), image]));
  const versionZero = d1Runs.filter((row) => Number(row.summary_version) === 0).length;
  const belowVersion = d1Runs.filter((row) => Number(row.summary_version) < RUN_SUMMARY_VERSION).length;
  const pairs: Array<{ id: string; createdAt: string; raw: RunRow; summary: RunSummaryListRow }> = [];
  for (const row of d1Runs) {
    if (Number(row.summary_version) === 0) continue;
    const id = String(row.post_id);
    const post = postById.get(id);
    const image = supabaseById.get(id);
    const raw = image ? rawRunRow(image) : null;
    if (!post || !raw) continue; // a rows difference already
    const summary = summaryRowFromD1({ ...row, id, donor_user_id: post.user_id ?? null, created_at: post.created_at });
    pairs.push({ id, createdAt: String(post.created_at), raw, summary });
  }
  const diffs: DiffEntry[] = [];
  const d1Lines: string[] = [];
  const supabaseLines: string[] = [];
  for (const pair of pairs) {
    let reasons: string[];
    try {
      reasons = compareListInputs(pair.raw, pair.summary);
      d1Lines.push(stableJson([pair.id, comparable(listInputsFromSummaryRow(pair.summary))]));
      supabaseLines.push(stableJson([pair.id, comparable(listInputsFromRawRow(pair.raw))]));
    } catch (error) {
      reasons = [`error: ${(error as Error).message.slice(0, 80)}`];
    }
    if (reasons.length > 0) diffs.push({ key: JSON.stringify([pair.id]), reason: reasons.join(", ") });
  }
  // Popular element chips: the first screen's latest list and every run.
  const desc = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);
  const newest = [...pairs].sort((a, b) => desc(a.createdAt, b.createdAt) || desc(a.id, b.id));
  const popular = (list: typeof pairs, name: string) => {
    let d1 = "";
    let today = "";
    try {
      d1 = stableJson(popularElements(list.map((pair) => listInputsFromSummaryRow(pair.summary))));
      today = stableJson(popularElements(list.map((pair) => listInputsFromRawRow(pair.raw))));
    } catch (error) {
      d1 = `error: ${(error as Error).message}`;
    }
    d1Lines.push(JSON.stringify([name, d1]));
    supabaseLines.push(JSON.stringify([name, today]));
    if (d1 !== today) diffs.push({ key: JSON.stringify([name]), reason: "popular_elements" });
    return d1 === today;
  };
  const popularLatest = popular(newest.slice(0, RECENT_DONATED_RUNS_LIMIT), "popular:latest");
  const popularAll = popular(newest, "popular:all");
  return {
    check: checkRow(
      {
        source_table: "runs",
        d1_table: "post_history_course",
        kind: "derived",
        d1_rows: pairs.length,
        supabase_rows: supabaseRuns.length,
        d1_hash: hashLines(d1Lines),
        supabase_hash: hashLines(supabaseLines),
      },
      diffs,
    ),
    compared: pairs.length,
    differing: diffs.filter((diff) => !diff.key.startsWith('["popular:')).length,
    popularLatest,
    popularAll,
    versionZero,
    belowVersion,
  };
}

// ------------------------------------------------------------------------------------------- fill

export interface FillResult {
  filled: string[];
  alreadyCurrent: string[];
  missingRaw: string[];
  unreadable: string[];
}

/**
 * The run summary fill (design 4.4): RF1 picks runs below the current extractor version, R3r reads
 * each raw from D1, the project code computes the summary, RF2 writes it. D1 only. A run that could
 * not be filled (no raw in D1 yet, a raw the parser refuses) is reported and left at its version.
 */
export async function fillRunSummaries(d1: D1HttpClient): Promise<FillResult> {
  const result: FillResult = { filled: [], alreadyCurrent: [], missingRaw: [], unreadable: [] };
  const attempted = new Set<string>();
  for (;;) {
    const picked = (await d1.query(RF1_SQL, [RUN_SUMMARY_VERSION])).rows.map((row) => String(row.post_id));
    const fresh = picked.filter((id) => !attempted.has(id));
    for (const id of fresh) {
      attempted.add(id);
      const raw = (await d1.query(R3R_SQL, [id])).rows[0]?.raw;
      if (typeof raw !== "string") {
        result.missingRaw.push(id);
        continue;
      }
      let statement: D1Statement;
      try {
        statement = runSummaryFillStatement(id, extractRunListSummary(id, raw));
      } catch {
        result.unreadable.push(id);
        continue;
      }
      const written = await d1.query(statement.sql, statement.params);
      (written.changes > 0 ? result.filled : result.alreadyCurrent).push(id);
    }
    // RF1 has no cursor: stop when it has nothing new (runs left unfilled come back every time).
    if (picked.length < RF1_LIMIT || fresh.length === 0) return result;
  }
}

// ------------------------------------------------------------------------------------------- guard

/** Why the job must not run yet (no schema, no first copy), or null. Reads at most one row per table. */
async function firstCopyGuard(d1: D1HttpClient, dataTables: readonly string[]): Promise<string | null> {
  const required = [...new Set(["sync_state", "sync_rejects", "sync_checks", "threads", ...dataTables])].sort();
  const present = new Set(
    (
      await d1.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (SELECT value FROM json_each(?1))", [
        JSON.stringify(required),
      ])
    ).rows.map((row) => String(row.name)),
  );
  const missing = required.filter((name) => !present.has(name));
  if (missing.length > 0) {
    return `D1 has no step-2 schema yet (missing ${missing.length} tables, e.g. ${missing.slice(0, 3).join(", ")}): apply d1/migrations 0003-0006 and run the first copy first`;
  }
  const marker = (
    await d1.query(
      "SELECT (SELECT count(*) FROM sync_state WHERE name = 'supabase_in') AS watermark, " +
        `(${dataTables.map((name) => `EXISTS (SELECT 1 FROM ${name})`).join(" OR ")}) AS has_rows`,
    )
  ).rows[0];
  if (!Number(marker?.has_rows)) return "D1 is empty: the first copy (design 5.2) has not run yet";
  if (!Number(marker?.watermark)) {
    return "D1 has rows but no sync_state 'supabase_in' watermark: the first copy (design 5.2 step 7) has not finished";
  }
  return null;
}

// ------------------------------------------------------------------------------------------- run

export interface ReconcileReport {
  status: "ok" | "failed" | "skipped";
  target: TargetName;
  notice: string | null;
  fill: FillResult | null;
  checks: CheckRow[];
  failures: string[];
  warnings: string[];
  /** The short report, one line each; counts and reasons only (no keys or values: CI logs can be public). */
  lines: string[];
  usage: { d1: D1Usage; supabase: PostgrestUsage };
}

export interface ReconcileOptions {
  target: TargetName;
  d1: D1HttpClient;
  supabase: PostgrestReader;
  /** Only the summary fill (design 4.4: also run by hand). */
  fillOnly?: boolean;
  now?: () => number;
}

function fillLine(fill: FillResult): string {
  return (
    `fill (summary version ${RUN_SUMMARY_VERSION}): ${fill.filled.length} filled, ${fill.alreadyCurrent.length} already current, ` +
    `${fill.missingRaw.length} without a raw in D1${fill.missingRaw.length ? ` (${fill.missingRaw.slice(0, 5).join(", ")})` : ""}, ` +
    `${fill.unreadable.length} unreadable${fill.unreadable.length ? ` (${fill.unreadable.slice(0, 5).join(", ")})` : ""}`
  );
}

function reasonText(reasons: Record<string, number>): string {
  return Object.entries(reasons)
    .map(([reason, n]) => `${reason} ${n}`)
    .join("; ");
}

export async function runReconcile(opts: ReconcileOptions): Promise<ReconcileReport> {
  const now = opts.now ?? Date.now;
  const spec = TARGETS[opts.target];
  const env = spec.supabaseEnv;
  const report: ReconcileReport = {
    status: "ok",
    target: opts.target,
    notice: null,
    fill: null,
    checks: [],
    failures: [],
    warnings: [],
    lines: [`D1 reconcile ${opts.target}: Supabase env ${env} against D1 ${spec.databaseName}`],
    usage: { d1: opts.d1.usage, supabase: opts.supabase.usage },
  };
  const finish = () => {
    report.lines.push(
      `cost: D1 ${opts.d1.usage.queries} queries, ${opts.d1.usage.rowsRead} rows read, ${opts.d1.usage.rowsWritten} rows written; ` +
        `Supabase ${opts.supabase.usage.requests} requests, ${(opts.supabase.usage.bytes / 1_048_576).toFixed(1)} MB`,
    );
    if (report.status !== "skipped") report.status = report.failures.length > 0 ? "failed" : "ok";
    report.lines.push(
      report.status === "skipped"
        ? `result: skipped (${report.notice})`
        : report.status === "failed"
          ? `result: FAILED (${report.failures.length}: ${report.failures.join("; ")})`
          : "result: ok",
    );
    return report;
  };

  const local = openD1TestDb();
  local.exec("PRAGMA foreign_keys = OFF");
  try {
    const plan = comparePlan(local);
    const infos = new Map<string, TableInfo>();
    const info = (name: string) => {
      let entry = infos.get(name);
      if (!entry) infos.set(name, (entry = tableInfo(local, name)));
      return entry;
    };
    const dataTables = [...new Set(plan.flatMap((source) => source.parts.map((part) => part.d1Table)))];
    dataTables.forEach(info);

    const notice = await firstCopyGuard(opts.d1, dataTables);
    if (notice) {
      report.status = "skipped";
      report.notice = notice;
      return finish();
    }

    // 1. The summary fill first (design 4.4, 5.4).
    report.fill = await fillRunSummaries(opts.d1);
    report.lines.push(fillLine(report.fill));
    if (report.fill.missingRaw.length + report.fill.unreadable.length > 0) {
      report.warnings.push(`${report.fill.missingRaw.length + report.fill.unreadable.length} runs could not be filled`);
    }
    if (opts.fillOnly) return finish();

    // 2. Open rejects (S4; at most 10 are listed).
    const open = (await opts.d1.query(S4_SQL)).rows;
    if (open.length > 0) {
      const byReason = countBy(open, (row) => `${String(row.table_name)}:${String(row.reason)}`);
      report.failures.push(`open rejects ${open.length === 10 ? "10+" : open.length}`);
      report.lines.push(`open rejects: ${open.length === 10 ? "10 or more" : open.length} (${[...byReason].map(([k, n]) => `${k} ${n}`).join("; ")})`);
    } else {
      report.lines.push("open rejects: 0");
    }

    // 3. Rows, table by table (Supabase then D1 right after, so the window between the reads is short).
    const remote: SqlAll = async (sql, params) => (await opts.d1.query(sql, params)).rows;
    const localAll: SqlAll = async (sql, params) => localRows(local, sql, ...params);
    const supabaseImages = new Map<string, RowImage[]>();
    const d1Rows = new Map<string, Array<Record<string, unknown>>>();
    const partKey = (source: string, part: Part) => `${source}->${part.d1Table}`;
    let threadRows: Array<Record<string, unknown>> = [];
    // Design 5.4: once the testbed D1 is its write source (step 5), its sync is off and the env-less
    // tables (shared with production) are no longer copied into it, so they are not compared there.
    const testbedOnD1 = opts.target === "testbed" && (await opts.d1.query(SOURCE_D1_SQL)).rows.length > 0;
    if (testbedOnD1) report.lines.push(`not compared (testbed on D1 source, design 5.4): ${[...ENVLESS].join(", ")}`);
    for (const source of plan) {
      if (testbedOnD1 && ENVLESS.has(source.table)) continue;
      const query = supabaseQuery(source.table, env);
      const images = (
        await opts.supabase.selectAll(source.table, {
          select: query.select,
          filters: query.filters,
          order: SUPABASE_ORDER[source.table],
          pageSize: source.table === "runs" ? SUPABASE_RUN_PAGE : SUPABASE_PAGE,
        })
      ).map((row) => {
        if (!query.embed) return row;
        const copy = { ...row };
        delete copy[query.embed];
        return copy;
      });
      supabaseImages.set(source.table, images);
      const { rejects, orphans } = loadLocal(local, source.table, images, infos, now());
      const known: KnownKind[] = [];
      if (source.table === "defragment_bodies" && orphans > 0) known.push({ known: "orphan", count: orphans });
      if (source.table === "this_or_that_post_likes") {
        const crossEnv = await opts.supabase.selectAll(source.table, {
          select: "post_id,this_or_that_posts!inner(env)",
          filters: [
            { column: "env", op: "eq", value: env },
            { column: "this_or_that_posts.env", op: "neq", value: env },
          ],
          order: SUPABASE_ORDER[source.table],
          pageSize: SUPABASE_PAGE,
        });
        if (crossEnv.length > 0) known.push({ known: "cross_env", count: crossEnv.length });
      }
      for (const [index, part] of source.parts.entries()) {
        const partInfo = info(part.d1Table);
        const supabaseRows = await readTable(localAll, partInfo, part.filter, LOCAL_PAGE);
        const rows = await readTable(remote, partInfo, part.filter, part.d1Table in HASHED ? D1_FILE_PAGE : D1_PAGE);
        d1Rows.set(partKey(source.table, part), rows);
        const partRejects = rejects.filter((reject) => reject.d1Table === part.d1Table);
        report.checks.push(compareRows(source.table, partInfo, rows, supabaseRows, partRejects, index === 0 ? known : []));
      }
      if (source.table === "comment_likes") {
        report.checks.push(
          commentLikesCheck(
            d1Rows.get("comments->comments") ?? [],
            d1Rows.get("comment_likes->comment_likes") ?? [],
            supabaseImages.get("comments") ?? [],
            images,
          ),
        );
      }
      if (source.table === "likes") {
        threadRows = await readTable(remote, info("threads"), null, D1_PAGE);
        const rpc = await opts.supabase.rpcAll("get_engagement_counts", { p_env: env }, { order: "story_id", pageSize: SUPABASE_PAGE });
        report.checks.push(threadsCheck(threadRows, d1Rows.get("likes->likes") ?? [], d1Rows.get("comments->comments") ?? [], rpc));
      }
    }

    // 4. The run summaries: summary_version after the fill, then list inputs against today's.
    const runs = summaryCheck(
      d1Rows.get("runs->posts") ?? [],
      d1Rows.get("runs->post_history_course") ?? [],
      supabaseImages.get("runs") ?? [],
    );
    report.checks.push(runs.check);

    // 5. Report.
    const rowsChecks = report.checks.filter((check) => check.kind === "rows");
    const failing = report.checks.filter((check) => check.diff_count > 0);
    report.lines.push(
      `rows: ${rowsChecks.length} checks over ${rowsChecks.reduce((n, check) => n + check.supabase_rows, 0)} Supabase rows, ` +
        `${rowsChecks.filter((check) => check.diff_count > 0).length} with differences`,
    );
    for (const check of failing) {
      report.lines.push(`  ${check.kind} ${check.source_table} -> ${check.d1_table}: ${check.diff_count} (${reasonText(check.reasons)})`);
      report.failures.push(`${check.kind} ${check.source_table} -> ${check.d1_table}`);
    }
    report.lines.push(
      `summary: ${runs.compared} runs compared, ${runs.differing} differ; popular chips equal: latest ${runs.popularLatest}, all ${runs.popularAll}`,
    );
    report.lines.push(`summary_version 0 after the fill: ${runs.versionZero} (expected 0; below version ${RUN_SUMMARY_VERSION}: ${runs.belowVersion})`);
    if (runs.versionZero > 0) report.warnings.push(`${runs.versionZero} runs at summary_version 0 after the fill`);
    const knownKinds = report.checks.flatMap((check) => check.diff_sample.filter((entry): entry is KnownKind => "known" in entry));
    report.lines.push(
      `known kinds (not failures): orphan bodies ${knownKinds.filter((k) => k.known === "orphan").reduce((n, k) => n + k.count, 0)}, ` +
        `cross-env this-or-that likes ${knownKinds.filter((k) => k.known === "cross_env").reduce((n, k) => n + k.count, 0)}`,
    );
    const allPosts = plan
      .filter((source) => POST_TABLE_SERVICES[source.table])
      .flatMap((source) => d1Rows.get(partKey(source.table, source.parts[0])) ?? []);
    const drift = postCountDrift(allPosts, threadRows, d1Rows.get("this_or_that_post_likes->this_or_that_post_likes") ?? []);
    report.lines.push(`post and run counts against threads (reference only, tasks/010 #68): ${drift} posts differ`);

    // 6. sync_checks: one upsert for the day.
    const checkedAt = now();
    const day = new Date(checkedAt).toISOString().slice(0, 10);
    const payload = report.checks.map((check) => ({
      source_table: check.source_table,
      d1_table: check.d1_table,
      kind: check.kind,
      d1_rows: check.d1_rows,
      supabase_rows: check.supabase_rows,
      d1_hash: check.d1_hash,
      supabase_hash: check.supabase_hash,
      diff_count: check.diff_count,
      diff_sample: JSON.stringify(check.diff_sample),
    }));
    await opts.d1.query(SYNC_CHECKS_UPSERT_SQL, [day, checkedAt, JSON.stringify(payload)]);
    report.lines.push(`sync_checks: ${payload.length} rows for ${day}`);
    return finish();
  } finally {
    local.close();
  }
}

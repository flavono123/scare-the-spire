import {
  SUPABASE_TABLES,
  mapChange,
  mergeChanges,
  recountStatements,
  type ChangeEntry,
  type MapResult,
  type RowImage,
} from "../../src/lib/d1-sync/row-mapper";
import type { D1Statement, D1Value } from "../../src/lib/d1-sync/statements";
import { withTimeout, type D1Database } from "../api/d1";
import type { ExecutionContextLike } from "../api/flags";
import type { SupabaseApiConfig } from "../api/supabase-rest";
import { COMMENT_THREAD } from "./sync-sql";
import { readCurrentRow, readNewestRow, readRowsByIds } from "./supabase-reads";
import { supabaseServiceConfig, syncFlagOn, type SyncEnv } from "./sync-env";

/**
 * Read-after-write of the D1 shadow (docs/supabase-exit/D1_SCHEMA_DESIGN.md 5.3 "자기가 쓴 것 읽기"):
 * after a step-1 write succeeds on Supabase, the same request (not waitUntil) applies that row to D1
 * through the shared mapper, so the user's next request never meets D1 without it.
 *
 * - An insert is ON CONFLICT DO NOTHING: a newer row the sync already put there wins.
 * - An update writes only the columns the user changed, never the counters copied from Supabase.
 * - The row comes from the write's answer, or is re-read with the service key.
 * - A run lands without its raw and queues it (S13b); the sync fetches it.
 * - No PRAGMA defer_foreign_keys: a row whose parent D1 lacks yet fails and waits for the sync.
 * - Failures are logged only (no sync_rejects); the answer follows Supabase's result. Gated by
 *   sync.enabled like the sync itself.
 */

export type RawOp =
  /** A new row whose whole image is known (the write answered it). */
  | { op: "insert"; table: string; row: RowImage }
  /** Insert-or-update (PUT, RPC state rows): insert DO NOTHING, then the user columns. */
  | { op: "upsert"; table: string; row: RowImage; exclude?: readonly string[] }
  /** Only these user-changed columns of the row with this key. */
  | { op: "update"; table: string; key: RowImage; set: RowImage }
  | { op: "delete"; table: string; key: RowImage }
  /** Re-read the row with the service key (by key, or the newest matching row), then insert/upsert it. */
  | { op: "reread"; table: string; match: RowImage; then: "insert" | "upsert"; order?: string; exclude?: readonly string[] }
  /** Re-read rows by id (run uploads), then insert them. */
  | { op: "rereadIds"; table: string; ids: readonly string[] }
  /** A D1 statement of its own (a write that matches rows by a filter, not by key). */
  | { op: "statement"; statement: D1Statement };

export type RawContext = { env: unknown; ctx: ExecutionContextLike };

export type RawOutcome = "off" | "applied" | "skipped" | "failed";

const COPIED = new Set(SUPABASE_TABLES);

/** Statements per request: the router and the write already used a few of the 50 D1 queries. */
export const RAW_MAX_STATEMENTS = 20;
export const RAW_WAIT_MS = 2_000;
/** Largest write answer parsed for a passed-through write (CPU); bigger rows wait for the sync. */
export const RAW_BODY_MAX_BYTES = 256 * 1024;

/** Supabase counters the sync copies; read-after-write never writes them (design 5.3). */
const COUNTERS: Readonly<Record<string, readonly string[]>> = {
  chemical_posts: ["like_count", "comment_count"],
  combo_posts: ["like_count", "comment_count"],
  transfigure_posts: ["like_count", "comment_count"],
  decisions_decisions_posts: ["like_count", "comment_count"],
  pagestorm_posts: ["like_count", "comment_count"],
  this_or_that_posts: ["like_count", "comment_count", "left_vote_count", "right_vote_count", "vote_rate_bps"],
  favorite_tournament_posts: ["like_count", "comment_count", "play_count"],
  runs: ["like_count", "comment_count"],
};

/** Supabase key columns per table (the mapper's key, in Supabase names). */
const KEYS: Readonly<Record<string, readonly string[]>> = {
  comment_likes: ["comment_id", "user_id"],
  likes: ["story_id", "user_id"],
  resource_reactions: ["resource_id", "resource_type", "game_version", "user_id"],
  this_or_that_post_votes: ["post_id", "user_id"],
  this_or_that_post_likes: ["post_id", "user_id"],
  defragment_bodies: ["source_service", "source_id"],
  puzzlebox_players: ["user_id"],
  puzzlebox_best: ["game", "board", "user_id"],
};

function keyColumns(table: string): readonly string[] {
  return KEYS[table] ?? ["id"];
}

/** The insert-only form of a mapper upsert: DO NOTHING on conflict, no child-row replacement. */
export function insertOnly(statements: readonly D1Statement[]): D1Statement[] {
  return statements
    .filter((statement) => !/^DELETE FROM post_\w+_(?:resources|pool) /.test(statement.sql))
    .map((statement) => ({
      ...statement,
      sql: statement.sql.replace(/ ON CONFLICT \(([^)]*)\) DO UPDATE SET [\s\S]*$/, " ON CONFLICT ($1) DO NOTHING"),
      zeroRows: undefined,
    }));
}

function mapEntry(entry: ChangeEntry): MapResult | null {
  const merged = mergeChanges([entry]);
  const change = merged.changes[0];
  if (!change) return null;
  return mapChange(change, { nowMs: Date.now() });
}

/** The columns an update may write: the row without its key, the copied counters and `exclude`. */
export function userColumns(table: string, row: RowImage, exclude: readonly string[] = []): RowImage {
  const drop = new Set([...keyColumns(table), ...(COUNTERS[table] ?? []), ...exclude]);
  return Object.fromEntries(Object.entries(row).filter(([column]) => !drop.has(column)));
}

function keyOf(table: string, row: RowImage): RowImage {
  return Object.fromEntries(keyColumns(table).map((column) => [column, row[column]]));
}

type Planned = { statements: D1Statement[]; skipped: number };

function statementsFor(op: Exclude<RawOp, { op: "reread" | "rereadIds" }>, commentThread?: string): D1Statement[] | null {
  switch (op.op) {
    case "insert": {
      const mapped = mapEntry({ id: 0, table: op.table, op: "I", newRow: op.row });
      if (!mapped?.ok) return null;
      return [...insertOnly(mapped.statements), ...recountStatements(mapped.touched, Date.now())];
    }
    case "upsert": {
      const inserted = mapEntry({ id: 0, table: op.table, op: "I", newRow: op.row });
      if (!inserted?.ok) return null;
      const set = userColumns(op.table, op.row, op.exclude);
      const updated = Object.keys(set).length > 0
        ? mapEntry({ id: 0, table: op.table, op: "U", newRow: { ...keyOf(op.table, op.row), ...set } })
        : null;
      if (updated && !updated.ok) return null;
      return [
        ...insertOnly(inserted.statements),
        ...(updated?.ok ? updated.statements.map((statement) => ({ ...statement, zeroRows: undefined })) : []),
        ...recountStatements(inserted.touched, Date.now()),
      ];
    }
    case "update": {
      const mapped = mapEntry({ id: 0, table: op.table, op: "U", newRow: { ...op.key, ...op.set } });
      if (!mapped?.ok) return null;
      return [...mapped.statements.map((statement) => ({ ...statement, zeroRows: undefined })), ...recountStatements(mapped.touched, Date.now())];
    }
    case "delete": {
      const oldRow = commentThread !== undefined ? { ...op.key, story_id: commentThread } : op.key;
      const mapped = mapEntry({ id: 0, table: op.table, op: "D", oldRow });
      if (!mapped?.ok) return null;
      return [...mapped.statements, ...recountStatements(mapped.touched, Date.now())];
    }
    case "statement":
      return [op.statement];
  }
}

async function resolveOps(ops: readonly RawOp[], config: SupabaseApiConfig | null, deadline: number): Promise<Array<Exclude<RawOp, { op: "reread" | "rereadIds" }> | null>> {
  const out = await Promise.all(ops.map(async (op) => {
    if (op.op !== "reread" && op.op !== "rereadIds") return [op];
    if (!config) return [null];
    if (op.op === "rereadIds") {
      if (op.ids.length === 0) return [];
      const rows = await readRowsByIds(config, op.table, op.ids, { deadline });
      if (!rows.ok) return [null];
      return (rows.data ?? []).map((row) => ({ op: "insert" as const, table: op.table, row }));
    }
    const read = op.order
      ? await readNewestRow(config, op.table, op.match as Record<string, D1Value>, op.order, { deadline })
      : await readCurrentRow(config, op.table, op.match as Record<string, D1Value>, { deadline });
    if (!read.ok) return [null];
    if (!read.data) return [];
    return [op.then === "insert"
      ? { op: "insert" as const, table: op.table, row: read.data }
      : { op: "upsert" as const, table: op.table, row: read.data, exclude: op.exclude }];
  }));
  return out.flat();
}

async function plan(db: D1Database, ops: readonly RawOp[], config: SupabaseApiConfig | null, deadline: number): Promise<Planned & { unmapped: number }> {
  const resolved = await resolveOps(ops, config, deadline);
  const statements: D1Statement[] = [];
  let skipped = 0;
  let unmapped = 0;
  for (const op of resolved) {
    if (!op) {
      unmapped += 1;
      continue;
    }
    let thread: string | undefined;
    if (op.op === "delete" && op.table === "comments" && typeof op.key.story_id !== "string") {
      const row = await db.prepare(COMMENT_THREAD).bind(op.key.id).first<{ story_id?: string }>();
      thread = row?.story_id;
    }
    const next = statementsFor(op, thread);
    if (!next) {
      unmapped += 1;
      continue;
    }
    if (statements.length + next.length > RAW_MAX_STATEMENTS) {
      skipped += 1;
      continue;
    }
    statements.push(...next);
  }
  return { statements, skipped, unmapped };
}

/**
 * Applies `ops` to D1 after a successful Supabase write. Never throws, never changes the answer:
 * every failure (mapper reject, FK or CHECK error, timeout, Supabase re-read error) is logged only,
 * and the 1-minute sync brings the row from the change log.
 */
export async function readAfterWrite(context: RawContext, label: string, ops: RawOp[] | (() => RawOp[])): Promise<RawOutcome> {
  const env = context.env as SyncEnv;
  try {
    if (!(await syncFlagOn(env))) return "off";
    const db = env.DB as D1Database;
    // Tables the shadow does not copy (design 7, e.g. defragment_posts) have nothing to apply.
    const list = (typeof ops === "function" ? ops() : ops).filter((op) => op.op === "statement" || COPIED.has(op.table));
    if (list.length === 0) return "skipped";
    const deadline = Date.now() + RAW_WAIT_MS;
    const { statements, skipped, unmapped } = await plan(db, list, supabaseServiceConfig(env), deadline);
    if (unmapped || skipped) console.log(`raw ${label} unmapped=${unmapped} skipped=${skipped}`);
    if (statements.length === 0) return unmapped || skipped ? "skipped" : "applied";
    const batch = db.batch(statements.map((statement) => db.prepare(statement.sql).bind(...statement.params)));
    context.ctx.waitUntil(batch.catch(() => undefined));
    await withTimeout(batch, Math.max(100, deadline - Date.now()));
    return "applied";
  } catch (error) {
    // FK and CHECK errors are expected (a parent the sync has not brought yet); never logged with row data.
    const message = String((error as { message?: unknown })?.message ?? error);
    const kind = /FOREIGN KEY/i.test(message) ? "fk" : /constraint|too big|cannot store/i.test(message) ? "check" : "error";
    console.log(`raw ${label} failed ${kind}`);
    return "failed";
  }
}

/** Reads a write's JSON answer from a clone (the original still goes to the client), at most `max` bytes. */
async function readClone(upstream: Response, max: number): Promise<unknown[] | null> {
  const declared = Number(upstream.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > max) return null;
  const copy = upstream.clone();
  if (!copy.body) return null;
  const reader = copy.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      void reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  return Array.isArray(parsed) ? parsed : null;
}

/**
 * Read-after-write for a write whose answer is passed through unparsed (posts, drafts, bodies):
 * the row is read from a clone of the answer, under RAW_BODY_MAX_BYTES.
 */
export async function readAfterWriteFromAnswer(
  context: RawContext,
  label: string,
  upstream: Response,
  build: (row: RowImage) => RawOp[],
): Promise<RawOutcome> {
  const env = context.env as SyncEnv;
  try {
    if (!(await syncFlagOn(env))) return "off";
    const rows = await readClone(upstream, RAW_BODY_MAX_BYTES);
    const row = rows?.[0];
    if (!row || typeof row !== "object") {
      console.log(`raw ${label} skipped answer`);
      return "skipped";
    }
    return readAfterWrite(context, label, build(row as RowImage));
  } catch {
    console.log(`raw ${label} failed answer`);
    return "failed";
  }
}

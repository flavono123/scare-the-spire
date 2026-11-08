import { canonicalTs } from "../../src/lib/d1-time";
import {
  POST_TABLE_SERVICES,
  SUPABASE_TABLES,
  mapChange,
  mapDelete,
  mapRow,
  mergeChanges,
  mergeTouched,
  recountStatements,
  rejectStatement,
  supabaseKeyOf,
  type ChangeEntry,
  type ChangeOp,
  type MapReject,
  type MapResult,
  type MergedChange,
  type RejectReason,
  type RowImage,
  type Touched,
} from "../../src/lib/d1-sync/row-mapper";
import type { D1Statement, D1Value } from "../../src/lib/d1-sync/statements";
import type { D1Database, D1Result } from "../api/d1";
import type { Fetcher, SupabaseApiConfig } from "../api/supabase-rest";
import { supabaseServiceConfig, syncDisabledReason, type SyncEnv } from "./sync-env";
import {
  COMMENT_THREAD,
  DEFER_FOREIGN_KEYS,
  OPEN_KEYS,
  RAW_FAIL,
  RUN_FAIL,
  S1,
  S13,
  S13C,
  S13D,
  S4,
  SYNC_GATE,
  resolveStatement,
  s11Statement,
} from "./sync-sql";
import {
  deleteOldLogRows,
  fetchRunRaw,
  postExists,
  readCurrentRow,
  readCutoffId,
  readLogBodies,
  readLogHeaders,
  readPostEnv,
  type LogBody,
  type LogHeader,
} from "./supabase-reads";

/**
 * The 1-minute sync of the D1 shadow (docs/supabase-exit/D1_SCHEMA_DESIGN.md 5.3): Supabase stays the
 * source of truth; every minute this applies new d1_change_log rows to D1 inside one Workers Free
 * invocation (50 D1 queries, 50 subrequests, 10 ms CPU), cut by a budget rather than a row count.
 *
 * Order of a run: gate (flag, handed-over watermark) -> lease S1 with S4 and S13 -> open rejects
 * retried by re-reading the current row -> at most 2 queued run raws -> new and late log rows (headers,
 * then bodies under 512 KB) -> merge per key -> budget cut -> one batch (defer FKs, S11 last), halved
 * on a constraint error -> 0-row follow-ups -> the daily cleanup.
 */

export const LEASE_MS = 55_000;
/** Every Supabase call of a run must be done by then, well inside the lease. */
export const RUN_DEADLINE_MS = 40_000;
/** D1 statements per run (design 5.3: 45 with a margin of 5 under the 50-query limit). */
export const MAX_D1_STATEMENTS = 45;
/** The main batch, PRAGMA and S11 included. */
export const MAIN_BATCH_MAX = 35;
/** Statements kept back for the follow-ups of the main batch (0-row re-reads, rejects, a failure note). */
export const FOLLOW_UP_RESERVE = 4;
export const RETRY_STATEMENTS_MAX = 8;
/** Re-reads of rejects and failures (design 5.3: at most 10). */
export const REREADS_MAX = 10;
export const RAWS_PER_RUN = 2;
export const RAW_BYTES_PER_RUN = 2 * 1024 * 1024;
export const HEADER_LIMIT = 100;
export const BODY_BYTES_MAX = 512 * 1024;
export const APPLIED_MAX = 2000;
/** A late commit older than this is impossible: the watermark may pass id gaps behind it. */
export const LATE_MS = 5 * 60_000;
export const LAG_ALERT_MS = 2 * 60_000;
export const REJECT_ATTEMPTS_MAX = 10;
/**
 * Reasons whose current Supabase row fails a D1 CHECK: the only rejects the attempt limit stops
 * (design 5.3 item 1); they wait for the user. fk and zero_rows are retried every run.
 */
const DETERMINISTIC_REASONS: ReadonlySet<string> = new Set(["bad_timestamp", "bad_element", "check"]);
export const CLEANUP_AGE_MS = 7 * 24 * 60 * 60_000;
/** Minute of the UTC day of the daily log cleanup: 19:00 UTC is 04:00 in Korea. */
export const CLEANUP_MINUTE_UTC = 19 * 60;
const PAYLOAD_MAX_CHARS = 8 * 1024;

/** FK children whose parent post can sit in another env in Supabase (design 2.2, 5.2). */
const PARENTS: Readonly<Record<string, { table: string; column: string }>> = {
  this_or_that_post_votes: { table: "this_or_that_posts", column: "post_id" },
  this_or_that_post_likes: { table: "this_or_that_posts", column: "post_id" },
  favorite_tournament_candidate_stats: { table: "favorite_tournament_posts", column: "tournament_id" },
  favorite_tournament_plays: { table: "favorite_tournament_posts", column: "tournament_id" },
};

const POST_TABLE_OF_SERVICE: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(POST_TABLE_SERVICES).map(([table, service]) => [service, table]),
);

const KNOWN_TABLES = new Set(SUPABASE_TABLES);

export type SyncStatus = "off" | "flag_off" | "not_started" | "not_configured" | "lease_held" | "ok" | "failed";

export type SyncReport = {
  status: SyncStatus;
  /** D1 statements sent (each statement of a batch counts, as D1 counts them). */
  statements: number;
  /** fetch calls to Supabase. */
  subrequests: number;
  rawBytes: number;
  /** Change-log ids committed this run (applied, folded or rejected). */
  processed: number[];
  rejects: Array<{ ref: number; table: string; reason: string; closed: boolean }>;
  retries: Array<{ ref: number; outcome: "resolved" | "open" | "skipped" }>;
  raws: Array<{ id: string; outcome: "stored" | "gone" | "failed" | "deferred"; bytes?: number }>;
  window: { low: number; high: number; applied: number[] } | null;
  lagMs: number;
  cleanup: boolean;
  error?: string;
};

export type SyncOptions = {
  now?: () => number;
  /** The cron's scheduledTime (ms): picks the daily cleanup minute. */
  scheduledTime?: number;
  fetcher?: Fetcher;
  log?: (line: string) => void;
};

type Item = {
  kind: "apply" | "reject" | "fold";
  ids: number[];
  change?: MergedChange;
  statements: D1Statement[];
  touched: Touched;
  reject?: { reason: string; closed: boolean; table: string };
};

const NO_TOUCH: Touched = { threadComments: [], threadLikes: [], commentLikes: [] };

class TransientError extends Error {}

/** fk, check (deterministic: halve, then reject) or transient (stop the run). */
export function classifyD1Error(error: unknown): "fk" | "check" | "transient" {
  const message = String((error as { message?: unknown })?.message ?? error);
  if (/FOREIGN KEY constraint failed/i.test(message)) return "fk";
  if (/constraint failed|SQLITE_CONSTRAINT|SQLITE_TOOBIG|too big|cannot store|datatype mismatch/i.test(message)) return "check";
  return "transient";
}

function shortError(error: unknown): string {
  return String((error as { message?: unknown })?.message ?? error).replace(/\s+/g, " ").slice(0, 200);
}

/**
 * sync_rejects is keyed by (direction, ref): the reject row of this change-log id exists already,
 * because the id was processed before (a window handed over again, or a run whose S11 lost the
 * lease). The id is done; re-applying a window stays idempotent (design 5.2 step 7).
 */
function rejectRefTaken(error: unknown): boolean {
  return /UNIQUE constraint failed: sync_rejects\.direction, sync_rejects\.ref/i.test(String((error as { message?: unknown })?.message ?? error));
}

/** Unix ms of a PostgREST timestamp, or NaN. */
export function timestampMs(text: string): number {
  const ts = canonicalTs(text);
  return ts ? Date.parse(`${ts.slice(0, 23)}Z`) : Number.NaN;
}

function opLetter(change: MergedChange): ChangeOp {
  return change.action === "upsert" ? "I" : change.action === "update" ? "U" : "D";
}

function diagnosisPayload(change: MergedChange | undefined, ids: number[]): unknown {
  if (!change) return { ids };
  const image = change.image ?? change.priorImages[0] ?? null;
  const text = image ? JSON.stringify(image) : "";
  if (text.length <= PAYLOAD_MAX_CHARS) return { ids, image };
  return { ids, columns: Object.keys(image ?? {}), truncated: true };
}

function keyText(table: string, rowKey: string): string {
  return `${table}\u0000${rowKey}`;
}

export async function runSync(env: SyncEnv, options: SyncOptions = {}): Promise<SyncReport> {
  const report: SyncReport = {
    status: "off",
    statements: 0,
    subrequests: 0,
    rawBytes: 0,
    processed: [],
    rejects: [],
    retries: [],
    raws: [],
    window: null,
    lagMs: 0,
    cleanup: false,
  };
  if (syncDisabledReason(env)) return report;
  const db = env.DB as D1Database;
  const now = options.now ?? Date.now;
  const log = options.log ?? ((line: string) => console.log(line));

  report.statements += 1;
  const gate = await db.prepare(SYNC_GATE).first<{ flag?: unknown; started?: unknown; last_error?: unknown }>();
  if (gate?.flag !== "on") return { ...report, status: "flag_off" };
  if (!gate.started) return { ...report, status: "not_started" };
  const config = supabaseServiceConfig(env);
  if (!config) {
    log("sync not_configured");
    return { ...report, status: "not_configured" };
  }

  const startedAt = now();
  const leaseUntil = startedAt + LEASE_MS;
  report.statements += 4;
  const [lease, open, openKeys, pending] = await db.batch([
    db.prepare(S1).bind("supabase_in", leaseUntil, startedAt),
    db.prepare(S4),
    db.prepare(OPEN_KEYS),
    db.prepare(S13),
  ]);
  const leaseRow = lease.results[0] as { low_watermark: number; high_seen: number; applied_above: string } | undefined;
  if (!leaseRow) return { ...report, status: "lease_held" };

  const run = new SyncRun(db, config, report, {
    now,
    log,
    fetcher: options.fetcher,
    // Wall clock: the PostgREST helpers compare deadlines with Date.now().
    deadline: Date.now() + RUN_DEADLINE_MS,
    leaseUntil,
    low: Number(leaseRow.low_watermark),
    high: Number(leaseRow.high_seen),
    applied: (JSON.parse(leaseRow.applied_above) as number[]).map(Number),
    openKeys: (openKeys.results as Array<{ table_name: string; row_key: string }>).map((row) => keyText(row.table_name, row.row_key)),
    split: parseSplitNote(gate.last_error),
  });
  report.status = "ok";
  try {
    await run.retryRejects(open.results as RejectRow[]);
    await run.fetchRaws(pending.results as Array<{ post_id: string; attempts: number }>);
    await run.applyLog();
    await run.cleanup(options.scheduledTime ?? startedAt);
  } catch (error) {
    report.status = "failed";
    report.error = shortError(error);
    log(`sync failed ${report.error}`);
    await run.recordFailure(report.error);
  }
  if (report.lagMs > LAG_ALERT_MS) log(`sync lag_ms=${report.lagMs} over ${LAG_ALERT_MS}`);
  return report;
}

type RejectRow = {
  direction: string;
  ref: number;
  table_name: string;
  d1_table: string;
  row_key: string;
  op: string;
  reason: string;
  attempts: number;
};

type RunInit = {
  now: () => number;
  log: (line: string) => void;
  fetcher?: Fetcher;
  deadline: number;
  leaseUntil: number;
  low: number;
  high: number;
  applied: number[];
  openKeys: string[];
  /** The last run's failing batch that it had no budget left to split. */
  split: { firstId: number; items: number } | null;
};

/**
 * A run whose first batch fails and leaves too little budget to halve it notes the failing prefix
 * in sync_state.last_error; the next run starting at the same id tries half of it first. Without
 * this, every run would retry the same full batch and the watermark would never move.
 */
export function splitNote(firstId: number, items: number): string {
  return `split:${firstId}:${items}`;
}

function parseSplitNote(value: unknown): { firstId: number; items: number } | null {
  const match = typeof value === "string" ? /^split:(\d+):(\d+)$/.exec(value) : null;
  return match ? { firstId: Number(match[1]), items: Number(match[2]) } : null;
}

class SyncRun {
  private readonly low: number;
  private readonly high: number;
  private readonly applied: readonly number[];
  private readonly openKeys: Set<string>;
  private readonly processed = new Set<number>();
  /** Every log id the header read returned this run. */
  private readonly seen = new Set<number>();
  private readonly changedAt = new Map<number, number>();
  private cutoff: number | null = null;
  private rereads = 0;
  private retryStatements = 0;
  private stopped = false;
  /** A slice known to hold a failing change that this run had no budget left to split. */
  private note: { firstId: number; items: number } | null = null;

  constructor(
    private readonly db: D1Database,
    private readonly config: SupabaseApiConfig,
    private readonly report: SyncReport,
    private readonly init: RunInit,
  ) {
    this.low = init.low;
    this.high = init.high;
    this.applied = init.applied;
    this.openKeys = new Set(init.openKeys);
  }

  private get nowMs(): number {
    return this.init.now();
  }

  private readOptions() {
    this.report.subrequests += 1;
    return { deadline: this.init.deadline, fetcher: this.init.fetcher };
  }

  private budgetLeft(): number {
    return MAX_D1_STATEMENTS - this.report.statements;
  }

  private async batch(statements: readonly D1Statement[]): Promise<D1Result[]> {
    this.report.statements += statements.length;
    return this.db.batch(statements.map((statement) => this.db.prepare(statement.sql).bind(...statement.params)));
  }

  private canReread(count = 1): boolean {
    return this.rereads + count <= REREADS_MAX;
  }

  // ---------------------------------------------------------------- 1. rejects first

  async retryRejects(rows: readonly RejectRow[]): Promise<void> {
    for (const row of rows) {
      if (row.direction !== "in") continue;
      const exhausted = Number(row.attempts) >= REJECT_ATTEMPTS_MAX && DETERMINISTIC_REASONS.has(row.reason);
      if (exhausted || !KNOWN_TABLES.has(row.table_name)) {
        this.report.retries.push({ ref: row.ref, outcome: "skipped" });
        continue;
      }
      const outcome = await this.retryOne(row);
      if (outcome === "stop") break;
      this.report.retries.push({ ref: row.ref, outcome });
      if (outcome === "resolved") this.openKeys.delete(keyText(row.table_name, row.row_key));
    }
  }

  private async retryOne(row: RejectRow): Promise<"resolved" | "open" | "skipped" | "stop"> {
    const table = row.table_name;
    const rowKey = JSON.parse(row.row_key) as Record<string, D1Value>;
    const match = supabaseKeyOf(table, rowKey);
    if (Object.keys(match).length === 0 || Object.values(match).some((value) => value === null)) return "skipped";
    const parent = PARENTS[table];
    const reads = parent ? 2 : 1;
    if (!this.canReread(reads)) return "stop";
    this.rereads += reads;
    const [current, parentEnv] = await Promise.all([
      readCurrentRow(this.config, table, match, this.readOptions()),
      parent ? readPostEnv(this.config, parent.table, String(match[parent.column]), this.readOptions()) : null,
    ]);
    if (!current.ok || (parentEnv && !parentEnv.ok)) return "stop";
    const ctx = { nowMs: this.nowMs, ...(parentEnv?.ok ? { parentEnv: parentEnv.data } : {}) };
    let mapped: MapResult;
    if (current.data) {
      mapped = mapRow(table, current.data, ctx);
    } else {
      // Gone from Supabase: delete by key (cascades included); the reject closes itself.
      mapped = mapDelete(table, await this.deleteImage(table, match), ctx);
    }
    if (!mapped.ok) return this.reopenOrClose(row, mapped.reject, mapped.reject.reason === "cross_env");
    const statements = [...mapped.statements, ...recountStatements(mapped.touched, this.nowMs)];
    if (this.retryStatements + statements.length + 1 > RETRY_STATEMENTS_MAX || statements.length + 1 > this.budgetLeft()) {
      return "stop";
    }
    this.retryStatements += statements.length + 1;
    let results: D1Result[];
    try {
      results = await this.batch(statements);
    } catch (error) {
      const kind = classifyD1Error(error);
      if (kind === "transient") throw error;
      return this.reopenOrClose(row, {
        reason: kind,
        error: shortError(error),
        table,
        d1Table: row.d1_table,
        rowKey,
      }, false);
    }
    const zero = zeroRowKinds(statements, results);
    if (zero.has("orphan")) {
      // 조각모음 body whose post is not in D1: an orphan when Supabase has no post either.
      const orphan = await this.isOrphan(rowKey);
      if (orphan === null) return "open";
      return this.reopenOrClose(row, {
        reason: orphan ? "orphan" as RejectReason : "zero_rows" as RejectReason,
        error: orphan ? "no post in Supabase" : "post not in D1 yet",
        table,
        d1Table: row.d1_table,
        rowKey,
      }, orphan);
    }
    await this.batch([resolveStatement(row.ref, this.nowMs)]);
    return "resolved";
  }

  /** Re-records a reject (attempts + 1), or closes it for the known kinds (cross_env, orphan). */
  private async reopenOrClose(row: RejectRow, reject: MapReject | (Omit<MapReject, "reason"> & { reason: string }), close: boolean) {
    const statements = [
      rejectStatement(reject as MapReject, { ref: row.ref, op: row.op, payload: { ref: row.ref }, nowMs: this.nowMs }),
      ...(close ? [resolveStatement(row.ref, this.nowMs)] : []),
    ];
    if (statements.length > this.budgetLeft()) return "stop" as const;
    this.retryStatements += statements.length;
    await this.batch(statements);
    return close ? "resolved" as const : "open" as const;
  }

  /** The old image a delete needs: the key, plus a comment's thread key from D1 (for its recount). */
  private async deleteImage(table: string, match: Record<string, D1Value>): Promise<RowImage> {
    if (table !== "comments" || this.budgetLeft() < 2) return { ...match };
    this.report.statements += 1;
    const row = await this.db.prepare(COMMENT_THREAD).bind(match.id).first<{ story_id?: string }>();
    return row?.story_id !== undefined ? { ...match, story_id: row.story_id } : { ...match };
  }

  /** true: no post in Supabase either; false: the post exists; null: could not tell. */
  private async isOrphan(rowKey: Record<string, D1Value>): Promise<boolean | null> {
    const postTable = POST_TABLE_OF_SERVICE[String(rowKey.service)];
    if (!postTable) return true;
    if (!this.canReread()) return null;
    this.rereads += 1;
    const exists = await postExists(this.config, postTable, String(rowKey.post_id), this.readOptions());
    return exists.ok ? !exists.data : null;
  }

  // ---------------------------------------------------------------- 9. raws

  async fetchRaws(rows: ReadonlyArray<{ post_id: string; attempts: number }>): Promise<void> {
    for (const row of rows.slice(0, RAWS_PER_RUN)) {
      const cap = RAW_BYTES_PER_RUN - this.report.rawBytes;
      if (cap <= 0 || this.budgetLeft() < 2 + FOLLOW_UP_RESERVE) {
        this.report.raws.push({ id: row.post_id, outcome: "deferred" });
        continue;
      }
      const raw = await fetchRunRaw(this.config, row.post_id, cap, this.readOptions());
      if (!raw.ok) {
        if (raw.code === "too_large" && this.report.rawBytes > 0) {
          // It may fit alone: the next run fetches it first.
          this.report.raws.push({ id: row.post_id, outcome: "deferred" });
          continue;
        }
        await this.batch([{ sql: RAW_FAIL, params: [row.post_id, `fetch:${raw.code}`, this.nowMs] }]);
        this.report.raws.push({ id: row.post_id, outcome: "failed" });
        continue;
      }
      if (raw.text === "") {
        // No such run in this env any more: the queue row goes (S13c would store nothing).
        await this.batch([{ sql: S13D, params: [row.post_id] }]);
        this.report.raws.push({ id: row.post_id, outcome: "gone" });
        continue;
      }
      try {
        await this.batch([
          { sql: S13C, params: [row.post_id, raw.text] },
          { sql: S13D, params: [row.post_id] },
        ]);
        this.report.rawBytes += raw.bytes;
        this.report.raws.push({ id: row.post_id, outcome: "stored", bytes: raw.bytes });
      } catch (error) {
        if (classifyD1Error(error) === "transient") throw error;
        await this.batch([{ sql: RAW_FAIL, params: [row.post_id, `store:${shortError(error)}`, this.nowMs] }]);
        this.report.raws.push({ id: row.post_id, outcome: "failed" });
      }
    }
  }

  // ---------------------------------------------------------------- 2-8, 10. the log

  async applyLog(): Promise<void> {
    // At 2,000 ids in applied_above high_seen stops moving: read only inside the window.
    const roomForIds = APPLIED_MAX - this.applied.length;
    const headersRead = await readLogHeaders(
      this.config,
      {
        low: this.low,
        applied: this.applied,
        limit: HEADER_LIMIT,
        ...(roomForIds < HEADER_LIMIT ? { upTo: this.high } : {}),
      },
      this.readOptions(),
    );
    if (!headersRead.ok) throw new TransientError(`log headers ${headersRead.code}`);
    const headers = headersRead.data ?? [];
    for (const header of headers) {
      this.seen.add(header.id);
      this.changedAt.set(header.id, timestampMs(header.changed_at));
    }
    const chosen = chooseByBytes(headers, BODY_BYTES_MAX, Math.max(0, roomForIds));
    const topId = Math.max(this.high, ...chosen.map((header) => header.id));
    const needCutoff = this.applied.length > 0 || chosen.length > 0;
    const before = new Date(this.nowMs - LATE_MS).toISOString();
    const chosenBytes = chosen.reduce((sum, header) => sum + Number(header.row_bytes), 0);
    const [bodiesRead, cutoffRead] = await Promise.all([
      chosen.length > 0
        ? readLogBodies(this.config, chosen.map((header) => header.id), Math.ceil(chosenBytes * 1.1) + 64 * 1024, this.readOptions())
        : null,
      needCutoff ? readCutoffId(this.config, { low: this.low, high: topId }, before, this.readOptions()) : null,
    ]);
    if (cutoffRead && !cutoffRead.ok) throw new TransientError(`log cutoff ${cutoffRead.code}`);
    this.cutoff = cutoffRead?.ok ? cutoffRead.data : null;
    if (bodiesRead && !bodiesRead.ok) throw new TransientError(`log bodies ${bodiesRead.code}`);
    const bodies = bodiesRead?.ok ? bodiesRead.data ?? [] : [];

    const items = this.buildItems(bodies);
    const cut = this.cutToBudget(items);
    if (cut.length > 0) {
      // The last run left a failing slice here unsplit: go on splitting it instead of retrying it whole.
      const split = this.init.split;
      if (split && cut[0].ids[0] === split.firstId && cut.length >= split.items) {
        await this.attempt(cut.slice(0, split.items), true);
      } else {
        await this.attempt(cut, false);
      }
      if (this.note) {
        const note = splitNote(this.note.firstId, this.note.items);
        this.report.error = note;
        await this.recordFailure(note);
      }
    } else {
      await this.commitWindowOnly();
    }
  }

  private buildItems(bodies: readonly LogBody[]): Item[] {
    const items: Item[] = [];
    const entries: ChangeEntry[] = [];
    for (const body of bodies) {
      if (!KNOWN_TABLES.has(body.table_name) || !["I", "U", "D"].includes(body.op)) {
        items.push(this.rejectItem([body.id], {
          reason: "check",
          error: `no D1 mapper for ${body.table_name} ${body.op}`,
          table: body.table_name,
          d1Table: "",
          rowKey: null,
        }, undefined, body.op));
        continue;
      }
      entries.push({
        id: Number(body.id),
        table: body.table_name,
        op: body.op as ChangeOp,
        newRow: body.new_row,
        oldRow: body.old_row,
        heavyChanged: Boolean(body.heavy_changed),
      });
    }
    const merged = mergeChanges(entries);
    for (const reject of merged.rejects) items.push(this.rejectItem(reject.ids, reject, undefined, "?"));
    for (const change of merged.changes) {
      if (this.openKeys.has(keyText(change.table, change.keyText))) {
        // The reject's re-read already holds this change.
        items.push({ kind: "fold", ids: change.ids, change, statements: [], touched: NO_TOUCH });
        continue;
      }
      const mapped = mapChange(change, { nowMs: this.nowMs });
      if (mapped.ok) {
        items.push({ kind: "apply", ids: change.ids, change, statements: mapped.statements, touched: mapped.touched });
      } else {
        items.push(this.rejectItem(change.ids, mapped.reject, change, opLetter(change)));
      }
    }
    return items.sort((a, b) => a.ids[0] - b.ids[0]);
  }

  private rejectItem(
    ids: number[],
    reject: MapReject | (Omit<MapReject, "reason"> & { reason: string }),
    change: MergedChange | undefined,
    op: string,
  ): Item {
    const closed = reject.reason === "cross_env" || reject.reason === "orphan";
    const ref = ids[0];
    const statements = [
      rejectStatement(reject as MapReject, { ref, op, payload: diagnosisPayload(change, ids), nowMs: this.nowMs }),
      ...(closed ? [resolveStatement(ref, this.nowMs)] : []),
    ];
    return { kind: "reject", ids, change, statements, touched: NO_TOUCH, reject: { reason: reject.reason, closed, table: reject.table } };
  }

  /**
   * The prefix of items (first-id order) whose mapper statements and recounts (E13a, E13b, E14),
   * with PRAGMA and S11, fit the main batch (design 5.3 item 5).
   */
  private cutToBudget(items: readonly Item[]): Item[] {
    const limit = Math.min(MAIN_BATCH_MAX, this.budgetLeft() - FOLLOW_UP_RESERVE);
    const room = APPLIED_MAX - this.applied.length;
    const recounted = [new Set<string>(), new Set<string>(), new Set<string>()];
    const out: Item[] = [];
    let size = 2;
    let ids = 0;
    for (const item of items) {
      const lists = [item.touched.threadComments, item.touched.threadLikes, item.touched.commentLikes];
      let add = item.statements.length;
      lists.forEach((list, i) => {
        for (const key of new Set(list)) if (!recounted[i].has(key)) add += 1;
      });
      if (size + add > limit || ids + item.ids.length > room) break;
      lists.forEach((list, i) => list.forEach((key) => recounted[i].add(key)));
      out.push(item);
      size += add;
      ids += item.ids.length;
    }
    return out;
  }

  /** The window after `extra` ids are committed too (design 5.3 item 10). */
  private windowAfter(extra: readonly number[]): { low: number; high: number; applied: number[] } {
    const done = new Set([...this.processed, ...extra]);
    let high = this.high;
    for (const id of done) if (id > high) high = id;
    let firstOpen = Number.POSITIVE_INFINITY;
    for (const id of this.seen) if (!done.has(id) && id < firstOpen) firstOpen = id;
    const cutoff = this.cutoff ?? this.low;
    const low = Math.max(this.low, Math.min(cutoff, firstOpen - 1, high));
    const applied = [...new Set([...this.applied, ...done])].filter((id) => id > low).sort((a, b) => a - b);
    return { low, high, applied };
  }

  private lagOf(ids: readonly number[]): number {
    let lag = this.report.lagMs;
    const now = this.nowMs;
    for (const id of ids) {
      const at = this.changedAt.get(id);
      if (at !== undefined && Number.isFinite(at)) lag = Math.max(lag, now - at);
    }
    return lag;
  }

  private s11For(extraIds: readonly number[], batchLength: number): D1Statement {
    const window = this.windowAfter(extraIds);
    return s11Statement({
      ...window,
      appliedAt: this.nowMs,
      lagMs: this.lagOf([...this.processed, ...extraIds]),
      statements: this.report.statements + batchLength,
      subrequests: this.report.subrequests,
      rawBytes: this.report.rawBytes,
      leaseUntil: this.init.leaseUntil,
    });
  }

  private commitDone(ids: readonly number[]) {
    for (const id of ids) {
      this.processed.add(id);
      this.report.processed.push(id);
    }
    this.report.lagMs = this.lagOf(ids);
    this.report.window = this.windowAfter([]);
  }

  /** Watermark absorption with nothing to apply (the window ages past the 5-minute rule). */
  private async commitWindowOnly(): Promise<void> {
    const window = this.windowAfter([]);
    const sameApplied = window.applied.length === this.applied.length && window.applied.every((id, i) => id === this.applied[i]);
    if (window.low === this.low && window.high === this.high && sameApplied) return;
    if (this.budgetLeft() < 1) return;
    await this.batch([this.s11For([], 1)]);
    this.report.window = window;
  }

  /**
   * One batch; halves on a constraint error down to one change (design 5.3 items 6 and 7).
   * `failing`: the slice is known to hold a failing change, so it is split without a whole try.
   * "passed": committed whole; "settled": failed and was split (or rejected) to the end;
   * "refused": out of budget, the rest waits for the next run.
   */
  private async attempt(items: Item[], failing: boolean): Promise<"passed" | "settled" | "refused"> {
    if (items.length === 0) return "passed";
    if (this.stopped) return "refused";
    if (failing && items.length > 1) return this.split(items);
    const ids = items.flatMap((item) => item.ids);
    const touched = mergeTouched(items.map((item) => item.touched));
    const body = [
      DEFER_FOREIGN_KEYS,
      ...items.flatMap((item) => item.statements),
      ...recountStatements(touched, this.nowMs),
    ];
    if (body.length + 1 + FOLLOW_UP_RESERVE > this.budgetLeft()) {
      this.stopped = true;
      if (failing) this.note = { firstId: items[0].ids[0], items: items.length };
      return "refused";
    }
    const statements = [...body, this.s11For(ids, body.length + 1)];
    let results: D1Result[];
    try {
      results = await this.batch(statements);
    } catch (error) {
      const kind = classifyD1Error(error);
      if (kind === "transient") throw error;
      if (items.length > 1) return this.split(items);
      await this.single(items[0], kind, error);
      return "settled";
    }
    this.commitDone(ids);
    for (const item of items) {
      if (item.kind === "reject" && item.reject) {
        this.report.rejects.push({ ref: item.ids[0], table: item.reject.table, reason: item.reject.reason, closed: item.reject.closed });
      }
    }
    await this.followUps(items, results, 1);
    return "passed";
  }

  /** Halves of a failing slice; a second half after a passing first half holds the failure. */
  private async split(items: Item[]): Promise<"settled" | "refused"> {
    const middle = Math.ceil(items.length / 2);
    const first = await this.attempt(items.slice(0, middle), false);
    if (first === "refused") {
      // The first half did not fit: the next run splits this whole slice (unless a smaller failing
      // slice inside it was noted already).
      this.note ??= { firstId: items[0].ids[0], items: items.length };
      return "refused";
    }
    const second = await this.attempt(items.slice(middle), first === "passed");
    return second === "refused" ? "refused" : "settled";
  }

  /** One change failed alone: an FK error gets one re-read; otherwise it becomes a reject. */
  private async single(item: Item, kind: "fk" | "check", error: unknown): Promise<void> {
    const change = item.change;
    if (item.kind === "reject" && rejectRefTaken(error)) return this.commitIdsOnly(item.ids);
    if (item.kind !== "apply" || !change) throw error;
    if (kind === "fk") {
      const parent = PARENTS[change.table];
      const reads = parent ? 2 : 1;
      if (this.canReread(reads)) {
        this.rereads += reads;
        const match = supabaseKeyOf(change.table, change.rowKey);
        const parentId = parent ? String(match[parent.column] ?? "") : "";
        const [current, parentEnv] = await Promise.all([
          readCurrentRow(this.config, change.table, match, this.readOptions()),
          parent ? readPostEnv(this.config, parent.table, parentId, this.readOptions()) : null,
        ]);
        if (!current.ok || (parentEnv && !parentEnv.ok)) {
          // Supabase did not answer: leave it for the next run.
          this.stopped = true;
          return;
        }
        const ctx = { nowMs: this.nowMs, ...(parentEnv?.ok ? { parentEnv: parentEnv.data } : {}) };
        const mapped = current.data ? mapRow(change.table, current.data, ctx) : mapDelete(change.table, { ...match }, ctx);
        if (!mapped.ok) {
          await this.commitReject(this.rejectItem(item.ids, mapped.reject, change, opLetter(change)));
          return;
        }
        const reapplied: Item = { kind: "apply", ids: item.ids, change, statements: mapped.statements, touched: mapped.touched };
        const body = [DEFER_FOREIGN_KEYS, ...reapplied.statements, ...recountStatements(reapplied.touched, this.nowMs)];
        if (body.length + 1 + 2 > this.budgetLeft()) {
          this.stopped = true;
          return;
        }
        try {
          const results = await this.batch([...body, this.s11For(item.ids, body.length + 1)]);
          this.commitDone(item.ids);
          await this.followUps([reapplied], results, 1);
          return;
        } catch (again) {
          const againKind = classifyD1Error(again);
          if (againKind === "transient") throw again;
          await this.commitReject(this.rejectItem(item.ids, {
            reason: againKind,
            error: shortError(again),
            table: change.table,
            d1Table: change.d1Table,
            rowKey: change.rowKey,
          }, change, opLetter(change)));
          return;
        }
      }
    }
    await this.commitReject(this.rejectItem(item.ids, {
      reason: kind,
      error: shortError(error),
      table: change.table,
      d1Table: change.d1Table,
      rowKey: change.rowKey,
    }, change, opLetter(change)));
  }

  private async commitReject(item: Item): Promise<void> {
    if (item.statements.length + 1 > this.budgetLeft()) {
      this.stopped = true;
      return;
    }
    try {
      await this.batch([...item.statements, this.s11For(item.ids, item.statements.length + 1)]);
    } catch (error) {
      if (!rejectRefTaken(error)) throw error;
      return this.commitIdsOnly(item.ids);
    }
    this.commitDone(item.ids);
    if (item.reject) {
      this.report.rejects.push({ ref: item.ids[0], table: item.reject.table, reason: item.reject.reason, closed: item.reject.closed });
    }
  }

  /** Commits ids whose reject row was written by an earlier run (rejectRefTaken): S11 alone. */
  private async commitIdsOnly(ids: readonly number[]): Promise<void> {
    if (this.budgetLeft() < 1) {
      this.stopped = true;
      return;
    }
    await this.batch([this.s11For(ids, 1)]);
    this.commitDone(ids);
  }

  /**
   * 0 rows is a failure too (design 5.3 item 8): a partial U whose row D1 does not hold is re-read
   * and applied whole; a 조각모음 body with no post is an orphan when Supabase has none either.
   * The change-log ids are already committed, so what cannot be settled now becomes an open reject.
   */
  private async followUps(items: readonly Item[], results: readonly D1Result[], offset: number): Promise<void> {
    let index = offset;
    const pending: Array<{ item: Item; kind: "zero_rows" | "orphan" }> = [];
    for (const item of items) {
      const kinds = zeroRowKinds(item.statements, results.slice(index, index + item.statements.length));
      index += item.statements.length;
      if (item.kind !== "apply" || !item.change) continue;
      if (kinds.has("orphan")) pending.push({ item, kind: "orphan" });
      else if (kinds.has("zero_rows")) pending.push({ item, kind: "zero_rows" });
    }
    for (const { item, kind } of pending) {
      const change = item.change as MergedChange;
      if (kind === "zero_rows") {
        await this.rereadZeroRows(item, change);
      } else {
        await this.settleOrphan(item, change);
      }
    }
  }

  private async rereadZeroRows(item: Item, change: MergedChange): Promise<void> {
    const openReject = (reason: string, error: string) => this.followUpReject(item, change, reason, error);
    if (!this.canReread()) return openReject("zero_rows", "0 rows; no re-read budget left");
    this.rereads += 1;
    const current = await readCurrentRow(this.config, change.table, supabaseKeyOf(change.table, change.rowKey), this.readOptions());
    if (!current.ok) return openReject("zero_rows", `0 rows; re-read ${current.code}`);
    if (!current.data) return; // Gone in Supabase too: nothing to hold.
    const mapped = mapRow(change.table, current.data, { nowMs: this.nowMs });
    if (!mapped.ok) return openReject(mapped.reject.reason, mapped.reject.error);
    const statements = [...mapped.statements, ...recountStatements(mapped.touched, this.nowMs)];
    if (statements.length + 1 > this.budgetLeft()) return openReject("zero_rows", "0 rows; no statement budget left");
    try {
      const results = await this.batch(statements);
      if (zeroRowKinds(statements, results).has("orphan")) await this.settleOrphan(item, change);
    } catch (error) {
      const kind = classifyD1Error(error);
      if (kind === "transient") throw error;
      await openReject(kind, shortError(error));
    }
  }

  private async settleOrphan(item: Item, change: MergedChange): Promise<void> {
    const orphan = await this.isOrphan(change.rowKey);
    if (orphan === true) return this.followUpReject(item, change, "orphan", "no post in Supabase");
    return this.followUpReject(item, change, "zero_rows", orphan === false ? "post not in D1 yet" : "post check failed");
  }

  private async followUpReject(item: Item, change: MergedChange, reason: string, error: string): Promise<void> {
    const reject = this.rejectItem(item.ids, { reason, error, table: change.table, d1Table: change.d1Table, rowKey: change.rowKey }, change, opLetter(change));
    if (reject.statements.length > this.budgetLeft()) {
      this.init.log(`sync follow-up lost ${change.table} ${item.ids[0]} ${reason}`);
      return;
    }
    try {
      await this.batch(reject.statements);
    } catch (error) {
      // Recorded by an earlier run of the same id (see rejectRefTaken); the ids are committed.
      if (rejectRefTaken(error)) return;
      throw error;
    }
    if (reject.reject) {
      this.report.rejects.push({ ref: item.ids[0], table: change.table, reason, closed: reject.reject.closed });
    }
  }

  // ---------------------------------------------------------------- 12. cleanup

  async cleanup(scheduledTime: number): Promise<void> {
    const minute = Math.floor((scheduledTime % 86_400_000) / 60_000);
    if (minute !== CLEANUP_MINUTE_UTC) return;
    const upTo = this.report.window?.low ?? this.low;
    const before = new Date(this.nowMs - CLEANUP_AGE_MS).toISOString();
    const result = await deleteOldLogRows(this.config, upTo, before, this.readOptions());
    this.report.cleanup = result.ok;
    if (!result.ok) this.init.log(`sync cleanup ${result.code}`);
  }

  async recordFailure(error: string): Promise<void> {
    if (this.budgetLeft() < 1) return;
    try {
      await this.batch([{ sql: RUN_FAIL, params: [error, this.init.leaseUntil] }]);
    } catch {
      // D1 is down too: the lease expires and the next run starts over.
    }
  }
}

/** Which zeroRows kinds came back with 0 changed rows. */
function zeroRowKinds(statements: readonly D1Statement[], results: readonly D1Result[]): Set<"zero_rows" | "orphan"> {
  const kinds = new Set<"zero_rows" | "orphan">();
  statements.forEach((statement, i) => {
    if (statement.zeroRows && Number(results[i]?.meta?.changes ?? 0) === 0) kinds.add(statement.zeroRows);
  });
  return kinds;
}

/**
 * The prefix of headers whose bytes sum to at most `maxBytes` (a row bigger than that alone is read
 * alone), and at most `maxIds` rows (design 5.3 item 2).
 */
export function chooseByBytes(headers: readonly LogHeader[], maxBytes: number, maxIds: number): LogHeader[] {
  const out: LogHeader[] = [];
  let bytes = 0;
  for (const header of headers) {
    if (out.length >= maxIds) break;
    const size = Number(header.row_bytes) || 0;
    if (out.length > 0 && bytes + size > maxBytes) break;
    out.push(header);
    bytes += size;
  }
  return out;
}

export { TransientError };

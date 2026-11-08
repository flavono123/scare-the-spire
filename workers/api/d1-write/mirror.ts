import type { D1Database } from "../d1";
import type { Fetcher } from "../supabase-rest";
import { rowsOf, runBatch, stmt, type D1Statement, type D1Value } from "./db";
import type { OutboxOp, OutboxPayload } from "./outbox";
import { keyParams, mirrorTable, rowJson, type MirrorTable } from "./tables";

/**
 * The step 5 mirror (docs/supabase-exit/D1_SCHEMA_DESIGN.md 5.5): outbox rows go to Supabase in seq
 * order, after each write (ctx.waitUntil) and from the 1-minute cron.
 *
 * - env = API_DATA_ENV on every row of a table that has env; env-less tables (puzzlebox_players)
 *   only from production (their outbox rows are only written there).
 * - Deletes match the owner (the outbox match_key carries it).
 * - Every call is idempotent: inserts ignore duplicates, upserts merge, deletes and updates match
 *   by key, the RPCs ignore a play they have seen. A row is sent as the current D1 state of its key
 *   (read at send time); a key gone from D1 is a no-op (its delete row follows, or a cascade took it).
 * - A transient failure (network, timeout, 5xx, 401/403/408/429) stops the run in order and backs
 *   the head row off. A permanent refusal (other 4xx: 23503, 23514, 22P02 ...) moves the row to
 *   sync_rejects('out') and later rows go on, except rows of the same (table_name, match_key), which
 *   wait behind the open reject. Open 'out' rejects are retried first in every run by re-sending the
 *   current D1 state of their key.
 * - Derived values (counts, threads, totals) are never sent: Supabase's triggers recount them.
 *
 * Budget per invocation (Workers Free: 50 D1 statements, 50 subrequests, 10 ms CPU): at most
 * `maxRows` outbox rows (20 from the cron, 5 after a write) and MAX_REJECT_RETRIES rejects; each row
 * is one D1 read (all in one batch) and one Supabase call. Large documents are spliced as text.
 */

export type MirrorEnv = {
  DB?: D1Database;
  API_SUPABASE_URL?: string;
  /** Supabase secret (service role) key, a Worker secret. The mirror is off without it. */
  API_SUPABASE_SERVICE_KEY?: string;
  API_DATA_ENV?: string;
};

export type MirrorConfig = { url: string; key: string; dataEnv: "production" | "development" };

export function mirrorConfig(env: MirrorEnv): MirrorConfig | null {
  const url = (env.API_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  const key = (env.API_SUPABASE_SERVICE_KEY ?? "").trim();
  const dataEnv = (env.API_DATA_ENV ?? "").trim();
  if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(url) && !/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(url)) return null;
  if (!/^sb_secret_[A-Za-z0-9_-]+$/.test(key)) return null;
  if (dataEnv !== "production" && dataEnv !== "development") return null;
  return { url, key, dataEnv };
}

export const MIRROR_LEASE_MS = 55_000;
export const CALL_TIMEOUT_MS = 8_000;
export const MAX_REJECT_RETRIES = 5;
const BACKOFF_MS = [5_000, 15_000, 60_000, 300_000];

type OutboxRecord = {
  seq: number;
  table_name: string;
  op: OutboxOp;
  match_key: string;
  payload: string | null;
  attempts: number;
  next_attempt_at: number;
};

type OpenReject = { direction: string; ref: number; table_name: string; row_key: string; op: string; payload: string };

export type MirrorReport = {
  ran: boolean;
  reason?: "no_config" | "no_db" | "leased" | "backoff" | "empty";
  sent: number;
  rejected: number;
  retriedRejects: number;
  resolvedRejects: number;
  /** Transient failure that stopped the run, if any. */
  stoppedAt?: number;
  remaining: boolean;
};

export type SendResult = { ok: true } | { ok: false; transient: boolean; code: string };

type CallRequest = { method: "POST" | "PATCH" | "DELETE"; path: string; query?: URLSearchParams; body?: string; contentType?: string; prefer?: string[] };

/** What to do for one outbox row: a call, nothing (the key is gone from D1), or a permanent refusal. */
export type Built = { request: CallRequest } | { skip: true } | { error: string };

/** Canonical match key text: keys sorted, so two writers of the same key always compare equal. */
export function canonicalKey(text: string): string {
  const value = JSON.parse(text) as Record<string, unknown>;
  return JSON.stringify(Object.fromEntries(Object.keys(value).sort().map((name) => [name, value[name]])));
}

function blockKey(table: string, matchKey: string): string {
  return `${table}\u0000${canonicalKey(matchKey)}`;
}

export function isTransient(status: number, code: string): boolean {
  if (status === 0 || status >= 500) return true;
  if (status === 401 || status === 403 || status === 408 || status === 429) return true;
  return code === "timeout" || code === "network";
}

async function call(
  config: MirrorConfig,
  fetcher: Fetcher,
  request: CallRequest,
): Promise<SendResult> {
  const url = new URL(`${config.url}/rest/v1/${request.path}`);
  if (request.query) url.search = request.query.toString();
  const headers = new Headers({ apikey: config.key, Authorization: `Bearer ${config.key}`, Accept: "application/json" });
  if (request.body !== undefined) headers.set("Content-Type", request.contentType ?? "application/json");
  headers.set("Prefer", ["return=minimal", ...(request.prefer ?? [])].join(","));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetcher(url.toString(), { method: request.method, headers, body: request.body, signal: controller.signal });
  } catch {
    clearTimeout(timer);
    return { ok: false, transient: true, code: controller.signal.aborted ? "timeout" : "network" };
  }
  clearTimeout(timer);
  if (response.ok) {
    void response.body?.cancel().catch(() => undefined);
    return { ok: true };
  }
  let code = `http_${response.status}`;
  try {
    const text = await response.text();
    const parsed = text ? (JSON.parse(text) as { code?: unknown }) : null;
    if (typeof parsed?.code === "string" && /^[A-Z0-9]{1,16}$/.test(parsed.code)) code = parsed.code;
  } catch {
    // Not JSON: keep http_<status>.
  }
  return { ok: false, transient: isTransient(response.status, code), code };
}

function eqQuery(spec: MirrorTable, match: Record<string, unknown>, env: string): URLSearchParams {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(match)) query.set(name, `eq.${String(value)}`);
  if (spec.hasEnv) query.set("env", `eq.${env}`);
  return query;
}

type Prepared = {
  record: OutboxRecord;
  spec: MirrorTable;
  match: Record<string, unknown>;
  payload: OutboxPayload | null;
  /** Index of the read statement in the batch, or -1. */
  read: number;
  /** Index of the stats read for the tournament RPC, or -1. */
  statsRead: number;
};

/** Builds the Supabase call for one outbox row from its D1 read. */
export function buildCall(
  config: MirrorConfig,
  prepared: Prepared,
  row: Record<string, unknown> | undefined,
  stats: Record<string, unknown>[] | undefined,
): Built {
  const { spec, match, payload, record } = prepared;
  const env = config.dataEnv;
  if (record.op === "delete") {
    return { request: { method: "DELETE", path: spec.table, query: eqQuery(spec, match, env) } };
  }
  // Gone from D1 since: a later delete row (or a cascade on both sides) takes care of it.
  if (!row) return { skip: true };
  const extra = payload?.extra ?? null;
  if (record.op === "update") {
    const columns = payload?.columns ?? [];
    const body = rowJson(spec, row, { only: columns, extra });
    return { request: { method: "PATCH", path: spec.table, query: eqQuery(spec, match, env), body } };
  }
  if (record.op === "rpc") {
    if (spec.table !== "favorite_tournament_plays") return { error: `no rpc mirror for ${spec.table}` };
    const statsSpec = mirrorTable("favorite_tournament_candidate_stats");
    const statsJson = `[${(stats ?? []).map((entry) => rowJson(statsSpec, entry)).join(",")}]`;
    const body = `{"p_env":${JSON.stringify(env)},"p_play":${rowJson(spec, row)},"p_stats":${statsJson}}`;
    return { request: { method: "POST", path: "rpc/mirror_favorite_tournament_play", body } };
  }
  if (spec.table === "runs") {
    // The raw goes as text/plain without JSON escaping (design 5.5): "<row JSON>\n<raw>".
    const raw = row.raw;
    if (typeof raw !== "string") return { error: "raw_missing" };
    return {
      request: { method: "POST", path: "rpc/mirror_run", body: `${rowJson(spec, row, { env, extra })}\n${raw}`, contentType: "text/plain" },
    };
  }
  const body = rowJson(spec, row, { env, extra });
  const query = new URLSearchParams({ on_conflict: spec.conflict.join(",") });
  const prefer = record.op === "insert" ? ["resolution=ignore-duplicates"] : ["resolution=merge-duplicates"];
  return { request: { method: "POST", path: spec.table, query, body, prefer } };
}

async function send(config: MirrorConfig, fetcher: Fetcher, built: Built): Promise<SendResult> {
  if ("skip" in built) return { ok: true };
  if ("error" in built) return { ok: false, transient: false, code: built.error };
  return call(config, fetcher, built.request);
}

function prepare(record: OutboxRecord): Prepared {
  const spec = mirrorTable(record.table_name);
  return {
    record,
    spec,
    match: JSON.parse(record.match_key) as Record<string, unknown>,
    payload: record.payload ? (JSON.parse(record.payload) as OutboxPayload) : null,
    read: -1,
    statsRead: -1,
  };
}

/** Read statements for the prepared rows (one per row, plus the stats of a tournament play). */
function readStatements(items: Prepared[]): D1Statement[] {
  const statements: D1Statement[] = [];
  for (const item of items) {
    if (item.record.op === "delete") continue;
    item.read = statements.length;
    statements.push(stmt(item.spec.readSql, ...keyParams(item.spec, item.match)));
    if (item.record.op === "rpc") {
      item.statsRead = statements.length;
      const stats = mirrorTable("favorite_tournament_candidate_stats");
      // The tournament of the play: read through the play row itself.
      statements.push(stmt(
        `${stats.readSql.replace("tournament_id = ?1", "tournament_id = (SELECT tournament_id FROM favorite_tournament_plays WHERE id = ?1)")}`,
        String(item.match.id),
      ));
    }
  }
  return statements;
}

export type MirrorOptions = {
  maxRows?: number;
  now?: () => number;
  fetcher?: Fetcher;
};

/**
 * One mirror run. Safe to call from any number of invocations: a lease in sync_state ('outbox_out')
 * keeps one run at a time. Returns what it did; never throws for Supabase failures.
 */
export async function mirrorOutbox(env: MirrorEnv, options: MirrorOptions = {}): Promise<MirrorReport> {
  const report: MirrorReport = { ran: false, sent: 0, rejected: 0, retriedRejects: 0, resolvedRejects: 0, remaining: false };
  const config = mirrorConfig(env);
  if (!config) return { ...report, reason: "no_config" };
  const db = env.DB;
  if (!db) return { ...report, reason: "no_db" };
  const now = options.now ?? Date.now;
  const fetcher: Fetcher = options.fetcher ?? ((input, init) => fetch(input, init));
  const maxRows = Math.max(1, Math.min(options.maxRows ?? 20, 20));
  const startedAt = now();

  // S1 (lease) + S2 (next rows) + open 'out' rejects in one round trip.
  const [lease, pending, rejects] = await runBatch(db, [
    stmt(
      "INSERT INTO sync_state (name, lease_until, last_run_at) VALUES (?1, ?2, ?3) " +
        "ON CONFLICT (name) DO UPDATE SET lease_until = excluded.lease_until, last_run_at = excluded.last_run_at " +
        "WHERE sync_state.lease_until < excluded.last_run_at RETURNING low_watermark, high_seen, applied_above",
      "outbox_out", startedAt + MIRROR_LEASE_MS, startedAt,
    ),
    stmt("SELECT seq, table_name, op, match_key, payload, attempts, next_attempt_at FROM outbox WHERE seq > ?1 ORDER BY seq LIMIT ?2", 0, maxRows + 1),
    stmt(
      "SELECT direction, ref, table_name, row_key, op, payload FROM sync_rejects WHERE resolved_at IS NULL AND direction = 'out' ORDER BY last_at LIMIT ?1",
      MAX_REJECT_RETRIES,
    ),
  ]);
  if (rowsOf(lease).length === 0) return { ...report, reason: "leased" };
  const leaseUntil = startedAt + MIRROR_LEASE_MS;
  report.ran = true;
  const records = rowsOf<OutboxRecord>(pending);
  const openRejects = rowsOf<OpenReject>(rejects);
  const finish: D1Statement[] = [];
  try {
    // 1. Retry open rejects: re-send the current D1 state of the key (the payload is never replayed).
    const retries = openRejects.map((reject) =>
      prepare({ seq: reject.ref, table_name: reject.table_name, op: reject.op as OutboxOp, match_key: reject.row_key, payload: reject.payload === "{}" ? null : reject.payload, attempts: 0, next_attempt_at: 0 }),
    );
    const stillOpen = new Set<string>();
    if (retries.length) {
      const reads = await runBatch(db, readStatements(retries));
      for (const item of retries) {
        report.retriedRejects += 1;
        const row = item.read >= 0 ? rowsOf<Record<string, unknown>>(reads[item.read])[0] : undefined;
        const stats = item.statsRead >= 0 ? rowsOf<Record<string, unknown>>(reads[item.statsRead]) : undefined;
        const result = await send(config, fetcher, buildCall(config, item, row, stats));
        if (result.ok) {
          report.resolvedRejects += 1;
          finish.push(stmt("UPDATE sync_rejects SET resolved_at = ?3 WHERE direction = ?1 AND ref = ?2 AND resolved_at IS NULL", "out", item.record.seq, now()));
        } else {
          stillOpen.add(blockKey(item.record.table_name, item.record.match_key));
          finish.push(stmt(
            "UPDATE sync_rejects SET attempts = attempts + 1, last_at = ?3, error = ?4 WHERE direction = ?1 AND ref = ?2 AND resolved_at IS NULL",
            "out", item.record.seq, now(), result.code,
          ));
          if (result.transient) {
            report.stoppedAt = item.record.seq;
            return report;
          }
        }
      }
    }
    // Rejects not retried this run (over the cap) still block their keys.
    if (openRejects.length >= MAX_REJECT_RETRIES) {
      const more = await runBatch(db, [stmt("SELECT table_name, row_key FROM sync_rejects WHERE resolved_at IS NULL AND direction = 'out'")]);
      for (const reject of rowsOf<{ table_name: string; row_key: string }>(more[0])) {
        if (!openRejects.some((open) => open.table_name === reject.table_name && open.row_key === reject.row_key)) {
          stillOpen.add(blockKey(reject.table_name, reject.row_key));
        }
      }
    }

    // 2. The outbox in seq order.
    report.remaining = records.length > maxRows;
    const batch = records.slice(0, maxRows).map(prepare);
    if (batch.length === 0) {
      report.reason = "empty";
      return report;
    }
    if (batch[0].record.next_attempt_at > startedAt && !stillOpen.has(blockKey(batch[0].record.table_name, batch[0].record.match_key))) {
      report.reason = "backoff";
      return report;
    }
    const reads = await runBatch(db, readStatements(batch));
    const done: number[] = [];
    const blocked = new Set(stillOpen);
    for (const item of batch) {
      const key = blockKey(item.record.table_name, item.record.match_key);
      if (blocked.has(key)) continue;
      // An env-less table is mirrored only by the production Worker (design 5.5).
      if (item.spec.productionOnly && config.dataEnv !== "production") {
        done.push(item.record.seq);
        continue;
      }
      const row = item.read >= 0 ? rowsOf<Record<string, unknown>>(reads[item.read])[0] : undefined;
      const stats = item.statsRead >= 0 ? rowsOf<Record<string, unknown>>(reads[item.statsRead]) : undefined;
      const result = await send(config, fetcher, buildCall(config, item, row, stats));
      if (result.ok) {
        done.push(item.record.seq);
        report.sent += 1;
        continue;
      }
      if (result.transient) {
        const backoff = BACKOFF_MS[Math.min(item.record.attempts, BACKOFF_MS.length - 1)];
        finish.push(stmt(
          "UPDATE outbox SET attempts = attempts + 1, next_attempt_at = ?2, last_error = ?3 WHERE seq = ?1",
          item.record.seq, now() + backoff, result.code,
        ));
        report.stoppedAt = item.record.seq;
        break;
      }
      // Permanent: park it in sync_rejects('out') (S4c) and keep later rows of this key behind it.
      blocked.add(key);
      report.rejected += 1;
      finish.push(stmt(
        "INSERT INTO sync_rejects (direction, ref, table_name, d1_table, row_key, op, reason, payload, error, first_at, last_at) " +
          "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10) " +
          "ON CONFLICT (direction, table_name, row_key) WHERE resolved_at IS NULL DO UPDATE SET " +
          "op = excluded.op, reason = excluded.reason, payload = excluded.payload, error = excluded.error, " +
          "last_at = excluded.last_at, attempts = sync_rejects.attempts + 1",
        "out", item.record.seq, item.record.table_name, d1TableOf(item.record.table_name), canonicalKey(item.record.match_key),
        item.record.op, "supabase_4xx", item.record.payload ?? "{}", result.code, now(),
      ));
      done.push(item.record.seq);
    }
    if (done.length) finish.push(stmt("DELETE FROM outbox WHERE seq IN (SELECT value FROM json_each(?1))", JSON.stringify(done)));
    report.remaining = report.remaining || done.length < batch.length;
    return report;
  } finally {
    finish.push(stmt("UPDATE sync_state SET lease_until = 0, last_applied_at = ?2 WHERE name = 'outbox_out' AND lease_until = ?1", leaseUntil, now()));
    await runBatch(db, finish).catch(() => undefined);
  }
}

/** sync_rejects.d1_table: the D1 table the key belongs to (post tables and runs live in posts). */
function d1TableOf(table: string): string {
  return table === "runs" || table.endsWith("_posts") ? "posts" : table;
}

/** The cron's call: one run of up to 20 rows (the rest waits for the next minute). */
export async function scheduledOutboxMirror(env: MirrorEnv, options: MirrorOptions = {}): Promise<MirrorReport> {
  return mirrorOutbox(env, { ...options, maxRows: options.maxRows ?? 20 });
}

/** Counts for the cutover's "outbox empty and no open out reject" check. */
export async function outboxHealth(db: D1Database): Promise<{ outbox: number; openOutRejects: number }> {
  const [outbox, rejects] = await runBatch(db, [
    stmt("SELECT count(*) AS n FROM outbox"),
    stmt("SELECT count(*) AS n FROM sync_rejects WHERE resolved_at IS NULL AND direction = 'out'"),
  ]);
  return {
    outbox: Number(rowsOf<{ n: number }>(outbox)[0]?.n ?? 0),
    openOutRejects: Number(rowsOf<{ n: number }>(rejects)[0]?.n ?? 0),
  };
}

export type { D1Value };

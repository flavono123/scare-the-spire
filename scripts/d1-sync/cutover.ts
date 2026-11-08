/**
 * The step 5 cutover of the Supabase exit and its reverse (docs/SUPABASE_EXIT_PLAN.md 7.3 step 5,
 * docs/supabase-exit/D1_SCHEMA_DESIGN.md 5.5 "5단계에서 되돌릴 때"). The CLI is scripts/d1-cutover.ts.
 *
 * To D1 (`to: "d1"`):
 *   0. Checks: every source.<group> is supabase, writes are not paused, the 1-minute sync is on and
 *      started, the outbox is empty, no reject is open in either direction.
 *   1. write.paused = on, then wait until every isolate's write gate has re-read it (FRESH_MS).
 *   2. Drain: take the change log head H (after the wait, so writes in flight have committed) and wait
 *      until the 1-minute sync has applied every id up to H of this env (its applied_above window and
 *      watermark). The sync's own apply (the deployed cron) does the work; the script watches it.
 *   3. sync.enabled = off, then wait until no sync run can still be in flight.
 *   4. The daily reconcile (scripts/d1-sync/reconcile.ts) must pass.
 *   5. Every source.<group> = d1 in one statement, then write.paused = off.
 *   A failure before 5 undoes what this run did: sync back on, writes unpaused, sources untouched.
 *
 * To Supabase (`to: "supabase"`, the reverse):
 *   0. Checks: every source is d1, the sync is off.
 *   1. write.paused = on, then wait as above.
 *   2. Wait until the outbox is empty and no 'out' reject is open (the cron mirror sends them).
 *   3. Every source.<group> = supabase, then write.paused = off.
 *   4. Re-fill D1 from Supabase (the first copy with --refill, design 5.2: leaf-first DROP, DDL, copy,
 *      new W0), whose watermark row hands over to the sync, then sync.enabled = on. Moving only the
 *      watermark would skip Supabase's own recounts of what D1 counted during step 5 (design 5.5).
 *   A failure in 2 unpauses writes with D1 still the source.
 *
 * Every flag change is also logged in runtime_flag_events, as scripts/runtime-flags.ts does. All remote
 * access goes through the injected ports (D1 HTTP API, PostgREST), so the spec runs on fakes.
 */
import {
  WRITE_GROUPS,
  WRITE_PAUSED_KEY,
  sourceFlagKey,
  type WriteSource,
} from "../../src/lib/write-source-flags";
import type { D1HttpClient, FetchLike } from "./d1-http-client";
import { isNewFormatKey } from "./postgrest-reader";

export type CutoverTarget = "testbed" | "production";
export type CutoverDirection = "d1" | "supabase";

/** Supabase env of each D1 database (wrangler.jsonc API_DATA_ENV). */
export const DATA_ENVS: Readonly<Record<CutoverTarget, "development" | "production">> = {
  testbed: "development",
  production: "production",
};

/** The step 2 sync switch (workers/sync/sync-env.ts SYNC_FLAG_KEY). */
export const SYNC_FLAG_KEY = "sync.enabled";
/** How long a Worker isolate may keep a gate it read (workers/api/flags.ts FRESH_MS) plus a margin. */
export const PROPAGATION_MS = 30_000 + 5_000;
/** The longest a sync run can still be working after it took its lease (run-sync RUN_DEADLINE_MS 40 s + margin). */
export const SYNC_RUN_MAX_MS = 45_000;
/** Time between a sync run's flag read and its lease (S1); a run that read "on" may lease this late. */
export const SYNC_GATE_TO_LEASE_MS = 5_000;
export const DRAIN_TIMEOUT_MS = 180_000;
export const OUTBOX_TIMEOUT_MS = 300_000;
export const POLL_MS = 5_000;

export interface ChangeLogReader {
  /** The highest d1_change_log id (0 when empty). */
  head(): Promise<number>;
  /** Ids in (after, upTo] whose env is `env` or null, ascending. */
  ids(after: number, upTo: number, env: string): Promise<number[]>;
}

export interface CutoverPorts {
  d1: D1HttpClient;
  changeLog: ChangeLogReader;
  /** The daily reconcile of this target; ok means no failures (rows, derived values, open rejects). */
  reconcile(): Promise<{ ok: boolean; lines: string[] }>;
  /** The first copy with --refill (reverse only). */
  refill(): Promise<{ ok: boolean; lines: string[] }>;
  sleep(ms: number): Promise<void>;
  now(): number;
  log(line: string): void;
}

export interface CutoverOptions {
  target: CutoverTarget;
  to: CutoverDirection;
  note: string;
  dryRun?: boolean;
  /** Reverse only: leave the re-fill (and turning the sync back on) to a later run by hand. */
  skipRefill?: boolean;
  propagationMs?: number;
  drainTimeoutMs?: number;
  outboxTimeoutMs?: number;
  pollMs?: number;
}

export interface CutoverReport {
  /** done: the flags were flipped; dry_run: nothing written; refused: a check failed before any write;
   *  aborted: undone after a failed step; failed: stopped in a state the lines describe. */
  status: "done" | "dry_run" | "refused" | "aborted" | "failed";
  lines: string[];
  /** Milliseconds writes were paused (0 when they never were). */
  pausedMs: number;
}

// ------------------------------------------------------------------------------------------- D1 state

export const FLAGS_SQL = "SELECT key, value FROM runtime_flags";
const SET_FLAGS_SQL =
  "INSERT INTO runtime_flags (key, value, updated_at, note) SELECT value, ?2, ?3, ?4 FROM json_each(?1) WHERE true " +
  "ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, note = excluded.note";
const FLAG_EVENTS_SQL = "INSERT INTO runtime_flag_events (key, value, at, note) SELECT value, ?2, ?3, ?4 FROM json_each(?1)";
const SYNC_STATE_SQL =
  "SELECT low_watermark, high_seen, applied_above, last_run_at, fail_count, last_error FROM sync_state WHERE name = 'supabase_in'";
const HEALTH_SQL =
  "SELECT (SELECT count(*) FROM outbox) AS outbox, " +
  "(SELECT count(*) FROM sync_rejects WHERE resolved_at IS NULL AND direction = 'out') AS open_out, " +
  "(SELECT count(*) FROM sync_rejects WHERE resolved_at IS NULL AND direction = 'in') AS open_in";

export const SOURCE_KEYS: readonly string[] = WRITE_GROUPS.map(sourceFlagKey);

export async function readFlags(d1: D1HttpClient): Promise<Map<string, string>> {
  const result = await d1.query(FLAGS_SQL);
  return new Map(result.rows.map((row) => [String(row.key), String(row.value)]));
}

/** Sets every key to one value in one statement, logs the change, and reads it back. */
export async function setFlags(d1: D1HttpClient, keys: readonly string[], value: string, note: string, at: string): Promise<void> {
  const list = JSON.stringify(keys);
  await d1.query(SET_FLAGS_SQL, [list, value, at, note]);
  await d1.query(FLAG_EVENTS_SQL, [list, value, at, note]);
  const back = await readFlags(d1);
  const wrong = keys.filter((key) => back.get(key) !== value);
  if (wrong.length) throw new Error(`flag read-back mismatch: ${wrong.join(", ")}`);
}

export type Health = { outbox: number; openOut: number; openIn: number };

export async function readHealth(d1: D1HttpClient): Promise<Health> {
  const row = (await d1.query(HEALTH_SQL)).rows[0] ?? {};
  return { outbox: Number(row.outbox ?? 0), openOut: Number(row.open_out ?? 0), openIn: Number(row.open_in ?? 0) };
}

type SyncState = { low: number; high: number; applied: Set<number>; lastRunAt: number; failCount: number; lastError: string | null };

async function readSyncState(d1: D1HttpClient): Promise<SyncState | null> {
  const row = (await d1.query(SYNC_STATE_SQL)).rows[0];
  if (!row) return null;
  return {
    low: Number(row.low_watermark ?? 0),
    high: Number(row.high_seen ?? 0),
    applied: new Set((JSON.parse(String(row.applied_above ?? "[]")) as unknown[]).map(Number)),
    lastRunAt: Number(row.last_run_at ?? 0),
    failCount: Number(row.fail_count ?? 0),
    lastError: row.last_error === null || row.last_error === undefined ? null : String(row.last_error),
  };
}

function sourcesOf(flags: Map<string, string>): WriteSource[] {
  return SOURCE_KEYS.map((key) => (flags.get(key) === "d1" ? "d1" : "supabase"));
}

// ------------------------------------------------------------------------------------------- change log

/** d1_change_log through PostgREST with the service key (readable by the service role only). */
export function changeLogReader(opts: { url: string; serviceKey: string; fetch: FetchLike }): ChangeLogReader {
  const base = `${opts.url.replace(/\/+$/, "")}/rest/v1/d1_change_log`;
  const headers: Record<string, string> = {
    apikey: opts.serviceKey,
    ...(isNewFormatKey(opts.serviceKey) ? {} : { authorization: `Bearer ${opts.serviceKey}` }),
    accept: "application/json",
  };
  async function get(query: string): Promise<Array<Record<string, unknown>>> {
    const response = await opts.fetch(`${base}?${query}`, { method: "GET", headers });
    const text = await response.text();
    if (!response.ok) throw new Error(`PostgREST ${response.status} on d1_change_log`);
    const rows = JSON.parse(text) as unknown;
    if (!Array.isArray(rows)) throw new Error("PostgREST answer of d1_change_log is not an array");
    return rows as Array<Record<string, unknown>>;
  }
  return {
    async head() {
      const rows = await get("select=id&order=id.desc&limit=1");
      return rows.length ? Number(rows[0].id) : 0;
    },
    async ids(after, upTo, env) {
      const out: number[] = [];
      for (let from = after; from < upTo; ) {
        const rows = await get(`select=id,env&id=gt.${from}&id=lte.${upTo}&order=id&limit=1000`);
        if (rows.length === 0) break;
        for (const row of rows) if (row.env === null || row.env === env) out.push(Number(row.id));
        from = Number(rows[rows.length - 1].id);
      }
      return out;
    },
  };
}

// ------------------------------------------------------------------------------------------- run

export async function runCutover(ports: CutoverPorts, options: CutoverOptions): Promise<CutoverReport> {
  const lines: string[] = [];
  const say = (line: string) => {
    lines.push(line);
    ports.log(line);
  };
  const propagationMs = options.propagationMs ?? PROPAGATION_MS;
  const pollMs = options.pollMs ?? POLL_MS;
  const env = DATA_ENVS[options.target];
  const note = `step 5 cutover to ${options.to}: ${options.note}`.slice(0, 200);
  const at = () => new Date(ports.now()).toISOString();
  let pausedAt = 0;
  const report = (status: CutoverReport["status"]): CutoverReport => ({
    status,
    lines,
    pausedMs: pausedAt ? ports.now() - pausedAt : 0,
  });

  async function waitFor(what: string, timeoutMs: number, check: () => Promise<string | null>): Promise<void> {
    const started = ports.now();
    for (;;) {
      const waiting = await check();
      if (waiting === null) {
        say(`${what}: done after ${Math.round((ports.now() - started) / 1000)} s`);
        return;
      }
      if (ports.now() - started >= timeoutMs) throw new Error(`${what}: timed out after ${Math.round(timeoutMs / 1000)} s (${waiting})`);
      await ports.sleep(pollMs);
    }
  }

  say(`D1 step 5 cutover to ${options.to}, target ${options.target} (Supabase env ${env})${options.dryRun ? ", dry run" : ""}`);
  const flags = await readFlags(ports.d1);
  const sources = sourcesOf(flags);
  const paused = flags.get(WRITE_PAUSED_KEY) === "on";
  const syncOn = flags.get(SYNC_FLAG_KEY) === "on";
  const health = await readHealth(ports.d1);
  say(`now: sources ${[...new Set(sources)].join("/")}, write.paused ${paused ? "on" : "off"}, sync ${syncOn ? "on" : "off"}, ` +
    `outbox ${health.outbox}, open rejects out ${health.openOut} in ${health.openIn}`);

  const refuse = (message: string) => {
    say(`refused: ${message}`);
    return report("refused");
  };
  if (paused) return refuse("write.paused is already on (a cutover is running or stopped half way); check the flags by hand");

  if (options.to === "d1") {
    if (sources.some((source) => source !== "supabase")) return refuse("some source.<group> is not supabase");
    if (!syncOn) return refuse("sync.enabled is off: the change log would not drain");
    const state = await readSyncState(ports.d1);
    if (!state) return refuse("the sync has not started (no supabase_in watermark)");
    if (health.outbox > 0 || health.openOut > 0) return refuse("the outbox or an 'out' reject is not empty");
    if (health.openIn > 0) return refuse(`${health.openIn} open 'in' rejects: resolve them first (design 3.1, 5.3)`);
    if (options.dryRun) {
      const head = await ports.changeLog.head();
      const missing = (await ports.changeLog.ids(state.low, head, env)).filter((id) => !state.applied.has(id));
      say(`dry run: change log head ${head}, watermark ${state.low}/${state.high}, ${missing.length} ids of this env not applied yet`);
      say("dry run: would pause writes, drain, turn the sync off, reconcile, set every source to d1 and unpause");
      return report("dry_run");
    }
  } else {
    if (sources.some((source) => source !== "d1")) return refuse("some source.<group> is not d1");
    if (syncOn) return refuse("sync.enabled is on while D1 is the source: turn it off and check by hand");
    if (options.dryRun) {
      say(`dry run: would pause writes, wait for the outbox (${health.outbox} rows, ${health.openOut} open 'out' rejects), ` +
        `set every source to supabase, unpause${options.skipRefill ? "" : ", re-fill D1 and turn the sync on"}`);
      return report("dry_run");
    }
  }

  // ---- pause
  try {
    await setFlags(ports.d1, [WRITE_PAUSED_KEY], "on", note, at());
  } catch (error) {
    say(`PAUSE FAILED (${(error as Error).message}): check write.paused by hand; nothing else changed`);
    return report("failed");
  }
  pausedAt = ports.now();
  say(`write.paused on; waiting ${Math.round(propagationMs / 1000)} s for every Worker isolate to see it`);
  let syncTurnedOff = false;
  try {
    await ports.sleep(propagationMs);

    if (options.to === "d1") {
      // ---- drain the change log
      const head = await ports.changeLog.head();
      say(`change log head ${head}`);
      await waitFor("change log applied", options.drainTimeoutMs ?? DRAIN_TIMEOUT_MS, async () => {
        const state = await readSyncState(ports.d1);
        if (!state) return "no supabase_in watermark";
        if (state.low >= head) return null;
        const missing = (await ports.changeLog.ids(state.low, head, env)).filter((id) => !state.applied.has(id));
        if (missing.length === 0) return null;
        return `${missing.length} ids not applied, first ${missing[0]}${state.lastError ? `, last sync error ${state.lastError}` : ""}`;
      });
      // ---- the sync off, and no run left in flight
      const offAt = ports.now();
      await setFlags(ports.d1, [SYNC_FLAG_KEY], "off", note, at());
      syncTurnedOff = true;
      await waitFor("sync runs finished", SYNC_RUN_MAX_MS + SYNC_GATE_TO_LEASE_MS + 60_000, async () => {
        const state = await readSyncState(ports.d1);
        const until = Math.max((state?.lastRunAt ?? 0) + SYNC_RUN_MAX_MS, offAt + SYNC_GATE_TO_LEASE_MS);
        return ports.now() >= until ? null : `a run may still be in flight for ${Math.ceil((until - ports.now()) / 1000)} s`;
      });
      const after = await readHealth(ports.d1);
      if (after.openIn > 0) throw new Error(`${after.openIn} 'in' rejects opened while draining`);
      // ---- reconcile
      say("reconcile:");
      const reconciled = await ports.reconcile();
      for (const line of reconciled.lines) say(`  ${line}`);
      if (!reconciled.ok) throw new Error("the reconcile found differences");
    } else {
      // ---- the outbox to Supabase
      await waitFor("outbox mirrored", options.outboxTimeoutMs ?? OUTBOX_TIMEOUT_MS, async () => {
        const now = await readHealth(ports.d1);
        return now.outbox === 0 && now.openOut === 0 ? null : `outbox ${now.outbox}, open 'out' rejects ${now.openOut}`;
      });
    }
  } catch (error) {
    // Undo: nothing has moved to the other store yet.
    say(`stopped: ${(error as Error).message}`);
    try {
      if (syncTurnedOff) await setFlags(ports.d1, [SYNC_FLAG_KEY], "on", `${note} (undo)`, at());
      await setFlags(ports.d1, [WRITE_PAUSED_KEY], "off", `${note} (undo)`, at());
      say(`undone: ${syncTurnedOff ? "sync.enabled on, " : ""}write.paused off; sources unchanged (${options.to === "d1" ? "supabase" : "d1"})`);
      return report("aborted");
    } catch (undoError) {
      say(`UNDO FAILED (${(undoError as Error).message}): check write.paused and sync.enabled by hand now`);
      return report("failed");
    }
  }

  // ---- flip, then unpause
  try {
    await setFlags(ports.d1, SOURCE_KEYS, options.to, note, at());
    say(`every source.<group> = ${options.to}`);
    await setFlags(ports.d1, [WRITE_PAUSED_KEY], "off", note, at());
  } catch (error) {
    say(`FLIP OR UNPAUSE FAILED (${(error as Error).message}): writes are still paused; ` +
      `check the source.<group> flags, then set write.paused off with scripts/runtime-flags.ts`);
    return report("failed");
  }
  const pausedMs = ports.now() - pausedAt;
  say(`write.paused off; writes were paused ${Math.round(pausedMs / 1000)} s`);
  const done: CutoverReport = { status: "done", lines, pausedMs };

  if (options.to === "supabase") {
    if (options.skipRefill) {
      say("re-fill skipped: run the first copy with --refill (sync off), then set sync.enabled on");
      return done;
    }
    say("re-fill of D1 from Supabase:");
    const refill = await ports.refill().catch((error: unknown) => ({ ok: false, lines: [(error as Error).message] }));
    for (const line of refill.lines) say(`  ${line}`);
    if (!refill.ok) {
      say("re-fill failed: Supabase is the source and holds every write; D1 does not follow until a re-fill succeeds and the sync is on");
      return { ...done, status: "failed" };
    }
    await setFlags(ports.d1, [SYNC_FLAG_KEY], "on", note, at());
    say("sync.enabled on");
  }
  return done;
}

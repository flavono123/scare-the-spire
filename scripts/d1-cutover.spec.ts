/**
 * The step 5 cutover and its reverse (scripts/d1-sync/cutover.ts) against fakes only: a D1 HTTP API
 * endpoint over a local SQLite copy of the D1 schema, a fake PostgREST change log, a simulated
 * 1-minute sync and mirror that move on as the fake clock advances, and fake reconcile and re-fill
 * results. Also the CLI's argument checks (no network: they stop before any call).
 * Usage: tsx scripts/d1-cutover.spec.ts
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

import { WRITE_GROUPS, WRITE_PAUSED_KEY, sourceFlagKey } from "../src/lib/write-source-flags";
import { changeLogReader, runCutover, SOURCE_KEYS, SYNC_FLAG_KEY, type CutoverOptions, type CutoverPorts } from "./d1-sync/cutover";
import { d1HttpClient, type FetchLike } from "./d1-sync/d1-http-client";
import { FakeD1, response } from "./d1-sync/reconcile-fakes";
import { openD1TestDb, type SqliteDb } from "./d1-sync/test-db";

let checks = 0;
async function check(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    checks += 1;
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

const ACCOUNT = "acc";
const DB_ID = "db-testbed";
const TOKEN = "d1-token";
const SUPABASE = "https://abcdefghijklmnopqrst.supabase.co";
const KEY = "sb_secret_cutover";

type LogRow = { id: number; env: string | null };

/** The world the cutover acts on, with a clock that only sleep() moves. */
function world(opts: { sources?: "supabase" | "d1"; sync?: "on" | "off"; started?: boolean; log?: LogRow[]; applied?: number[]; low?: number } = {}) {
  const db: SqliteDb = openD1TestDb();
  const at = "2026-11-09T00:00:00.000Z";
  for (const group of WRITE_GROUPS) {
    db.prepare("INSERT INTO runtime_flags (key, value, updated_at) VALUES (?1, ?2, ?3)").run(sourceFlagKey(group), opts.sources ?? "supabase", at);
  }
  db.prepare("INSERT INTO runtime_flags (key, value, updated_at) VALUES (?1, ?2, ?3)").run(SYNC_FLAG_KEY, opts.sync ?? "on", at);
  if (opts.started ?? true) {
    db.prepare("INSERT INTO sync_state (name, low_watermark, high_seen, applied_above, last_run_at) VALUES ('supabase_in', ?1, ?1, ?2, 0)")
      .run(opts.low ?? 0, JSON.stringify(opts.applied ?? []));
  }
  const fakeD1 = new FakeD1(db, ACCOUNT, DB_ID, TOKEN);
  const d1 = d1HttpClient({ accountId: ACCOUNT, databaseId: DB_ID, token: TOKEN, fetch: fakeD1.fetch });
  const log: LogRow[] = opts.log ?? [];
  const seenHeaders: Array<Record<string, string>> = [];
  const supabaseFetch: FetchLike = async (url, init) => {
    seenHeaders.push(init.headers);
    const parsed = new URL(url);
    if (parsed.pathname !== "/rest/v1/d1_change_log" || init.method !== "GET") return response(404, { message: "no route" });
    const p = parsed.searchParams;
    let rows = [...log].sort((a, b) => a.id - b.id);
    for (const value of p.getAll("id")) {
      const [op, n] = value.split(".");
      rows = rows.filter((row) => (op === "gt" ? row.id > Number(n) : row.id <= Number(n)));
    }
    if (p.get("order") === "id.desc") rows.reverse();
    return response(200, rows.slice(0, Number(p.get("limit") ?? 1000)).map((row) => ({ id: row.id, env: row.env })));
  };
  let clock = 1_800_000_000_000;
  const ticks: Array<(now: number) => void> = [];
  const calls = { reconcile: 0, refill: 0 };
  const result = { reconcile: true, refill: true };
  const ports: CutoverPorts = {
    d1,
    changeLog: changeLogReader({ url: SUPABASE, serviceKey: KEY, fetch: supabaseFetch }),
    async reconcile() {
      calls.reconcile += 1;
      return { ok: result.reconcile, lines: [result.reconcile ? "reconcile ok" : "reconcile FAILED: 1 row differs"] };
    },
    async refill() {
      calls.refill += 1;
      return { ok: result.refill, lines: [result.refill ? "re-fill done" : "re-fill stopped by a check"] };
    },
    async sleep(ms) {
      clock += ms;
      for (const tick of ticks) tick(clock);
    },
    now: () => clock,
    log: () => undefined,
  };
  const flag = (key: string) => (db.prepare("SELECT value FROM runtime_flags WHERE key = ?1").get(key) as { value?: string } | undefined)?.value;
  const events = () => (db.prepare("SELECT key, value FROM runtime_flag_events ORDER BY id").all() as Array<{ key: string; value: string }>)
    .map((row) => `${row.key}=${row.value}`);
  /** The 1-minute sync: applies every log id of this env above the watermark, while sync.enabled is on. */
  const syncCron = (env = "development") => (now: number) => {
    if (flag(SYNC_FLAG_KEY) !== "on") return;
    const state = db.prepare("SELECT low_watermark, applied_above FROM sync_state WHERE name = 'supabase_in'").get() as { low_watermark: number; applied_above: string };
    const applied = new Set(JSON.parse(state.applied_above) as number[]);
    for (const row of log) if (row.id > state.low_watermark && (row.env === env || row.env === null)) applied.add(row.id);
    const high = Math.max(state.low_watermark, ...applied);
    db.prepare("UPDATE sync_state SET high_seen = ?1, applied_above = ?2, last_run_at = ?3 WHERE name = 'supabase_in'")
      .run(high, JSON.stringify([...applied].sort((a, b) => a - b)), now);
  };
  const run = (options: Partial<CutoverOptions> & Pick<CutoverOptions, "to">) =>
    runCutover(ports, { target: "testbed", note: "spec", pollMs: 5_000, ...options });
  return { db, d1, fakeD1, ports, log, ticks, calls, result, flag, events, syncCron, run, seenHeaders, get clock() { return clock; } };
}

const sourcesAre = (w: ReturnType<typeof world>, value: string) => SOURCE_KEYS.every((key) => w.flag(key) === value);

async function main() {
  await check("to d1: pause, drain the change log through the sync, sync off, reconcile, flip, unpause", async () => {
    const w = world({ log: [{ id: 1, env: "development" }, { id: 2, env: "production" }, { id: 3, env: null }, { id: 4, env: "development" }] });
    let pausedWhenApplied: string | undefined;
    w.ticks.push((now) => {
      if (pausedWhenApplied === undefined) pausedWhenApplied = w.flag(WRITE_PAUSED_KEY);
      w.syncCron()(now);
    });
    const report = await w.run({ to: "d1" });
    assert.equal(report.status, "done", report.lines.join("\n"));
    assert.equal(pausedWhenApplied, "on", "the drain runs while writes are paused");
    assert.ok(sourcesAre(w, "d1"));
    assert.equal(w.flag(WRITE_PAUSED_KEY), "off");
    assert.equal(w.flag(SYNC_FLAG_KEY), "off", "the step 2 sync stays off: the direction changed");
    assert.equal(w.calls.reconcile, 1);
    assert.deepEqual(w.events(), [
      "write.paused=on",
      "sync.enabled=off",
      ...SOURCE_KEYS.map((key) => `${key}=d1`),
      "write.paused=off",
    ]);
    assert.ok(report.pausedMs >= 35_000 + 45_000, "the gate cache time and the last sync run are waited out");
    assert.ok(w.seenHeaders.every((headers) => headers.apikey === KEY && !("authorization" in headers)), "secret key in apikey only");
  });

  await check("to d1: the drain waits for ids of this env only, and only up to the head after the pause", async () => {
    const w = world({ log: [{ id: 1, env: "development" }], applied: [], low: 0 });
    let ticks = 0;
    w.ticks.push((now) => {
      ticks += 1;
      // A write still committing when the pause began lands after the first wait; ids of the other env never apply here.
      if (ticks === 1) w.log.push({ id: 2, env: "development" }, { id: 3, env: "production" });
      if (ticks >= 3) w.syncCron()(now);
    });
    const report = await w.run({ to: "d1" });
    assert.equal(report.status, "done", report.lines.join("\n"));
    const state = w.db.prepare("SELECT applied_above FROM sync_state").get() as { applied_above: string };
    assert.deepEqual(JSON.parse(state.applied_above), [1, 2], "the late id was waited for; the production id was not");
  });

  await check("to d1: refusals write nothing", async () => {
    const cases: Array<[string, () => ReturnType<typeof world>]> = [
      ["a source is d1", () => {
        const w = world();
        w.db.prepare("UPDATE runtime_flags SET value = 'd1' WHERE key = ?1").run(sourceFlagKey("comments"));
        return w;
      }],
      ["sync off", () => world({ sync: "off" })],
      ["sync not started", () => world({ started: false })],
      ["already paused", () => {
        const w = world();
        w.db.prepare("INSERT INTO runtime_flags (key, value, updated_at) VALUES (?1, 'on', 'x')").run(WRITE_PAUSED_KEY);
        return w;
      }],
      ["open in reject", () => {
        const w = world();
        w.db.prepare("INSERT INTO sync_rejects (direction, ref, table_name, d1_table, row_key, op, reason, payload, error, first_at, last_at) VALUES ('in', 7, 'comments', 'comments', '{\"id\":\"x\"}', 'U', 'check', '{}', 'e', 1, 1)").run();
        return w;
      }],
      ["outbox not empty", () => {
        const w = world();
        w.db.prepare("INSERT INTO outbox (table_name, op, match_key, payload, created_at) VALUES ('likes', 'delete', '{}', NULL, 1)").run();
        return w;
      }],
    ];
    for (const [name, make] of cases) {
      const w = make();
      const before = w.fakeD1.writes.length;
      const report = await w.run({ to: "d1" });
      assert.equal(report.status, "refused", name);
      assert.equal(w.fakeD1.writes.length, before, `${name}: nothing written`);
      assert.deepEqual(w.events(), [], name);
    }
  });

  await check("to d1: a dry run reads only", async () => {
    const w = world({ log: [{ id: 5, env: "development" }] });
    const report = await w.run({ to: "d1", dryRun: true });
    assert.equal(report.status, "dry_run");
    assert.equal(w.fakeD1.writes.length, 0);
    assert.ok(report.lines.some((line) => line.includes("1 ids of this env not applied yet")), report.lines.join("\n"));
  });

  await check("to d1: a drain that never ends is undone: unpaused, sources and sync unchanged", async () => {
    const w = world({ log: [{ id: 1, env: "development" }] });
    const report = await w.run({ to: "d1", drainTimeoutMs: 60_000 });
    assert.equal(report.status, "aborted", report.lines.join("\n"));
    assert.ok(sourcesAre(w, "supabase"));
    assert.equal(w.flag(WRITE_PAUSED_KEY), "off");
    assert.equal(w.flag(SYNC_FLAG_KEY), "on");
    assert.equal(w.calls.reconcile, 0);
  });

  await check("to d1: a failed reconcile is undone: sync back on, unpaused, sources supabase", async () => {
    const w = world({ log: [{ id: 1, env: "development" }] });
    w.ticks.push((now) => w.syncCron()(now));
    w.result.reconcile = false;
    const report = await w.run({ to: "d1" });
    assert.equal(report.status, "aborted");
    assert.ok(sourcesAre(w, "supabase"));
    assert.equal(w.flag(WRITE_PAUSED_KEY), "off");
    assert.equal(w.flag(SYNC_FLAG_KEY), "on");
    assert.deepEqual(w.events(), ["write.paused=on", "sync.enabled=off", "sync.enabled=on", "write.paused=off"]);
  });

  await check("to supabase: pause, wait for the outbox, flip, unpause, re-fill, sync on", async () => {
    const w = world({ sources: "d1", sync: "off" });
    w.db.prepare("INSERT INTO outbox (table_name, op, match_key, payload, created_at) VALUES ('likes', 'delete', '{\"story_id\":\"a\",\"user_id\":\"u\"}', NULL, 1)").run();
    let mirrored = false;
    let pausedWhenMirrored: string | undefined;
    w.ticks.push(() => {
      // The cron mirror sends the last row during the wait.
      if (!mirrored) {
        pausedWhenMirrored = w.flag(WRITE_PAUSED_KEY);
        w.db.prepare("DELETE FROM outbox").run();
        mirrored = true;
      }
    });
    const report = await w.run({ to: "supabase" });
    assert.equal(report.status, "done", report.lines.join("\n"));
    assert.equal(pausedWhenMirrored, "on");
    assert.ok(sourcesAre(w, "supabase"));
    assert.equal(w.flag(WRITE_PAUSED_KEY), "off");
    assert.equal(w.calls.refill, 1);
    assert.equal(w.flag(SYNC_FLAG_KEY), "on", "the sync follows Supabase again after the re-fill");
    assert.deepEqual(w.events(), ["write.paused=on", ...SOURCE_KEYS.map((key) => `${key}=supabase`), "write.paused=off", "sync.enabled=on"]);
  });

  await check("to supabase: an open out reject that does not clear is undone; D1 stays the source", async () => {
    const w = world({ sources: "d1", sync: "off" });
    w.db.prepare("INSERT INTO sync_rejects (direction, ref, table_name, d1_table, row_key, op, reason, payload, error, first_at, last_at) VALUES ('out', 3, 'likes', 'likes', '{}', 'insert', 'supabase_4xx', '{}', '23503', 1, 1)").run();
    const report = await w.run({ to: "supabase", outboxTimeoutMs: 30_000 });
    assert.equal(report.status, "aborted");
    assert.ok(sourcesAre(w, "d1"));
    assert.equal(w.flag(WRITE_PAUSED_KEY), "off");
    assert.equal(w.calls.refill, 0);
  });

  await check("to supabase: a failed re-fill leaves Supabase the source and the sync off", async () => {
    const w = world({ sources: "d1", sync: "off" });
    w.result.refill = false;
    const report = await w.run({ to: "supabase" });
    assert.equal(report.status, "failed");
    assert.ok(sourcesAre(w, "supabase"));
    assert.equal(w.flag(WRITE_PAUSED_KEY), "off");
    assert.equal(w.flag(SYNC_FLAG_KEY), "off");
  });

  await check("to supabase: refused while the sync is on or a source is still supabase; --no-refill skips the re-fill", async () => {
    assert.equal((await world({ sources: "d1", sync: "on" }).run({ to: "supabase" })).status, "refused");
    assert.equal((await world({ sources: "supabase", sync: "off" }).run({ to: "supabase" })).status, "refused");
    const w = world({ sources: "d1", sync: "off" });
    const report = await w.run({ to: "supabase", skipRefill: true });
    assert.equal(report.status, "done");
    assert.equal(w.calls.refill, 0);
    assert.equal(w.flag(SYNC_FLAG_KEY), "off");
  });

  await check("the change log reader pages and keeps this env and env-less rows", async () => {
    const w = world({ log: Array.from({ length: 2500 }, (_, i) => ({ id: i + 1, env: i % 3 === 0 ? "production" : i % 3 === 1 ? "development" : null })) });
    assert.equal(await w.ports.changeLog.head(), 2500);
    const ids = await w.ports.changeLog.ids(10, 2400, "development");
    const expected = w.log.filter((row) => row.id > 10 && row.id <= 2400 && row.env !== "production").map((row) => row.id);
    assert.deepEqual(ids, expected);
  });

  await check("the CLI stops on its arguments before any call", () => {
    const cli = (args: string[], env: Record<string, string> = {}) =>
      spawnSync(process.execPath, ["--import", "tsx", "scripts/d1-cutover.ts", ...args], {
        encoding: "utf8",
        env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", ...env } as unknown as NodeJS.ProcessEnv,
      });
    const production = cli(["--to", "d1", "--env", "production", "--note", "x"]);
    assert.equal(production.status, 2);
    assert.match(production.stderr, /--confirm-production/);
    const missing = cli(["--to", "d1", "--env", "testbed", "--note", "x"]);
    assert.equal(missing.status, 2);
    assert.match(missing.stderr, /missing environment: SUPABASE_URL/);
    assert.equal(cli(["--to", "sideways", "--env", "testbed", "--note", "x"]).status, 2);
    assert.equal(cli(["--to", "d1", "--env", "testbed"]).status, 2, "a note is required");
    assert.equal(cli(["--to", "d1", "--env", "testbed", "--note", "x", "--remote"]).status, 2, "unknown arguments stop");
  });

  console.log(`d1-cutover: ${checks} checks passed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

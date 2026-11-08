/**
 * The first copy and the re-fill (docs/supabase-exit/D1_SCHEMA_DESIGN.md 5.2), target and source
 * given. Steps: preflight the target, W0, dump, plan (map, summaries, checks), rehearse the whole copy
 * on an in-memory SQLite copy of the D1 schema (with L0 as it is then), stop on any check 5.2 says to
 * ask about, then (unless dry run) drop and re-create for a re-fill, write in bounded batches, take L0
 * again and write the watermark row last (step 7), and verify the target against the rehearsal.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { D1Statement } from "../../src/lib/d1-sync/statements";
import { SUPABASE_TABLES } from "../../src/lib/d1-sync/row-mapper";
import {
  buildFirstCopyPlan,
  parseDumpCopyBlocks,
  statementTable,
  stopReasons,
  type DataEnv,
  type FirstCopyPlan,
  type SizeStats,
} from "./first-copy-plan";
import {
  BudgetStop,
  dropOrder,
  ROOT,
  splitSqlScript,
  SqliteTarget,
  stepTwoMigrations,
  stepTwoTables,
  toWire,
  WriteBudget,
  type D1Target,
  type PlannedWrite,
} from "./first-copy-d1";
import type { CopySource } from "./first-copy-source";
import { listAnswerBytes } from "./run-summary-compare";

/** What the first copy may write on one day: the free limit (100,000 rows per account) minus room for the sync and the app. */
export const DEFAULT_WRITE_BUDGET = 80_000;

/** fixtures.sql "Derived fill, as the first copy does it" (design 5.2 step 6); ?1 = threads.updated_at. */
export const THREADS_FILL_SQL =
  "INSERT INTO threads (thread_key, like_count, comment_count, last_comment_at, updated_at)\n" +
  "SELECT k, sum(l), sum(c), max(m), ?1 FROM (\n" +
  "  SELECT story_id AS k, count(*) AS l, 0 AS c, NULL AS m FROM likes GROUP BY story_id\n" +
  "  UNION ALL\n" +
  "  SELECT story_id, 0, count(*), max(created_at) FROM comments GROUP BY story_id\n" +
  ") WHERE true GROUP BY k";
export const COMMENT_LIKES_FILL_SQL =
  "UPDATE comments SET like_count = (SELECT count(*) FROM comment_likes l WHERE l.comment_id = comments.id)";
/** Design 5.2 step 7: low_watermark = high_seen = L0 - 1 on an empty sync_state. */
export const WATERMARK_SQL = "INSERT INTO sync_state (name, low_watermark, high_seen) VALUES ('supabase_in', ?1, ?1)";

/** One statement of docs/supabase-exit/d1-schema/queries.sql by id, without its trailing ';'. */
export function queryById(id: string, file = join(ROOT, "docs/supabase-exit/d1-schema/queries.sql")): string {
  const lines = readFileSync(file, "utf8").split("\n");
  const start = lines.findIndex((line) => line.startsWith(`-- @ ${id} `));
  if (start < 0) throw new Error(`queries.sql has no ${id}`);
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    body.push(line);
    if (line.trimEnd().endsWith(";")) break;
  }
  return body.join("\n").trim().replace(/;$/, "");
}

export interface FirstCopyOptions {
  target: D1Target;
  source: CopySource;
  env: DataEnv;
  refill: boolean;
  dryRun: boolean;
  /** Remote targets only; local targets have no daily write limit. */
  writeBudget?: number;
  nowMs?: number;
  log?: (line: string) => void;
}

export interface Snapshot {
  counts: Record<string, number>;
  derived: Record<string, number>;
  summaryVersionZero: number;
  syncState: { low_watermark: number; high_seen: number; applied_above: string } | null;
  listRows: number;
  listAnswerBytes: number;
  fkViolations: number;
}

export interface FirstCopyReport {
  env: DataEnv;
  target: string;
  source: string;
  mode: "first copy" | "re-fill";
  dryRun: boolean;
  w0: number;
  l0: number | null;
  watermark: number;
  dumpBytes: number;
  plan: Pick<FirstCopyPlan, "tallies" | "expected" | "checks">;
  stops: string[];
  rehearsal: Snapshot;
  counterDrift: Record<string, number>;
  writes: {
    statements: number;
    estimatedRows: number;
    estimateByTable: Record<string, number>;
    budget: number | null;
    dropRowsWritten: number | null;
    rowsWritten: number | null;
    requests: number | null;
  };
  verification: { snapshot: Snapshot; differences: string[] } | null;
  outcome: "ok" | "dry run" | "stopped";
}

const THREAD_PREFIX_SQL =
  "CASE p.service WHEN 'combo' THEN 'c-c-c-combo' WHEN 'chemical_x' THEN 'chemical-x' WHEN 'transfigure' THEN 'transfigure' " +
  "WHEN 'this_or_that' THEN 'this-or-that' WHEN 'favorite_tournament' THEN 'favorite-tournament' " +
  "WHEN 'decisions_decisions' THEN 'decisions-decisions' WHEN 'pagestorm' THEN 'pagestorm' " +
  "WHEN 'history_course' THEN 'history-course' END || ':' || p.id";

/** Copied counters that differ from the row counts (report only, design 10.1, tasks/010 #68). */
async function counterDrift(target: D1Target): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const add = (rows: Array<Record<string, unknown>>, kind: string) => {
    for (const row of rows) out[`${kind}:${row.service}`] = Number(row.n);
  };
  add(
    await target.all(
      `SELECT p.service, count(*) AS n FROM posts p LEFT JOIN threads t ON t.thread_key = ${THREAD_PREFIX_SQL} ` +
        "WHERE p.service <> 'this_or_that' AND p.like_count <> coalesce(t.like_count, 0) GROUP BY p.service",
    ),
    "like_count",
  );
  add(
    await target.all(
      "SELECT p.service, count(*) AS n FROM posts p WHERE p.service = 'this_or_that' AND p.like_count <> " +
        "(SELECT count(*) FROM this_or_that_post_likes l WHERE l.service = p.service AND l.post_id = p.id) GROUP BY p.service",
    ),
    "like_count",
  );
  add(
    await target.all(
      `SELECT p.service, count(*) AS n FROM posts p LEFT JOIN threads t ON t.thread_key = ${THREAD_PREFIX_SQL} ` +
        "WHERE p.comment_count <> coalesce(t.comment_count, 0) GROUP BY p.service",
    ),
    "comment_count",
  );
  add(
    await target.all(
      "SELECT s.service, count(*) AS n FROM post_this_or_that s WHERE " +
        "s.left_vote_count <> (SELECT count(*) FROM this_or_that_post_votes v WHERE v.service = s.service AND v.post_id = s.post_id AND v.choice = 'left') " +
        "OR s.right_vote_count <> (SELECT count(*) FROM this_or_that_post_votes v WHERE v.service = s.service AND v.post_id = s.post_id AND v.choice = 'right') " +
        "GROUP BY s.service",
    ),
    "vote_count",
  );
  add(
    await target.all(
      "SELECT s.service, count(*) AS n FROM post_favorite_tournament s WHERE s.play_count <> " +
        "(SELECT count(*) FROM favorite_tournament_plays f WHERE f.service = s.service AND f.tournament_id = s.post_id) GROUP BY s.service",
    ),
    "play_count",
  );
  return out;
}

/** The post-copy state the rehearsal and the target must agree on. */
export async function snapshot(target: D1Target, tables: readonly string[] = stepTwoTables()): Promise<Snapshot> {
  const [countRow] = await target.all(`SELECT ${tables.map((t) => `(SELECT count(*) FROM ${t}) AS ${t}`).join(", ")}`);
  const counts: Record<string, number> = Object.fromEntries(tables.map((t) => [t, Number(countRow[t])]));
  for (const row of await target.all("SELECT service, count(*) AS n FROM posts GROUP BY service")) {
    counts[`posts:${row.service}`] = Number(row.n);
  }
  const [derivedRow] = await target.all(
    "SELECT (SELECT coalesce(sum(like_count), 0) FROM threads) AS thread_likes, " +
      "(SELECT coalesce(sum(comment_count), 0) FROM threads) AS thread_comments, " +
      "(SELECT count(*) FROM threads WHERE like_count = 0 AND comment_count = 0) AS empty_threads, " +
      "(SELECT coalesce(sum(like_count), 0) FROM comments) AS comment_like_sum",
  );
  const derived = Object.fromEntries(Object.entries(derivedRow).map(([key, value]) => [key, Number(value)]));
  const [zero] = await target.all("SELECT count(*) AS n FROM post_history_course WHERE summary_version = 0");
  const [state] = await target.all("SELECT low_watermark, high_seen, applied_above FROM sync_state WHERE name = 'supabase_in'");
  const list = await target.all(queryById("R1"));
  const fk = await target.all("PRAGMA foreign_key_check");
  return {
    counts,
    derived,
    summaryVersionZero: Number(zero.n),
    syncState: state
      ? { low_watermark: Number(state.low_watermark), high_seen: Number(state.high_seen), applied_above: String(state.applied_above) }
      : null,
    listRows: list.length,
    listAnswerBytes: listAnswerBytes(list),
    fkViolations: fk.length,
  };
}

function compareSnapshots(expected: Snapshot, actual: Snapshot): string[] {
  const out: string[] = [];
  const keys = new Set([...Object.keys(expected.counts), ...Object.keys(actual.counts)]);
  for (const key of keys) {
    if ((expected.counts[key] ?? 0) !== (actual.counts[key] ?? 0)) out.push(`${key}: rehearsal ${expected.counts[key] ?? 0}, target ${actual.counts[key] ?? 0}`);
  }
  for (const key of Object.keys(expected.derived)) {
    if (expected.derived[key] !== actual.derived[key]) out.push(`${key}: rehearsal ${expected.derived[key]}, target ${actual.derived[key]}`);
  }
  for (const key of ["summaryVersionZero", "listRows", "listAnswerBytes", "fkViolations"] as const) {
    if (expected[key] !== actual[key]) out.push(`${key}: rehearsal ${expected[key]}, target ${actual[key]}`);
  }
  if (JSON.stringify(expected.syncState) !== JSON.stringify(actual.syncState)) {
    out.push(`sync_state: rehearsal ${JSON.stringify(expected.syncState)}, target ${JSON.stringify(actual.syncState)}`);
  }
  return out;
}

/** Rehearsal results the plan expects: row counts per table, threads and like sums from the copied rows. */
function rehearsalProblems(plan: FirstCopyPlan, snap: Snapshot): string[] {
  const out: string[] = [];
  for (const [key, n] of Object.entries(plan.expected)) {
    if ((snap.counts[key] ?? 0) !== n) out.push(`rehearsal ${key}: ${snap.counts[key] ?? 0} rows, the dump gives ${n}`);
  }
  const copied = (table: string) => plan.tallies.find((t) => t.table === table)!.copied;
  if (snap.derived.thread_likes !== copied("likes")) out.push(`threads like_count sum ${snap.derived.thread_likes} != likes rows ${copied("likes")}`);
  if (snap.derived.thread_comments !== copied("comments")) {
    out.push(`threads comment_count sum ${snap.derived.thread_comments} != comments rows ${copied("comments")}`);
  }
  if (snap.derived.comment_like_sum !== copied("comment_likes")) {
    out.push(`comments like_count sum ${snap.derived.comment_like_sum} != comment_likes rows ${copied("comment_likes")}`);
  }
  if (snap.derived.empty_threads !== 0) out.push(`threads rows with no like and no comment: ${snap.derived.empty_threads}`);
  if (snap.summaryVersionZero !== 0) out.push(`runs with summary_version 0 after the copy: ${snap.summaryVersionZero} (expected 0)`);
  if (snap.fkViolations !== 0) out.push(`PRAGMA foreign_key_check: ${snap.fkViolations} rows`);
  return out;
}

function indexCounts(target: SqliteTarget, tables: readonly string[]): Map<string, number> {
  const withoutRowid = new Set(
    (target.db.prepare("SELECT name FROM pragma_table_list WHERE schema = 'main' AND wr = 1").all() as Array<{ name: string }>).map((r) => r.name),
  );
  return new Map(
    tables.map((table) => {
      const list = target.db.prepare("SELECT origin FROM pragma_index_list(?1)").all(table) as Array<{ origin: string }>;
      return [table, list.filter((index) => !(withoutRowid.has(table) && index.origin === "pk")).length];
    }),
  );
}

/** Rows written, from the rows a statement changed in the rehearsal: an index entry per index for INSERT and DELETE. */
function estimateRows(sql: string, changes: number, indexes: Map<string, number>): number {
  if (sql.startsWith("UPDATE")) return changes;
  if (sql.startsWith("INSERT") || sql.startsWith("DELETE")) return changes * (1 + (indexes.get(statementTable(sql)) ?? 0));
  return 0;
}

function planned(statement: D1Statement, estimate = 0): PlannedWrite {
  return { wire: toWire(statement), estimate };
}

/** Run the copy; never writes when a check stops it or in a dry run. */
export async function runFirstCopy(opts: FirstCopyOptions): Promise<FirstCopyReport> {
  const log = opts.log ?? (() => {});
  const nowMs = opts.nowMs ?? Date.now();
  const tables = stepTwoTables();
  const migrations = stepTwoMigrations();
  const stops: string[] = [];

  // 1. Preflight: the step-2 migrations are applied; a first copy needs every step-2 table empty.
  log(`preflight ${opts.target.label}`);
  const present = new Set((await opts.target.all("SELECT name FROM sqlite_schema WHERE type = 'table'")).map((r) => String(r.name)));
  const applied = present.has("d1_migrations")
    ? new Set((await opts.target.all("SELECT name FROM d1_migrations")).map((r) => String(r.name)))
    : new Set<string>();
  const missingMigrations = migrations.map((m) => m.name).filter((name) => !applied.has(name));
  // A re-fill re-creates the tables itself (also after a re-fill that stopped half way).
  const missingTables = opts.refill ? [] : tables.filter((t) => !present.has(t));
  if (missingMigrations.length || missingTables.length) {
    stops.push(
      `the target lacks the step-2 schema (migrations not applied: ${missingMigrations.join(", ") || "none"}; tables missing: ` +
        `${missingTables.join(", ") || "none"}); apply d1/migrations with wrangler d1 migrations apply first`,
    );
  } else if (!opts.refill) {
    const [row] = await opts.target.all(`SELECT ${tables.map((t) => `(SELECT count(*) FROM (SELECT 1 FROM ${t} LIMIT 1)) AS ${t}`).join(", ")}`);
    const filled = tables.filter((t) => Number(row[t]) > 0);
    if (filled.length) stops.push(`the target already holds rows in ${filled.join(", ")}: a copy over them needs --refill`);
  } else if (present.has("outbox") && present.has("sync_rejects")) {
    // Design 5.5: a re-fill after step 5 comes only once the outbox is empty with no open 'out' reject.
    const [row] = await opts.target.all(
      "SELECT (SELECT count(*) FROM outbox) AS outbox, " +
        "(SELECT count(*) FROM sync_rejects WHERE direction = 'out' AND resolved_at IS NULL) AS open_out",
    );
    if (Number(row.outbox) > 0 || Number(row.open_out) > 0) {
      stops.push(`the outbox holds ${row.outbox} rows and ${row.open_out} open 'out' rejects: send them before a re-fill (design 5.5)`);
    }
  }

  // 2-3. W0 just before the dump, then the dump (one snapshot).
  const w0 = await opts.source.maxChangeLogId();
  log(`W0 = ${w0}; dumping ${SUPABASE_TABLES.length} tables from ${opts.source.label}`);
  const dumpText = await opts.source.dumpData(SUPABASE_TABLES);

  // 4. Plan: map the env's rows, run summaries, the 5.2 checks.
  const plan = buildFirstCopyPlan(parseDumpCopyBlocks(dumpText), opts.env, nowMs);
  stops.push(...stopReasons(plan));

  // 7, previewed for the rehearsal and the report: L0 by the 5-minute rule; an empty log starts at 0.
  // The written row takes L0 again after the copy (step 7), so a lower id that commits late still counts.
  const fiveMinuteL0 = () => (w0 > 0 ? opts.source.firstIdWithinFiveMinutes(w0) : Promise.resolve(null));
  const l0 = await fiveMinuteL0();
  const watermark = l0 === null ? 0 : l0 - 1;

  const writes: D1Statement[] = [
    ...plan.statements.map((p) => p.statement),
    // 6. Derived values from the copied rows.
    { sql: THREADS_FILL_SQL, params: [nowMs] },
    { sql: COMMENT_LIKES_FILL_SQL, params: [] },
    { sql: WATERMARK_SQL, params: [watermark] },
  ];

  // Rehearsal: the whole copy on an in-memory copy of the schema, FKs on and not deferred.
  log(`rehearsing ${writes.length} statements`);
  const rehearsalTarget = new SqliteTarget();
  let rehearsal: Snapshot;
  let counterDriftReport: Record<string, number> = {};
  let plannedWrites: PlannedWrite[] = [];
  const estimateByTable: Record<string, number> = {};
  try {
    const wires = writes.map((statement) => planned(statement));
    const { changes } = await rehearsalTarget.write(wires);
    const indexes = indexCounts(rehearsalTarget, tables);
    plannedWrites = wires.map((write, i) => ({ ...write, estimate: estimateRows(writes[i].sql, changes[i], indexes) }));
    plannedWrites.forEach((write, i) => {
      const table = statementTable(writes[i].sql);
      estimateByTable[table] = (estimateByTable[table] ?? 0) + write.estimate;
    });
    rehearsal = await snapshot(rehearsalTarget, tables);
    counterDriftReport = await counterDrift(rehearsalTarget);
  } catch (error) {
    stops.push(`the rehearsal failed: ${(error as Error).message}`);
    rehearsal = { counts: {}, derived: {}, summaryVersionZero: 0, syncState: null, listRows: 0, listAnswerBytes: 0, fkViolations: 0 };
  } finally {
    await rehearsalTarget.close();
  }
  if (Object.keys(rehearsal.counts).length) stops.push(...rehearsalProblems(plan, rehearsal));

  const estimatedRows = plannedWrites.reduce((total, w) => total + w.estimate, 0);
  const budget = opts.target.remote ? (opts.writeBudget ?? DEFAULT_WRITE_BUDGET) : null;
  if (budget !== null && estimatedRows > budget) {
    stops.push(`the copy writes about ${estimatedRows} rows, over the write budget ${budget}: fill the other database on another day`);
  }

  const report: FirstCopyReport = {
    env: opts.env,
    target: opts.target.label,
    source: opts.source.label,
    mode: opts.refill ? "re-fill" : "first copy",
    dryRun: opts.dryRun,
    w0,
    l0,
    watermark,
    dumpBytes: Buffer.byteLength(dumpText, "utf8"),
    plan: { tallies: plan.tallies, expected: plan.expected, checks: plan.checks },
    stops,
    rehearsal,
    counterDrift: counterDriftReport,
    writes: {
      statements: writes.length,
      estimatedRows,
      estimateByTable,
      budget,
      dropRowsWritten: null,
      rowsWritten: null,
      requests: null,
    },
    verification: null,
    outcome: stops.length ? "stopped" : opts.dryRun ? "dry run" : "ok",
  };
  if (stops.length || opts.dryRun) return report;

  // Writes. A re-fill first drops the step-2 tables leaf-first and re-applies their DDL (design 5.2).
  const writeBudget = budget === null ? undefined : new WriteBudget(budget);
  try {
    let requests = 0;
    if (opts.refill) {
      log(`re-fill: dropping ${tables.length} tables leaf-first`);
      const drop = await opts.target.write(dropOrder(tables).map((t) => planned({ sql: `DROP TABLE IF EXISTS ${t}`, params: [] })), writeBudget);
      report.writes.dropRowsWritten = drop.rowsWritten;
      requests += drop.requests;
      for (const file of migrations) {
        log(`re-fill: applying ${file.name}`);
        const ddl = await opts.target.write(splitSqlScript(file.text).map((sql) => planned({ sql, params: [] })), writeBudget);
        requests += ddl.requests;
      }
    }
    log(`writing ${plannedWrites.length} statements (about ${estimatedRows} rows)`);
    const copied = plannedWrites.slice(0, -1);
    const result = await opts.target.write(copied, writeBudget);
    // 7. L0 again now that the copy is in, then the watermark row last.
    report.l0 = await fiveMinuteL0();
    report.watermark = report.l0 === null ? 0 : report.l0 - 1;
    log(`L0 = ${report.l0 ?? "none"}; writing the watermark ${report.watermark}`);
    const markEstimate = plannedWrites[plannedWrites.length - 1].estimate;
    const mark = await opts.target.write([planned({ sql: WATERMARK_SQL, params: [report.watermark] }, markEstimate)], writeBudget);
    report.writes.rowsWritten = result.rowsWritten + mark.rowsWritten;
    report.writes.requests = requests + result.requests + mark.requests;
  } catch (error) {
    report.outcome = "stopped";
    report.stops.push(
      error instanceof BudgetStop
        ? `${error.message}; the target is partly filled: re-fill it on another day`
        : `writing failed: ${(error as Error).message}; the target may be partly filled: re-fill it (--refill)`,
    );
    return report;
  }

  // Verify the target against the rehearsal.
  log("verifying the target");
  let snap: Snapshot;
  try {
    snap = await snapshot(opts.target, tables);
  } catch (error) {
    report.outcome = "stopped";
    report.stops.push(`the copy is written but reading it back failed: ${(error as Error).message}`);
    return report;
  }
  const written = { low_watermark: report.watermark, high_seen: report.watermark, applied_above: "[]" };
  const differences = compareSnapshots({ ...rehearsal, syncState: written }, snap);
  report.verification = { snapshot: snap, differences };
  if (differences.length) {
    report.outcome = "stopped";
    report.stops.push(`the target differs from the rehearsal: ${differences.join("; ")}`);
  }
  return report;
}

// ------------------------------------------------------------------------------------------- report

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function stats(s: SizeStats): string {
  return `max ${kb(s.max)}, median ${kb(s.median)} (${s.count})`;
}

function entries(record: Record<string, number>): string {
  const list = Object.entries(record);
  return list.length ? list.map(([key, n]) => `${key} ${n}`).join(", ") : "0";
}

export function formatReport(r: FirstCopyReport): string {
  const out: string[] = [];
  const c = r.plan.checks;
  const mark = (ok: boolean) => (ok ? "[ok]" : "[STOP]");
  out.push(`d1 first copy: ${r.mode}${r.dryRun ? " (dry run, no D1 writes)" : ""}`);
  out.push(`  target: ${r.target}`);
  out.push(`  source: ${r.source}; Supabase env ${r.env}`);
  out.push(
    `  change log: W0 = ${r.w0}, L0 = ${r.l0 ?? "none (empty log)"}; sync_state supabase_in low_watermark = high_seen = ${r.watermark}` +
      `${r.writes.rowsWritten === null ? " (as of now; a copy takes L0 again after its writes)" : ""}`,
  );
  out.push(`  dump: ${kb(r.dumpBytes)}`);
  out.push("");
  out.push("rows per Supabase table (dump = every env, env = this env, copied = written to D1):");
  out.push(`  ${"table".padEnd(36)}${"dump".padStart(7)}${"env".padStart(7)}${"copied".padStart(8)}  skipped / rejects`);
  for (const t of r.plan.tallies) {
    const extra = [
      ...Object.entries(t.skipped).map(([k, n]) => `skipped ${k} ${n}`),
      ...Object.entries(t.rejects).filter(([k]) => !(k in t.skipped)).map(([k, n]) => `reject ${k} ${n}: ${t.rejectSamples[k]}`),
    ].join("; ");
    out.push(`  ${t.table.padEnd(36)}${String(t.dumpRows).padStart(7)}${String(t.envRows).padStart(7)}${String(t.copied).padStart(8)}  ${extra}`);
  }
  out.push("");
  out.push("rows per D1 table (rehearsal):");
  for (const [table, n] of Object.entries(r.rehearsal.counts)) {
    if (n > 0 || table in r.plan.expected) out.push(`  ${table.padEnd(40)}${String(n).padStart(7)}`);
  }
  out.push("");
  out.push("checks (design 5.2):");
  out.push(`  ${mark(!Object.keys(c.nullTimestamps).length)} NULL data timestamps: ${entries(c.nullTimestamps)}`);
  out.push(`  ${mark(!Object.keys(c.craftedTimestamps).length)} timestamps canonicalTs refuses: ${entries(c.craftedTimestamps)}`);
  out.push(`  ${mark(!c.nonUtcTimestamps.count)} dump in UTC: ${c.nonUtcTimestamps.count ? `no, ${c.nonUtcTimestamps.count} (${c.nonUtcTimestamps.sample})` : "yes"}`);
  out.push(`  ${mark(!Object.keys(c.craftedElements).length)} resources/pool elements not {type, id}: ${entries(c.craftedElements)}`);
  out.push(`  ${mark(!Object.keys(c.envMismatchChildren).length)} votes/plays/stats under a post of another env: ${entries(c.envMismatchChildren)}`);
  out.push(`  ${mark(!Object.keys(c.otherRejects).length)} other mapper rejects: ${entries(c.otherRejects)}`);
  out.push(
    `  ${mark(!c.runs.unreadable.length && !c.runs.overCap.length && r.rehearsal.summaryVersionZero === 0)} runs ${c.runs.count}: ` +
      `unreadable raws ${c.runs.unreadable.length}, raws over 1.9 MB ${c.runs.overCap.length}, ` +
      `summary_version 0 after the copy ${r.rehearsal.summaryVersionZero}`,
  );
  out.push(`  [report] this-or-that likes on a post of another env (cross_env, not copied): ${c.crossEnvLikes}`);
  out.push(`  [report] orphan defragment_bodies (no post, not copied): ${c.orphanBodies}`);
  out.push(`  [report] counters that differ from the row counts (copied as they are): ${entries(r.counterDrift)}`);
  out.push(`  [report] run raw ${stats(c.runs.rawBytes)}`);
  out.push(`  [report] list_facts ${stats(c.runs.listFacts)}; game_elements ${stats(c.runs.gameElements)}`);
  out.push(`  [report] ${r.rehearsal.listRows}-row list answer (R1): ${kb(r.rehearsal.listAnswerBytes)}`);
  out.push(
    `  [report] JSON max sizes: ${Object.entries(c.jsonMaxBytes)
      .sort((a, b) => b[1] - a[1])
      .map(([key, n]) => `${key} ${kb(n)}`)
      .join(", ")}`,
  );
  out.push(
    `  derived: threads ${r.rehearsal.counts.threads ?? 0} keys (likes ${r.rehearsal.derived.thread_likes ?? 0}, ` +
      `comments ${r.rehearsal.derived.thread_comments ?? 0}), comments.like_count sum ${r.rehearsal.derived.comment_like_sum ?? 0}`,
  );
  out.push("");
  out.push(
    `D1 writes: ${r.writes.statements} statements, about ${r.writes.estimatedRows} rows written` +
      `${r.writes.budget === null ? "" : ` (budget ${r.writes.budget})`}`,
  );
  out.push(`  by table: ${entries(r.writes.estimateByTable)}`);
  if (r.writes.dropRowsWritten !== null) out.push(`  re-fill DROP rows written (reported by D1): ${r.writes.dropRowsWritten}`);
  if (r.writes.rowsWritten !== null) out.push(`  rows written (reported by D1): ${r.writes.rowsWritten} in ${r.writes.requests} requests`);
  if (r.verification) {
    out.push(
      `  verification: ${r.verification.differences.length ? `${r.verification.differences.length} differences` : "the target equals the rehearsal"} ` +
        `(rows, derived values, run summaries, sync_state, R1 answer ${kb(r.verification.snapshot.listAnswerBytes)}, FK check)`,
    );
  }
  out.push("");
  if (r.stops.length) {
    out.push(`STOPPED (${r.stops.length}): ask before going on (design 5.2)`);
    for (const stop of r.stops) out.push(`  - ${stop}`);
  } else if (r.dryRun) {
    out.push("dry run: every check passed; nothing was written to D1");
  } else {
    out.push("done. Next (design 5.2 step 7): turn on the 1-minute sync cron for this database.");
  }
  return out.join("\n");
}

/**
 * Design 9 "런 요약" over a real Supabase backup: every run raw goes through the row mapper and the
 * summary extractor (RF2) into a local SQLite copy of the D1 schema, one database per env, and the
 * list inputs read back from the summary columns must equal the ones today's list builds from the
 * Supabase row and its raw, and the list the client builds from each (donatedRunsFromListRows, step 3)
 * is the same. Also maps every row of the 27 copied tables (a local first-copy dry run)
 * and reports rejects. Reports the run count, failures and the list_facts / game_elements sizes.
 *
 *   pnpm exec tsx scripts/d1-run-summary-backup-check.ts <backup dir with public.dump> [--work <dir>]
 *
 * Skipped (exit 0) when no backup directory is given or it has no public.dump. The backup holds
 * personal data: the extracted SQL goes to --work (default: a temp directory removed at the end) and
 * nothing from it is written into the repository.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalTs, postgrestTs } from "../src/lib/d1-time";
import { parseCopyLine } from "../src/lib/d1-sync/pg-text";
import {
  imageFromPgText,
  mapRow,
  rowEnv,
  runSummaryFillStatement,
  SUPABASE_TABLES,
  type RowImage,
} from "../src/lib/d1-sync/row-mapper";
import type { D1Statement } from "../src/lib/d1-sync/statements";
import { donatedRunsFromListRows, extractRunListSummary } from "../src/lib/run-list-summary";
import type { RunRow } from "../src/lib/run-summary-row";
import { RECENT_DONATED_RUNS_LIMIT } from "../src/lib/history-runs-api-rules";
import { applyBatch, openD1TestDb, type SqliteDb } from "./d1-sync/test-db";
import {
  compareDonatedRuns,
  compareListInputs,
  d1ListRows,
  listAnswerBytes,
  popularElementsMatch,
  summaryRowFromD1,
} from "./d1-sync/run-summary-compare";

const args = process.argv.slice(2);
const workFlag = args.indexOf("--work");
const workArg = workFlag >= 0 ? args[workFlag + 1] : undefined;
const backupDir = args.find((arg, i) => !arg.startsWith("--") && (workFlag < 0 || i !== workFlag + 1)) ?? process.env.D1_SYNC_BACKUP_DIR;
const dumpPath = backupDir ? join(backupDir, "public.dump") : "";
if (!backupDir || !existsSync(dumpPath)) {
  console.log("d1 run summary backup check skipped (no backup directory with public.dump given)");
  process.exit(0);
}

function pgRestoreBin(): string {
  if (process.env.PG_RESTORE) return process.env.PG_RESTORE;
  const brew = "/opt/homebrew/opt/libpq/bin/pg_restore";
  return existsSync(brew) ? brew : "pg_restore";
}

const workDir = workArg ?? mkdtempSync(join(tmpdir(), "d1-backup-check-"));
const sqlPath = join(workDir, "public-data.sql");
(async () => {
  try {
    execFileSync(pgRestoreBin(), ["--data-only", "-f", sqlPath, dumpPath], { stdio: ["ignore", "ignore", "inherit"] });
    await main(readFileSync(sqlPath, "utf8"));
  } finally {
    if (!workArg) rmSync(workDir, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

type PgRow = Record<string, string | null>;

function copyBlocks(text: string): Map<string, PgRow[]> {
  const blocks = new Map<string, PgRow[]>();
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const match = /^COPY public\.(\w+) \((.*)\) FROM stdin;$/.exec(lines[i]);
    if (!match) continue;
    const columns = match[2].split(",").map((name) => name.trim().replace(/^"|"$/g, ""));
    const out: PgRow[] = [];
    for (i += 1; lines[i] !== "\\."; i++) {
      const fields = parseCopyLine(lines[i]);
      out.push(Object.fromEntries(columns.map((name, j) => [name, fields[j]])));
    }
    blocks.set(match[1], out);
  }
  return blocks;
}

function sizes(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted.length === 0 ? 0 : sorted.length % 2
    ? sorted[(sorted.length - 1) / 2]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  return { max: sorted.at(-1) ?? 0, median };
}

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function main(text: string) {
  const blocks = copyBlocks(text);
  const images = new Map<string, RowImage[]>();
  for (const table of SUPABASE_TABLES) {
    const rows = blocks.get(table);
    if (!rows) throw new Error(`the backup has no ${table} table`);
    images.set(table, rows.map((row) => imageFromPgText(table, row)));
  }

  // Env of each FK parent and of each comment (comment_likes has none).
  const envOf = (table: string) => new Map(images.get(table)!.map((image) => [String(image.id), rowEnv(image)]));
  const commentEnv = envOf("comments");
  const thisOrThatEnv = envOf("this_or_that_posts");
  const tournamentEnv = envOf("favorite_tournament_posts");
  const parentEnvOf = (table: string, image: RowImage): string | null | undefined => {
    if (table === "this_or_that_post_likes" || table === "this_or_that_post_votes") return thisOrThatEnv.get(String(image.post_id)) ?? null;
    if (table === "favorite_tournament_plays" || table === "favorite_tournament_candidate_stats") {
      return tournamentEnv.get(String(image.tournament_id)) ?? null;
    }
    return undefined;
  };

  const envs = [...new Set(images.get("runs")!.map((image) => rowEnv(image)!))].sort();
  let failures = 0;
  let mapperProblems = 0;
  const allFacts: number[] = [];
  const allElements: number[] = [];
  let runCount = 0;

  for (const env of envs) {
    const db: SqliteDb = openD1TestDb();
    // ---------------------------------------------------------------- every copied table
    const rejects = new Map<string, number>();
    const statements: D1Statement[] = [];
    const bodyStatements: number[] = [];
    let mapped = 0;
    for (const table of SUPABASE_TABLES) {
      for (const image of images.get(table)!) {
        const env0 = table === "comment_likes" ? commentEnv.get(String(image.comment_id)) ?? null : rowEnv(image);
        if (env0 !== null && env0 !== env) continue;
        const result = mapRow(table, image, { nowMs: 0, parentEnv: parentEnvOf(table, image) });
        if (!result.ok) {
          const key = `${table}:${result.reject.reason}`;
          rejects.set(key, (rejects.get(key) ?? 0) + 1);
          continue;
        }
        mapped += 1;
        if (table === "defragment_bodies") bodyStatements.push(statements.length);
        statements.push(...result.statements);
      }
    }
    const counts = applyBatch(db, statements);
    const orphans = bodyStatements.filter((index) => counts[index] === 0).length;
    const fkProblems = db.prepare("PRAGMA foreign_key_check").all().length;
    const unexpected = [...rejects].filter(([key]) => !key.endsWith(":cross_env"));
    mapperProblems += unexpected.reduce((sum, [, n]) => sum + n, 0) + fkProblems;
    console.log(`[${env}] mapped ${mapped} rows of ${SUPABASE_TABLES.length} tables; rejects ${JSON.stringify(Object.fromEntries(rejects))}; orphan bodies ${orphans}; FK problems ${fkProblems}`);

    // ---------------------------------------------------------------- run summaries
    const runImages = images.get("runs")!.filter((image) => rowEnv(image) === env);
    const fills: D1Statement[] = [];
    let unreadable = 0;
    let overCap = 0;
    for (const image of runImages) {
      const raw = String(image.raw);
      if (new TextEncoder().encode(raw).length > 1_900_000) overCap += 1;
      try {
        fills.push(runSummaryFillStatement(String(image.id), extractRunListSummary(String(image.id), raw)));
      } catch {
        unreadable += 1;
      }
    }
    applyBatch(db, fills);
    const listRows = d1ListRows(db);
    const versionZero = listRows.filter((row) => row.summary_version === 0).length;
    const rawRows = new Map<string, RunRow>(runImages.map((image) => [String(image.id), {
      id: String(image.id), raw: String(image.raw), seed: image.seed as string, build: image.build as string,
      character: image.character as string, ascension: image.ascension as number, win: image.win as boolean,
      start_time: image.start_time as number | null, run_time: image.run_time as number | null,
      acts_count: image.acts_count as number, total_floors: image.total_floors as number,
      cover_spec: image.cover_spec as RunRow["cover_spec"],
      donor_user_id: image.donor_user_id as string | null, created_at: postgrestTs(canonicalTs(image.created_at))!,
    }]));
    const fieldFailures = new Map<string, number>();
    let envFailures = 0;
    for (const row of listRows) {
      if (row.summary_version === 0) continue;
      const diffs = compareListInputs(rawRows.get(String(row.id))!, summaryRowFromD1(row));
      if (diffs.length > 0) envFailures += 1;
      for (const diff of diffs) fieldFailures.set(diff, (fieldFailures.get(diff) ?? 0) + 1);
      allFacts.push(new TextEncoder().encode(String(row.list_facts)).length);
      allElements.push(new TextEncoder().encode(String(row.game_elements)).length);
    }
    const summaryRows = listRows.filter((row) => row.summary_version !== 0);
    const latest = summaryRows.slice(0, RECENT_DONATED_RUNS_LIMIT);
    const popularLatest = popularElementsMatch(latest.map((row) => rawRows.get(String(row.id))!), latest.map(summaryRowFromD1));
    const popularAll = popularElementsMatch(summaryRows.map((row) => rawRows.get(String(row.id))!), summaryRows.map(summaryRowFromD1));
    if (!popularLatest || !popularAll) envFailures += 1;
    // The client's list builder (step 3, donatedRunsFromListRows) on the Supabase rows and on the D1
    // rows: the latest list and every run (cards, search, popular chips).
    const neverRaw = async (): Promise<string | null> => {
      throw new Error("a row with a summary or a raw never reads R3r");
    };
    const clientDiffs: string[] = [];
    for (const rowsOfList of [latest, summaryRows]) {
      const today = await donatedRunsFromListRows(rowsOfList.map((row) => rawRows.get(String(row.id))!), neverRaw);
      const fromD1 = await donatedRunsFromListRows(rowsOfList.map(summaryRowFromD1) as unknown as RunRow[], neverRaw);
      clientDiffs.push(...compareDonatedRuns(today, fromD1));
    }
    if (clientDiffs.length > 0) envFailures += 1;
    failures += envFailures + unreadable + versionZero;
    runCount += runImages.length;

    const latestList = d1ListRows(db, RECENT_DONATED_RUNS_LIMIT);
    const todayBytes = new TextEncoder().encode(JSON.stringify(latestList.map((row) => rawRows.get(String(row.id))))).length;
    const factsSizes = sizes(listRows.map((row) => new TextEncoder().encode(String(row.list_facts)).length));
    const elementSizes = sizes(listRows.map((row) => new TextEncoder().encode(String(row.game_elements)).length));
    console.log(
      `[${env}] runs ${runImages.length}; unreadable raws ${unreadable}; raws over 1.9 MB ${overCap}; summary_version 0 after fill ${versionZero}; ` +
        `list-input failures ${envFailures}${fieldFailures.size ? ` ${JSON.stringify(Object.fromEntries(fieldFailures))}` : ""}; ` +
        `popular elements equal (latest ${latest.length}: ${popularLatest}, all: ${popularAll}); ` +
        `client list builder differences ${clientDiffs.length}${clientDiffs.length ? ` ${JSON.stringify(clientDiffs.slice(0, 10))}` : ""}`,
    );
    console.log(
      `[${env}] list_facts max ${kb(factsSizes.max)} median ${kb(factsSizes.median)}; game_elements max ${kb(elementSizes.max)} median ${kb(elementSizes.median)}; ` +
        `${latestList.length}-row list answer ${kb(listAnswerBytes(latestList))} (today with raws ${kb(todayBytes)})`,
    );
    db.close();
  }

  const facts = sizes(allFacts);
  const elements = sizes(allElements);
  console.log(
    `all envs: runs ${runCount}, failures ${failures}, mapper problems ${mapperProblems}; ` +
      `list_facts max ${kb(facts.max)} median ${kb(facts.median)}; game_elements max ${kb(elements.max)} median ${kb(elements.median)}`,
  );
  if (failures > 0 || mapperProblems > 0) process.exit(1);
}

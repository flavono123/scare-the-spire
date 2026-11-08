/**
 * The D1 first copy (scripts/d1-first-copy.ts, design 5.2) end to end over a real Supabase backup,
 * all local: the backup's schema and data go into a PGlite Postgres with the change-log migration and
 * a few logged changes, then the script copies each env into its own throwaway local D1 (dry run,
 * copy, a second copy that must stop, a re-fill with a new W0). The result is read back through
 * `wrangler d1 execute --local` and compared with counts taken straight from the backup.
 *
 *   pnpm exec tsx scripts/d1-first-copy-backup-check.ts <backup dir with public.dump and public-schema.sql> [--work <dir>]
 *
 * Skipped (exit 0) without a backup directory. The backup holds personal data: everything derived
 * from it goes to --work (default: a private temp directory removed at the end), never the repository.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { RUN_SUMMARY_VERSION } from "../src/lib/run-list-summary";
import { stepTwoTables } from "./d1-sync/first-copy-d1";
import { parseDumpCopyBlocks, type CopyBlock } from "./d1-sync/first-copy-plan";
import type { FirstCopyReport } from "./d1-sync/first-copy-run";
import { libpqBin } from "./d1-sync/first-copy-source";

const args = process.argv.slice(2);
const workFlag = args.indexOf("--work");
const workArg = workFlag >= 0 ? args[workFlag + 1] : undefined;
const backupDir = args.find((arg, i) => !arg.startsWith("--") && (workFlag < 0 || i !== workFlag + 1)) ?? process.env.D1_SYNC_BACKUP_DIR;
if (!backupDir || !existsSync(join(backupDir, "public.dump")) || !existsSync(join(backupDir, "public-schema.sql"))) {
  console.log("d1 first copy backup check skipped (no backup directory with public.dump and public-schema.sql given)");
  process.exit(0);
}

const ROOT = join(__dirname, "..");
const WORK = workArg ?? mkdtempSync(join(tmpdir(), "d1-first-copy-check-"));
mkdirSync(WORK, { recursive: true, mode: 0o700 });
const PGDATA = join(WORK, "pgdata");
let failures = 0;

function fail(message: string) {
  failures += 1;
  console.error(`FAIL ${message}`);
}

function expectEqual(actual: unknown, expected: unknown, what: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(`${what}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

// Stand-ins for what Supabase provides before its schema (as scripts/d1-change-log.spec.ts does).
const SUPABASE_BOOTSTRAP = `
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role supabase_admin nologin;
create schema auth;
create table auth.users (id uuid primary key, created_at timestamptz default now(), last_sign_in_at timestamptz);
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
create publication supabase_realtime;
`;

/** COPY blocks with their header and raw data lines, to load as they are. */
function rawCopyBlocks(text: string): Array<{ table: string; header: string; data: string }> {
  const out: Array<{ table: string; header: string; data: string }> = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const match = /^COPY public\.(\w+) \((.*)\) FROM stdin;$/.exec(lines[i]);
    if (!match) continue;
    const start = i + 1;
    while (lines[i] !== "\\.") i++;
    out.push({ table: match[1], header: `COPY public.${match[1]} (${match[2]}) FROM '/dev/blob'`, data: lines.slice(start, i).map((l) => `${l}\n`).join("") });
  }
  return out;
}

async function buildPostgres(dataSql: string) {
  const db = new PGlite(PGDATA);
  await db.exec(SUPABASE_BOOTSTRAP);
  const schema = readFileSync(join(backupDir!, "public-schema.sql"), "utf8")
    .split("\n")
    .filter((line) => !line.startsWith("\\"))
    .join("\n")
    .replace(/^CREATE SCHEMA public;$/m, "");
  await db.exec(schema);
  // Load the data as pg_restore --disable-triggers would: no FK checks against auth.users, no triggers.
  await db.exec("set session_replication_role = replica");
  for (const block of rawCopyBlocks(dataSql)) await db.query(block.header, [], { blob: new Blob([block.data]) });
  await db.exec("set session_replication_role = origin");
  const changeLog = readdirSync(join(ROOT, "supabase/migrations")).find((name) => name.endsWith("_d1_change_log.sql"))!;
  await db.exec(readFileSync(join(ROOT, "supabase/migrations", changeLog), "utf8"));
  await db.close();
}

/**
 * Two logged changes that end where they started (the data stays the backup's). Every log row but
 * the last is moved 10 minutes back, so L0 = W0 (the last id) by the 5-minute rule.
 */
async function logRoundTrip(): Promise<number> {
  const db = new PGlite(PGDATA);
  try {
    const { rows } = await db.query<{ id: string; body: string }>(
      "select id::text, body from public.colorful_philosopher_posts where env = 'development' order by id limit 1",
    );
    await db.query("update public.colorful_philosopher_posts set body = $2 where id = $1", [rows[0].id, `${rows[0].body} (edited)`]);
    await db.exec("update public.d1_change_log set changed_at = changed_at - interval '10 minutes'");
    await db.query("update public.colorful_philosopher_posts set body = $2 where id = $1", [rows[0].id, rows[0].body]);
    const max = await db.query<{ id: number }>("select max(id)::int as id from public.d1_change_log");
    return max.rows[0].id;
  } finally {
    await db.close();
  }
}

// ------------------------------------------------------------------------------------------- expected rows

const ENVLESS = new Set(["profile_character_nickname_pools", "puzzlebox_players"]);
const POST_SERVICES: Record<string, string> = {
  chemical_posts: "chemical_x",
  combo_posts: "combo",
  transfigure_posts: "transfigure",
  this_or_that_posts: "this_or_that",
  favorite_tournament_posts: "favorite_tournament",
  decisions_decisions_posts: "decisions_decisions",
  pagestorm_posts: "pagestorm",
  runs: "history_course",
};

/** D1 row counts of one env, straight from the backup's rows (independent of the copy's plan). */
function expectedCounts(blocks: Map<string, CopyBlock>, env: string) {
  const rows = (table: string) => blocks.get(table)!.rows;
  const commentEnv = new Map(rows("comments").map((r) => [r.id, r.env]));
  const inEnv = (table: string) =>
    rows(table).filter((r) => (ENVLESS.has(table) ? true : table === "comment_likes" ? commentEnv.get(r.comment_id) === env : r.env === env));
  const counts: Record<string, number> = {};
  const set = (key: string, n: number) => {
    if (n > 0) counts[key] = n;
  };
  const postKeys = new Set<string>();
  for (const [table, service] of Object.entries(POST_SERVICES)) {
    const list = inEnv(table);
    for (const r of list) postKeys.add(`${service}:${r.id}`);
    set(`posts:${service}`, list.length);
    set(`post_${service}`, list.length);
  }
  counts.posts = Object.entries(counts).filter(([k]) => k.startsWith("posts:")).reduce((a, [, n]) => a + n, 0);
  const length = (text: string | null) => (JSON.parse(text ?? "[]") as unknown[]).length;
  set("post_combo_resources", inEnv("combo_posts").reduce((a, r) => a + length(r.resources), 0));
  set("post_favorite_tournament_pool", inEnv("favorite_tournament_posts").reduce((a, r) => a + length(r.pool), 0));
  set("post_history_course_file", inEnv("runs").length);
  const postEnv = (table: string) => new Map(rows(table).map((r) => [r.id, r.env]));
  const totEnv = postEnv("this_or_that_posts");
  const ftEnv = postEnv("favorite_tournament_posts");
  set("this_or_that_post_votes", inEnv("this_or_that_post_votes").length);
  set("this_or_that_post_likes", inEnv("this_or_that_post_likes").filter((r) => totEnv.get(r.post_id) === env).length);
  set("favorite_tournament_candidate_stats", inEnv("favorite_tournament_candidate_stats").filter((r) => ftEnv.get(r.tournament_id) === env).length);
  set("favorite_tournament_plays", inEnv("favorite_tournament_plays").filter((r) => ftEnv.get(r.tournament_id) === env).length);
  const bodies = inEnv("defragment_bodies");
  set("defragment_bodies", bodies.filter((r) => postKeys.has(`${r.source_service}:${r.source_id}`)).length);
  for (const table of [
    "comments", "comment_likes", "likes", "resource_reactions", "resource_reaction_counts", "community_stories", "pagestorm_drafts",
    "profile_character_nickname_pools", "contact_inquiries", "puzzlebox_runs", "puzzlebox_players", "puzzlebox_best",
    "puzzlebox_board_stats", "colorful_philosopher_posts",
  ]) {
    set(table, inEnv(table).length);
  }
  set("threads", new Set([...inEnv("likes"), ...inEnv("comments")].map((r) => r.story_id)).size);
  counts.sync_state = 1;
  return {
    counts,
    orphans: bodies.length - (counts.defragment_bodies ?? 0),
    runs: inEnv("runs").length,
    likes: inEnv("likes").length,
    comments: inEnv("comments").length,
    commentLikes: inEnv("comment_likes").length,
  };
}

// ------------------------------------------------------------------------------------------- local D1

function wranglerEnvArgs(env: string): string[] {
  return env === "development" ? ["--env", "testbed"] : [];
}

function wrangler(args: string[]): string {
  return execFileSync("pnpm", ["exec", "wrangler", ...args], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/** One SELECT on a local D1 through wrangler (a read path apart from the script's). */
function d1Select(persistTo: string, env: string, sql: string): Array<Record<string, unknown>> {
  const out = wrangler(["d1", "execute", "DB", "--local", "--persist-to", persistTo, ...wranglerEnvArgs(env), "--json", "--command", sql]);
  const parsed = JSON.parse(out.slice(out.indexOf("["))) as Array<{ results: Array<Record<string, unknown>> }>;
  return parsed[0].results;
}

function firstCopy(persistTo: string, env: string, extra: string[], name: string): { code: number; report: FirstCopyReport | null; output: string } {
  const reportFile = join(WORK, `report-${name}.json`);
  rmSync(reportFile, { force: true });
  const result = spawnSync(
    "pnpm",
    ["exec", "tsx", "scripts/d1-first-copy.ts", "--local", "--persist-to", persistTo, "--data-env", env, "--pglite", PGDATA,
      "--work", join(WORK, `cli-${name}`), "--report-json", reportFile, ...extra],
    { cwd: ROOT, encoding: "utf8" },
  );
  const report = existsSync(reportFile) ? (JSON.parse(readFileSync(reportFile, "utf8")) as FirstCopyReport) : null;
  return { code: result.status ?? 1, report, output: `${result.stdout}\n${result.stderr}` };
}

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function verifyEnv(env: string, blocks: Map<string, CopyBlock>, persistTo: string, watermark: number, name: string) {
  const expected = expectedCounts(blocks, env);
  const tables = stepTwoTables();
  const [row] = d1Select(persistTo, env, `SELECT ${tables.map((t) => `(SELECT count(*) FROM ${t}) AS ${t}`).join(", ")}`);
  const actual: Record<string, number> = {};
  for (const t of tables) if (Number(row[t]) > 0) actual[t] = Number(row[t]);
  for (const r of d1Select(persistTo, env, "SELECT service, count(*) AS n FROM posts GROUP BY service")) actual[`posts:${r.service}`] = Number(r.n);
  const keys = [...new Set([...Object.keys(expected.counts), ...Object.keys(actual)])].sort();
  const differing = keys.filter((k) => (expected.counts[k] ?? 0) !== (actual[k] ?? 0));
  if (differing.length) {
    fail(`[${name}] D1 rows differ from the backup: ${differing.map((k) => `${k} D1 ${actual[k] ?? 0} backup ${expected.counts[k] ?? 0}`).join(", ")}`);
  }
  const [derived] = d1Select(
    persistTo,
    env,
    "SELECT (SELECT sum(like_count) FROM threads) AS thread_likes, (SELECT sum(comment_count) FROM threads) AS thread_comments, " +
      "(SELECT sum(like_count) FROM comments) AS comment_like_sum, " +
      `(SELECT count(*) FROM post_history_course WHERE summary_version = ${RUN_SUMMARY_VERSION} AND list_facts IS NOT NULL) AS summarized, ` +
      "(SELECT count(*) FROM post_history_course WHERE summary_version = 0) AS unsummarized, " +
      "(SELECT low_watermark || '/' || high_seen || '/' || applied_above FROM sync_state WHERE name = 'supabase_in') AS window",
  );
  expectEqual(
    {
      thread_likes: Number(derived.thread_likes ?? 0),
      thread_comments: Number(derived.thread_comments ?? 0),
      comment_like_sum: Number(derived.comment_like_sum ?? 0),
      summarized: Number(derived.summarized),
      unsummarized: Number(derived.unsummarized),
      window: derived.window,
    },
    {
      thread_likes: expected.likes,
      thread_comments: expected.comments,
      comment_like_sum: expected.commentLikes,
      summarized: expected.runs,
      unsummarized: 0,
      window: `${watermark}/${watermark}/[]`,
    },
    `[${name}] derived values, run summaries and the sync window`,
  );
  console.log(
    `[${name}] D1 rows equal the backup's ${env} rows in ${keys.length} tables (posts ${actual.posts ?? 0}, runs ${expected.runs}, ` +
      `threads ${actual.threads ?? 0}); orphan bodies in the backup ${expected.orphans}; sync window ${derived.window}`,
  );
  return expected;
}

async function main() {
  const dataSql = join(WORK, "public-data.sql");
  execFileSync(libpqBin("pg_restore"), ["--data-only", "-f", dataSql, join(backupDir!, "public.dump")], { stdio: ["ignore", "ignore", "inherit"] });
  const dataText = readFileSync(dataSql, "utf8");
  const blocks = parseDumpCopyBlocks(dataText);
  rmSync(PGDATA, { recursive: true, force: true });
  console.log("loading the backup into PGlite (schema, data, change-log migration)");
  await buildPostgres(dataText);
  const w0 = await logRoundTrip();
  expectEqual(w0, 2, "W0 after the round trip");

  for (const env of ["development", "production"]) {
    const name = env === "development" ? "dev" : "prod";
    const persistTo = join(WORK, `d1-${name}`);
    rmSync(persistTo, { recursive: true, force: true });
    wrangler(["d1", "migrations", "apply", "DB", "--local", "--persist-to", persistTo, ...wranglerEnvArgs(env)]);

    const dry = firstCopy(persistTo, env, ["--dry-run"], `${name}-dry`);
    expectEqual([dry.code, dry.report?.outcome], [0, "dry run"], `[${name}] dry run`);
    const [{ n: postsAfterDry }] = d1Select(persistTo, env, "SELECT count(*) AS n FROM posts");
    expectEqual(Number(postsAfterDry), 0, `[${name}] dry run writes nothing`);

    const run = firstCopy(persistTo, env, [], name);
    if (run.code !== 0 || !run.report) {
      fail(`[${name}] first copy exited ${run.code}\n${run.output.slice(-4000)}`);
      continue;
    }
    const r = run.report;
    expectEqual([r.w0, r.l0, r.watermark], [2, 2, 1], `[${name}] W0, L0 and the watermark (5-minute rule)`);
    const expected = await verifyEnv(env, blocks, persistTo, 1, name);
    expectEqual(r.plan.checks.orphanBodies, expected.orphans, `[${name}] orphan bodies reported`);
    expectEqual(r.plan.checks.runs.count, expected.runs, `[${name}] runs`);
    expectEqual(r.verification?.differences, [], `[${name}] the script's own verification`);
    console.log(
      `[${name}] report: runs ${r.plan.checks.runs.count}, orphan bodies ${r.plan.checks.orphanBodies}, cross_env likes ${r.plan.checks.crossEnvLikes}, ` +
        `counter drift ${JSON.stringify(r.counterDrift)}, ${r.rehearsal.listRows}-row list answer ${kb(r.rehearsal.listAnswerBytes)}, ` +
        `list_facts max ${kb(r.plan.checks.runs.listFacts.max)}, game_elements max ${kb(r.plan.checks.runs.gameElements.max)}, ` +
        `rows written estimate ${r.writes.estimatedRows} / reported by local D1 ${r.writes.rowsWritten} in ${r.writes.requests} batches, ` +
        `stops ${r.stops.length}`,
    );

    const again = firstCopy(persistTo, env, [], `${name}-again`);
    expectEqual([again.code, again.report?.stops.some((s) => /already holds rows/.test(s))], [2, true], `[${name}] a second first copy stops`);
  }

  // Re-fill the development D1 with a new W0 (two more logged changes).
  const w0b = await logRoundTrip();
  expectEqual(w0b, 4, "W0 for the re-fill");
  const persistTo = join(WORK, "d1-dev");
  const refill = firstCopy(persistTo, "development", ["--refill"], "dev-refill");
  if (refill.code !== 0 || !refill.report) {
    fail(`[dev-refill] exited ${refill.code}\n${refill.output.slice(-4000)}`);
  } else {
    expectEqual([refill.report.w0, refill.report.l0, refill.report.watermark], [4, 4, 3], "[dev-refill] W0, L0 and the watermark");
    expectEqual(refill.report.verification?.differences, [], "[dev-refill] the script's own verification");
    await verifyEnv("development", blocks, persistTo, 3, "dev-refill");
    console.log(`[dev-refill] DROP rows written reported by local D1: ${refill.report.writes.dropRowsWritten}`);
  }

  console.log(failures ? `d1 first copy backup check: ${failures} failures` : "d1 first copy backup check passed");
  if (failures) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    if (!workArg) rmSync(WORK, { recursive: true, force: true });
  });

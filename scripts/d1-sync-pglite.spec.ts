/**
 * End to end through the real change-log trigger: the repo's Supabase schema and
 * supabase/migrations/*_d1_change_log.sql on PGlite, a run of ordinary writes, then the 1-minute sync
 * (workers/sync/run-sync.ts) reading those d1_change_log rows. The synced D1 must equal a first copy
 * of the final Supabase state (every current development row through mapRow), table by table.
 *   pnpm exec tsx scripts/d1-sync-pglite.spec.ts
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";

import { mapRow, recountStatements, rowEnv, SUPABASE_TABLES } from "../src/lib/d1-sync/row-mapper";
import { runSync } from "../workers/sync/run-sync";
import { FakePostgrest, type LogRow, type Row } from "./d1-sync/fake-postgrest";
import { SqliteD1 } from "./d1-sync/sqlite-d1";
import { applyBatch } from "./d1-sync/test-db";

const MIGRATIONS = "supabase/migrations";
const CHANGE_LOG = readdirSync(MIGRATIONS).filter((file) => file.endsWith("_d1_change_log.sql"));
const PROJECT = "https://abcdefghijklmnopqrst.supabase.co";
const ENV = "development";
const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";

// Same stand-ins as scripts/d1-change-log.spec.ts: the API roles, auth.users, auth.uid().
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
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

function historicalFiles(): string[] {
  const top = readdirSync("supabase").filter((file) => /^migration-\d{3}-.*\.sql$/.test(file)).sort();
  const cli = readdirSync(MIGRATIONS).filter((file) => file.endsWith(".sql") && !CHANGE_LOG.includes(file)).sort();
  return ["supabase/setup.sql", "supabase/migrate-env.sql", ...top.map((file) => `supabase/${file}`), ...cli.map((file) => `${MIGRATIONS}/${file}`)];
}

async function supabase(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_BOOTSTRAP);
  for (const file of [...historicalFiles(), `${MIGRATIONS}/${CHANGE_LOG[0]}`]) {
    try {
      await db.exec(readFileSync(file, "utf8"));
    } catch (error) {
      throw new Error(`${file}: ${(error as Error).message}`);
    }
  }
  await db.exec(`insert into auth.users (id) values ('${U1}'), ('${U2}')`);
  return db;
}

/** Writes as the service role (RLS aside, every trigger runs as in production). */
async function write(db: PGlite, sql: string) {
  await db.exec("set role service_role");
  try {
    await db.exec(sql);
  } finally {
    await db.exec("reset role");
  }
}

/** PostgREST's row images: to_jsonb, timestamps as text with +00:00. */
async function images(db: PGlite, table: string): Promise<Row[]> {
  const { rows } = await db.query<{ row: Row }>(`select to_jsonb(t) as row from public.${table} t`);
  return rows.map((entry) => entry.row);
}

async function logImages(db: PGlite): Promise<LogRow[]> {
  const { rows } = await db.query<{ row: LogRow }>("select to_jsonb(l) as row from public.d1_change_log l order by id");
  return rows.map((entry) => entry.row);
}

const WRITES = [
  // Engagement: comments, a like on a comment, thread likes, an edit, an unlike.
  `insert into public.comments (id, story_id, user_id, nickname, content, env) values
     ('c0000000-0000-4000-8000-000000000001', 'sts2-codex:card:bash', '${U1}', '닉', '첫 댓글', 'development'),
     ('c0000000-0000-4000-8000-000000000002', 'sts2-codex:card:bash', '${U2}', '둘', '둘째 댓글', 'development'),
     ('c0000000-0000-4000-8000-000000000003', 'sts2-codex:card:bash', '${U2}', '운영', '운영 댓글', 'production')`,
  `insert into public.comment_likes (comment_id, user_id) values ('c0000000-0000-4000-8000-000000000001', '${U2}')`,
  `insert into public.likes (story_id, user_id, env) values ('sts2-codex:card:bash', '${U1}', 'development'), ('sts2-codex:card:bash', '${U2}', 'development')`,
  `update public.comments set content = '고친 댓글' where id = 'c0000000-0000-4000-8000-000000000002'`,
  `delete from public.likes where user_id = '${U2}'`,
  // A combo post with resources, edited twice, and its 조각모음 body.
  `insert into public.combo_posts (id, user_id, nickname, content, content_text, resources, env)
     values ('a1000000-0000-4000-8000-000000000001', '${U1}', '닉', '[]', '콤보 설명', '[{"type":"card","id":"BASH"},{"type":"relic","id":"ANCHOR"}]', 'development')`,
  `update public.combo_posts set content_text = '고친 설명' where id = 'a1000000-0000-4000-8000-000000000001'`,
  `update public.combo_posts set resources = '[{"type":"card","id":"STRIKE"},{"type":"relic","id":"ANCHOR"}]' where id = 'a1000000-0000-4000-8000-000000000001'`,
  `insert into public.defragment_bodies (env, source_service, source_id, user_id, nickname, content, content_text)
     values ('development', 'combo', 'a1000000-0000-4000-8000-000000000001', '${U1}', '닉', '[]', '조각 본문')`,
  // A body whose post never existed: an orphan (counted, closed).
  `insert into public.defragment_bodies (env, source_service, source_id, user_id, nickname, content, content_text)
     values ('development', 'combo', 'a1000000-0000-4000-8000-0000000000ff', '${U1}', '닉', '[]', '고아 본문')`,
  // A run with its raw, then a cover edit (the raw stays out of the log).
  `insert into public.runs (id, raw, seed, build, "character", ascension, win, acts_count, donor_user_id, env, donor_nickname)
     values ('r1testrun0000001', '{"seed":"SEED1","floors":[1,2,3]}', 'SEED1', 'v0.1', 'CHARACTER.IRONCLAD', 0, true, 3, '${U1}', 'development', '기증자')`,
  `update public.runs set cover_spec = '{"auto":false,"phrase":"표지"}' where id = 'r1testrun0000001'`,
  // This or that: a like on another env's post (cross_env), and a post deleted with its votes and likes.
  `insert into public.this_or_that_posts (id, user_id, nickname, left_type, left_id, right_type, right_id, reason, env)
     values ('b0000000-0000-4000-8000-000000000001', '${U2}', '운영', 'card', 'BASH', 'card', 'STRIKE', '운영 글', 'production'),
            ('b0000000-0000-4000-8000-000000000002', '${U1}', '닉', 'card', 'BASH', 'relic', 'ANCHOR', '이유가 있다', 'development'),
            ('b0000000-0000-4000-8000-000000000003', '${U1}', '닉', 'card', 'BASH', 'relic', 'ANCHOR', '남는 글', 'development')`,
  `insert into public.this_or_that_post_likes (post_id, user_id, env) values
     ('b0000000-0000-4000-8000-000000000001', '${U1}', 'development'),
     ('b0000000-0000-4000-8000-000000000002', '${U2}', 'development'),
     ('b0000000-0000-4000-8000-000000000003', '${U2}', 'development')`,
  `insert into public.this_or_that_post_votes (post_id, user_id, choice, created_surface, env) values
     ('b0000000-0000-4000-8000-000000000002', '${U2}', 'left', 'index', 'development'),
     ('b0000000-0000-4000-8000-000000000003', '${U2}', 'right', 'detail', 'development')`,
  `delete from public.this_or_that_posts where id = 'b0000000-0000-4000-8000-000000000002'`,
  // A comment deleted with its likes (their log rows carry env null).
  `delete from public.comments where id = 'c0000000-0000-4000-8000-000000000001'`,
];

/** The D1 tables to compare, with the columns that may differ (recount times). */
const COMPARED = [
  "comments", "comment_likes", "likes", "posts", "post_combo", "post_combo_resources", "post_this_or_that",
  "this_or_that_post_votes", "this_or_that_post_likes", "defragment_bodies", "post_history_course", "post_history_course_file",
];

function dump(d1: SqliteD1, table: string): string[] {
  return d1.rows(`SELECT * FROM ${table}`).map((row) => JSON.stringify(row)).sort();
}

/** The first copy of the final state (design 5.2 steps 4-6) into a fresh D1. */
async function firstCopy(db: PGlite): Promise<SqliteD1> {
  const d1 = new SqliteD1();
  for (const table of SUPABASE_TABLES) {
    const rows = (await images(db, table)).filter((row) => {
      if (table === "comment_likes") return true;
      return rowEnv(row) === null ? !("env" in row) : rowEnv(row) === ENV;
    });
    for (const row of rows) {
      const mapped = mapRow(table, row, { nowMs: 0 });
      if (!mapped.ok) continue; // orphans and cross-env rows: counted, not copied
      try {
        applyBatch(d1.sqlite, mapped.statements.filter((statement) => !statement.sql.startsWith("INSERT INTO sync_pending_raw")));
      } catch {
        // FK children of rows another env holds (comment likes of a production comment, cross-env likes).
      }
    }
  }
  const keys = d1.rows("SELECT DISTINCT story_id FROM comments UNION SELECT DISTINCT story_id FROM likes").map((row) => String(row.story_id));
  const commentIds = d1.rows("SELECT id FROM comments").map((row) => String(row.id));
  applyBatch(d1.sqlite, recountStatements({ threadComments: keys, threadLikes: keys, commentLikes: commentIds }, 0));
  return d1;
}

async function main() {
  assert.equal(CHANGE_LOG.length, 1);
  const db = await supabase();
  for (const sql of WRITES) await write(db, sql);

  // The fake PostgREST serves the real log rows and the current rows.
  const rest = new FakePostgrest();
  rest.log = await logImages(db);
  for (const table of SUPABASE_TABLES) rest.tables.set(table, await images(db, table));
  const lastChanged = Date.parse(String(rest.log.at(-1)?.changed_at));

  const d1 = new SqliteD1();
  d1.sqlite.prepare("INSERT INTO runtime_flags (key, value, updated_at) VALUES ('sync.enabled', 'on', '2026-11-08T00:00:00.000Z')").run();
  d1.sqlite.prepare("INSERT INTO sync_state (name, low_watermark, high_seen) VALUES ('supabase_in', 0, 0)").run();
  const env = { API_RUNTIME_FLAGS: "d1", DB: d1, API_SUPABASE_URL: PROJECT, API_SUPABASE_SECRET_KEY: "sb_secret_spec", API_DATA_ENV: ENV };
  const rejects: Array<{ table: string; reason: string; closed: boolean }> = [];
  for (let i = 0; i < 10; i++) {
    const now = lastChanged + (i + 1) * 60_000;
    const report = await runSync(env as never, { now: () => now, fetcher: rest.fetcher, log: () => undefined });
    assert.equal(report.status, "ok", JSON.stringify(report));
    assert.ok(report.statements <= 45 && report.subrequests <= 50);
    rejects.push(...report.rejects);
  }

  const state = d1.one("SELECT low_watermark, applied_above FROM sync_state") as { low_watermark: number; applied_above: string };
  assert.equal(state.low_watermark, rest.log.at(-1)?.id, "every log row is behind the watermark");
  assert.equal(state.applied_above, "[]");
  assert.deepEqual(rejects.map((reject) => [reject.table, reject.reason, reject.closed]).sort(), [
    ["defragment_bodies", "orphan", true],
    ["this_or_that_post_likes", "cross_env", true],
  ]);
  assert.equal(Number(d1.one("SELECT count(*) AS n FROM sync_rejects WHERE resolved_at IS NULL")?.n), 0);

  const copy = await firstCopy(db);
  for (const table of COMPARED) assert.deepEqual(dump(d1, table), dump(copy, table), `${table} equals the first copy of the final state`);
  const threads = (d: SqliteD1) => d.rows("SELECT thread_key, like_count, comment_count, last_comment_at FROM threads WHERE like_count > 0 OR comment_count > 0").map((row) => JSON.stringify(row)).sort();
  assert.deepEqual(threads(d1), threads(copy), "threads equal a recount of the final rows");
  assert.equal(d1.one("SELECT raw FROM post_history_course_file")?.raw, '{"seed":"SEED1","floors":[1,2,3]}', "the raw came by text, byte for byte");
  assert.equal(Number(d1.one("SELECT count(*) AS n FROM comments")?.n), 1, "the production comment and the deleted one are absent");
  assert.ok(rest.log.some((row) => row.table_name === "comment_likes" && row.op === "D" && row.env === null), "the cascade logged env null");
  console.log(`d1-sync-pglite spec passed (${rest.log.length} real log rows, ${COMPARED.length} tables equal the first copy)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

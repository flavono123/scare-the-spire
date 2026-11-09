/**
 * The D1 first copy (scripts/d1-first-copy.ts, design 5.2) on synthetic rows: a pg_dump-shaped dump
 * goes through the plan, the rehearsal, the checks and the writes into SQLite copies of the D1 schema,
 * a fake D1 HTTP API and fake psql/pg_dump binaries. No network, no Supabase, no Cloudflare.
 *   pnpm exec tsx scripts/d1-first-copy.spec.ts
 * The same copy over a real backup into local D1: scripts/d1-first-copy-backup-check.ts.
 */
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SUPABASE_TABLES } from "../src/lib/d1-sync/row-mapper";
import { RUN_SUMMARY_VERSION } from "../src/lib/run-list-summary";
import {
  dropOrder,
  RemoteD1Target,
  splitSqlScript,
  SqliteTarget,
  stepTwoMigrations,
  stepTwoTables,
  toWire,
  WriteBudget,
  BudgetStop,
  readJsonc,
  wranglerDatabase,
  type FetchLike,
} from "./d1-sync/first-copy-d1";
import { buildFirstCopyPlan, D1_TABLE_ORDER, parseDumpCopyBlocks, statementTable, stopReasons, type DataEnv } from "./d1-sync/first-copy-plan";
import {
  COMMENT_LIKES_FILL_SQL,
  formatReport,
  queryById,
  runFirstCopy,
  THREADS_FILL_SQL,
  type FirstCopyReport,
} from "./d1-sync/first-copy-run";
import { DumpFileSource, l0Sql, PgliteSource, PoolerSource, poolerOptionsFromEnv, type CopySource } from "./d1-sync/first-copy-source";
import { openD1TestDb, type SqliteDb } from "./d1-sync/test-db";

let checks = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    checks += 1;
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

const WORK = mkdtempSync(join(tmpdir(), "d1-first-copy-spec-"));
const U = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const P1 = U(101); // combo post, development
const T1 = U(201); // this-or-that post, production
const C1 = U(301);
const C2 = U(302);
const C3 = U(303);
const RUN = "r0000000000000f01";
const TS = "2026-11-05 11:48:12.3456+00";
const AUTHOR = { avatar_id: "IRONCLAD", avatar_kind: "character", palette_id: "red", palette_swapped: "t" };

const RAW = JSON.stringify({
  seed: "ALPHA", build_id: "v0.107.1", ascension: 7, game_mode: "standard", win: true, run_time: 3600, start_time: 1762500000,
  acts: ["ACT.OVERGROWTH"],
  players: [{
    id: 1, character: "CHARACTER.IRONCLAD",
    deck: [{ id: "CARD.STRIKE_IRONCLAD", floor_added_to_deck: 1 }, { id: "CARD.BASH", floor_added_to_deck: 1, current_upgrade_level: 1 }],
    relics: [{ id: "RELIC.BURNING_BLOOD", floor_added_to_deck: 0 }, { id: "RELIC.ANCHOR", floor_added_to_deck: 3 }],
    potions: [{ id: "POTION.FIRE_POTION", slot_index: 0 }],
    badges: [{ id: "BADGE.SPEEDY", rarity: "gold" }],
  }],
  map_point_history: [[{ map_point_type: "monster", rooms: [{ model_id: "ENCOUNTER.JAW_WORM", room_type: "monster" }] }]],
});

type Rows = Record<string, Array<Record<string, string | null>>>;

/** A dump of every copied table in both envs; each case edits a copy. */
function baseRows(): Rows {
  return {
    comments: [
      { id: C1, story_id: `c-c-c-combo:${P1}`, user_id: U(1), nickname: "아이언클래드", ...AUTHOR, content: "좋다", content_blocks: null, created_at: TS, env: "development", parent_id: null, meta: "{}" },
      { id: C2, story_id: "sts2-codex:card:bash", user_id: U(2), nickname: "사일런트", ...AUTHOR, content: "탭\t줄\n끝", content_blocks: '[{"type": "text"}]', created_at: TS, env: "production", parent_id: null, meta: "{}" },
      { id: C3, story_id: "sts2-codex:card:bash", user_id: U(3), nickname: "디펙트", ...AUTHOR, content: "it's", content_blocks: null, created_at: "2026-11-05 11:48:12+00", env: "development", parent_id: null, meta: "{}" },
    ],
    comment_likes: [
      { id: U(401), comment_id: C1, user_id: U(2), created_at: TS },
      { id: U(402), comment_id: C2, user_id: U(1), created_at: TS },
    ],
    likes: [
      { id: U(501), story_id: `c-c-c-combo:${P1}`, user_id: U(2), created_at: TS, env: "development", reaction_type: "thumb_up" },
      { id: U(502), story_id: "sts2-codex:card:bash", user_id: U(3), created_at: TS, env: "production", reaction_type: "thumb_up" },
    ],
    combo_posts: [
      {
        id: P1, user_id: U(1), nickname: "아이언클래드", ...AUTHOR, like_count: "1", comment_count: "1", created_at: TS, env: "development",
        content: '[{"type": "text", "text": "콤보"}]', content_text: "  콤보 설명  ", resources: '[{"type": "card", "id": "bash"}]',
      },
    ],
    this_or_that_posts: [
      {
        id: T1, user_id: U(2), nickname: "사일런트", ...AUTHOR, like_count: "0", comment_count: "2", created_at: TS, env: "production",
        left_type: "card", left_id: "bash", right_type: "card", right_id: "strike", reason: "둘 다 좋다", left_vote_count: "1",
        right_vote_count: "0", vote_rate_bps: "10000",
      },
    ],
    this_or_that_post_votes: [{ post_id: T1, user_id: U(3), choice: "left", created_at: TS, env: "production", created_surface: "feed" }],
    // A development like on a production post: cross_env (tasks/010 #70).
    this_or_that_post_likes: [{ id: U(601), post_id: T1, user_id: U(1), created_at: TS, env: "development" }],
    runs: [
      {
        id: RUN, donor_user_id: U(1), donor_nickname: " 기증자 ", like_count: "0", comment_count: "0", created_at: TS, env: "development",
        seed: "ALPHA", build: "v0.107.1", character: "CHARACTER.IRONCLAD", ascension: "7", win: "t", start_time: "1762500000",
        run_time: "3600", acts_count: "1", total_floors: "1", cover_spec: null, raw: RAW, badges: "[]", highlight_card: null,
        highlight_relic: null, note_blocks: null,
      },
    ],
    defragment_bodies: [
      { source_service: "combo", source_id: P1, user_id: U(1), nickname: "아이언클래드", content: "[]", content_text: "조각 본문", created_at: TS, updated_at: TS, env: "development" },
      // No such post: an orphan, counted and not copied.
      { source_service: "combo", source_id: U(999), user_id: U(1), nickname: "아이언클래드", content: "[]", content_text: "고아 본문", created_at: TS, updated_at: TS, env: "development" },
    ],
    profile_character_nickname_pools: [{ character_id: "IRONCLAD", locale: "ko", nicknames: '{철갑,"붉은 기사"}', updated_at: TS }],
    puzzlebox_players: [
      { user_id: U(1), nickname: "퍼즐러", avatar_id: "IRONCLAD", avatar_kind: "character", palette_id: "red", palette_swapped: "f", hidden: "f", updated_at: TS },
    ],
    // W0 = 3 (now). Id 1 is 10 minutes older than W0, id 2 four minutes: L0 = 2, watermark = 1.
    d1_change_log: [
      { id: "1", env: "development", table_name: "likes", op: "I", new_row: "{}", old_row: null, heavy_changed: "f", row_bytes: "2", changed_at: "2026-11-08 00:00:00.5+00" },
      { id: "2", env: "production", table_name: "likes", op: "I", new_row: "{}", old_row: null, heavy_changed: "f", row_bytes: "2", changed_at: "2026-11-08 00:06:00.5+00" },
      { id: "3", env: "development", table_name: "likes", op: "D", new_row: null, old_row: "{}", heavy_changed: "f", row_bytes: "2", changed_at: "2026-11-08 00:10:00.5+00" },
    ],
  };
}

function copyField(value: string | null): string {
  if (value === null) return "\\N";
  return value.replace(/\\/g, "\\\\").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}

function dumpText(rows: Rows): string {
  let out = "--\n-- PostgreSQL database dump\n--\n\\restrict abc\nSET statement_timeout = 0;\n\n";
  for (const table of [...SUPABASE_TABLES, ...("d1_change_log" in rows ? ["d1_change_log"] : []), "nav_indicators"]) {
    const list = rows[table] ?? [];
    const columns = list.length ? Object.keys(list[0]) : ["id"];
    const quoted = columns.map((c) => (c === "character" || c === "rows" ? `"${c}"` : c));
    out += `COPY public.${table} (${quoted.join(", ")}) FROM stdin;\n`;
    for (const row of list) out += `${columns.map((c) => copyField(row[c])).join("\t")}\n`;
    out += "\\.\n\n";
  }
  return `${out}\\unrestrict abc\n`;
}

let dumpCount = 0;
function dumpFile(rows: Rows): string {
  const file = join(WORK, `dump-${++dumpCount}.sql`);
  writeFileSync(file, dumpText(rows));
  return file;
}

/** A target that passes the preflight: the D1 schema plus wrangler's d1_migrations rows. */
function freshTarget(): SqliteTarget {
  const db = openD1TestDb();
  db.exec("CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TEXT)");
  for (const name of ["0001_runtime_flags.sql", "0002_api_cache.sql", ...stepTwoMigrations().map((m) => m.name)]) {
    db.prepare("INSERT INTO d1_migrations (name, applied_at) VALUES (?1, '2026-11-08')").run(name);
  }
  return new SqliteTarget(db);
}

function n(db: SqliteDb, sql: string): number {
  return Number(Object.values(db.prepare(sql).get() as Record<string, unknown>)[0]);
}

async function copy(rows: Rows, env: DataEnv, opts: { target?: SqliteTarget; refill?: boolean; dryRun?: boolean } = {}) {
  const target = opts.target ?? freshTarget();
  const report = await runFirstCopy({
    target,
    source: new DumpFileSource(dumpFile(rows), { workDir: WORK, noChangeLog: false }),
    env,
    refill: opts.refill ?? false,
    dryRun: opts.dryRun ?? false,
    nowMs: 1_762_560_000_000,
  });
  return { target, report };
}

function expectStop(report: FirstCopyReport, pattern: RegExp) {
  assert.equal(report.outcome, "stopped", formatReport(report));
  assert.ok(report.stops.some((stop) => pattern.test(stop)), `expected a stop like ${pattern}, got ${JSON.stringify(report.stops)}`);
}

async function main() {
  // ----------------------------------------------------------------------------------------- pieces

  await check("COPY blocks: quoted names, escapes, NULL, end markers; lines outside blocks ignored", () => {
    const blocks = parseDumpCopyBlocks(dumpText(baseRows()));
    assert.equal(blocks.get("comments")!.rows[1].content, "탭\t줄\n끝");
    assert.equal(blocks.get("comments")!.rows[0].content_blocks, null);
    assert.equal(blocks.get("runs")!.rows[0].character, "CHARACTER.IRONCLAD");
    assert.equal(blocks.get("runs")!.rows[0].raw, RAW);
    assert.equal(blocks.get("chemical_posts")!.rows.length, 0);
    assert.throws(() => parseDumpCopyBlocks("COPY public.likes (id, env) FROM stdin;\na\n\\.\n"), /1 fields for 2 columns/);
    assert.throws(() => parseDumpCopyBlocks("COPY public.likes (id) FROM stdin;\na\n"), /no end marker/);
  });

  await check("wire form: values inlined, large strings bound and renumbered, quotes and DDL comments untouched", () => {
    const big = "x".repeat(20_000);
    const wire = toWire({ sql: "INSERT INTO t (a, b, c, d) SELECT ?2, '?9', ?1, ?2 WHERE ?3 IS NULL", params: [big, "it's", null] });
    assert.equal(wire.sql, "INSERT INTO t (a, b, c, d) SELECT 'it''s', '?9', ?1, 'it''s' WHERE NULL IS NULL");
    assert.deepEqual(wire.params, [big]);
    const raw = toWire({ sql: "INSERT INTO f (id, raw) VALUES (?1, ?2) ON CONFLICT (id) DO UPDATE SET raw = excluded.raw", params: ["r1", big] });
    assert.equal(raw.sql, "INSERT INTO f (id, raw) VALUES ('r1', ?1) ON CONFLICT (id) DO UPDATE SET raw = excluded.raw");
    // Many medium strings: bound at the lower threshold so the text stays under the limit.
    const medium = Array.from({ length: 8 }, (_, i) => `${i}`.repeat(15_000));
    const many = toWire({ sql: `SELECT ${medium.map((_, i) => `?${i + 1}`).join(", ")}`, params: medium });
    assert.equal(many.params.length, 8);
    assert.ok(many.bytes < 100);
    const ddl = "-- 이거 아님 저거? likes\nCREATE TABLE IF NOT EXISTS x (a TEXT)";
    assert.equal(toWire({ sql: ddl, params: [] }).sql, ddl);
    assert.throws(() => toWire({ sql: "SELECT ?", params: [1] }), /numbered/);
  });

  await check("migration scripts split into their statements; drop order is leaf-first", () => {
    const tables = stepTwoTables();
    assert.equal(tables.length, 39);
    assert.ok(!tables.includes("api_verification_keys"), "a re-fill never drops the Worker-owned key list (0007)");
    const statements = stepTwoMigrations().flatMap((m) => splitSqlScript(m.text));
    assert.equal(statements.filter((s) => /^(?:--[^\n]*\n\s*)*CREATE TABLE/.test(s)).length, 39);
    assert.ok(statements.every((s) => !s.endsWith(";")));
    const order = dropOrder(tables);
    assert.deepEqual([...order].sort(), [...tables].sort());
    const db = openD1TestDb();
    for (const table of tables) {
      const parents = (db.prepare('SELECT DISTINCT "table" AS p FROM pragma_foreign_key_list(?1)').all(table) as Array<{ p: string }>).map((r) => r.p);
      for (const parent of parents) assert.ok(order.indexOf(table) < order.indexOf(parent), `${table} is dropped before ${parent}`);
    }
    // Dropping in that order on a filled schema deletes no row of a table still there (no cascade).
    db.exec(readFileSync(join(__dirname, "../docs/supabase-exit/d1-schema/fixtures.sql"), "utf8"));
    const before = new Map(tables.map((table) => [table, n(db, `SELECT count(*) FROM ${table}`)]));
    assert.ok([...before.values()].filter((count) => count > 0).length > 30, "the fixtures fill the schema");
    for (const [i, table] of order.entries()) {
      db.exec(`DROP TABLE IF EXISTS ${table}`);
      for (const left of order.slice(i + 1)) assert.equal(n(db, `SELECT count(*) FROM ${left}`), before.get(left), `${left} after dropping ${table}`);
    }
    assert.deepEqual(splitSqlScript("SELECT ';' -- a; b\n; /* c; */ SELECT 2;\n-- tail"), ["SELECT ';' -- a; b", "/* c; */ SELECT 2"]);
  });

  await check("the derived fills and R1 are the design's statements", () => {
    const squash = (text: string) => text.replace(/\s+/g, " ").trim();
    const fixtures = squash(readFileSync(join(__dirname, "../docs/supabase-exit/d1-schema/fixtures.sql"), "utf8"));
    assert.ok(fixtures.includes(squash(THREADS_FILL_SQL).replace("?1", "1762560000000")), "threads fill as in fixtures.sql");
    assert.ok(fixtures.includes(squash(COMMENT_LIKES_FILL_SQL)), "comments.like_count fill as in fixtures.sql");
    assert.match(queryById("R1"), /^SELECT p\.id, h\.seed[\s\S]*LIMIT 100$/);
    assert.equal(l0Sql(7), "select min(id) from public.d1_change_log where changed_at >= (select changed_at from public.d1_change_log where id = 7) - interval '5 minutes'");
  });

  await check("wrangler.jsonc gives the two databases", () => {
    assert.deepEqual(readJsonc('{"a": "x//y", // c\n "b": [1, 2,], /* d */ "c": 1,}'), { a: "x//y", b: [1, 2], c: 1 });
    assert.equal(wranglerDatabase("production").database_name, "slseoun-prod");
    assert.equal(wranglerDatabase("testbed").database_name, "slseoun-testbed");
  });

  // ----------------------------------------------------------------------------------------- the plan

  await check("plan: env filter, parent-first order, run summary, skipped rows, expected counts", () => {
    const plan = buildFirstCopyPlan(parseDumpCopyBlocks(dumpText(baseRows())), "development", 0);
    const tally = (table: string) => plan.tallies.find((t) => t.table === table)!;
    assert.equal(tally("comments").envRows, 2);
    assert.equal(tally("comment_likes").copied, 1, "comment_likes by the parent comment's env");
    assert.equal(tally("profile_character_nickname_pools").copied, 1, "env-less tables copy every row");
    assert.deepEqual(tally("this_or_that_post_likes").skipped, { cross_env: 1 });
    assert.deepEqual(tally("defragment_bodies").skipped, { orphan: 1 });
    assert.equal(plan.checks.crossEnvLikes, 1);
    assert.equal(plan.checks.orphanBodies, 1);
    assert.deepEqual(stopReasons(plan), []);
    assert.deepEqual(plan.expected, {
      comments: 2, comment_likes: 1, likes: 1, "posts:combo": 1, post_combo: 1, post_combo_resources: 1, "posts:history_course": 1,
      post_history_course: 1, post_history_course_file: 1, defragment_bodies: 1, profile_character_nickname_pools: 1, puzzlebox_players: 1,
      threads: 2,
    });
    const ranks = plan.statements.map((s) => (D1_TABLE_ORDER as readonly string[]).indexOf(s.table));
    assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), "statements are in the parent-first order");
    assert.equal(plan.statements[0].table, "posts");
    assert.ok(plan.statements.some((s) => s.table === "post_history_course (RF2)" && s.statement.params.includes(RUN_SUMMARY_VERSION)));
    assert.ok(plan.statements.every((s) => s.table.startsWith(statementTable(s.statement.sql))));
    assert.equal(plan.checks.runs.count, 1);
    assert.ok(plan.checks.jsonMaxBytes["combo_posts.resources"] > 0);
  });

  // ----------------------------------------------------------------------------------------- whole copies

  await check("development copy: rows, derived values, run summary, watermark by the 5-minute rule", async () => {
    const { target, report } = await copy(baseRows(), "development");
    assert.equal(report.outcome, "ok", formatReport(report));
    assert.equal(report.w0, 3);
    assert.equal(report.l0, 2);
    const db = target.db;
    assert.deepEqual({ ...(db.prepare("SELECT low_watermark, high_seen, applied_above FROM sync_state").get() as object) }, {
      low_watermark: 1, high_seen: 1, applied_above: "[]",
    });
    assert.equal(n(db, "SELECT count(*) FROM comments"), 2);
    assert.equal(n(db, `SELECT like_count FROM comments WHERE id = '${C1}'`), 1);
    assert.equal(n(db, `SELECT like_count FROM comments WHERE id = '${C3}'`), 0);
    assert.deepEqual(
      (db.prepare("SELECT thread_key, like_count, comment_count, last_comment_at FROM threads ORDER BY thread_key").all() as object[]).map((r) => ({ ...r })),
      [
        { thread_key: `c-c-c-combo:${P1}`, like_count: 1, comment_count: 1, last_comment_at: "2026-11-05T11:48:12.345600Z" },
        { thread_key: "sts2-codex:card:bash", like_count: 0, comment_count: 1, last_comment_at: "2026-11-05T11:48:12.000000Z" },
      ],
    );
    assert.deepEqual({ ...(db.prepare(`SELECT summary FROM posts WHERE id = '${P1}'`).get() as object) }, { summary: "콤보 설명" });
    assert.equal(n(db, "SELECT count(*) FROM post_combo_resources"), 1);
    assert.equal(n(db, "SELECT count(*) FROM defragment_bodies"), 1);
    assert.equal(n(db, "SELECT count(*) FROM this_or_that_post_likes"), 0);
    assert.equal(n(db, `SELECT summary_version FROM post_history_course WHERE post_id = '${RUN}'`), RUN_SUMMARY_VERSION);
    assert.equal(n(db, `SELECT length(raw) FROM post_history_course_file WHERE post_id = '${RUN}'`), RAW.length);
    assert.deepEqual({ ...(db.prepare(`SELECT nickname, user_id FROM posts WHERE service = 'history_course'`).get() as object) }, {
      nickname: " 기증자 ", user_id: U(1),
    });
    assert.equal(n(db, "SELECT count(*) FROM puzzlebox_players"), 1);
    assert.equal(report.verification?.differences.length, 0);
    assert.equal(report.rehearsal.listRows, 1);
    assert.ok(report.rehearsal.listAnswerBytes > 0);
    assert.ok(report.writes.estimatedRows > 0);
    assert.match(formatReport(report), /orphan defragment_bodies \(no post, not copied\): 1/);
  });

  await check("production copy: its own rows, env-less rows again, counter drift reported only", async () => {
    const { target, report } = await copy(baseRows(), "production");
    assert.equal(report.outcome, "ok", formatReport(report));
    const db = target.db;
    assert.equal(n(db, "SELECT count(*) FROM comments"), 1);
    assert.equal(n(db, "SELECT count(*) FROM comment_likes"), 1);
    assert.equal(n(db, "SELECT count(*) FROM this_or_that_post_votes"), 1);
    assert.equal(n(db, "SELECT count(*) FROM posts"), 1);
    assert.equal(n(db, "SELECT count(*) FROM profile_character_nickname_pools"), 1);
    assert.equal(n(db, "SELECT count(*) FROM puzzlebox_players"), 1);
    assert.equal(report.plan.checks.crossEnvLikes, 0, "the development like is not in the production copy");
    assert.deepEqual(report.counterDrift, { "comment_count:this_or_that": 1 }, "comment_count 2 with no comment row: reported, copied as is");
    assert.equal(n(db, `SELECT comment_count FROM posts WHERE id = '${T1}'`), 2);
    assert.equal(n(db, "SELECT count(*) FROM post_history_course"), 0);
  });

  await check("dry run writes nothing", async () => {
    const { target, report } = await copy(baseRows(), "development", { dryRun: true });
    assert.equal(report.outcome, "dry run");
    assert.equal(n(target.db, "SELECT count(*) FROM posts"), 0);
    assert.equal(n(target.db, "SELECT count(*) FROM sync_state"), 0);
    assert.ok(report.rehearsal.counts.posts === 2);
  });

  await check("each 5.2 check stops the copy before any write", async () => {
    const cases: Array<[string, (rows: Rows) => void, RegExp]> = [
      ["NULL created_at", (r) => { r.comments[0].created_at = null; }, /NULL data timestamps.*comments 1/],
      ["infinity", (r) => { r.likes[0].created_at = "infinity"; }, /canonicalTs refuses.*likes 1/],
      ["not UTC", (r) => { r.comments[2].created_at = "2026-11-05 20:48:12+09"; }, /dump not in UTC: 1 .*comments\.created_at/],
      ["element without id", (r) => { r.combo_posts[0].resources = '[{"type": "card"}]'; }, /not \{type, id\}.*combo_posts 1/],
      ["vote under a post of another env", (r) => { r.this_or_that_post_votes[0].env = "development"; }, /another env.*this_or_that_post_votes 1/],
      ["unreadable raw", (r) => { r.runs[0].raw = "not json"; }, /raw does not parse: 1/],
      ["raw over 1.9 MB", (r) => { r.runs[0].raw = RAW.replace('"seed"', `"pad":"${"x".repeat(1_900_001)}","seed"`); }, /raws over 1900000 bytes: 1/],
    ];
    for (const [name, edit, pattern] of cases) {
      const rows = baseRows();
      edit(rows);
      const { target, report } = await copy(rows, "development");
      expectStop(report, pattern);
      assert.equal(n(target.db, "SELECT count(*) FROM posts") + n(target.db, "SELECT count(*) FROM comments"), 0, `${name}: nothing written`);
      assert.match(formatReport(report), /STOPPED/);
    }
  });

  await check("preflight: missing migrations stop; a filled target needs --refill; the re-fill copies again with a new W0", async () => {
    const bare = new SqliteTarget(openD1TestDb());
    expectStop((await copy(baseRows(), "development", { target: bare })).report, /migrations not applied: 0003_sync_bookkeeping\.sql/);
    assert.equal(n(bare.db, "SELECT count(*) FROM posts"), 0);

    const { target } = await copy(baseRows(), "development");
    const again = await copy(baseRows(), "development", { target });
    expectStop(again.report, /already holds rows in sync_state, comments/);
    target.db.exec(`INSERT INTO outbox (table_name, op, match_key, created_at) VALUES ('likes', 'delete', '{"story_id": "x"}', 1)`);
    expectStop((await copy(baseRows(), "development", { target, refill: true })).report, /outbox holds 1 rows .*before a re-fill/);
    target.db.exec("DELETE FROM outbox");

    const rows = baseRows();
    rows.likes.push({ id: U(503), story_id: "sts2-codex:card:bash", user_id: U(4), created_at: TS, env: "development", reaction_type: "thumb_up" });
    rows.d1_change_log.push({ ...rows.d1_change_log[2], id: "4", changed_at: "2026-11-08 00:20:00+00" });
    const refill = await copy(rows, "development", { target, refill: true });
    assert.equal(refill.report.outcome, "ok", formatReport(refill.report));
    assert.equal(refill.report.mode, "re-fill");
    assert.equal(refill.report.writes.dropRowsWritten, 0);
    assert.equal(refill.report.w0, 4);
    assert.equal(refill.report.l0, 4, "only W0 itself is within 5 minutes");
    assert.equal(n(target.db, "SELECT high_seen FROM sync_state"), 3);
    assert.equal(n(target.db, "SELECT count(*) FROM likes"), 2);
    assert.equal(n(target.db, "SELECT like_count FROM threads WHERE thread_key = 'sts2-codex:card:bash'"), 1);
    assert.equal(n(target.db, "SELECT count(*) FROM d1_migrations"), 6, "wrangler's migration records stay");
  });

  await check("a dump without a change log needs --no-change-log, then W0 = 0", async () => {
    const rows = baseRows();
    delete (rows as Partial<Rows>).d1_change_log;
    const file = dumpFile(rows);
    await assert.rejects(new DumpFileSource(file, { workDir: WORK, noChangeLog: false }).maxChangeLogId(), /--no-change-log/);
    const report = await runFirstCopy({
      target: freshTarget(),
      source: new DumpFileSource(file, { workDir: WORK, noChangeLog: true }),
      env: "development",
      refill: false,
      dryRun: false,
    });
    assert.equal(report.outcome, "ok");
    assert.equal(report.w0, 0);
    assert.equal(report.l0, null);
    assert.equal(report.watermark, 0);
  });

  await check("step 7: L0 is taken again after the copy, so a lower id that commits late is not skipped", async () => {
    const file = new DumpFileSource(dumpFile(baseRows()), { workDir: WORK, noChangeLog: false });
    // At the dump only W0 (3) is within 5 minutes; id 2 of the same window commits while the copy is written.
    const answers = [3, 2];
    const source: CopySource = {
      label: "late commit",
      maxChangeLogId: () => file.maxChangeLogId(),
      dumpData: () => file.dumpData(),
      firstIdWithinFiveMinutes: async () => answers.shift()!,
      close: async () => {},
    };
    const target = freshTarget();
    const report = await runFirstCopy({ target, source, env: "development", refill: false, dryRun: false, nowMs: 1_762_560_000_000 });
    assert.equal(report.outcome, "ok", formatReport(report));
    assert.deepEqual([report.w0, report.l0, report.watermark], [3, 2, 1]);
    assert.deepEqual(answers, [], "L0 asked before the rehearsal and again after the copy");
    assert.equal(report.rehearsal.syncState?.high_seen, 2, "the rehearsal used the L0 of the dump");
    assert.deepEqual({ ...(target.db.prepare("SELECT low_watermark, high_seen FROM sync_state").get() as object) }, { low_watermark: 1, high_seen: 1 });
    assert.deepEqual(report.verification?.differences, []);
  });

  // ----------------------------------------------------------------------------------------- remote D1 (fake API)

  /** A fake D1 HTTP API over a SQLite copy of the schema: multi-statement sql or one statement with params. */
  function fakeApi(db: SqliteDb, opts: { failFirst?: number; refuseMatching?: RegExp; writtenFactor?: number } = {}) {
    const calls: Array<{ url: string; auth: string; sql: string; params: string[] }> = [];
    const sleeps: number[] = [];
    const fetch: FetchLike = async (url, init) => {
      const body = JSON.parse(init.body) as { sql: string; params?: string[] };
      calls.push({ url, auth: init.headers.Authorization, sql: body.sql, params: body.params ?? [] });
      const reply = (status: number, json: unknown) => ({ status, headers: { get: () => null }, json: async () => json });
      if (calls.length <= (opts.failFirst ?? 0)) return reply(503, { success: false, errors: [{ code: 7500, message: "busy" }] });
      if (opts.refuseMatching?.test(body.sql)) return reply(400, { success: false, errors: [{ code: 7500, message: "SQLITE_CONSTRAINT" }] });
      // As local D1 does: the 100 KB SQL length limit covers the whole multi-statement text.
      if (Buffer.byteLength(body.sql) > 100_000) {
        return reply(400, { success: false, errors: [{ code: 7500, message: "statement too long: SQLITE_TOOBIG" }] });
      }
      const parts = body.params?.length ? [body.sql] : splitSqlScript(body.sql);
      const result = [];
      for (const sql of parts) {
        const statement = db.prepare(sql);
        if (/^\s*(SELECT|PRAGMA|WITH)/i.test(sql)) {
          result.push({ success: true, results: (statement.all(...(body.params ?? [])) as object[]).map((r) => ({ ...r })), meta: { changes: 0, rows_written: 0 } });
        } else {
          const changes = Number(statement.run(...(body.params ?? [])).changes);
          result.push({ success: true, results: [], meta: { changes, rows_written: changes * (opts.writtenFactor ?? 1) } });
        }
      }
      return reply(200, { success: true, errors: [], result });
    };
    return { fetch, calls, sleeps, sleep: async (ms: number) => { sleeps.push(ms); } };
  }

  /** A raw over 16 KB stays bound (real raws are up to about 277 KB), so the copy takes several requests. */
  function bigRawRows(): Rows {
    const rows = baseRows();
    rows.runs[0].raw = RAW.replace('"seed"', `"pad":"${"x".repeat(20_000)}","seed"`);
    return rows;
  }

  /** 40 comments of 2,000 Korean characters (about 6 KB inlined each): more than 100 KB of statements. */
  function longCommentRows(): Rows {
    const rows = bigRawRows();
    for (let i = 0; i < 40; i++) {
      rows.comments.push({ ...rows.comments[0], id: U(700 + i), content: "가".repeat(2000) });
    }
    return rows;
  }

  function remote(db: SqliteDb, api: ReturnType<typeof fakeApi>) {
    return new RemoteD1Target("remote D1 slseoun-testbed (fake)", {
      accountId: "a".repeat(32),
      token: "test-token",
      database: { database_name: "slseoun-testbed", database_id: "11081204-f9ca-4b30-b2e0-07ca427cc410" },
      fetch: api.fetch,
      sleep: api.sleep,
      minGapMs: 0,
    });
  }

  await check("remote: batched writes, raws alone with params, verification through the API", async () => {
    const db = freshTarget().db;
    const api = fakeApi(db, { failFirst: 1 });
    const rows = longCommentRows();
    const bigRaw = rows.runs[0].raw!;
    const report = await runFirstCopy({
      target: remote(db, api),
      source: new DumpFileSource(dumpFile(rows), { workDir: WORK, noChangeLog: false }),
      env: "development",
      refill: true,
      dryRun: false,
      writeBudget: 10_000,
      nowMs: 1_762_560_000_000,
    });
    assert.equal(report.outcome, "ok", formatReport(report));
    assert.equal(report.writes.budget, 10_000);
    assert.ok(api.calls.every((c) => c.url === "https://api.cloudflare.com/client/v4/accounts/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/d1/database/11081204-f9ca-4b30-b2e0-07ca427cc410/query"));
    assert.ok(api.calls.every((c) => c.auth === "Bearer test-token"));
    assert.ok(api.calls.every((c) => !c.sql.includes("test-token")));
    assert.deepEqual(api.sleeps, [1000], "one retry after the 503");
    const rawCall = api.calls.find((c) => c.params.includes(bigRaw))!;
    assert.match(rawCall.sql, /^INSERT INTO post_history_course_file \(service, post_id, raw\) VALUES \('history_course', 'r0000000000000f01', \?1\)/);
    assert.ok(api.calls.filter((c) => c.params.length > 0).every((c) => splitSqlScript(c.sql).length === 1), "bound statements go alone");
    assert.ok(api.calls.some((c) => splitSqlScript(c.sql).length > 10), "the rest goes several to a request");
    assert.ok(api.calls.every((c) => Buffer.byteLength(c.sql) <= 100_000), "every request's SQL text is under D1's 100 KB");
    assert.ok(
      api.calls.filter((c) => c.sql.includes("INSERT INTO comments ")).length >= 3,
      "the long comments (about 240 KB) take several requests",
    );
    assert.equal(n(db, "SELECT count(*) FROM comments"), 42);
    assert.ok((report.writes.rowsWritten ?? 0) > 0);
    assert.equal(report.verification?.differences.length, 0);
    assert.equal(n(db, "SELECT count(*) FROM posts"), 2);
    assert.equal(n(db, "SELECT high_seen FROM sync_state"), 1);
  });

  await check("remote: the write budget stops before the first write, or before the batch that would cross it", async () => {
    const db = freshTarget().db;
    const api = fakeApi(db);
    const before = await runFirstCopy({
      target: remote(db, api),
      source: new DumpFileSource(dumpFile(baseRows()), { workDir: WORK, noChangeLog: false }),
      env: "development",
      refill: false,
      dryRun: false,
      writeBudget: 10,
    });
    expectStop(before, /over the write budget 10/);
    assert.ok(api.calls.every((c) => /^SELECT/.test(c.sql)), "only preflight reads were sent");

    // The API reports 30 times the estimate: the copy stops at the budget, before the batch that crosses it.
    const api2 = fakeApi(db, { writtenFactor: 30 });
    const midway = await runFirstCopy({
      target: remote(db, api2),
      source: new DumpFileSource(dumpFile(bigRawRows()), { workDir: WORK, noChangeLog: false }),
      env: "development",
      refill: false,
      dryRun: false,
      writeBudget: before.writes.estimatedRows + 5,
    });
    expectStop(midway, /stopped before the write budget.*partly filled: re-fill it on another day/);
    assert.ok(api2.calls.some((c) => /^INSERT/.test(c.sql)), "the first batch was written");
    assert.ok(!api2.calls.some((c) => c.sql.includes("INSERT INTO sync_state")), "the watermark was not written");
    const budget = new WriteBudget(10);
    budget.add(8);
    assert.throws(() => budget.check(3), BudgetStop);
    budget.check(2);
  });

  await check("remote: a refused statement stops the copy and says to re-fill", async () => {
    const db = freshTarget().db;
    const api = fakeApi(db, { refuseMatching: /INSERT INTO comments/ });
    const report = await runFirstCopy({
      target: remote(db, api),
      source: new DumpFileSource(dumpFile(baseRows()), { workDir: WORK, noChangeLog: false }),
      env: "development",
      refill: false,
      dryRun: false,
      writeBudget: 10_000,
    });
    expectStop(report, /writing failed: D1 API refused the request \(HTTP 400\): 7500 SQLITE_CONSTRAINT.*--refill/);
  });

  // ----------------------------------------------------------------------------------------- sources

  await check("pooler source: libpq settings through the environment, never the password on a command line", async () => {
    assert.throws(() => poolerOptionsFromEnv(WORK, {}), /SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD/);
    const opts = poolerOptionsFromEnv(WORK, { SUPABASE_PROJECT_REF: "abcdref", SUPABASE_DB_PASSWORD: "s3cret-pw" });
    assert.equal(opts.user, "postgres.abcdref");
    const canned = dumpFile(baseRows());
    const log = join(WORK, "fake-libpq");
    const psql = join(WORK, "fake-psql");
    const pgDump = join(WORK, "fake-pg_dump");
    writeFileSync(psql, `#!/bin/sh\nprintf '%s\\n' "$@" >> "${log}.psql-args"\nenv | grep '^PG' | sort > "${log}.psql-env"\ncase "$*" in *"max(id)"*) echo 42;; *) echo 40;; esac\n`);
    writeFileSync(
      pgDump,
      `#!/bin/sh\nprintf '%s\\n' "$@" > "${log}.dump-args"\nenv | grep '^PG' | sort > "${log}.dump-env"\n` +
        `while [ $# -gt 0 ]; do if [ "$1" = "--file" ]; then cp "${canned}" "$2"; fi; shift; done\n`,
    );
    chmodSync(psql, 0o755);
    chmodSync(pgDump, 0o755);
    const source = new PoolerSource({ ...opts, psql, pgDump });
    assert.equal(await source.maxChangeLogId(), 42);
    assert.equal(await source.firstIdWithinFiveMinutes(42), 40);
    const text = await source.dumpData(SUPABASE_TABLES);
    assert.equal(parseDumpCopyBlocks(text).get("comments")!.rows.length, 3);
    const env = readFileSync(`${log}.psql-env`, "utf8");
    for (const line of ["PGPASSWORD=s3cret-pw", "PGTZ=UTC", "PGSSLMODE=require", "PGUSER=postgres.abcdref", "PGHOST=aws-1-ap-northeast-1.pooler.supabase.com", "PGPORT=5432"]) {
      assert.ok(env.split("\n").includes(line), line);
    }
    assert.equal(readFileSync(`${log}.dump-env`, "utf8"), env);
    const args = readFileSync(`${log}.psql-args`, "utf8") + readFileSync(`${log}.dump-args`, "utf8");
    assert.ok(!args.includes("s3cret-pw"), "no password in argv");
    const dumpArgs = readFileSync(`${log}.dump-args`, "utf8").trim().split("\n");
    assert.deepEqual(dumpArgs.slice(0, 4), ["--data-only", "--format=plain", "--no-owner", "--no-privileges"]);
    assert.equal(dumpArgs.filter((a) => a.startsWith("--table=public.")).length, 27);
    assert.ok(dumpArgs.includes("--table=public.comment_likes"));
  });

  await check("PGlite source: W0, L0 and a UTC COPY dump in pg_dump's shape", async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const dir = join(WORK, "pglite");
    const pg = new PGlite(dir);
    await pg.exec(`
      set timezone = 'Asia/Seoul';
      create table public.likes (id uuid primary key, story_id text not null, "character" text, created_at timestamptz not null, env text not null);
      insert into public.likes values ('${U(1)}', 'tab\tline\nend', 'x', '2026-11-05 20:48:12.3456+09', 'development');
      create table public.d1_change_log (id bigint generated always as identity primary key, changed_at timestamptz not null);
      insert into public.d1_change_log (changed_at) values ('2026-11-08 00:00:00+00'), ('2026-11-08 00:06:00+00'), ('2026-11-08 00:10:00+00');
    `);
    await pg.close();
    const source = new PgliteSource(dir);
    try {
      assert.equal(await source.maxChangeLogId(), 3);
      assert.equal(await source.firstIdWithinFiveMinutes(3), 2);
      const text = await source.dumpData(["likes"]);
      assert.match(text, /^COPY public\.likes \(id, story_id, "character", created_at, env\) FROM stdin;\n/);
      const row = parseDumpCopyBlocks(text).get("likes")!.rows[0];
      assert.equal(row.story_id, "tab\tline\nend");
      assert.equal(row.character, "x");
      assert.equal(row.created_at, "2026-11-05 11:48:12.3456+00");
    } finally {
      await source.close();
    }
    const empty = new PgliteSource(join(WORK, "pglite-empty"));
    try {
      await assert.rejects(empty.maxChangeLogId(), /apply supabase\/migrations\/\*_d1_change_log\.sql first/);
    } finally {
      await empty.close();
    }
  });

  rmSync(WORK, { recursive: true, force: true });
  console.log(`d1-first-copy spec passed (${checks} checks)`);
}

main().catch((error) => {
  console.error(error);
  rmSync(WORK, { recursive: true, force: true });
  process.exit(1);
});

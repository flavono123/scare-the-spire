/**
 * The operator writes of scripts/admin/admin-writes.ts (step 6 plan P17, WP-DEV), against a local
 * SQLite copy of the D1 schema per env and Supabase on PGlite (the repo schema with its triggers):
 *
 *   - each env follows its own write gate: supabase -> today's Supabase request or SQL, d1 -> the D1
 *     change and its outbox row(s) in one call (none when nothing changed), paused -> nothing;
 *   - the D1 path's outbox rows, sent by the real step 5 mirror, leave Supabase with the same row as
 *     today's direct write (both are run on the same seed rows, one per env, and compared), and the
 *     mirror's request carries today's columns;
 *   - with every source on supabase the request and the SQL are exactly today's.
 *
 * D1 calls go through the same inlined SQL text wrangler is sent (toSqlText), as one transaction.
 * Usage: tsx scripts/admin-d1-writes.spec.ts
 */
import assert from "node:assert/strict";

import { DEFAULT_PROFILE_NICKNAMES } from "../src/lib/profile-character-nicknames";
import { mapRow } from "../src/lib/d1-sync/row-mapper";
import { toSqlText, type D1Statement } from "../src/lib/d1-sync/statements";
import { WRITE_GROUPS, WRITE_PAUSED_KEY, sourceFlagKey, type WriteGroup } from "../src/lib/write-source-flags";
import { mirrorOutbox } from "../workers/api/d1-write/mirror";
import type { D1EnvName, D1Remote } from "./lib/d1-remote";
import {
  AdminWriteError,
  BUILTIN_UPDATE_COLUMNS,
  builtinSeedSql,
  findStoriesByPatchLine,
  inquiryReplyRequest,
  relinkStoryPatchLine,
  replyToContactInquiry,
  saveColorfulPhilosopherPostRow,
  saveProfileNicknamePools,
  seedBuiltinTournaments,
  storyRelinkSql,
  WritesPausedError,
  type AdminDeps,
  type BuiltinTournamentRow,
  type PhilosopherPostRow,
} from "./admin/admin-writes";
import { repoSupabase, PgliteRest } from "./d1-sync/pglite-supabase";
import { SqliteD1 } from "./d1-sync/write-sqlite-d1";

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

const PROJECT = "https://abcdefghijklmnopqrst.supabase.co";
const KEY = "sb_secret_test";
const USER = "4f1c2a7e-9b3d-4c5e-8f60-1a2b3c4d5e6f";
const NOW = Date.parse("2026-11-10T03:04:05.678Z");
const U = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const DATA_ENV: Record<D1EnvName, "production" | "development"> = { production: "production", testbed: "development" };

type Row = Record<string, unknown>;

async function main() {
  const pg = await repoSupabase({ contactWhen: true });
  await pg.query("insert into auth.users (id) values ($1)", [USER]);
  const rest = new PgliteRest(pg);
  const restCalls: Array<{ method: string; url: URL; body: string }> = [];
  const restFetch = async (input: Request | string | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    restCalls.push({ method: request.method, url: new URL(request.url), body: request.method === "GET" ? "" : await request.clone().text() });
    return rest.handle(request);
  };
  const sqlRuns: string[] = [];

  const d1: Record<D1EnvName, SqliteD1> = { production: new SqliteD1(), testbed: new SqliteD1() };
  const d1Calls: Array<{ env: D1EnvName; statements: number }> = [];

  /** A D1Remote over the local copy, sent the inlined SQL text a wrangler call carries. */
  function sqliteRemote(env: D1EnvName): D1Remote {
    return {
      env,
      mode: "local",
      async run(statements: readonly D1Statement[]) {
        d1Calls.push({ env, statements: statements.length });
        const db = d1[env];
        const results = await db.batch(statements.map((statement) => db.prepare(toSqlText(statement))));
        return results.map((result) => (result.results ?? []) as Row[]);
      },
    };
  }

  function deps(extra: Partial<AdminDeps> = {}): AdminDeps {
    let n = 900;
    return {
      d1: sqliteRemote,
      supabase: { url: PROJECT, key: KEY },
      fetch: restFetch,
      supabaseSql: async (sql) => {
        sqlRuns.push(sql);
        await pg.exec(sql);
      },
      now: () => NOW,
      uuid: () => U((n += 1)),
      ...extra,
    };
  }

  function setGate(env: D1EnvName, source: "d1" | "supabase", options: { paused?: boolean; only?: WriteGroup[] } = {}) {
    const db = d1[env];
    db.run("DELETE FROM runtime_flags");
    for (const group of WRITE_GROUPS) {
      const value = options.only ? (options.only.includes(group) ? "d1" : "supabase") : source;
      db.run("INSERT INTO runtime_flags (key, value, updated_at) VALUES (?1, ?2, ?3)", sourceFlagKey(group), value, "2026-11-10T00:00:00.000Z");
    }
    if (options.paused) db.run("INSERT INTO runtime_flags (key, value, updated_at) VALUES (?1, 'on', ?2)", WRITE_PAUSED_KEY, "2026-11-10T00:00:00.000Z");
  }

  function outbox(env: D1EnvName) {
    return d1[env].rows("SELECT table_name, op, match_key, payload FROM outbox ORDER BY seq").map((row) => ({
      table: String(row.table_name),
      op: String(row.op),
      match: JSON.parse(String(row.match_key)) as Row,
      payload: row.payload === null ? null : (JSON.parse(String(row.payload)) as Row),
    }));
  }

  /** Runs the real mirror of an env until its outbox is empty; returns the Supabase calls it made. */
  async function mirror(env: D1EnvName) {
    const before = restCalls.length;
    for (let i = 0; i < 5 && outbox(env).length; i += 1) {
      const report = await mirrorOutbox(
        { DB: d1[env], API_SUPABASE_URL: PROJECT, API_SUPABASE_SECRET_KEY: KEY, API_DATA_ENV: DATA_ENV[env] },
        { fetcher: restFetch },
      );
      assert.equal(report.rejected, 0, "Supabase takes every mirrored row");
    }
    assert.equal(outbox(env).length, 0, "the mirror drained the outbox");
    return restCalls.slice(before);
  }

  /** The sync's D1 copy of Supabase rows (the first copy's path: to_jsonb image -> row mapper). */
  async function copyToD1(env: D1EnvName, table: string, where: string, params: unknown[] = []) {
    const { rows } = await pg.query<{ j: Row }>(`select to_jsonb(t) as j from public.${table} t where ${where}`, params);
    for (const { j } of rows) {
      const result = mapRow(table, j, { nowMs: NOW });
      if (!result.ok) throw new Error(`${table}: ${result.reject.error}`);
      await d1[env].batch(result.statements.map((statement) => d1[env].prepare(statement.sql).bind(...statement.params)));
    }
  }

  async function sbRows(sql: string, params: unknown[] = []): Promise<Row[]> {
    return (await pg.query<Row>(sql, params)).rows;
  }

  function without(row: Row | undefined, names: readonly string[]): Row {
    return Object.fromEntries(Object.entries(row ?? {}).filter(([name]) => !names.includes(name)));
  }

  // ------------------------------------------------------------------------------------------- 1. inquiry reply

  await check("inquiry reply: supabase PATCHes today's three columns; d1 updates D1 with one outbox row; Supabase rows end equal", async () => {
    const insert = "insert into public.contact_inquiries (id, user_id, category, message, page_path, service_locale, game_locale, env, status, " +
      "admin_response, responded_at, reply_seen_at, created_at) values ($1, $2, 'bug', '버그가 있습니다 확인해 주세요', '/contact', 'ko', 'kor', $3, 'done', " +
      "'예전 답변', '2026-11-01T00:00:00Z', '2026-11-02T00:00:00Z', '2026-10-31T00:00:00Z')";
    await pg.query(insert, [U(1), USER, "production"]);
    await pg.query(insert, [U(2), USER, "development"]);
    await copyToD1("testbed", "contact_inquiries", "id = $1", [U(2)]);
    setGate("production", "supabase");
    setGate("testbed", "d1");

    restCalls.length = 0;
    const today = await replyToContactInquiry(deps(), { id: U(1), dataEnv: "production", response: "  새 답변입니다  ", status: "reviewing" });
    assert.equal(today.store, "supabase");
    assert.deepEqual(restCalls.map((entry) => `${entry.method} ${entry.url.pathname}${entry.url.search}`), [`PATCH /rest/v1/contact_inquiries?id=eq.${U(1)}`]);
    const todayBody = JSON.parse(restCalls[0].body) as Row;
    assert.deepEqual(todayBody, inquiryReplyRequest(U(1), "새 답변입니다", "reviewing", NOW).body, "today's request");
    assert.deepEqual(todayBody, { admin_response: "새 답변입니다", responded_at: new Date(NOW).toISOString(), status: "done" });
    assert.equal(outbox("production").length, 0, "nothing in D1 on the supabase path");

    const viaD1 = await replyToContactInquiry(deps(), { id: U(2).toUpperCase(), dataEnv: "development", response: "새 답변입니다", status: "reviewing" });
    assert.deepEqual([viaD1.store, viaD1.matched], ["d1", true]);
    assert.deepEqual(outbox("testbed"), [{
      table: "contact_inquiries", op: "update", match: { id: U(2) },
      payload: { read: "contact_inquiries", columns: ["admin_response", "responded_at", "status"] },
    }]);
    assert.deepEqual(d1.testbed.one("SELECT admin_response, responded_at, status, reply_seen_at FROM contact_inquiries WHERE id = ?1", U(2)), {
      admin_response: "새 답변입니다", responded_at: "2026-11-10T03:04:05.678000Z", status: "done", reply_seen_at: null,
    }, "a changed reply clears reply_seen_at as Supabase's trigger does");
    const calls = await mirror("testbed");
    assert.deepEqual(calls.map((entry) => `${entry.method} ${entry.url.pathname}${entry.url.search}`), [`PATCH /rest/v1/contact_inquiries?id=eq.${U(2)}&env=eq.development`]);
    assert.deepEqual(Object.keys(JSON.parse(calls[0].body)).sort(), Object.keys(todayBody).sort(), "the mirror sends today's columns");

    const [prod] = await sbRows("select * from public.contact_inquiries where id = $1", [U(1)]);
    const [dev] = await sbRows("select * from public.contact_inquiries where id = $1", [U(2)]);
    assert.equal(prod.reply_seen_at, null);
    assert.deepEqual(without(dev, ["id", "env"]), without(prod, ["id", "env"]), "same Supabase row by either path");
  });

  await check("inquiry reply: clearing a reply, a missing id (no outbox row), a paused gate and the input checks", async () => {
    await replyToContactInquiry(deps(), { id: U(1), dataEnv: "production", response: "", status: "spam" });
    await replyToContactInquiry(deps(), { id: U(2), dataEnv: "development", response: "", status: "spam" });
    await mirror("testbed");
    const [prod] = await sbRows("select * from public.contact_inquiries where id = $1", [U(1)]);
    const [dev] = await sbRows("select * from public.contact_inquiries where id = $1", [U(2)]);
    assert.deepEqual([prod.admin_response, prod.responded_at, prod.status], [null, null, "spam"]);
    assert.deepEqual(without(dev, ["id", "env"]), without(prod, ["id", "env"]));

    const missing = await replyToContactInquiry(deps(), { id: U(3), dataEnv: "development", response: "답변", status: "done" });
    assert.equal(missing.matched, false);
    assert.equal(outbox("testbed").length, 0, "no change, no outbox row");

    setGate("testbed", "d1", { paused: true });
    await assert.rejects(replyToContactInquiry(deps(), { id: U(2), dataEnv: "development", response: "멈춤", status: "done" }), WritesPausedError);
    assert.equal(d1.testbed.one("SELECT admin_response FROM contact_inquiries WHERE id = ?1", U(2))!.admin_response, null, "nothing written while paused");
    setGate("testbed", "d1");

    await assert.rejects(replyToContactInquiry(deps(), { id: "nope", dataEnv: "development", response: "", status: "done" }), /Invalid inquiry id/);
    await assert.rejects(replyToContactInquiry(deps(), { id: U(2), dataEnv: "development", response: "", status: "done" }), /A completed inquiry needs a response/);
    await assert.rejects(replyToContactInquiry(deps(), { id: U(2), dataEnv: "staging", response: "답", status: "done" }), /Invalid inquiry env/);
  });

  await check("inquiry reply: a dry run writes nothing; --local refuses the Supabase path unless it is a dry run", async () => {
    const before = restCalls.length;
    const lines: string[] = [];
    await replyToContactInquiry(deps({ dryRun: true, log: (line) => lines.push(line) }), { id: U(2), dataEnv: "development", response: "드라이", status: "done" });
    await replyToContactInquiry(deps({ dryRun: true, log: (line) => lines.push(line) }), { id: U(1), dataEnv: "production", response: "드라이", status: "done" });
    assert.equal(outbox("testbed").length, 0);
    assert.equal(d1.testbed.one("SELECT admin_response FROM contact_inquiries WHERE id = ?1", U(2))!.admin_response, null);
    assert.equal(restCalls.length, before, "no Supabase call in a dry run");
    assert.ok(lines.some((line) => line.includes("UPDATE contact_inquiries")) && lines.some((line) => line.includes("PATCH /rest/v1/contact_inquiries")));
    await assert.rejects(replyToContactInquiry(deps({ localD1: true }), { id: U(1), dataEnv: "production", response: "로컬", status: "done" }), AdminWriteError);
    assert.equal(restCalls.length, before);
  });

  // ------------------------------------------------------------------------------------------- 2. nickname pools

  const POOLS = { ko: ["강철 심장", "검은 발톱", "푸른 눈"], en: ["Iron Heart", "Black Claw"] };

  async function resetPools() {
    await pg.query("delete from public.profile_character_nickname_pools");
    await pg.query(
      "insert into public.profile_character_nickname_pools (character_id, locale, nicknames, updated_at) " +
        "select c, l, array['처음 이름'], '2026-10-01T00:00:00Z' from unnest(array['IRONCLAD','SILENT','REGENT','NECROBINDER','DEFECT']) c, unnest(array['ko','en']) l",
    );
    for (const env of ["production", "testbed"] as const) {
      d1[env].run("DELETE FROM profile_character_nickname_pools");
      await copyToD1(env, "profile_character_nickname_pools", "true");
    }
  }

  const poolSnapshot = () => sbRows("select character_id, locale, nicknames, updated_at from public.profile_character_nickname_pools order by character_id, locale");

  await check("nickname pools: supabase is today's one upsert; d1 writes both databases, outbox rows on production only; same Supabase rows", async () => {
    await resetPools();
    setGate("production", "supabase");
    setGate("testbed", "supabase");
    restCalls.length = 0;
    const today = await saveProfileNicknamePools(deps(), POOLS);
    assert.deepEqual(today.plans.map((plan) => plan.store), ["supabase"]);
    assert.deepEqual(restCalls.map((entry) => `${entry.method} ${entry.url.pathname}${entry.url.search}`), [
      "POST /rest/v1/profile_character_nickname_pools?on_conflict=character_id%2Clocale",
    ]);
    const todayBody = JSON.parse(restCalls[0].body) as Row[];
    assert.equal(todayBody.length, 10);
    assert.deepEqual(Object.keys(todayBody[0]), ["character_id", "locale", "nicknames", "updated_at"]);
    const afterToday = await poolSnapshot();
    assert.equal(d1.production.rows("SELECT * FROM outbox").length + d1.testbed.rows("SELECT * FROM outbox").length, 0);

    await resetPools();
    setGate("production", "d1");
    setGate("testbed", "d1");
    const viaD1 = await saveProfileNicknamePools(deps(), POOLS);
    assert.deepEqual(viaD1.plans.map((plan) => (plan.store === "d1" ? plan.env : plan.store)), ["testbed", "production"]);
    const prodOutbox = outbox("production");
    assert.equal(prodOutbox.length, 10, "one outbox row per pool row");
    assert.deepEqual(prodOutbox[0], { table: "profile_character_nickname_pools", op: "upsert", match: { character_id: "IRONCLAD", locale: "ko" }, payload: { read: "profile_character_nickname_pools" } });
    assert.equal(outbox("testbed").length, 0, "the testbed mirror never sends env-less rows: no outbox row there");
    const d1Pools = (env: D1EnvName) => d1[env].rows("SELECT character_id, locale, nicknames, updated_at FROM profile_character_nickname_pools ORDER BY character_id, locale");
    assert.deepEqual(d1Pools("testbed"), d1Pools("production"), "every database holds the same rows");
    const calls = await mirror("production");
    assert.equal(calls.length, 10);
    for (const call of calls) {
      assert.equal(`${call.method} ${call.url.pathname}${call.url.search}`, "POST /rest/v1/profile_character_nickname_pools?on_conflict=character_id%2Clocale");
      assert.deepEqual(Object.keys(JSON.parse(call.body)), ["character_id", "locale", "nicknames", "updated_at"], "today's row shape, no env");
    }
    assert.deepEqual(await poolSnapshot(), afterToday, "same Supabase rows by either path");
    assert.deepEqual((await poolSnapshot()).find((row) => row.character_id === "SILENT" && row.locale === "ko")!.nicknames, [...POOLS.ko].sort((a, b) => a.localeCompare(b, "ko")));
  });

  await check("nickname pools: mixed gates write each store once; a reset writes the defaults; invalid lists are refused", async () => {
    await resetPools();
    setGate("production", "supabase");
    setGate("testbed", "d1");
    const mixed = await saveProfileNicknamePools(deps(), DEFAULT_PROFILE_NICKNAMES);
    assert.deepEqual(mixed.plans.map((plan) => (plan.store === "d1" ? plan.env : plan.store)), ["testbed", "supabase"]);
    assert.equal(outbox("testbed").length + outbox("production").length, 0);
    const sb = await poolSnapshot();
    const tb = d1.testbed.rows("SELECT character_id, locale, nicknames FROM profile_character_nickname_pools ORDER BY character_id, locale");
    assert.deepEqual(tb.map((row) => JSON.parse(String(row.nicknames))), sb.map((row) => row.nicknames), "testbed D1 got the same lists");
    await assert.rejects(saveProfileNicknamePools(deps(), { ko: [" 공백 "], en: ["ok"] }), /invalid nickname list/);
  });

  // ------------------------------------------------------------------------------------------- 3. philosopher post

  const WEEK = "2026-11-16";
  const NEW_WEEK = "2026-11-23";
  function philosopherRow(week: string, body: string): PhilosopherPostRow {
    return {
      week_start: week, slot: "card", resource_type: "card", resource_id: "ABRASIVE", name_ko: "연마", name_en: "Abrasive",
      image_url: "/images/sts2/cards/abrasive.webp", body, game_version: "0.107.1",
    };
  }
  const philosopherSnapshot = (env: string, week: string) =>
    sbRows("select * from public.colorful_philosopher_posts where env = $1 and week_start = $2 and slot = 'card'", [env, week]);

  await check("philosopher post: supabase is today's upsert; d1 upserts the week in D1 (its id kept) with one outbox row; same Supabase rows", async () => {
    const insert = "insert into public.colorful_philosopher_posts (id, env, week_start, slot, resource_type, resource_id, name_ko, name_en, image_url, body, game_version, created_at) " +
      "values ($1, $2, $3, 'card', 'card', 'BASH', '강타', 'Bash', null, '예전 화두', '0.106', '2026-11-01T00:00:00Z')";
    await pg.query(insert, [U(11), "production", WEEK]);
    await pg.query(insert, [U(12), "development", WEEK]);
    await copyToD1("testbed", "colorful_philosopher_posts", "id = $1", [U(12)]);
    setGate("production", "supabase");
    setGate("testbed", "d1");

    restCalls.length = 0;
    const today = await saveColorfulPhilosopherPostRow(deps(), "production", philosopherRow(WEEK, "새 화두"));
    assert.equal(today.store, "supabase");
    assert.equal(restCalls.length, 1);
    const request = restCalls[0];
    assert.equal(`${request.method} ${request.url.pathname}`, "POST /rest/v1/colorful_philosopher_posts");
    assert.equal(request.url.searchParams.get("on_conflict"), "env,week_start,slot");
    const todayBody = JSON.parse(request.body) as Row;
    assert.deepEqual(Object.keys(todayBody).sort(), ["body", "env", "game_version", "image_url", "name_en", "name_ko", "resource_id", "resource_type", "slot", "week_start"]);

    const viaD1 = await saveColorfulPhilosopherPostRow(deps(), "development", philosopherRow(WEEK, "새 화두"));
    assert.equal(viaD1.store, "d1");
    assert.equal(viaD1.saved?.id, U(12), "an existing week keeps its id");
    assert.equal(viaD1.saved?.body, "새 화두");
    assert.deepEqual(outbox("testbed"), [{ table: "colorful_philosopher_posts", op: "upsert", match: { week_start: WEEK, slot: "card" }, payload: { read: "colorful_philosopher_posts" } }]);
    const calls = await mirror("testbed");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url.searchParams.get("on_conflict"), "env,week_start,slot", "today's conflict target");
    const mirrored = JSON.parse(calls[0].body) as Row;
    assert.deepEqual(Object.keys(mirrored).filter((name) => !(name in todayBody)).sort(), ["created_at", "id"], "today's columns plus D1's id and created_at");
    assert.ok(Object.keys(todayBody).every((name) => name in mirrored));
    const [prod] = await philosopherSnapshot("production", WEEK);
    const [dev] = await philosopherSnapshot("development", WEEK);
    assert.deepEqual(without(dev, ["id", "env"]), without(prod, ["id", "env"]), "same Supabase row by either path");
    assert.equal(dev.id, U(12));
  });

  await check("philosopher post: a new week gets D1's id and time in Supabase; the source is d1 once any group is", async () => {
    await saveColorfulPhilosopherPostRow(deps(), "production", philosopherRow(NEW_WEEK, "다음 주 화두"));
    // Only comments on d1: the step 2 sync is off, so this table goes to D1 too.
    setGate("testbed", "supabase", { only: ["comments"] });
    const viaD1 = await saveColorfulPhilosopherPostRow(deps(), "development", philosopherRow(NEW_WEEK, "다음 주 화두"));
    assert.equal(viaD1.store, "d1");
    await mirror("testbed");
    const [prod] = await philosopherSnapshot("production", NEW_WEEK);
    const [dev] = await philosopherSnapshot("development", NEW_WEEK);
    assert.deepEqual(without(dev, ["id", "env", "created_at"]), without(prod, ["id", "env", "created_at"]));
    const d1Row = d1.testbed.one("SELECT id, created_at FROM colorful_philosopher_posts WHERE week_start = ?1 AND slot = 'card'", NEW_WEEK)!;
    assert.equal(dev.id, d1Row.id, "the mirror kept D1's id");
    assert.equal((dev.created_at as Date).toISOString(), new Date(NOW).toISOString(), "and D1's created_at");
    setGate("testbed", "supabase");
    assert.equal((await saveColorfulPhilosopherPostRow(deps({ dryRun: true }), "development", philosopherRow(NEW_WEEK, "x"))).store, "supabase", "every group on supabase: Supabase");
    setGate("testbed", "d1");
  });

  // ------------------------------------------------------------------------------------------- 4. builtin tournaments

  const EXISTING = "builtin:cards-ironclad";
  const FRESH = "builtin:potions-all";
  function seedRows(env: string): BuiltinTournamentRow[] {
    return [
      { nickname: "슬서운이야기", title: "아이언클래드 카드", note: "새 설명", preset_key: EXISTING, game_version: "0.107.1", env,
        pool: [{ type: "card", id: "BASH" }, { type: "card", id: "STRIKE" }, { type: "card", id: "DEFEND" }], created_at: "2026-08-28T00:00:00.000Z" },
      { nickname: "슬서운이야기", title: "포션 전체", note: "", preset_key: FRESH, game_version: "0.107.1", env,
        pool: [{ type: "potion", id: "FIRE" }, { type: "potion", id: "BLOCK" }], created_at: "2026-08-28T00:00:11.000Z" },
    ];
  }
  const tournamentSnapshot = (env: string) =>
    sbRows("select * from public.favorite_tournament_posts where env = $1 and preset_key like 'builtin:%' order by preset_key", [env]);

  await check("worldcup seed: supabase runs today's SQL; d1 updates or inserts the builtins with outbox rows; same Supabase rows", async () => {
    const insert = "insert into public.favorite_tournament_posts (id, user_id, nickname, title, note, preset_key, game_version, pool, env, created_at) " +
      "values ($1, null, '슬서운이야기', '옛 제목', '옛 설명', $2, '0.100', $3::jsonb, $4, '2026-08-28T00:00:00Z')";
    const oldPool = JSON.stringify([{ type: "card", id: "BASH" }, { type: "card", id: "ANGER" }]);
    await pg.query(insert, [U(21), EXISTING, oldPool, "production"]);
    await pg.query(insert, [U(22), EXISTING, oldPool, "development"]);
    await copyToD1("testbed", "favorite_tournament_posts", "id = $1", [U(22)]);
    setGate("production", "supabase");
    setGate("testbed", "d1");

    sqlRuns.length = 0;
    const rows = [...seedRows("production"), ...seedRows("development")];
    const result = await seedBuiltinTournaments(deps(), rows, "fttest");
    assert.deepEqual(result.sources, { production: "supabase", development: "d1" });
    assert.deepEqual(sqlRuns, [builtinSeedSql(seedRows("production"), "fttest")], "today's SQL with the supabase env's rows");
    const box = outbox("testbed");
    assert.equal(box.length, 2);
    assert.deepEqual(box[0], { table: "favorite_tournament_posts", op: "update", match: { id: U(22) }, payload: { read: "posts", columns: [...BUILTIN_UPDATE_COLUMNS], extra: { game_version: "0.107.1" } } });
    assert.deepEqual([box[1].op, box[1].payload], ["insert", { read: "posts", extra: { game_version: "0.107.1" } }]);
    assert.deepEqual(d1.testbed.rows("SELECT ord, resource_type, resource_id FROM post_favorite_tournament_pool WHERE post_id = ?1 ORDER BY ord", U(22)).map((row) => row.resource_id), ["BASH", "STRIKE", "DEFEND"]);
    assert.equal(d1.testbed.one("SELECT summary FROM posts WHERE service = 'favorite_tournament' AND id = ?1", U(22))!.summary, "아이언클래드 카드");

    const calls = await mirror("testbed");
    assert.deepEqual(calls.map((entry) => entry.method), ["PATCH", "POST"]);
    assert.deepEqual(Object.keys(JSON.parse(calls[0].body)).sort(), ["game_version", "nickname", "note", "pool", "title"], "today's conflict update columns");
    const inserted = Object.keys(JSON.parse(calls[1].body));
    for (const name of ["user_id", "nickname", "title", "note", "preset_key", "game_version", "pool", "env", "created_at"]) assert.ok(inserted.includes(name), `insert carries ${name}`);

    const prod = await tournamentSnapshot("production");
    const dev = await tournamentSnapshot("development");
    assert.equal(dev.length, 2);
    assert.deepEqual(dev.map((row) => without(row, ["id", "env"])), prod.map((row) => without(row, ["id", "env"])), "same Supabase rows by either path");
    assert.equal(dev[0].id, U(22), "the existing builtin keeps its id");
  });

  await check("worldcup seed: every env on supabase runs exactly today's statement; a re-seed on d1 only updates", async () => {
    setGate("testbed", "supabase");
    sqlRuns.length = 0;
    const rows = [...seedRows("production"), ...seedRows("development")];
    await seedBuiltinTournaments(deps({ dryRun: true }), rows, "fttest");
    assert.deepEqual(sqlRuns, [], "a dry run runs no SQL");
    await seedBuiltinTournaments(deps(), rows, "fttest");
    assert.deepEqual(sqlRuns, [builtinSeedSql(rows, "fttest")]);
    setGate("testbed", "d1");
    await seedBuiltinTournaments(deps(), seedRows("development"), "fttest");
    assert.deepEqual(outbox("testbed").map((entry) => entry.op), ["update", "update"]);
    await mirror("testbed");
  });

  // ------------------------------------------------------------------------------------------- 5. story relink

  const OLD = "patch-2026-11-12-line-0007";
  const NEW = "patch-2026-11-12-line-0008";
  const RELINK = { oldId: OLD, newId: NEW, entityType: "card", entityId: "BASH" };

  await check("story relink: supabase runs the skill's UPDATE; d1 updates D1 with one outbox row per story; same Supabase rows", async () => {
    const insert = "insert into public.community_stories (id, user_id, nickname, sentence, game, entity_type, entity_id, patch_line_id, tags, linked_entities, env, created_at) " +
      "values ($1, $2, '닉', $3, 'sts2', 'relic', 'ANCHOR', $4, '{}', '[]', $5, '2026-11-01T00:00:00Z')";
    await pg.query(insert, [U(31), USER, "첫 이야기", OLD, "production"]);
    await pg.query(insert, [U(32), USER, "둘째 이야기", OLD, "production"]);
    await pg.query(insert, [U(33), USER, "첫 이야기", OLD, "development"]);
    await pg.query(insert, [U(34), USER, "둘째 이야기", OLD, "development"]);
    await pg.query(insert, [U(35), USER, "다른 이야기", "other-line", "development"]);
    await copyToD1("testbed", "community_stories", "env = 'development'");
    setGate("production", "supabase");
    setGate("testbed", "d1");

    const found = await findStoriesByPatchLine(deps({ supabaseSql: async (sql) => void sqlRuns.push(sql) }), OLD);
    assert.deepEqual(found.map((row) => row.id), [U(33), U(34)], "D1 rows of the d1 env");

    sqlRuns.length = 0;
    const result = await relinkStoryPatchLine(deps(), RELINK);
    assert.deepEqual(sqlRuns, [storyRelinkSql(RELINK, "production")]);
    assert.match(sqlRuns[0], /^UPDATE public\.community_stories SET patch_line_id = '.+', entity_type = 'card', entity_id = 'BASH' WHERE patch_line_id = '.+' AND env = 'production';$/);
    assert.deepEqual(result.relinked.map((row) => row.id), [U(33), U(34)]);
    assert.deepEqual(outbox("testbed"), [U(33), U(34)].map((id) => ({
      table: "community_stories", op: "update", match: { id }, payload: { read: "community_stories", columns: ["patch_line_id", "entity_type", "entity_id"] },
    })));
    const calls = await mirror("testbed");
    assert.deepEqual(calls.map((entry) => `${entry.method} ${entry.url.searchParams.get("id")} ${entry.url.searchParams.get("env")}`), [`PATCH eq.${U(33)} eq.development`, `PATCH eq.${U(34)} eq.development`]);
    assert.deepEqual(Object.keys(JSON.parse(calls[0].body)).sort(), ["entity_id", "entity_type", "patch_line_id"], "the skill's SET columns");
    const prod = await sbRows("select * from public.community_stories where id = any($1::uuid[]) order by sentence", [[U(31), U(32)]]);
    const dev = await sbRows("select * from public.community_stories where id = any($1::uuid[]) order by sentence", [[U(33), U(34)]]);
    assert.equal(prod.length, 2);
    assert.equal(prod[0].patch_line_id, NEW);
    assert.deepEqual(dev.map((row) => without(row, ["id", "env"])), prod.map((row) => without(row, ["id", "env"])), "same Supabase rows by either path");
    assert.equal((await sbRows("select patch_line_id from public.community_stories where id = $1", [U(35)]))[0].patch_line_id, "other-line");
  });

  await check("story relink: every env on supabase runs exactly the skill's statement; nothing to relink writes no outbox row", async () => {
    setGate("testbed", "supabase");
    sqlRuns.length = 0;
    await relinkStoryPatchLine(deps({ dryRun: true }), RELINK);
    assert.deepEqual(sqlRuns, []);
    await relinkStoryPatchLine(deps(), { ...RELINK, oldId: "missing-line" });
    assert.deepEqual(sqlRuns, [`UPDATE public.community_stories SET patch_line_id = '${NEW}', entity_type = 'card', entity_id = 'BASH' WHERE patch_line_id = 'missing-line';`]);
    setGate("testbed", "d1");
    await relinkStoryPatchLine(deps(), { ...RELINK, oldId: "missing-line" });
    assert.equal(outbox("testbed").length, 0);
    await assert.rejects(relinkStoryPatchLine(deps(), { ...RELINK, newId: OLD }), /same/);
    await assert.rejects(relinkStoryPatchLine(deps(), { ...RELINK, entityId: "" }), /--entity-id is required/);
  });

  await check("every D1 write was one call (one batch)", () => {
    assert.ok(d1Calls.length > 0);
    assert.ok(d1Calls.every((call) => call.statements > 0));
  });

  await pg.close();
  console.log(`admin-d1-writes.spec: ${checks} checks passed`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

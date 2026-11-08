/**
 * The daily reconcile and the run summary fill (scripts/d1-sync/reconcile.ts) against fakes: a fake
 * PostgREST over in-memory Supabase rows, and a fake D1 HTTP API over a node:sqlite copy of the D1
 * schema. No network. Covers matching data, each kind of mismatch, the fill writing only D1, the
 * known kinds, and the notice before the first copy.
 *   pnpm exec tsx scripts/d1-reconcile.spec.ts
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { mapRow, runSummaryFillStatement, SUPABASE_TABLES, type RowImage } from "../src/lib/d1-sync/row-mapper";
import { RUN_SUMMARY_VERSION } from "../src/lib/run-list-summary";
import { d1HttpClient } from "./d1-sync/d1-http-client";
import { postgrestReader } from "./d1-sync/postgrest-reader";
import { FakeD1, FakeSupabase, firstCopy } from "./d1-sync/reconcile-fakes";
import {
  comparePlan,
  d1DatabaseId,
  hashLines,
  R3R_SQL,
  RF1_SQL,
  runReconcile,
  S4_SQL,
  SUPABASE_ORDER,
  type CheckRow,
  type ReconcileReport,
} from "./d1-sync/reconcile";
import { applyBatch, openD1TestDb, rows, type SqliteDb } from "./d1-sync/test-db";

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

const WRANGLER = readFileSync("wrangler.jsonc", "utf8");
const ACCOUNT = "acc-test";
const D1_TOKEN = "d1-token-test";
const SERVICE_KEY = "service-key-test";
const SUPABASE_URL = "https://fake.supabase.test";
const NOW = 1_762_560_000_000;
const ENV = "production";
const DEV = "development";

const U = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const TS = "2026-11-05T11:48:12.3456+00:00";
const author = { avatar_id: "IRONCLAD", avatar_kind: "character", palette_id: "red", palette_swapped: true };

// ------------------------------------------------------------------------------------------- runs

function card(id: string, floor?: number, upgrade?: number) {
  return { id, ...(floor === undefined ? {} : { floor_added_to_deck: floor }), ...(upgrade === undefined ? {} : { current_upgrade_level: upgrade }) };
}
function entry(modelId: string) {
  return { map_point_type: "monster", rooms: [{ model_id: modelId, room_type: "monster" }] };
}

const RAW_A = JSON.stringify({
  seed: "ALPHA", build_id: "v0.107.1", ascension: 7, game_mode: "standard", win: true, run_time: 3600, start_time: 1762500000,
  acts: ["ACT.OVERGROWTH", "ACT.HIVE"],
  players: [{
    id: 1, character: "CHARACTER.IRONCLAD",
    deck: [card("CARD.STRIKE_IRONCLAD", 1), card("CARD.STRIKE_IRONCLAD", 1), card("CARD.BASH", 1, 1), card("CARD.INFLAME", 5)],
    relics: [{ id: "RELIC.BURNING_BLOOD", floor_added_to_deck: 0 }, { id: "RELIC.ANCHOR", floor_added_to_deck: 3 }],
    potions: [{ id: "POTION.FIRE_POTION" }], badges: [{ id: "BADGE.SPEEDY", rarity: "gold" }],
  }],
  map_point_history: [[entry("ENCOUNTER.JAW_WORM"), entry("EVENT.NEOW")], [entry("ENCOUNTER.SLIMES")]],
});
const RAW_B = JSON.stringify({
  seed: "", build_id: "v0.106.0", ascension: 0, win: false, run_time: 120, acts: ["ACT.OVERGROWTH"],
  players: [
    { id: 1, character: "CHARACTER.SILENT", deck: [card("CARD.NEUTRALIZE", 1)], relics: [], potions: [], badges: [{ id: "BADGE.TEAM", rarity: "bronze" }] },
    { id: 2, character: "CHARACTER.DEFECT", deck: [card("CARD.ZAP", 2)], relics: [{ id: "RELIC.ANCHOR", floor_added_to_deck: 2 }], potions: [], badges: [] },
  ],
  map_point_history: [[entry("ENCOUNTER.CULTIST")]],
});
const MANUAL_COVER = { background: { kind: "character" }, phrase: "내 표지", elements: [], auto: false, suggestSeed: "x" };

function runImage(id: string, raw: string, env: string, extra: Record<string, unknown> = {}): RowImage {
  // Columns as the upload extracts them from the raw (a non-JSON raw gives empty columns).
  let run: {
    seed?: string; build_id?: string; ascension?: number; win?: boolean; start_time?: number; run_time?: number;
    players?: Array<{ character: string }>; acts?: unknown[]; map_point_history?: unknown[][];
  } = {};
  try {
    run = JSON.parse(raw);
  } catch {
    run = {};
  }
  return {
    id, raw, env, seed: run.seed ?? "", build: run.build_id ?? "unknown", character: run.players?.[0]?.character ?? "",
    ascension: run.ascension ?? 0, win: run.win ?? false, start_time: run.start_time ?? null, run_time: run.run_time ?? null,
    acts_count: run.acts?.length ?? 0,
    total_floors: (run.map_point_history ?? []).reduce((n, act) => n + act.length, 0), donor_user_id: U(1),
    donor_nickname: "기증자", created_at: TS, cover_spec: null, like_count: 0, comment_count: 0, badges: [],
    highlight_card: null, highlight_relic: null, note_blocks: null, ...extra,
  };
}

// ------------------------------------------------------------------------------------------- Supabase rows

function supabaseData(): Record<string, RowImage[]> {
  return {
    comments: [
      { id: U(101), story_id: "sts2-codex:card:bash", user_id: U(1), nickname: "닉", content: "좋은 카드", created_at: TS, env: ENV,
        content_blocks: [{ type: "text", text: "좋은 카드" }], ...author, parent_id: null, meta: null },
      { id: U(102), story_id: "history-course:r0000000000000a01", user_id: U(2), nickname: "닉2", content: "런 댓글",
        created_at: "2026-11-06T01:00:00+00:00", env: ENV, content_blocks: null, ...author, parent_id: null, meta: null },
      { id: U(103), story_id: "sts2-codex:card:bash", user_id: U(3), nickname: "개발", content: "dev", created_at: TS, env: DEV,
        content_blocks: null, ...author, parent_id: null, meta: null },
    ],
    comment_likes: [
      { id: U(201), comment_id: U(101), user_id: U(2), created_at: TS },
      { id: U(202), comment_id: U(101), user_id: U(3), created_at: TS },
      { id: U(203), comment_id: U(103), user_id: U(1), created_at: TS },
    ],
    likes: [
      { id: U(211), story_id: "sts2-codex:card:bash", user_id: U(2), created_at: TS, env: ENV, reaction_type: "thumb_up" },
      { id: U(212), story_id: `c-c-c-combo:${U(402)}`, user_id: U(2), created_at: TS, env: ENV, reaction_type: "thumb_up" },
      { id: U(213), story_id: "sts2-codex:card:bash", user_id: U(3), created_at: TS, env: DEV, reaction_type: "thumb_up" },
    ],
    resource_reactions: [{ env: ENV, resource_type: "card", resource_id: "bash", game_version: "0.107.1", user_id: U(1), kind: "buff" }],
    resource_reaction_counts: [
      { env: ENV, resource_type: "card", resource_id: "bash", game_version: "0.107.1", buff_count: 1, nerf_count: 0, rework_count: 0 },
    ],
    community_stories: [{
      id: U(301), user_id: null, nickname: "닉", sentence: "이야기 한 줄", game: "sts2", env: ENV, created_at: TS,
      static_story_id: "story-1", entity_type: "card", entity_id: "bash", change_id: null, patch_line_id: null, source: "v0.103.0",
      tags: ["버프"], linked_entities: [{ type: "card", id: "bash" }], avatar_id: null, avatar_kind: null, palette_id: null,
      palette_swapped: null,
    }],
    chemical_posts: [{
      id: U(401), user_id: U(1), nickname: "닉", content: [{ type: "text", text: "케미" }], content_text: "케미컬 한 줄",
      env: ENV, created_at: TS, like_count: 0, comment_count: 0, ...author,
    }],
    combo_posts: [{
      id: U(402), user_id: U(1), nickname: "닉", content: [], content_text: "콤보 설명",
      resources: [{ type: "card", id: "bash" }, { type: "relic", id: "anchor" }], env: ENV, created_at: TS, like_count: 0,
      comment_count: 0, ...author,
    }],
    transfigure_posts: [{
      id: U(403), user_id: U(1), nickname: "닉", resource_type: "card", resource_id: "bash", source_text: "원문",
      source_game_locale: "kor", content: [], content_text: "변형 설명", env: ENV, created_at: TS, title: "제목",
      transformed_name: null, transformed_cost: "2", upgraded_content: null, upgraded_content_text: null,
      transformed_upgrade_cost: null, show_upgrade: false, card_top_keywords: ["보존"], card_bottom_keywords: [],
      upgraded_card_top_keywords: [], upgraded_card_bottom_keywords: [], transformed_card_type: "공격",
      transformed_card_rarity: "일반", transformed_star_cost: null, transformed_upgrade_star_cost: null, token_color: null,
      token_wax: null, like_count: 0, comment_count: 0, transformed_card_color: "ironclad", omit_energy_cost: false, ...author,
      extra_variants: [{ b: 2, a: 1 }],
    }],
    this_or_that_posts: [
      { id: U(404), user_id: U(1), nickname: "닉", left_type: "card", left_id: "bash", right_type: "card", right_id: "strike",
        reason: "이유가 있다", env: ENV, created_at: TS, like_count: 1, comment_count: 0, left_vote_count: 1, right_vote_count: 0,
        vote_rate_bps: 10000, ...author },
      { id: U(414), user_id: U(3), nickname: "개발", left_type: "card", left_id: "bash", right_type: "card", right_id: "zap",
        reason: "개발 글", env: DEV, created_at: TS, like_count: 0, comment_count: 0, left_vote_count: 0, right_vote_count: 0,
        vote_rate_bps: 0, ...author },
    ],
    favorite_tournament_posts: [{
      id: U(405), user_id: null, nickname: "닉", title: "월드컵", note: "", preset_key: "builtin:cards", game_version: "0.107.1",
      pool: [{ type: "card", id: "bash" }, { type: "card", id: "strike" }], env: ENV, like_count: 0, comment_count: 0,
      play_count: 1, created_at: TS, ...author,
    }],
    decisions_decisions_posts: [{
      id: U(406), user_id: U(1), nickname: "닉", title: "결정", note: "메모", preset_key: "custom", game_version: "0.107.1",
      rows: [{ id: "S" }], placements: [], extra_ids: [], env: ENV, like_count: 0, comment_count: 0, created_at: TS, ...author,
    }],
    pagestorm_posts: [{
      id: U(407), user_id: U(1), nickname: "닉", title: "서류", content: { type: "doc" }, content_text: "본문", env: ENV,
      like_count: 0, comment_count: 0, created_at: TS, ...author,
    }],
    runs: [
      runImage("r0000000000000a01", RAW_A, ENV, { comment_count: 1 }),
      runImage("r0000000000000a02", RAW_B, ENV, { cover_spec: MANUAL_COVER, created_at: "2026-11-06T00:00:00+00:00" }),
      runImage("r0000000000000d01", RAW_A, DEV),
    ],
    this_or_that_post_votes: [{ post_id: U(404), user_id: U(2), choice: "left", created_surface: "feed", env: ENV, created_at: TS }],
    this_or_that_post_likes: [
      { id: U(221), post_id: U(404), user_id: U(2), env: ENV, created_at: TS },
      // A like of env production on a development post: invisible in Supabase too (cross_env, design 2.2).
      { id: U(222), post_id: U(414), user_id: U(2), env: ENV, created_at: TS },
    ],
    favorite_tournament_candidate_stats: [{
      tournament_id: U(405), env: ENV, resource_type: "card", resource_id: "bash", match_appearances: 1, match_wins: 1,
      championships: 1, current_rank: 1, rank_history: [{ at: "2026-11-05 11:48:12.3456", rank: 1 }],
    }],
    favorite_tournament_plays: [{
      id: U(501), tournament_id: U(405), user_id: U(2), env: ENV, starting_size: 2, champion_type: "card", champion_id: "bash",
      matches: [{ left_type: "card", left_id: "bash", right_type: "card", right_id: "strike", winner: "left" }], created_at: TS,
    }],
    pagestorm_drafts: [{
      id: U(601), user_id: U(1), nickname: "닉", title: "초안", content: {}, content_text: "초안 본문", env: ENV, created_at: TS,
      updated_at: TS, ...author,
    }],
    defragment_bodies: [
      { env: ENV, source_service: "combo", source_id: U(402), user_id: U(1), nickname: "닉", content: [], content_text: "조각 본문",
        created_at: TS, updated_at: TS },
      // An orphan: its post is gone (counted, never a failure).
      { env: ENV, source_service: "combo", source_id: U(499), user_id: U(1), nickname: "닉", content: [], content_text: "고아",
        created_at: TS, updated_at: TS },
    ],
    profile_character_nickname_pools: [{ character_id: "IRONCLAD", locale: "ko", nicknames: ["철갑", "강철"], updated_at: TS }],
    contact_inquiries: [{
      id: U(701), user_id: U(1), category: "bug", message: "버그가 있습니다 여기", reply_email: "a@b.c", page_path: "/codex",
      service_locale: "ko", game_locale: "kor", viewport_width: 390, viewport_height: 844, env: ENV, status: "new",
      created_at: TS, admin_response: null, responded_at: null, reply_seen_at: null,
    }],
    puzzlebox_runs: [{
      id: 42, env: ENV, game: "connections", board: "7", user_id: U(1), attempt: 1, score: 100, perfect: true,
      run: { guesses: [] }, created_at: TS,
    }],
    puzzlebox_players: [{
      user_id: U(1), nickname: "닉", avatar_id: "IRONCLAD", avatar_kind: "character", palette_id: null, palette_swapped: false,
      hidden: false, updated_at: TS,
    }],
    puzzlebox_best: [{
      env: ENV, game: "connections", board: "7", user_id: U(1), score: 100, perfect: true, run_id: 42, achieved_at: TS, attempts: 1,
    }],
    puzzlebox_board_stats: [{
      env: ENV, game: "connections", board: "7", players: 1, cleared: 1, perfect: 1, score_sum: 100, mistakes_sum: 0,
      rocks_sum: 0, purple_first: 0, level_solved: [1, 1, 1, 1], question_wrong: [], wrong_picks: [], speed_sum: 10,
    }],
    colorful_philosopher_posts: [{
      id: U(801), env: ENV, week_start: "2026-11-02", slot: "card", resource_type: "card", resource_id: "bash", name_ko: "강타",
      name_en: "Bash", image_url: null, body: "본문", game_version: "0.107.1", buff_count: 2, nerf_count: 0, rework_count: 0,
      created_at: TS,
    }],
  };
}

const PROD_DB = d1DatabaseId("production", WRANGLER);

function bareDb(): SqliteDb {
  const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as { DatabaseSync: new (location: string) => SqliteDb };
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const name of readdirSync("d1/migrations").filter((file) => /^000[12]_.*\.sql$/.test(file)).sort()) {
    db.exec(readFileSync(join("d1/migrations", name), "utf8"));
  }
  return db;
}

function scenario(opts: { schema?: "full" | "none"; copy?: boolean; watermark?: boolean; fill?: boolean; serviceKey?: string } = {}) {
  const data = supabaseData();
  const db = opts.schema === "none" ? bareDb() : openD1TestDb();
  if (opts.copy ?? true) firstCopy(db, data, ENV, { fill: opts.fill, nowMs: NOW });
  if (opts.watermark ?? true) db.exec("INSERT INTO sync_state (name, low_watermark, high_seen) VALUES ('supabase_in', 7, 7)");
  const d1 = new FakeD1(db, ACCOUNT, PROD_DB, D1_TOKEN);
  const serviceKey = opts.serviceKey ?? SERVICE_KEY;
  const supabase = new FakeSupabase(data, SUPABASE_URL, serviceKey);
  const run = (fillOnly = false) =>
    runReconcile({
      target: "production",
      d1: d1HttpClient({ accountId: ACCOUNT, databaseId: PROD_DB, token: D1_TOKEN, fetch: d1.fetch }),
      supabase: postgrestReader({ url: SUPABASE_URL, serviceKey, fetch: supabase.fetch }),
      fillOnly,
      now: () => NOW,
    });
  return { data, db, d1, supabase, run };
}

function find(report: ReconcileReport, source: string, d1Table: string, kind: CheckRow["kind"] = "rows"): CheckRow {
  const row = report.checks.find((entry) => entry.source_table === source && entry.d1_table === d1Table && entry.kind === kind);
  assert.ok(row, `check ${kind} ${source} -> ${d1Table}`);
  return row;
}

function failing(report: ReconcileReport): string[] {
  return report.checks.filter((entry) => entry.diff_count > 0).map((entry) => `${entry.kind} ${entry.source_table} -> ${entry.d1_table}`).sort();
}

function supabaseWrites(fake: FakeSupabase) {
  return fake.requests.filter((request) => request.method !== "GET" && request.path !== "/rest/v1/rpc/get_engagement_counts");
}

// ------------------------------------------------------------------------------------------- static checks

function querySql(id: string): string {
  const text = readFileSync("docs/supabase-exit/d1-schema/queries.sql", "utf8");
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`-- @ ${id} `));
  assert.ok(start >= 0, `queries.sql has ${id}`);
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("-- @ ") || line.trim() === "") break;
    body.push(line);
  }
  return body.join(" ").replace(/\s+/g, " ").trim();
}

const squash = (sql: string) => sql.replace(/\s+/g, " ").trim().replace(/;?$/, ";");

async function main() {
  await check("RF1, R3r, S4 and RF2 are the statements of queries.sql", () => {
    assert.equal(squash(RF1_SQL), querySql("RF1"));
    assert.equal(squash(R3R_SQL), querySql("R3r"));
    assert.equal(squash(S4_SQL), querySql("S4"));
    assert.equal(squash(runSummaryFillStatement("r", { characters: [], game_mode: "", game_elements: [], list_facts: {}, badges: [], summary_version: 1 }).sql), querySql("RF2"));
  });

  await check("the plan covers every copied D1 table once and every Supabase table has an order", () => {
    const db = openD1TestDb();
    const plan = comparePlan(db);
    assert.deepEqual(plan.map((source) => source.table), [...SUPABASE_TABLES]);
    for (const table of SUPABASE_TABLES) assert.ok(SUPABASE_ORDER[table], `order for ${table}`);
    const parts = plan.flatMap((source) => source.parts.map((part) => `${part.d1Table}${part.filter ? `:${part.filter.value}` : ""}`));
    assert.equal(new Set(parts).size, parts.length, "no D1 table (or posts service) is compared twice");
    const bookkeeping = new Set(["runtime_flags", "runtime_flag_events", "api_cache", "sync_state", "sync_rejects", "sync_pending_raw",
      "outbox", "sync_checks", "shadow_stats", "shadow_diffs", "threads", "sqlite_sequence"]);
    const dataTables = rows(db, "SELECT name FROM sqlite_master WHERE type = 'table'").map((row) => String(row.name)).filter((name) => !bookkeeping.has(name));
    assert.deepEqual([...new Set(parts.map((part) => part.split(":")[0]))].sort(), dataTables.sort());
    assert.equal(parts.filter((part) => part.startsWith("posts:")).length, 8);
    db.close();
  });

  await check("D1 database ids come from wrangler.jsonc", () => {
    const testbed = d1DatabaseId("testbed", WRANGLER);
    assert.match(PROD_DB, /^[0-9a-f-]{36}$/);
    assert.match(testbed, /^[0-9a-f-]{36}$/);
    assert.notEqual(PROD_DB, testbed);
    assert.throws(() => d1DatabaseId("testbed", WRANGLER.replace(/slseoun-testbed/g, "other")), /no DB binding named slseoun-testbed/);
  });

  await check("lines hash in UTF-8 byte order, whatever the input order", () => {
    const sha = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
    // JS sorts by UTF-16 code units (the emoji's surrogate first); bytes put U+FF61 first.
    assert.equal(hashLines(["\u{1F600}", "｡"]), sha("｡\n\u{1F600}"));
    assert.equal(hashLines(["｡", "\u{1F600}"]), sha("｡\n\u{1F600}"));
    assert.equal(hashLines([]), sha(""));
  });

  // ----------------------------------------------------------------------------------------- before the first copy

  await check("no step-2 schema: a notice, nothing read from Supabase, nothing written", async () => {
    const s = scenario({ schema: "none", copy: false, watermark: false });
    const report = await s.run();
    assert.equal(report.status, "skipped");
    assert.match(report.notice ?? "", /no step-2 schema/);
    assert.equal(s.supabase.requests.length, 0);
    assert.deepEqual(s.d1.writes, []);
  });

  await check("empty D1: a notice, nothing read from Supabase, nothing written", async () => {
    const s = scenario({ copy: false, watermark: false });
    const report = await s.run();
    assert.equal(report.status, "skipped");
    assert.match(report.notice ?? "", /D1 is empty/);
    assert.equal(s.supabase.requests.length, 0);
    assert.deepEqual(s.d1.writes, []);
    // The scheduled fill is guarded the same way.
    const fill = await s.run(true);
    assert.equal(fill.status, "skipped");
    assert.deepEqual(s.d1.writes, []);
  });

  await check("rows without the first copy's watermark: a notice (the copy has not finished)", async () => {
    const s = scenario({ watermark: false });
    const report = await s.run();
    assert.equal(report.status, "skipped");
    assert.match(report.notice ?? "", /watermark/);
    assert.deepEqual(s.d1.writes, []);
    assert.equal(s.supabase.requests.length, 0);
  });

  // ----------------------------------------------------------------------------------------- the fill

  await check("the fill reads and writes D1 only, and leaves cover_spec alone", async () => {
    const s = scenario();
    const before = rows(s.db, "SELECT post_id, cover_spec, summary_version FROM post_history_course ORDER BY post_id");
    assert.deepEqual(before.map((row) => row.summary_version), [0, 0]);
    const report = await s.run(true);
    assert.equal(report.status, "ok");
    assert.deepEqual(report.fill?.filled.sort(), ["r0000000000000a01", "r0000000000000a02"]);
    assert.equal(s.supabase.requests.length, 0, "the fill never calls Supabase");
    assert.equal(report.checks.length, 0);
    assert.ok(s.d1.writes.length === 2 && s.d1.writes.every((sql) => sql.startsWith("UPDATE post_history_course SET characters")));
    const after = rows(s.db, "SELECT post_id, cover_spec, summary_version, characters FROM post_history_course ORDER BY post_id");
    assert.deepEqual(after.map((row) => row.summary_version), [RUN_SUMMARY_VERSION, RUN_SUMMARY_VERSION]);
    assert.deepEqual(after.map((row) => row.cover_spec), before.map((row) => row.cover_spec));
    assert.equal(after[1].characters, '["CHARACTER.SILENT","CHARACTER.DEFECT"]');
    // A second fill has nothing to do.
    const again = await s.run(true);
    assert.deepEqual(again.fill, { filled: [], alreadyCurrent: [], missingRaw: [], unreadable: [] });
  });

  // ----------------------------------------------------------------------------------------- matching data

  await check("matching data: every check is equal, the known kinds are counted, sync_checks is written", async () => {
    const s = scenario();
    const report = await s.run();
    assert.deepEqual(failing(report), [], report.lines.join("\n"));
    assert.equal(report.status, "ok", report.lines.join("\n"));
    assert.deepEqual(report.failures, []);
    assert.equal(report.fill?.filled.length, 2, "the fill ran first");
    assert.equal(find(report, "runs", "post_history_course", "derived").d1_rows, 2, "both runs compared after the fill");
    assert.ok(report.checks.every((entry) => entry.d1_hash === entry.supabase_hash || entry.kind === "derived" || entry.supabase_rows !== entry.d1_rows),
      "equal sides hash equal");
    for (const entry of report.checks.filter((c) => c.kind === "rows")) assert.equal(entry.d1_hash, entry.supabase_hash, `${entry.source_table} -> ${entry.d1_table}`);
    assert.deepEqual(find(report, "defragment_bodies", "defragment_bodies").diff_sample, [{ known: "orphan", count: 1 }]);
    assert.deepEqual(find(report, "this_or_that_post_likes", "this_or_that_post_likes").diff_sample, [{ known: "cross_env", count: 1 }]);
    assert.equal(find(report, "comments", "comments").supabase_rows, 2, "development rows are not compared");
    assert.equal(find(report, "runs", "post_history_course_file").d1_rows, 2);
    assert.ok(report.lines.some((line) => /orphan bodies 1, cross-env this-or-that likes 1/.test(line)));
    // The combo post's thread has a like its copied count does not: reference only, never a failure.
    assert.ok(report.lines.some((line) => /reference only.*: 1 posts differ/.test(line)), report.lines.join("\n"));
    assert.ok(report.lines.includes("open rejects: 0"));
    assert.ok(report.lines.some((line) => line.startsWith("summary_version 0 after the fill: 0")));
    assert.deepEqual(supabaseWrites(s.supabase), [], "Supabase is only read");
    const stored = rows(s.db, "SELECT check_date, source_table, d1_table, kind, diff_count, diff_sample FROM sync_checks ORDER BY source_table, d1_table, kind");
    assert.equal(stored.length, report.checks.length);
    assert.ok(stored.every((row) => row.check_date === "2025-11-08"));
    assert.ok(stored.every((row) => Array.isArray(JSON.parse(String(row.diff_sample)))));
    const writes = s.d1.writes.filter((sql) => !sql.startsWith("UPDATE post_history_course SET characters"));
    assert.equal(writes.length, 1, "one sync_checks upsert");
    assert.ok(writes[0].startsWith("INSERT INTO sync_checks"));
    // Running again the same day upserts the same rows.
    const again = await s.run();
    assert.equal(again.status, "ok");
    assert.equal(rows(s.db, "SELECT count(*) AS n FROM sync_checks")[0].n, report.checks.length);
    // Hand-picked report lines carry no keys or values.
    assert.ok(!report.lines.join("\n").includes(U(101)));
  });

  await check("a new-format secret key goes in apikey only, never as a bearer", async () => {
    const s = scenario({ serviceKey: "sb_secret_test" });
    const seen: Array<Record<string, string>> = [];
    const fetchOnce = s.supabase.fetch;
    s.supabase.fetch = async (url, init) => {
      seen.push(init.headers);
      return fetchOnce(url, init);
    };
    const report = await s.run();
    assert.equal(report.status, "ok", report.lines.join("\n"));
    assert.ok(seen.length > 0 && seen.every((headers) => headers.apikey === "sb_secret_test" && !("authorization" in headers)));
  });

  await check("a server row cap below the page size still reads every row", async () => {
    const s = scenario();
    s.supabase.maxRows = 1;
    const report = await s.run();
    assert.equal(report.status, "ok", report.lines.join("\n"));
  });

  // ----------------------------------------------------------------------------------------- mismatches

  const prepared = async (mutate: (s: ReturnType<typeof scenario>) => void) => {
    const s = scenario({ fill: true });
    mutate(s);
    return { s, report: await s.run() };
  };

  await check("a row missing in D1", async () => {
    const { report } = await prepared((s) => s.db.exec(`DELETE FROM community_stories WHERE id = '${U(301)}'`));
    assert.equal(report.status, "failed");
    assert.deepEqual(failing(report), ["rows community_stories -> community_stories"]);
    assert.deepEqual(find(report, "community_stories", "community_stories").reasons, { missing_in_d1: 1 });
    assert.deepEqual(find(report, "community_stories", "community_stories").diff_sample, [{ key: JSON.stringify([U(301)]), reason: "missing_in_d1" }]);
  });

  await check("a row D1 has and Supabase does not", async () => {
    const { report } = await prepared((s) =>
      s.db.exec(`INSERT INTO resource_reactions (resource_id, resource_type, game_version, user_id, kind) VALUES ('zap', 'card', '0.107.1', '${U(9)}', 'nerf')`),
    );
    assert.deepEqual(failing(report), ["rows resource_reactions -> resource_reactions"]);
    assert.deepEqual(find(report, "resource_reactions", "resource_reactions").reasons, { missing_in_supabase: 1 });
  });

  await check("a value that differs names its column", async () => {
    const { report } = await prepared((s) => s.db.exec(`UPDATE posts SET nickname = '바뀐 닉' WHERE service = 'combo' AND id = '${U(402)}'`));
    assert.deepEqual(failing(report), ["rows combo_posts -> posts"]);
    assert.deepEqual(find(report, "combo_posts", "posts").reasons, { "differs: nickname": 1 });
  });

  await check("JSON key order and rank_history timestamps are not differences; JSON values are", async () => {
    const same = await prepared((s) => {
      s.db.exec(`UPDATE post_transfigure SET extra_variants = '[{"a":1,"b":2}]' WHERE post_id = '${U(403)}'`);
      s.db.exec(`UPDATE favorite_tournament_candidate_stats SET rank_history = '[{"rank":1,"at":"2026-11-05T11:48:12.345600Z"}]'`);
    });
    assert.deepEqual(failing(same.report), []);
    const changed = await prepared((s) => s.db.exec(`UPDATE post_transfigure SET extra_variants = '[{"a":1,"b":3}]' WHERE post_id = '${U(403)}'`));
    assert.deepEqual(failing(changed.report), ["rows transfigure_posts -> post_transfigure"]);
  });

  await check("a run raw is compared by its sha-256", async () => {
    const { report } = await prepared((s) => s.db.exec("UPDATE post_history_course_file SET raw = raw || ' ' WHERE post_id = 'r0000000000000a01'"));
    assert.deepEqual(failing(report), ["rows runs -> post_history_course_file"]);
    assert.deepEqual(find(report, "runs", "post_history_course_file").reasons, { "differs: raw": 1 });
  });

  await check("a hand-made Supabase value the mapper refuses is a difference until a human decides", async () => {
    const { report } = await prepared((s) =>
      s.data.contact_inquiries.push({ ...s.data.contact_inquiries[0], id: U(702), reply_seen_at: "infinity" }),
    );
    assert.equal(report.status, "failed");
    assert.deepEqual(failing(report), ["rows contact_inquiries -> contact_inquiries"]);
    assert.deepEqual(find(report, "contact_inquiries", "contact_inquiries").reasons, { "supabase_reject:bad_timestamp": 1 });
  });

  await check("a resources element D1 cannot split is a bad_element difference", async () => {
    const { report } = await prepared((s) => {
      s.data.combo_posts.push({ ...s.data.combo_posts[0], id: U(408), resources: [{ type: "card" }] });
    });
    assert.deepEqual(failing(report), ["rows combo_posts -> posts"]);
    assert.deepEqual(find(report, "combo_posts", "posts").reasons, { "supabase_reject:bad_element": 1 });
  });

  await check("threads against the recount and get_engagement_counts", async () => {
    const { report } = await prepared((s) => s.db.exec("UPDATE threads SET like_count = like_count + 1 WHERE thread_key = 'sts2-codex:card:bash'"));
    assert.deepEqual(failing(report), ["derived get_engagement_counts -> threads"]);
    assert.deepEqual(find(report, "get_engagement_counts", "threads", "derived").reasons, { "threads_vs_recount, threads_vs_rpc": 1 });
    // A like D1 does not have: the rows, the recount and the RPC all see it.
    const missing = await prepared((s) => s.data.likes.push({ ...s.data.likes[0], id: U(219), user_id: U(8) }));
    assert.deepEqual(failing(missing.report), ["derived get_engagement_counts -> threads", "rows likes -> likes"]);
    assert.deepEqual(find(missing.report, "get_engagement_counts", "threads", "derived").reasons, { threads_vs_rpc: 1 });
  });

  await check("comments.like_count against the comment_likes recount", async () => {
    const { report } = await prepared((s) => s.db.exec(`UPDATE comments SET like_count = 5 WHERE id = '${U(101)}'`));
    assert.deepEqual(failing(report), ["derived comment_likes -> comments"]);
    assert.deepEqual(find(report, "comment_likes", "comments", "derived").reasons, { "like_count_vs_recount, like_count_vs_supabase": 1 });
  });

  await check("run summaries: list inputs from the summary columns against today's from the raw", async () => {
    const { report } = await prepared((s) => s.db.exec("UPDATE post_history_course SET badges = '[]' WHERE post_id = 'r0000000000000a01'"));
    assert.deepEqual(failing(report), ["derived runs -> post_history_course"], "badges are left out of the rows check");
    assert.deepEqual(find(report, "runs", "post_history_course", "derived").reasons, { "summary.badges": 1 });
    const facts = await prepared((s) =>
      s.db.exec("UPDATE post_history_course SET list_facts = json_set(list_facts, '$.highlight_relic', 'VAJRA') WHERE post_id = 'r0000000000000a01'"),
    );
    assert.deepEqual(failing(facts.report), ["derived runs -> post_history_course"]);
    const factReasons = Object.keys(find(facts.report, "runs", "post_history_course", "derived").reasons);
    // The highlight is also a search resource, so the popular chips move with it.
    assert.deepEqual(factReasons.sort(), ["popular_elements", "summary.highlight_relic, search.haystack, search.resources"]);
  });

  await check("an open reject fails the day", async () => {
    const { report } = await prepared((s) =>
      s.db.exec(
        "INSERT INTO sync_rejects (direction, ref, table_name, d1_table, row_key, op, reason, payload, error, first_at, last_at) " +
          `VALUES ('in', 9, 'likes', 'likes', '{"story_id":"x","user_id":"${U(1)}"}', 'I', 'check', '{}', 'CHECK constraint failed', 1, 1)`,
      ),
    );
    assert.equal(report.status, "failed");
    assert.deepEqual(failing(report), []);
    assert.deepEqual(report.failures, ["open rejects 1"]);
    // A closed known kind does not.
    const closed = await prepared((s) =>
      s.db.exec(
        "INSERT INTO sync_rejects (direction, ref, table_name, d1_table, row_key, op, reason, payload, error, first_at, last_at, resolved_at) " +
          `VALUES ('in', 9, 'this_or_that_post_likes', 'this_or_that_post_likes', '{}', 'I', 'cross_env', '{}', 'x', 1, 1, 2)`,
      ),
    );
    assert.equal(closed.report.status, "ok", closed.report.lines.join("\n"));
  });

  await check("a run the fill cannot read stays at summary_version 0: reported, not a failure", async () => {
    const s = scenario();
    const bad = runImage("r0000000000000a03", "not a run", ENV, { created_at: "2026-11-07T00:00:00+00:00" });
    s.data.runs.push(bad);
    const mapped = mapRow("runs", bad, { nowMs: NOW });
    assert.ok(mapped.ok);
    applyBatch(s.db, mapped.statements);
    const report = await s.run();
    assert.deepEqual(report.fill?.unreadable, ["r0000000000000a03"]);
    assert.equal(report.status, "ok", report.lines.join("\n"));
    assert.ok(report.lines.some((line) => line.startsWith("summary_version 0 after the fill: 1")));
    assert.ok(report.warnings.some((warning) => /summary_version 0/.test(warning)));
    assert.equal(find(report, "runs", "post_history_course", "derived").d1_rows, 2, "the unfilled run is not compared");
  });

  await check("errors from either API stop the job without leaking credentials", async () => {
    const s = scenario();
    const wrongToken = d1HttpClient({ accountId: ACCOUNT, databaseId: PROD_DB, token: "wrong-token", fetch: s.d1.fetch });
    await assert.rejects(
      runReconcile({ target: "production", d1: wrongToken, supabase: postgrestReader({ url: SUPABASE_URL, serviceKey: SERVICE_KEY, fetch: s.supabase.fetch }) }),
      (error: Error) => /Authentication error/.test(error.message) && !error.message.includes("wrong-token"),
    );
    const wrongKey = postgrestReader({ url: SUPABASE_URL, serviceKey: "wrong-key", fetch: s.supabase.fetch });
    await assert.rejects(
      runReconcile({ target: "production", d1: d1HttpClient({ accountId: ACCOUNT, databaseId: PROD_DB, token: D1_TOKEN, fetch: s.d1.fetch }), supabase: wrongKey }),
      (error: Error) => /PostgREST 401/.test(error.message) && !error.message.includes("wrong-key"),
    );
  });

  await check("the command refuses to start without its environment and never prints values", () => {
    const env = { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", SUPABASE_SERVICE_ROLE_KEY: "secret-value-xyz" } as unknown as NodeJS.ProcessEnv;
    const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/d1-reconcile.ts", "--target", "testbed"], { encoding: "utf8", env });
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /missing environment: SUPABASE_URL, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_API_TOKEN/);
    assert.ok(!`${result.stdout}${result.stderr}`.includes("secret-value-xyz"));
    const bad = spawnSync(process.execPath, ["--import", "tsx", "scripts/d1-reconcile.ts", "--target", "staging"], { encoding: "utf8", env });
    assert.equal(bad.status, 2);
  });

  console.log(`d1 reconcile checks passed (${checks})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * The step-2 row mapper (src/lib/d1-sync/row-mapper.ts) against a local SQLite copy of the D1 schema,
 * so every CHECK and FK of docs/supabase-exit/d1-schema/schema.sql is exercised. Synthetic rows only.
 *   pnpm exec tsx scripts/d1-row-mapper.spec.ts
 */
import assert from "node:assert/strict";
import type { DatabaseSync } from "node:sqlite";
import { canonicalTs, nowTs, postgrestTs } from "../src/lib/d1-time";
import { parseCopyLine, parsePgArray } from "../src/lib/d1-sync/pg-text";
import {
  mapChange,
  mapDelete,
  mapPgTextRow,
  mapRow,
  mergeChanges,
  mergeTouched,
  recountStatements,
  rejectStatement,
  runSummaryFillStatement,
  summaryText,
  SUPABASE_TABLES,
  type ChangeEntry,
  type MapContext,
  type MapResult,
  type RowImage,
} from "../src/lib/d1-sync/row-mapper";
import { toSqlText, type D1Statement } from "../src/lib/d1-sync/statements";
import { applyBatch, count, openD1TestDb, rows } from "./d1-sync/test-db";

let checks = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    checks += 1;
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

const ctx: MapContext = { nowMs: 1_762_560_000_000 };
const U = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const TS = "2026-11-05T11:48:12.3456+00:00";
const TS_D1 = "2026-11-05T11:48:12.345600Z";
const ENV = "production";
const author = { avatar_id: "IRONCLAD", avatar_kind: "character", palette_id: "red", palette_swapped: true };

function ok(result: MapResult): D1Statement[] {
  if (!result.ok) throw new Error(`unexpected reject ${result.reject.reason}: ${result.reject.error}`);
  return result.statements;
}

function reject(result: MapResult): string {
  assert.equal(result.ok, false, "expected a reject");
  return result.ok ? "" : result.reject.reason;
}

// ------------------------------------------------------------------------------------------- timestamps

check("canonicalTs accepts the pg_dump, PostgREST and Worker forms", () => {
  const cases: Array<[string, string]> = [
    ["2026-11-08 01:02:03.456789+00", "2026-11-08T01:02:03.456789Z"],
    ["2026-11-08T01:02:03.456789+00:00", "2026-11-08T01:02:03.456789Z"],
    ["2026-11-08T01:02:03.4567+00:00", "2026-11-08T01:02:03.456700Z"],
    ["2026-11-08T01:02:03+00:00", "2026-11-08T01:02:03.000000Z"],
    ["2026-11-08T01:02:03.456Z", "2026-11-08T01:02:03.456000Z"],
    ["2026-11-08 01:02:03Z", "2026-11-08T01:02:03.000000Z"],
    ["2026-11-08 10:02:03.5+09", "2026-11-08T01:02:03.500000Z"],
    ["2026-11-08T06:32:03+05:30", "2026-11-08T01:02:03.000000Z"],
    ["2026-11-07T20:02:03-0500", "2026-11-08T01:02:03.000000Z"],
    ["2026-01-01 00:30:00+01", "2025-12-31T23:30:00.000000Z"],
    ["2024-02-29 23:59:59.999999-00:01", "2024-03-01T00:00:59.999999Z"],
    ["0001-01-01 00:00:00+00", "0001-01-01T00:00:00.000000Z"],
    ["9999-12-31 23:59:59.999999+00", "9999-12-31T23:59:59.999999Z"],
  ];
  for (const [input, expected] of cases) assert.equal(canonicalTs(input), expected, input);
});

check("canonicalTs refuses what D1 cannot hold", () => {
  for (const input of [
    "infinity",
    "-infinity",
    "0001-01-01 00:00:00+01", // year 0 after the shift
    "9999-12-31 23:30:00-01", // year 10000 after the shift
    "10000-01-01 00:00:00+00",
    "0044-03-15 12:00:00+00 BC",
    "2023-02-29 00:00:00+00",
    "2026-13-01 00:00:00+00",
    "2026-11-08 24:00:00+00",
    "2026-11-08 01:60:00+00",
    "2026-11-08 01:02:60+00",
    "2026-11-08 01:02:03.1234567+00",
    "2026-11-08 01:02:03",
    "2026-11-08",
    "",
  ]) {
    assert.equal(canonicalTs(input), null, input);
  }
  assert.equal(canonicalTs(null), null);
  assert.equal(canonicalTs(1762560000), null);
});

check("postgrestTs and nowTs", () => {
  assert.equal(postgrestTs("2026-11-05T11:48:12.345600Z"), "2026-11-05T11:48:12.3456+00:00");
  assert.equal(postgrestTs("2026-11-05T11:48:12.000000Z"), "2026-11-05T11:48:12+00:00");
  assert.equal(postgrestTs("2026-11-05T11:48:12.000001Z"), "2026-11-05T11:48:12.000001+00:00");
  assert.equal(postgrestTs("2026-11-05T11:48:12.3456+00:00"), null);
  for (const value of ["2026-11-05T11:48:12.3456+00:00", "2026-11-05T11:48:12+00:00", "2026-11-05T11:48:12.000001+00:00"]) {
    assert.equal(postgrestTs(canonicalTs(value)), value);
  }
  assert.match(nowTs(), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}000Z$/);
});

// ------------------------------------------------------------------------------------------- pg text

check("COPY text lines and array literals", () => {
  assert.deepEqual(parseCopyLine("a\\tb\t\\N\tline\\nnext\tback\\\\slash\t\\101\\x42"), [
    "a\tb",
    null,
    "line\nnext",
    "back\\slash",
    "AB",
  ]);
  assert.deepEqual(parsePgArray("{}"), []);
  assert.deepEqual(parsePgArray('{a,"b c","d\\"e",NULL,"NULL",""}'), ["a", "b c", 'd"e', null, "NULL", ""]);
  assert.deepEqual(parsePgArray("{0,0,1,4}"), ["0", "0", "1", "4"]);
  assert.throws(() => parsePgArray("{{1,2},{3,4}}"));
  assert.throws(() => parsePgArray("{a,}"));
});

// ------------------------------------------------------------------------------------------- one row per table

const RAW = JSON.stringify({ seed: "SEED1", acts: ["ACT.OVERGROWTH"], map_point_history: [[]], players: [] });

const IMAGES: Record<string, RowImage> = {
  comments: {
    id: U(101), story_id: "sts2-codex:card:bash", user_id: U(1), nickname: "닉", content: "좋은 카드", created_at: TS,
    env: ENV, content_blocks: [{ type: "text", text: "좋은 카드" }], ...author, parent_id: null, meta: { a: 1 },
  },
  comment_likes: { id: U(201), comment_id: U(101), user_id: U(2), created_at: TS },
  likes: { id: U(202), story_id: "sts2-codex:card:bash", user_id: U(2), created_at: TS, env: ENV, reaction_type: "thumb_up" },
  resource_reactions: { env: ENV, resource_type: "card", resource_id: "bash", game_version: "0.107.1", user_id: U(1), kind: "buff" },
  resource_reaction_counts: {
    env: ENV, resource_type: "card", resource_id: "bash", game_version: "0.107.1", buff_count: 1, nerf_count: 0, rework_count: 0,
  },
  community_stories: {
    id: U(301), user_id: null, nickname: "닉", sentence: "이야기 한 줄", game: "sts2", env: ENV, created_at: TS,
    static_story_id: "story-1", entity_type: "card", entity_id: "bash", change_id: null, patch_line_id: null, source: "v0.103.0",
    tags: ["버프"], linked_entities: [{ type: "card", id: "bash" }], avatar_id: null, avatar_kind: null, palette_id: null,
    palette_swapped: null,
  },
  chemical_posts: {
    id: U(401), user_id: U(1), nickname: "닉", content: [{ type: "text", text: "케미" }], content_text: " 케미컬 한 줄 ",
    env: ENV, created_at: TS, like_count: 2, comment_count: 1, ...author,
  },
  combo_posts: {
    id: U(402), user_id: U(1), nickname: "닉", content: [], content_text: "콤보 설명",
    resources: [{ type: "card", id: "bash" }, { type: "relic", id: "anchor" }], env: ENV, created_at: TS, like_count: 0,
    comment_count: 0, ...author,
  },
  transfigure_posts: {
    id: U(403), user_id: U(1), nickname: "닉", resource_type: "card", resource_id: "bash", source_text: "원문",
    source_game_locale: "kor", content: [], content_text: "변형 설명", env: ENV, created_at: TS, title: "  제목 ",
    transformed_name: null, transformed_cost: "2", upgraded_content: null, upgraded_content_text: null,
    transformed_upgrade_cost: null, show_upgrade: false, card_top_keywords: ["보존"], card_bottom_keywords: [],
    upgraded_card_top_keywords: [], upgraded_card_bottom_keywords: [], transformed_card_type: "공격",
    transformed_card_rarity: "일반", transformed_star_cost: null, transformed_upgrade_star_cost: null, token_color: null,
    token_wax: null, like_count: 0, comment_count: 0, transformed_card_color: "ironclad", omit_energy_cost: false, ...author,
    extra_variants: [],
  },
  this_or_that_posts: {
    id: U(404), user_id: U(1), nickname: "닉", left_type: "card", left_id: "bash", right_type: "card", right_id: "strike",
    reason: "이유가 있다", env: ENV, created_at: TS, like_count: 1, comment_count: 0, left_vote_count: 1, right_vote_count: 0,
    vote_rate_bps: 10000, ...author,
  },
  favorite_tournament_posts: {
    id: U(405), user_id: null, nickname: "닉", title: "월드컵", note: "", preset_key: "builtin:cards", game_version: "0.107.1",
    pool: [{ type: "card", id: "bash" }, { type: "card", id: "strike" }], env: ENV, like_count: 0, comment_count: 0,
    play_count: 1, created_at: TS, ...author,
  },
  decisions_decisions_posts: {
    id: U(406), user_id: U(1), nickname: "닉", title: " ", note: "메모", preset_key: "custom", game_version: "0.107.1",
    rows: [{ id: "S" }], placements: [], extra_ids: [], env: ENV, like_count: 0, comment_count: 0, created_at: TS, ...author,
  },
  pagestorm_posts: {
    id: U(407), user_id: U(1), nickname: "닉", title: "서류", content: { type: "doc" }, content_text: "본문", env: ENV,
    like_count: 0, comment_count: 0, created_at: TS, ...author,
  },
  runs: {
    id: "r0000000000000001", raw: RAW, seed: "SEED1", build: "v0.107.1", character: "CHARACTER.IRONCLAD", ascension: 5,
    win: true, start_time: 1762560000, run_time: 1234, acts_count: 1, donor_user_id: U(1), created_at: TS, total_floors: 0,
    env: ENV, badges: [{ id: "BADGE.X", rarity: "gold" }], highlight_card: { id: "BASH" }, highlight_relic: null,
    note_blocks: null, cover_spec: { auto: false, phrase: "표지", elements: [] }, like_count: 3, comment_count: 2,
    donor_nickname: "기증자",
  },
  this_or_that_post_votes: { post_id: U(404), user_id: U(2), choice: "left", created_surface: "feed", env: ENV, created_at: TS },
  this_or_that_post_likes: { id: U(203), post_id: U(404), user_id: U(2), env: ENV, created_at: TS },
  favorite_tournament_candidate_stats: {
    tournament_id: U(405), env: ENV, resource_type: "card", resource_id: "bash", match_appearances: 1, match_wins: 1,
    championships: 1, current_rank: 1, rank_history: [{ at: "2026-11-05 11:48:12.3456", rank: 1 }],
  },
  favorite_tournament_plays: {
    id: U(501), tournament_id: U(405), user_id: U(2), env: ENV, starting_size: 2, champion_type: "card", champion_id: "bash",
    matches: [{ left_type: "card", left_id: "bash", right_type: "card", right_id: "strike", winner: "left" }], created_at: TS,
  },
  pagestorm_drafts: {
    id: U(601), user_id: U(1), nickname: "닉", title: "초안", content: {}, content_text: "초안 본문", env: ENV, created_at: TS,
    updated_at: TS, ...author,
  },
  defragment_bodies: {
    env: ENV, source_service: "combo", source_id: U(402), user_id: U(1), nickname: "닉", content: [], content_text: "조각 본문",
    created_at: TS, updated_at: TS,
  },
  profile_character_nickname_pools: { character_id: "IRONCLAD", locale: "ko", nicknames: ["철갑", "강철"], updated_at: TS },
  contact_inquiries: {
    id: U(701), user_id: U(1), category: "bug", message: "버그가 있습니다 여기", reply_email: "a@b.c", page_path: "/codex",
    service_locale: "ko", game_locale: "kor", viewport_width: 390, viewport_height: 844, env: ENV, status: "new",
    created_at: TS, admin_response: "고쳤습니다", responded_at: "2026-11-06 00:00:00+00", reply_seen_at: null,
  },
  puzzlebox_runs: {
    id: 42, env: ENV, game: "connections", board: "7", user_id: U(1), attempt: 1, score: 100, perfect: true,
    run: { guesses: [] }, created_at: TS,
  },
  puzzlebox_players: {
    user_id: U(1), nickname: "닉", avatar_id: "IRONCLAD", avatar_kind: "character", palette_id: null, palette_swapped: false,
    hidden: false, updated_at: TS,
  },
  puzzlebox_best: {
    env: ENV, game: "connections", board: "7", user_id: U(1), score: 100, perfect: true, run_id: 42, achieved_at: TS, attempts: 1,
  },
  puzzlebox_board_stats: {
    env: ENV, game: "connections", board: "7", players: 1, cleared: 1, perfect: 1, score_sum: 100, mistakes_sum: 0,
    rocks_sum: 0, purple_first: 0, level_solved: [1, 1, 1, 1], question_wrong: [], wrong_picks: [], speed_sum: 10,
  },
  colorful_philosopher_posts: {
    id: U(801), env: ENV, week_start: "2026-11-02", slot: "card", resource_type: "card", resource_id: "bash", name_ko: "강타",
    name_en: "Bash", image_url: null, body: "본문", game_version: "0.107.1", buff_count: 2, nerf_count: 0, rework_count: 0,
    created_at: TS,
  },
};

function loadAll(db: DatabaseSync, withRaw = true): D1Statement[] {
  const statements: D1Statement[] = [];
  const touched = [];
  for (const table of SUPABASE_TABLES) {
    const image = { ...IMAGES[table] };
    if (!withRaw && table === "runs") delete image.raw;
    const result = mapRow(table, image, ctx);
    statements.push(...ok(result));
    if (result.ok) touched.push(result.touched);
  }
  statements.push(...recountStatements(mergeTouched(touched), ctx.nowMs));
  applyBatch(db, statements);
  return statements;
}

check("every copied table has a mapper and a synthetic row", () => {
  assert.equal(SUPABASE_TABLES.length, 27);
  assert.deepEqual([...SUPABASE_TABLES].sort(), Object.keys(IMAGES).sort());
});

const db = openD1TestDb();
const loadStatements = loadAll(db);

check("every table's row lands in D1 with its CHECKs and FKs", () => {
  const expected: Record<string, number> = {
    comments: 1, comment_likes: 1, likes: 1, threads: 1, resource_reactions: 1, resource_reaction_counts: 1,
    community_stories: 1, posts: 8, post_chemical_x: 1, post_combo: 1, post_combo_resources: 2, post_transfigure: 1,
    post_this_or_that: 1, this_or_that_post_votes: 1, this_or_that_post_likes: 1, post_favorite_tournament: 1,
    post_favorite_tournament_pool: 2, favorite_tournament_candidate_stats: 1, favorite_tournament_plays: 1,
    post_decisions_decisions: 1, post_pagestorm: 1, pagestorm_drafts: 1, defragment_bodies: 1, post_history_course: 1,
    post_history_course_file: 1, profile_character_nickname_pools: 1, contact_inquiries: 1, puzzlebox_runs: 1,
    puzzlebox_players: 1, puzzlebox_best: 1, puzzlebox_board_stats: 1, colorful_philosopher_posts: 1, sync_pending_raw: 0,
  };
  for (const [table, n] of Object.entries(expected)) assert.equal(count(db, table), n, table);
  assert.deepEqual(rows(db, "PRAGMA foreign_key_check"), []);
});

check("columns: timestamps, booleans, JSON, arrays, author snapshot, dropped columns", () => {
  const [comment] = rows(db, "SELECT * FROM comments");
  assert.equal(comment.created_at, TS_D1);
  assert.equal(comment.palette_swapped, 1);
  assert.equal(comment.content_blocks, '[{"type":"text","text":"좋은 카드"}]');
  assert.equal(comment.like_count, 1, "E14 recount");
  assert.equal("parent_id" in comment || "meta" in comment || "env" in comment, false);
  const [thread] = rows(db, "SELECT * FROM threads");
  assert.deepEqual(
    { ...thread, updated_at: 0 },
    { thread_key: "sts2-codex:card:bash", like_count: 1, comment_count: 1, last_comment_at: TS_D1, updated_at: 0 },
  );
  const [transfigure] = rows(db, "SELECT * FROM post_transfigure");
  assert.equal(transfigure.card_top_keywords, '["보존"]');
  assert.equal(transfigure.show_upgrade, 0);
  assert.equal(transfigure.omit_energy_cost, 0);
  assert.equal("source_game_locale" in transfigure, false);
  const [stats] = rows(db, "SELECT * FROM puzzlebox_board_stats");
  assert.equal(stats.level_solved, "[1,1,1,1]");
  const [inquiry] = rows(db, "SELECT * FROM contact_inquiries");
  assert.equal(inquiry.responded_at, "2026-11-06T00:00:00.000000Z");
  assert.equal(inquiry.reply_seen_at, null);
  const [pool] = rows(db, "SELECT * FROM profile_character_nickname_pools");
  assert.equal(pool.nicknames, '["철갑","강철"]');
  const [stat] = rows(db, "SELECT rank_history FROM favorite_tournament_candidate_stats");
  assert.equal(stat.rank_history, '[{"at":"2026-11-05 11:48:12.3456","rank":1}]', "rank_history[].at kept as Postgres text");
  const [philosopher] = rows(db, "SELECT * FROM colorful_philosopher_posts");
  assert.equal("buff_count" in philosopher, false);
});

check("posts: key (service, id), summary, title and per-service rows", () => {
  const posts = rows(db, "SELECT service, id, user_id, nickname, avatar_id, palette_swapped, title, summary, like_count FROM posts ORDER BY service");
  const byService = Object.fromEntries(posts.map((p) => [p.service, p]));
  assert.equal(byService.chemical_x.summary, "케미컬 한 줄", "btrim spaces");
  assert.equal(byService.chemical_x.like_count, 2);
  assert.equal(byService.combo.title, null);
  assert.equal(byService.transfigure.title, "  제목 ");
  assert.equal(byService.transfigure.summary, "제목");
  assert.equal(byService.this_or_that.summary, "이유가 있다");
  assert.equal(byService.favorite_tournament.user_id, null);
  assert.equal(byService.favorite_tournament.summary, "월드컵");
  assert.equal(byService.decisions_decisions.summary, "", "a blank title is not empty: no fallback, then btrim");
  assert.equal(byService.pagestorm.summary, "서류");
  assert.deepEqual(
    { ...byService.history_course },
    {
      service: "history_course", id: "r0000000000000001", user_id: U(1), nickname: "기증자", avatar_id: null,
      palette_swapped: null, title: null, summary: "SEED1", like_count: 3,
    },
  );
  assert.deepEqual(
    rows(db, "SELECT ord, resource_type, resource_id FROM post_combo_resources ORDER BY ord"),
    [{ ord: 0, resource_type: "card", resource_id: "bash" }, { ord: 1, resource_type: "relic", resource_id: "anchor" }],
  );
});

check("runs: summary_version 0, no Supabase badges, cover_spec copied, raw in its file", () => {
  const [run] = rows(db, "SELECT * FROM post_history_course");
  assert.equal(run.summary_version, 0);
  assert.equal(run.badges, "[]");
  assert.equal(run.characters, null);
  assert.equal(run.list_facts, null);
  assert.equal(run.cover_spec, '{"auto":false,"phrase":"표지","elements":[]}');
  assert.equal(run.win, 1);
  const [file] = rows(db, "SELECT raw FROM post_history_course_file");
  assert.equal(file.raw, RAW);
});

check("summary JS matches the SQL expression for spaces and astral characters", () => {
  const value = "  " + "😀".repeat(119) + "가나 다  ";
  assert.equal(summaryText(value), "😀".repeat(119) + "가");
  const [row] = rows(db, "SELECT substr(trim(?1), 1, 120) AS s", value);
  assert.equal(row.s, summaryText(value));
  const tabs = "\t탭\n";
  assert.equal(summaryText(tabs), tabs, "btrim removes spaces only");
  assert.equal(rows(db, "SELECT trim(?1) AS s", tabs)[0].s, tabs);
});

check("SQL text form gives the same database as bind()", () => {
  const other = openD1TestDb();
  other.exec(["BEGIN", "PRAGMA defer_foreign_keys = ON", ...loadStatements.map(toSqlText), "COMMIT"].join(";\n"));
  for (const table of ["posts", "post_transfigure", "comments", "post_history_course", "post_history_course_file", "puzzlebox_runs"]) {
    assert.deepEqual(rows(other, `SELECT * FROM ${table} ORDER BY 1, 2`), rows(db, `SELECT * FROM ${table} ORDER BY 1, 2`), table);
  }
  assert.equal(toSqlText({ sql: "SELECT ?2, '?1', ?1", params: ["a'b", 3] }), "SELECT 3, '?1', 'a''b';");
});

check("first copy: pg_dump text values", () => {
  const fresh = openD1TestDb();
  const statements = [
    ...ok(mapPgTextRow("transfigure_posts", {
      ...Object.fromEntries(Object.entries(IMAGES.transfigure_posts).map(([k, v]) => [k, v === null ? null : typeof v === "string" ? v : JSON.stringify(v)])),
      created_at: "2026-11-05 11:48:12.3456+00",
      show_upgrade: "t",
      omit_energy_cost: "f",
      palette_swapped: "t",
      like_count: "4",
      comment_count: "0",
      card_top_keywords: '{보존,"두 단어"}',
      card_bottom_keywords: "{}",
      upgraded_card_top_keywords: "{}",
      upgraded_card_bottom_keywords: "{}",
      content: '[{"type": "text", "text": "x"}]',
      extra_variants: "[]",
    }, ctx)),
    ...ok(mapPgTextRow("puzzlebox_board_stats", {
      env: ENV, game: "connections", board: "7", players: "1", cleared: "1", perfect: "1", score_sum: "9007199254740991",
      mistakes_sum: "0", rocks_sum: "0", purple_first: "0", level_solved: "{0,0,1,4}", question_wrong: "{}", wrong_picks: "{3}",
      speed_sum: "10",
    }, ctx)),
  ];
  applyBatch(fresh, statements);
  const [t] = rows(fresh, "SELECT p.created_at, p.like_count, p.palette_swapped, t.card_top_keywords, t.content, t.show_upgrade FROM posts p JOIN post_transfigure t ON t.service = p.service AND t.post_id = p.id");
  assert.deepEqual({ ...t }, {
    created_at: TS_D1, like_count: 4, palette_swapped: 1, card_top_keywords: '["보존","두 단어"]',
    content: '[{"type":"text","text":"x"}]', show_upgrade: 1,
  });
  const [s] = rows(fresh, "SELECT score_sum, level_solved, wrong_picks FROM puzzlebox_board_stats");
  assert.deepEqual({ ...s }, { score_sum: 9007199254740991, level_solved: "[0,0,1,4]", wrong_picks: "[3]" });
  assert.equal(reject(mapPgTextRow("puzzlebox_runs", { id: "9007199254740993", env: ENV, game: "connections", board: "7", user_id: U(1), attempt: "1", score: "1", perfect: "t", run: "{}", created_at: TS }, ctx)), "check");
  assert.equal(reject(mapPgTextRow("puzzlebox_players", { user_id: U(1), nickname: "닉", avatar_id: null, avatar_kind: null, palette_id: null, palette_swapped: "yes", hidden: "f", updated_at: TS }, ctx)), "check");
});

// ------------------------------------------------------------------------------------------- sync merges

let nextId = 1000;
function entry(table: string, op: ChangeEntry["op"], newRow: RowImage | null, oldRow: RowImage | null = null, heavyChanged = false): ChangeEntry {
  nextId += 1;
  return { id: nextId, table, op, newRow, oldRow, heavyChanged };
}

function applyEntries(target: DatabaseSync, entries: ChangeEntry[], mapCtx: MapContext = ctx) {
  const { changes, rejects } = mergeChanges(entries);
  assert.deepEqual(rejects, []);
  const statements: D1Statement[] = [];
  const touched = [];
  for (const change of changes) {
    const result = mapChange(change, mapCtx);
    statements.push(...ok(result));
    if (result.ok) touched.push(result.touched);
  }
  const all = [...statements, ...recountStatements(mergeTouched(touched), mapCtx.nowMs)];
  const counts = applyBatch(target, all);
  return { changes, statements: all, counts };
}

check("merge: I then U is one whole-row upsert; U alone is a partial update", () => {
  const id = U(450);
  const base = { ...IMAGES.transfigure_posts, id };
  const { changes } = applyEntries(db, [
    entry("transfigure_posts", "I", base),
    entry("transfigure_posts", "U", { title: "새 제목", like_count: 7 }, base),
  ]);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].action, "upsert");
  let [post] = rows(db, "SELECT title, summary, like_count FROM posts WHERE service = 'transfigure' AND id = ?1", id);
  assert.deepEqual({ ...post }, { title: "새 제목", summary: "새 제목", like_count: 7 });

  const after = { ...base, title: "새 제목", like_count: 7 };
  const update = applyEntries(db, [entry("transfigure_posts", "U", { title: null, transformed_name: " 이름 " }, after)]);
  assert.equal(update.changes[0].action, "update");
  [post] = rows(db, "SELECT title, summary FROM posts WHERE service = 'transfigure' AND id = ?1", id);
  assert.deepEqual({ ...post }, { title: null, summary: summaryText(" 이름 ") });
  assert.equal(post.summary, "이름");
  const [row] = rows(db, "SELECT transformed_name FROM post_transfigure WHERE post_id = ?1", id);
  assert.equal(row.transformed_name, " 이름 ");
});

check("merge: U overlays U, D wins, D then I is a whole row, I then D deletes only", () => {
  const id = U(451);
  const base = { ...IMAGES.combo_posts, id };
  applyEntries(db, [entry("combo_posts", "I", base)]);
  const twoU = mergeChanges([
    entry("combo_posts", "U", { content_text: "하나 둘" }, base),
    entry("combo_posts", "U", { like_count: 5 }, base),
  ]);
  assert.equal(twoU.changes.length, 1);
  assert.deepEqual(twoU.changes[0].image, { content_text: "하나 둘", like_count: 5 });

  const uThenD = mergeChanges([entry("combo_posts", "U", { like_count: 9 }, base), entry("combo_posts", "D", null, base)]);
  assert.equal(uThenD.changes[0].action, "delete");

  const reinsert = { ...base, content_text: "다시 쓴 글", resources: [{ type: "potion", id: "fire" }] };
  const dThenI = applyEntries(db, [entry("combo_posts", "D", null, base), entry("combo_posts", "I", reinsert)]);
  assert.equal(dThenI.changes[0].action, "upsert");
  assert.deepEqual(
    rows(db, "SELECT ord, resource_type, resource_id FROM post_combo_resources WHERE post_id = ?1", id).map((r) => ({ ...r })),
    [{ ord: 0, resource_type: "potion", resource_id: "fire" }],
  );

  const ghost = { ...base, id: U(452) };
  const iThenD = applyEntries(db, [entry("combo_posts", "I", ghost), entry("combo_posts", "D", null, ghost)]);
  assert.equal(iThenD.changes[0].action, "delete");
  assert.equal(count(db, "posts WHERE id = '" + U(452) + "'"), 0);
});

check("merge: a partial U of a missing row reports zero_rows; children follow a resources U", () => {
  const missing = { ...IMAGES.combo_posts, id: U(459) };
  const result = applyEntries(db, [entry("combo_posts", "U", { content_text: "없는 글", like_count: 1 }, missing)]);
  const zero = result.statements.map((s, i) => [s.zeroRows, result.counts[i]]).filter(([tag]) => tag === "zero_rows");
  assert.deepEqual(zero, [["zero_rows", 0], ["zero_rows", 0]]);

  const id = U(451);
  applyEntries(db, [entry("combo_posts", "U", { resources: [{ type: "card", id: "a" }, { type: "card", id: "b" }] }, { ...IMAGES.combo_posts, id })]);
  assert.equal(count(db, `post_combo_resources WHERE post_id = '${id}'`), 2);
});

check("merge: U with only dropped columns writes nothing; unknown columns and key changes are rejects", () => {
  const post = IMAGES.this_or_that_posts;
  const dropped = mergeChanges([entry("this_or_that_posts", "U", { vote_rate_bps: 5000, env: ENV }, post)]);
  assert.deepEqual(ok(mapChange(dropped.changes[0], ctx)), []);
  const unknown = mergeChanges([entry("this_or_that_posts", "U", { brand_new: 1 }, post)]);
  assert.equal(reject(mapChange(unknown.changes[0], ctx)), "check");
  const keyChange = mergeChanges([entry("likes", "U", { story_id: "other" }, IMAGES.likes)]);
  assert.equal(keyChange.changes.length, 0);
  assert.equal(keyChange.rejects[0].reason, "check");
  const noKey = mergeChanges([entry("likes", "U", { created_at: TS }, null)]);
  assert.equal(noKey.rejects[0].reason, "check");
});

check("recounts: likes and comments touched by I, U and D", () => {
  const key = "sts2-codex:card:strike";
  const comment = { ...IMAGES.comments, id: U(102), story_id: key };
  applyEntries(db, [
    entry("comments", "I", comment),
    entry("likes", "I", { ...IMAGES.likes, story_id: key, user_id: U(3) }),
    entry("comment_likes", "I", { ...IMAGES.comment_likes, comment_id: U(102), user_id: U(3) }),
  ]);
  assert.deepEqual(
    { ...rows(db, "SELECT like_count, comment_count FROM threads WHERE thread_key = ?1", key)[0] },
    { like_count: 1, comment_count: 1 },
  );
  assert.equal(rows(db, "SELECT like_count FROM comments WHERE id = ?1", U(102))[0].like_count, 1);
  // A comment deleted: its likes cascade, the thread row stays with 0.
  applyEntries(db, [entry("comments", "D", null, comment), entry("likes", "D", null, { ...IMAGES.likes, story_id: key, user_id: U(3) })]);
  assert.deepEqual(
    { ...rows(db, "SELECT like_count, comment_count, last_comment_at FROM threads WHERE thread_key = ?1", key)[0] },
    { like_count: 0, comment_count: 0, last_comment_at: null },
  );
  assert.equal(count(db, `comment_likes WHERE comment_id = '${U(102)}'`), 0);
});

// ------------------------------------------------------------------------------------------- run rules

check("runs: a sync I has no raw and queues it; RF2 fills; a cover U keeps the summary; a heavy U resets it", () => {
  const id = "r0000000000000002";
  const image: RowImage = { ...IMAGES.runs, id, seed: "" };
  delete image.raw;
  applyEntries(db, [entry("runs", "I", image)]);
  assert.equal(rows(db, "SELECT summary FROM posts WHERE service = 'history_course' AND id = ?1", id)[0].summary, id, "empty seed -> id");
  assert.equal(count(db, `sync_pending_raw WHERE post_id = '${id}'`), 1);
  assert.equal(count(db, `post_history_course_file WHERE post_id = '${id}'`), 0);

  const summary = {
    characters: ["CHARACTER.IRONCLAD"], game_mode: "standard", game_elements: [{ type: "card", id: "BASH" }],
    list_facts: { cards: [], relics: [], potions: [], deck_size: 0, relic_count: 0, highlight_card: null, highlight_relic: null },
    badges: [{ id: "BADGE.Y", rarity: "silver" }], summary_version: 1,
  };
  assert.deepEqual(applyBatch(db, [runSummaryFillStatement(id, summary)]), [1]);
  assert.deepEqual(applyBatch(db, [runSummaryFillStatement(id, summary)]), [0], "RF2 only moves forward");

  applyEntries(db, [entry("runs", "U", { cover_spec: { auto: true }, badges: [{ id: "BADGE.Z", rarity: "gold" }], highlight_card: null }, image)]);
  let [run] = rows(db, "SELECT summary_version, badges, cover_spec FROM post_history_course WHERE post_id = ?1", id);
  assert.deepEqual({ ...run }, { summary_version: 1, badges: '[{"id":"BADGE.Y","rarity":"silver"}]', cover_spec: '{"auto":true}' });

  applyEntries(db, [entry("runs", "U", { donor_nickname: "새 닉", seed: "NEWSEED" }, image)]);
  assert.deepEqual(
    { ...rows(db, "SELECT nickname, summary FROM posts WHERE service = 'history_course' AND id = ?1", id)[0] },
    { nickname: "새 닉", summary: "NEWSEED" },
  );
  assert.equal(rows(db, "SELECT summary_version FROM post_history_course WHERE post_id = ?1", id)[0].summary_version, 1);

  applyBatch(db, [{ sql: "DELETE FROM sync_pending_raw", params: [] }]);
  applyEntries(db, [entry("runs", "U", { run_time: 99 }, image, true)]);
  [run] = rows(db, "SELECT summary_version, run_time, characters FROM post_history_course WHERE post_id = ?1", id);
  assert.deepEqual({ ...run }, { summary_version: 0, run_time: 99, characters: '["CHARACTER.IRONCLAD"]' });
  assert.equal(count(db, `sync_pending_raw WHERE post_id = '${id}'`), 1);

  // An I folded with a heavy U still lands at 0 and queues the raw.
  const third = { ...image, id: "r0000000000000003" };
  applyEntries(db, [entry("runs", "I", third), entry("runs", "U", { win: false }, third, true)]);
  assert.deepEqual(
    { ...rows(db, "SELECT summary_version, win FROM post_history_course WHERE post_id = ?1", third.id)[0] },
    { summary_version: 0, win: 0 },
  );
  // A re-applied I of a filled run keeps its summary (the run id is the raw's hash).
  applyBatch(db, [runSummaryFillStatement(id, summary)]);
  applyEntries(db, [entry("runs", "I", { ...image, seed: "NEWSEED", donor_nickname: "새 닉" })]);
  assert.equal(rows(db, "SELECT summary_version FROM post_history_course WHERE post_id = ?1", id)[0].summary_version, 1);
});

// ------------------------------------------------------------------------------------------- deletes and cascades

check("deletes cascade as the design expects", () => {
  const del = (table: string, image: RowImage) => applyBatch(db, ok(mapDelete(table, image, ctx)));
  // Same id under two services: two rows, deleting one leaves the other.
  const shared = U(470);
  applyEntries(db, [
    entry("combo_posts", "I", { ...IMAGES.combo_posts, id: shared }),
    entry("pagestorm_posts", "I", { ...IMAGES.pagestorm_posts, id: shared }),
  ]);
  del("combo_posts", { ...IMAGES.combo_posts, id: shared });
  assert.equal(count(db, `posts WHERE id = '${shared}'`), 1);
  assert.equal(count(db, `post_pagestorm WHERE post_id = '${shared}'`), 1);

  assert.equal(count(db, "defragment_bodies"), 1);
  del("combo_posts", IMAGES.combo_posts);
  for (const table of ["post_combo", "defragment_bodies"]) assert.equal(count(db, `${table} WHERE post_id = '${U(402)}'`), 0, table);
  assert.equal(count(db, `post_combo_resources WHERE post_id = '${U(402)}'`), 0);

  del("this_or_that_posts", IMAGES.this_or_that_posts);
  for (const table of ["post_this_or_that", "this_or_that_post_votes", "this_or_that_post_likes"]) assert.equal(count(db, table), 0, table);

  del("favorite_tournament_posts", IMAGES.favorite_tournament_posts);
  for (const table of ["post_favorite_tournament", "post_favorite_tournament_pool", "favorite_tournament_candidate_stats", "favorite_tournament_plays"]) {
    assert.equal(count(db, table), 0, table);
  }

  del("runs", IMAGES.runs);
  assert.equal(count(db, "post_history_course WHERE post_id = 'r0000000000000001'"), 0);
  assert.equal(count(db, "post_history_course_file WHERE post_id = 'r0000000000000001'"), 0);

  del("comments", IMAGES.comments);
  assert.equal(count(db, "comment_likes"), 0);

  for (const table of ["likes", "resource_reactions", "community_stories", "pagestorm_drafts", "contact_inquiries", "colorful_philosopher_posts", "profile_character_nickname_pools", "puzzlebox_board_stats"]) {
    del(table, IMAGES[table]);
    assert.equal(count(db, table), 0, table);
  }
  del("puzzlebox_best", IMAGES.puzzlebox_best);
  del("puzzlebox_runs", IMAGES.puzzlebox_runs);
  del("puzzlebox_players", IMAGES.puzzlebox_players);
  for (const table of ["puzzlebox_best", "puzzlebox_runs", "puzzlebox_players"]) assert.equal(count(db, table), 0, table);
  assert.deepEqual(rows(db, "PRAGMA foreign_key_check"), []);
});

// ------------------------------------------------------------------------------------------- rejects

check("bad_timestamp: NULL or a value canonicalTs refuses, never a substitute", () => {
  assert.equal(reject(mapRow("likes", { ...IMAGES.likes, created_at: null }, ctx)), "bad_timestamp");
  assert.equal(reject(mapRow("comment_likes", { ...IMAGES.comment_likes, created_at: null }, ctx)), "bad_timestamp");
  assert.equal(reject(mapRow("comments", { ...IMAGES.comments, created_at: "infinity" }, ctx)), "bad_timestamp");
  assert.equal(reject(mapRow("chemical_posts", { ...IMAGES.chemical_posts, created_at: null }, ctx)), "bad_timestamp");
  assert.equal(reject(mapRow("runs", { ...IMAGES.runs, created_at: null }, ctx)), "bad_timestamp");
  assert.equal(reject(mapRow("contact_inquiries", { ...IMAGES.contact_inquiries, reply_seen_at: "10000-01-01T00:00:00+00:00" }, ctx)), "bad_timestamp");
  assert.equal(reject(mapRow("this_or_that_post_votes", { ...IMAGES.this_or_that_post_votes, created_at: "0001-01-01 00:00:00+01" }, ctx)), "bad_timestamp");
  assert.equal(reject(mapRow("pagestorm_drafts", { ...IMAGES.pagestorm_drafts, updated_at: "2026-11-08 01:02:03.4567891+00" }, ctx)), "bad_timestamp");
  const partial = mergeChanges([entry("contact_inquiries", "U", { reply_seen_at: "-infinity" }, IMAGES.contact_inquiries)]);
  const result = mapChange(partial.changes[0], ctx);
  assert.equal(reject(result), "bad_timestamp");
  if (!result.ok) assert.deepEqual(result.reject.rowKey, { id: U(701) });
});

check("bad_element: resources and pool elements must be exactly {type, id} strings", () => {
  assert.equal(reject(mapRow("combo_posts", { ...IMAGES.combo_posts, resources: [{ type: "card" }] }, ctx)), "bad_element");
  assert.equal(reject(mapRow("combo_posts", { ...IMAGES.combo_posts, resources: [{ type: "card", id: 1 }] }, ctx)), "bad_element");
  assert.equal(reject(mapRow("combo_posts", { ...IMAGES.combo_posts, resources: { type: "card", id: "x" } }, ctx)), "bad_element");
  assert.equal(reject(mapRow("combo_posts", { ...IMAGES.combo_posts, resources: ["bash"] }, ctx)), "bad_element");
  assert.equal(reject(mapRow("favorite_tournament_posts", { ...IMAGES.favorite_tournament_posts, pool: [{ type: "card", id: "x", extra: 1 }] }, ctx)), "bad_element");
  const partial = mergeChanges([entry("favorite_tournament_posts", "U", { pool: [null] }, IMAGES.favorite_tournament_posts)]);
  assert.equal(reject(mapChange(partial.changes[0], ctx)), "bad_element");
});

check("cross_env and fk: FK children under a post of another env", () => {
  const otherEnv = { ...ctx, parentEnv: "development" };
  const like = mapRow("this_or_that_post_likes", IMAGES.this_or_that_post_likes, otherEnv);
  assert.equal(reject(like), "cross_env");
  if (!like.ok) assert.deepEqual(like.reject.rowKey, { service: "this_or_that", post_id: U(404), user_id: U(2) });
  assert.equal(reject(mapRow("this_or_that_post_votes", IMAGES.this_or_that_post_votes, otherEnv)), "fk");
  assert.equal(reject(mapRow("favorite_tournament_plays", IMAGES.favorite_tournament_plays, otherEnv)), "fk");
  assert.equal(reject(mapRow("this_or_that_post_likes", IMAGES.this_or_that_post_likes, { ...ctx, parentEnv: null })), "fk");
  ok(mapRow("this_or_that_post_likes", IMAGES.this_or_that_post_likes, { ...ctx, parentEnv: ENV }));
  ok(mapDelete("this_or_that_post_likes", IMAGES.this_or_that_post_likes, otherEnv));
});

check("check: values of the wrong type or shape", () => {
  assert.equal(reject(mapRow("puzzlebox_runs", { ...IMAGES.puzzlebox_runs, id: 2 ** 60 }, ctx)), "check");
  assert.equal(reject(mapRow("puzzlebox_runs", { ...IMAGES.puzzlebox_runs, score: 1.5 }, ctx)), "check");
  assert.equal(reject(mapRow("puzzlebox_players", { ...IMAGES.puzzlebox_players, hidden: "t" }, ctx)), "check");
  assert.equal(reject(mapRow("comments", { ...IMAGES.comments, nickname: null }, ctx)), "check");
  assert.equal(reject(mapRow("colorful_philosopher_posts", { ...IMAGES.colorful_philosopher_posts, week_start: "2026-11-02T00:00:00" }, ctx)), "check");
  assert.equal(reject(mapRow("likes", { ...IMAGES.likes, surprise: 1 }, ctx)), "check");
  const missing = { ...IMAGES.pagestorm_posts };
  delete missing.comment_count;
  assert.equal(reject(mapRow("pagestorm_posts", missing, ctx)), "check");
  assert.equal(reject(mapRow("runs", { ...IMAGES.runs, raw: "x".repeat(1_900_001) }, ctx)), "check");
});

check("orphan: a 조각모음 body without its post changes 0 rows and says so", () => {
  const fresh = openD1TestDb();
  const statements = ok(mapRow("defragment_bodies", IMAGES.defragment_bodies, ctx));
  assert.equal(statements[0].zeroRows, "orphan");
  assert.deepEqual(applyBatch(fresh, statements), [0]);
  assert.equal(count(fresh, "defragment_bodies"), 0);
});

check("rejects land in sync_rejects, one open reject per key", () => {
  const fresh = openD1TestDb();
  const result = mapRow("likes", { ...IMAGES.likes, created_at: "infinity" }, ctx);
  assert.equal(result.ok, false);
  if (result.ok) return;
  applyBatch(fresh, [rejectStatement(result.reject, { ref: 57, op: "I", payload: IMAGES.likes, nowMs: ctx.nowMs })]);
  applyBatch(fresh, [rejectStatement(result.reject, { ref: 58, op: "U", payload: {}, nowMs: ctx.nowMs + 1 })]);
  const [row] = rows(fresh, "SELECT ref, table_name, d1_table, row_key, op, reason, attempts FROM sync_rejects");
  assert.deepEqual({ ...row }, {
    ref: 57, table_name: "likes", d1_table: "likes", row_key: JSON.stringify({ story_id: "sts2-codex:card:bash", user_id: U(2) }),
    op: "U", reason: "bad_timestamp", attempts: 2,
  });
});

console.log(`d1 row mapper checks passed (${checks})`);

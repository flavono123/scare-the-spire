/**
 * Synthetic rows for the shadow-read specs, written once to the Supabase stand-in (both envs) and
 * copied into the D1 stand-in the way the first copy does it (design 5.2): every row through the
 * shared mapper, run summaries from the raw (RF2), then threads and comment like counts from rows.
 * Times are relative to the spec's `now`, so the nav courier window and the KST week hold.
 */
import type { PGlite } from "@electric-sql/pglite";

import { kstWeekStart } from "../../src/lib/nav-surfaces";
import { mapRow, rowEnv, runSummaryFillStatement, SUPABASE_TABLES, type RowImage } from "../../src/lib/d1-sync/row-mapper";
import type { D1Statement } from "../../src/lib/d1-sync/statements";
import { extractRunListSummary } from "../../src/lib/run-list-summary";
import { applyBatch, openD1TestDb, type SqliteDb } from "../d1-sync/test-db";
import { loadRows } from "./supabase-pglite";

export const DEV = "development";
const PROD = "production";

const uuid = (prefix: string, n: number) => `${prefix}${String(n).padStart(7, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const U1 = "11111111-1111-4111-8111-111111111111";
export const U2 = "22222222-2222-4222-8222-222222222222";
export const U3 = "33333333-3333-4333-8333-333333333333";
export const U4 = "44444444-4444-4444-8444-444444444444";

export const IDS = {
  comment: (n: number) => uuid("c", n),
  story: (n: number) => uuid("e", n),
  chem: (n: number) => uuid("1", n),
  combo: (n: number) => uuid("2", n),
  transfigure: (n: number) => uuid("3", n),
  tot: (n: number) => uuid("4", n),
  tournament: (n: number) => uuid("5", n),
  decisions: (n: number) => uuid("6", n),
  pagestorm: (n: number) => uuid("7", n),
  draft: (n: number) => uuid("8", n),
  inquiry: (n: number) => uuid("9", n),
  philosopher: (n: number) => uuid("d", n),
  play: (n: number) => uuid("f", n),
};
export const RUN1 = "r0000000000000a01";
export const RUN2 = "r0000000000000a02";
export const RUN3 = "r0000000000000a03";
export const ORPHAN_BODY = uuid("a", 9);

type Value = string | number | boolean | null | { json: unknown } | { array: Array<string | number> };

function sqlValue(value: Value): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
  if ("json" in value) return `'${JSON.stringify(value.json).replace(/'/g, "''")}'`;
  return `'{${value.array.map((item) => (typeof item === "number" ? String(item) : `"${item.replace(/"/g, '\\"')}"`)).join(",")}}'`;
}

function insert(table: string, rows: Record<string, Value>[]): string {
  return rows.map((row) => {
    const names = Object.keys(row);
    // puzzlebox_runs.id is GENERATED ALWAYS; the fixture names its ids.
    const overriding = table === "puzzlebox_runs" ? " overriding system value" : "";
    return `insert into public.${table} (${names.map((name) => `"${name}"`).join(", ")})${overriding} values (${names.map((name) => sqlValue(row[name])).join(", ")});`;
  }).join("\n");
}

/** A Postgres timestamptz literal `minutes` before now, with a microsecond part. */
export function timeAgo(now: number, minutes: number, micros = 0): string {
  const base = new Date(now - minutes * 60_000).toISOString().slice(0, 19).replace("T", " ");
  return `${base}.${String(micros).padStart(6, "0")}+00`;
}

const author = (avatar: string | null, palette: string | null, swapped: boolean | null) => ({
  avatar_id: avatar,
  avatar_kind: avatar ? "character" : null,
  palette_id: palette,
  palette_swapped: swapped,
});

function runRaw(seed: string, character: string, win: boolean, startTime: number): string {
  return JSON.stringify({
    seed, build_id: "v0.107.1", ascension: 7, game_mode: "standard", win, run_time: 3600, start_time: startTime,
    acts: ["ACT.OVERGROWTH", "ACT.HIVE", "ACT.GLORY"],
    players: [{
      id: 1, character,
      deck: [
        { id: "CARD.STRIKE_IRONCLAD", floor_added_to_deck: 1 }, { id: "CARD.BASH", floor_added_to_deck: 1, current_upgrade_level: 1 },
        { id: "CARD.INFLAME", floor_added_to_deck: 5 },
      ],
      relics: [{ id: "RELIC.BURNING_BLOOD", floor_added_to_deck: 0 }, { id: "RELIC.ANCHOR", floor_added_to_deck: 3 }],
      potions: [{ id: "POTION.FIRE_POTION", slot_index: 0 }],
      badges: [{ id: "BADGE.SPEEDY", rarity: "gold" }],
    }],
    map_point_history: [[{ map_point_type: "monster", rooms: [{ model_id: "ENCOUNTER.JAW_WORM", room_type: "monster" }] }]],
  });
}

/** Every Supabase row of the fixture, as SQL. */
export function fixtureSql(now: number): string {
  const t = (minutes: number, micros = 0) => timeAgo(now, minutes, micros);
  const week = kstWeekStart(new Date(now));
  const weekShift = (days: number) => new Date(Date.parse(`${week}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
  const C = IDS.comment;
  const parts: string[] = [];

  parts.push(insert("comments", [
    { id: C(1), story_id: "sts2-codex:card:bash", user_id: U1, nickname: "철갑", content: "좋은 [카드콘:bash] 카드", content_blocks: { json: [{ type: "text", text: "좋은", weight: 1.5 }] }, created_at: t(100, 123456), env: DEV, ...author("IRONCLAD", "red", true) },
    // Same created_at as C(1): Postgres orders the pair either way (rule 1).
    { id: C(2), story_id: "sts2-codex:card:bash", user_id: U2, nickname: "은신", content: "동의합니다", content_blocks: null, created_at: t(100, 123456), env: DEV, ...author(null, null, false) },
    { id: C(3), story_id: "sts2-codex:card:bash", user_id: U3, nickname: "셋째", content: "글쎄요 {강타}", content_blocks: null, created_at: t(90), env: DEV, ...author("SILENT", null, null) },
    { id: C(4), story_id: `community:${IDS.story(1)}`, user_id: U2, nickname: "은신", content: "이야기 댓글", content_blocks: null, created_at: t(80, 5), env: DEV, ...author(null, null, false) },
    { id: C(5), story_id: `colorful-philosophers:${IDS.philosopher(2)}`, user_id: U1, nickname: "철갑", content: "철학자 답글", content_blocks: null, created_at: t(70), env: DEV, ...author("IRONCLAD", "red", false) },
    { id: C(6), story_id: `history-course:${RUN1}`, user_id: U2, nickname: "은신", content: "런 댓글", content_blocks: null, created_at: t(60), env: DEV, ...author(null, null, false) },
    { id: C(7), story_id: `c-c-c-combo:${IDS.combo(1)}`, user_id: U3, nickname: "셋째", content: "콤보 댓글 [감정콘:none]", content_blocks: null, created_at: t(50), env: DEV, ...author(null, null, false) },
    { id: C(8), story_id: "sts2-codex:relic:anchor", user_id: U1, nickname: "철갑", content: "오래된 댓글", content_blocks: null, created_at: t(20 * 24 * 60), env: DEV, ...author(null, null, false) },
    { id: C(9), story_id: "sts2-codex:card:bash", user_id: U3, nickname: "운영", content: "운영 댓글", content_blocks: null, created_at: t(40), env: PROD, ...author(null, null, false) },
  ]));
  parts.push(insert("comment_likes", [
    { id: uuid("b", 1), comment_id: C(1), user_id: U2, created_at: t(95) },
    { id: uuid("b", 2), comment_id: C(1), user_id: U3, created_at: t(94) },
    { id: uuid("b", 3), comment_id: C(2), user_id: U1, created_at: t(93) },
    { id: uuid("b", 4), comment_id: C(4), user_id: U1, created_at: t(79) },
    { id: uuid("b", 5), comment_id: C(9), user_id: U1, created_at: t(39) },
  ]));
  parts.push(insert("likes", [
    { id: uuid("b", 11), story_id: "sts2-codex:card:bash", user_id: U1, created_at: t(99), env: DEV },
    { id: uuid("b", 12), story_id: "sts2-codex:card:bash", user_id: U2, created_at: t(98), env: DEV },
    { id: uuid("b", 13), story_id: `community:${IDS.story(1)}`, user_id: U2, created_at: t(97), env: DEV },
    { id: uuid("b", 14), story_id: `this-or-that:${IDS.tot(1)}`, user_id: U3, created_at: t(96), env: DEV },
    { id: uuid("b", 15), story_id: `history-course:${RUN1}`, user_id: U1, created_at: t(95), env: DEV },
    { id: uuid("b", 16), story_id: `c-c-c-combo:${IDS.combo(1)}`, user_id: U1, created_at: t(94), env: DEV },
    { id: uuid("b", 17), story_id: "sts2-codex:card:bash", user_id: U3, created_at: t(93), env: PROD },
  ]));
  parts.push(insert("resource_reactions", [
    { env: DEV, resource_type: "card", resource_id: "bash", game_version: "0.107.1", user_id: U1, kind: "buff" },
    { env: DEV, resource_type: "card", resource_id: "bash", game_version: "0.107.1", user_id: U2, kind: "nerf" },
    { env: DEV, resource_type: "card", resource_id: "bash", game_version: "0.106.0", user_id: U1, kind: "rework" },
    { env: DEV, resource_type: "relic", resource_id: "anchor", game_version: "0.107.1", user_id: U2, kind: "buff" },
    { env: PROD, resource_type: "card", resource_id: "bash", game_version: "0.107.1", user_id: U3, kind: "buff" },
  ]));
  parts.push(insert("resource_reaction_counts", [
    { env: DEV, resource_type: "card", resource_id: "bash", game_version: "0.107.1", buff_count: 1, nerf_count: 1, rework_count: 0 },
    { env: DEV, resource_type: "card", resource_id: "bash", game_version: "0.106.0", buff_count: 0, nerf_count: 0, rework_count: 1 },
    { env: DEV, resource_type: "relic", resource_id: "anchor", game_version: "0.107.1", buff_count: 1, nerf_count: 0, rework_count: 0 },
    { env: PROD, resource_type: "card", resource_id: "bash", game_version: "0.107.1", buff_count: 1, nerf_count: 0, rework_count: 0 },
  ]));
  parts.push(insert("community_stories", [
    { id: IDS.story(1), user_id: U1, nickname: "철갑", sentence: "강타가 강해졌다", game: "sts2", env: DEV, created_at: t(300, 1), static_story_id: null, entity_type: "card", entity_id: "bash", change_id: null, patch_line_id: "v0.103.0:l1", source: "v0.103.0", tags: { json: ["buff"] }, linked_entities: { json: [{ entityType: "card", entityId: "bash", label: "강타" }] }, ...author("IRONCLAD", "red", true) },
    { id: IDS.story(2), user_id: U2, nickname: "은신", sentence: "닻이 약해졌다", game: "sts2", env: DEV, created_at: t(200), static_story_id: null, entity_type: "relic", entity_id: "anchor", change_id: null, patch_line_id: "v0.107.1:l3", source: "v0.107.1", tags: { json: [] }, linked_entities: { json: [] }, ...author(null, null, false) },
    { id: IDS.story(3), user_id: null, nickname: "공식", sentence: "문 제작자 삭제", game: "sts2", env: DEV, created_at: t(400), static_story_id: "sts2-doormaker-removed", entity_type: null, entity_id: null, change_id: "c-1", patch_line_id: null, source: "v0.103.0", tags: { json: [] }, linked_entities: { json: [] }, ...author(null, null, null) },
    { id: IDS.story(4), user_id: U1, nickname: "철갑", sentence: "같은 시각 이야기", game: "sts2", env: DEV, created_at: t(200), static_story_id: null, entity_type: null, entity_id: null, change_id: null, patch_line_id: "v0.107.1:l4", source: "v0.107.1", tags: { json: [] }, linked_entities: { json: [] }, ...author(null, null, false) },
    { id: IDS.story(5), user_id: U3, nickname: "운영", sentence: "운영 이야기", game: "sts2", env: PROD, created_at: t(150), static_story_id: null, entity_type: null, entity_id: null, change_id: null, patch_line_id: "v0.107.1:l5", source: "v0.107.1", tags: { json: [] }, linked_entities: { json: [] }, ...author(null, null, false) },
  ]));

  // --- posts ------------------------------------------------------------------------------------
  const counts = (like: number, comment: number) => ({ like_count: like, comment_count: comment });
  parts.push(insert("chemical_posts", [
    // like_count 5 without like rows: a Supabase counter drift (rule 4), copied on both sides.
    { id: IDS.chem(1), user_id: U1, nickname: "철갑", content: { json: [{ type: "text", text: "케미컬" }] }, content_text: "케미컬 엑스 글", env: DEV, created_at: t(500), ...counts(5, 0), ...author("IRONCLAD", "red", true) },
    { id: IDS.chem(2), user_id: U2, nickname: "은신", content: { json: [] }, content_text: "두 번째 케미컬", env: DEV, created_at: t(490), ...counts(0, 0), ...author(null, null, false) },
    { id: IDS.chem(3), user_id: U3, nickname: "운영", content: { json: [] }, content_text: "운영 케미컬", env: PROD, created_at: t(480), ...counts(0, 0), ...author(null, null, false) },
  ]));
  parts.push(insert("combo_posts", [
    { id: IDS.combo(1), user_id: U3, nickname: "셋째", content: { json: [{ type: "text", text: "콤보 본문" }] }, content_text: "강타와 닻 콤보", resources: { json: [{ type: "card", id: "bash" }, { type: "relic", id: "anchor" }] }, env: DEV, created_at: t(470), ...counts(1, 1), ...author("SILENT", "green", false) },
    { id: IDS.combo(2), user_id: U1, nickname: "철갑", content: { json: [] }, content_text: "두 번째 콤보", resources: { json: [{ type: "potion", id: "fire" }, { type: "card", id: "strike" }] }, env: DEV, created_at: t(460), ...counts(0, 0), ...author(null, null, null) },
  ]));
  parts.push(insert("transfigure_posts", [
    {
      id: IDS.transfigure(1), user_id: U2, nickname: "은신", resource_type: "card", resource_id: "bash", source_text: "원문", source_game_locale: "kor",
      content: { json: [{ type: "text", text: "변형" }] }, content_text: "변형된 강타", env: DEV, created_at: t(450), title: "변형 제목", transformed_name: "강강타",
      transformed_cost: "2", upgraded_content: { json: [{ type: "text", text: "강화" }] }, upgraded_content_text: "강화 본문", transformed_upgrade_cost: "1",
      show_upgrade: true, card_top_keywords: { array: ["소멸"] }, card_bottom_keywords: { array: [] }, upgraded_card_top_keywords: { array: ["보존", "소멸"] },
      upgraded_card_bottom_keywords: { array: [] }, transformed_card_type: "공격", transformed_card_rarity: "희귀", transformed_star_cost: null,
      transformed_upgrade_star_cost: null, token_color: null, token_wax: null, ...counts(2, 0), transformed_card_color: "ironclad", omit_energy_cost: false,
      ...author(null, null, false), extra_variants: { json: [{ name: "또 다른", cost: "X" }] },
    },
    {
      id: IDS.transfigure(2), user_id: U1, nickname: "철갑", resource_type: "relic", resource_id: "anchor", source_text: "닻 원문", source_game_locale: "eng",
      content: { json: [] }, content_text: "닻 변형", env: DEV, created_at: t(440), title: null, transformed_name: null, transformed_cost: null,
      upgraded_content: null, upgraded_content_text: null, transformed_upgrade_cost: null, show_upgrade: false, card_top_keywords: { array: [] },
      card_bottom_keywords: { array: [] }, upgraded_card_top_keywords: { array: [] }, upgraded_card_bottom_keywords: { array: [] },
      transformed_card_type: null, transformed_card_rarity: null, transformed_star_cost: null, transformed_upgrade_star_cost: null, token_color: "gold",
      token_wax: "wax", ...counts(2, 1), transformed_card_color: null, omit_energy_cost: null, ...author(null, null, false), extra_variants: { json: [] },
    },
  ]));
  parts.push(insert("this_or_that_posts", [
    { id: IDS.tot(1), user_id: U1, nickname: "철갑", left_type: "card", left_id: "bash", right_type: "card", right_id: "strike", reason: "둘 다 좋다", env: DEV, created_at: t(430), ...counts(1, 0), left_vote_count: 1, right_vote_count: 1, ...author(null, null, false) },
    { id: IDS.tot(2), user_id: U2, nickname: "은신", left_type: "relic", left_id: "anchor", right_type: "relic", right_id: "vajra", reason: "닻이 낫다", env: DEV, created_at: t(420), ...counts(1, 0), left_vote_count: 2, right_vote_count: 0, ...author(null, null, false) },
    { id: IDS.tot(3), user_id: U3, nickname: "셋째", left_type: "card", left_id: "inflame", right_type: "card", right_id: "offering", reason: "아직 투표 없음", env: DEV, created_at: t(410), ...counts(0, 0), left_vote_count: 0, right_vote_count: 0, ...author(null, null, false) },
  ]));
  parts.push(insert("this_or_that_post_votes", [
    { post_id: IDS.tot(1), user_id: U1, choice: "left", created_surface: "index", env: DEV, created_at: t(429) },
    { post_id: IDS.tot(1), user_id: U2, choice: "right", created_surface: "detail", env: DEV, created_at: t(428) },
    { post_id: IDS.tot(2), user_id: U1, choice: "left", created_surface: "index", env: DEV, created_at: t(419) },
    { post_id: IDS.tot(2), user_id: U3, choice: "left", created_surface: "index", env: DEV, created_at: t(418) },
  ]));
  parts.push(insert("this_or_that_post_likes", [
    { id: uuid("b", 21), post_id: IDS.tot(1), user_id: U2, env: DEV, created_at: t(427) },
    { id: uuid("b", 22), post_id: IDS.tot(2), user_id: U1, env: DEV, created_at: t(417) },
  ]));
  const pool = (ids: string[]) => ({ json: ids.map((id) => ({ type: "relic", id })) });
  parts.push(insert("favorite_tournament_posts", [
    { id: IDS.tournament(1), user_id: null, nickname: "슬서운", title: "기본 유물 대회", note: "", preset_key: "builtin:relics", game_version: "0.107.1", pool: pool(["anchor", "vajra", "burning_blood"]), env: DEV, ...counts(0, 0), play_count: 2, created_at: t(1000), ...author(null, null, false) },
    { id: IDS.tournament(2), user_id: null, nickname: "슬서운", title: "기본 카드 대회", note: "카드", preset_key: "builtin:cards", game_version: "0.107.1", pool: { json: [{ type: "card", id: "bash" }, { type: "card", id: "strike" }] }, env: DEV, ...counts(0, 0), play_count: 0, created_at: t(1000), ...author(null, null, false) },
    { id: IDS.tournament(3), user_id: U1, nickname: "철갑", title: "내 대회", note: "메모", preset_key: "custom", game_version: "0.107.1", pool: pool(["anchor", "vajra"]), env: DEV, ...counts(0, 2), play_count: 1, created_at: t(400), ...author("IRONCLAD", null, false) },
  ]));
  parts.push(insert("favorite_tournament_candidate_stats", [
    { tournament_id: IDS.tournament(3), env: DEV, resource_type: "relic", resource_id: "anchor", match_appearances: 1, match_wins: 1, championships: 1, current_rank: 1, rank_history: { json: [{ at: "2026-11-02 00:00:00.123", rank: 1 }] } },
    { tournament_id: IDS.tournament(3), env: DEV, resource_type: "relic", resource_id: "vajra", match_appearances: 1, match_wins: 0, championships: 0, current_rank: 2, rank_history: { json: [{ at: "2026-11-02 00:00:00.123", rank: 2 }] } },
  ]));
  parts.push(insert("favorite_tournament_plays", [
    { id: IDS.play(1), tournament_id: IDS.tournament(3), user_id: U2, env: DEV, starting_size: 2, champion_type: "relic", champion_id: "anchor", matches: { json: [{ left_type: "relic", left_id: "anchor", right_type: "relic", right_id: "vajra", winner: "left" }] }, created_at: t(399) },
  ]));
  parts.push(insert("decisions_decisions_posts", [
    { id: IDS.decisions(1), user_id: U2, nickname: "은신", title: "티어표", note: "어려운 결정", preset_key: "cards", game_version: "0.107.1", rows: { json: [{ id: "s", label: "S", items: ["bash"] }] }, placements: { json: [{ id: "bash", row: "s" }] }, extra_ids: { json: [] }, env: DEV, ...counts(0, 3), created_at: t(390), ...author(null, null, false) },
  ]));
  parts.push(insert("pagestorm_posts", [
    { id: IDS.pagestorm(1), user_id: U1, nickname: "철갑", title: "서류 폭풍", content: { json: { blocks: [{ type: "p", text: "본문" }], version: 2 } }, content_text: "서류 본문", env: DEV, ...counts(0, 0), created_at: t(380), ...author("IRONCLAD", "red", false) },
  ]));
  parts.push(insert("pagestorm_drafts", [
    { id: IDS.draft(1), user_id: U1, nickname: "철갑", title: "초안 하나", content: { json: { blocks: [] } }, content_text: "초안", env: DEV, created_at: t(370), updated_at: t(10), ...author(null, null, false) },
    { id: IDS.draft(2), user_id: U1, nickname: "철갑", title: "초안 둘", content: { json: { blocks: [{ type: "p" }] } }, content_text: "초안 둘", env: DEV, created_at: t(360), updated_at: t(20), ...author(null, null, false) },
    { id: IDS.draft(3), user_id: U2, nickname: "은신", title: "남의 초안", content: { json: {} }, content_text: "남의 초안", env: DEV, created_at: t(350), updated_at: t(30), ...author(null, null, false) },
  ]));
  parts.push(insert("defragment_bodies", [
    { env: DEV, source_service: "combo", source_id: IDS.combo(1), user_id: U3, nickname: "셋째", content: { json: [{ type: "text", text: "조각 본문" }] }, content_text: "조각 본문", created_at: t(300), updated_at: t(200) },
    // The post was deleted in Supabase: an orphan body (rule 5), never copied to D1.
    { env: DEV, source_service: "chemical_x", source_id: ORPHAN_BODY, user_id: U1, nickname: "철갑", content: { json: [] }, content_text: "고아 본문", created_at: t(300), updated_at: t(300) },
  ]));
  const runStart = Math.floor(now / 1000) - 86_400;
  parts.push(insert("runs", [
    { id: RUN1, raw: runRaw("ALPHA", "CHARACTER.IRONCLAD", true, runStart), seed: "ALPHA", build: "v0.107.1", character: "CHARACTER.IRONCLAD", ascension: 7, win: true, start_time: runStart, run_time: 3600, acts_count: 3, donor_user_id: U1, created_at: t(250), total_floors: 1, env: DEV, cover_spec: { json: { auto: false, elements: [{ type: "card", id: "CARD.BASH" }] } }, ...counts(1, 1), donor_nickname: "철갑" },
    { id: RUN2, raw: runRaw("BETA", "CHARACTER.SILENT", false, runStart - 100), seed: "BETA", build: "v0.107.1", character: "CHARACTER.SILENT", ascension: 0, win: false, start_time: runStart - 100, run_time: 120, acts_count: 1, donor_user_id: U2, created_at: t(240), total_floors: 1, env: DEV, cover_spec: null, ...counts(0, 0), donor_nickname: "은신" },
    { id: RUN3, raw: runRaw("", "CHARACTER.IRONCLAD", false, runStart - 200), seed: "", build: "v0.106.0", character: "CHARACTER.IRONCLAD", ascension: 1, win: false, start_time: runStart - 200, run_time: 60, acts_count: 1, donor_user_id: null, created_at: t(240), total_floors: 1, env: DEV, cover_spec: { json: { auto: true } }, ...counts(0, 0), donor_nickname: "익명" },
  ]));

  // --- contact, puzzlebox, philosophers, nickname pools -------------------------------------
  parts.push(insert("contact_inquiries", [
    { id: IDS.inquiry(1), user_id: U1, category: "bug", message: "버그가 있습니다. 확인 부탁.", reply_email: null, page_path: "/", service_locale: "ko", game_locale: "kor", viewport_width: 390, viewport_height: 844, env: DEV, status: "done", created_at: t(600), admin_response: "고쳤습니다.", responded_at: t(500), reply_seen_at: null },
    { id: IDS.inquiry(2), user_id: U1, category: "feedback", message: "좋은 사이트입니다 감사합니다", reply_email: null, page_path: "/codex", service_locale: "ko", game_locale: "kor", viewport_width: null, viewport_height: null, env: DEV, status: "new", created_at: t(550), admin_response: null, responded_at: null, reply_seen_at: null },
    { id: IDS.inquiry(3), user_id: U2, category: "bug", message: "다른 사람의 문의입니다", reply_email: null, page_path: "/", service_locale: "en", game_locale: "eng", viewport_width: null, viewport_height: null, env: DEV, status: "done", created_at: t(540), admin_response: "답장", responded_at: t(530), reply_seen_at: t(520) },
    { id: IDS.inquiry(4), user_id: U1, category: "bug", message: "운영 쪽 문의입니다만", reply_email: null, page_path: "/", service_locale: "ko", game_locale: "kor", viewport_width: null, viewport_height: null, env: PROD, status: "done", created_at: t(510), admin_response: "운영 답장", responded_at: t(505), reply_seen_at: null },
  ]));
  parts.push(insert("puzzlebox_players", [
    { user_id: U1, nickname: "철갑", avatar_id: "IRONCLAD", avatar_kind: "character", palette_id: "red", palette_swapped: true, hidden: false, updated_at: t(100) },
    { user_id: U2, nickname: "은신", avatar_id: null, avatar_kind: null, palette_id: null, palette_swapped: false, hidden: false, updated_at: t(100) },
    { user_id: U3, nickname: "셋째", avatar_id: null, avatar_kind: null, palette_id: null, palette_swapped: false, hidden: false, updated_at: t(100) },
    { user_id: U4, nickname: "숨김", avatar_id: null, avatar_kind: null, palette_id: null, palette_swapped: false, hidden: true, updated_at: t(100) },
  ]));
  const runs: Record<string, Value>[] = [];
  const best: Record<string, Value>[] = [];
  let runId = 101;
  const play = (env: string, game: string, board: string, userId: string, score: number, minutes: number, perfect = false) => {
    runs.push({ id: runId, env, game, board, user_id: userId, attempt: 1, score, perfect, run: { json: { guesses: [] } }, created_at: t(minutes) });
    best.push({ env, game, board, user_id: userId, score, perfect, run_id: runId, achieved_at: t(minutes), attempts: 1 });
    runId += 1;
  };
  play(DEV, "connections", "1", U1, 4, 300, true);
  play(DEV, "connections", "2", U1, 3, 290);
  play(DEV, "connections", "1", U2, 4, 280, true);
  play(DEV, "connections", "1", U3, 2, 270);
  play(DEV, "connections", "1", U4, 4, 260, true);
  play(DEV, "connections", "2", U3, 4, 250, true);
  play(DEV, "beta-quiz", "1", U1, 9, 240);
  play(PROD, "connections", "1", U2, 1, 230);
  parts.push(insert("puzzlebox_runs", runs));
  parts.push(insert("puzzlebox_best", best));
  parts.push(insert("puzzlebox_board_stats", [
    { env: DEV, game: "connections", board: "1", players: 4, cleared: 3, perfect: 3, score_sum: 14, mistakes_sum: 2, rocks_sum: 1, purple_first: 1, level_solved: { array: [4, 3, 2, 1] }, question_wrong: { array: [] }, wrong_picks: { array: [1, 2] }, speed_sum: 300 },
    { env: DEV, game: "connections", board: "2", players: 2, cleared: 1, perfect: 1, score_sum: 7, mistakes_sum: 0, rocks_sum: 0, purple_first: 0, level_solved: { array: [0, 0, 0, 0] }, question_wrong: { array: [] }, wrong_picks: { array: [] }, speed_sum: 80 },
  ]));
  const P = IDS.philosopher;
  const philosopher = (n: number, weekStart: string, slot: string, resourceType: string, resourceId: string, extra: Record<string, Value> = {}) => ({
    id: P(n), env: DEV, week_start: weekStart, slot, resource_type: resourceType, resource_id: resourceId, name_ko: `이름 ${n}`, name_en: `Name ${n}`,
    image_url: null, body: `본문 ${n}`, game_version: "0.107.1", buff_count: 0, nerf_count: 0, rework_count: 0, created_at: t(2000 + n), ...extra,
  });
  parts.push(insert("colorful_philosopher_posts", [
    // Two posts of card:bash in this week (topic and card slots): a week_start tie (rule 1).
    philosopher(1, week, "topic", "card", "bash", { image_url: "/images/x.png" }),
    philosopher(2, week, "card", "card", "bash", { buff_count: 3, nerf_count: 1 }),
    philosopher(3, week, "relic", "relic", "anchor"),
    philosopher(4, weekShift(-7), "card", "card", "bash"),
    philosopher(5, weekShift(-7), "topic", "event", "neow"),
    // Reserved for next week: out of the reel and the nav weekly dot.
    philosopher(6, weekShift(7), "card", "card", "strike"),
    { ...philosopher(7, week, "card", "card", "bash"), env: PROD, week_start: weekShift(-14) },
  ]));
  // profile_character_nickname_pools: no env, one shared set. The repo migration seeds it; a
  // schema-only dump does not, so the fixture adds two rows where none are.
  parts.push(`${insert("profile_character_nickname_pools", [
    { character_id: "IRONCLAD", locale: "ko", nicknames: { array: ["철갑", "불꽃"] }, updated_at: t(5000) },
  ]).slice(0, -1)} on conflict do nothing;`);
  parts.push(`${insert("profile_character_nickname_pools", [
    { character_id: "SILENT", locale: "en", nicknames: { array: ["Shiv"] }, updated_at: t(5000) },
  ]).slice(0, -1)} on conflict do nothing;`);
  return parts.join("\n");
}

/** Images of the rows the D1 copy of `env` holds, per Supabase table (parent first). */
async function imagesFor(db: PGlite, table: string, env: string): Promise<RowImage[]> {
  const sql = table === "comment_likes"
    ? "select to_jsonb(l) as row, c.env from public.comment_likes l join public.comments c on c.id = l.comment_id"
    : `select to_jsonb(t) as row, null::text as env from public.${table} t`;
  const { rows } = await db.query<{ row: RowImage; env: string | null }>(sql);
  return rows
    .filter((row) => {
      const rowEnvironment = table === "comment_likes" ? row.env : rowEnv(row.row);
      return rowEnvironment === null || rowEnvironment === env;
    })
    .map((row) => row.row);
}

export type CopyReport = { rows: Record<string, number>; rejects: Array<{ table: string; reason: string }> };

/** The first copy of `env` into a fresh D1 stand-in (design 5.2 steps 4-6). */
export async function firstCopy(db: PGlite, env = DEV, nowMs = Date.now()): Promise<{ sqlite: SqliteDb; report: CopyReport }> {
  const sqlite = openD1TestDb();
  const report: CopyReport = { rows: {}, rejects: [] };
  for (const table of SUPABASE_TABLES) {
    const images = await imagesFor(db, table, env);
    const statements: D1Statement[] = [];
    for (const image of images) {
      const result = mapRow(table, image, { nowMs });
      if (!result.ok) {
        report.rejects.push({ table, reason: result.reject.reason });
        continue;
      }
      statements.push(...result.statements);
    }
    // An orphan body inserts 0 rows (S12) and is counted, never copied.
    applyBatch(sqlite, statements);
    report.rows[table] = images.length;
  }
  for (const row of sqlite.prepare("SELECT post_id, raw FROM post_history_course_file").all() as Array<{ post_id: string; raw: string }>) {
    const summary = extractRunListSummary(row.post_id, row.raw);
    applyBatch(sqlite, [runSummaryFillStatement(row.post_id, summary)]);
  }
  sqlite.exec(`
    INSERT INTO threads (thread_key, like_count, comment_count, last_comment_at, updated_at)
    SELECT k, sum(l), sum(c), max(m), 1762560000000 FROM (
      SELECT story_id AS k, count(*) AS l, 0 AS c, NULL AS m FROM likes GROUP BY story_id
      UNION ALL
      SELECT story_id, 0, count(*), max(created_at) FROM comments GROUP BY story_id
    ) WHERE true GROUP BY k;
    UPDATE comments SET like_count = (SELECT count(*) FROM comment_likes l WHERE l.comment_id = comments.id);
  `);
  return { sqlite, report };
}

export async function loadFixture(db: PGlite, now: number): Promise<void> {
  await loadRows(db, fixtureSql(now));
}

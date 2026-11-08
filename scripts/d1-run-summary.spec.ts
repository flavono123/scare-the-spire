/**
 * The run summary extractor (src/lib/run-list-summary.ts) on synthetic runs: rows go through the
 * row mapper and RF2 into a SQLite copy of the D1 schema, and the list inputs read back from the
 * summary columns must equal the ones today's list builds from the raw.
 *   pnpm exec tsx scripts/d1-run-summary.spec.ts
 * The same check over every run of a Supabase backup: scripts/d1-run-summary-backup-check.ts.
 */
import assert from "node:assert/strict";
import { canonicalTs, postgrestTs } from "../src/lib/d1-time";
import { mapRow, runSummaryFillStatement, type RowImage } from "../src/lib/d1-sync/row-mapper";
import {
  extractRunListSummary,
  listInputsFromRawRow,
  listInputsFromSummaryRow,
  RUN_SUMMARY_VERSION,
} from "../src/lib/run-list-summary";
import type { RunRow } from "../src/lib/run-summary-row";
import { applyBatch, openD1TestDb } from "./d1-sync/test-db";
import { compareListInputs, d1ListRows, popularElementsMatch, summaryRowFromD1 } from "./d1-sync/run-summary-compare";

const U = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;

function card(id: string, floor?: number, upgrade?: number, extra: Record<string, unknown> = {}) {
  return { id, ...(floor === undefined ? {} : { floor_added_to_deck: floor }), ...(upgrade === undefined ? {} : { current_upgrade_level: upgrade }), ...extra };
}

function entry(modelId: string, extra: Record<string, unknown> = {}) {
  return { map_point_type: "monster", rooms: [{ model_id: modelId, room_type: "monster" }], ...extra };
}

const RUNS: Array<{ id: string; raw: Record<string, unknown>; cover?: unknown }> = [
  {
    id: "r0000000000000a01",
    raw: {
      seed: "ALPHA", build_id: "v0.107.1", ascension: 7, game_mode: "standard", win: true, run_time: 3600, start_time: 1762500000,
      acts: ["ACT.OVERGROWTH", "ACT.HIVE", "ACT.GLORY"], modifiers: ["MODIFIER.DRAFT"],
      players: [{
        id: 1, character: "CHARACTER.IRONCLAD",
        deck: [
          card("CARD.STRIKE_IRONCLAD", 1), card("CARD.STRIKE_IRONCLAD", 1), card("CARD.STRIKE_IRONCLAD", 1),
          card("CARD.DEFEND_IRONCLAD", 1), card("CARD.BASH", 1, 1), card("CARD.INFLAME", 5), card("CARD.INFLAME", 12, 1),
          card("CARD.OFFERING", 40), card("CARD.CLASH", 3, 0, { enchantment: { id: "ENCHANTMENT.SHARP", amount: 2 } }),
          card("CARD.SHRUG_IT_OFF"),
        ],
        relics: [{ id: "RELIC.BURNING_BLOOD", floor_added_to_deck: 0 }, { id: "RELIC.ANCHOR", floor_added_to_deck: 3 }, { id: "RELIC.VAJRA" }],
        potions: [{ id: "POTION.FIRE_POTION", slot_index: 0 }, { id: "POTION.POTION_SLOT" }, { id: "NONE" }, { id: "POTION.FIRE_POTION" }],
        badges: [{ id: "BADGE.SPEEDY", rarity: "gold" }, { id: "BADGE.PERFECT", rarity: 1 }, { id: "BADGE.NONE", rarity: "none" }],
      }],
      map_point_history: [
        [entry("ENCOUNTER.JAW_WORM"), entry("EVENT.NEOW"), entry("ANCIENT.NEOW")],
        [entry("ENCOUNTER.SLIMES"), entry("ENCOUNTER.BOSS_ONE")],
        [entry("ENCOUNTER.HEART")],
      ],
    },
  },
  {
    // Party run: the same relic twice (one acquired), duplicate characters, the same badge twice.
    id: "r0000000000000a02",
    raw: {
      seed: "", build_id: "v0.106.0", ascension: 0, win: false, run_time: 120,
      acts: ["ACT.OVERGROWTH"],
      players: [
        {
          id: 1, character: "CHARACTER.SILENT", deck: [card("CARD.NEUTRALIZE", 1), card("CARD.BLADE_DANCE", 2)],
          relics: [{ id: "RELIC.RING_OF_THE_SNAKE", floor_added_to_deck: 0 }, { id: "RELIC.ANCHOR", floor_added_to_deck: 0 }],
          potions: [], badges: [{ id: "BADGE.TEAM", rarity: "bronze" }],
        },
        {
          id: 2, character: "CHARACTER.SILENT", deck: [card("CARD.BLADE_DANCE", 4), card("CARD.STRIKE_SILENT")],
          relics: [{ id: "RELIC.ANCHOR", floor_added_to_deck: 2 }],
          potions: [{ id: "POTION.BLOCK_POTION" }], badges: [{ id: "BADGE.TEAM", rarity: "silver" }],
        },
      ],
      map_point_history: [[entry("ENCOUNTER.CULTIST"), entry("ENCOUNTER.CULTIST")]],
    },
  },
  {
    // A manual cover stays as stored; no players at all.
    id: "r0000000000000a03",
    raw: { seed: "EMPTY", acts: [], map_point_history: [], players: [] },
    cover: { background: { kind: "character" }, phrase: "내 표지", elements: [], auto: false, suggestSeed: "x" },
  },
  {
    // An auto cover stored on the row is re-picked on read.
    id: "r0000000000000a04",
    raw: {
      seed: "DELTA", build_id: "v0.107.1", ascension: 20, win: true, acts: ["ACT.A", "ACT.B"],
      players: [{
        id: 1, character: "CHARACTER.DEFECT",
        deck: Array.from({ length: 41 }, (_, i) => card(i % 2 ? "CARD.ZAP" : "CARD.DUALCAST", i)),
        relics: Array.from({ length: 21 }, (_, i) => ({ id: `RELIC.R${i}`, floor_added_to_deck: i })),
        potions: [{ id: "POTION.SWIFT_POTION" }], badges: [],
      }],
      map_point_history: [[entry("ENCOUNTER.A")], [entry("ENCOUNTER.B")]],
    },
    cover: { background: { kind: "character" }, phrase: "옛 자동", elements: [], auto: true, suggestSeed: "y" },
  },
];

const CREATED = ["2026-11-01 00:00:00+00", "2026-11-02 00:00:00.5+00", "2026-11-03 00:00:00+00", "2026-11-04 00:00:00.123456+00"];

function supabaseRow(index: number): { image: RowImage; rawRow: RunRow } {
  const spec = RUNS[index];
  const raw = JSON.stringify(spec.raw);
  const run = spec.raw as Record<string, unknown> & { players: Array<{ character: string }>; map_point_history: unknown[][]; acts: unknown[] };
  const columns = {
    id: spec.id,
    seed: String(run.seed),
    build: typeof run.build_id === "string" ? run.build_id : "unknown",
    character: run.players[0]?.character ?? "",
    ascension: typeof run.ascension === "number" ? run.ascension : 0,
    win: Boolean(run.win),
    start_time: typeof run.start_time === "number" ? run.start_time : null,
    run_time: typeof run.run_time === "number" ? run.run_time : null,
    acts_count: run.acts.length,
    total_floors: run.map_point_history.reduce((t, act) => t + act.length, 0),
    cover_spec: spec.cover ?? null,
    donor_user_id: U(index + 1),
  };
  const image: RowImage = {
    ...columns, raw, created_at: CREATED[index], env: "production", badges: [], highlight_card: null, highlight_relic: null,
    note_blocks: null, like_count: index, comment_count: 0, donor_nickname: `기증자${index}`,
  };
  const rawRow: RunRow = { ...columns, cover_spec: columns.cover_spec as RunRow["cover_spec"], raw, created_at: postgrestTs(canonicalTs(CREATED[index]))! };
  return { image, rawRow };
}

const db = openD1TestDb();
const rawRows: RunRow[] = [];
for (let i = 0; i < RUNS.length; i++) {
  const { image, rawRow } = supabaseRow(i);
  rawRows.push(rawRow);
  const mapped = mapRow("runs", image, { nowMs: 0 });
  assert.ok(mapped.ok);
  applyBatch(db, mapped.statements);
}

// Before the fill: every run is at summary_version 0 and the list must use the raw path.
for (const row of d1ListRows(db)) {
  assert.equal(row.summary_version, 0);
  assert.throws(() => listInputsFromSummaryRow(summaryRowFromD1(row)), /no summary yet/);
}

for (const rawRow of rawRows) {
  const summary = extractRunListSummary(rawRow.id!, rawRow.raw!);
  assert.equal(summary.summary_version, RUN_SUMMARY_VERSION);
  assert.deepEqual(applyBatch(db, [runSummaryFillStatement(rawRow.id!, summary)]), [1]);
}

const listRows = d1ListRows(db);
assert.equal(listRows.length, RUNS.length);
const byId = new Map(rawRows.map((row) => [row.id, row]));
for (const row of listRows) {
  const summaryRow = summaryRowFromD1(row);
  assert.deepEqual(compareListInputs(byId.get(summaryRow.id)!, summaryRow), [], summaryRow.id);
}
assert.ok(popularElementsMatch(rawRows, listRows.map(summaryRowFromD1)));

// Spot checks of what the summary holds.
const first = extractRunListSummary(RUNS[0].id, JSON.stringify(RUNS[0].raw));
assert.deepEqual(first.characters, ["CHARACTER.IRONCLAD"]);
assert.equal(first.game_mode, "standard");
assert.deepEqual(first.list_facts.cards.slice(0, 5), [
  ["STRIKE_IRONCLAD", 3, 1, false],
  ["DEFEND_IRONCLAD", 1, 1, false],
  ["BASH", 1, 1, true],
  ["INFLAME", 2, 5, true],
  ["OFFERING", 1, 40, false],
]);
assert.deepEqual(first.list_facts.cards.at(-1), ["SHRUG_IT_OFF", 1, null, false]);
assert.deepEqual(first.list_facts.relics, [["BURNING_BLOOD", false], ["ANCHOR", true], ["VAJRA", false]]);
assert.deepEqual(first.list_facts.potions, ["FIRE_POTION", "FIRE_POTION"]);
assert.equal(first.list_facts.deck_size, 10);
assert.equal(first.list_facts.relic_count, 3);
assert.deepEqual(first.badges, [{ id: "BADGE.SPEEDY", rarity: "gold" }, { id: "BADGE.PERFECT", rarity: "bronze" }]);
const party = extractRunListSummary(RUNS[1].id, JSON.stringify(RUNS[1].raw));
assert.deepEqual(party.characters, ["CHARACTER.SILENT", "CHARACTER.SILENT"]);
assert.deepEqual(party.list_facts.relics, [["RING_OF_THE_SNAKE", false], ["ANCHOR", true]]);
assert.deepEqual(party.badges, [{ id: "BADGE.TEAM", rarity: "silver" }]);
const manual = listInputsFromSummaryRow(summaryRowFromD1(listRows.find((row) => row.id === RUNS[2].id)!));
assert.equal(manual.summary.cover_spec?.phrase, "내 표지");
const auto = listInputsFromSummaryRow(summaryRowFromD1(listRows.find((row) => row.id === RUNS[3].id)!));
assert.equal(auto.summary.cover_spec?.auto, true);
assert.notEqual(auto.summary.cover_spec?.phrase, "옛 자동");
assert.deepEqual(auto.summary.cover_spec, listInputsFromRawRow(byId.get(RUNS[3].id)!).summary.cover_spec);

// The comparison sees a changed summary.
const tampered = summaryRowFromD1(listRows.find((row) => row.id === RUNS[0].id)!);
tampered.list_facts = { ...tampered.list_facts!, deck_size: 50, highlight_relic: "VAJRA" };
assert.deepEqual(compareListInputs(byId.get(RUNS[0].id)!, tampered).sort(), ["search.haystack", "summary.cover_spec", "summary.highlight_relic"]);
tampered.badges = [];
assert.ok(compareListInputs(byId.get(RUNS[0].id)!, tampered).includes("summary.badges"));

assert.throws(() => extractRunListSummary("r-bad", "{\"not\": \"a run\"}"));
console.log(`d1 run summary checks passed (${RUNS.length} synthetic runs)`);

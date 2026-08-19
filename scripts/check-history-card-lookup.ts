import assert from "node:assert/strict";
import { collectRelevantCardIds } from "../src/components/history-course/topbar-state";
import type { CodexCard } from "../src/lib/codex-types";
import { indexCodexCards, lookupHistoryCard } from "../src/lib/history-card-lookup";
import { lookupHistoryCardVisual } from "../src/lib/history-card-visuals";
import type { ReplayRun } from "../src/lib/sts2-run-replay";

const run: ReplayRun = {
  seed: "TEST",
  build_id: "v0.110.0",
  ascension: 0,
  game_mode: "standard",
  win: false,
  acts: [],
  modifiers: [],
  players: [{
    id: 1,
    character: "CHARACTER.DEFECT",
    deck: [],
    relics: [],
    potions: [],
    badges: [],
  }],
  map_point_history: [[{
    map_point_type: "rest_site",
    rooms: [],
    upgraded_cards: ["CARD.DUALCAST"],
    cards_enchanted: [{ cardId: "CARD.MAD_SCIENCE", enchantmentId: "SHARP" }],
  }]],
};

assert.deepEqual(
  collectRelevantCardIds(run).sort(),
  ["CARD.DUALCAST", "CARD.MAD_SCIENCE"],
);

const indexed = indexCodexCards([
  { id: "STRIKE_IRONCLAD", name: "타격" } as CodexCard,
]);
assert.equal(lookupHistoryCard(indexed, "CARD.STRIKE_IRONCLAD")?.id, "STRIKE_IRONCLAD");
assert.equal(lookupHistoryCard(indexed, "STRIKE_IRONCLAD")?.id, "STRIKE_IRONCLAD");

const strike = lookupHistoryCardVisual("CARD.STRIKE_IRONCLAD");
assert.equal(strike?.color, "ironclad");
assert.equal(strike?.rarity, "기본");
assert.equal(strike?.type, "공격");

const bane = lookupHistoryCardVisual("CARD.ASCENDERS_BANE");
assert.equal(bane?.color, "curse");
assert.equal(bane?.rarity, "저주");
assert.equal(bane?.type, "저주");

const madScience = lookupHistoryCardVisual("CARD.MAD_SCIENCE_ATTACK_VIOLENCE");
assert.equal(madScience?.color, "event");
assert.equal(madScience?.type, "공격");

console.log("history card lookup: ok");

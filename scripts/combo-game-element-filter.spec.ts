import assert from "node:assert/strict";
import {
  comboPostMatchesAnyGameElement,
  extractComboHistoryRunReferences,
  extractComboResourceRefs,
  type ComboResourceRef,
} from "../src/lib/combo-types";
import type { PostBlock } from "../src/lib/chemical-types";

const card: ComboResourceRef = { type: "card", id: "PERFECTED_STRIKE" };
const relic: ComboResourceRef = { type: "relic", id: "STRIKE_DUMMY" };
const potion: ComboResourceRef = { type: "potion", id: "BLOCK_POTION" };
const post = { resources: [card, relic] };

assert.equal(
  comboPostMatchesAnyGameElement(post, []),
  true,
  "no selection should keep every post visible",
);
assert.equal(
  comboPostMatchesAnyGameElement(post, [potion, relic]),
  true,
  "a post should remain visible when any selected game element matches",
);
assert.equal(
  comboPostMatchesAnyGameElement(post, [potion]),
  false,
  "a post should be hidden when none of the selected game elements match",
);

const blocks: PostBlock[] = [
  {
    type: "history-run",
    runId: "1abcdefghijklmno",
    snapshot: {
      title: null,
      character: "CHARACTER.IRONCLAD",
      startTime: 1_752_669_600,
      ascension: 10,
      win: true,
      totalFloors: 52,
      runTime: 3_600,
      build: "v0.109.0",
      seed: "ABC123",
    },
  },
  {
    type: "entity",
    entityId: card.id,
    entityType: card.type,
    displayText: "완벽한 타격",
  },
];
assert.equal(
  extractComboResourceRefs(blocks).length,
  1,
  "History Course references must not count toward the two-game-element minimum",
);
assert.equal(extractComboHistoryRunReferences(blocks).length, 1);

console.log("combo game element OR filter checks passed");

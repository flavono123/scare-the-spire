import assert from "node:assert/strict";
import {
  comboPostMatchesAnyGameElement,
  type ComboResourceRef,
} from "../src/lib/combo-types";

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

console.log("combo game element OR filter checks passed");

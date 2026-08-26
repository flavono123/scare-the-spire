import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import catalog from "../data/sts2/card-multiplayer-constraints.json";
import { isMultiplayerOnlyCardId } from "../src/lib/card-multiplayer-catalog";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const engCards = JSON.parse(
  readFileSync(join(root, "data/sts2/eng/cards.json"), "utf8"),
) as Array<{ id: string }>;

const byId = new Set(engCards.map((card) => card.id));
const multiplayerOnly = new Set(catalog.multiplayerOnlyIds);
const singleplayerOnly = new Set(catalog.singleplayerOnlyIds);

assert.equal(catalog.multiplayerOnlyIds.length, 37);
assert.equal(catalog.singleplayerOnlyIds.length, 1);
assert.ok(singleplayerOnly.has("WELL_LAID_PLANS"));
assert.equal(multiplayerOnly.has("WELL_LAID_PLANS"), false);

for (const id of [...multiplayerOnly, ...singleplayerOnly]) {
  assert.ok(byId.has(id), `unknown card id ${id}`);
}

assert.ok(isMultiplayerOnlyCardId("BELIEVE_IN_YOU"));
assert.ok(isMultiplayerOnlyCardId("TAG_TEAM"));
assert.ok(isMultiplayerOnlyCardId("THE_BALL"));
assert.ok(isMultiplayerOnlyCardId("BLADE_SYMPHONY"));
assert.ok(isMultiplayerOnlyCardId("TUTOR"));
assert.equal(isMultiplayerOnlyCardId("BASH"), false);
assert.equal(isMultiplayerOnlyCardId("ABUNDANCE"), false);
assert.equal(isMultiplayerOnlyCardId("WELL_LAID_PLANS"), false);

console.log("card-multiplayer-constraints.selfcheck: ok");

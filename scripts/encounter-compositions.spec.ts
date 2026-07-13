import assert from "node:assert/strict";
import { getCodexEncounters, getCodexMonsters } from "../src/lib/codex-data";
import { getRelatedEncounterIdsForMonster } from "../src/lib/codex-references";
import { expandEncounterFormations } from "../src/lib/encounter-compositions";

async function main() {
const encounters = await getCodexEncounters({ gameLocale: "kor" });
const strangler = encounters.find((encounter) => encounter.id === "SLITHERING_STRANGLER_NORMAL");
assert.ok(strangler, "Strangler and Friend encounter must exist");
assert.equal(strangler.compositions?.length, 3, "DLL enum branches must remain distinct");

const formations = expandEncounterFormations(strangler);
const actualFormations = formations.map((formation) => ({
  ids: formation.monsters.map((monster) => monster.id).join("+"),
  probability: formation.probability,
}));
assert.deepEqual(actualFormations, [
  { ids: "SNAPPING_JAXFRUIT+SLITHERING_STRANGLER", probability: 1 / 3 },
  { ids: "LEAF_SLIME_M+SLITHERING_STRANGLER", probability: 1 / 6 },
  { ids: "TWIG_SLIME_M+SLITHERING_STRANGLER", probability: 1 / 6 },
  { ids: "LEAF_SLIME_S+LEAF_SLIME_S+SLITHERING_STRANGLER", probability: 1 / 12 },
  { ids: "LEAF_SLIME_S+TWIG_SLIME_S+SLITHERING_STRANGLER", probability: 1 / 12 },
  { ids: "TWIG_SLIME_S+LEAF_SLIME_S+SLITHERING_STRANGLER", probability: 1 / 12 },
  { ids: "TWIG_SLIME_S+TWIG_SLIME_S+SLITHERING_STRANGLER", probability: 1 / 12 },
]);
assert.ok(
  Math.abs(formations.reduce((sum, formation) => sum + formation.probability, 0) - 1) < 1e-12,
  "formation probabilities must sum to 100%",
);
assert.ok(
  getRelatedEncounterIdsForMonster("TWIG_SLIME_S", encounters).includes(strangler.id),
  "a composition candidate must reverse-reference its encounter",
);

const queen = encounters.find((encounter) => encounter.id === "QUEEN_BOSS");
assert.ok(queen?.scene, "Queen boss must load its custom scene");
assert.equal(queen.scene.ambientVfx.kind, "queen");
assert.equal(queen.scene.backgroundSpineAsset?.idleAnimation, "animation");
assert.deepEqual(
  queen.scene.monsterSlots.map((slot) => [slot.monsterId, slot.sourcePosition.x, slot.sourcePosition.y]),
  [
    ["TORCH_HEAD_AMALGAM", 1207, 709],
    ["QUEEN", 1606, 695],
  ],
);

const monsters = await getCodexMonsters({ gameLocale: "kor" });
const monsterById = new Map(monsters.map((monster) => [monster.id, monster]));
for (const monsterId of [
  ...new Set(formations.flatMap((formation) => formation.monsters.map((monster) => monster.id))),
  "TORCH_HEAD_AMALGAM",
  "QUEEN",
]) {
  const monster = monsterById.get(monsterId);
  assert.ok(monster?.spineAsset, `${monsterId} must render through an idle Spine asset`);
  assert.ok(monster.spineAsset.idleAnimation, `${monsterId} must have an idle animation`);
}

console.log("Encounter composition and scene assertions passed.");
}

void main();

import assert from "node:assert/strict";
import { getCodexCharacters, getCodexEncounters, getCodexMonsters } from "../src/lib/codex-data";
import { getRelatedEncounterIdsForMonster } from "../src/lib/codex-references";
import {
  expandEncounterFormations,
  formatEncounterLossText,
} from "../src/lib/encounter-compositions";

async function main() {
  const encounters = await getCodexEncounters({ gameLocale: "kor" });
  assert.equal(encounters.length, 92);
  assert.equal(encounters.filter((encounter) => encounter.compositions?.length).length, 89);

  const scenes = encounters.flatMap((encounter) => encounter.scene ? [encounter.scene] : []);
  assert.equal(scenes.length, 90, "only the two empty localization-only encounters lack scenes");
  assert.equal(new Set(scenes.map((scene) => scene.backgroundUrl)).size, 17);

  for (const encounter of encounters.filter((candidate) => candidate.compositions?.length)) {
    const formations = expandEncounterFormations(encounter);
    assert.ok(formations.length > 0, `${encounter.id} must expand at least one formation`);
    assert.ok(
      Math.abs(formations.reduce((sum, formation) => sum + formation.probability, 0) - 1) < 1e-12,
      `${encounter.id} formation probabilities must sum to 100%`,
    );
    if (encounter.scene?.combatLayout.usesFixedSlots) {
      const sceneSlotNames = new Set(encounter.scene.monsterSlots.map((slot) => slot.slotName));
      for (const formation of formations) {
        for (const monster of formation.monsters) {
          assert.ok(monster.slotName, `${encounter.id}:${monster.id} must retain its scene slot`);
          assert.ok(
            sceneSlotNames.has(monster.slotName),
            `${encounter.id}:${monster.slotName} must exist in its PCK encounter scene`,
          );
        }
      }
    }
  }

  assert.equal(formationCount(encounters, "BOWLBUGS_NORMAL"), 6);
  assert.equal(formationCount(encounters, "RUBY_RAIDERS_NORMAL"), 60);
  assert.equal(formationCount(encounters, "SLIMES_WEAK"), 4);
  assert.deepEqual(
    encounterCountsByFormationCount(encounters),
    [[1, 83], [2, 3], [4, 1], [6, 1], [7, 1], [60, 1]],
  );

  const formattedLossText = formatEncounterLossText(
    "{character}는 [gold][b]{encounter}[/b][/gold]의 분노를 마주했습니다.",
    "네크로바인더",
    "루비 추적자",
  );
  assert.equal(
    formattedLossText,
    "네크로바인더는 [gold][b]루비 추적자[/b][/gold]의 분노를 마주했습니다.",
  );
  assert.ok(!formattedLossText.includes("{character}"));
  assert.ok(!formattedLossText.includes("{encounter}"));

  const strangler = getEncounter(encounters, "SLITHERING_STRANGLER_NORMAL");
  assert.equal(strangler.compositions?.length, 3, "DLL enum branches must remain distinct");
  assert.equal(strangler.scene?.combatLayout.coordinateSize.width, 1920);
  assert.equal(
    strangler.scene?.combatLayout.monsters.find(
      (monster) => monster.monsterId === "SLITHERING_STRANGLER",
    )?.bounds.height,
    220,
  );

  const stranglerFormations = expandEncounterFormations(strangler);
  assert.deepEqual(
    stranglerFormations.map((formation) => ({
      ids: formation.monsters.map((monster) => monster.id).join("+"),
      probability: formation.probability,
    })),
    [
      { ids: "SNAPPING_JAXFRUIT+SLITHERING_STRANGLER", probability: 1 / 3 },
      { ids: "LEAF_SLIME_M+SLITHERING_STRANGLER", probability: 1 / 6 },
      { ids: "TWIG_SLIME_M+SLITHERING_STRANGLER", probability: 1 / 6 },
      { ids: "LEAF_SLIME_S+LEAF_SLIME_S+SLITHERING_STRANGLER", probability: 1 / 12 },
      { ids: "LEAF_SLIME_S+TWIG_SLIME_S+SLITHERING_STRANGLER", probability: 1 / 12 },
      { ids: "TWIG_SLIME_S+LEAF_SLIME_S+SLITHERING_STRANGLER", probability: 1 / 12 },
      { ids: "TWIG_SLIME_S+TWIG_SLIME_S+SLITHERING_STRANGLER", probability: 1 / 12 },
    ],
  );
  assert.ok(
    getRelatedEncounterIdsForMonster("TWIG_SLIME_S", encounters).includes(strangler.id),
    "a composition candidate must reverse-reference its encounter",
  );

  const queen = getEncounter(encounters, "QUEEN_BOSS");
  assert.ok(queen.scene, "Queen boss must load its custom scene");
  assert.equal(queen.scene.ambientVfx.kind, "queen");
  assert.equal(queen.scene.backgroundSpineAsset?.idleAnimation, "animation");
  assert.equal(queen.scene.combatLayout.cameraScaling, 0.9);
  assert.deepEqual(queen.scene.combatLayout.cameraOffset, { x: 0, y: 60 });
  assert.deepEqual(
    queen.scene.monsterSlots.map((slot) => [slot.slotName, slot.sourcePosition.x, slot.sourcePosition.y]),
    [
      ["amalgam", 1207, 709],
      ["queen", 1606, 695],
    ],
  );

  const fabricator = getEncounter(encounters, "FABRICATOR_NORMAL");
  assert.equal(expandEncounterFormations(fabricator)[0]?.monsters[0]?.slotName, "fabricator");
  assert.ok(fabricator.scene?.monsterSlots.some((slot) => slot.slotName === "fabricator"));

  const monsters = await getCodexMonsters({ gameLocale: "kor" });
  const monsterById = new Map(monsters.map((monster) => [monster.id, monster]));
  const encounterMonsterIds = new Set(
    encounters.filter((encounter) => encounter.compositions?.length).flatMap((encounter) => (
      expandEncounterFormations(encounter).flatMap(
        (formation) => formation.monsters.map((monster) => monster.id),
      )
    )),
  );
  assert.equal(encounterMonsterIds.size, 96);
  for (const monsterId of encounterMonsterIds) {
    const monster = monsterById.get(monsterId);
    assert.ok(monster?.spineAsset, `${monsterId} must render through an idle Spine asset`);
    assert.ok(monster.spineAsset.idleAnimation, `${monsterId} must have an idle animation`);
  }

  const characters = await getCodexCharacters({ gameLocale: "kor" });
  assert.equal(characters.length, 5);
  for (const character of characters) {
    assert.ok(character.spineAsset, `${character.id} must render through a Spine asset`);
    assert.ok(character.spineAsset.idleAnimation, `${character.id} must have an idle animation`);
  }

  console.log("Encounter composition and scene assertions passed.");
}

function encounterCountsByFormationCount(
  encounters: Awaited<ReturnType<typeof getCodexEncounters>>,
): Array<[number, number]> {
  const counts = new Map<number, number>();
  for (const encounter of encounters) {
    const count = expandEncounterFormations(encounter).length;
    if (count < 1) continue;
    counts.set(count, (counts.get(count) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => a[0] - b[0]);
}

function getEncounter(
  encounters: Awaited<ReturnType<typeof getCodexEncounters>>,
  id: string,
) {
  const encounter = encounters.find((candidate) => candidate.id === id);
  assert.ok(encounter, `${id} must exist`);
  return encounter;
}

function formationCount(
  encounters: Awaited<ReturnType<typeof getCodexEncounters>>,
  id: string,
): number {
  return expandEncounterFormations(getEncounter(encounters, id)).length;
}

void main();

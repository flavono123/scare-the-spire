import assert from "node:assert/strict";
import {
  COMBO_KEYWORD_IMAGE_URL,
  getComboEncounterMonsterIds,
  getComboEncounterNodeImageUrl,
} from "../src/lib/combo-resource-visuals";
import type { CodexEncounter } from "../src/lib/codex-types";

const encounter = {
  act: "Act 1 - Overgrowth",
  roomType: "Monster",
  monsters: [
    { id: "FALLBACK_A" },
    { id: "FALLBACK_B" },
  ],
  scene: {
    combatLayout: {
      monsters: [
        { monsterId: "SCENE_A" },
        { monsterId: "SCENE_B" },
        { monsterId: "SCENE_C" },
      ],
    },
  },
} as CodexEncounter;

assert.equal(
  getComboEncounterNodeImageUrl(encounter),
  "/images/sts2/map/icons-by-act/overgrowth/map_monster.png",
);
assert.equal(
  getComboEncounterNodeImageUrl({ act: null, roomType: "Elite" }),
  "/images/sts2/map/icons/map_elite.png",
);
assert.deepEqual(
  getComboEncounterMonsterIds(encounter),
  ["SCENE_A", "SCENE_B"],
);
assert.deepEqual(
  getComboEncounterMonsterIds({ monsters: encounter.monsters, scene: null }),
  ["FALLBACK_A", "FALLBACK_B"],
);
assert.equal(
  COMBO_KEYWORD_IMAGE_URL,
  "/images/sts2/ui/topbar/submenu_history_icon.png",
);

console.log("Combo resource visual tests passed.");

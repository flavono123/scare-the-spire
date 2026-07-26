import type { CodexEncounter, EncounterRoomType, EventAct } from "@/lib/codex-types";

const ENCOUNTER_ACT_ICON_DIRECTORY: Partial<Record<EventAct, string>> = {
  "Act 1 - Overgrowth": "overgrowth",
  Underdocks: "underdocks",
  "Act 2 - Hive": "hive",
  "Act 3 - Glory": "glory",
};

const ENCOUNTER_ROOM_ICON_NAME: Record<EncounterRoomType, string> = {
  Monster: "map_monster",
  Elite: "map_elite",
  Boss: "map_chest_boss",
};

export const COMBO_KEYWORD_IMAGE_URL =
  "/images/sts2/ui/topbar/submenu_history_icon.png";

export function getComboEncounterNodeImageUrl(
  encounter: Pick<CodexEncounter, "act" | "roomType">,
): string {
  const iconName = ENCOUNTER_ROOM_ICON_NAME[encounter.roomType];
  const actDirectory = encounter.act
    ? ENCOUNTER_ACT_ICON_DIRECTORY[encounter.act]
    : undefined;

  return actDirectory
    ? `/images/sts2/map/icons-by-act/${actDirectory}/${iconName}.png`
    : `/images/sts2/map/icons/${iconName}.png`;
}

export function getComboEncounterMonsterIds(
  encounter: Pick<CodexEncounter, "monsters" | "scene">,
  limit = 2,
): string[] {
  const sceneMonsterIds = encounter.scene?.combatLayout.monsters.map(
    (monster) => monster.monsterId,
  ) ?? [];
  const monsterIds = sceneMonsterIds.length > 0
    ? sceneMonsterIds
    : encounter.monsters.map((monster) => monster.id);

  return monsterIds.slice(0, Math.max(0, limit));
}

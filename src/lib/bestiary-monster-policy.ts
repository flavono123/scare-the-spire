import type { EventAct, MonsterType } from "@/lib/codex-types";

export type BestiaryDevMonsterGroupId =
  | "pet"
  | "minion"
  | "suspect"
  | "npc"
  | "merged-phase";

export interface BestiaryDevMonsterGroup {
  id: BestiaryDevMonsterGroupId;
  label: string;
  description: string;
  monsterIds: string[];
  publicTreatment: "dev-only" | "forced-act";
}

export const BESTIARY_FORCED_ACTS: Record<string, EventAct> = {
  PARAFRIGHT: "Act 2 - Hive",
  GUARDBOT: "Act 3 - Glory",
  NOISEBOT: "Act 3 - Glory",
  STABBOT: "Act 3 - Glory",
  ZAPBOT: "Act 3 - Glory",
};

export const BESTIARY_TYPE_OVERRIDES: Record<string, MonsterType> = {
  AEONGLASS: "Boss",
};

export const BESTIARY_PLACEHOLDER_ART_MONSTER_IDS = new Set([
  "GAS_BOMB",
  "LIVING_FOG",
  "THE_FORGOTTEN",
]);

export const BESTIARY_DEV_MONSTER_GROUPS: BestiaryDevMonsterGroup[] = [
  {
    id: "pet",
    label: "아군/펫",
    description: "플레이어 편으로 보이거나 별도 시스템에서 다룰 대상입니다.",
    monsterIds: ["OSTY", "BYRDPIP", "PAELS_LEGION"],
    publicTreatment: "dev-only",
  },
  {
    id: "minion",
    label: "하수인",
    description: "전투 중 소환되는 하수인입니다. 공개 인덱스에는 소환자 막으로 보정합니다.",
    monsterIds: ["PARAFRIGHT", "GUARDBOT", "NOISEBOT", "STABBOT", "ZAPBOT"],
    publicTreatment: "forced-act",
  },
  {
    id: "suspect",
    label: "잘못 추출/미구현 추정",
    description: "베타, mimic, 폐기, 내부 페이즈, 또는 잘못 분리된 것으로 보여 공개 도감에서 숨깁니다.",
    monsterIds: [
      "BATTLE_FRIEND_V1",
      "BATTLE_FRIEND_V2",
      "BATTLE_FRIEND_V3",
      "BYRDONIS_NEST",
      "COCOON",
      "GAZING_MOTH",
      "GEM_EATER",
      "MYSTERIOUS_KNIGHT",
      "THE_ADVERSARY_MK_ONE",
      "THE_ADVERSARY_MK_TWO",
      "THE_ADVERSARY_MK_THREE",
      "THE_ARM",
      "THE_BELL",
      "THE_DREAMER",
    ],
    publicTreatment: "dev-only",
  },
  {
    id: "npc",
    label: "NPC",
    description: "전투 도감이 아니라 별도 등장 인물/이벤트 페이지 후보입니다.",
    monsterIds: ["ARCHITECT", "FAKE_MERCHANT_MONSTER"],
    publicTreatment: "dev-only",
  },
  {
    id: "merged-phase",
    label: "합쳐질 보스 페이즈",
    description: "단독 몬스터가 아니라 보스 아트/페이즈로 합쳐야 하는 대상입니다.",
    monsterIds: ["DOOR"],
    publicTreatment: "dev-only",
  },
];

const DEV_ONLY_MONSTER_IDS = new Set(
  BESTIARY_DEV_MONSTER_GROUPS
    .filter((group) => group.publicTreatment === "dev-only")
    .flatMap((group) => group.monsterIds),
);

export function isPublicBestiaryMonster(monsterId: string): boolean {
  return !DEV_ONLY_MONSTER_IDS.has(monsterId);
}

export function getForcedBestiaryAct(monsterId: string): EventAct | null {
  return BESTIARY_FORCED_ACTS[monsterId] ?? null;
}

export function getBestiaryDisplayMonsterType(monsterId: string, fallback: MonsterType): MonsterType {
  return BESTIARY_TYPE_OVERRIDES[monsterId] ?? fallback;
}

export function hasPlaceholderBestiaryArt(monsterId: string): boolean {
  return BESTIARY_PLACEHOLDER_ART_MONSTER_IDS.has(monsterId);
}

export function getBestiaryDevMonsterGroup(monsterId: string): BestiaryDevMonsterGroup | null {
  return BESTIARY_DEV_MONSTER_GROUPS.find((group) => group.monsterIds.includes(monsterId)) ?? null;
}

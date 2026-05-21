import type {
  CardRarityKo,
  CardTypeKo,
  CodexAncient,
  CodexEncounter,
  CodexPotion,
  PotionRarityKo,
} from "./codex-types";

export const FUTURE_OF_POTIONS_EVENT_ID = "THE_FUTURE_OF_POTIONS";
export const FUTURE_OF_POTIONS_EVENT_NAME_KO = "포션의 미래?";
export const FUTURE_OF_POTIONS_EVENT_PATH = "/compendium/events/the_future_of_potions";

export const TINKER_TIME_EVENT_ID = "TINKER_TIME";
export const TINKER_TIME_EVENT_NAME_KO = "땜질 시간";
export const TINKER_TIME_EVENT_PATH = "/compendium/events/tinker_time";

export type FuturePotionCardRarity = Extract<CardRarityKo, "일반" | "고급" | "희귀">;
export type FuturePotionCardType = Extract<CardTypeKo, "공격" | "스킬" | "파워">;

export type FuturePotionChoiceId =
  | "POTION_COMMON_ATTACK"
  | "POTION_COMMON_SKILL"
  | "POTION_UNCOMMON_ATTACK"
  | "POTION_UNCOMMON_SKILL"
  | "POTION_UNCOMMON_POWER"
  | "POTION_RARE_ATTACK"
  | "POTION_RARE_SKILL"
  | "POTION_RARE_POWER"
  | "POTION_EVENT_ATTACK"
  | "POTION_EVENT_SKILL"
  | "POTION_EVENT_POWER"
  | "POTION_TOKEN_ATTACK"
  | "POTION_TOKEN_SKILL";

export type FuturePotionOutcomeId =
  | "COMMON_ATTACK"
  | "COMMON_SKILL"
  | "UNCOMMON_ATTACK"
  | "UNCOMMON_SKILL"
  | "UNCOMMON_POWER"
  | "RARE_ATTACK"
  | "RARE_SKILL"
  | "RARE_POWER";

export interface FuturePotionChoice {
  id: FuturePotionChoiceId;
  potionRarity: PotionRarityKo;
  cardRarity: FuturePotionCardRarity;
  cardType: FuturePotionCardType;
  title: string;
  description: string;
}

export interface FuturePotionOutcome {
  id: FuturePotionOutcomeId;
  cardRarity: FuturePotionCardRarity;
  cardType: FuturePotionCardType;
  potionRarities: readonly PotionRarityKo[];
  choiceIds: readonly FuturePotionChoiceId[];
}

export const FUTURE_OF_POTIONS_CHOICES: readonly FuturePotionChoice[] = [
  {
    id: "POTION_COMMON_ATTACK",
    potionRarity: "일반",
    cardRarity: "일반",
    cardType: "공격",
    title: "일반 포션: 공격 카드",
    description: "[gold]일반 포션[/gold]을(를) 잃습니다. [gold]강화[/gold]된 [gold]일반 공격[/gold] 카드를 얻습니다.",
  },
  {
    id: "POTION_COMMON_SKILL",
    potionRarity: "일반",
    cardRarity: "일반",
    cardType: "스킬",
    title: "일반 포션: 스킬 카드",
    description: "[gold]일반 포션[/gold]을(를) 잃습니다. [gold]강화[/gold]된 [gold]일반 스킬[/gold] 카드를 얻습니다.",
  },
  {
    id: "POTION_UNCOMMON_ATTACK",
    potionRarity: "고급",
    cardRarity: "고급",
    cardType: "공격",
    title: "고급 포션: 공격 카드",
    description: "[gold]고급 포션[/gold]을(를) 잃습니다. [gold]강화[/gold]된 [gold]고급 공격[/gold] 카드를 얻습니다.",
  },
  {
    id: "POTION_UNCOMMON_SKILL",
    potionRarity: "고급",
    cardRarity: "고급",
    cardType: "스킬",
    title: "고급 포션: 스킬 카드",
    description: "[gold]고급 포션[/gold]을(를) 잃습니다. [gold]강화[/gold]된 [gold]고급 스킬[/gold] 카드를 얻습니다.",
  },
  {
    id: "POTION_UNCOMMON_POWER",
    potionRarity: "고급",
    cardRarity: "고급",
    cardType: "파워",
    title: "고급 포션: 파워 카드",
    description: "[gold]고급 포션[/gold]을(를) 잃습니다. [gold]강화[/gold]된 [gold]고급 파워[/gold] 카드를 얻습니다.",
  },
  {
    id: "POTION_RARE_ATTACK",
    potionRarity: "희귀",
    cardRarity: "희귀",
    cardType: "공격",
    title: "희귀 포션: 공격 카드",
    description: "[gold]희귀 포션[/gold]을(를) 잃습니다. [gold]강화[/gold]된 [gold]희귀 공격[/gold] 카드를 얻습니다.",
  },
  {
    id: "POTION_RARE_SKILL",
    potionRarity: "희귀",
    cardRarity: "희귀",
    cardType: "스킬",
    title: "희귀 포션: 스킬 카드",
    description: "[gold]희귀 포션[/gold]을(를) 잃습니다. [gold]강화[/gold]된 [gold]희귀 스킬[/gold] 카드를 얻습니다.",
  },
  {
    id: "POTION_RARE_POWER",
    potionRarity: "희귀",
    cardRarity: "희귀",
    cardType: "파워",
    title: "희귀 포션: 파워 카드",
    description: "[gold]희귀 포션[/gold]을(를) 잃습니다. [gold]강화[/gold]된 [gold]희귀 파워[/gold] 카드를 얻습니다.",
  },
  {
    id: "POTION_EVENT_ATTACK",
    potionRarity: "이벤트",
    cardRarity: "희귀",
    cardType: "공격",
    title: "이벤트 포션: 공격 카드",
    description: "[gold]이벤트 포션[/gold]을(를) 잃습니다. [gold]강화[/gold]된 [gold]희귀 공격[/gold] 카드를 얻습니다.",
  },
  {
    id: "POTION_EVENT_SKILL",
    potionRarity: "이벤트",
    cardRarity: "희귀",
    cardType: "스킬",
    title: "이벤트 포션: 스킬 카드",
    description: "[gold]이벤트 포션[/gold]을(를) 잃습니다. [gold]강화[/gold]된 [gold]희귀 스킬[/gold] 카드를 얻습니다.",
  },
  {
    id: "POTION_EVENT_POWER",
    potionRarity: "이벤트",
    cardRarity: "희귀",
    cardType: "파워",
    title: "이벤트 포션: 파워 카드",
    description: "[gold]이벤트 포션[/gold]을(를) 잃습니다. [gold]강화[/gold]된 [gold]희귀 파워[/gold] 카드를 얻습니다.",
  },
  {
    id: "POTION_TOKEN_ATTACK",
    potionRarity: "토큰",
    cardRarity: "일반",
    cardType: "공격",
    title: "토큰 포션: 공격 카드",
    description: "[gold]토큰 포션[/gold]을(를) 잃습니다. [gold]강화[/gold]된 [gold]일반 공격[/gold] 카드를 얻습니다.",
  },
  {
    id: "POTION_TOKEN_SKILL",
    potionRarity: "토큰",
    cardRarity: "일반",
    cardType: "스킬",
    title: "토큰 포션: 스킬 카드",
    description: "[gold]토큰 포션[/gold]을(를) 잃습니다. [gold]강화[/gold]된 [gold]일반 스킬[/gold] 카드를 얻습니다.",
  },
];

export const FUTURE_OF_POTIONS_OUTCOMES: readonly FuturePotionOutcome[] = [
  {
    id: "COMMON_ATTACK",
    cardRarity: "일반",
    cardType: "공격",
    potionRarities: ["일반", "토큰"],
    choiceIds: ["POTION_COMMON_ATTACK", "POTION_TOKEN_ATTACK"],
  },
  {
    id: "COMMON_SKILL",
    cardRarity: "일반",
    cardType: "스킬",
    potionRarities: ["일반", "토큰"],
    choiceIds: ["POTION_COMMON_SKILL", "POTION_TOKEN_SKILL"],
  },
  {
    id: "UNCOMMON_ATTACK",
    cardRarity: "고급",
    cardType: "공격",
    potionRarities: ["고급"],
    choiceIds: ["POTION_UNCOMMON_ATTACK"],
  },
  {
    id: "UNCOMMON_SKILL",
    cardRarity: "고급",
    cardType: "스킬",
    potionRarities: ["고급"],
    choiceIds: ["POTION_UNCOMMON_SKILL"],
  },
  {
    id: "UNCOMMON_POWER",
    cardRarity: "고급",
    cardType: "파워",
    potionRarities: ["고급"],
    choiceIds: ["POTION_UNCOMMON_POWER"],
  },
  {
    id: "RARE_ATTACK",
    cardRarity: "희귀",
    cardType: "공격",
    potionRarities: ["희귀", "이벤트"],
    choiceIds: ["POTION_RARE_ATTACK", "POTION_EVENT_ATTACK"],
  },
  {
    id: "RARE_SKILL",
    cardRarity: "희귀",
    cardType: "스킬",
    potionRarities: ["희귀", "이벤트"],
    choiceIds: ["POTION_RARE_SKILL", "POTION_EVENT_SKILL"],
  },
  {
    id: "RARE_POWER",
    cardRarity: "희귀",
    cardType: "파워",
    potionRarities: ["희귀", "이벤트"],
    choiceIds: ["POTION_RARE_POWER", "POTION_EVENT_POWER"],
  },
];

export function formatFuturePotionOutcome(outcome: Pick<FuturePotionOutcome, "cardRarity" | "cardType">): string {
  return `강화된 ${outcome.cardRarity} ${outcome.cardType} 카드를 얻습니다.`;
}

export function getFuturePotionChoicesForPotion(
  potion: Pick<CodexPotion, "rarity">,
): readonly FuturePotionChoice[] {
  return FUTURE_OF_POTIONS_CHOICES.filter((choice) => choice.potionRarity === potion.rarity);
}

export function getFuturePotionOutcomeIdsForPotion(
  potion: Pick<CodexPotion, "rarity">,
): FuturePotionOutcomeId[] {
  return FUTURE_OF_POTIONS_OUTCOMES
    .filter((outcome) => outcome.potionRarities.includes(potion.rarity))
    .map((outcome) => outcome.id);
}

export function getFuturePotionChoiceById(id: string): FuturePotionChoice | null {
  return FUTURE_OF_POTIONS_CHOICES.find((choice) => choice.id === id) ?? null;
}

export const EVENT_RELATED_CARD_IDS = {
  AMALGAMATOR: ["ULTIMATE_STRIKE", "ULTIMATE_DEFEND"],
  BUGSLAYER: ["EXTERMINATE", "SQUASH"],
  BYRDONIS_NEST: ["BYRDONIS_EGG"],
  CRYSTAL_SPHERE: ["DEBT"],
  ENDLESS_CONVEYOR: ["FEEDING_FRENZY"],
  FIELD_OF_MAN_SIZED_HOLES: ["NORMALITY"],
  GRAVE_OF_THE_FORGOTTEN: ["DECAY"],
  LOST_WISP: ["DECAY"],
  LUMINOUS_CHOIR: ["SPORE_MIND"],
  PUNCH_OFF: ["INJURY"],
  REFLECTIONS: ["BAD_LUCK"],
  SUNKEN_TREASURY: ["GREED"],
  SPIRIT_GRAFTER: ["METAMORPHOSIS"],
  THE_LANTERN_KEY: ["LANTERN_KEY"],
  THE_LEGENDS_WERE_TRUE: ["SPOILS_MAP"],
  THIS_OR_THAT: ["CLUMSY"],
  TRASH_HEAP: [
    "CALTROPS",
    "CLASH",
    "DISTRACTION",
    "DUAL_WIELD",
    "ENTRENCH",
    "HELLO_WORLD",
    "OUTMANEUVER",
    "REBOUND",
    "RIP_AND_TEAR",
    "STACK",
  ],
  TRIAL: ["REGRET", "SHAME", "DOUBT"],
  UNREST_SITE: ["POOR_SLEEP"],
  WELLSPRING: ["GUILTY"],
  WOOD_CARVINGS: ["PECK", "TORIC_TOUGHNESS"],
  ZEN_WEAVER: ["ENLIGHTENMENT"],
} as const satisfies Record<string, readonly string[]>;

export const EVENT_RELATED_RELIC_IDS = {
  COLORFUL_PHILOSOPHERS: ["PRISMATIC_GEM"],
  COLOSSAL_FLOWER: ["POLLINOUS_CORE"],
  DOLL_ROOM: ["DAUGHTER_OF_THE_WIND", "MR_STRUGGLES", "BING_BONG"],
  DROWNING_BEACON: ["FRESNEL_LENS"],
  FAKE_MERCHANT: [
    "FAKE_ANCHOR",
    "FAKE_BLOOD_VIAL",
    "FAKE_HAPPY_FLOWER",
    "FAKE_LEES_WAFFLE",
    "FAKE_MANGO",
    "FAKE_ORICHALCUM",
    "FAKE_SNECKO_EYE",
    "FAKE_STRIKE_DUMMY",
    "FAKE_VENERABLE_TEA_SET",
    "FAKE_MERCHANTS_RUG",
  ],
  GRAVE_OF_THE_FORGOTTEN: ["FORGOTTEN_SOUL"],
  HUNGRY_FOR_MUSHROOMS: ["BIG_MUSHROOM", "FRAGRANT_MUSHROOM"],
  LOST_WISP: ["LOST_WISP"],
  ROOM_FULL_OF_CHEESE: ["CHOSEN_CHEESE"],
  ROUND_TEA_PARTY: ["ROYAL_POISON"],
  SUNKEN_STATUE: ["SWORD_OF_STONE"],
  TEA_MASTER: ["BONE_TEA", "EMBER_TEA", "TEA_OF_DISCOURTESY"],
  TRASH_HEAP: ["DARKSTONE_PERIAPT", "DREAM_CATCHER", "HAND_DRILL", "MAW_BANK", "THE_BOOT"],
  WAR_HISTORIAN_REPY: ["HISTORY_COURSE"],
  WELCOME_TO_WONGOS: ["WONGO_CUSTOMER_APPRECIATION_BADGE", "WONGOS_MYSTERY_TICKET"],
} as const satisfies Record<string, readonly string[]>;

export const EVENT_RELATED_POTION_IDS = {
  DROWNING_BEACON: ["GLOWWATER_POTION"],
  POTION_COURIER: ["FOUL_POTION"],
} as const satisfies Record<string, readonly string[]>;

export function getRelatedCardIdsForEvent(eventId: string): readonly string[] {
  return (EVENT_RELATED_CARD_IDS as Record<string, readonly string[]>)[eventId] ?? [];
}

export function getRelatedRelicIdsForEvent(eventId: string): readonly string[] {
  return (EVENT_RELATED_RELIC_IDS as Record<string, readonly string[]>)[eventId] ?? [];
}

export function getRelatedPotionIdsForEvent(eventId: string): readonly string[] {
  return (EVENT_RELATED_POTION_IDS as Record<string, readonly string[]>)[eventId] ?? [];
}

export function getRelatedEventIdsForCard(cardId: string): readonly string[] {
  return invertEventRelations(EVENT_RELATED_CARD_IDS, cardId);
}

export function getRelatedEventIdsForRelic(relicId: string): readonly string[] {
  return invertEventRelations(EVENT_RELATED_RELIC_IDS, relicId);
}

export function getRelatedEventIdsForPotion(potionId: string): readonly string[] {
  return invertEventRelations(EVENT_RELATED_POTION_IDS, potionId);
}

export function getRelatedAncientIdsForRelic(
  relicId: string,
  ancients: readonly Pick<CodexAncient, "id" | "relicIds">[],
): string[] {
  const normalizedRelicId = relicId.toUpperCase();
  return ancients
    .filter((ancient) => ancient.relicIds.some((id) => id.toUpperCase() === normalizedRelicId))
    .map((ancient) => ancient.id);
}

export function getRelatedEncounterIdsForMonster(
  monsterId: string,
  encounters: readonly Pick<CodexEncounter, "id" | "monsters">[],
): string[] {
  const normalizedMonsterId = monsterId.toUpperCase();
  return encounters
    .filter((encounter) =>
      encounter.monsters.some((monster) => monster.id.toUpperCase() === normalizedMonsterId),
    )
    .map((encounter) => encounter.id);
}

export function getRelatedMonsterIdsForEncounter(
  encounter: Pick<CodexEncounter, "monsters">,
): string[] {
  const seen = new Set<string>();
  const monsterIds: string[] = [];

  for (const monster of encounter.monsters) {
    const normalizedMonsterId = monster.id.toUpperCase();
    if (seen.has(normalizedMonsterId)) continue;
    seen.add(normalizedMonsterId);
    monsterIds.push(monster.id);
  }

  return monsterIds;
}

function invertEventRelations(
  relations: Record<string, readonly string[]>,
  entityId: string,
): string[] {
  const normalizedEntityId = entityId.toUpperCase();
  return Object.entries(relations)
    .filter(([, ids]) => ids.some((id) => id.toUpperCase() === normalizedEntityId))
    .map(([eventId]) => eventId);
}

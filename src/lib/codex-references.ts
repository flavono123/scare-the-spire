import type {
  CardRarityKo,
  CardTypeKo,
  CodexAncient,
  CodexCard,
  CodexEnchantment,
  CodexEncounter,
  CodexEvent,
  CodexPotion,
  CodexRelic,
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

export const EVENT_RELATED_ENCHANTMENT_IDS = {
  FIELD_OF_MAN_SIZED_HOLES: ["PERFECT_FIT"],
  GRAVE_OF_THE_FORGOTTEN: ["SOULS_POWER"],
  SAPPHIRE_SEED: ["SOWN"],
  SELF_HELP_BOOK: ["NIMBLE", "SHARP", "SWIFT"],
  SPIRALING_WHIRLPOOL: ["SPIRAL"],
  STONE_OF_ALL_TIME: ["VIGOROUS"],
  SYMBIOTE: ["CORRUPTED"],
  WATERLOGGED_SCRIPTORIUM: ["STEADY"],
  WOOD_CARVINGS: ["SLITHER"],
} as const satisfies Record<string, readonly string[]>;

export const CARD_RELATED_ENCHANTMENT_IDS = {
  BLADE_OF_INK: ["INKY"],
} as const satisfies Record<string, readonly string[]>;

export const RELIC_RELATED_ENCHANTMENT_IDS = {} as const satisfies Record<string, readonly string[]>;

export const POTION_RELATED_CARD_IDS = {
  CUNNING_POTION: ["SHIV"],
  POT_OF_GHOULS: ["SOUL"],
  SOLDIERS_STEW: [
    "STRIKE_DEFECT",
    "STRIKE_IRONCLAD",
    "STRIKE_NECROBINDER",
    "STRIKE_REGENT",
    "STRIKE_SILENT",
  ],
} as const satisfies Record<string, readonly string[]>;

export const POTION_RELATED_POWER_IDS = {
  DEXTERITY_POTION: ["DEXTERITY"],
  FLEX_POTION: ["STRENGTH"],
  FOCUS_POTION: ["FOCUS"],
  FYSH_OIL: ["STRENGTH", "DEXTERITY"],
  GHOST_IN_A_JAR: ["INTANGIBLE"],
  HEART_OF_IRON: ["PLATING"],
  LIQUID_BRONZE: ["THORNS"],
  LUCKY_TONIC: ["BUFFER"],
  MAZALETHS_GIFT: ["RITUAL"],
  POISON_POTION: ["POISON"],
  POTION_OF_BINDING: ["WEAK", "VULNERABLE"],
  POTION_OF_DOOM: ["DOOM"],
  REGEN_POTION: ["REGEN"],
  SHACKLING_POTION: ["STRENGTH"],
  SPEED_POTION: ["DEXTERITY"],
  STRENGTH_POTION: ["STRENGTH"],
  VULNERABLE_POTION: ["VULNERABLE"],
  WEAK_POTION: ["WEAK"],
} as const satisfies Record<string, readonly string[]>;

export const POTION_RELATED_ENCHANTMENT_IDS = {} as const satisfies Record<string, readonly string[]>;

export function getRelatedCardIdsForEvent(eventId: string): readonly string[] {
  return (EVENT_RELATED_CARD_IDS as Record<string, readonly string[]>)[eventId] ?? [];
}

export function getRelatedRelicIdsForEvent(eventId: string): readonly string[] {
  return (EVENT_RELATED_RELIC_IDS as Record<string, readonly string[]>)[eventId] ?? [];
}

export function getRelatedPotionIdsForEvent(eventId: string): readonly string[] {
  return (EVENT_RELATED_POTION_IDS as Record<string, readonly string[]>)[eventId] ?? [];
}

export function getRelatedEnchantmentIdsForEvent(eventId: string): readonly string[] {
  return (EVENT_RELATED_ENCHANTMENT_IDS as Record<string, readonly string[]>)[eventId] ?? [];
}

export function getRelatedEnchantmentIdsForCard(cardId: string): readonly string[] {
  return (CARD_RELATED_ENCHANTMENT_IDS as Record<string, readonly string[]>)[cardId] ?? [];
}

export function getRelatedEnchantmentIdsForPotion(potionId: string): readonly string[] {
  return (POTION_RELATED_ENCHANTMENT_IDS as Record<string, readonly string[]>)[potionId] ?? [];
}

export function getRelatedCardIdsForPotion(potionId: string): readonly string[] {
  return (POTION_RELATED_CARD_IDS as Record<string, readonly string[]>)[potionId] ?? [];
}

export function getRelatedPowerIdsForPotion(potionId: string): readonly string[] {
  return (POTION_RELATED_POWER_IDS as Record<string, readonly string[]>)[potionId] ?? [];
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

export function getRelatedEventIdsForEnchantment(enchantmentId: string): readonly string[] {
  return invertEventRelations(EVENT_RELATED_ENCHANTMENT_IDS, enchantmentId);
}

export function getRelatedCardIdsForEnchantment(enchantmentId: string): readonly string[] {
  return invertEventRelations(CARD_RELATED_ENCHANTMENT_IDS, enchantmentId);
}

export function getRelatedPotionIdsForEnchantment(enchantmentId: string): readonly string[] {
  return invertEventRelations(POTION_RELATED_ENCHANTMENT_IDS, enchantmentId);
}

export function getRelatedPotionIdsForCard(cardId: string): readonly string[] {
  return invertEventRelations(POTION_RELATED_CARD_IDS, cardId);
}

export function getRelatedPotionIdsForPower(powerId: string): readonly string[] {
  return invertEventRelations(POTION_RELATED_POWER_IDS, powerId);
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

export function getRelatedRelicIdsForAncient(
  ancient: Pick<CodexAncient, "relicIds">,
): string[] {
  return dedupeIds(ancient.relicIds);
}

export function getRelatedCardIdsForAncient(
  ancient: AncientRelationSource,
  cards: readonly AncientCardRelationTarget[],
): string[] {
  return cards
    .filter((card) => isAncientCard(card) || resourceMentionsAncient(cardText(card), ancient))
    .map((card) => card.id);
}

export function getRelatedAncientIdsForCard(
  card: AncientCardRelationTarget,
  ancients: readonly AncientRelationSource[],
): string[] {
  return ancients
    .filter((ancient) => isAncientCard(card) || resourceMentionsAncient(cardText(card), ancient))
    .map((ancient) => ancient.id);
}

export function getRelatedPotionIdsForAncient(
  ancient: AncientRelationSource,
  potions: readonly AncientPotionRelationTarget[],
): string[] {
  return potions
    .filter((potion) => resourceMentionsAncient(potionText(potion), ancient))
    .map((potion) => potion.id);
}

export function getRelatedAncientIdsForPotion(
  potion: AncientPotionRelationTarget,
  ancients: readonly AncientRelationSource[],
): string[] {
  return ancients
    .filter((ancient) => resourceMentionsAncient(potionText(potion), ancient))
    .map((ancient) => ancient.id);
}

export function getRelatedEventIdsForAncient(
  ancient: AncientRelationSource,
  events: readonly AncientEventRelationTarget[],
): string[] {
  return events
    .filter((event) => resourceMentionsAncient(eventText(event), ancient))
    .map((event) => event.id);
}

export function getRelatedAncientIdsForEvent(
  event: AncientEventRelationTarget,
  ancients: readonly AncientRelationSource[],
): string[] {
  return ancients
    .filter((ancient) => resourceMentionsAncient(eventText(event), ancient))
    .map((ancient) => ancient.id);
}

export function relicMentionsEnchantment(
  relic: Pick<CodexRelic, "description" | "descriptionRaw">,
  enchantment: Pick<CodexEnchantment, "name" | "nameEn">,
): boolean {
  const desc = `${relic.description ?? ""} ${relic.descriptionRaw ?? ""}`;
  if (enchantment.name && desc.includes(enchantment.name)) return true;
  if (enchantment.nameEn && desc.toLowerCase().includes(enchantment.nameEn.toLowerCase())) return true;
  return false;
}

export function getRelatedEnchantmentIdsForRelic(
  relic: Pick<CodexRelic, "id" | "description" | "descriptionRaw">,
  enchantments: readonly Pick<CodexEnchantment, "id" | "name" | "nameEn">[],
): string[] {
  return dedupeIds([
    ...((RELIC_RELATED_ENCHANTMENT_IDS as Record<string, readonly string[]>)[relic.id] ?? []),
    ...enchantments
    .filter((enchantment) => relicMentionsEnchantment(relic, enchantment))
    .map((enchantment) => enchantment.id),
  ]);
}

export function getRelatedRelicIdsForEnchantment(
  enchantmentId: string,
  relics: readonly Pick<CodexRelic, "id" | "description" | "descriptionRaw">[],
  enchantments: readonly Pick<CodexEnchantment, "id" | "name" | "nameEn">[],
): string[] {
  const normalizedEnchantmentId = enchantmentId.toUpperCase();
  return relics
    .filter((relic) =>
      getRelatedEnchantmentIdsForRelic(relic, enchantments)
        .some((id) => id.toUpperCase() === normalizedEnchantmentId),
    )
    .map((relic) => relic.id);
}

export function getRelatedPowerIdsForCard(card: Pick<CodexCard, "appliedPowerIds">): readonly string[] {
  return card.appliedPowerIds;
}

export function getRelatedPowerIdsForRelic(relic: Pick<CodexRelic, "vars">): string[] {
  return getPowerIdsFromVars(relic.vars);
}

export function getRelatedCardIdsForPower(
  cards: readonly Pick<CodexCard, "id" | "appliedPowerIds">[],
  powerId: string,
): readonly string[] {
  const normalizedPowerId = powerId.toUpperCase();
  return cards
    .filter((card) => card.appliedPowerIds.some((id) => id.toUpperCase() === normalizedPowerId))
    .map((card) => card.id);
}

export function getRelatedRelicIdsForPower(
  relics: readonly Pick<CodexRelic, "id" | "vars">[],
  powerId: string,
): readonly string[] {
  const normalizedPowerId = powerId.toUpperCase();
  return relics
    .filter((relic) => getRelatedPowerIdsForRelic(relic).some((id) => id.toUpperCase() === normalizedPowerId))
    .map((relic) => relic.id);
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

function dedupeIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  return ids.filter((id) => {
    const normalizedId = id.toUpperCase();
    if (seen.has(normalizedId)) return false;
    seen.add(normalizedId);
    return true;
  });
}

type AncientRelationSource = Pick<CodexAncient, "id" | "name" | "nameEn" | "epithet" | "epithetEn">;

type AncientCardRelationTarget = Pick<
  CodexCard,
  "id" | "name" | "nameEn" | "description" | "descriptionRaw" | "rarity"
>;

type AncientPotionRelationTarget = Pick<
  CodexPotion,
  "id" | "name" | "nameEn" | "description" | "descriptionRaw"
>;

type AncientEventRelationTarget = Pick<
  CodexEvent,
  "id" | "name" | "nameEn" | "description" | "options" | "pages"
>;

function isAncientCard(card: Pick<CodexCard, "rarity">): boolean {
  return card.rarity === "고대의 존재";
}

function resourceMentionsAncient(text: string, ancient: AncientRelationSource): boolean {
  const haystack = normalizeRelationText(text);
  if (!haystack) return false;
  return ancientRelationNeedles(ancient).some((needle) => haystack.includes(needle));
}

function ancientRelationNeedles(ancient: AncientRelationSource): string[] {
  return compactRelationValues([
    ancient.id,
    ancient.name,
    ancient.nameEn,
    ancient.epithet,
    ancient.epithetEn,
  ]).map(normalizeRelationText);
}

function cardText(card: AncientCardRelationTarget): string {
  return compactRelationValues([
    card.id,
    card.name,
    card.nameEn,
    card.description,
    card.descriptionRaw,
  ]).join(" ");
}

function potionText(potion: AncientPotionRelationTarget): string {
  return compactRelationValues([
    potion.id,
    potion.name,
    potion.nameEn,
    potion.description,
    potion.descriptionRaw,
  ]).join(" ");
}

function eventText(event: AncientEventRelationTarget): string {
  const optionText = event.options?.flatMap((option) => [option.title, option.description]) ?? [];
  const pageText = event.pages?.flatMap((page) => [
    page.description,
    ...(page.options?.flatMap((option) => [option.title, option.description]) ?? []),
  ]) ?? [];

  return compactRelationValues([
    event.id,
    event.name,
    event.nameEn,
    event.description,
    ...optionText,
    ...pageText,
  ]).join(" ");
}

function compactRelationValues(values: readonly (string | null | undefined)[]): string[] {
  return values.filter((value): value is string => Boolean(value && value.trim()));
}

function normalizeRelationText(value: string): string {
  return value.toLocaleLowerCase();
}

function getPowerIdsFromVars(vars: Record<string, unknown> | null | undefined): string[] {
  if (!vars) return [];
  return dedupeIds(Object.keys(vars).flatMap((key) => {
    const powerId = powerVarKeyToId(key);
    return powerId ? [powerId] : [];
  }));
}

function powerVarKeyToId(key: string): string | null {
  if (!key.endsWith("Power")) return null;
  const base = key.slice(0, -"Power".length);
  if (!base) return null;
  return base.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
}

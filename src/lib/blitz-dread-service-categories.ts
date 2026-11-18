/**
 * Groupings this service defines for Blitz shop wares and Dread dominions. The game has no such
 * field (BlitzMerchantEntryType and DominionModel are flat), so like the card "Tarot" service tag
 * they are kept here and read from what each ware or dominion does in the 0.113 source.
 */
import type { BlitzEntryType } from "./node-sim/blitz-merchant";

// Only groupings with two or more wares; a filter that leaves one ware is not a filter.
export const BLITZ_ENTRY_CATEGORIES = ["upgrade", "cardReward", "enchant", "relic"] as const;
export type BlitzEntryCategory = (typeof BLITZ_ENTRY_CATEGORIES)[number];

const BLITZ_CATEGORIES_BY_TYPE: Record<BlitzEntryType, BlitzEntryCategory[]> = {
  CardUpgrade: ["upgrade"],
  UpgradedCardReward: ["cardReward", "upgrade"],
  RandomUpgrades: ["upgrade"],
  CardTransform: [],
  CardRemoval: [],
  CardRewards: ["cardReward"],
  ColorlessCardReward: ["cardReward"],
  Potions: [],
  CardEnchant: ["enchant"],
  EnchantedCardReward: ["cardReward", "enchant"],
  PrismaticCardReward: ["cardReward"],
  RareCardReward: ["cardReward"],
  UpgradedRareCard: ["cardReward", "upgrade"],
  Relic: ["relic"],
  Glam: ["enchant"],
  TwoMoreChoices: [],
  CardRewardOfEachRarity: ["cardReward"],
  UpgradedRareCardReward: ["cardReward", "upgrade"],
  TwoRelics: ["relic"],
  FullHealAndMaxHp: [],
};

export function blitzEntryCategories(type: BlitzEntryType): BlitzEntryCategory[] {
  return BLITZ_CATEGORIES_BY_TYPE[type];
}

export const DOMINION_CATEGORIES = ["enemyBuff", "playerDebuff", "damage", "addStatus"] as const;
export type DominionCategory = (typeof DOMINION_CATEGORIES)[number];

const DOMINION_CATEGORY_BY_ID: Record<string, DominionCategory> = {
  CEREMONIAL_BEAST: "enemyBuff", // Ritual
  KAISER_CRAB: "enemyBuff", // Plating
  TEST_SUBJECT: "enemyBuff", // Strength
  VANTOM: "enemyBuff", // Slippery
  KIN: "playerDebuff", // Weak, Frail
  QUEEN: "playerDebuff", // Weak, Vulnerable, Frail
  LAGAVULIN_MATRIARCH: "playerDebuff", // -Strength, -Dexterity
  // Picks one of two Status cards, but the pick applies its power (Sloth, Amnesia); no card is added.
  KNOWLEDGE_DEMON: "playerDebuff",
  INSATIABLE: "damage", // end-of-turn damage by turn count
  WATERFALL_GIANT: "damage", // enemies explode on death
  AEONGLASS: "addStatus", // Wither (Status) on top of the draw pile each turn
  SOUL_FYSH: "addStatus", // Beckon (Status) into the draw pile each combat
};

export function dominionCategory(id: string): DominionCategory {
  return DOMINION_CATEGORY_BY_ID[id];
}

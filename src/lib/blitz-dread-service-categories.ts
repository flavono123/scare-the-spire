/**
 * Groupings this service defines for Blitz shop wares and Dread dominions. The game has no such
 * field (BlitzMerchantEntryType and DominionModel are flat), so like the card "Tarot" service tag
 * they are kept here and read from what each ware or dominion does in the 0.113 source.
 */
import type { BlitzEntryType } from "./node-sim/blitz-merchant";

export const BLITZ_ENTRY_CATEGORIES = [
  "upgrade",
  "cardReward",
  "enchant",
  "transform",
  "removal",
  "relic",
  "potion",
  "heal",
  "moreWares",
] as const;
export type BlitzEntryCategory = (typeof BLITZ_ENTRY_CATEGORIES)[number];

const BLITZ_CATEGORIES_BY_TYPE: Record<BlitzEntryType, BlitzEntryCategory[]> = {
  CardUpgrade: ["upgrade"],
  UpgradedCardReward: ["cardReward", "upgrade"],
  RandomUpgrades: ["upgrade"],
  CardTransform: ["transform"],
  CardRemoval: ["removal"],
  CardRewards: ["cardReward"],
  ColorlessCardReward: ["cardReward"],
  Potions: ["potion"],
  CardEnchant: ["enchant"],
  EnchantedCardReward: ["cardReward", "enchant"],
  PrismaticCardReward: ["cardReward"],
  RareCardReward: ["cardReward"],
  UpgradedRareCard: ["cardReward", "upgrade"],
  Relic: ["relic"],
  Glam: ["enchant"],
  TwoMoreChoices: ["moreWares"],
  CardRewardOfEachRarity: ["cardReward"],
  UpgradedRareCardReward: ["cardReward", "upgrade"],
  TwoRelics: ["relic"],
  FullHealAndMaxHp: ["heal"],
};

export function blitzEntryCategories(type: BlitzEntryType): BlitzEntryCategory[] {
  return BLITZ_CATEGORIES_BY_TYPE[type];
}

export const DOMINION_CATEGORIES = ["enemyBuff", "playerDebuff", "damage", "addCard"] as const;
export type DominionCategory = (typeof DOMINION_CATEGORIES)[number];

const DOMINION_CATEGORY_BY_ID: Record<string, DominionCategory> = {
  CEREMONIAL_BEAST: "enemyBuff", // Ritual
  KAISER_CRAB: "enemyBuff", // Plating
  TEST_SUBJECT: "enemyBuff", // Strength
  VANTOM: "enemyBuff", // Slippery
  KIN: "playerDebuff", // Weak, Frail
  QUEEN: "playerDebuff", // Weak, Vulnerable, Frail
  LAGAVULIN_MATRIARCH: "playerDebuff", // -Strength, -Dexterity
  INSATIABLE: "damage", // end-of-turn damage by turn count
  WATERFALL_GIANT: "damage", // enemies explode on death
  AEONGLASS: "addCard", // Wither on the draw pile
  SOUL_FYSH: "addCard", // Beckon
  KNOWLEDGE_DEMON: "addCard", // a Dominion curse each combat
};

export function dominionCategory(id: string): DominionCategory {
  return DOMINION_CATEGORY_BY_ID[id];
}

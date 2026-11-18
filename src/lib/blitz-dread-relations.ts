/**
 * Resources each Blitz ware and Dread dominion touches, read from the 0.113 source (the game
 * links them only in code: hover tips, PowerCmd.Apply, card pools). Shown as the detail pages'
 * related-resource rail.
 */
import type { CodexRelatedIds } from "./codex-types";
import type { BlitzEntryType } from "./node-sim/blitz-merchant";

/** BlitzRunModel.shopEnchantmentOptions. */
const SHOP_ENCHANTMENTS = ["SHARP", "NIMBLE", "ADROIT", "STEADY", "SWIFT", "VIGOROUS"];
/** BlitzMerchantEntry.GiveCurse: CurseCardPool cards that modifiers may generate. */
const BLITZ_CURSES = ["CLUMSY", "DEBT", "DECAY", "DOUBT", "GUILTY", "INJURY", "NORMALITY", "REGRET", "SHAME", "WRITHE"];
const CHARACTERS = ["IRONCLAD", "SILENT", "DEFECT", "REGENT", "NECROBINDER", "FOOL"];

const BLITZ_RELATED: Partial<Record<BlitzEntryType, CodexRelatedIds>> = {
  CardEnchant: { enchantment: SHOP_ENCHANTMENTS },
  EnchantedCardReward: { enchantment: SHOP_ENCHANTMENTS },
  PrismaticCardReward: { character: CHARACTERS },
  Glam: { enchantment: ["GLAM"], card: BLITZ_CURSES },
  TwoMoreChoices: { card: BLITZ_CURSES },
  CardRewardOfEachRarity: { card: BLITZ_CURSES },
  UpgradedRareCardReward: { card: BLITZ_CURSES },
  TwoRelics: { card: BLITZ_CURSES },
  FullHealAndMaxHp: { card: BLITZ_CURSES },
};

export function blitzEntryRelated(type: BlitzEntryType): CodexRelatedIds {
  return BLITZ_RELATED[type] ?? {};
}

/** Powers and cards each DominionModel applies or shows (the boss encounter is added by the loader). */
const DOMINION_RELATED: Record<string, CodexRelatedIds> = {
  AEONGLASS: { power: ["AEONGLASS_DOMINION"], card: ["WITHER"] },
  CEREMONIAL_BEAST: { power: ["RITUAL"] },
  INSATIABLE: { power: ["INSATIABLE_DOMINION"] },
  KAISER_CRAB: { power: ["PLATING"] },
  KIN: { power: ["WEAK", "FRAIL"] },
  KNOWLEDGE_DEMON: { card: ["SLOTH", "AMNESIA"], power: ["SLOTH", "AMNESIA"] },
  LAGAVULIN_MATRIARCH: { power: ["LAGAVULIN_MATRIARCH_DOMINION", "STRENGTH", "DEXTERITY"] },
  QUEEN: { power: ["YOU_ARE_MINE", "WEAK", "VULNERABLE", "FRAIL"] },
  SOUL_FYSH: { card: ["BECKON"] },
  TEST_SUBJECT: { power: ["STRENGTH"] },
  VANTOM: { power: ["SLIPPERY"] },
  WATERFALL_GIANT: { power: ["EXPLOSIVE"] },
};

export function dominionRelated(id: string): CodexRelatedIds {
  return DOMINION_RELATED[id] ?? {};
}

import type { CardSideTip, CardSideTipCatalog } from "@/lib/card-keyword-tips";
import { collectCardSideTips } from "@/lib/card-keyword-tips";
import { getCardMaxUpgradeLevel, renderCardDescription } from "@/lib/codex-card-description";
import type { CodexCard, CodexEnchantment, CodexPotion, CodexRelic } from "@/lib/codex-types";
import { collectPotionSideTips } from "@/lib/potion-side-tips";
import { collectRelicSideTips, getRelicExtraHoverTipSpecs } from "@/lib/relic-side-tips";
import {
  getMadScienceCardTypeFromId,
  getMadSciencePreviewCard,
  getTinkerRiderIdsForType,
} from "@/lib/tinker-time";

// Every side tip a compendium list's modals and tiles can show while the data
// chunks are missing (no enchantments, afflictions, or version diffs). The
// list pages pick the catalog rows these tips read (see
// pickCardSideTipCatalogSources) and send them, so the tips stay when the
// chunks fail.

/** Relic modal (inspect screen) and tile tips; the tile's self tip reads only the relic. */
export function collectRelicListSideTips(
  relics: readonly CodexRelic[],
  catalog: CardSideTipCatalog,
  { potions, enchantments }: { potions: readonly CodexPotion[]; enchantments: readonly CodexEnchantment[] },
): CardSideTip[] {
  const potionsById = new Map(potions.map((potion) => [potion.id, potion]));
  const enchantmentsById = new Map(enchantments.map((enchantment) => [enchantment.id, enchantment]));
  return relics.flatMap((relic) => collectRelicSideTips(relic, catalog, {
    includeSelf: false,
    potionsById,
    enchantmentsById,
  }));
}

/** Potion and enchantment ids relic tips name; the relic modal reads them from its related rows. */
export function getRelicSideTipRowIds(
  relics: readonly Pick<CodexRelic, "id">[],
  kind: "potion" | "enchantment",
): string[] {
  return relics.flatMap((relic) => getRelicExtraHoverTipSpecs(relic.id)
    .flatMap((spec) => (spec.kind === kind ? [spec.id] : [])));
}

/** Potion modal and tile tips (both include the self tip). */
export function collectPotionListSideTips(
  potions: readonly CodexPotion[],
  catalog: CardSideTipCatalog,
): CardSideTip[] {
  return potions.flatMap((potion) => collectPotionSideTips(potion, catalog, { includeSelf: true }));
}

/**
 * Card modal tips for every Mad Science rider and upgrade level, and grid tile
 * tips (the listed row, base or first upgrade, even without an upgrade).
 */
export function collectCardListSideTips(
  cards: readonly CodexCard[],
  catalog: CardSideTipCatalog,
): CardSideTip[] {
  const tips: CardSideTip[] = [];
  for (const card of cards) {
    const madScienceType = getMadScienceCardTypeFromId(card.id);
    const previews = madScienceType
      ? [card, ...getTinkerRiderIdsForType(madScienceType).map((riderId) => (
        getMadSciencePreviewCard(card, madScienceType, riderId, card.typeLabel)
      ))]
      : [card];
    for (const preview of previews) {
      const maxUpgradeLevel = Math.max(1, getCardMaxUpgradeLevel(preview));
      for (let upgradeLevel = 0; upgradeLevel <= maxUpgradeLevel; upgradeLevel += 1) {
        tips.push(...collectCardSideTips(preview, catalog, {
          upgradeLevel,
          description: upgradeLevel > 0
            ? renderCardDescription(preview, { upgradeLevel })
            : preview.description,
        }));
      }
    }
  }
  return tips;
}

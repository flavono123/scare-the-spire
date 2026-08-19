import type { CardColor, CardRarityKo, CardTypeKo } from "@/lib/codex-types";
import rawVisuals from "@/lib/history-card-visuals.json";
import { historyCardKeyVariants } from "@/lib/history-card-lookup";
import {
  getMadScienceVariantPartsFromId,
  MAD_SCIENCE_CARD_ID,
  TINKER_CARD_TYPE_TO_KO,
} from "@/lib/tinker-time";

export type HistoryCardVisual = {
  color: CardColor;
  visualColor?: CardColor;
  rarity: CardRarityKo;
  type: CardTypeKo;
};

type HistoryCardVisualRow = HistoryCardVisual & { id: string };

const ROWS = rawVisuals as HistoryCardVisualRow[];

const VISUALS_BY_ID = (() => {
  const map = new Map<string, HistoryCardVisual>();
  for (const row of ROWS) {
    const visual: HistoryCardVisual = {
      color: row.color,
      rarity: row.rarity,
      type: row.type,
      ...(row.visualColor ? { visualColor: row.visualColor } : {}),
    };
    map.set(row.id, visual);
    map.set(`CARD.${row.id}`, visual);
  }
  return map;
})();

function lookupExactVisual(id: string): HistoryCardVisual | undefined {
  for (const key of historyCardKeyVariants(id)) {
    const hit = VISUALS_BY_ID.get(key) ?? VISUALS_BY_ID.get(key.toUpperCase());
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Compact color/rarity/type lookup for History Course tiny cards.
 * Independent of the Compendium detail payload so run-info still renders
 * when `/generated/compendium-detail-*.json` is missing or empty.
 */
export function lookupHistoryCardVisual(id: string): HistoryCardVisual | undefined {
  const parts = getMadScienceVariantPartsFromId(id);
  const base = lookupExactVisual(parts ? MAD_SCIENCE_CARD_ID : id);
  if (!base) return undefined;
  if (!parts) return base;
  return { ...base, type: TINKER_CARD_TYPE_TO_KO[parts.cardType] };
}

import type { CodexCard, CodexPotion, CodexRelic } from "@/lib/codex-types";
import { getHistoryCourseCatalog } from "@/lib/history-course-catalog";
import { resolveRelicDisplayImage } from "@/lib/relic-character-variant";

/**
 * Icon URLs for run ids ("RELIC.WUPPY", "CARD.X"), from the history catalog rather than `/images/sts2/<kind>/<id>.webp`:
 * new content ships with beta art only (Wuppy, the Fool's cards) and some relics only have per-character art
 * (Yummy Cookie), so the id-derived path 404s for them. Ids the game does not know (mod content) get the game's own
 * stand-in: SaveUtil.RelicOrDeprecated / CardOrDeprecated, drawn with RelicModel.MissingIconPath (missing_power).
 */
const MISSING_ICON = "/images/sts2/powers/missing_power.webp";
type Maps = { cards: Map<string, CodexCard>; relics: Map<string, CodexRelic>; potions: Map<string, CodexPotion> };
let maps: Maps | null = null;

function catalogMaps(): Maps {
  if (maps) return maps;
  const { allCards, allRelics, allPotions } = getHistoryCourseCatalog();
  maps = {
    cards: new Map(allCards.map((card) => [card.id, card])),
    relics: new Map(allRelics.map((relic) => [relic.id, relic])),
    potions: new Map(allPotions.map((potion) => [potion.id, potion])),
  };
  return maps;
}

function bareId(id: string): string {
  return id.replace(/^(CARD|RELIC|POTION)\./i, "").toUpperCase();
}

export function historyCardImageSrc(id: string): string {
  const card = catalogMaps().cards.get(bareId(id));
  return card ? card.imageUrl ?? card.betaImageUrl ?? MISSING_ICON : MISSING_ICON;
}

export function historyRelicImageSrc(id: string): string {
  const relic = catalogMaps().relics.get(bareId(id));
  return (relic && (resolveRelicDisplayImage(relic, relic.pool) ?? relic.betaImageUrl)) ?? MISSING_ICON;
}

export function historyPotionImageSrc(id: string): string {
  const potion = catalogMaps().potions.get(bareId(id));
  return potion?.imageUrl ?? MISSING_ICON;
}

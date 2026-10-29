import {
  getCodexCards,
  getCodexKeywords,
  getCodexMonsters,
  getCodexPowers,
} from "@/lib/codex-data";
import { readGameLocalizationTable } from "@/lib/game-localization";
import type { GameLocale } from "@/lib/i18n";
import type { CardSideTip, CardSideTipCatalog } from "@/lib/card-keyword-tips";
import {
  createCardSideTipCatalog,
  pickCardSideTipCatalogSources,
  type CardSideTipCatalogSources,
} from "@/lib/card-side-tip-catalog";
import type { CodexCard } from "@/lib/codex-types";

export async function loadCardSideTipCatalogSources(
  gameLocale: GameLocale,
): Promise<CardSideTipCatalogSources> {
  const [
    keywords,
    staticHoverTips,
    engStaticHoverTips,
    orbs,
    engOrbs,
    monsterNames,
    engMonsterNames,
  ] = await Promise.all([
    getCodexKeywords({ gameLocale }),
    readGameLocalizationTable(gameLocale, "static_hover_tips"),
    readGameLocalizationTable("eng", "static_hover_tips"),
    readGameLocalizationTable(gameLocale, "orbs"),
    readGameLocalizationTable("eng", "orbs"),
    readGameLocalizationTable(gameLocale, "monsters"),
    readGameLocalizationTable("eng", "monsters"),
  ]);

  return {
    keywords,
    staticHoverTips,
    engStaticHoverTips,
    orbs,
    engOrbs,
    monsterNames,
    engMonsterNames,
  };
}

/**
 * The side tip catalog rows a list page's modals and tiles read, picked from
 * the catalog they build once the data chunks load (the chunk's sources with
 * every power, card, and monster). `collectTips` returns every tip they can
 * show; `sentCards` are the cards the page sends anyway.
 */
export async function loadLinkedCardSideTipSources(
  gameLocale: GameLocale,
  collectTips: (catalog: CardSideTipCatalog) => CardSideTip[],
  options?: { sentCards?: readonly Pick<CodexCard, "id">[] },
): Promise<CardSideTipCatalogSources> {
  const [sources, powers, cards, monsters] = await Promise.all([
    loadCardSideTipCatalogSources(gameLocale),
    getCodexPowers({ includeDeprecated: true, gameLocale }),
    getCodexCards({ includeDeprecated: true, gameLocale }),
    getCodexMonsters({ gameLocale }),
  ]);
  const input = { sources, powers, cards, monsters };
  return pickCardSideTipCatalogSources(input, collectTips(createCardSideTipCatalog(input)), options);
}

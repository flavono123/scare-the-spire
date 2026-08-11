import {
  getCodexKeywords,
} from "@/lib/codex-data";
import { readGameLocalizationTable } from "@/lib/game-localization";
import type { GameLocale } from "@/lib/i18n";
import type { CardSideTipCatalogSources } from "@/lib/card-side-tip-catalog";

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

import englishBadges from "../../data/sts2/eng/badges.json";
import { readGameLocalizationTable } from "@/lib/game-localization";
import type { GameLocale } from "@/lib/i18n";
import type { RunBadgeCatalogEntry } from "@/lib/run-badges";

const BASE_BADGES = englishBadges as RunBadgeCatalogEntry[];

export async function getActiveRunBadgeCatalog(
  gameLocale: GameLocale,
): Promise<RunBadgeCatalogEntry[]> {
  const table = await readGameLocalizationTable(gameLocale, "badges");

  return BASE_BADGES.filter((badge) => badge.active).map((badge) => ({
    ...badge,
    title: badge.title === null
      ? null
      : table[`${badge.id}.title`] ?? badge.title,
    description: badge.description === null
      ? null
      : table[`${badge.id}.description`] ?? badge.description,
    rarities: Object.fromEntries(
      Object.entries(badge.rarities).map(([rarity, copy]) => [
        rarity,
        {
          title: table[`${badge.id}.${rarity}Title`] ?? copy.title,
          description: table[`${badge.id}.${rarity}Description`] ?? copy.description,
        },
      ]),
    ),
  }));
}

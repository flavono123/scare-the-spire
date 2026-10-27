"use client";

import type { ComponentProps } from "react";
import { PotionLibrary } from "./potion-library";
import { compendiumDetailsSettled, useCompendiumDataState } from "./use-compendium-data";
import type { CompendiumDataKey } from "@/lib/compendium-data-chunks";
import type { GameLocale } from "@/lib/i18n";

const LAZY_DATA_KEYS = [
  "cardSideTipSources",
  "cards",
  "changes",
  "enchantments",
  "events",
  "monsters",
  "powers",
  "versionDiffs",
] as const satisfies readonly CompendiumDataKey[];

type PotionLibraryLoaderProps = Omit<ComponentProps<typeof PotionLibrary>, "changes" | "versionDiffs" | "relatedCards" | "relatedEnchantments" | "relatedEvents" | "relatedPowers" | "relatedMonsters" | "tipCatalogSources" | "detailsReady"> & {
  gameLocale: GameLocale;
};

/**
 * Renders PotionLibrary from its server props and fills in the rest once the
 * data chunks load. The detail modal waits for them, since its related lists,
 * hover tips, and history come from the chunks.
 */
export function PotionLibraryLoader({ gameLocale, ...props }: PotionLibraryLoaderProps) {
  const { data, status } = useCompendiumDataState(gameLocale, LAZY_DATA_KEYS);
  return (
    <PotionLibrary
      {...props}
      detailsReady={compendiumDetailsSettled(status)}
      changes={data?.changes}
      versionDiffs={data?.versionDiffs}
      relatedCards={data?.cards}
      relatedEnchantments={data?.enchantments}
      relatedEvents={data?.events}
      relatedPowers={data?.powers}
      relatedMonsters={data?.monsters}
      tipCatalogSources={data?.cardSideTipSources}
    />
  );
}

"use client";

import type { ComponentProps } from "react";
import { EnchantmentLibrary } from "./enchantment-library";
import {
  compendiumDetailsSettled,
  useCompendiumDataState,
  useCompendiumEntitiesState,
} from "./use-compendium-data";
import type { CompendiumDataKey } from "@/lib/compendium-data-chunks";
import type { GameLocale } from "@/lib/i18n";

const LAZY_DATA_KEYS = [
  "cardSideTipSources",
  "cards",
  "changes",
  "events",
  "monsters",
  "potions",
  "powers",
  "relics",
  "versionDiffs",
] as const satisfies readonly CompendiumDataKey[];

type EnchantmentLibraryLoaderProps = Omit<ComponentProps<typeof EnchantmentLibrary>, "changes" | "versionDiffs" | "entities" | "cards" | "events" | "potions" | "powers" | "relics" | "monsters" | "tipCatalogSources" | "detailsReady"> & {
  gameLocale: GameLocale;
};

/**
 * Renders EnchantmentLibrary from its server props and fills in the rest once
 * the data chunks load. The detail modal waits for them, since its related
 * lists, keyword links, and history come from the chunks.
 */
export function EnchantmentLibraryLoader({ gameLocale, ...props }: EnchantmentLibraryLoaderProps) {
  const { data, status: dataStatus } = useCompendiumDataState(gameLocale, LAZY_DATA_KEYS);
  const { entities, status: entitiesStatus } = useCompendiumEntitiesState(gameLocale);
  return (
    <EnchantmentLibrary
      {...props}
      detailsReady={compendiumDetailsSettled(dataStatus, entitiesStatus)}
      changes={data?.changes}
      versionDiffs={data?.versionDiffs}
      entities={entities}
      cards={data?.cards}
      events={data?.events}
      potions={data?.potions}
      powers={data?.powers}
      relics={data?.relics}
      monsters={data?.monsters}
      tipCatalogSources={data?.cardSideTipSources}
    />
  );
}

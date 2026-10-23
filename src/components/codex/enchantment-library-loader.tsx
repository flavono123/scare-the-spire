"use client";

import type { ComponentProps } from "react";
import { EnchantmentLibrary } from "./enchantment-library";
import { useCompendiumData, useCompendiumEntities } from "./use-compendium-data";
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

type EnchantmentLibraryLoaderProps = Omit<ComponentProps<typeof EnchantmentLibrary>, "changes" | "versionDiffs" | "entities" | "cards" | "events" | "potions" | "powers" | "relics" | "monsters" | "tipCatalogSources"> & {
  gameLocale: GameLocale;
};

/** Renders EnchantmentLibrary from its server props and fills in the rest once the data chunks load. */
export function EnchantmentLibraryLoader({ gameLocale, ...props }: EnchantmentLibraryLoaderProps) {
  const data = useCompendiumData(gameLocale, LAZY_DATA_KEYS);
  const entities = useCompendiumEntities(gameLocale);
  return (
    <EnchantmentLibrary
      {...props}
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

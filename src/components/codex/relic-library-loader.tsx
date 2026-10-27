"use client";

import type { ComponentProps } from "react";
import { RelicLibrary } from "./relic-library";
import { useCompendiumData, useCompendiumEntities } from "./use-compendium-data";
import type { CompendiumDataKey } from "@/lib/compendium-data-chunks";
import type { GameLocale } from "@/lib/i18n";

const LAZY_DATA_KEYS = [
  "cardSideTipSources",
  "cards",
  "changes",
  "enchantments",
  "events",
  "monsters",
  "potions",
  "powers",
  "versionDiffs",
] as const satisfies readonly CompendiumDataKey[];

type RelicLibraryLoaderProps = Omit<ComponentProps<typeof RelicLibrary>, "changes" | "versionDiffs" | "entities" | "relatedCards" | "relatedEvents" | "relatedEnchantments" | "relatedPowers" | "relatedMonsters" | "relatedPotions" | "tipCatalogSources"> & {
  gameLocale: GameLocale;
};

/** Renders RelicLibrary from its server props and fills in the rest once the data chunks load. */
export function RelicLibraryLoader({ gameLocale, ...props }: RelicLibraryLoaderProps) {
  const data = useCompendiumData(gameLocale, LAZY_DATA_KEYS);
  const entities = useCompendiumEntities(gameLocale);
  return (
    <RelicLibrary
      {...props}
      changes={data?.changes}
      versionDiffs={data?.versionDiffs}
      entities={entities}
      relatedCards={data?.cards}
      relatedEvents={data?.events}
      relatedEnchantments={data?.enchantments}
      relatedPowers={data?.powers}
      relatedMonsters={data?.monsters}
      relatedPotions={data?.potions}
      tipCatalogSources={data?.cardSideTipSources}
    />
  );
}

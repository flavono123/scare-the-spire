"use client";

import type { ComponentProps } from "react";
import { PowerLibrary } from "./power-library";
import { useCompendiumData, useCompendiumEntities } from "./use-compendium-data";
import type { CompendiumDataKey } from "@/lib/compendium-data-chunks";
import type { GameLocale } from "@/lib/i18n";

const LAZY_DATA_KEYS = [
  "afflictions",
  "cardSideTipSources",
  "cards",
  "changes",
  "enchantments",
  "events",
  "monsters",
  "potions",
  "relics",
  "versionDiffs",
] as const satisfies readonly CompendiumDataKey[];

type PowerLibraryLoaderProps = Omit<ComponentProps<typeof PowerLibrary>, "cards" | "relics" | "potions" | "enchantments" | "events" | "monsters" | "afflictions" | "tipCatalogSources" | "changes" | "versionDiffs" | "entities"> & {
  gameLocale: GameLocale;
};

/** Renders PowerLibrary from its server props and fills in the rest once the data chunks load. */
export function PowerLibraryLoader({ gameLocale, ...props }: PowerLibraryLoaderProps) {
  const data = useCompendiumData(gameLocale, LAZY_DATA_KEYS);
  const entities = useCompendiumEntities(gameLocale);
  return (
    <PowerLibrary
      {...props}
      cards={data?.cards}
      relics={data?.relics}
      potions={data?.potions}
      enchantments={data?.enchantments}
      events={data?.events}
      monsters={data?.monsters}
      afflictions={data?.afflictions}
      tipCatalogSources={data?.cardSideTipSources}
      changes={data?.changes}
      versionDiffs={data?.versionDiffs}
      entities={entities}
    />
  );
}

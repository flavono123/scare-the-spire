"use client";

import type { ComponentProps } from "react";
import { PowerLibrary } from "./power-library";
import {
  compendiumDetailsSettled,
  useCompendiumDataState,
  useCompendiumEntitiesState,
} from "./use-compendium-data";
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

type PowerLibraryLoaderProps = Omit<ComponentProps<typeof PowerLibrary>, "cards" | "relics" | "potions" | "enchantments" | "events" | "monsters" | "afflictions" | "tipCatalogSources" | "changes" | "versionDiffs" | "entities" | "detailsReady"> & {
  gameLocale: GameLocale;
};

/**
 * Renders PowerLibrary from its server props and fills in the rest once the
 * data chunks load. The detail modal waits for them, since its related lists,
 * keyword links, and history come from the chunks.
 */
export function PowerLibraryLoader({ gameLocale, ...props }: PowerLibraryLoaderProps) {
  const { data, status: dataStatus } = useCompendiumDataState(gameLocale, LAZY_DATA_KEYS);
  const { entities, status: entitiesStatus } = useCompendiumEntitiesState(gameLocale);
  return (
    <PowerLibrary
      {...props}
      detailsReady={compendiumDetailsSettled(dataStatus, entitiesStatus)}
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

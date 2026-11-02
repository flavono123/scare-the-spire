"use client";

import type { ComponentProps } from "react";
import { RelicLibrary } from "./relic-library";
import {
  compendiumDetailsStatus,
  useCompendiumDataState,
  useCompendiumEntitiesState,
} from "./use-compendium-data";
import type { CompendiumDataKey } from "@/lib/compendium-data-chunks";
import { EMPTY_CARD_SIDE_TIP_SOURCES } from "@/lib/compendium-list-props";
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

type RelicLibraryLoaderProps = Omit<ComponentProps<typeof RelicLibrary>, "changes" | "versionDiffs" | "entities" | "relatedCards" | "relatedEvents" | "relatedEnchantments" | "relatedPowers" | "relatedMonsters" | "relatedPotions" | "tipCatalogSources" | "detailsStatus"> & {
  gameLocale: GameLocale;
};

/**
 * Renders RelicLibrary from its server props and fills in the rest once the
 * data chunks load. The detail modal waits for them, since its related lists,
 * keyword links, and history come from the chunks, and offers a retry if they
 * fail. A tile shows the relic's own tip without the chunks; the empty tip
 * sources stand in for them, and its other tips come with them.
 */
export function RelicLibraryLoader({ gameLocale, ...props }: RelicLibraryLoaderProps) {
  const { data, status: dataStatus } = useCompendiumDataState(gameLocale, LAZY_DATA_KEYS);
  const { entities, status: entitiesStatus } = useCompendiumEntitiesState(gameLocale);
  return (
    <RelicLibrary
      {...props}
      detailsStatus={compendiumDetailsStatus(dataStatus, entitiesStatus)}
      changes={data?.changes}
      versionDiffs={data?.versionDiffs}
      entities={entities}
      relatedCards={data?.cards}
      relatedEvents={data?.events}
      relatedEnchantments={data?.enchantments}
      relatedPowers={data?.powers}
      relatedMonsters={data?.monsters}
      relatedPotions={data?.potions}
      tipCatalogSources={data?.cardSideTipSources ?? EMPTY_CARD_SIDE_TIP_SOURCES}
    />
  );
}

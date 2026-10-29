"use client";

import type { ComponentProps } from "react";
import { RelicLibrary } from "./relic-library";
import {
  compendiumDetailsSettled,
  useCompendiumDataState,
  useCompendiumEntitiesState,
} from "./use-compendium-data";
import type { CompendiumDataKey } from "@/lib/compendium-data-chunks";
import type { CodexCard, CodexEnchantment, CodexEvent } from "@/lib/codex-types";
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

type RelicLibraryLoaderProps = Omit<ComponentProps<typeof RelicLibrary>, "changes" | "versionDiffs" | "entities" | "relatedCards" | "relatedEvents" | "relatedEnchantments" | "relatedPowers" | "relatedMonsters" | "relatedPotions" | "tipCatalogSources" | "detailsReady"> & {
  gameLocale: GameLocale;
  /** The events the detail modal links to, so it names them when the events chunk fails. */
  linkedEvents: CodexEvent[];
  /** The cards the detail modal links to, so it names them when the cards chunk fails. */
  linkedCards: CodexCard[];
  /** The enchantments the detail modal links to, so it names them when the enchantments chunk fails. */
  linkedEnchantments: CodexEnchantment[];
};

/**
 * Renders RelicLibrary from its server props and fills in the rest once the
 * data chunks load. The detail modal waits for them, since its related lists,
 * keyword links, and history come from the chunks. If they fail, the modal
 * renders from the server props, with the linked cards, events, and
 * enchantments in place of those chunks.
 */
export function RelicLibraryLoader({ gameLocale, linkedEvents, linkedCards, linkedEnchantments, ...props }: RelicLibraryLoaderProps) {
  const { data, status: dataStatus } = useCompendiumDataState(gameLocale, LAZY_DATA_KEYS);
  const { entities, status: entitiesStatus } = useCompendiumEntitiesState(gameLocale);
  return (
    <RelicLibrary
      {...props}
      detailsReady={compendiumDetailsSettled(dataStatus, entitiesStatus)}
      changes={data?.changes}
      versionDiffs={data?.versionDiffs}
      entities={entities}
      relatedCards={data?.cards ?? linkedCards}
      relatedEvents={data?.events ?? linkedEvents}
      relatedEnchantments={data?.enchantments ?? linkedEnchantments}
      relatedPowers={data?.powers}
      relatedMonsters={data?.monsters}
      relatedPotions={data?.potions}
      tipCatalogSources={data?.cardSideTipSources}
    />
  );
}

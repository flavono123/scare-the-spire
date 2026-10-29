"use client";

import type { ComponentProps } from "react";
import { RelicLibrary } from "./relic-library";
import {
  compendiumDetailsSettled,
  useCompendiumDataState,
  useCompendiumEntitiesState,
} from "./use-compendium-data";
import type { CompendiumDataKey } from "@/lib/compendium-data-chunks";
import type { CardSideTipCatalogSources } from "@/lib/card-side-tip-catalog";
import type { CodexCard, CodexEnchantment, CodexEvent, CodexPotion } from "@/lib/codex-types";
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
  /** The enchantments the detail modal links to or shows as side tips, so it names them when the enchantments chunk fails. */
  linkedEnchantments: CodexEnchantment[];
  /** The potions the side tips show, so the modal and tiles keep them when the data chunks fail. */
  linkedPotions: CodexPotion[];
  /** The side tip catalog rows the modal and tiles read, so they keep their side tips when the data chunks fail. */
  linkedTipSources: CardSideTipCatalogSources;
};

/**
 * Renders RelicLibrary from its server props and fills in the rest once the
 * data chunks load. The detail modal waits for them, since its related lists,
 * keyword links, and history come from the chunks. If they fail, the modal
 * renders from the server props, with the linked cards, events, enchantments,
 * potions, and side tip rows in place of those chunks.
 */
export function RelicLibraryLoader({ gameLocale, linkedEvents, linkedCards, linkedEnchantments, linkedPotions, linkedTipSources, ...props }: RelicLibraryLoaderProps) {
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
      relatedPotions={data?.potions ?? linkedPotions}
      tipCatalogSources={data?.cardSideTipSources ?? linkedTipSources}
    />
  );
}

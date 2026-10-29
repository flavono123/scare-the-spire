"use client";

import type { ComponentProps } from "react";
import { PotionLibrary } from "./potion-library";
import { compendiumDetailsSettled, useCompendiumDataState } from "./use-compendium-data";
import type { CompendiumDataKey } from "@/lib/compendium-data-chunks";
import type { CodexEvent } from "@/lib/codex-types";
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
  /** The events the detail modal links to, so it names them when the events chunk fails. */
  linkedEvents: CodexEvent[];
};

/**
 * Renders PotionLibrary from its server props and fills in the rest once the
 * data chunks load. The detail modal waits for them, since its related lists,
 * hover tips, and history come from the chunks. If they fail, the modal
 * renders from the server props, with the linked events in place of the
 * events chunk.
 */
export function PotionLibraryLoader({ gameLocale, linkedEvents, ...props }: PotionLibraryLoaderProps) {
  const { data, status } = useCompendiumDataState(gameLocale, LAZY_DATA_KEYS);
  return (
    <PotionLibrary
      {...props}
      detailsReady={compendiumDetailsSettled(status)}
      changes={data?.changes}
      versionDiffs={data?.versionDiffs}
      relatedCards={data?.cards}
      relatedEnchantments={data?.enchantments}
      relatedEvents={data?.events ?? linkedEvents}
      relatedPowers={data?.powers}
      relatedMonsters={data?.monsters}
      tipCatalogSources={data?.cardSideTipSources}
    />
  );
}

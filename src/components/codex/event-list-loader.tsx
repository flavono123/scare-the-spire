"use client";

import type { ComponentProps } from "react";
import { EventList } from "./event-list";
import { compendiumDetailsSettled, useCompendiumDataState } from "./use-compendium-data";
import type { CompendiumDataKey } from "@/lib/compendium-data-chunks";
import type { GameLocale } from "@/lib/i18n";

const LAZY_DATA_KEYS = [
  "cards",
  "changes",
  "enchantments",
  "madScienceBaseCard",
  "potions",
  "powers",
  "relics",
  "versionDiffs",
] as const satisfies readonly CompendiumDataKey[];

const EMPTY: never[] = [];

type EventListLoaderProps = Omit<ComponentProps<typeof EventList>, "cards" | "enchantments" | "madScienceBaseCard" | "potions" | "powers" | "relics" | "changes" | "versionDiffs" | "detailsReady"> & {
  gameLocale: GameLocale;
};

/**
 * Renders EventList from its server props and fills in the rest once the
 * data chunks load. The detail modal waits for them, since its option
 * previews and related lists come from the chunks.
 */
export function EventListLoader({ gameLocale, ...props }: EventListLoaderProps) {
  const { data, status } = useCompendiumDataState(gameLocale, LAZY_DATA_KEYS);
  return (
    <EventList
      {...props}
      detailsReady={compendiumDetailsSettled(status)}
      cards={data?.cards}
      enchantments={data?.enchantments}
      madScienceBaseCard={data?.madScienceBaseCard}
      potions={data?.potions}
      powers={data?.powers}
      relics={data?.relics}
      changes={data?.changes}
      versionDiffs={data?.versionDiffs ?? EMPTY}
    />
  );
}

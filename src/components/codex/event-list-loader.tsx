"use client";

import type { ComponentProps } from "react";
import { EventList } from "./event-list";
import { useCompendiumData } from "./use-compendium-data";
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

type EventListLoaderProps = Omit<ComponentProps<typeof EventList>, "cards" | "enchantments" | "madScienceBaseCard" | "potions" | "powers" | "relics" | "changes" | "versionDiffs"> & {
  gameLocale: GameLocale;
};

/** Renders EventList from its server props and fills in the rest once the data chunks load. */
export function EventListLoader({ gameLocale, ...props }: EventListLoaderProps) {
  const data = useCompendiumData(gameLocale, LAZY_DATA_KEYS);
  return (
    <EventList
      {...props}
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

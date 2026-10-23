"use client";

import type { ComponentProps } from "react";
import { CardLibrary } from "./card-library";
import { useCompendiumData } from "./use-compendium-data";
import type { CompendiumDataKey } from "@/lib/compendium-data-chunks";
import type { GameLocale } from "@/lib/i18n";

const LAZY_DATA_KEYS = [
  "afflictions",
  "ancients",
  "changes",
  "enchantments",
  "events",
  "monsters",
  "potions",
  "powers",
  "versionDiffs",
] as const satisfies readonly CompendiumDataKey[];

const EMPTY: never[] = [];

type CardLibraryLoaderProps = Omit<ComponentProps<typeof CardLibrary>, "changes" | "versionDiffs" | "enchantments" | "afflictions" | "relatedAncients" | "relatedEvents" | "relatedMonsters" | "relatedPotions" | "relatedPowers"> & {
  gameLocale: GameLocale;
};

/** Renders CardLibrary from its server props and fills in the rest once the data chunks load. */
export function CardLibraryLoader({ gameLocale, ...props }: CardLibraryLoaderProps) {
  const data = useCompendiumData(gameLocale, LAZY_DATA_KEYS);
  return (
    <CardLibrary
      {...props}
      changes={data?.changes}
      versionDiffs={data?.versionDiffs ?? EMPTY}
      enchantments={data?.enchantments ?? EMPTY}
      afflictions={data?.afflictions ?? EMPTY}
      relatedAncients={data?.ancients}
      relatedEvents={data?.events}
      relatedMonsters={data?.monsters}
      relatedPotions={data?.potions}
      relatedPowers={data?.powers}
    />
  );
}

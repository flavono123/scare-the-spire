"use client";

import type { ComponentProps } from "react";
import { BestiaryLibrary } from "./bestiary-library";
import { compendiumDetailsSettled, useCompendiumDataState } from "./use-compendium-data";
import type { CompendiumDataKey } from "@/lib/compendium-data-chunks";
import type { GameLocale } from "@/lib/i18n";

const LAZY_DATA_KEYS = [
  "afflictions",
  "cards",
  "changes",
  "encounters",
  "monsters",
  "powers",
  "versionDiffs",
] as const satisfies readonly CompendiumDataKey[];

type BestiaryLibraryLoaderProps = Omit<ComponentProps<typeof BestiaryLibrary>, "afflictions" | "cards" | "powers" | "changes" | "versionDiffs" | "detailsReady"> & {
  gameLocale: GameLocale;
};

/**
 * Renders BestiaryLibrary from its server props and fills in the rest once the
 * data chunks load. The server sends slim monster and encounter rows (see
 * slimBestiaryMonsters); the full rows replace them here. Detail modals wait
 * for them, since the slim rows have no moves, pattern, or combat scene; if a
 * chunk fails they render from the slim rows rather than load forever.
 */
export function BestiaryLibraryLoader({ gameLocale, ...props }: BestiaryLibraryLoaderProps) {
  const { data, status } = useCompendiumDataState(gameLocale, LAZY_DATA_KEYS);
  return (
    <BestiaryLibrary
      {...props}
      detailsReady={compendiumDetailsSettled(status)}
      monsters={data?.monsters ?? props.monsters}
      encounters={data?.encounters ?? props.encounters}
      afflictions={data?.afflictions}
      cards={data?.cards}
      powers={data?.powers}
      changes={data?.changes}
      versionDiffs={data?.versionDiffs}
    />
  );
}

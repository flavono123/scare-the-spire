"use client";

import type { ComponentProps } from "react";
import { BestiaryLibrary } from "./bestiary-library";
import { useCompendiumData } from "./use-compendium-data";
import type { CompendiumDataKey } from "@/lib/compendium-data-chunks";
import type { GameLocale } from "@/lib/i18n";

const LAZY_DATA_KEYS = [
  "afflictions",
  "cards",
  "changes",
  "powers",
  "versionDiffs",
] as const satisfies readonly CompendiumDataKey[];

type BestiaryLibraryLoaderProps = Omit<ComponentProps<typeof BestiaryLibrary>, "afflictions" | "cards" | "powers" | "changes" | "versionDiffs"> & {
  gameLocale: GameLocale;
};

/** Renders BestiaryLibrary from its server props and fills in the rest once the data chunks load. */
export function BestiaryLibraryLoader({ gameLocale, ...props }: BestiaryLibraryLoaderProps) {
  const data = useCompendiumData(gameLocale, LAZY_DATA_KEYS);
  return (
    <BestiaryLibrary
      {...props}
      afflictions={data?.afflictions}
      cards={data?.cards}
      powers={data?.powers}
      changes={data?.changes}
      versionDiffs={data?.versionDiffs}
    />
  );
}

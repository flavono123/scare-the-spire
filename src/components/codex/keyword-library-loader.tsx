"use client";

import type { ComponentProps } from "react";
import { KeywordLibrary } from "./keyword-library";
import { useCompendiumData, useCompendiumEntities } from "./use-compendium-data";
import type { CompendiumDataKey } from "@/lib/compendium-data-chunks";
import type { GameLocale } from "@/lib/i18n";

const LAZY_DATA_KEYS = [
  "cards",
] as const satisfies readonly CompendiumDataKey[];

type KeywordLibraryLoaderProps = Omit<ComponentProps<typeof KeywordLibrary>, "cards" | "entities"> & {
  gameLocale: GameLocale;
};

/** Renders KeywordLibrary from its server props and fills in the rest once the data chunks load. */
export function KeywordLibraryLoader({ gameLocale, ...props }: KeywordLibraryLoaderProps) {
  const data = useCompendiumData(gameLocale, LAZY_DATA_KEYS);
  const entities = useCompendiumEntities(gameLocale);
  return (
    <KeywordLibrary
      {...props}
      cards={data?.cards}
      entities={entities}
    />
  );
}

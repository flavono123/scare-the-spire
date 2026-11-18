"use client";

import type { ComponentProps } from "react";
import { BlitzEntryLibrary } from "./blitz-entry-library";
import { useCompendiumEntities } from "./use-compendium-data";
import type { GameLocale } from "@/lib/i18n";

type BlitzEntryLibraryLoaderProps = Omit<ComponentProps<typeof BlitzEntryLibrary>, "entities"> & {
  gameLocale: GameLocale;
};

/** Renders BlitzEntryLibrary from its server props and fills in the rest once the data chunks load. */
export function BlitzEntryLibraryLoader({ gameLocale, ...props }: BlitzEntryLibraryLoaderProps) {
  const entities = useCompendiumEntities(gameLocale);
  return (
    <BlitzEntryLibrary
      {...props}
      gameLocale={gameLocale}
      entities={entities}
    />
  );
}

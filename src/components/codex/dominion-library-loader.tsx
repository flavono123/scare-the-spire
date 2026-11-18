"use client";

import type { ComponentProps } from "react";
import { DominionLibrary } from "./dominion-library";
import { useCompendiumEntities } from "./use-compendium-data";
import type { GameLocale } from "@/lib/i18n";

type DominionLibraryLoaderProps = Omit<ComponentProps<typeof DominionLibrary>, "entities"> & {
  gameLocale: GameLocale;
};

/** Renders DominionLibrary from its server props and fills in the rest once the data chunks load. */
export function DominionLibraryLoader({ gameLocale, ...props }: DominionLibraryLoaderProps) {
  const entities = useCompendiumEntities(gameLocale);
  return (
    <DominionLibrary
      {...props}
      gameLocale={gameLocale}
      entities={entities}
    />
  );
}

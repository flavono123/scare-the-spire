"use client";

import type { ComponentProps } from "react";
import { AscensionLibrary } from "./ascension-library";
import { useCompendiumEntities } from "./use-compendium-data";
import type { GameLocale } from "@/lib/i18n";

type AscensionLibraryLoaderProps = Omit<ComponentProps<typeof AscensionLibrary>, "entities"> & {
  gameLocale: GameLocale;
};

/** Renders AscensionLibrary from its server props and fills in the rest once the data chunks load. */
export function AscensionLibraryLoader({ gameLocale, ...props }: AscensionLibraryLoaderProps) {
  const entities = useCompendiumEntities(gameLocale);
  return (
    <AscensionLibrary
      {...props}
      gameLocale={gameLocale}
      entities={entities}
    />
  );
}

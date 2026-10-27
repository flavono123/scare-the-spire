"use client";

import type { ComponentProps } from "react";
import { ModifierLibrary } from "./modifier-library";
import { useCompendiumEntities } from "./use-compendium-data";
import type { GameLocale } from "@/lib/i18n";

type ModifierLibraryLoaderProps = Omit<ComponentProps<typeof ModifierLibrary>, "entities"> & {
  gameLocale: GameLocale;
};

/** Renders ModifierLibrary from its server props and fills in the rest once the data chunks load. */
export function ModifierLibraryLoader({ gameLocale, ...props }: ModifierLibraryLoaderProps) {
  const entities = useCompendiumEntities(gameLocale);
  return (
    <ModifierLibrary
      {...props}
      gameLocale={gameLocale}
      entities={entities}
    />
  );
}

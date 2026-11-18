"use client";

import type { ComponentProps } from "react";
import { PetLibrary } from "./pet-library";
import { useCompendiumEntities } from "./use-compendium-data";
import type { GameLocale } from "@/lib/i18n";

type PetLibraryLoaderProps = Omit<ComponentProps<typeof PetLibrary>, "entities"> & {
  gameLocale: GameLocale;
};

/** Renders PetLibrary from its server props and fills in the rest once the data chunks load. */
export function PetLibraryLoader({ gameLocale, ...props }: PetLibraryLoaderProps) {
  const entities = useCompendiumEntities(gameLocale);
  return (
    <PetLibrary
      {...props}
      gameLocale={gameLocale}
      entities={entities}
    />
  );
}

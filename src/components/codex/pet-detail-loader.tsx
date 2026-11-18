"use client";

import type { ComponentProps } from "react";
import { PetDetail } from "./pet-detail";
import { useCompendiumEntities } from "./use-compendium-data";
import type { GameLocale } from "@/lib/i18n";

type PetDetailLoaderProps = Omit<ComponentProps<typeof PetDetail>, "entities"> & {
  gameLocale: GameLocale;
};

/** Renders PetDetail from its server props and fills in the rest once the data chunks load. */
export function PetDetailLoader({ gameLocale, ...props }: PetDetailLoaderProps) {
  const entities = useCompendiumEntities(gameLocale);
  return (
    <PetDetail
      {...props}
      entities={entities}
    />
  );
}

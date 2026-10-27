"use client";

import type { ComponentProps } from "react";
import { ModifierDetail } from "./modifier-detail";
import { useCompendiumEntities } from "./use-compendium-data";
import type { GameLocale } from "@/lib/i18n";

type ModifierDetailLoaderProps = Omit<ComponentProps<typeof ModifierDetail>, "entities"> & {
  gameLocale: GameLocale;
};

/** Renders ModifierDetail from its server props and fills in the rest once the data chunks load. */
export function ModifierDetailLoader({ gameLocale, ...props }: ModifierDetailLoaderProps) {
  const entities = useCompendiumEntities(gameLocale);
  return (
    <ModifierDetail
      {...props}
      entities={entities}
    />
  );
}

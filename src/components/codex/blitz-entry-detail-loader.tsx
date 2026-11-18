"use client";

import type { ComponentProps } from "react";
import { BlitzEntryDetail } from "./blitz-entry-detail";
import { useCompendiumEntities } from "./use-compendium-data";
import type { GameLocale } from "@/lib/i18n";

type BlitzEntryDetailLoaderProps = Omit<ComponentProps<typeof BlitzEntryDetail>, "entities"> & {
  gameLocale: GameLocale;
};

/** Renders BlitzEntryDetail from its server props and fills in the rest once the data chunks load. */
export function BlitzEntryDetailLoader({ gameLocale, ...props }: BlitzEntryDetailLoaderProps) {
  const entities = useCompendiumEntities(gameLocale);
  return (
    <BlitzEntryDetail
      {...props}
      entities={entities}
    />
  );
}

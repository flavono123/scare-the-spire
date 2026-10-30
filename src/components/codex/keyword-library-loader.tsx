"use client";

import type { ComponentProps } from "react";
import { KeywordLibrary } from "./keyword-library";
import {
  compendiumDetailsSettled,
  useCompendiumDataState,
  useCompendiumEntitiesState,
} from "./use-compendium-data";
import type { CompendiumDataKey } from "@/lib/compendium-data-chunks";
import type { GameLocale } from "@/lib/i18n";

const LAZY_DATA_KEYS = [
  "cards",
] as const satisfies readonly CompendiumDataKey[];

type KeywordLibraryLoaderProps = Omit<ComponentProps<typeof KeywordLibrary>, "cards" | "entities" | "detailsReady"> & {
  gameLocale: GameLocale;
};

/**
 * Renders KeywordLibrary from its server props and fills in the rest once the
 * data chunks load. The detail modal waits for the related cards and entities;
 * if a chunk fails it renders without them rather than load forever.
 */
export function KeywordLibraryLoader({ gameLocale, ...props }: KeywordLibraryLoaderProps) {
  const { data, status: dataStatus } = useCompendiumDataState(gameLocale, LAZY_DATA_KEYS);
  const { entities, status: entitiesStatus } = useCompendiumEntitiesState(gameLocale);
  return (
    <KeywordLibrary
      {...props}
      cards={data?.cards}
      entities={entities}
      detailsReady={compendiumDetailsSettled(dataStatus, entitiesStatus)}
    />
  );
}

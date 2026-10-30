"use client";

import type { ComponentProps } from "react";
import { AncientList } from "./ancient-list";
import {
  compendiumDetailsSettled,
  useCompendiumDataState,
  useCompendiumEntitiesState,
} from "./use-compendium-data";
import type { CompendiumDataKey } from "@/lib/compendium-data-chunks";
import type { GameLocale } from "@/lib/i18n";

const LAZY_DATA_KEYS = [
  "cards",
  "changes",
  "versionDiffs",
] as const satisfies readonly CompendiumDataKey[];

type AncientListLoaderProps = Omit<ComponentProps<typeof AncientList>, "cards" | "changes" | "versionDiffs" | "entities" | "detailsReady"> & {
  gameLocale: GameLocale;
};

/**
 * Renders AncientList from its server props and fills in the rest once the
 * data chunks load. The detail modal waits for them, since its reward relics,
 * related cards, and history come from the chunks.
 */
export function AncientListLoader({ gameLocale, ...props }: AncientListLoaderProps) {
  const { data, status: dataStatus } = useCompendiumDataState(gameLocale, LAZY_DATA_KEYS);
  const { entities, status: entitiesStatus } = useCompendiumEntitiesState(gameLocale);
  return (
    <AncientList
      {...props}
      detailsReady={compendiumDetailsSettled(dataStatus, entitiesStatus)}
      cards={data?.cards}
      changes={data?.changes}
      versionDiffs={data?.versionDiffs}
      entities={entities}
    />
  );
}

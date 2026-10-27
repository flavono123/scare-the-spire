"use client";

import type { ComponentProps } from "react";
import { AncientList } from "./ancient-list";
import { useCompendiumData, useCompendiumEntities } from "./use-compendium-data";
import type { CompendiumDataKey } from "@/lib/compendium-data-chunks";
import type { GameLocale } from "@/lib/i18n";

const LAZY_DATA_KEYS = [
  "cards",
  "changes",
  "versionDiffs",
] as const satisfies readonly CompendiumDataKey[];

type AncientListLoaderProps = Omit<ComponentProps<typeof AncientList>, "cards" | "changes" | "versionDiffs" | "entities"> & {
  gameLocale: GameLocale;
};

/** Renders AncientList from its server props and fills in the rest once the data chunks load. */
export function AncientListLoader({ gameLocale, ...props }: AncientListLoaderProps) {
  const data = useCompendiumData(gameLocale, LAZY_DATA_KEYS);
  const entities = useCompendiumEntities(gameLocale);
  return (
    <AncientList
      {...props}
      cards={data?.cards}
      changes={data?.changes}
      versionDiffs={data?.versionDiffs}
      entities={entities}
    />
  );
}

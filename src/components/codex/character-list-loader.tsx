"use client";

import type { ComponentProps } from "react";
import { CharacterList } from "./character-list";
import {
  compendiumDetailsSettled,
  useCompendiumDataState,
  useCompendiumEntitiesState,
} from "./use-compendium-data";
import type { CompendiumDataKey } from "@/lib/compendium-data-chunks";
import type { GameLocale } from "@/lib/i18n";

const LAZY_DATA_KEYS = [
  "ancients",
  "cards",
  "changes",
  "potions",
  "relics",
  "versionDiffs",
] as const satisfies readonly CompendiumDataKey[];

type CharacterListLoaderProps = Omit<ComponentProps<typeof CharacterList>, "cards" | "relics" | "potions" | "ancients" | "changes" | "versionDiffs" | "entities" | "detailsReady"> & {
  gameLocale: GameLocale;
};

/**
 * Renders CharacterList from its server props and fills in the rest once the
 * data chunks load. The detail modal waits for them, since its starter deck,
 * relics, potions, keyword links, and history come from the chunks.
 */
export function CharacterListLoader({ gameLocale, ...props }: CharacterListLoaderProps) {
  const { data, status: dataStatus } = useCompendiumDataState(gameLocale, LAZY_DATA_KEYS);
  const { entities, status: entitiesStatus } = useCompendiumEntitiesState(gameLocale);
  return (
    <CharacterList
      {...props}
      detailsReady={compendiumDetailsSettled(dataStatus, entitiesStatus)}
      cards={data?.cards}
      relics={data?.relics}
      potions={data?.potions}
      ancients={data?.ancients}
      changes={data?.changes}
      versionDiffs={data?.versionDiffs}
      entities={entities}
    />
  );
}

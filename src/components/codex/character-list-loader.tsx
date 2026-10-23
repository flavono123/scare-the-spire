"use client";

import type { ComponentProps } from "react";
import { CharacterList } from "./character-list";
import { useCompendiumData, useCompendiumEntities } from "./use-compendium-data";
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

type CharacterListLoaderProps = Omit<ComponentProps<typeof CharacterList>, "cards" | "relics" | "potions" | "ancients" | "changes" | "versionDiffs" | "entities"> & {
  gameLocale: GameLocale;
};

/** Renders CharacterList from its server props and fills in the rest once the data chunks load. */
export function CharacterListLoader({ gameLocale, ...props }: CharacterListLoaderProps) {
  const data = useCompendiumData(gameLocale, LAZY_DATA_KEYS);
  const entities = useCompendiumEntities(gameLocale);
  return (
    <CharacterList
      {...props}
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

"use client";

import { useMemo, type ComponentProps } from "react";
import { CardLibrary } from "./card-library";
import { useCompendiumData } from "./use-compendium-data";
import type { CompendiumDataKey } from "@/lib/compendium-data-chunks";
import {
  EMPTY_CARD_SIDE_TIP_SOURCES,
  expandCardKeywordLabels,
  type CompactCodexCard,
} from "@/lib/compendium-list-props";
import type { CodexCard } from "@/lib/codex-types";
import type { GameLocale } from "@/lib/i18n";

const LAZY_DATA_KEYS = [
  "afflictions",
  "ancients",
  "cardSideTipSources",
  "changes",
  "enchantments",
  "events",
  "monsters",
  "potions",
  "powers",
  "versionDiffs",
] as const satisfies readonly CompendiumDataKey[];

const EMPTY: never[] = [];

type CardLibraryLoaderProps = Omit<ComponentProps<typeof CardLibrary>, "cards" | "changes" | "versionDiffs" | "enchantments" | "afflictions" | "relatedAncients" | "relatedEvents" | "relatedMonsters" | "relatedPotions" | "relatedPowers" | "tipCatalogSources"> & {
  gameLocale: GameLocale;
  cards: CompactCodexCard[];
  keywordLabels: CodexCard["keywordLabels"];
};

/** Renders CardLibrary from its server props and fills in the rest once the data chunks load. */
export function CardLibraryLoader({ gameLocale, cards: compactCards, keywordLabels, ...props }: CardLibraryLoaderProps) {
  const data = useCompendiumData(gameLocale, LAZY_DATA_KEYS);
  const cards = useMemo(
    () => expandCardKeywordLabels(compactCards, keywordLabels),
    [compactCards, keywordLabels],
  );
  return (
    <CardLibrary
      {...props}
      cards={cards}
      changes={data?.changes}
      versionDiffs={data?.versionDiffs ?? EMPTY}
      enchantments={data?.enchantments ?? EMPTY}
      afflictions={data?.afflictions ?? EMPTY}
      relatedAncients={data?.ancients}
      relatedEvents={data?.events}
      relatedMonsters={data?.monsters}
      relatedPotions={data?.potions}
      relatedPowers={data?.powers}
      tipCatalogSources={data?.cardSideTipSources ?? EMPTY_CARD_SIDE_TIP_SOURCES}
    />
  );
}

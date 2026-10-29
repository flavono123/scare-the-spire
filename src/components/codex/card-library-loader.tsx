"use client";

import { useMemo, type ComponentProps } from "react";
import { CardLibrary } from "./card-library";
import { compendiumDetailsSettled, useCompendiumDataState } from "./use-compendium-data";
import type { CompendiumDataKey } from "@/lib/compendium-data-chunks";
import {
  EMPTY_CARD_SIDE_TIP_SOURCES,
  expandCardKeywordLabels,
  type CompactCodexCard,
} from "@/lib/compendium-list-props";
import type { CodexCard, CodexEvent } from "@/lib/codex-types";
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

type CardLibraryLoaderProps = Omit<ComponentProps<typeof CardLibrary>, "cards" | "changes" | "versionDiffs" | "enchantments" | "afflictions" | "relatedAncients" | "relatedEvents" | "relatedMonsters" | "relatedPotions" | "relatedPowers" | "tipCatalogSources" | "detailsReady"> & {
  gameLocale: GameLocale;
  cards: CompactCodexCard[];
  keywordLabels: CodexCard["keywordLabels"];
  /** The events the detail modal links to, so it names them when the events chunk fails. */
  linkedEvents: CodexEvent[];
};

/**
 * Renders CardLibrary from its server props and fills in the rest once the
 * data chunks load. The detail modal waits for them, since its enchantments,
 * afflictions, related lists, and history come from the chunks. If they fail,
 * the modal renders from the server props, with the linked events in place of
 * the events chunk.
 */
export function CardLibraryLoader({ gameLocale, cards: compactCards, keywordLabels, linkedEvents, ...props }: CardLibraryLoaderProps) {
  const { data, status } = useCompendiumDataState(gameLocale, LAZY_DATA_KEYS);
  const cards = useMemo(
    () => expandCardKeywordLabels(compactCards, keywordLabels),
    [compactCards, keywordLabels],
  );
  return (
    <CardLibrary
      {...props}
      cards={cards}
      detailsReady={compendiumDetailsSettled(status)}
      changes={data?.changes}
      versionDiffs={data?.versionDiffs ?? EMPTY}
      enchantments={data?.enchantments ?? EMPTY}
      afflictions={data?.afflictions ?? EMPTY}
      relatedAncients={data?.ancients}
      relatedEvents={data?.events ?? linkedEvents}
      relatedMonsters={data?.monsters}
      relatedPotions={data?.potions}
      relatedPowers={data?.powers}
      tipCatalogSources={data?.cardSideTipSources ?? EMPTY_CARD_SIDE_TIP_SOURCES}
    />
  );
}

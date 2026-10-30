import { Suspense } from "react";
import type { Metadata } from "next";
import { getCodexCards, getCodexCharacters, getCodexEvents } from "@/lib/codex-data";
import {
  compactCardKeywordLabels,
  pickLinkedEvents,
  slimFilterCharacters,
  slimLinkedEvents,
} from "@/lib/compendium-list-props";
import { getCardDetailEventIds } from "@/lib/codex-references";
import { getVersionsWithDiffs } from "@/lib/entity-versioning";
import { getSTS2Patches, getEntityVersionDiffs, getCodexMeta } from "@/lib/data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMetadata } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { CardLibraryLoader } from "@/components/codex/card-library-loader";
import { CompendiumEntryLinkIndex } from "@/components/codex/compendium-entry-link-index";
import { loadLinkedCardSideTipSources } from "@/lib/card-side-tip-catalog.server";
import { collectCardListSideTips } from "@/lib/compendium-list-side-tips";

export const dynamic = "force-static";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const gameUi = await getCodexGameUiLabels(gameLocale);
  return getCodexMetadata(serviceLocale, gameUi.cardLibraryTitle, "/compendium/cards");
}

export default async function CodexCardsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [
    cards,
    characters,
    patches,
    versionDiffs,
    meta,
    gameUi,
    events,
  ] = await Promise.all([
    getCodexCards({ includeDeprecated: true, gameLocale }),
    getCodexCharacters({ gameLocale }),
    getSTS2Patches(),
    getEntityVersionDiffs(gameLocale),
    getCodexMeta(),
    getCodexGameUiLabels(gameLocale),
    getCodexEvents({ gameLocale }),
  ]);

  const versions = getVersionsWithDiffs(patches, versionDiffs);
  const compact = compactCardKeywordLabels(cards);
  const linkedTipSources = await loadLinkedCardSideTipSources(
    gameLocale,
    (catalog) => collectCardListSideTips(cards, catalog),
    { sentCards: cards },
  );

  // Modal, hover-tip, and version-history data load from the static data
  // chunks after hydration so the page HTML stays small. The linked rows are
  // the few the modal and tiles fall back to when the chunks fail.
  return (
    <>
      <Suspense>
        <CardLibraryLoader
          gameLocale={gameLocale}
          serviceLocale={serviceLocale}
          gameUi={gameUi}
          cards={compact.cards}
          keywordLabels={compact.keywordLabels}
          characters={slimFilterCharacters(characters)}
          versions={versions}
          currentVersion={meta.version}
          patches={patches}
          linkedEvents={slimLinkedEvents(pickLinkedEvents(events, cards.flatMap((card) => getCardDetailEventIds(card.id))))}
          linkedTipSources={linkedTipSources}
        />
      </Suspense>
      <CompendiumEntryLinkIndex
        gameLocale={gameLocale}
        title={gameUi.cardLibraryTitle}
        groups={[{ type: "card", entries: cards }]}
      />
    </>
  );
}

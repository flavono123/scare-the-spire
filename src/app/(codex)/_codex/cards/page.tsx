import { Suspense } from "react";
import type { Metadata } from "next";
import { getCodexCards, getCodexCharacters } from "@/lib/codex-data";
import { compactCardKeywordLabels, slimFilterCharacters } from "@/lib/compendium-list-props";
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
  ] = await Promise.all([
    getCodexCards({ includeDeprecated: true, gameLocale }),
    getCodexCharacters({ gameLocale }),
    getSTS2Patches(),
    getEntityVersionDiffs(gameLocale),
    getCodexMeta(),
    getCodexGameUiLabels(gameLocale),
  ]);

  const versions = getVersionsWithDiffs(patches, versionDiffs);
  const compact = compactCardKeywordLabels(cards);

  // Modal, hover-tip, and version-history data load from the static data
  // chunks after hydration so the page HTML stays small.
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

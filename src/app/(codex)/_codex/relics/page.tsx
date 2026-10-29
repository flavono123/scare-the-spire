import { Suspense } from "react";
import type { Metadata } from "next";
import { getCodexAncients, getCodexCharacters, getCodexEvents, getCodexRelics } from "@/lib/codex-data";
import { getVersionsWithDiffs } from "@/lib/entity-versioning";
import { getSTS2Patches, getEntityVersionDiffs, getCodexMeta } from "@/lib/data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMetadata } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  findCodexResourceByRouteId,
  firstCodexImageUrl,
  firstRouteSearchParam,
  getCodexResourceOgMetadata,
} from "@/lib/codex-resource-og";
import { RelicLibraryLoader } from "@/components/codex/relic-library-loader";
import { CompendiumEntryLinkIndex } from "@/components/codex/compendium-entry-link-index";
import { pickLinkedEvents, slimFilterCharacters, slimLinkedEvents } from "@/lib/compendium-list-props";
import { getRelatedEventIdsForRelic } from "@/lib/codex-references";

export const dynamic = "force-static";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const relicId = firstRouteSearchParam(resolvedSearchParams.relic);
  const [gameUi, relics] = await Promise.all([
    getCodexGameUiLabels(gameLocale),
    relicId ? getCodexRelics({ gameLocale }) : Promise.resolve(null),
  ]);
  const relic = relics ? findCodexResourceByRouteId(relics, relicId) : undefined;
  if (relic) {
    return getCodexResourceOgMetadata(serviceLocale, gameUi.relicCollectionTitle, {
      name: relic.name,
      description: relic.description,
      imageUrl: firstCodexImageUrl(
        relic.imageUrl,
        ...(relic.variantImageUrls ? Object.values(relic.variantImageUrls) : []),
        ...(relic.iconVariants ? relic.iconVariants.map((variant) => variant.imageUrl) : []),
        relic.betaImageUrl,
      ),
    });
  }
  return getCodexMetadata(serviceLocale, gameUi.relicCollectionTitle, "/compendium/relics");
}

export default async function CodexRelicsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [
    relics,
    characters,
    ancients,
    patches,
    versionDiffs,
    meta,
    gameUi,
    events,
  ] = await Promise.all([
    getCodexRelics({ gameLocale }),
    getCodexCharacters({ gameLocale }),
    getCodexAncients({ gameLocale }),
    getSTS2Patches(),
    getEntityVersionDiffs(gameLocale),
    getCodexMeta(),
    getCodexGameUiLabels(gameLocale),
    getCodexEvents({ gameLocale }),
  ]);

  const versions = getVersionsWithDiffs(patches, versionDiffs);

  return (
    <>
      <Suspense>
        <RelicLibraryLoader
          gameLocale={gameLocale}
          serviceLocale={serviceLocale}
          gameUi={gameUi}
          title={gameUi.relicCollectionTitle}
          relics={relics}
          characters={slimFilterCharacters(characters)}
          ancients={ancients}
          versions={versions}
          currentVersion={meta.version}
          patches={patches}
          linkedEvents={slimLinkedEvents(pickLinkedEvents(events, relics.flatMap((relic) => getRelatedEventIdsForRelic(relic.id))))}
        />
      </Suspense>
      <CompendiumEntryLinkIndex
        gameLocale={gameLocale}
        title={gameUi.relicCollectionTitle}
        groups={[{ type: "relic", entries: relics }]}
      />
    </>
  );
}

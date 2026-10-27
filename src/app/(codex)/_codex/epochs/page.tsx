import { Suspense } from "react";
import type { Metadata } from "next";
import { getCodexEpochs } from "@/lib/codex-data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMeta, getEntityVersionDiffs, getSTS2Patches } from "@/lib/data";
import { getVersionsWithDiffs } from "@/lib/entity-versioning";
import { getCodexMetadata } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  findCodexResourceByRouteId,
  firstRouteSearchParam,
  getCodexResourceOgMetadata,
} from "@/lib/codex-resource-og";
import { isBetaArtSearchParam } from "@/lib/codex-card-og";
import { EpochLibraryLoader } from "@/components/codex/epoch-library-loader";
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
  const epochId = firstRouteSearchParam(resolvedSearchParams.epoch);
  const [gameUi, epochs] = await Promise.all([
    getCodexGameUiLabels(gameLocale),
    epochId ? getCodexEpochs({ gameLocale }) : Promise.resolve(null),
  ]);
  const epoch = epochs ? findCodexResourceByRouteId(epochs, epochId) : undefined;
  if (epoch) {
    const useBetaArt = isBetaArtSearchParam(resolvedSearchParams.beta);
    return getCodexResourceOgMetadata(serviceLocale, gameUi.epochsTitle, {
      ...epoch,
      imageUrl: useBetaArt ? epoch.betaImageUrl ?? epoch.imageUrl : epoch.imageUrl,
    });
  }
  return getCodexMetadata(serviceLocale, gameUi.epochsTitle, "/compendium/epochs");
}

export default async function CodexEpochsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const initialShowBeta = isBetaArtSearchParam(resolvedSearchParams.beta);
  const [epochs, patches, versionDiffs, meta, gameUi] = await Promise.all([
    getCodexEpochs({ gameLocale }),
    getSTS2Patches(),
    getEntityVersionDiffs(gameLocale),
    getCodexMeta(),
    getCodexGameUiLabels(gameLocale),
  ]);
  const versions = getVersionsWithDiffs(patches, versionDiffs);
  return (
    <>
      <Suspense>
        <EpochLibraryLoader
          gameLocale={gameLocale}
          serviceLocale={serviceLocale}
          gameUi={gameUi}
          epochs={epochs}
          patches={patches}
          versions={versions}
          currentVersion={meta.version}
          initialShowBeta={initialShowBeta}
        />
      </Suspense>
      <CompendiumEntryLinkIndex
        gameLocale={gameLocale}
        title={gameUi.epochsTitle}
        groups={[{ type: "epoch", entries: epochs }]}
      />
    </>
  );
}

import { Suspense } from "react";
import type { Metadata } from "next";
import { getCodexPowers } from "@/lib/codex-data";
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
  firstRouteSearchParam,
  getCodexResourceOgMetadata,
} from "@/lib/codex-resource-og";
import { PowerLibraryLoader } from "@/components/codex/power-library-loader";
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
  const powerId = firstRouteSearchParam(resolvedSearchParams.power);
  const [gameUi, powers] = await Promise.all([
    getCodexGameUiLabels(gameLocale),
    powerId ? getCodexPowers({ includeDeprecated: true, gameLocale }) : Promise.resolve(null),
  ]);
  const power = powers ? findCodexResourceByRouteId(powers, powerId) : undefined;
  if (power) {
    return getCodexResourceOgMetadata(serviceLocale, gameUi.nav.powers, power);
  }
  return getCodexMetadata(serviceLocale, gameUi.nav.powers, "/compendium/powers");
}

export default async function CodexPowersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [powers, patches, versionDiffs, meta, gameUi] = await Promise.all([
    getCodexPowers({ includeDeprecated: true, gameLocale }),
    getSTS2Patches(),
    getEntityVersionDiffs(gameLocale),
    getCodexMeta(),
    getCodexGameUiLabels(gameLocale),
  ]);
  const versions = getVersionsWithDiffs(patches, versionDiffs);
  return (
    <>
      <Suspense>
        <PowerLibraryLoader
          gameLocale={gameLocale}
          serviceLocale={serviceLocale}
          gameUi={gameUi}
          title={gameUi.nav.powers}
          powers={powers}
          versions={versions}
          currentVersion={meta.version}
          patches={patches}
        />
      </Suspense>
      <CompendiumEntryLinkIndex
        gameLocale={gameLocale}
        title={gameUi.nav.powers}
        groups={[{ type: "power", entries: powers }]}
      />
    </>
  );
}

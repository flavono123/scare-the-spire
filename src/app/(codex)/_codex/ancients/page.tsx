import { Suspense } from "react";
import type { Metadata } from "next";
import { getCodexAncients, getCodexCharacters } from "@/lib/codex-data";
import { getCodexMeta, getEntityVersionDiffs, getSTS2Patches } from "@/lib/data";
import { getVersionsWithDiffs } from "@/lib/entity-versioning";
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
import { AncientListLoader } from "@/components/codex/ancient-list-loader";
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
  const ancientId = firstRouteSearchParam(resolvedSearchParams.ancient);
  const [gameUi, ancients] = await Promise.all([
    getCodexGameUiLabels(gameLocale),
    ancientId ? getCodexAncients({ gameLocale }) : Promise.resolve(null),
  ]);
  const ancient = ancients ? findCodexResourceByRouteId(ancients, ancientId) : undefined;
  if (ancient) {
    return getCodexResourceOgMetadata(serviceLocale, gameUi.ancientsTitle, ancient);
  }
  return getCodexMetadata(serviceLocale, gameUi.ancientsTitle, "/compendium/ancients");
}

export default async function CodexAncientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [ancients, characters, patches, versionDiffs, meta, gameUi] = await Promise.all([
    getCodexAncients({ gameLocale }),
    getCodexCharacters({ gameLocale }),
    getSTS2Patches(),
    getEntityVersionDiffs(gameLocale),
    getCodexMeta(),
    getCodexGameUiLabels(gameLocale),
  ]);
  const versions = getVersionsWithDiffs(patches, versionDiffs);
  return (
    <>
      <Suspense>
        <AncientListLoader
          gameLocale={gameLocale}
          serviceLocale={serviceLocale}
          gameUi={gameUi}
          ancients={ancients}
          characters={characters}
          patches={patches}
          versions={versions}
          currentVersion={meta.version}
        />
      </Suspense>
      <CompendiumEntryLinkIndex
        gameLocale={gameLocale}
        title={gameUi.ancientsTitle}
        groups={[{ type: "ancient", entries: ancients }]}
      />
    </>
  );
}

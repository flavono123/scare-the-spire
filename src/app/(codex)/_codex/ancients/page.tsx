import { Suspense } from "react";
import type { Metadata } from "next";
import { getCodexAncients, getCodexCards, getCodexRelics } from "@/lib/codex-data";
import { loadAllEntities } from "@/lib/load-all-entities";
import { getCodexMeta, getEntityVersionDiffs, getSTS2Changes, getSTS2Patches } from "@/lib/data";
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
import { AncientList } from "@/components/codex/ancient-list";

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
  return getCodexMetadata(serviceLocale, gameUi.ancientsTitle);
}

export default async function CodexAncientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [ancients, cards, relics, patches, changes, versionDiffs, meta, entities, gameUi] = await Promise.all([
    getCodexAncients({ gameLocale }),
    getCodexCards({ includeDeprecated: true, gameLocale }),
    getCodexRelics({ gameLocale }),
    getSTS2Patches(),
    getSTS2Changes(),
    getEntityVersionDiffs(),
    getCodexMeta(),
    loadAllEntities({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const versions = getVersionsWithDiffs(patches, versionDiffs);

  return (
    <Suspense>
      <AncientList
        serviceLocale={serviceLocale}
        gameLocale={gameLocale}
        gameUi={gameUi}
        ancients={ancients}
        cards={cards}
        relics={relics}
        patches={patches}
        changes={changes}
        versionDiffs={versionDiffs}
        versions={versions}
        currentVersion={meta.version}
        entities={entities}
      />
    </Suspense>
  );
}

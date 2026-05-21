import { Suspense } from "react";
import type { Metadata } from "next";
import { getCodexAncients, getCodexRelics } from "@/lib/codex-data";
import { loadAllEntities } from "@/lib/load-all-entities";
import { getEntityVersionDiffs, getSTS2Changes, getSTS2Patches } from "@/lib/data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMetadata } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { AncientList } from "@/components/codex/ancient-list";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const gameUi = await getCodexGameUiLabels(gameLocale);
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
  const [ancients, relics, patches, changes, versionDiffs, entities, gameUi] = await Promise.all([
    getCodexAncients({ gameLocale }),
    getCodexRelics({ gameLocale }),
    getSTS2Patches(),
    getSTS2Changes(),
    getEntityVersionDiffs(),
    loadAllEntities({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);

  return (
    <Suspense>
      <AncientList
        serviceLocale={serviceLocale}
        gameUi={gameUi}
        ancients={ancients}
        relics={relics}
        patches={patches}
        changes={changes}
        versionDiffs={versionDiffs}
        entities={entities}
      />
    </Suspense>
  );
}

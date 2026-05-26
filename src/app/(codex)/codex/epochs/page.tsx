import { Suspense } from "react";
import type { Metadata } from "next";
import {
  getCodexAncients,
  getCodexCards,
  getCodexEpochs,
  getCodexPotions,
  getCodexRelics,
} from "@/lib/codex-data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMeta, getEntityVersionDiffs, getSTS2Changes, getSTS2Patches } from "@/lib/data";
import { getVersionsWithDiffs } from "@/lib/entity-versioning";
import { getCodexMetadata } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { loadAllEntities } from "@/lib/load-all-entities";
import { EpochLibrary } from "@/components/codex/epoch-library";

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
  return getCodexMetadata(serviceLocale, gameUi.epochsTitle);
}

export default async function CodexEpochsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [epochs, cards, relics, potions, ancients, patches, changes, versionDiffs, meta, entities, gameUi] = await Promise.all([
    getCodexEpochs({ gameLocale }),
    getCodexCards({ includeDeprecated: true, gameLocale }),
    getCodexRelics({ gameLocale }),
    getCodexPotions({ gameLocale }),
    getCodexAncients({ gameLocale }),
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
      <EpochLibrary
        serviceLocale={serviceLocale}
        gameUi={gameUi}
        epochs={epochs}
        cards={cards}
        relics={relics}
        potions={potions}
        ancients={ancients}
        changes={changes}
        versions={versions}
        currentVersion={meta.version}
        entities={entities}
      />
    </Suspense>
  );
}

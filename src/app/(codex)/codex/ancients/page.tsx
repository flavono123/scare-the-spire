import { Suspense } from "react";
import type { Metadata } from "next";
import { getCodexAncients, getCodexCards, getCodexEvents, getCodexPotions, getCodexRelics } from "@/lib/codex-data";
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
  const [ancients, cards, relics, potions, events, patches, changes, versionDiffs, entities, gameUi] = await Promise.all([
    getCodexAncients({ gameLocale }),
    getCodexCards({ gameLocale }),
    getCodexRelics({ gameLocale }),
    getCodexPotions({ gameLocale }),
    getCodexEvents({ gameLocale }),
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
        cards={cards}
        relics={relics}
        potions={potions}
        events={events}
        patches={patches}
        changes={changes}
        versionDiffs={versionDiffs}
        entities={entities}
      />
    </Suspense>
  );
}

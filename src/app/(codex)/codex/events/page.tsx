import { Suspense } from "react";
import type { Metadata } from "next";
import {
  getCodexCards,
  getCodexEvents,
  getCodexPotions,
  getCodexRelics,
  getMadScienceBaseCard,
} from "@/lib/codex-data";
import { getVersionsWithDiffs } from "@/lib/entity-versioning";
import { getSTS2Patches, getSTS2Changes, getEntityVersionDiffs, getCodexMeta } from "@/lib/data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMetadata } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { EventList } from "@/components/codex/event-list";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const gameUi = await getCodexGameUiLabels(gameLocale);
  return getCodexMetadata(serviceLocale, gameUi.eventsTitle);
}

export default async function CodexEventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [events, cards, potions, relics, madScienceBaseCard, patches, changes, versionDiffs, meta, gameUi] = await Promise.all([
    getCodexEvents({ gameLocale }),
    getCodexCards({ gameLocale }),
    getCodexPotions({ gameLocale }),
    getCodexRelics({ gameLocale }),
    getMadScienceBaseCard({ gameLocale }),
    getSTS2Patches(),
    getSTS2Changes(),
    getEntityVersionDiffs(),
    getCodexMeta(),
    getCodexGameUiLabels(gameLocale),
  ]);

  const versions = getVersionsWithDiffs(patches, versionDiffs);

  return (
    <Suspense>
      <EventList
        serviceLocale={serviceLocale}
        gameUi={gameUi}
        title={gameUi.eventsTitle}
        cards={cards}
        events={events}
        madScienceBaseCard={madScienceBaseCard}
        potions={potions}
        relics={relics}
        versions={versions}
        currentVersion={meta.version}
        patches={patches}
        changes={changes}
        versionDiffs={versionDiffs}
      />
    </Suspense>
  );
}

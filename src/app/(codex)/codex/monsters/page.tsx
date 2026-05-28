import { Suspense } from "react";
import type { Metadata } from "next";
import {
  getCodexAfflictions,
  getCodexCards,
  getCodexEncounters,
  getCodexMonsters,
  getCodexPowers,
} from "@/lib/codex-data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMeta, getEntityVersionDiffs, getSTS2Changes, getSTS2Patches } from "@/lib/data";
import { getVersionsWithDiffs } from "@/lib/entity-versioning";
import { getCodexMetadata } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { MonsterLibrary } from "@/components/codex/monster-library";

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
  return getCodexMetadata(serviceLocale, gameUi.bestiaryTitle);
}

export default async function CodexMonstersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [monsters, encounters, afflictions, cards, powers, patches, changes, versionDiffs, meta, gameUi] = await Promise.all([
    getCodexMonsters({ gameLocale }),
    getCodexEncounters({ gameLocale }),
    getCodexAfflictions({ gameLocale }),
    getCodexCards({ includeDeprecated: true, gameLocale }),
    getCodexPowers({ includeDeprecated: true, gameLocale }),
    getSTS2Patches(),
    getSTS2Changes(),
    getEntityVersionDiffs(),
    getCodexMeta(),
    getCodexGameUiLabels(gameLocale),
  ]);
  const versions = getVersionsWithDiffs(patches, versionDiffs);

  return (
    <Suspense>
      <MonsterLibrary
        serviceLocale={serviceLocale}
        gameUi={gameUi}
        title={gameUi.bestiaryTitle}
        monsters={monsters}
        encounters={encounters}
        afflictions={afflictions}
        cards={cards}
        powers={powers}
        patches={patches}
        changes={changes}
        versions={versions}
        currentVersion={meta.version}
        versionDiffs={versionDiffs}
      />
    </Suspense>
  );
}

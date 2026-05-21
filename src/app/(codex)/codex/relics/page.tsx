import { Suspense } from "react";
import type { Metadata } from "next";
import { getCodexAncients, getCodexCharacters, getCodexEnchantments, getCodexEvents, getCodexMonsters, getCodexPowers, getCodexRelics } from "@/lib/codex-data";
import { loadAllEntities } from "@/lib/load-all-entities";
import { getVersionsWithDiffs } from "@/lib/entity-versioning";
import { getSTS2Patches, getSTS2Changes, getEntityVersionDiffs, getCodexMeta } from "@/lib/data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMetadata } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { RelicLibrary } from "@/components/codex/relic-library";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const gameUi = await getCodexGameUiLabels(gameLocale);
  return getCodexMetadata(serviceLocale, gameUi.relicCollectionTitle);
}

export default async function CodexRelicsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [relics, characters, ancients, enchantments, events, monsters, powers, patches, changes, versionDiffs, meta, entities, gameUi] = await Promise.all([
    getCodexRelics({ gameLocale }),
    getCodexCharacters({ gameLocale }),
    getCodexAncients({ gameLocale }),
    getCodexEnchantments({ gameLocale }),
    getCodexEvents({ gameLocale }),
    getCodexMonsters({ gameLocale }),
    getCodexPowers({ gameLocale }),
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
      <RelicLibrary
        serviceLocale={serviceLocale}
        gameUi={gameUi}
        title={gameUi.relicCollectionTitle}
        relics={relics}
        characters={characters}
        ancients={ancients}
        versions={versions}
        currentVersion={meta.version}
        patches={patches}
        changes={changes}
        versionDiffs={versionDiffs}
        entities={entities}
        relatedEvents={events}
        relatedEnchantments={enchantments}
        relatedMonsters={monsters}
        relatedPowers={powers}
      />
    </Suspense>
  );
}

import { Suspense } from "react";
import type { Metadata } from "next";
import { getCodexRelics, getCodexCharacters, getCodexAncients } from "@/lib/codex-data";
import { loadAllEntities } from "@/lib/load-all-entities";
import { getVersionsWithDiffs } from "@/lib/entity-versioning";
import { getSTS2Patches, getEntityVersionDiffs, getCodexMeta } from "@/lib/data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMetadata, getCodexServiceMessages } from "@/lib/codex-service";
import { RelicLibrary } from "@/components/codex/relic-library";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const serviceLocale = getServiceLocaleFromSearchRecord(await searchParams);
  const serviceText = getCodexServiceMessages(serviceLocale);
  return getCodexMetadata(serviceLocale, serviceText.relicsView.title);
}

export default async function CodexRelicsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [relics, characters, ancients, patches, versionDiffs, meta, entities] = await Promise.all([
    getCodexRelics({ gameLocale }),
    getCodexCharacters({ gameLocale }),
    getCodexAncients({ gameLocale }),
    getSTS2Patches(),
    getEntityVersionDiffs(),
    getCodexMeta(),
    loadAllEntities({ gameLocale }),
  ]);

  const versions = getVersionsWithDiffs(patches, versionDiffs);

  return (
    <Suspense>
      <RelicLibrary
        serviceLocale={serviceLocale}
        relics={relics}
        characters={characters}
        ancients={ancients}
        versions={versions}
        currentVersion={meta.version}
        patches={patches}
        versionDiffs={versionDiffs}
        entities={entities}
      />
    </Suspense>
  );
}

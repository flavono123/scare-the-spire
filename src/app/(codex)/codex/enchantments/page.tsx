import { Suspense } from "react";
import type { Metadata } from "next";
import { getCodexCards, getCodexEnchantments, getCodexEvents, getCodexPotions, getCodexRelics } from "@/lib/codex-data";
import { loadAllEntities } from "@/lib/load-all-entities";
import { getVersionsWithDiffs } from "@/lib/entity-versioning";
import { getSTS2Patches, getSTS2Changes, getEntityVersionDiffs, getCodexMeta } from "@/lib/data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMetadata, getCodexServiceMessages } from "@/lib/codex-service";
import { EnchantmentLibrary } from "@/components/codex/enchantment-library";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const serviceLocale = getServiceLocaleFromSearchRecord(await searchParams);
  const serviceText = getCodexServiceMessages(serviceLocale);
  return getCodexMetadata(serviceLocale, serviceText.enchantmentsView.title);
}

export default async function CodexEnchantmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [enchantments, cards, events, potions, relics, patches, changes, versionDiffs, meta, entities] = await Promise.all([
    getCodexEnchantments({ gameLocale }),
    getCodexCards({ gameLocale }),
    getCodexEvents({ gameLocale }),
    getCodexPotions({ gameLocale }),
    getCodexRelics({ gameLocale }),
    getSTS2Patches(),
    getSTS2Changes(),
    getEntityVersionDiffs(),
    getCodexMeta(),
    loadAllEntities({ gameLocale }),
  ]);

  const versions = getVersionsWithDiffs(patches, versionDiffs);

  return (
    <Suspense>
      <EnchantmentLibrary
        serviceLocale={serviceLocale}
        enchantments={enchantments}
        versions={versions}
        currentVersion={meta.version}
        patches={patches}
        changes={changes}
        versionDiffs={versionDiffs}
        entities={entities}
        cards={cards}
        events={events}
        potions={potions}
        relics={relics}
      />
    </Suspense>
  );
}

import { Suspense } from "react";
import type { Metadata } from "next";
import { getCodexCards, getCodexPotions, getCodexCharacters, getCodexEnchantments, getCodexEvents, getCodexMonsters, getCodexPowers } from "@/lib/codex-data";
import { loadAllEntities } from "@/lib/load-all-entities";
import { getVersionsWithDiffs } from "@/lib/entity-versioning";
import { getSTS2Patches, getSTS2Changes, getEntityVersionDiffs, getCodexMeta } from "@/lib/data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMetadata } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { PotionLibrary } from "@/components/codex/potion-library";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const gameUi = await getCodexGameUiLabels(gameLocale);
  return getCodexMetadata(serviceLocale, gameUi.potionLabTitle);
}

export default async function CodexPotionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [potions, cards, characters, enchantments, patches, changes, versionDiffs, meta, gameUi, events, monsters, powers, entities] = await Promise.all([
    getCodexPotions({ gameLocale }),
    getCodexCards({ gameLocale }),
    getCodexCharacters({ gameLocale }),
    getCodexEnchantments({ gameLocale }),
    getSTS2Patches(),
    getSTS2Changes(),
    getEntityVersionDiffs(),
    getCodexMeta(),
    getCodexGameUiLabels(gameLocale),
    getCodexEvents({ gameLocale }),
    getCodexMonsters({ gameLocale }),
    getCodexPowers({ gameLocale }),
    loadAllEntities({ gameLocale }),
  ]);

  const versions = getVersionsWithDiffs(patches, versionDiffs);

  return (
    <Suspense>
      <PotionLibrary
        serviceLocale={serviceLocale}
        gameUi={gameUi}
        title={gameUi.potionLabTitle}
        potions={potions}
        characters={characters}
        versions={versions}
        currentVersion={meta.version}
        patches={patches}
        changes={changes}
        versionDiffs={versionDiffs}
        relatedCards={cards}
        relatedEnchantments={enchantments}
        relatedEvents={events}
        relatedMonsters={monsters}
        relatedPowers={powers}
        entities={entities}
      />
    </Suspense>
  );
}

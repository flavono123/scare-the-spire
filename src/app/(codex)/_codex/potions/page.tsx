import { Suspense } from "react";
import type { Metadata } from "next";
import { getCodexCards, getCodexPotions, getCodexCharacters, getCodexEnchantments, getCodexEvents, getCodexPowers } from "@/lib/codex-data";
import { loadAllEntities } from "@/lib/load-all-entities";
import { getVersionsWithDiffs } from "@/lib/entity-versioning";
import { getSTS2Patches, getSTS2Changes, getEntityVersionDiffs, getCodexMeta } from "@/lib/data";
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
import { PotionLibrary } from "@/components/codex/potion-library";

export const dynamic = "force-static";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const potionId = firstRouteSearchParam(resolvedSearchParams.potion);
  const [gameUi, potions] = await Promise.all([
    getCodexGameUiLabels(gameLocale),
    potionId ? getCodexPotions({ gameLocale }) : Promise.resolve(null),
  ]);
  const potion = potions ? findCodexResourceByRouteId(potions, potionId) : undefined;
  if (potion) {
    return getCodexResourceOgMetadata(serviceLocale, gameUi.potionLabTitle, potion);
  }
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
  const [potions, cards, characters, enchantments, patches, changes, versionDiffs, meta, gameUi, events, powers, entities] = await Promise.all([
    getCodexPotions({ gameLocale }),
    getCodexCards({ includeDeprecated: true, gameLocale }),
    getCodexCharacters({ gameLocale }),
    getCodexEnchantments({ gameLocale }),
    getSTS2Patches(),
    getSTS2Changes(),
    getEntityVersionDiffs(),
    getCodexMeta(),
    getCodexGameUiLabels(gameLocale),
    getCodexEvents({ gameLocale }),
    getCodexPowers({ includeDeprecated: true, gameLocale }),
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
        relatedPowers={powers}
        entities={entities}
      />
    </Suspense>
  );
}

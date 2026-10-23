import { Suspense } from "react";
import type { Metadata } from "next";
import { getCodexPotions, getCodexCharacters } from "@/lib/codex-data";
import { getVersionsWithDiffs } from "@/lib/entity-versioning";
import { getSTS2Patches, getEntityVersionDiffs, getCodexMeta } from "@/lib/data";
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
import { PotionLibraryLoader } from "@/components/codex/potion-library-loader";
import { CompendiumEntryLinkIndex } from "@/components/codex/compendium-entry-link-index";

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
  return getCodexMetadata(serviceLocale, gameUi.potionLabTitle, "/compendium/potions");
}

export default async function CodexPotionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [
    potions,
    characters,
    patches,
    versionDiffs,
    meta,
    gameUi,
  ] = await Promise.all([
    getCodexPotions({ gameLocale }),
    getCodexCharacters({ gameLocale }),
    getSTS2Patches(),
    getEntityVersionDiffs(gameLocale),
    getCodexMeta(),
    getCodexGameUiLabels(gameLocale),
  ]);

  const versions = getVersionsWithDiffs(patches, versionDiffs);

  return (
    <>
      <Suspense>
        <PotionLibraryLoader
          gameLocale={gameLocale}
          serviceLocale={serviceLocale}
          gameUi={gameUi}
          title={gameUi.potionLabTitle}
          potions={potions}
          characters={characters}
          versions={versions}
          currentVersion={meta.version}
          patches={patches}
        />
      </Suspense>
      <CompendiumEntryLinkIndex
        gameLocale={gameLocale}
        title={gameUi.potionLabTitle}
        groups={[{ type: "potion", entries: potions }]}
      />
    </>
  );
}

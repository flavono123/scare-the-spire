import { Suspense } from "react";
import type { Metadata } from "next";
import {
  getCodexAncients,
  getCodexCards,
  getCodexCharacters,
  getCodexEnchantments,
  getCodexAfflictions,
  getCodexEvents,
  getCodexPotions,
  getCodexPowers,
} from "@/lib/codex-data";
import { getVersionsWithDiffs } from "@/lib/entity-versioning";
import { getSTS2Patches, getSTS2Changes, getEntityVersionDiffs, getCodexMeta } from "@/lib/data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMetadata } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { CardLibrary } from "@/components/codex/card-library";

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
  return getCodexMetadata(serviceLocale, gameUi.cardLibraryTitle);
}

export default async function CodexCardsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [cards, characters, patches, changes, versionDiffs, meta, enchantments, afflictions, gameUi, ancients, events, potions, powers] =
    await Promise.all([
      getCodexCards({ gameLocale }),
      getCodexCharacters({ gameLocale }),
      getSTS2Patches(),
      getSTS2Changes(),
      getEntityVersionDiffs(),
      getCodexMeta(),
      getCodexEnchantments({ gameLocale }),
      getCodexAfflictions({ gameLocale }),
      getCodexGameUiLabels(gameLocale),
      getCodexAncients({ gameLocale }),
      getCodexEvents({ gameLocale }),
      getCodexPotions({ gameLocale }),
      getCodexPowers({ gameLocale }),
    ]);

  const versions = getVersionsWithDiffs(patches, versionDiffs);

  return (
    <Suspense>
      <CardLibrary
        serviceLocale={serviceLocale}
        gameUi={gameUi}
        cards={cards}
        characters={characters}
        versions={versions}
        currentVersion={meta.version}
        patches={patches}
        changes={changes}
        versionDiffs={versionDiffs}
        enchantments={enchantments}
        afflictions={afflictions}
        relatedAncients={ancients}
        relatedEvents={events}
        relatedPotions={potions}
        relatedPowers={powers}
      />
    </Suspense>
  );
}

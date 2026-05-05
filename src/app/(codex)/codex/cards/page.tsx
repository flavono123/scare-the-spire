import { Suspense } from "react";
import type { Metadata } from "next";
import {
  getCodexCards,
  getCodexCharacters,
  getCodexEnchantments,
} from "@/lib/codex-data";
import { getVersionsWithDiffs } from "@/lib/entity-versioning";
import { getSTS2Patches, getEntityVersionDiffs, getCodexMeta } from "@/lib/data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMetadata, getCodexServiceMessages } from "@/lib/codex-service";
import { CardLibrary } from "@/components/codex/card-library";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const serviceLocale = getServiceLocaleFromSearchRecord(await searchParams);
  const serviceText = getCodexServiceMessages(serviceLocale);
  return getCodexMetadata(serviceLocale, serviceText.cardsView.title);
}

export default async function CodexCardsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [cards, characters, patches, versionDiffs, meta, enchantments] =
    await Promise.all([
      getCodexCards({ gameLocale }),
      getCodexCharacters({ gameLocale }),
      getSTS2Patches(),
      getEntityVersionDiffs(),
      getCodexMeta(),
      getCodexEnchantments({ gameLocale }),
    ]);

  const versions = getVersionsWithDiffs(patches, versionDiffs);

  return (
    <Suspense>
      <CardLibrary
        serviceLocale={serviceLocale}
        cards={cards}
        characters={characters}
        versions={versions}
        currentVersion={meta.version}
        patches={patches}
        versionDiffs={versionDiffs}
        enchantments={enchantments}
      />
    </Suspense>
  );
}

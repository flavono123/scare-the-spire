import { Suspense } from "react";
import type { Metadata } from "next";
import { getCodexAfflictions, getCodexEnchantments } from "@/lib/codex-data";
import { getVersionsWithDiffs } from "@/lib/entity-versioning";
import { getSTS2Patches, getEntityVersionDiffs, getCodexMeta } from "@/lib/data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMetadata, getCodexServiceMessages } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  findCodexResourceByRouteId,
  firstRouteSearchParam,
  getCodexResourceOgMetadata,
} from "@/lib/codex-resource-og";
import { EnchantmentLibraryLoader } from "@/components/codex/enchantment-library-loader";
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
  const serviceText = getCodexServiceMessages(serviceLocale);
  const enchantmentId = firstRouteSearchParam(resolvedSearchParams.enchantment);
  const afflictionId = firstRouteSearchParam(resolvedSearchParams.affliction);
  const [enchantments, afflictions] = enchantmentId || afflictionId
    ? await Promise.all([
        getCodexEnchantments({ gameLocale }),
        getCodexAfflictions({ gameLocale }),
      ])
    : [null, null];
  const resource = enchantmentId
    ? findCodexResourceByRouteId(enchantments ?? [], enchantmentId)
    : findCodexResourceByRouteId(afflictions ?? [], afflictionId);
  if (resource) {
    return getCodexResourceOgMetadata(serviceLocale, serviceText.enchantmentsView.title, resource);
  }
  return getCodexMetadata(serviceLocale, serviceText.enchantmentsView.title, "/compendium/enchantments");
}

export default async function CodexEnchantmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const serviceText = getCodexServiceMessages(serviceLocale);
  const [enchantments, afflictions, patches, versionDiffs, meta, gameUi] = await Promise.all([
    getCodexEnchantments({ gameLocale }),
    getCodexAfflictions({ gameLocale }),
    getSTS2Patches(),
    getEntityVersionDiffs(gameLocale),
    getCodexMeta(),
    getCodexGameUiLabels(gameLocale),
  ]);
  const versions = getVersionsWithDiffs(patches, versionDiffs);
  return (
    <>
      <Suspense>
        <EnchantmentLibraryLoader
          gameLocale={gameLocale}
          serviceLocale={serviceLocale}
          gameUi={gameUi}
          enchantments={enchantments}
          afflictions={afflictions}
          versions={versions}
          currentVersion={meta.version}
          patches={patches}
        />
      </Suspense>
      <CompendiumEntryLinkIndex
        gameLocale={gameLocale}
        title={serviceText.enchantmentsView.title}
        groups={[
          { type: "enchantment", entries: enchantments },
          { type: "affliction", heading: serviceText.afflictions, entries: afflictions },
        ]}
      />
    </>
  );
}

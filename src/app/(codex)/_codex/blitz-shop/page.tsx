import { Suspense } from "react";
import type { Metadata } from "next";
import { getCodexBlitzEntries } from "@/lib/codex-data";
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
import { BlitzEntryLibraryLoader } from "@/components/codex/blitz-entry-library-loader";
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
  const resourceId = firstRouteSearchParam(resolvedSearchParams.ware);
  const entries = resourceId ? await getCodexBlitzEntries({ gameLocale }) : null;
  const entry = entries ? findCodexResourceByRouteId(entries, resourceId) : undefined;
  if (entry) {
    return getCodexResourceOgMetadata(serviceLocale, getCodexServiceMessages(serviceLocale).blitzShop, entry);
  }
  return getCodexMetadata(serviceLocale, getCodexServiceMessages(serviceLocale).blitzShop, "/compendium/blitz-shop");
}

export default async function CodexBlitzShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [entries, gameUi] = await Promise.all([
    getCodexBlitzEntries({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  return (
    <>
      <Suspense>
        <BlitzEntryLibraryLoader
          serviceLocale={serviceLocale}
          gameLocale={gameLocale}
          gameUi={gameUi}
          title={getCodexServiceMessages(serviceLocale).blitzShop}
          entries={entries}
        />
      </Suspense>
      <CompendiumEntryLinkIndex
        gameLocale={gameLocale}
        title={getCodexServiceMessages(serviceLocale).blitzShop}
        groups={[{ type: "blitzEntry", entries: entries }]}
      />
    </>
  );
}

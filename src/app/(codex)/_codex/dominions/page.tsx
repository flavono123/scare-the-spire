import { Suspense } from "react";
import type { Metadata } from "next";
import { getCodexDominions } from "@/lib/codex-data";
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
import { DominionLibraryLoader } from "@/components/codex/dominion-library-loader";
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
  const resourceId = firstRouteSearchParam(resolvedSearchParams.dominion);
  const dominions = resourceId ? await getCodexDominions({ gameLocale }) : null;
  const dominion = dominions ? findCodexResourceByRouteId(dominions, resourceId) : undefined;
  if (dominion) {
    return getCodexResourceOgMetadata(serviceLocale, getCodexServiceMessages(serviceLocale).dominions, dominion);
  }
  return getCodexMetadata(serviceLocale, getCodexServiceMessages(serviceLocale).dominions, "/compendium/dominions");
}

export default async function CodexDominionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [dominions, gameUi] = await Promise.all([
    getCodexDominions({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  return (
    <>
      <Suspense>
        <DominionLibraryLoader
          serviceLocale={serviceLocale}
          gameLocale={gameLocale}
          gameUi={gameUi}
          title={getCodexServiceMessages(serviceLocale).dominions}
          dominions={dominions}
        />
      </Suspense>
      <CompendiumEntryLinkIndex
        gameLocale={gameLocale}
        title={getCodexServiceMessages(serviceLocale).dominions}
        groups={[{ type: "dominion", entries: dominions }]}
      />
    </>
  );
}

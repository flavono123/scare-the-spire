import { Suspense } from "react";
import type { Metadata } from "next";
import { getCodexKeywords } from "@/lib/codex-data";
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
import { KeywordLibraryLoader } from "@/components/codex/keyword-library-loader";
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
  const keywordId = firstRouteSearchParam(resolvedSearchParams.keyword);
  const [gameUi, keywords] = await Promise.all([
    getCodexGameUiLabels(gameLocale),
    keywordId ? getCodexKeywords({ gameLocale }) : Promise.resolve(null),
  ]);
  const keyword = keywords ? findCodexResourceByRouteId(keywords, keywordId) : undefined;
  if (keyword) {
    return getCodexResourceOgMetadata(serviceLocale, gameUi.nav.keywords, keyword);
  }
  return getCodexMetadata(serviceLocale, gameUi.nav.keywords, "/compendium/keywords");
}

export default async function CodexKeywordsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [keywords, gameUi] = await Promise.all([
    getCodexKeywords({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  return (
    <>
      <Suspense>
        <KeywordLibraryLoader
          gameLocale={gameLocale}
          serviceLocale={serviceLocale}
          gameUi={gameUi}
          title={gameUi.nav.keywords}
          keywords={keywords}
        />
      </Suspense>
      <CompendiumEntryLinkIndex
        gameLocale={gameLocale}
        title={gameUi.nav.keywords}
        groups={[{ type: "keyword", entries: keywords }]}
      />
    </>
  );
}

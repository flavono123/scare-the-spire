import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexCards, getCodexKeywords } from "@/lib/codex-data";
import { loadAllEntities } from "@/lib/load-all-entities";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  findCodexResourceByRouteId,
  getCodexResourceOgMetadata,
} from "@/lib/codex-resource-og";
import { KeywordDetail } from "@/components/codex/keyword-detail";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  const keywords = await getCodexKeywords();
  return keywords.map((keyword) => ({ id: keyword.id.toLowerCase() }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [keywords, gameUi] = await Promise.all([
    getCodexKeywords({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const keyword = findCodexResourceByRouteId(keywords, id);
  if (!keyword) return {};
  return getCodexResourceOgMetadata(serviceLocale, gameUi.nav.keywords, keyword);
}

export default async function KeywordDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [keywords, cards, entities, gameUi] = await Promise.all([
    getCodexKeywords({ gameLocale }),
    getCodexCards({ includeDeprecated: true, gameLocale }),
    loadAllEntities({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const keyword = keywords.find((item) => item.id.toLowerCase() === id.toLowerCase());
  if (!keyword) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <KeywordDetail
        serviceLocale={serviceLocale}
        gameUi={gameUi}
        backToListTitle={gameUi.nav.keywords}
        keyword={keyword}
        relatedCards={cards}
        entities={entities}
      />
    </div>
  );
}

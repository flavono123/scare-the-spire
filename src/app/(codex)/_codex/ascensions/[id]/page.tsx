import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexAscensions } from "@/lib/codex-data";
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
import { AscensionDetail } from "@/components/codex/ascension-detail";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  const ascensions = await getCodexAscensions();
  return ascensions.map((ascension) => ({ id: ascension.id.toLowerCase() }));
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
  const [ascensions, gameUi] = await Promise.all([
    getCodexAscensions({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const ascension = findCodexResourceByRouteId(ascensions, id);
  if (!ascension) return {};
  return getCodexResourceOgMetadata(serviceLocale, gameUi.nav.ascensions, {
    name: ascension.name,
    description: ascension.description,
    imageUrl: ascension.imageUrl,
  });
}

export default async function AscensionDetailPage({
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
  const [ascensions, entities, gameUi] = await Promise.all([
    getCodexAscensions({ gameLocale }),
    loadAllEntities({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const ascension = ascensions.find((item) => (
    item.id.toLowerCase() === id.toLowerCase() || String(item.level) === id
  ));
  if (!ascension) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AscensionDetail
        serviceLocale={serviceLocale}
        gameUi={gameUi}
        backToListTitle={gameUi.nav.ascensions}
        ascension={ascension}
        entities={entities}
      />
    </div>
  );
}

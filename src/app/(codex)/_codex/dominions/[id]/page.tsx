import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexDominions } from "@/lib/codex-data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { getCodexServiceMessages } from "@/lib/codex-service";
import {
  findCodexResourceByRouteId,
  getCodexResourceOgMetadata,
} from "@/lib/codex-resource-og";
import { DominionDetailLoader } from "@/components/codex/dominion-detail-loader";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  const dominions = await getCodexDominions();
  return dominions.map((dominion) => ({ id: dominion.id.toLowerCase() }));
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
  const dominions = await getCodexDominions({ gameLocale });
  const dominion = findCodexResourceByRouteId(dominions, id);
  if (!dominion) return {};
  return getCodexResourceOgMetadata(serviceLocale, getCodexServiceMessages(serviceLocale).dominions, dominion);
}

export default async function DominionDetailPage({
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
  const [dominions, gameUi] = await Promise.all([
    getCodexDominions({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const dominion = dominions.find((item) => item.id.toLowerCase() === id.toLowerCase());
  if (!dominion) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DominionDetailLoader
        gameLocale={gameLocale}
        serviceLocale={serviceLocale}
        gameUi={gameUi}
        backToListTitle={getCodexServiceMessages(serviceLocale).dominions}
        dominion={dominion}
      />
    </div>
  );
}

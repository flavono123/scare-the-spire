import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexBlitzEntries } from "@/lib/codex-data";
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
import { BlitzEntryDetailLoader } from "@/components/codex/blitz-entry-detail-loader";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  const entries = await getCodexBlitzEntries();
  return entries.map((entry) => ({ id: entry.id.toLowerCase() }));
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
  const entries = await getCodexBlitzEntries({ gameLocale });
  const entry = findCodexResourceByRouteId(entries, id);
  if (!entry) return {};
  return getCodexResourceOgMetadata(serviceLocale, getCodexServiceMessages(serviceLocale).blitzShop, entry);
}

export default async function BlitzEntryDetailPage({
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
  const [entries, gameUi] = await Promise.all([
    getCodexBlitzEntries({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const entry = entries.find((item) => item.id.toLowerCase() === id.toLowerCase());
  if (!entry) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <BlitzEntryDetailLoader
        gameLocale={gameLocale}
        serviceLocale={serviceLocale}
        gameUi={gameUi}
        backToListTitle={getCodexServiceMessages(serviceLocale).blitzShop}
        entry={entry}
      />
    </div>
  );
}

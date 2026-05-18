import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexCards, getCodexEnchantments, getCodexEvents } from "@/lib/codex-data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMetadata } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { CardDetail } from "@/components/codex/card-detail";
import {
  getMadScienceCardTypeFromId,
  getMadScienceVariantId,
} from "@/lib/tinker-time";

function findCardByRouteId<T extends { id: string }>(cards: T[], id: string): T | undefined {
  const madScienceType = getMadScienceCardTypeFromId(id);
  const resolvedId = madScienceType ? getMadScienceVariantId(madScienceType) : id;
  return cards.find((c) => c.id.toLowerCase() === resolvedId.toLowerCase());
}

export async function generateStaticParams() {
  const cards = await getCodexCards();
  return cards.map((c) => ({ id: c.id.toLowerCase() }));
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
  const [cards, gameUi] = await Promise.all([
    getCodexCards({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const card = findCardByRouteId(cards, id);
  if (!card) return {};
  return getCodexMetadata(serviceLocale, `${card.name} — ${gameUi.cardLibraryTitle}`);
}

export default async function CardDetailPage({
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
  const [cards, enchantments, gameUi, events] = await Promise.all([
    getCodexCards({ gameLocale }),
    getCodexEnchantments({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
    getCodexEvents({ gameLocale }),
  ]);
  const card = findCardByRouteId(cards, id);
  if (!card) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <CardDetail serviceLocale={serviceLocale} gameUi={gameUi} card={card} enchantments={enchantments} relatedEvents={events} />
    </div>
  );
}

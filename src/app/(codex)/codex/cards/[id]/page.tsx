import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexCards, getCodexEnchantments } from "@/lib/codex-data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMetadata, getCodexServiceMessages } from "@/lib/codex-service";
import { CardDetail } from "@/components/codex/card-detail";

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
  const serviceText = getCodexServiceMessages(serviceLocale);
  const cards = await getCodexCards({ gameLocale });
  const card = cards.find((c) => c.id.toLowerCase() === id.toLowerCase());
  if (!card) return {};
  return getCodexMetadata(serviceLocale, `${card.name} — ${serviceText.cardsView.title}`);
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
  const [cards, enchantments] = await Promise.all([
    getCodexCards({ gameLocale }),
    getCodexEnchantments({ gameLocale }),
  ]);
  const card = cards.find((c) => c.id.toLowerCase() === id.toLowerCase());
  if (!card) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <CardDetail serviceLocale={serviceLocale} card={card} enchantments={enchantments} />
    </div>
  );
}

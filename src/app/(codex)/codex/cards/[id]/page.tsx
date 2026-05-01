import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexCards, getCodexEnchantments } from "@/lib/codex-data";
import { getGameLocaleFromSearchRecord } from "@/lib/i18n";
import { CardDetail } from "@/components/codex/card-detail";

export async function generateStaticParams() {
  const cards = await getCodexCards();
  return cards.map((c) => ({ id: c.id.toLowerCase() }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const cards = await getCodexCards();
  const card = cards.find((c) => c.id.toLowerCase() === id.toLowerCase());
  if (!card) return {};
  return {
    title: `${card.name} — 슬서운 카드 도서관`,
    description: `${card.name} (${card.nameEn}) — ${card.type} · ${card.rarity}`,
  };
}

export default async function CardDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const gameLocale = getGameLocaleFromSearchRecord(await searchParams);
  const [cards, enchantments] = await Promise.all([
    getCodexCards({ gameLocale }),
    getCodexEnchantments(),
  ]);
  const card = cards.find((c) => c.id.toLowerCase() === id.toLowerCase());
  if (!card) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <CardDetail card={card} enchantments={enchantments} />
    </div>
  );
}

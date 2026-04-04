import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexCards } from "@/lib/codex-data";
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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cards = await getCodexCards();
  const card = cards.find((c) => c.id.toLowerCase() === id.toLowerCase());
  if (!card) notFound();

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-gray-200">
      <CardDetail card={card} />
    </div>
  );
}

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexPotions } from "@/lib/codex-data";
import { PotionDetail } from "@/components/codex/potion-detail";
import { POTION_RARITY_CONFIG } from "@/lib/codex-types";

export async function generateStaticParams() {
  const potions = await getCodexPotions();
  return potions.map((p) => ({ id: p.id.toLowerCase() }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const potions = await getCodexPotions();
  const potion = potions.find((p) => p.id.toLowerCase() === id.toLowerCase());
  if (!potion) return {};
  return {
    title: `${potion.name} — 슬서운 포션 도감`,
    description: `${potion.name} (${potion.nameEn}) — ${POTION_RARITY_CONFIG[potion.rarity].label}`,
  };
}

export default async function PotionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const potions = await getCodexPotions();
  const potion = potions.find((p) => p.id.toLowerCase() === id.toLowerCase());
  if (!potion) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PotionDetail potion={potion} />
    </div>
  );
}

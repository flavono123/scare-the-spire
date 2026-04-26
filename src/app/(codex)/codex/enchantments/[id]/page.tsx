import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexEnchantments, getCodexRelics } from "@/lib/codex-data";
import { loadAllEntities } from "@/lib/load-all-entities";
import { EnchantmentDetail } from "@/components/codex/enchantment-detail";
import { ENCHANTMENT_CARD_TYPE_CONFIG, type EnchantmentCardTypeFilter } from "@/lib/codex-types";

export async function generateStaticParams() {
  const enchantments = await getCodexEnchantments();
  return enchantments.map((e) => ({ id: e.id.toLowerCase() }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const enchantments = await getCodexEnchantments();
  const ench = enchantments.find((e) => e.id.toLowerCase() === id.toLowerCase());
  if (!ench) return {};
  const cardTypeFilter: EnchantmentCardTypeFilter = ench.cardType ?? "Any";
  return {
    title: `${ench.name} — 슬서운 인챈트 도감`,
    description: `${ench.name} (${ench.nameEn}) — ${ENCHANTMENT_CARD_TYPE_CONFIG[cardTypeFilter].label}`,
  };
}

export default async function EnchantmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [enchantments, relics, entities] = await Promise.all([
    getCodexEnchantments(),
    getCodexRelics(),
    loadAllEntities(),
  ]);
  const ench = enchantments.find((e) => e.id.toLowerCase() === id.toLowerCase());
  if (!ench) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <EnchantmentDetail enchantment={ench} entities={entities} relics={relics} />
    </div>
  );
}

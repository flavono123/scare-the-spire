import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexEnchantments, getCodexRelics } from "@/lib/codex-data";
import { loadAllEntities } from "@/lib/load-all-entities";
import { getSTS2Patches, getSTS2Changes, getEntityVersionDiffs } from "@/lib/data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMetadata, getCodexServiceMessages } from "@/lib/codex-service";
import { EnchantmentDetail } from "@/components/codex/enchantment-detail";

export async function generateStaticParams() {
  const enchantments = await getCodexEnchantments();
  return enchantments.map((e) => ({ id: e.id.toLowerCase() }));
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
  const enchantments = await getCodexEnchantments({ gameLocale });
  const ench = enchantments.find((e) => e.id.toLowerCase() === id.toLowerCase());
  if (!ench) return {};
  return getCodexMetadata(serviceLocale, `${ench.name} — ${serviceText.enchantmentsView.title}`);
}

export default async function EnchantmentDetailPage({
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
  const [enchantments, relics, entities, patches, changes, versionDiffs] = await Promise.all([
    getCodexEnchantments({ gameLocale }),
    getCodexRelics({ gameLocale }),
    loadAllEntities({ gameLocale }),
    getSTS2Patches(),
    getSTS2Changes(),
    getEntityVersionDiffs(),
  ]);
  const ench = enchantments.find((e) => e.id.toLowerCase() === id.toLowerCase());
  if (!ench) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <EnchantmentDetail serviceLocale={serviceLocale} enchantment={ench} entities={entities} relics={relics} patches={patches} changes={changes} versionDiffs={versionDiffs} />
    </div>
  );
}

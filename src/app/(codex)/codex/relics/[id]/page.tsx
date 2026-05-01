import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexRelics } from "@/lib/codex-data";
import { loadAllEntities } from "@/lib/load-all-entities";
import { getGameLocaleFromSearchRecord } from "@/lib/i18n";
import { RelicDetail } from "@/components/codex/relic-detail";
import { RELIC_RARITY_LABELS } from "@/lib/codex-types";

export async function generateStaticParams() {
  const relics = await getCodexRelics();
  return relics.map((r) => ({ id: r.id.toLowerCase() }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const relics = await getCodexRelics();
  const relic = relics.find((r) => r.id.toLowerCase() === id.toLowerCase());
  if (!relic) return {};
  return {
    title: `${relic.name} — 슬서운 유물 도감`,
    description: `${relic.name} (${relic.nameEn}) — ${RELIC_RARITY_LABELS[relic.rarity]}`,
  };
}

export default async function RelicDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const gameLocale = getGameLocaleFromSearchRecord(await searchParams);
  const [relics, entities] = await Promise.all([
    getCodexRelics({ gameLocale }),
    loadAllEntities({ gameLocale }),
  ]);
  const relic = relics.find((r) => r.id.toLowerCase() === id.toLowerCase());
  if (!relic) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <RelicDetail relic={relic} entities={entities} />
    </div>
  );
}

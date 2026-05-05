import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexPotions } from "@/lib/codex-data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMetadata } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { PotionDetail } from "@/components/codex/potion-detail";

export async function generateStaticParams() {
  const potions = await getCodexPotions();
  return potions.map((p) => ({ id: p.id.toLowerCase() }));
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
  const [potions, gameUi] = await Promise.all([
    getCodexPotions({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const potion = potions.find((p) => p.id.toLowerCase() === id.toLowerCase());
  if (!potion) return {};
  return getCodexMetadata(serviceLocale, `${potion.name} — ${gameUi.potionLabTitle}`);
}

export default async function PotionDetailPage({
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
  const [potions, gameUi] = await Promise.all([
    getCodexPotions({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const potion = potions.find((p) => p.id.toLowerCase() === id.toLowerCase());
  if (!potion) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PotionDetail serviceLocale={serviceLocale} backToListTitle={gameUi.potionLabTitle} potion={potion} />
    </div>
  );
}

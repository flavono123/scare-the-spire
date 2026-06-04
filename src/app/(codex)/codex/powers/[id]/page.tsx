import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexCards, getCodexEnchantments, getCodexEvents, getCodexMonsters, getCodexPotions, getCodexPowers, getCodexRelics } from "@/lib/codex-data";
import { loadAllEntities } from "@/lib/load-all-entities";
import { getSTS2Patches, getSTS2Changes, getEntityVersionDiffs } from "@/lib/data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  findCodexResourceByRouteId,
  getCodexResourceOgMetadata,
} from "@/lib/codex-resource-og";
import { PowerDetail } from "@/components/codex/power-detail";

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
  const [powers, gameUi] = await Promise.all([
    getCodexPowers({ includeDeprecated: true, gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const power = findCodexResourceByRouteId(powers, id);
  if (!power) return {};
  return getCodexResourceOgMetadata(serviceLocale, gameUi.nav.powers, power);
}

export default async function PowerDetailPage({
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
  const [powers, cards, relics, potions, enchantments, events, monsters, entities, patches, changes, versionDiffs, gameUi] = await Promise.all([
    getCodexPowers({ includeDeprecated: true, gameLocale }),
    getCodexCards({ includeDeprecated: true, gameLocale }),
    getCodexRelics({ gameLocale }),
    getCodexPotions({ gameLocale }),
    getCodexEnchantments({ gameLocale }),
    getCodexEvents({ gameLocale }),
    getCodexMonsters({ gameLocale }),
    loadAllEntities({ gameLocale }),
    getSTS2Patches(),
    getSTS2Changes(),
    getEntityVersionDiffs(),
    getCodexGameUiLabels(gameLocale),
  ]);
  const power = powers.find((p) => p.id.toLowerCase() === id.toLowerCase());
  if (!power) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PowerDetail serviceLocale={serviceLocale} gameUi={gameUi} backToListTitle={gameUi.nav.powers} power={power} entities={entities} relatedCards={cards} relatedRelics={relics} relatedPotions={potions} relatedEnchantments={enchantments} relatedEvents={events} relatedMonsters={monsters} patches={patches} changes={changes} versionDiffs={versionDiffs} />
    </div>
  );
}

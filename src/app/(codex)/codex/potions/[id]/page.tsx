import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexCards, getCodexCharacters, getCodexEnchantments, getCodexEvents, getCodexPotions, getCodexPowers } from "@/lib/codex-data";
import { loadAllEntities } from "@/lib/load-all-entities";
import { getSTS2Patches, getSTS2Changes, getEntityVersionDiffs } from "@/lib/data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMetadata, getCodexServiceMessages } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import type { PotionPool } from "@/lib/codex-types";
import { PotionDetail } from "@/components/codex/potion-detail";

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
  const [potions, cards, characters, enchantments, patches, changes, versionDiffs, gameUi, events, powers, entities] = await Promise.all([
    getCodexPotions({ gameLocale }),
    getCodexCards({ includeDeprecated: true, gameLocale }),
    getCodexCharacters({ gameLocale }),
    getCodexEnchantments({ gameLocale }),
    getSTS2Patches(),
    getSTS2Changes(),
    getEntityVersionDiffs(),
    getCodexGameUiLabels(gameLocale),
    getCodexEvents({ gameLocale }),
    getCodexPowers({ includeDeprecated: true, gameLocale }),
    loadAllEntities({ gameLocale }),
  ]);
  const potion = potions.find((p) => p.id.toLowerCase() === id.toLowerCase());
  if (!potion) notFound();
  const serviceText = getCodexServiceMessages(serviceLocale);
  const poolLabels: Record<PotionPool, string> = {
    shared: serviceText.labels.pools.shared,
    event: gameUi.eventsTitle,
    ironclad: serviceText.labels.pools.ironclad,
    silent: serviceText.labels.pools.silent,
    defect: serviceText.labels.pools.defect,
    necrobinder: serviceText.labels.pools.necrobinder,
    regent: serviceText.labels.pools.regent,
  };
  for (const character of characters) {
    poolLabels[character.id.toLowerCase() as PotionPool] = character.name;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PotionDetail serviceLocale={serviceLocale} gameUi={gameUi} backToListTitle={gameUi.potionLabTitle} potion={potion} poolLabels={poolLabels} relatedCards={cards} relatedEnchantments={enchantments} relatedEvents={events} relatedPowers={powers} patches={patches} changes={changes} versionDiffs={versionDiffs} entities={entities} />
    </div>
  );
}

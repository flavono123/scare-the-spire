import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexAncients, getCodexCharacters, getCodexEnchantments, getCodexEvents, getCodexMonsters, getCodexPowers, getCodexRelics } from "@/lib/codex-data";
import { loadAllEntities } from "@/lib/load-all-entities";
import { getSTS2Patches, getSTS2Changes, getEntityVersionDiffs } from "@/lib/data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMetadata, getCodexServiceMessages } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import type { RelicPool } from "@/lib/codex-types";
import { RelicDetail } from "@/components/codex/relic-detail";

export async function generateStaticParams() {
  const relics = await getCodexRelics();
  return relics.map((r) => ({ id: r.id.toLowerCase() }));
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
  const [relics, gameUi] = await Promise.all([
    getCodexRelics({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const relic = relics.find((r) => r.id.toLowerCase() === id.toLowerCase());
  if (!relic) return {};
  return getCodexMetadata(serviceLocale, `${relic.name} — ${gameUi.relicCollectionTitle}`);
}

export default async function RelicDetailPage({
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
  const [relics, characters, events, ancients, enchantments, monsters, powers, entities, patches, changes, versionDiffs, gameUi] = await Promise.all([
    getCodexRelics({ gameLocale }),
    getCodexCharacters({ gameLocale }),
    getCodexEvents({ gameLocale }),
    getCodexAncients({ gameLocale }),
    getCodexEnchantments({ gameLocale }),
    getCodexMonsters({ gameLocale }),
    getCodexPowers({ gameLocale }),
    loadAllEntities({ gameLocale }),
    getSTS2Patches(),
    getSTS2Changes(),
    getEntityVersionDiffs(),
    getCodexGameUiLabels(gameLocale),
  ]);
  const relic = relics.find((r) => r.id.toLowerCase() === id.toLowerCase());
  if (!relic) notFound();
  const serviceText = getCodexServiceMessages(serviceLocale);
  const poolLabels: Record<RelicPool, string> = {
    shared: serviceText.labels.pools.shared,
    ironclad: serviceText.labels.pools.ironclad,
    silent: serviceText.labels.pools.silent,
    defect: serviceText.labels.pools.defect,
    necrobinder: serviceText.labels.pools.necrobinder,
    regent: serviceText.labels.pools.regent,
  };
  for (const character of characters) {
    poolLabels[character.id.toLowerCase() as RelicPool] = character.name;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <RelicDetail serviceLocale={serviceLocale} gameUi={gameUi} backToListTitle={gameUi.relicCollectionTitle} relic={relic} poolLabels={poolLabels} entities={entities} relatedEvents={events} relatedAncients={ancients} relatedEnchantments={enchantments} relatedMonsters={monsters} relatedPowers={powers} patches={patches} changes={changes} versionDiffs={versionDiffs} />
    </div>
  );
}

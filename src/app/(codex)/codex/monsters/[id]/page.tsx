import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexCards, getCodexEncounters, getCodexMonsters, getCodexPotions, getCodexRelics } from "@/lib/codex-data";
import { getSTS2Patches, getSTS2Changes } from "@/lib/data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMetadata } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { MonsterDetail } from "@/components/codex/monster-detail";

export async function generateStaticParams() {
  const monsters = await getCodexMonsters();
  return monsters.map((m) => ({ id: m.id.toLowerCase() }));
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
  const [monsters, gameUi] = await Promise.all([
    getCodexMonsters({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const monster = monsters.find((m) => m.id.toLowerCase() === id.toLowerCase());
  if (!monster) return {};
  return getCodexMetadata(serviceLocale, `${monster.name} — ${gameUi.bestiaryTitle}`);
}

export default async function MonsterDetailPage({
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
  const [monsters, encounters, cards, potions, relics, patches, changes, gameUi] = await Promise.all([
    getCodexMonsters({ gameLocale }),
    getCodexEncounters({ gameLocale }),
    getCodexCards({ gameLocale }),
    getCodexPotions({ gameLocale }),
    getCodexRelics({ gameLocale }),
    getSTS2Patches(),
    getSTS2Changes(),
    getCodexGameUiLabels(gameLocale),
  ]);
  const monster = monsters.find((m) => m.id.toLowerCase() === id.toLowerCase());
  if (!monster) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MonsterDetail
        serviceLocale={serviceLocale}
        gameUi={gameUi}
        backToListTitle={gameUi.bestiaryTitle}
        monster={monster}
        encounters={encounters}
        relatedCards={cards}
        relatedPotions={potions}
        relatedRelics={relics}
        patches={patches}
        changes={changes}
      />
    </div>
  );
}

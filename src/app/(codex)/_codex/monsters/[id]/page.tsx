import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexAfflictions, getCodexCards, getCodexEncounters, getCodexMonsters, getCodexPowers } from "@/lib/codex-data";
import { getSTS2Patches, getSTS2Changes } from "@/lib/data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { isPublicBestiaryMonster } from "@/lib/bestiary-monster-policy";
import {
  getCodexMonsterOgResource,
  getCodexResourceOgMetadata,
} from "@/lib/codex-resource-og";
import { MonsterDetail } from "@/components/codex/monster-detail";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  const monsters = await getCodexMonsters();
  return monsters
    .filter((monster) => monster.showInCompendium && isPublicBestiaryMonster(monster.id))
    .map((monster) => ({ id: monster.id.toLowerCase() }));
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
  const monster = monsters.find((m) => (
    m.id.toLowerCase() === id.toLowerCase() &&
    m.showInCompendium &&
    isPublicBestiaryMonster(m.id)
  ));
  if (!monster) return {};
  return getCodexResourceOgMetadata(
    serviceLocale,
    gameUi.bestiaryTitle,
    getCodexMonsterOgResource(monster, gameUi),
  );
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
  const [monsters, encounters, afflictions, cards, powers, patches, changes, gameUi] = await Promise.all([
    getCodexMonsters({ gameLocale }),
    getCodexEncounters({ gameLocale }),
    getCodexAfflictions({ gameLocale }),
    getCodexCards({ includeDeprecated: true, gameLocale }),
    getCodexPowers({ includeDeprecated: true, gameLocale }),
    getSTS2Patches(),
    getSTS2Changes(),
    getCodexGameUiLabels(gameLocale),
  ]);
  const monster = monsters.find((m) => (
    m.id.toLowerCase() === id.toLowerCase() &&
    m.showInCompendium &&
    isPublicBestiaryMonster(m.id)
  ));
  if (!monster) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MonsterDetail
        serviceLocale={serviceLocale}
        gameUi={gameUi}
        backToListTitle={gameUi.bestiaryTitle}
        monster={monster}
        monsters={monsters}
        encounters={encounters}
        afflictions={afflictions}
        cards={cards}
        powers={powers}
        patches={patches}
        changes={changes}
      />
    </div>
  );
}

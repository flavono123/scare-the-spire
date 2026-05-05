import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexMonsters, getCodexEncounters } from "@/lib/codex-data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMetadata, getCodexServiceMessages } from "@/lib/codex-service";
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
  const serviceText = getCodexServiceMessages(serviceLocale);
  const monsters = await getCodexMonsters({ gameLocale });
  const monster = monsters.find((m) => m.id.toLowerCase() === id.toLowerCase());
  if (!monster) return {};
  return getCodexMetadata(serviceLocale, `${monster.name} — ${serviceText.monstersView.title}`);
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
  const [monsters, encounters] = await Promise.all([
    getCodexMonsters({ gameLocale }),
    getCodexEncounters({ gameLocale }),
  ]);
  const monster = monsters.find((m) => m.id.toLowerCase() === id.toLowerCase());
  if (!monster) notFound();

  const monsterEncounters = encounters.filter((e) =>
    e.monsters.some((m) => m.id === monster.id),
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MonsterDetail
        serviceLocale={serviceLocale}
        monster={monster}
        encounters={monsterEncounters}
        allMonsters={monsters}
      />
    </div>
  );
}

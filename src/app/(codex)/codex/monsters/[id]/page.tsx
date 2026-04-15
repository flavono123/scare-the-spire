import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexMonsters, getCodexEncounters } from "@/lib/codex-data";
import { MonsterDetail } from "@/components/codex/monster-detail";
import { MONSTER_TYPE_CONFIG } from "@/lib/codex-types";

export async function generateStaticParams() {
  const monsters = await getCodexMonsters();
  return monsters.map((m) => ({ id: m.id.toLowerCase() }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const monsters = await getCodexMonsters();
  const monster = monsters.find((m) => m.id.toLowerCase() === id.toLowerCase());
  if (!monster) return {};
  return {
    title: `${monster.name} — 슬서운 몬스터 도감`,
    description: `${monster.name} (${monster.nameEn}) — ${MONSTER_TYPE_CONFIG[monster.type].label}`,
  };
}

export default async function MonsterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [monsters, encounters] = await Promise.all([
    getCodexMonsters(),
    getCodexEncounters(),
  ]);
  const monster = monsters.find((m) => m.id.toLowerCase() === id.toLowerCase());
  if (!monster) notFound();

  const monsterEncounters = encounters.filter((e) =>
    e.monsters.some((m) => m.id === monster.id),
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MonsterDetail
        monster={monster}
        encounters={monsterEncounters}
        allMonsters={monsters}
      />
    </div>
  );
}

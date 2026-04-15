import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getCodexMonsters, getCodexEncounters } from "@/lib/codex-data";
import { ENCOUNTER_ROOM_TYPE_CONFIG, EVENT_ACT_CONFIG, EVENT_ACT_UNKNOWN } from "@/lib/codex-types";
import { DescriptionText } from "@/components/codex/codex-description";

export async function generateStaticParams() {
  const encounters = await getCodexEncounters();
  return encounters.map((e) => ({ id: e.id.toLowerCase() }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const encounters = await getCodexEncounters();
  const encounter = encounters.find((e) => e.id.toLowerCase() === id.toLowerCase());
  if (!encounter) return {};
  const roomConfig = ENCOUNTER_ROOM_TYPE_CONFIG[encounter.roomType];
  return {
    title: `${encounter.name} — 슬서운 전투 도감`,
    description: `${encounter.name} (${encounter.nameEn}) — ${roomConfig.label}`,
  };
}

export default async function EncounterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [encounters, monsters] = await Promise.all([
    getCodexEncounters(),
    getCodexMonsters(),
  ]);
  const encounter = encounters.find((e) => e.id.toLowerCase() === id.toLowerCase());
  if (!encounter) notFound();

  const monsterById = new Map(monsters.map((m) => [m.id, m]));
  const roomConfig = ENCOUNTER_ROOM_TYPE_CONFIG[encounter.roomType];
  const actConfig = encounter.act ? EVENT_ACT_CONFIG[encounter.act] : EVENT_ACT_UNKNOWN;

  const uniqueMonsters = Array.from(
    new Map(encounter.monsters.map((m) => [m.id, m])).values(),
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-2xl mx-auto">
        {/* Header */}
        <Link href="/codex/encounters" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">
          ← 전투 도감
        </Link>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-100">{encounter.name}</h1>
          <p className="text-sm text-gray-500">{encounter.nameEn}</p>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap justify-center gap-2">
          <span className="text-xs font-medium px-2.5 py-1 rounded-lg" style={{ backgroundColor: `${roomConfig.color}20`, color: roomConfig.color }}>
            {roomConfig.label}
          </span>
          <span className={`text-xs px-2.5 py-1 rounded-lg ${actConfig.bg} ${actConfig.color}`}>
            {actConfig.labelKo}
          </span>
          {encounter.isWeak && (
            <span className="text-xs text-green-400 bg-green-500/10 px-2.5 py-1 rounded-lg">쉬운 전투</span>
          )}
          {encounter.tags?.map((tag) => (
            <span key={tag} className="text-xs text-gray-400 bg-white/5 px-2.5 py-1 rounded-lg">{tag}</span>
          ))}
        </div>

        {/* Monster Composition */}
        <div className="w-full bg-white/5 border border-white/10 rounded-lg p-4">
          <h2 className="text-sm font-bold text-gray-300 mb-3">몬스터 구성</h2>
          <div className="flex flex-col gap-2">
            {uniqueMonsters.map((mRef) => {
              const monster = monsterById.get(mRef.id);
              const imgUrl = monster?.imageUrl ?? monster?.bossImageUrl;

              return (
                <Link
                  key={mRef.id}
                  href={`/codex/monsters/${mRef.id.toLowerCase()}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 hover:bg-white/10 hover:border-yellow-500/30 transition-all"
                >
                  {imgUrl ? (
                    <div className="w-10 h-10 shrink-0 rounded overflow-hidden bg-white/5 flex items-center justify-center">
                      <Image src={imgUrl} alt={mRef.name} width={40} height={40} className="w-10 h-10 object-contain" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 shrink-0 rounded bg-white/10 flex items-center justify-center">
                      <span className="text-xs text-gray-500">{mRef.name[0]}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-100">{mRef.name}</span>
                    <span className="ml-1.5 text-[10px] text-gray-500">{mRef.nameEn}</span>
                    {monster && monster.minHp != null && monster.minHp !== 9999 && (
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-500">
                          HP {monster.minHp}{monster.maxHp != null && monster.maxHp !== monster.minHp ? `-${monster.maxHp}` : ""}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-600">→</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Loss Text */}
        <div className="w-full bg-white/5 border border-white/10 rounded-lg p-4">
          <h2 className="text-sm font-bold text-gray-300 mb-2">패배 시</h2>
          <div className="text-sm text-gray-400 italic">
            <DescriptionText description={encounter.lossText} />
          </div>
        </div>
      </div>
    </div>
  );
}

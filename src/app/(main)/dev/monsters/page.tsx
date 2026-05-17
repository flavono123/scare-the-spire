import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "@/components/ui/static-image";
import {
  BESTIARY_DEV_MONSTER_GROUPS,
  getForcedBestiaryAct,
} from "@/lib/bestiary-monster-policy";
import { getCodexEncounters, getCodexMonsters } from "@/lib/codex-data";
import { EVENT_ACT_CONFIG } from "@/lib/codex-types";
import type { CodexEncounter, CodexMonster, EventAct } from "@/lib/codex-types";

export const metadata = {
  title: "몬스터 정리 — DEV",
  description: "DEV — bestiary에서 숨기거나 보정하는 몬스터 분류",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DevMonstersPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const [monsters, encounters] = await Promise.all([
    getCodexMonsters({ gameLocale: "kor" }),
    getCodexEncounters({ gameLocale: "kor" }),
  ]);
  const monstersById = new Map(monsters.map((monster) => [monster.id, monster]));
  const encountersByMonster = buildEncountersByMonster(encounters);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300/80">
          DEV / BESTIARY TRIAGE
        </p>
        <h1 className="text-3xl font-bold text-zinc-100">몬스터 도감 분류 정리</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-zinc-400">
          공개 도감에서 숨길 항목, 하수인처럼 막을 보정해 남길 항목, 그리고 나중에 별도 서비스로 옮길 후보를 확인하는 개발 전용 페이지입니다.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {BESTIARY_DEV_MONSTER_GROUPS.map((group) => (
          <div key={group.id} className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="text-sm font-semibold text-zinc-100">{group.label}</div>
            <div className="mt-1 text-xs text-zinc-500">{group.monsterIds.length}개</div>
            <div className="mt-2 text-[11px] leading-relaxed text-zinc-400">{group.description}</div>
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-8">
        {BESTIARY_DEV_MONSTER_GROUPS.map((group) => (
          <section key={group.id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-2">
              <div>
                <h2 className="text-xl font-bold text-zinc-100">{group.label}</h2>
                <p className="mt-1 text-xs text-zinc-500">{group.description}</p>
              </div>
              <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-zinc-400">
                {group.publicTreatment === "forced-act" ? "공개 도감 유지 + 막 보정" : "공개 도감 숨김"}
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full min-w-[58rem] border-separate border-spacing-0 text-left text-sm">
                <thead className="bg-white/[0.04] text-[11px] uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">몬스터</th>
                    <th className="px-3 py-2 font-medium">ID</th>
                    <th className="px-3 py-2 font-medium">타입</th>
                    <th className="px-3 py-2 font-medium">공개 플래그</th>
                    <th className="px-3 py-2 font-medium">보정 막</th>
                    <th className="px-3 py-2 font-medium">연결 전투</th>
                    <th className="px-3 py-2 font-medium">Spine</th>
                  </tr>
                </thead>
                <tbody>
                  {group.monsterIds.map((monsterId) => (
                    <MonsterDevRow
                      key={monsterId}
                      monsterId={monsterId}
                      monster={monstersById.get(monsterId) ?? null}
                      encounters={encountersByMonster.get(monsterId) ?? []}
                      detailHref={group.id === "pet" ? `/dev/monsters/${monsterId.toLowerCase()}` : null}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

function MonsterDevRow({
  monsterId,
  monster,
  encounters,
  detailHref,
}: {
  monsterId: string;
  monster: CodexMonster | null;
  encounters: CodexEncounter[];
  detailHref: string | null;
}) {
  const imageSrc = monster?.imageUrl ?? monster?.bossImageUrl ?? null;
  const forcedAct = getForcedBestiaryAct(monsterId);
  const title = (
    <div className="min-w-0">
      <div className="truncate font-medium text-zinc-100">{monster?.name ?? "데이터 없음"}</div>
      {monster && <div className="truncate text-xs text-zinc-500">{monster.nameEn}</div>}
    </div>
  );

  return (
    <tr className="border-t border-white/10 odd:bg-white/[0.015]">
      <td className="px-3 py-2">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-black/20">
            {imageSrc ? (
              <Image
                src={imageSrc}
                alt={monster?.name ?? monsterId}
                width={48}
                height={48}
                className="max-h-12 max-w-12 object-contain"
              />
            ) : (
              <span className="text-xs text-zinc-600">no art</span>
            )}
          </div>
          {detailHref ? (
            <Link href={detailHref} className="min-w-0 underline-offset-4 hover:underline">
              {title}
            </Link>
          ) : title}
        </div>
      </td>
      <td className="px-3 py-2 font-mono text-xs text-zinc-400">{monsterId}</td>
      <td className="px-3 py-2 text-xs text-zinc-300">{monster?.type ?? "-"}</td>
      <td className="px-3 py-2 text-xs text-zinc-300">
        {monster ? (monster.showInCompendium ? "show" : "hide") : "-"}
      </td>
      <td className="px-3 py-2">{forcedAct ? <ActBadge act={forcedAct} /> : <span className="text-xs text-zinc-600">-</span>}</td>
      <td className="px-3 py-2">
        {encounters.length > 0 ? (
          <div className="flex flex-col gap-1">
            {encounters.map((encounter) => (
              <span key={encounter.id} className="text-xs text-zinc-300">
                {encounter.name}
                {encounter.act && <span className="ml-1 text-zinc-500">({actLabel(encounter.act)})</span>}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-zinc-600">없음</span>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-zinc-300">
        {monster?.spineAsset ? (
          <span>
            {monster.spineAsset.animations.length} anim / {monster.spineAsset.skins.length} skin
          </span>
        ) : (
          <span className="text-zinc-600">없음</span>
        )}
      </td>
    </tr>
  );
}

function ActBadge({ act }: { act: EventAct }) {
  const config = EVENT_ACT_CONFIG[act];

  return (
    <span className={`rounded border px-2 py-0.5 text-[11px] ${config.border} ${config.bg} ${config.color}`}>
      {config.labelKo}
    </span>
  );
}

function actLabel(act: EventAct): string {
  return EVENT_ACT_CONFIG[act]?.labelKo ?? act;
}

function buildEncountersByMonster(encounters: CodexEncounter[]): Map<string, CodexEncounter[]> {
  const map = new Map<string, CodexEncounter[]>();
  for (const encounter of encounters) {
    for (const monster of encounter.monsters) {
      const list = map.get(monster.id) ?? [];
      list.push(encounter);
      map.set(monster.id, list);
    }
  }
  return map;
}

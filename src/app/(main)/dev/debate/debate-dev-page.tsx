"use client";

import { useMemo, useState } from "react";
import Image from "@/components/ui/static-image";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { useCommentEntities } from "@/hooks/use-comment-entities";
import { useDebateSchedule } from "@/hooks/use-open-debate-cycle";
import { scheduleDebateCycle } from "@/app/(main)/dev/debate/actions";
import { matchEntities } from "@/lib/chemical-utils";
import { compendiumTypeLabels } from "@/lib/compendium-type-labels";
import {
  DEBATE_GAME_VERSION,
  debatePoolAllows,
  debateWeekStart,
  upcomingDebateWeeks,
  type DebatePool,
} from "@/lib/debate-cycle";
import { DEBATE_HREF, DEBATE_TOKEN_SRC } from "@/lib/debate";
import { supabaseEnv } from "@/lib/supabase";
import Link from "next/link";

function poolLabel(pool: DebatePool, typeLabels: Record<string, string>): string {
  if (pool === "mixed") return "타입 없이";
  return typeLabels[pool] ?? pool;
}

export function DebateDevPage() {
  const weeks = useMemo(() => upcomingDebateWeeks(), []);
  const { subjects, unavailable, missing, reload } = useDebateSchedule();
  const { entities, loading: entitiesLoading } = useCommentEntities();
  const [weekStart, setWeekStart] = useState(debateWeekStart);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<EntityInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const typeLabels = compendiumTypeLabels("ko");
  const selectedWeek = weeks.find((week) => week.weekStart === weekStart) ?? weeks[0];
  const savedByWeek = useMemo(
    () => new Map(subjects.map((subject) => [subject.weekStart, subject])),
    [subjects],
  );
  const debateEntities = useMemo(
    () => entities.filter((entity) => selectedWeek && debatePoolAllows(selectedWeek.pool, entity.type)),
    [entities, selectedWeek],
  );
  const results = useMemo(() => {
    const normalized = query.trim();
    if (!normalized) {
      return [...debateEntities]
        .sort((left, right) => left.nameKo.localeCompare(right.nameKo, "ko"))
        .slice(0, 40);
    }
    return matchEntities(normalized, debateEntities, 40);
  }, [debateEntities, query]);

  const reserve = async () => {
    if (!selected || !selectedWeek) return;
    setSaving(true);
    setError(null);
    const result = await scheduleDebateCycle({
      weekStart: selectedWeek.weekStart,
      resourceType: selected.type,
      resourceId: selected.id,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSelected(null);
    setQuery("");
    reload();
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6">
      <header className="space-y-1">
        <h1 className="font-service text-xl font-bold text-primary">토론 주차 예약</h1>
        <p className="font-service text-sm text-zinc-400">
          {`개발 서버에서만 예약합니다. 저장 환경 ${supabaseEnv}, 게임 버전 v${DEBATE_GAME_VERSION}.`}
        </p>
      </header>

      {missing ? (
        <p className="text-sm text-amber-300">debate_cycles 마이그레이션이 필요합니다</p>
      ) : null}
      {unavailable ? (
        <p className="text-sm text-amber-300">데이터베이스가 응답하지 않습니다</p>
      ) : null}

      <section className="space-y-2" data-debate-dev-weeks="">
        {weeks.map((week) => {
          const saved = savedByWeek.get(week.weekStart);
          const active = week.weekStart === selectedWeek?.weekStart;
          return (
            <div
              key={week.weekStart}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 ${active ? "border-primary/50 bg-primary/10" : "border-white/10 bg-black/35"}`}
            >
              <button
                type="button"
                onClick={() => {
                  setWeekStart(week.weekStart);
                  setSelected(null);
                  setQuery("");
                }}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className="w-28 shrink-0 font-service text-xs text-zinc-400">
                  {`${week.weekStart.slice(5)} – ${week.weekEnd.slice(5)}`}
                </span>
                <span className="shrink-0 text-xs text-primary">{poolLabel(week.pool, typeLabels)}</span>
                {saved ? (
                  <span className="flex min-w-0 items-center gap-2">
                    <Image
                      src={saved.imageUrl ?? DEBATE_TOKEN_SRC}
                      alt=""
                      width={28}
                      height={28}
                      className="object-contain"
                    />
                    <span className="truncate text-sm text-zinc-100">{saved.nameKo}</span>
                  </span>
                ) : (
                  <span className="text-sm text-zinc-500">비어 있음</span>
                )}
              </button>
              {week.weekStart === weeks[0]?.weekStart ? (
                <Link href={DEBATE_HREF} className="shrink-0 text-xs text-primary underline-offset-4 hover:underline">
                  공개 페이지
                </Link>
              ) : null}
            </div>
          );
        })}
      </section>

      <section className="space-y-3">
        <label className="block space-y-2">
          <span className="font-service text-xs text-zinc-400">
            {selectedWeek?.pool === "mixed"
              ? "캐릭터·고대의 존재·인챈트·고난에서 고르기"
              : `${selectedWeek ? poolLabel(selectedWeek.pool, typeLabels) : ""}에서 고르기`}
          </span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="이 주 풀에서 검색"
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-primary/50"
          />
        </label>
        {entitiesLoading ? (
          <p className="text-sm text-zinc-500">백과사전을 불러오는 중...</p>
        ) : (
          <ul className="max-h-80 space-y-1 overflow-y-auto rounded-xl border border-white/10 p-2">
            {results.map((entity) => {
              const active = selected?.id === entity.id && selected.type === entity.type;
              return (
                <li key={`${entity.type}:${entity.id}`}>
                  <button
                    type="button"
                    onClick={() => setSelected(entity)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left ${active ? "bg-primary/15" : "hover:bg-white/5"}`}
                  >
                    {entity.imageUrl ? (
                      <Image src={entity.imageUrl} alt="" width={32} height={32} className="object-contain" />
                    ) : (
                      <span className="inline-block h-8 w-8" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-zinc-100">{entity.nameKo}</span>
                      <span className="block truncate text-xs text-zinc-500">
                        {`${typeLabels[entity.type] ?? entity.type} · ${entity.nameEn}`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <button
          type="button"
          disabled={!selected || !selectedWeek || saving}
          onClick={reserve}
          className="rounded-lg border border-primary/40 bg-primary/15 px-3 py-2 text-sm font-semibold text-primary disabled:opacity-40"
        >
          이 주에 예약
        </button>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </section>
    </div>
  );
}

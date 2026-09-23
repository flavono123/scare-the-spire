"use client";

import { useMemo, useState } from "react";
import Image from "@/components/ui/static-image";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { useCommentEntities } from "@/hooks/use-comment-entities";
import { useOpenDebateCycle } from "@/hooks/use-open-debate-cycle";
import { openDebateCycle } from "@/app/(main)/dev/debate/actions";
import { matchEntities } from "@/lib/chemical-utils";
import { compendiumTypeLabels } from "@/lib/compendium-type-labels";
import { DEBATE_GAME_VERSION, isDebateResourceType } from "@/lib/debate-cycle";
import { DEBATE_HREF, DEBATE_TOKEN_SRC } from "@/lib/debate";
import { supabaseEnv } from "@/lib/supabase";
import Link from "next/link";

export function DebateDevPage() {
  const { subject, unavailable, missing, reload } = useOpenDebateCycle();
  const { entities, loading: entitiesLoading } = useCommentEntities();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<EntityInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const typeLabels = compendiumTypeLabels("ko");
  const debateEntities = useMemo(
    () => entities.filter((entity) => isDebateResourceType(entity.type)),
    [entities],
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

  const pick = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    const result = await openDebateCycle({
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
        <h1 className="font-service text-xl font-bold text-primary">이번 주 토론 대상</h1>
        <p className="font-service text-sm text-zinc-400">
          {`개발 서버에서만 지목합니다. 저장 환경 ${supabaseEnv}, 게임 버전 v${DEBATE_GAME_VERSION}.`}
        </p>
      </header>

      <section className="rounded-xl border border-white/10 bg-black/35 p-4" data-debate-dev-current="">
        <p className="font-service text-xs text-zinc-500">현재 판</p>
        {missing ? (
          <p className="mt-2 text-sm text-amber-300">debate_cycles 마이그레이션이 필요합니다</p>
        ) : unavailable ? (
          <p className="mt-2 text-sm text-amber-300">데이터베이스가 응답하지 않습니다</p>
        ) : subject ? (
          <div className="mt-3 flex items-center gap-3">
            <Image
              src={subject.imageUrl ?? DEBATE_TOKEN_SRC}
              alt=""
              width={48}
              height={48}
              className="object-contain"
            />
            <div className="min-w-0">
              <p className="truncate font-service text-sm font-semibold text-zinc-100">{subject.nameKo}</p>
              <p className="truncate text-xs text-zinc-400">{`${subject.nameEn} · v${subject.gameVersion}`}</p>
            </div>
            <Link href={DEBATE_HREF} className="ml-auto shrink-0 text-xs text-primary underline-offset-4 hover:underline">
              공개 페이지
            </Link>
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-300">이번 주 토론 대상이 아직 없습니다</p>
        )}
      </section>

      <section className="space-y-3">
        <label className="block space-y-2">
          <span className="font-service text-xs text-zinc-400">백과사전에서 고르기</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="카드, 유물, 포션 등 검색"
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
          disabled={!selected || saving}
          onClick={pick}
          className="rounded-lg border border-primary/40 bg-primary/15 px-3 py-2 text-sm font-semibold text-primary disabled:opacity-40"
        >
          {subject ? "이번 주 대상을 이 요소로 바꿉니다" : "이번 주 대상으로 지목"}
        </button>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </section>
    </div>
  );
}

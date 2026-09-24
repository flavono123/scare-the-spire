"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "@/components/ui/static-image";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { saveColorfulPhilosopherPost } from "@/app/(main)/dev/colorful-philosophers/actions";
import { useCommentEntities } from "@/hooks/use-comment-entities";
import { useColorfulPhilosopherWeek } from "@/hooks/use-colorful-philosopher-posts";
import { matchEntities } from "@/lib/chemical-utils";
import {
  COLORFUL_PHILOSOPHER_SLOTS,
  COLORFUL_PHILOSOPHERS_GAME_VERSION,
  upcomingColorfulPhilosopherWeeks,
  type ColorfulPhilosopherSlot,
} from "@/lib/colorful-philosophers";
import { compendiumTypeLabels } from "@/lib/compendium-type-labels";
import { serviceMessages } from "@/messages/service";
import { supabaseEnv } from "@/lib/supabase";

export function ColorfulPhilosophersDevPage() {
  const copy = serviceMessages.ko.colorfulPhilosophers;
  const weeks = useMemo(() => upcomingColorfulPhilosopherWeeks(), []);
  const [weekStart, setWeekStart] = useState(weeks[0] ?? "");
  const [slot, setSlot] = useState<ColorfulPhilosopherSlot>("topic");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<EntityInfo | null>(null);
  const [body, setBody] = useState("");
  const [bodyTouched, setBodyTouched] = useState(false);
  const [targetEnv, setTargetEnv] = useState<"development" | "production">(
    supabaseEnv === "production" ? "production" : "development",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { entities, loading } = useCommentEntities();
  const weekPosts = useColorfulPhilosopherWeek(targetEnv);
  const typeLabels = compendiumTypeLabels("ko");
  const pool = useMemo(
    () => slot === "topic" ? entities : entities.filter((entity) => entity.type === slot),
    [entities, slot],
  );
  const results = useMemo(() => {
    const normalized = query.trim();
    if (!normalized) return [...pool].sort((a, b) => a.nameKo.localeCompare(b.nameKo, "ko")).slice(0, 30);
    return matchEntities(normalized, pool, 30);
  }, [pool, query]);
  const existing = weekPosts.posts.find((post) => post.weekStart === weekStart && post.slot === slot);

  useEffect(() => {
    setBodyTouched(false);
  }, [weekStart, slot]);

  useEffect(() => {
    if (bodyTouched) return;
    setBody(existing?.body ?? "");
  }, [existing, bodyTouched]);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    const result = await saveColorfulPhilosopherPost({
      env: targetEnv,
      weekStart,
      slot,
      resourceType: selected.type,
      resourceId: selected.id,
      body,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBody("");
    setSelected(null);
    weekPosts.reload();
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6">
      <header>
        <h1 className="font-service text-xl font-bold text-primary">다채로운 철학자들 글</h1>
        <p className="text-sm text-zinc-400">{`개발 서버에서 개발·운영 글을 고릅니다. v${COLORFUL_PHILOSOPHERS_GAME_VERSION}`}</p>
      </header>
      <div className="flex gap-2">
        {(["development", "production"] as const).map((env) => (
          <button
            key={env}
            type="button"
            onClick={() => {
              setTargetEnv(env);
              setSelected(null);
              setBodyTouched(false);
            }}
            className={`rounded-full border px-3 py-1 text-xs ${env === targetEnv ? "border-primary bg-primary/15 text-primary" : "border-white/10 text-zinc-400"}`}
          >
            {env === "production" ? "운영" : "개발"}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {weeks.map((week) => (
          <button
            key={week}
            type="button"
            onClick={() => {
              setWeekStart(week);
              setBodyTouched(false);
            }}
            className={`rounded-full border px-3 py-1 text-xs ${week === weekStart ? "border-primary bg-primary/15 text-primary" : "border-white/10 text-zinc-400"}`}
          >
            {week.slice(5)}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        {COLORFUL_PHILOSOPHER_SLOTS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
            setSlot(item);
            setSelected(null);
            setBodyTouched(false);
            }}
            className={`rounded-full border px-3 py-1 text-xs ${item === slot ? "border-primary bg-primary/15 text-primary" : "border-white/10 text-zinc-400"}`}
          >
            {copy.slots[item]}
          </button>
        ))}
      </div>
      <p className="text-sm text-zinc-300">
        {existing?.nameKo ?? "이 주의 이 칸은 비어 있습니다"}
      </p>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={slot === "topic" ? "요소 검색" : `${typeLabels[slot]} 검색`}
        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
      />
      {loading ? <p className="text-sm text-zinc-500">백과사전을 불러오는 중...</p> : (
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {results.map((entity) => (
            <li key={entity.id}>
              <button
                type="button"
                onClick={() => setSelected(entity)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm ${selected?.id === entity.id ? "bg-primary/15" : ""}`}
              >
                {entity.imageUrl ? <Image src={entity.imageUrl} alt="" width={28} height={28} /> : null}
                {entity.nameKo}
              </button>
            </li>
          ))}
        </ul>
      )}
      <textarea
        value={body}
        onChange={(event) => {
          setBodyTouched(true);
          setBody(event.target.value);
        }}
        maxLength={500}
        placeholder="이 요소에 대한 화두"
        className="min-h-28 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
      />
      <button
        type="button"
        disabled={!selected || body.trim().length < 1 || saving}
        onClick={save}
        className="rounded-lg border border-primary/40 bg-primary/15 px-3 py-2 text-sm text-primary disabled:opacity-40"
      >
        이 주에 올리기
      </button>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}

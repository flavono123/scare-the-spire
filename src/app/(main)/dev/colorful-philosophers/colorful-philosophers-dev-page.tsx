"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "@/components/ui/static-image";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { WeekPostCardPreview } from "@/components/colorful-philosophers/index-view";
import { saveColorfulPhilosopherPost } from "@/app/(main)/dev/colorful-philosophers/actions";
import { useCommentEntities } from "@/hooks/use-comment-entities";
import { useColorfulPhilosopherWeek } from "@/hooks/use-colorful-philosopher-posts";
import { matchEntities } from "@/lib/chemical-utils";
import {
  COLORFUL_PHILOSOPHER_SLOTS,
  COLORFUL_PHILOSOPHERS_GAME_VERSION,
  colorfulPhilosophersWeekNumber,
  upcomingColorfulPhilosopherWeeks,
  type ColorfulPhilosopherPost,
  type ColorfulPhilosopherSlot,
} from "@/lib/colorful-philosophers";
import { POOL_LABELS, RELIC_RARITY_LABELS, RELIC_RARITY_ORDER, type RelicFilterPool } from "@/lib/codex-types";
import { compendiumTypeLabels } from "@/lib/compendium-type-labels";
import { serviceMessages } from "@/messages/service";
import { supabaseEnv } from "@/lib/supabase";

const CARD_AFFILIATION_LABELS: Record<string, string> = {
  ironclad: POOL_LABELS.ironclad,
  silent: POOL_LABELS.silent,
  defect: POOL_LABELS.defect,
  necrobinder: POOL_LABELS.necrobinder,
  regent: POOL_LABELS.regent,
  colorless: "무색",
  curse: "저주",
  event: "이벤트",
  status: "상태이상",
  token: "토큰",
  quest: "퀘스트",
};

const AFFILIATION_BAR_CLASS: Record<string, string> = {
  ironclad: "bg-red-400/70",
  silent: "bg-emerald-400/70",
  regent: "bg-orange-400/70",
  necrobinder: "bg-pink-400/70",
  defect: "bg-cyan-400/70",
};

interface AxisBucket {
  key: string;
  label: string;
  used: number;
  total: number;
}

interface AxisSpec {
  title: string;
  /** Returns [key, label] for an entity, or null when the entity has no value on this axis. */
  bucket: (entity: EntityInfo) => [string, string] | null;
  order: string[];
}

const SLOT_AXES: Partial<Record<ColorfulPhilosopherSlot, AxisSpec[]>> = {
  card: [
    {
      title: "소속",
      bucket: (entity) => entity.cardData
        ? [entity.cardData.color, CARD_AFFILIATION_LABELS[entity.cardData.color] ?? entity.cardData.color]
        : null,
      order: Object.keys(CARD_AFFILIATION_LABELS),
    },
    {
      title: "희귀도",
      bucket: (entity) => entity.cardData ? [entity.cardData.rarity, entity.cardData.rarity] : null,
      order: ["기본", "일반", "희귀", "고급", "고대", "이벤트", "토큰", "저주", "상태이상", "퀘스트"],
    },
  ],
  relic: [
    {
      title: "소속",
      bucket: (entity) => entity.relicData
        ? [entity.relicData.pool, POOL_LABELS[entity.relicData.pool as RelicFilterPool] ?? entity.relicData.pool]
        : null,
      order: ["shared", "ironclad", "silent", "defect", "necrobinder", "regent"],
    },
    {
      title: "희귀도",
      bucket: (entity) => entity.relicData
        ? [entity.relicData.rarity, RELIC_RARITY_LABELS[entity.relicData.rarity] ?? entity.relicData.rarity]
        : null,
      order: RELIC_RARITY_ORDER,
    },
  ],
};

function axisBuckets(axis: AxisSpec, pool: EntityInfo[], used: EntityInfo[]): AxisBucket[] {
  const buckets = new Map<string, AxisBucket>();
  const add = (entity: EntityInfo, field: "used" | "total") => {
    const value = axis.bucket(entity);
    if (!value) return;
    const bucket = buckets.get(value[0]) ?? { key: value[0], label: value[1], used: 0, total: 0 };
    bucket[field] += 1;
    buckets.set(value[0], bucket);
  };
  pool.forEach((entity) => add(entity, "total"));
  used.forEach((entity) => add(entity, "used"));
  const rank = (key: string) => {
    const index = axis.order.indexOf(key);
    return index < 0 ? axis.order.length : index;
  };
  return Array.from(buckets.values())
    .filter((bucket) => bucket.total > 0)
    .sort((a, b) => rank(a.key) - rank(b.key));
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

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
  const [savedPost, setSavedPost] = useState<ColorfulPhilosopherPost | null>(null);
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
  const fetched = weekPosts.posts.find((post) => post.weekStart === weekStart && post.slot === slot);
  const justSaved = savedPost?.weekStart === weekStart && savedPost.slot === slot ? savedPost : null;
  const existing = justSaved ?? fetched;
  const usage = useMemo(() => {
    const posts = justSaved
      ? [...weekPosts.posts.filter((post) => post.id !== justSaved.id), justSaved]
      : weekPosts.posts;
    const bySlot = new Map<string, Map<string, { post: ColorfulPhilosopherPost; weeks: string[] }>>();
    for (const post of posts) {
      const slotMap = bySlot.get(post.slot) ?? new Map();
      const key = `${post.resourceType}:${post.resourceId}`;
      const entry = slotMap.get(key) ?? { post, weeks: [] };
      entry.weeks.push(post.weekStart);
      slotMap.set(key, entry);
      bySlot.set(post.slot, slotMap);
    }
    return bySlot;
  }, [weekPosts.posts, justSaved]);

  const entityByKey = useMemo(
    () => new Map(entities.map((entity) => [`${entity.type}:${entity.id}`, entity])),
    [entities],
  );
  const timeline = useMemo(() => {
    const rows = new Map<string, Map<string, ColorfulPhilosopherPost>>();
    const posts = justSaved
      ? [...weekPosts.posts.filter((post) => post.id !== justSaved.id), justSaved]
      : weekPosts.posts;
    for (const post of posts) {
      const row = rows.get(post.weekStart) ?? new Map();
      row.set(post.slot, post);
      rows.set(post.weekStart, row);
    }
    return Array.from(rows.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [weekPosts.posts, justSaved]);

  const pickRandom = (target: ColorfulPhilosopherSlot) => {
    const candidates = target === "topic" ? entities : entities.filter((entity) => entity.type === target);
    const used = usage.get(target);
    const fresh = candidates.filter((entity) => !used?.has(`${entity.type}:${entity.id}`));
    const from = fresh.length > 0 ? fresh : candidates;
    if (from.length === 0) return;
    const entity = randomItem(from);
    setSlot(target);
    setSelected(entity);
    setQuery("");
    setBodyTouched(false);
    setError(null);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the editor when the week slot changes
    setBodyTouched(false);
  }, [weekStart, slot]);

  useEffect(() => {
    if (bodyTouched) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fill the saved body for the selected slot
    setBody(existing?.body ?? "");
  }, [existing, bodyTouched]);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    setSavedPost(null);
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
    setSavedPost(result.post);
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
      {existing ? (
        <WeekPostCardPreview post={existing} slotLabel={copy.slots[slot]} serviceLocale="ko" />
      ) : (
        <p className="text-sm text-zinc-400">이 주의 이 칸은 비어 있습니다</p>
      )}
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={slot === "topic" ? "요소 검색" : `${typeLabels[slot]} 검색`}
        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
      />
      {selected ? (
        <div className="flex items-center gap-3 rounded-lg border border-primary/50 bg-primary/10 px-3 py-2">
          {selected.imageUrl ? <Image src={selected.imageUrl} alt="" width={36} height={36} className="object-contain" /> : null}
          <span>
            <span className="block text-[10px] text-primary">{typeLabels[selected.type] ?? selected.type}</span>
            <span className="block text-sm font-semibold text-foreground">{selected.nameKo}</span>
          </span>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">아직 고른 요소가 없습니다</p>
      )}
      {loading ? <p className="text-sm text-zinc-500">백과사전을 불러오는 중...</p> : (
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {results.map((entity) => {
            const picked = selected?.type === entity.type && selected.id === entity.id;
            return (
              <li key={`${entity.type}:${entity.id}`}>
                <button
                  type="button"
                  onClick={() => setSelected(entity)}
                  className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm ${picked ? "bg-primary/20 ring-1 ring-primary/50" : "hover:bg-white/5"}`}
                >
                  {entity.imageUrl ? <Image src={entity.imageUrl} alt="" width={28} height={28} className="object-contain" /> : null}
                  <span className="w-12 shrink-0 text-[10px] text-zinc-500">{typeLabels[entity.type] ?? entity.type}</span>
                  <span>{entity.nameKo}</span>
                </button>
              </li>
            );
          })}
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
      <section className="space-y-5 border-t border-white/10 pt-5">
        <h2 className="font-service text-sm text-zinc-200">지난 토론 요소</h2>
        {weekPosts.loading ? <p className="text-sm text-zinc-500">불러오는 중...</p> : null}
        <div className="space-y-1">
          <div className="grid grid-cols-[3.25rem_repeat(3,minmax(0,1fr))] gap-1.5 px-1">
            <span />
            {COLORFUL_PHILOSOPHER_SLOTS.map((item) => (
              <div key={item} className="space-y-1">
                <p className="font-service text-xs text-zinc-400">{copy.slots[item]}</p>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => pickRandom(item)}
                  className="rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-[11px] text-primary disabled:opacity-40"
                >
                  랜덤 픽
                </button>
              </div>
            ))}
          </div>
          {timeline.length === 0 ? <p className="px-1 py-2 text-xs text-zinc-500">아직 없습니다</p> : null}
          {timeline.map(([week, row]) => (
            <div
              key={week}
              className={`grid grid-cols-[3.25rem_repeat(3,minmax(0,1fr))] items-stretch gap-1.5 rounded-lg border px-1 py-1 ${week === weekStart ? "border-primary/40 bg-primary/5" : "border-white/10 bg-black/25"}`}
            >
              <span className="self-center pl-1 text-[11px] leading-tight text-zinc-400">
                <span className="block font-service text-zinc-200">{`${colorfulPhilosophersWeekNumber(week)}주`}</span>
                {week.slice(5)}
              </span>
              {COLORFUL_PHILOSOPHER_SLOTS.map((item) => {
                const post = row.get(item);
                return post ? (
                  <span key={item} className="flex min-w-0 items-center gap-1.5 rounded bg-black/35 px-1.5 py-1 text-xs text-zinc-200">
                    {post.imageUrl ? <Image src={post.imageUrl} alt="" width={20} height={20} className="shrink-0 object-contain" /> : null}
                    <span className="truncate">{post.nameKo}</span>
                  </span>
                ) : (
                  <span key={item} className="flex items-center rounded px-1.5 py-1 text-xs text-zinc-600">—</span>
                );
              })}
            </div>
          ))}
        </div>
        {(["card", "relic"] as const).map((item) => {
          const axes = SLOT_AXES[item] ?? [];
          const pool = entities.filter((entity) => entity.type === item);
          const used = Array.from(usage.get(item)?.values() ?? []).flatMap(({ post, weeks }) => {
            const entity = entityByKey.get(`${post.resourceType}:${post.resourceId}`);
            return entity ? Array.from({ length: weeks.length }, () => entity) : [];
          });
          return (
            <div key={item} className="space-y-3">
              <p className="font-service text-xs text-zinc-400">{`${copy.slots[item]} 집계 · ${used.length}회`}</p>
              {axes.map((axis) => (
                <div key={axis.title} className="space-y-1">
                  <p className="text-[11px] text-zinc-500">{axis.title}</p>
                  {axisBuckets(axis, pool, used).map((bucket) => (
                    <div key={bucket.key} className="grid grid-cols-[5rem_1fr_4.5rem] items-center gap-2 text-xs">
                      <span className="truncate text-zinc-300">{bucket.label}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-white/5">
                        <span
                          className={`block h-full rounded-full ${AFFILIATION_BAR_CLASS[bucket.key] ?? "bg-primary/60"}`}
                          style={{ width: `${Math.min(100, (bucket.used / bucket.total) * 100)}%` }}
                        />
                      </span>
                      <span className="text-right tabular-nums text-zinc-400">{`${bucket.used} / ${bucket.total}`}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          );
        })}
      </section>
      {justSaved ? <p className="text-sm text-primary">이 주에 올렸습니다 — 위 카드가 인덱스에 보이는 모습입니다</p> : null}
    </div>
  );
}

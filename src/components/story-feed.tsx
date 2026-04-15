"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Story, Card, Change, Relic, Potion, LinkedEntity } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { useEngagementCounts } from "@/hooks/use-engagement-counts";
import { LikeButton } from "@/components/like-button";
import { CommentSection } from "@/components/comment-section";
import { EngagementSpinner } from "@/components/engagement-spinner";

function DiffLine({ diff }: { diff: Change["diffs"][0] }) {
  return (
    <div className="flex items-center gap-1.5 text-sm">
      {diff.upgraded && (
        <span className="text-[10px] font-medium text-green-400 bg-green-500/10 rounded px-1">+</span>
      )}
      <span className="text-muted-foreground">{diff.displayName}</span>
      <span className="text-red-400 font-medium">{String(diff.before)}</span>
      <span className="text-muted-foreground">→</span>
      <span className="text-green-400 font-medium">{String(diff.after)}</span>
    </div>
  );
}

function EntityImage({ entityType, entityId, name, deprecated }: {
  entityType: string;
  entityId: string;
  name: string;
  deprecated?: boolean;
}) {
  const [imgError, setImgError] = useState(false);

  if (entityType === "card") {
    if (imgError) {
      return (
        <div className="w-[85px] h-[110px] rounded-md shrink-0 bg-zinc-900 border border-border flex items-center justify-center">
          <span className="text-[10px] text-muted-foreground text-center px-1">{name}</span>
        </div>
      );
    }
    return (
      <Image
        src={`/images/cards/${entityId}.webp`}
        alt={name}
        width={85}
        height={110}
        className={`rounded-md shrink-0 group-hover:scale-105 transition-transform ${deprecated ? "opacity-50 grayscale" : ""}`}
        onError={() => setImgError(true)}
      />
    );
  }

  const folder = entityType === "relic" ? "relics" : "potions";
  if (imgError) {
    return (
      <div className="w-12 h-12 shrink-0 bg-zinc-900 border border-border rounded flex items-center justify-center">
        <span className="text-[8px] text-muted-foreground">{name}</span>
      </div>
    );
  }
  return (
    <Image
      src={`/images/${folder}/${entityId}.webp`}
      alt={name}
      width={48}
      height={48}
      className={`shrink-0 w-auto h-auto group-hover:scale-110 transition-transform ${deprecated ? "opacity-50 grayscale" : ""}`}
      onError={() => setImgError(true)}
    />
  );
}

function EntityInfoBlock({ entityType, entityId, card, relic, potion, label }: {
  entityType: string;
  entityId: string;
  card?: Card;
  relic?: Relic;
  potion?: Potion;
  label?: string;
}) {
  const entity = entityType === "card" ? card : entityType === "relic" ? relic : potion;
  if (!entity) return null;

  const href = `/${entityType}s/${entityId}`;
  const nameKo = "nameKo" in entity ? entity.nameKo : "";
  const name = entity.name;
  const deprecated = "deprecated" in entity ? entity.deprecated : false;

  return (
    <Link href={href} className="flex gap-3 items-start group">
      <EntityImage entityType={entityType} entityId={entityId} name={nameKo || name} deprecated={deprecated} />
      <div>
        <p className="font-medium group-hover:text-yellow-500 transition-colors">
          {nameKo}
          {label && (
            <span className="ml-1.5 text-[10px] font-medium text-red-400 bg-red-500/10 rounded px-1 py-0.5">{label}</span>
          )}
          {deprecated && !label && (
            <span className="ml-1.5 text-[10px] font-medium text-red-400 bg-red-500/10 rounded px-1 py-0.5">삭제됨</span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">{name}</p>
      </div>
    </Link>
  );
}

function ChangeBlock({ change }: { change: Change }) {
  const baseDiffs = change.diffs.filter((d) => !d.upgraded);
  const upgradedDiffs = change.diffs.filter((d) => d.upgraded);

  return (
    <div className="rounded-lg border border-border bg-card/30 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium text-yellow-500">{change.patch}</span>
        {change.date && (
          <span className="text-xs text-muted-foreground">{change.date}</span>
        )}
      </div>
      {change.summary && (
        <p className="text-xs text-muted-foreground mb-2">{change.summary}</p>
      )}
      <div className="space-y-1">
        {baseDiffs.map((d, i) => (
          <DiffLine key={i} diff={d} />
        ))}
        {upgradedDiffs.length > 0 && (
          <div className="mt-1.5 border-l-2 border-green-500/30 pl-2 space-y-1">
            {upgradedDiffs.map((d, i) => (
              <DiffLine key={i} diff={d} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StoryExpanded({
  story,
  entityChanges,
  cardMap,
  relicMap,
  potionMap,
  changeMap,
}: {
  story: Story;
  entityChanges: Change[];
  cardMap: Map<string, Card>;
  relicMap: Map<string, Relic>;
  potionMap: Map<string, Potion>;
  changeMap: Map<string, Change>;
}) {
  const hasEntity = story.entityType && story.entityId;

  return (
    <div className="space-y-3">
      {hasEntity ? (
        <>
          {/* Main entity info */}
          <EntityInfoBlock
            entityType={story.entityType!}
            entityId={story.entityId!}
            card={cardMap.get(story.entityId!)}
            relic={relicMap.get(story.entityId!)}
            potion={potionMap.get(story.entityId!)}
          />

          {/* All changes for this entity */}
          {entityChanges.map((c) => (
            <ChangeBlock key={c.id} change={c} />
          ))}
        </>
      ) : story.source ? (
        <div className="rounded-lg border border-border bg-card/30 p-4">
          <span className="text-sm text-yellow-500">{story.source}</span>
        </div>
      ) : null}

      {/* Linked entities */}
      {story.linkedEntities?.map((linked: LinkedEntity) => {
        const linkedChanges = linked.changeId ? [changeMap.get(linked.changeId)].filter(Boolean) as Change[] : [];
        return (
          <div key={`${linked.entityType}-${linked.entityId}`} className="border-t border-border/30 pt-3 space-y-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>↳</span>
              <span>관련 {linked.entityType === "card" ? "카드" : linked.entityType === "relic" ? "유물" : "포션"}</span>
            </div>
            <EntityInfoBlock
              entityType={linked.entityType}
              entityId={linked.entityId}
              card={cardMap.get(linked.entityId)}
              relic={relicMap.get(linked.entityId)}
              potion={potionMap.get(linked.entityId)}
              label={linked.label}
            />
            {linkedChanges.map((c) => (
              <ChangeBlock key={c.id} change={c} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function StoryCard({
  story,
  entityChanges,
  cardMap,
  relicMap,
  potionMap,
  changeMap,
  userId,
  expanded,
  onToggle,
  commentCount,
  engagementLoading,
}: {
  story: Story;
  entityChanges: Change[];
  cardMap: Map<string, Card>;
  relicMap: Map<string, Relic>;
  potionMap: Map<string, Potion>;
  changeMap: Map<string, Change>;
  userId: string | null;
  expanded: boolean;
  onToggle: (storyId: string) => void;
  likeCount: number;
  commentCount: number;
  engagementLoading: boolean;
}) {
  const [liveCommentCount, setLiveCommentCount] = useState<number | null>(null);
  const displayCommentCount = liveCommentCount ?? commentCount;

  return (
    <article className="border-b border-border/50 last:border-b-0">
      <div className="px-4 py-6">
        {/* Sentence + engagement */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onToggle(story.id)}
            className="flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <p className="text-lg sm:text-xl font-medium leading-snug text-center">
              &ldquo;{story.sentence}&rdquo;
              {engagementLoading ? (
                <span className="ml-2 inline-flex align-middle"><EngagementSpinner size={12} /></span>
              ) : displayCommentCount > 0 ? (
                <span className="ml-2 text-xs font-normal text-muted-foreground/50">[{displayCommentCount}]</span>
              ) : null}
            </p>
          </button>
          <div className="shrink-0">
            <LikeButton storyId={story.id} userId={userId} />
          </div>
        </div>

        {/* Expanded: entity info, all changes, linked entities, comments */}
        {expanded && (
          <div className="mt-4 space-y-3">
            <StoryExpanded
              story={story}
              entityChanges={entityChanges}
              cardMap={cardMap}
              relicMap={relicMap}
              potionMap={potionMap}
              changeMap={changeMap}
            />
            <CommentSection storyId={story.id} userId={userId} onCountChange={setLiveCommentCount} />
          </div>
        )}
      </div>
    </article>
  );
}

export function StoryFeed({
  stories,
  cards,
  relics,
  potions,
  changes,
}: {
  stories: Story[];
  cards: Card[];
  relics: Relic[];
  potions: Potion[];
  changes: Change[];
}) {
  const { userId } = useAuth();
  const counts = useEngagementCounts();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    const hash = window.location.hash.slice(1);
    return hash ? new Set(hash.split(",")) : new Set();
  });

  const toggle = useCallback((storyId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(storyId)) next.delete(storyId);
      else next.add(storyId);
      return next;
    });
  }, []);

  useEffect(() => {
    const hash = [...expandedIds].join(",");
    window.history.replaceState(null, "", hash ? `#${hash}` : " ");
  }, [expandedIds]);

  const [shuffled] = useState(() => {
    const arr = [...stories];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  });

  const cardMap = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const relicMap = useMemo(() => new Map(relics.map((r) => [r.id, r])), [relics]);
  const potionMap = useMemo(() => new Map(potions.map((p) => [p.id, p])), [potions]);
  const changeMap = useMemo(() => new Map(changes.map((c) => [c.id, c])), [changes]);

  // Index: entityId -> all changes for that entity
  const entityChangeIndex = useMemo(() => {
    const idx = new Map<string, Change[]>();
    for (const c of changes) {
      const key = `${c.entityType}:${c.entityId}`;
      if (!idx.has(key)) idx.set(key, []);
      idx.get(key)!.push(c);
    }
    return idx;
  }, [changes]);

  return (
    <div className="divide-y divide-border/50">
      {shuffled.map((story) => {
        const key = story.entityType && story.entityId ? `${story.entityType}:${story.entityId}` : "";
        return (
          <StoryCard
            key={story.id}
            story={story}
            entityChanges={entityChangeIndex.get(key) ?? []}
            cardMap={cardMap}
            relicMap={relicMap}
            potionMap={potionMap}
            changeMap={changeMap}
            userId={userId}
            expanded={expandedIds.has(story.id)}
            onToggle={toggle}
            likeCount={counts.likes[story.id] ?? 0}
            commentCount={counts.comments[story.id] ?? 0}
            engagementLoading={counts.loading}
          />
        );
      })}
    </div>
  );
}

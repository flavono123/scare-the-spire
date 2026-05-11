"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "@/components/ui/static-image";
import Link from "next/link";
import type { Story, Card, Change, Relic, Potion, LinkedEntity, STS2Change, STS2Patch, StoryEntityType } from "@/lib/types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { useAuth } from "@/hooks/use-auth";
import { useEngagementCounts } from "@/hooks/use-engagement-counts";
import { LikeButton } from "@/components/like-button";
import { CommentSection } from "@/components/comment-section";
import { EngagementSpinner, EngagementUnavailableIcon } from "@/components/engagement-spinner";

function stableHash(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function stableStoryOrder(stories: Story[]) {
  return [...stories].sort((a, b) => {
    const rankA = stableHash(a.id);
    const rankB = stableHash(b.id);
    return rankA - rankB || a.id.localeCompare(b.id);
  });
}

function isSTS1EntityType(entityType: StoryEntityType | undefined): entityType is "card" | "relic" | "potion" {
  return entityType === "card" || entityType === "relic" || entityType === "potion";
}

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

function STS2DiffLine({ diff }: { diff: STS2Change["diffs"][0] }) {
  const before = diff.beforeKo ?? diff.before;
  const after = diff.afterKo ?? diff.after;

  return (
    <div className="flex items-center gap-1.5 text-sm">
      {diff.upgraded && (
        <span className="rounded bg-green-500/10 px-1 text-[10px] font-medium text-green-400">+</span>
      )}
      <span className="text-muted-foreground">{diff.displayNameKo || diff.displayName}</span>
      <span className="font-medium text-red-400">{String(before)}</span>
      <span className="text-muted-foreground">→</span>
      <span className="font-medium text-green-400">{String(after)}</span>
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

function sts2EntityHref(entity: EntityInfo): string | null {
  switch (entity.type) {
    case "card":
      return `/compendium/cards?card=${entity.id.toLowerCase()}`;
    case "relic":
      return `/compendium/relics?relic=${entity.id.toLowerCase()}`;
    case "potion":
      return `/compendium/potions?potion=${entity.id.toLowerCase()}`;
    case "power":
      return `/compendium/powers?power=${entity.id.toLowerCase()}`;
    case "enchantment":
      return `/compendium/enchantments?enchantment=${entity.id.toLowerCase()}`;
    case "event":
      return `/compendium/events/${entity.id.toLowerCase()}`;
    case "monster":
      return `/compendium/monsters?monster=${entity.id.toLowerCase()}`;
    case "encounter":
      return `/compendium/encounters?encounter=${entity.id.toLowerCase()}`;
    case "ancient":
      return `/compendium/ancients/${entity.id.toLowerCase()}`;
    default:
      return null;
  }
}

function STS2EntityInfoBlock({ entity, label }: { entity?: EntityInfo; label?: string }) {
  if (!entity) return null;

  const href = sts2EntityHref(entity);
  const image = entity.imageUrl;
  const body = (
    <div className="flex gap-3 items-start group">
      {image ? (
        <Image
          src={image}
          alt={entity.nameKo}
          width={64}
          height={64}
          className="h-16 w-16 shrink-0 object-contain transition-transform group-hover:scale-105"
        />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-border bg-zinc-900">
          <span className="px-1 text-center text-[9px] text-muted-foreground">{entity.nameKo}</span>
        </div>
      )}
      <div>
        <p className="font-medium transition-colors group-hover:text-yellow-500">
          {entity.nameKo}
          {label && (
            <span className="ml-1.5 rounded bg-red-500/10 px-1 py-0.5 text-[10px] font-medium text-red-400">
              {label}
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">{entity.nameEn}</p>
      </div>
    </div>
  );

  return href ? (
    <Link href={href}>{body}</Link>
  ) : body;
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

function patchHref(change: STS2Change | undefined, story: Story): string | null {
  const patch = change?.patch ?? story.source;
  if (!patch) return null;
  return `/patches/${patch.replace(/^v/, "")}`;
}

function STS2ChangeBlock({ change, story, patch }: { change?: STS2Change; story: Story; patch?: STS2Patch }) {
  const href = patchHref(change, story);
  const patchLabel = change?.patch ?? story.source;
  const summary = change?.summaryKo ?? change?.summary;

  return (
    <div className="rounded-lg border border-border bg-card/30 p-4">
      <div className="mb-2 flex items-center gap-2">
        {href && patchLabel ? (
          <Link href={href} className="text-sm font-medium text-yellow-500 hover:text-yellow-400">
            {patchLabel}
          </Link>
        ) : patchLabel ? (
          <span className="text-sm font-medium text-yellow-500">{patchLabel}</span>
        ) : null}
        {(change?.date ?? patch?.date) && (
          <span className="text-xs text-muted-foreground">{change?.date ?? patch?.date}</span>
        )}
      </div>
      {summary && (
        <p className="mb-2 text-xs text-muted-foreground">{summary}</p>
      )}
      {change && (
        <div className="space-y-1">
          {change.diffs.map((d, i) => (
            <STS2DiffLine key={i} diff={d} />
          ))}
        </div>
      )}
    </div>
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
  sts2EntityMap,
  sts2ChangeMap,
  sts2PatchMap,
}: {
  story: Story;
  entityChanges: Change[];
  cardMap: Map<string, Card>;
  relicMap: Map<string, Relic>;
  potionMap: Map<string, Potion>;
  changeMap: Map<string, Change>;
  sts2EntityMap: Map<string, EntityInfo>;
  sts2ChangeMap: Map<string, STS2Change>;
  sts2PatchMap: Map<string, STS2Patch>;
}) {
  const hasEntity = story.entityType && story.entityId;
  const isSTS2 = story.game === "sts2";

  if (isSTS2) {
    const entity = hasEntity ? sts2EntityMap.get(`${story.entityType}:${story.entityId}`) : undefined;
    const change = story.changeId ? sts2ChangeMap.get(story.changeId) : undefined;
    const patch = change?.patch ? sts2PatchMap.get(change.patch) : story.source ? sts2PatchMap.get(story.source) : undefined;
    const primaryLabel = story.tags?.includes("삭제") ? "삭제됨" : undefined;

    return (
      <div className="space-y-3">
        <STS2EntityInfoBlock entity={entity} label={primaryLabel} />
        <STS2ChangeBlock change={change} story={story} patch={patch} />

        {story.linkedEntities?.map((linked) => (
          <div key={`${linked.entityType}-${linked.entityId}`} className="space-y-3 border-t border-border/30 pt-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>↳</span>
              <span>관련 항목</span>
            </div>
            <STS2EntityInfoBlock
              entity={sts2EntityMap.get(`${linked.entityType}:${linked.entityId}`)}
              label={linked.label}
            />
          </div>
        ))}
      </div>
    );
  }

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
        if (!isSTS1EntityType(linked.entityType)) return null;
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
  sts2EntityMap,
  sts2ChangeMap,
  sts2PatchMap,
  userId,
  expanded,
  onToggle,
  commentCount,
  engagementLoading,
  engagementUnavailable,
}: {
  story: Story;
  entityChanges: Change[];
  cardMap: Map<string, Card>;
  relicMap: Map<string, Relic>;
  potionMap: Map<string, Potion>;
  changeMap: Map<string, Change>;
  sts2EntityMap: Map<string, EntityInfo>;
  sts2ChangeMap: Map<string, STS2Change>;
  sts2PatchMap: Map<string, STS2Patch>;
  userId: string | null;
  expanded: boolean;
  onToggle: (storyId: string) => void;
  likeCount: number;
  commentCount: number;
  engagementLoading: boolean;
  engagementUnavailable: boolean;
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
              {engagementUnavailable ? (
                <span className="ml-2 inline-flex align-middle"><EngagementUnavailableIcon size={12} /></span>
              ) : engagementLoading ? (
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
              sts2EntityMap={sts2EntityMap}
              sts2ChangeMap={sts2ChangeMap}
              sts2PatchMap={sts2PatchMap}
            />
            <CommentSection threadKey={story.id} onCountChange={setLiveCommentCount} />
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
  sts2Changes = [],
  sts2Patches = [],
  sts2Entities = [],
}: {
  stories: Story[];
  cards: Card[];
  relics: Relic[];
  potions: Potion[];
  changes: Change[];
  sts2Changes?: STS2Change[];
  sts2Patches?: STS2Patch[];
  sts2Entities?: EntityInfo[];
}) {
  const { userId } = useAuth();
  const counts = useEngagementCounts();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const didMountRef = useRef(false);

  const toggle = useCallback((storyId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(storyId)) next.delete(storyId);
      else next.add(storyId);
      return next;
    });
  }, []);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      queueMicrotask(() => setExpandedIds(new Set(hash.split(","))));
    }
  }, []);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    const hash = [...expandedIds].join(",");
    const nextUrl = hash
      ? `#${hash}`
      : `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, "", nextUrl);
  }, [expandedIds]);

  const orderedStories = useMemo(() => stableStoryOrder(stories), [stories]);

  const cardMap = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const relicMap = useMemo(() => new Map(relics.map((r) => [r.id, r])), [relics]);
  const potionMap = useMemo(() => new Map(potions.map((p) => [p.id, p])), [potions]);
  const changeMap = useMemo(() => new Map(changes.map((c) => [c.id, c])), [changes]);
  const sts2EntityMap = useMemo(
    () => new Map(sts2Entities.map((entity) => [`${entity.type}:${entity.id}`, entity])),
    [sts2Entities],
  );
  const sts2ChangeMap = useMemo(() => new Map(sts2Changes.map((c) => [c.id, c])), [sts2Changes]);
  const sts2PatchMap = useMemo(() => new Map(sts2Patches.map((p) => [p.id, p])), [sts2Patches]);

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
      {orderedStories.map((story) => {
        const key = isSTS1EntityType(story.entityType) && story.entityId ? `${story.entityType}:${story.entityId}` : "";
        return (
          <StoryCard
            key={story.id}
            story={story}
            entityChanges={entityChangeIndex.get(key) ?? []}
            cardMap={cardMap}
            relicMap={relicMap}
            potionMap={potionMap}
            changeMap={changeMap}
            sts2EntityMap={sts2EntityMap}
            sts2ChangeMap={sts2ChangeMap}
            sts2PatchMap={sts2PatchMap}
            userId={userId}
            expanded={expandedIds.has(story.id)}
            onToggle={toggle}
            likeCount={counts.likes[story.id] ?? 0}
            commentCount={counts.comments[story.id] ?? 0}
            engagementLoading={counts.loading}
            engagementUnavailable={counts.unavailable}
          />
        );
      })}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "@/components/ui/static-image";
import Link from "next/link";
import { Search, Trash2, X } from "lucide-react";
import type { Story, Card, Change, Relic, Potion, LinkedEntity, STS2Change, STS2Patch, STS2PatchLine, StoryEntityType } from "@/lib/types";
import { localizeHref, type ServiceLocale } from "@/lib/i18n";
import { buildCompendiumResourceHref } from "@/lib/compendium-resource-links";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { useAuth } from "@/hooks/use-auth";
import { useCommunityStories } from "@/hooks/use-community-stories";
import { useEngagementCounts } from "@/hooks/use-engagement-counts";
import { StoryReactionButton } from "@/components/story-reaction-button";
import { CommentSection } from "@/components/comment-section";
import { EngagementSummary } from "@/components/engagement-summary";
import { EngagementSpinner } from "@/components/engagement-spinner";
import { PatchLineReferenceBlock } from "@/components/patch-line-reference";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import { StoryComposerModal } from "@/components/story-composer-modal";
import { StoryWriteIcon } from "@/components/story-token-icon";
import { CardTile } from "@/components/codex/card-tile";
import type { StoryReactionCounts } from "@/lib/reactions";
import { serviceMessages } from "@/messages/service";

type StorySortMode = "recommended" | "comments" | "latest";

const STORY_SORT_OPTIONS: StorySortMode[] = ["recommended", "comments", "latest"];

let fullPatchLinesPromise: Promise<STS2PatchLine[]> | null = null;

function loadFullSts2PatchLines(): Promise<STS2PatchLine[]> {
  fullPatchLinesPromise ??= import("../../data/sts2-patch-lines.json")
    .then((module) => module.default as STS2PatchLine[]);
  return fullPatchLinesPromise;
}

function storyFeedCopy(serviceLocale: ServiceLocale) {
  if (serviceLocale === "ko") {
    return {
      newStory: "이야기 쓰기",
      storyDetail: "슬서운 이야기",
      close: "닫기",
      deleteStory: "삭제",
      deleteConfirm: "이 이야기를 삭제할까요?",
      searchPlaceholder: "검색",
      noResults: "검색 결과가 없습니다",
      sort: {
        recommended: "추천",
        comments: "댓글",
        latest: "최신",
      },
    };
  }

  return {
    newStory: "Write story",
    storyDetail: "Slseoun story",
    close: "Close",
    deleteStory: "Delete",
    deleteConfirm: "Delete this story?",
    searchPlaceholder: "Search",
    noResults: "No stories found",
    sort: {
      recommended: "Recommended",
      comments: "Comments",
      latest: "Latest",
    },
  };
}

function stableHash(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function storyPublishedTime(story: Story) {
  if (!story.publishedAt) return 0;
  const time = Date.parse(story.publishedAt);
  return Number.isFinite(time) ? time : 0;
}

function formatShortDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function formatShortTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function isSameLocalDate(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatStoryPublishedAt(publishedAt: string, serviceLocale: ServiceLocale) {
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  if (isSameLocalDate(date, now)) {
    return formatShortTime(date);
  }

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.floor((startOfToday - startOfDate) / 86_400_000);
  if (dayDiff >= 1 && dayDiff <= 6) {
    return serviceLocale === "ko" ? `${dayDiff}일 전` : `${dayDiff}d ago`;
  }

  return formatShortDate(date);
}

function reactionTotal(counts: StoryReactionCounts | undefined) {
  if (!counts) return 0;
  return Object.values(counts).reduce((total, count) => total + (count ?? 0), 0);
}

function storyReactionTotal(
  storyId: string,
  counts: ReturnType<typeof useEngagementCounts>,
) {
  return Math.max(counts.likes[storyId] ?? 0, reactionTotal(counts.reactions[storyId]));
}

function storyRecommendedScore(
  story: Story,
  counts: ReturnType<typeof useEngagementCounts>,
) {
  const reactions = storyReactionTotal(story.id, counts);
  const comments = counts.comments[story.id] ?? 0;
  const communityBase = story.community ? 2 : 0;

  return reactions * 4 + comments * 6 + communityBase;
}

function stableStoryOrder(
  stories: Story[],
  sortMode: StorySortMode,
  counts: ReturnType<typeof useEngagementCounts>,
) {
  return [...stories].sort((a, b) => {
    if (sortMode === "comments") {
      const commentDiff = (counts.comments[b.id] ?? 0) - (counts.comments[a.id] ?? 0);
      if (commentDiff !== 0) return commentDiff;
    } else if (sortMode === "recommended") {
      const scoreDiff = storyRecommendedScore(b, counts) - storyRecommendedScore(a, counts);
      if (scoreDiff !== 0) return scoreDiff;
    }

    const publishedDiff = storyPublishedTime(b) - storyPublishedTime(a);
    if (publishedDiff !== 0) return publishedDiff;

    const rankA = stableHash(a.id);
    const rankB = stableHash(b.id);
    return rankA - rankB || a.id.localeCompare(b.id);
  });
}

function storySearchText(story: Story, patchLineMap: Map<string, STS2PatchLine>) {
  const patchLine = story.patchLineId ? patchLineMap.get(story.patchLineId) : undefined;
  return [
    story.sentence,
    story.authorName,
    story.source,
    story.patchLineId,
    patchLine?.searchText,
    story.game,
    story.entityType,
    story.entityId,
    story.changeId,
    ...(story.tags ?? []),
    ...(story.linkedEntities?.flatMap((entity) => [
      entity.game,
      entity.entityType,
      entity.entityId,
      entity.label,
    ]) ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
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
      return buildCompendiumResourceHref("card", entity.id);
    case "relic":
      return buildCompendiumResourceHref("relic", entity.id);
    case "potion":
      return buildCompendiumResourceHref("potion", entity.id);
    case "power":
      return buildCompendiumResourceHref("power", entity.id);
    case "enchantment":
      return buildCompendiumResourceHref("enchantment", entity.id);
    case "event":
      return buildCompendiumResourceHref("event", entity.id);
    case "monster":
      return buildCompendiumResourceHref("monster", entity.id);
    case "encounter":
      return buildCompendiumResourceHref("encounter", entity.id);
    case "ancient":
      return buildCompendiumResourceHref("ancient", entity.id);
    case "epoch":
      return buildCompendiumResourceHref("epoch", entity.id);
    default:
      return null;
  }
}

function STS2EntityInfoBlock({ entity, label, serviceLocale }: { entity?: EntityInfo; label?: string; serviceLocale: ServiceLocale }) {
  if (!entity) return null;

  const href = sts2EntityHref(entity);
  const image = entity.imageUrl;
  const imageAlt = entity.nameKo || entity.nameEn;
  const title = serviceLocale === "ko" ? entity.nameKo || entity.nameEn : entity.nameEn || entity.nameKo;
  const subtitle = serviceLocale === "ko" ? entity.nameEn : entity.nameKo;
  const body = entity.type === "card" && entity.cardData ? (
    <div className="flex items-start gap-3 group">
      <div className="shrink-0">
        <CardTile
          card={entity.cardData}
          serviceLocale={serviceLocale}
          showUpgrade={false}
          showBeta={false}
          width={96}
          interactive={false}
        />
      </div>
      <div className="min-w-0 pt-2">
        <p className="font-medium transition-colors group-hover:text-yellow-500">
          {title}
          {label && (
            <span className="ml-1.5 rounded bg-red-500/10 px-1 py-0.5 text-[10px] font-medium text-red-400">
              {label}
            </span>
          )}
        </p>
        {subtitle && subtitle !== title && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
  ) : (
    <div className="flex gap-3 items-start group">
      {image ? (
        <Image
          src={image}
          alt={imageAlt}
          width={64}
          height={64}
          className="h-16 w-16 shrink-0 object-contain transition-transform group-hover:scale-105"
        />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-border bg-zinc-900">
          <span className="px-1 text-center text-[9px] text-muted-foreground">{title}</span>
        </div>
      )}
      <div>
        <p className="font-medium transition-colors group-hover:text-yellow-500">
          {title}
          {label && (
            <span className="ml-1.5 rounded bg-red-500/10 px-1 py-0.5 text-[10px] font-medium text-red-400">
              {label}
            </span>
          )}
        </p>
        {subtitle && subtitle !== title && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
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

function patchHrefFromId(patch: string | undefined): string | null {
  if (!patch) return null;
  return `/patches/${patch.replace(/^v/, "")}`;
}

function STS2PatchLineBlock({
  patchLine,
  change,
  story,
  patch,
  serviceLocale,
  patches,
  entities,
}: {
  patchLine?: STS2PatchLine;
  change?: STS2Change;
  story: Story;
  patch?: STS2Patch;
  serviceLocale: ServiceLocale;
  patches?: STS2Patch[];
  entities?: EntityInfo[];
}) {
  if (patchLine) {
    return (
      <PatchLineReferenceBlock
        patchLine={patchLine}
        serviceLocale={serviceLocale}
        patches={patches}
        entities={entities}
      />
    );
  }

  const patchId = change?.patch ?? story.source;
  const href = patchHrefFromId(patchId);
  const patchLabel = patchId;
  const fallbackSummary = serviceLocale === "ko" ? change?.summaryKo ?? change?.summary : change?.summary ?? change?.summaryKo;

  return (
    <div className="rounded-lg border border-border bg-card/30 p-4">
      <div className="mb-2 flex items-center gap-2">
        {href && patchLabel ? (
          <Link href={localizeHref(href, serviceLocale)} className="text-sm font-medium text-yellow-500 hover:text-yellow-400">
            {patchLabel}
          </Link>
        ) : patchLabel ? (
          <span className="text-sm font-medium text-yellow-500">{patchLabel}</span>
        ) : null}
        {(change?.date ?? patch?.date) && (
          <span className="text-xs text-muted-foreground">{change?.date ?? patch?.date}</span>
        )}
      </div>
      {fallbackSummary && (
        <p className="text-sm leading-relaxed text-muted-foreground">{fallbackSummary}</p>
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
  serviceLocale,
  entityChanges,
  cardMap,
  relicMap,
  potionMap,
  changeMap,
  sts2EntityMap,
  sts2ChangeMap,
  sts2PatchMap,
  patchLineMap,
  sts2Patches,
  sts2Entities,
}: {
  story: Story;
  serviceLocale: ServiceLocale;
  entityChanges: Change[];
  cardMap: Map<string, Card>;
  relicMap: Map<string, Relic>;
  potionMap: Map<string, Potion>;
  changeMap: Map<string, Change>;
  sts2EntityMap: Map<string, EntityInfo>;
  sts2ChangeMap: Map<string, STS2Change>;
  sts2PatchMap: Map<string, STS2Patch>;
  patchLineMap: Map<string, STS2PatchLine>;
  sts2Patches: STS2Patch[];
  sts2Entities: EntityInfo[];
}) {
  const hasEntity = story.entityType && story.entityId;
  const isSTS2 = story.game === "sts2";

  if (isSTS2) {
    const entity = hasEntity ? sts2EntityMap.get(`${story.entityType}:${story.entityId}`) : undefined;
    const change = story.changeId ? sts2ChangeMap.get(story.changeId) : undefined;
    const patchLine = story.patchLineId ? patchLineMap.get(story.patchLineId) : undefined;
    const patchId = patchLine?.patch ?? change?.patch ?? story.source;
    const patch = patchId ? sts2PatchMap.get(patchId) : undefined;
    const primaryLabel = story.tags?.includes("삭제") ? "삭제됨" : undefined;

    return (
      <div className="space-y-3">
        <STS2EntityInfoBlock entity={entity} label={primaryLabel} serviceLocale={serviceLocale} />
        {(patchLine || change || story.source) && (
          <STS2PatchLineBlock
            patchLine={patchLine}
            change={change}
            story={story}
            patch={patch}
            serviceLocale={serviceLocale}
            patches={sts2Patches}
            entities={sts2Entities}
          />
        )}

        {story.linkedEntities?.map((linked) => {
          const isSTS1LinkedEntity = linked.game === "sts1" && isSTS1EntityType(linked.entityType);

          return (
            <div key={`${linked.game ?? "sts2"}-${linked.entityType}-${linked.entityId}`} className="space-y-3 border-t border-border/30 pt-3">
              {!isSTS1LinkedEntity && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>↳</span>
                  <span>관련 항목</span>
                </div>
              )}
              {isSTS1LinkedEntity ? (
                <EntityInfoBlock
                  entityType={linked.entityType}
                  entityId={linked.entityId}
                  card={cardMap.get(linked.entityId)}
                  relic={relicMap.get(linked.entityId)}
                  potion={potionMap.get(linked.entityId)}
                  label={linked.label}
                />
              ) : (
                <STS2EntityInfoBlock
                  entity={sts2EntityMap.get(`${linked.entityType}:${linked.entityId}`)}
                  label={linked.label}
                  serviceLocale={serviceLocale}
                />
              )}
            </div>
          );
        })}
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
          <div key={`${linked.game ?? "sts1"}-${linked.entityType}-${linked.entityId}`} className="border-t border-border/30 pt-3 space-y-3">
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
  serviceLocale,
  userId,
  authReady,
  ensureUser,
  onOpen,
  canDelete,
  onDelete,
  likeCount,
  reactionCounts,
  commentCount,
  engagementLoading,
  engagementUnavailable,
}: {
  story: Story;
  serviceLocale: ServiceLocale;
  userId: string | null;
  authReady: boolean;
  ensureUser: () => Promise<string | null>;
  onOpen: (storyId: string) => void;
  canDelete: boolean;
  onDelete: (storyId: string) => Promise<void>;
  likeCount: number;
  reactionCounts: StoryReactionCounts;
  commentCount: number;
  engagementLoading: boolean;
  engagementUnavailable: boolean;
}) {
  const [deleting, setDeleting] = useState(false);
  const copy = storyFeedCopy(serviceLocale);
  const publishedLabel = story.publishedAt ? formatStoryPublishedAt(story.publishedAt, serviceLocale) : "";

  const handleDelete = async () => {
    if (!canDelete || deleting || !window.confirm(copy.deleteConfirm)) return;
    setDeleting(true);
    try {
      await onDelete(story.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <article className="relative border-b border-border/50 last:border-b-0">
      <div className="px-4 py-6">
        {/* Sentence + engagement */}
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <button
              onClick={() => onOpen(story.id)}
              className="w-full cursor-pointer hover:opacity-80 transition-opacity"
            >
              <p className="text-lg sm:text-xl font-medium leading-snug text-center">
                &ldquo;{story.sentence}&rdquo;
                <EngagementSummary
                  commentCount={commentCount}
                  loading={engagementLoading}
                  unavailable={engagementUnavailable}
                  className="ml-2"
                />
              </p>
            </button>
            {story.community && (
              <div className="mt-1 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
                <span>
                  {story.authorName}
                  {publishedLabel ? ` · ${publishedLabel}` : ""}
                </span>
                {canDelete && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:pointer-events-none disabled:opacity-40"
                    title={copy.deleteStory}
                  >
                    {deleting ? <EngagementSpinner size={12} /> : <Trash2 size={12} />}
                    <span className="sr-only">{copy.deleteStory}</span>
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="shrink-0">
            <StoryReactionButton
              storyId={story.id}
              userId={userId}
              initialCounts={reactionCounts}
              initialTotal={likeCount}
              authReady={authReady}
              userStatusLoading="lazy"
              ensureUser={ensureUser}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

function StoryDetailModal({
  story,
  serviceLocale,
  entityChanges,
  cardMap,
  relicMap,
  potionMap,
  changeMap,
  sts2EntityMap,
  sts2ChangeMap,
  sts2PatchMap,
  patchLineMap,
  sts2Patches,
  sts2Entities,
  userId,
  authReady,
  ensureUser,
  likeCount,
  reactionCounts,
  commentCount,
  engagementLoading,
  engagementUnavailable,
  onCommentCountChange,
  onClose,
}: {
  story: Story;
  serviceLocale: ServiceLocale;
  entityChanges: Change[];
  cardMap: Map<string, Card>;
  relicMap: Map<string, Relic>;
  potionMap: Map<string, Potion>;
  changeMap: Map<string, Change>;
  sts2EntityMap: Map<string, EntityInfo>;
  sts2ChangeMap: Map<string, STS2Change>;
  sts2PatchMap: Map<string, STS2Patch>;
  patchLineMap: Map<string, STS2PatchLine>;
  sts2Patches: STS2Patch[];
  sts2Entities: EntityInfo[];
  userId: string | null;
  authReady: boolean;
  ensureUser: () => Promise<string | null>;
  likeCount: number;
  reactionCounts: StoryReactionCounts;
  commentCount: number;
  engagementLoading: boolean;
  engagementUnavailable: boolean;
  onCommentCountChange: (storyId: string, count: number) => void;
  onClose: () => void;
}) {
  const copy = storyFeedCopy(serviceLocale);
  const publishedLabel = story.publishedAt ? formatStoryPublishedAt(story.publishedAt, serviceLocale) : "";

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 px-3 py-6 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={copy.storyDetail}
      data-story-detail-modal
      onClick={onClose}
    >
      <article
        className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-lg border border-border bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <h2 className="text-sm font-semibold">{copy.storyDetail}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            title={copy.close}
          >
            <X size={16} />
            <span className="sr-only">{copy.close}</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1 text-center">
              <p className="text-xl font-medium leading-snug sm:text-2xl">
                &ldquo;{story.sentence}&rdquo;
                <EngagementSummary
                  commentCount={commentCount}
                  loading={engagementLoading}
                  unavailable={engagementUnavailable}
                  className="ml-2"
                />
              </p>
              {story.community && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {story.authorName}
                  {publishedLabel ? ` · ${publishedLabel}` : ""}
                </p>
              )}
            </div>
            <StoryReactionButton
              storyId={story.id}
              userId={userId}
              initialCounts={reactionCounts}
              initialTotal={likeCount}
              authReady={authReady}
              userStatusLoading="lazy"
              ensureUser={ensureUser}
            />
          </div>

          <StoryExpanded
            story={story}
            serviceLocale={serviceLocale}
            entityChanges={entityChanges}
            cardMap={cardMap}
            relicMap={relicMap}
            potionMap={potionMap}
            changeMap={changeMap}
            sts2EntityMap={sts2EntityMap}
            sts2ChangeMap={sts2ChangeMap}
            sts2PatchMap={sts2PatchMap}
            patchLineMap={patchLineMap}
            sts2Patches={sts2Patches}
            sts2Entities={sts2Entities}
          />

          <CommentSection
            threadKey={story.id}
            onCountChange={(count) => onCommentCountChange(story.id, count)}
          />
        </div>
      </article>
    </div>
  );
}

function StoryFeedToolbar({
  serviceLocale,
  sortMode,
  onSortModeChange,
  searchQuery,
  onSearchQueryChange,
  onOpenComposer,
}: {
  serviceLocale: ServiceLocale;
  sortMode: StorySortMode;
  onSortModeChange: (sortMode: StorySortMode) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onOpenComposer: () => void;
}) {
  const copy = storyFeedCopy(serviceLocale);

  return (
    <div className="flex flex-col gap-2 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="inline-flex overflow-hidden rounded-md border border-border/70 bg-background/40">
        {STORY_SORT_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onSortModeChange(option)}
            className={`h-8 px-3 text-xs transition-colors ${
              sortMode === option
                ? "bg-white/10 text-foreground"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            }`}
          >
            {copy.sort[option]}
          </button>
        ))}
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <label className="relative block min-w-0 flex-1 sm:w-52">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder={copy.searchPlaceholder}
            className="h-8 w-full rounded-md border border-border/70 bg-background/40 pl-8 pr-2.5 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-yellow-500/40"
          />
        </label>
        <button
          type="button"
          onClick={onOpenComposer}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-[#fb923c]/50 bg-[#fb923c]/15 px-3 text-xs font-semibold text-[#fed7aa] shadow-[0_0_18px_rgba(251,146,60,0.14)] transition-colors hover:border-[#fb923c]/75 hover:bg-[#fb923c]/25 hover:text-white"
        >
          <StoryWriteIcon size={16} />
          <span>{copy.newStory}</span>
        </button>
      </div>
    </div>
  );
}

export function StoryFeed({
  serviceLocale = "ko",
  storyPlaceholder,
  stories,
  cards,
  relics,
  potions,
  changes,
  sts2Changes = [],
  sts2Patches = [],
  sts2PatchLines = [],
  sts2Entities = [],
}: {
  serviceLocale?: ServiceLocale;
  storyPlaceholder: string;
  stories: Story[];
  cards: Card[];
  relics: Relic[];
  potions: Potion[];
  changes: Change[];
  sts2Changes?: STS2Change[];
  sts2Patches?: STS2Patch[];
  sts2PatchLines?: STS2PatchLine[];
  sts2Entities?: EntityInfo[];
}) {
  const { userId, ready: authReady, ensureUser } = useAuth();
  const communityStories = useCommunityStories(userId);
  const counts = useEngagementCounts();
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [commentCountOverrides, setCommentCountOverrides] = useState<Record<string, number>>({});
  const [sortMode, setSortMode] = useState<StorySortMode>("recommended");
  const [searchQuery, setSearchQuery] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [loadedPatchLines, setLoadedPatchLines] = useState<STS2PatchLine[] | null>(null);
  const didMountRef = useRef(false);

  const handleCommentCountChange = useCallback((storyId: string, count: number) => {
    setCommentCountOverrides((prev) => ({
      ...prev,
      [storyId]: count,
    }));
  }, []);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      queueMicrotask(() => setActiveStoryId(hash.split(",")[0] ?? null));
    }
  }, []);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    const nextUrl = activeStoryId
      ? `#${activeStoryId}`
      : `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, "", nextUrl);
  }, [activeStoryId]);

  const patchLineOptions = loadedPatchLines ?? sts2PatchLines;
  const patchLineMap = useMemo(() => new Map(patchLineOptions.map((line) => [line.id, line])), [patchLineOptions]);
  const allStories = useMemo(() => {
    const byId = new Map(stories.map((story) => [story.id, story]));
    for (const story of communityStories.stories) {
      const existing = byId.get(story.id);
      byId.set(story.id, existing ? {
        ...existing,
        ...story,
        tags: story.tags ?? existing.tags,
        linkedEntities: story.linkedEntities ?? existing.linkedEntities,
      } : story);
    }
    return Array.from(byId.values());
  }, [communityStories.stories, stories]);
  const hasMissingPatchLine = useMemo(
    () => allStories.some((story) => story.patchLineId && !patchLineMap.has(story.patchLineId)),
    [allStories, patchLineMap],
  );

  useEffect(() => {
    if (loadedPatchLines || (!composerOpen && !hasMissingPatchLine)) return;
    let cancelled = false;
    loadFullSts2PatchLines()
      .then((lines) => {
        if (!cancelled) setLoadedPatchLines(lines);
      })
      .catch(() => {
        if (!cancelled) setLoadedPatchLines(sts2PatchLines);
      });
    return () => {
      cancelled = true;
    };
  }, [composerOpen, hasMissingPatchLine, loadedPatchLines, sts2PatchLines]);
  const searchTerm = searchQuery.trim().toLocaleLowerCase();
  const orderedStories = useMemo(() => {
    const filteredStories = searchTerm
      ? allStories.filter((story) => storySearchText(story, patchLineMap).includes(searchTerm))
      : allStories;
    return stableStoryOrder(filteredStories, sortMode, counts);
  }, [allStories, counts, patchLineMap, searchTerm, sortMode]);
  const activeStory = useMemo(
    () => activeStoryId ? allStories.find((story) => story.id === activeStoryId) ?? null : null,
    [activeStoryId, allStories],
  );

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
  const activeStoryEntityKey = activeStory && isSTS1EntityType(activeStory.entityType) && activeStory.entityId
    ? `${activeStory.entityType}:${activeStory.entityId}`
    : "";

  return (
    <div>
      {composerOpen && (
        <StoryComposerModal
          serviceLocale={serviceLocale}
          storyPlaceholder={storyPlaceholder}
          userId={userId}
          authReady={authReady}
          ensureUser={ensureUser}
          patchLines={patchLineOptions}
          patches={sts2Patches}
          entities={sts2Entities}
          onAdd={communityStories.add}
          onClose={() => setComposerOpen(false)}
        />
      )}
      {activeStory && (
        <StoryDetailModal
          story={activeStory}
          serviceLocale={serviceLocale}
          entityChanges={entityChangeIndex.get(activeStoryEntityKey) ?? []}
          cardMap={cardMap}
          relicMap={relicMap}
          potionMap={potionMap}
          changeMap={changeMap}
          sts2EntityMap={sts2EntityMap}
          sts2ChangeMap={sts2ChangeMap}
          sts2PatchMap={sts2PatchMap}
          patchLineMap={patchLineMap}
          sts2Patches={sts2Patches}
          sts2Entities={sts2Entities}
          userId={userId}
          authReady={authReady}
          ensureUser={ensureUser}
          likeCount={counts.likes[activeStory.id] ?? 0}
          reactionCounts={counts.reactions[activeStory.id] ?? {}}
          commentCount={commentCountOverrides[activeStory.id] ?? counts.comments[activeStory.id] ?? 0}
          engagementLoading={counts.loading}
          engagementUnavailable={counts.unavailable}
          onCommentCountChange={handleCommentCountChange}
          onClose={() => setActiveStoryId(null)}
        />
      )}
      <StoryFeedToolbar
        serviceLocale={serviceLocale}
        sortMode={sortMode}
        onSortModeChange={setSortMode}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onOpenComposer={() => setComposerOpen(true)}
      />
      {communityStories.unavailable ? (
        <StorageUnavailableNotice title={serviceMessages[serviceLocale].comments.unavailableTitle} />
      ) : (
        <div className="divide-y divide-border/50">
          {orderedStories.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              {storyFeedCopy(serviceLocale).noResults}
            </div>
          ) : orderedStories.map((story) => (
              <StoryCard
                key={story.id}
                story={story}
                serviceLocale={serviceLocale}
                userId={userId}
                authReady={authReady}
                ensureUser={ensureUser}
                onOpen={setActiveStoryId}
                canDelete={Boolean(story.community && userId && story.authorUserId === userId)}
                onDelete={communityStories.remove}
                likeCount={counts.likes[story.id] ?? 0}
                reactionCounts={counts.reactions[story.id] ?? {}}
                commentCount={commentCountOverrides[story.id] ?? counts.comments[story.id] ?? 0}
                engagementLoading={counts.loading}
                engagementUnavailable={counts.unavailable}
              />
          ))}
        </div>
      )}
    </div>
  );
}

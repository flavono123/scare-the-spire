"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "@/components/ui/static-image";
import Link from "next/link";
import { PenLine, Search } from "lucide-react";
import type { Story, Card, Change, Relic, Potion, LinkedEntity, STS2Change, STS2Patch, StoryEntityType } from "@/lib/types";
import { localizeHref, type ServiceLocale } from "@/lib/i18n";
import { buildCompendiumResourceHref } from "@/lib/compendium-resource-links";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { useAuth } from "@/hooks/use-auth";
import { useCommunityStories } from "@/hooks/use-community-stories";
import { useEngagementCounts } from "@/hooks/use-engagement-counts";
import { useUserProfile } from "@/hooks/use-user-profile";
import { StoryReactionButton } from "@/components/story-reaction-button";
import { CommentSection } from "@/components/comment-section";
import { EngagementSummary } from "@/components/engagement-summary";
import { EngagementSpinner } from "@/components/engagement-spinner";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import { VersionDiffLine } from "@/components/codex/sts2-change-history";
import { CardTile } from "@/components/codex/card-tile";
import type { StoryReactionCounts } from "@/lib/reactions";
import { supabaseEnabled } from "@/lib/supabase";
import { DEFAULT_USER_PROFILE } from "@/lib/user-profile";

type StorySortMode = "recommended" | "comments" | "latest";

const STORY_DRAFT_MAX_LENGTH = 120;
const STORY_SORT_OPTIONS: StorySortMode[] = ["recommended", "comments", "latest"];

function storyFeedCopy(serviceLocale: ServiceLocale) {
  if (serviceLocale === "ko") {
    return {
      write: "작성",
      writing: "...",
      nickname: "닉네임",
      storyPlaceholder: "슬서운 이야기를 입력하세요",
      searchPlaceholder: "검색",
      noResults: "검색 결과가 없습니다",
      storageUnavailable: "데이터베이스가 응답하지 않습니다",
      communityLoading: "불러오는 중...",
      sort: {
        recommended: "추천",
        comments: "댓글",
        latest: "최신",
      },
    };
  }

  return {
    write: "Write",
    writing: "...",
    nickname: "Nickname",
    storyPlaceholder: "Write a Slseoun story",
    searchPlaceholder: "Search",
    noResults: "No stories found",
    storageUnavailable: "No responses from database",
    communityLoading: "Loading...",
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
  now: number,
) {
  const reactions = storyReactionTotal(story.id, counts);
  const comments = counts.comments[story.id] ?? 0;
  const publishedAt = storyPublishedTime(story);
  const ageHours = publishedAt > 0 ? Math.max(0, (now - publishedAt) / 36e5) : 240;
  const freshness = Math.max(0, 16 - ageHours / 6);
  const communityBase = story.community ? 2 : 0;

  return reactions * 4 + comments * 6 + freshness + communityBase;
}

function stableStoryOrder(
  stories: Story[],
  sortMode: StorySortMode,
  counts: ReturnType<typeof useEngagementCounts>,
  now: number,
) {
  return [...stories].sort((a, b) => {
    if (sortMode === "comments") {
      const commentDiff = (counts.comments[b.id] ?? 0) - (counts.comments[a.id] ?? 0);
      if (commentDiff !== 0) return commentDiff;
    } else if (sortMode === "recommended") {
      const scoreDiff = storyRecommendedScore(b, counts, now) - storyRecommendedScore(a, counts, now);
      if (scoreDiff !== 0) return scoreDiff;
    }

    const publishedDiff = storyPublishedTime(b) - storyPublishedTime(a);
    if (publishedDiff !== 0) return publishedDiff;

    const rankA = stableHash(a.id);
    const rankB = stableHash(b.id);
    return rankA - rankB || a.id.localeCompare(b.id);
  });
}

function storySearchText(story: Story) {
  return [
    story.sentence,
    story.authorName,
    story.source,
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

function STS2DiffLine({ diff, serviceLocale }: { diff: STS2Change["diffs"][0]; serviceLocale: ServiceLocale }) {
  const before = serviceLocale === "ko" ? diff.beforeKo ?? diff.before : diff.before ?? diff.beforeKo;
  const after = serviceLocale === "ko" ? diff.afterKo ?? diff.after : diff.after ?? diff.afterKo;
  const displayName = serviceLocale === "ko" ? diff.displayNameKo || diff.displayName : diff.displayName || diff.displayNameKo;

  return (
    <div className="flex items-center gap-1.5 text-sm">
      {diff.upgraded && (
        <span className="rounded bg-green-500/10 px-1 text-[10px] font-medium text-green-400">+</span>
      )}
      <span className="shrink-0 whitespace-nowrap text-muted-foreground">{displayName}</span>
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

function patchHref(change: STS2Change | undefined, story: Story): string | null {
  const patch = change?.patch ?? story.source;
  if (!patch) return null;
  return `/patches/${patch.replace(/^v/, "")}`;
}

function STS2ChangeBlock({ change, story, patch, serviceLocale }: { change?: STS2Change; story: Story; patch?: STS2Patch; serviceLocale: ServiceLocale }) {
  const href = patchHref(change, story);
  const patchLabel = change?.patch ?? story.source;
  const summary = serviceLocale === "ko" ? change?.summaryKo ?? change?.summary : change?.summary ?? change?.summaryKo;
  const fieldDiffs = change?.fieldDiffs ?? [];

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
      {summary && (
        <p className="mb-2 text-xs text-muted-foreground">{summary}</p>
      )}
      {change && (
        <div className="space-y-1">
          {fieldDiffs.length > 0
            ? fieldDiffs.map((diff, index) => (
                <VersionDiffLine
                  key={`${change.id}-${diff.field}-${diff.upgraded ? "upgraded" : "base"}-${index}`}
                  diff={diff}
                  serviceLocale={serviceLocale}
                />
              ))
            : change.diffs.map((d, i) => (
                <STS2DiffLine key={i} diff={d} serviceLocale={serviceLocale} />
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
  serviceLocale,
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
  serviceLocale: ServiceLocale;
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
        <STS2EntityInfoBlock entity={entity} label={primaryLabel} serviceLocale={serviceLocale} />
        {(change || story.source) && (
          <STS2ChangeBlock change={change} story={story} patch={patch} serviceLocale={serviceLocale} />
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
  entityChanges,
  cardMap,
  relicMap,
  potionMap,
  changeMap,
  sts2EntityMap,
  sts2ChangeMap,
  sts2PatchMap,
  userId,
  authReady,
  ensureUser,
  expanded,
  onToggle,
  likeCount,
  reactionCounts,
  commentCount,
  engagementLoading,
  engagementUnavailable,
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
  userId: string | null;
  authReady: boolean;
  ensureUser: () => Promise<string | null>;
  expanded: boolean;
  onToggle: (storyId: string) => void;
  likeCount: number;
  reactionCounts: StoryReactionCounts;
  commentCount: number;
  engagementLoading: boolean;
  engagementUnavailable: boolean;
}) {
  const [liveCommentCount, setLiveCommentCount] = useState<number | null>(null);
  const displayCommentCount = liveCommentCount ?? commentCount;
  const dateLocale = serviceLocale === "ko" ? "ko-KR" : "en-US";

  return (
    <article className="relative border-b border-border/50 last:border-b-0">
      <div className="px-4 py-6">
        {/* Sentence + engagement */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onToggle(story.id)}
            className="flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <p className="text-lg sm:text-xl font-medium leading-snug text-center">
              &ldquo;{story.sentence}&rdquo;
              <EngagementSummary
                commentCount={displayCommentCount}
                loading={engagementLoading}
                unavailable={engagementUnavailable}
                className="ml-2"
              />
            </p>
            {story.community && (
              <p className="mt-1 text-center text-[11px] text-muted-foreground">
                {story.authorName}
                {story.publishedAt ? ` · ${new Date(story.publishedAt).toLocaleDateString(dateLocale)}` : ""}
              </p>
            )}
          </button>
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

        {/* Expanded: entity info, all changes, linked entities, comments */}
        {expanded && (
          <div className="mt-4 space-y-3">
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
            />
            <CommentSection threadKey={story.id} onCountChange={setLiveCommentCount} />
          </div>
        )}
      </div>
    </article>
  );
}

function StoryComposer({
  serviceLocale,
  userId,
  authReady,
  ensureUser,
  unavailable,
  loading,
  onAdd,
}: {
  serviceLocale: ServiceLocale;
  userId: string | null;
  authReady: boolean;
  ensureUser: () => Promise<string | null>;
  unavailable: boolean;
  loading: boolean;
  onAdd: (sentence: string, nickname: string, activeUserId?: string) => Promise<void>;
}) {
  const copy = storyFeedCopy(serviceLocale);
  const profileFallback = useMemo(
    () => ({ ...DEFAULT_USER_PROFILE, nickname: serviceLocale === "ko" ? "닉" : "Nick" }),
    [serviceLocale],
  );
  const { profile } = useUserProfile(profileFallback);
  const [sentence, setSentence] = useState("");
  const [nickname, setNickname] = useState(profile.nickname);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setNickname(profile.nickname);
  }, [profile.nickname]);

  const trimmedSentence = sentence.trim();
  const disabled = !authReady || !supabaseEnabled || unavailable || submitting || trimmedSentence.length < 2 || !nickname.trim();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled) return;

    setSubmitting(true);
    try {
      const activeUserId = userId ?? await ensureUser();
      if (!activeUserId) return;
      await onAdd(trimmedSentence, nickname, activeUserId);
      setSentence("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2 border-b border-border/50 px-4 py-4">
      {unavailable || !supabaseEnabled ? (
        <StorageUnavailableNotice compact title={copy.storageUnavailable} className="pb-1 pt-0" />
      ) : null}
      <div className="flex items-start gap-2">
        <textarea
          value={sentence}
          onChange={(event) => setSentence(event.target.value.slice(0, STORY_DRAFT_MAX_LENGTH))}
          placeholder={copy.storyPlaceholder}
          maxLength={STORY_DRAFT_MAX_LENGTH}
          rows={2}
          disabled={!authReady || !supabaseEnabled || unavailable}
          className="min-h-16 flex-1 resize-none rounded-md border border-border/70 bg-background/60 px-3 py-2 text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-yellow-500/40 disabled:opacity-40"
        />
        <button
          type="submit"
          disabled={disabled}
          title={copy.write}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border/70 bg-card/40 text-muted-foreground transition-colors hover:border-yellow-500/40 hover:text-yellow-400 disabled:opacity-30"
        >
          {submitting ? <EngagementSpinner size={16} /> : <PenLine size={16} />}
          <span className="sr-only">{submitting ? copy.writing : copy.write}</span>
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={nickname}
          onChange={(event) => setNickname(event.target.value.slice(0, 20))}
          placeholder={copy.nickname}
          maxLength={20}
          disabled={!authReady || !supabaseEnabled || unavailable}
          className="h-8 min-w-0 flex-1 rounded-md border border-border/60 bg-background/50 px-2.5 text-xs text-muted-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-yellow-500/40 disabled:opacity-40"
        />
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {sentence.length}/{STORY_DRAFT_MAX_LENGTH}
        </span>
        {loading && (
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
            <EngagementSpinner size={12} />
            {copy.communityLoading}
          </span>
        )}
      </div>
    </form>
  );
}

function StoryFeedToolbar({
  serviceLocale,
  sortMode,
  onSortModeChange,
  searchQuery,
  onSearchQueryChange,
}: {
  serviceLocale: ServiceLocale;
  sortMode: StorySortMode;
  onSortModeChange: (sortMode: StorySortMode) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
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
      <label className="relative block min-w-0 sm:w-52">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder={copy.searchPlaceholder}
          className="h-8 w-full rounded-md border border-border/70 bg-background/40 pl-8 pr-2.5 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-yellow-500/40"
        />
      </label>
    </div>
  );
}

export function StoryFeed({
  serviceLocale = "ko",
  stories,
  cards,
  relics,
  potions,
  changes,
  sts2Changes = [],
  sts2Patches = [],
  sts2Entities = [],
}: {
  serviceLocale?: ServiceLocale;
  stories: Story[];
  cards: Card[];
  relics: Relic[];
  potions: Potion[];
  changes: Change[];
  sts2Changes?: STS2Change[];
  sts2Patches?: STS2Patch[];
  sts2Entities?: EntityInfo[];
}) {
  const { userId, ready: authReady, ensureUser } = useAuth();
  const communityStories = useCommunityStories(userId);
  const counts = useEngagementCounts();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [sortMode, setSortMode] = useState<StorySortMode>("recommended");
  const [searchQuery, setSearchQuery] = useState("");
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

  const allStories = useMemo(
    () => [...stories, ...communityStories.stories],
    [communityStories.stories, stories],
  );
  const searchTerm = searchQuery.trim().toLocaleLowerCase();
  const orderedStories = useMemo(() => {
    const filteredStories = searchTerm
      ? allStories.filter((story) => storySearchText(story).includes(searchTerm))
      : allStories;
    return stableStoryOrder(filteredStories, sortMode, counts, Date.now());
  }, [allStories, counts, searchTerm, sortMode]);

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
    <div>
      <StoryComposer
        serviceLocale={serviceLocale}
        userId={userId}
        authReady={authReady}
        ensureUser={ensureUser}
        unavailable={communityStories.unavailable}
        loading={communityStories.loading}
        onAdd={communityStories.add}
      />
      <StoryFeedToolbar
        serviceLocale={serviceLocale}
        sortMode={sortMode}
        onSortModeChange={setSortMode}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
      />
      <div className="divide-y divide-border/50">
        {orderedStories.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            {storyFeedCopy(serviceLocale).noResults}
          </div>
        ) : orderedStories.map((story) => {
        const key = isSTS1EntityType(story.entityType) && story.entityId ? `${story.entityType}:${story.entityId}` : "";
        return (
          <StoryCard
            key={story.id}
            story={story}
            serviceLocale={serviceLocale}
            entityChanges={entityChangeIndex.get(key) ?? []}
            cardMap={cardMap}
            relicMap={relicMap}
            potionMap={potionMap}
            changeMap={changeMap}
            sts2EntityMap={sts2EntityMap}
            sts2ChangeMap={sts2ChangeMap}
            sts2PatchMap={sts2PatchMap}
            userId={userId}
            authReady={authReady}
            ensureUser={ensureUser}
            expanded={expandedIds.has(story.id)}
            onToggle={toggle}
            likeCount={counts.likes[story.id] ?? 0}
            reactionCounts={counts.reactions[story.id] ?? {}}
            commentCount={counts.comments[story.id] ?? 0}
            engagementLoading={counts.loading}
            engagementUnavailable={counts.unavailable}
          />
        );
      })}
      </div>
    </div>
  );
}

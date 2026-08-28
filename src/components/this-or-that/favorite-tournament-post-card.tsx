"use client";

import { useCallback, type KeyboardEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { IndexCardEngagement } from "@/components/index-card-engagement";
import { OwnPostMark } from "@/components/own-post-mark";
import { DecisionsDecisionsBoard } from "@/components/decisions-decisions/decisions-decisions-board";
import { buildFavoriteTournamentCommentThreadKey } from "@/lib/comment-threads";
import { sortPoolRefs } from "@/lib/decisions-decisions";
import {
  FAVORITE_TOURNAMENT_HREF,
  type FavoriteTournamentPost,
} from "@/lib/favorite-tournament";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { formatTimeAgo } from "@/lib/relative-time";
import { serviceMessages } from "@/messages/service";
import type { EntityInfo } from "@/components/patch-note-renderer";

export function FavoriteTournamentPostCard({
  post,
  entityMap,
  isOwner = false,
  serviceLocale,
  gameLocale,
  userId,
  authReady = true,
  ensureUser,
  commentCount,
  likeCount,
}: {
  post: FavoriteTournamentPost;
  entityMap: Map<string, EntityInfo>;
  isOwner?: boolean;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  userId: string | null;
  authReady?: boolean;
  ensureUser?: () => Promise<string | null>;
  commentCount: number;
  likeCount: number;
}) {
  const copy = serviceMessages[serviceLocale].favoriteTournament;
  const dateLocale = serviceLocale === "ko" ? "ko-KR" : "en-US";
  const router = useRouter();
  const href = localizeHrefWithGameLocale(
    `${FAVORITE_TOURNAMENT_HREF}/${post.id}`,
    serviceLocale,
    gameLocale,
  );
  const commentsHref = `${href}#comments`;
  const threadKey = buildFavoriteTournamentCommentThreadKey(post.id);
  const pool = sortPoolRefs(post.pool, entityMap);

  const openPost = useCallback(() => {
    router.push(href);
  }, [href, router]);
  const handleClick = useCallback((event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("a, button, [role='button']")) return;
    openPost();
  }, [openPost]);
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openPost();
  }, [openPost]);

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="flex h-full cursor-pointer flex-col rounded-lg border border-border bg-card/25 px-4 py-4 transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-card/35 hover:shadow-lg hover:shadow-black/25 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary/70"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 font-game-title text-base font-semibold leading-snug spire-gold">
            {post.title}
          </h2>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {post.nickname}
            {isOwner && <OwnPostMark />}
            <span>{formatTimeAgo(post.created_at, copy, dateLocale)}</span>
            <span>{copy.roundLabel.replace("{size}", String(pool.length))}</span>
            <span>{copy.playCount.replace("{count}", String(post.play_count ?? 0))}</span>
          </span>
        </div>
        <IndexCardEngagement
          commentsHref={commentsHref}
          commentCount={commentCount}
          likeStoryId={threadKey}
          likeCount={likeCount}
          userId={userId}
          authReady={authReady}
          ensureUser={ensureUser}
        />
      </div>
      <DecisionsDecisionsBoard
        variant="pool"
        rows={[]}
        placements={[]}
        pool={pool}
        entitiesByKey={entityMap}
        serviceLocale={serviceLocale}
        gameLocale={gameLocale}
        showNames={false}
        selectedKey={null}
        readOnly
        compact
      />
      <div className="mt-3">
        <span className="inline-flex items-center rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
          {copy.play}
        </span>
      </div>
    </article>
  );
}

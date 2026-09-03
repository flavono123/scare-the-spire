"use client";

import { useCallback, type KeyboardEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { DisplayedProfileNickname } from "@/components/profile/displayed-profile-nickname";
import { IndexCardEngagement } from "@/components/index-card-engagement";
import { OwnPostMark } from "@/components/own-post-mark";
import { DecisionsDecisionsBoard } from "@/components/decisions-decisions/decisions-decisions-board";
import { buildDecisionsDecisionsCommentThreadKey } from "@/lib/comment-threads";
import {
  DECISIONS_DECISIONS_HREF,
  type DecisionsDecisionsPost,
  type DecisionsDecisionsResourceRef,
} from "@/lib/decisions-decisions";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { formatTimeAgo } from "@/lib/relative-time";
import { serviceMessages } from "@/messages/service";
import type { EntityInfo } from "@/components/patch-note-renderer";

export function DecisionsDecisionsPostCard({
  post,
  entityMap,
  pool,
  isOwner = false,
  serviceLocale,
  gameLocale,
  userId,
  authReady = true,
  ensureUser,
  commentCount,
  likeCount,
}: {
  post: DecisionsDecisionsPost;
  entityMap: Map<string, EntityInfo>;
  pool: DecisionsDecisionsResourceRef[];
  isOwner?: boolean;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  userId: string | null;
  authReady?: boolean;
  ensureUser?: () => Promise<string | null>;
  commentCount: number;
  likeCount: number;
}) {
  const copy = serviceMessages[serviceLocale].decisionsDecisions;
  const dateLocale = serviceLocale === "ko" ? "ko-KR" : "en-US";
  const router = useRouter();
  const href = localizeHrefWithGameLocale(
    `${DECISIONS_DECISIONS_HREF}/${post.id}`,
    serviceLocale,
    gameLocale,
  );
  const commentsHref = `${href}#comments`;
  const threadKey = buildDecisionsDecisionsCommentThreadKey(post.id);

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
          <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <DisplayedProfileNickname
              nickname={post.nickname}
              isOwner={isOwner}
              size={14}
              tokenClassName="h-3.5 w-3.5"
              nicknameClassName="text-xs text-muted-foreground"
            />
            {isOwner && <OwnPostMark />}
            <span>{formatTimeAgo(post.created_at, copy, dateLocale)}</span>
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
        rows={post.rows}
        placements={post.placements}
        pool={pool}
        entitiesByKey={entityMap}
        serviceLocale={serviceLocale}
        gameLocale={gameLocale}
        showNames={false}
        selectedKey={null}
        readOnly
        compact
      />
    </article>
  );
}

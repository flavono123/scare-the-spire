"use client";

import { useCallback, type KeyboardEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { IndexCardEngagement } from "@/components/index-card-engagement";
import { OwnPostMark } from "@/components/own-post-mark";
import {
  extractComboHistoryRunReferences,
  extractComboYouTubeReference,
  type ComboPost,
} from "@/lib/combo-types";
import { buildComboCommentThreadKey } from "@/lib/comment-threads";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";
import { formatTimeAgo } from "@/lib/relative-time";
import { ComboPostRenderer } from "./combo-post-renderer";
import { ComboResourceStack } from "./combo-resource-stack";
import { ComboYouTubeThumbnail } from "./combo-youtube-reference";
import { ComboHistoryRunThumbnails } from "./combo-history-run-reference";

interface ComboPostCardProps {
  post: ComboPost;
  entityMap: Map<string, EntityInfo>;
  isOwner?: boolean;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  userId: string | null;
  authReady?: boolean;
  ensureUser?: () => Promise<string | null>;
  commentCount: number;
  likeCount: number;
}

export function ComboPostCard({
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
}: ComboPostCardProps) {
  const copy = serviceMessages[serviceLocale].combo;
  const dateLocale = serviceLocale === "ko" ? "ko-KR" : "en-US";
  const router = useRouter();
  const youtubeReference = extractComboYouTubeReference(post.content);
  const historyRunReferences = extractComboHistoryRunReferences(post.content);
  const href = localizeHrefWithGameLocale(`/c-c-c-combo/${post.id}`, serviceLocale, gameLocale);
  const commentsHref = `${href}#comments`;
  const threadKey = buildComboCommentThreadKey(post.id);
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
      className="cursor-pointer rounded-lg border border-border bg-card/30 px-4 py-3 transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card/40 hover:shadow-lg hover:shadow-black/25 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary/70 active:translate-y-0 motion-reduce:transform-none"
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-gray-300">{post.nickname}</span>
          {isOwner && <OwnPostMark />}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {formatTimeAgo(post.created_at, copy, dateLocale)}
          </span>
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
      </div>

      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0 flex-1">
          <ComboResourceStack
            resources={post.resources}
            entityMap={entityMap}
            serviceLocale={serviceLocale}
            gameLocale={gameLocale}
          />
        </div>
        {youtubeReference && (
          <ComboYouTubeThumbnail reference={youtubeReference} />
        )}
        {!youtubeReference && historyRunReferences.length > 0 && (
          <ComboHistoryRunThumbnails
            references={historyRunReferences}
            serviceLocale={serviceLocale}
            gameLocale={gameLocale}
          />
        )}
      </div>

      {youtubeReference && historyRunReferences.length > 0 && (
        <div className="mt-2 flex justify-end">
          <ComboHistoryRunThumbnails
            references={historyRunReferences}
            serviceLocale={serviceLocale}
            gameLocale={gameLocale}
          />
        </div>
      )}

      <div className="text-sm leading-relaxed">
        <ComboPostRenderer
          blocks={post.content}
          entityMap={entityMap}
          serviceLocale={serviceLocale}
          gameLocale={gameLocale}
        />
      </div>
    </article>
  );
}

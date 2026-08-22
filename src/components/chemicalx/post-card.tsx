"use client";

import { useCallback, type KeyboardEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import type { ChemicalPost } from "@/lib/chemical-types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { IndexCardEngagement } from "@/components/index-card-engagement";
import { OwnPostMark } from "@/components/own-post-mark";
import { PostRenderer } from "./post-renderer";
import { buildChemicalXCommentThreadKey } from "@/lib/comment-threads";
import { localizeHref } from "@/lib/i18n";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";
import { formatTimeAgo } from "@/lib/relative-time";

interface PostCardProps {
  post: ChemicalPost;
  entityMap: Map<string, EntityInfo>;
  forceShowTooltips?: boolean;
  isOwner?: boolean;
  userId?: string | null;
  authReady?: boolean;
  ensureUser?: () => Promise<string | null>;
  commentCount?: number;
  likeCount?: number;
}

export function PostCard({
  post,
  entityMap,
  forceShowTooltips,
  isOwner = false,
  userId = null,
  authReady = true,
  ensureUser,
  commentCount = 0,
  likeCount = 0,
}: PostCardProps) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].chemicalX;
  const dateLocale = serviceLocale === "ko" ? "ko-KR" : "en-US";
  const router = useRouter();
  const href = localizeHref(`/chemical-x/${post.id}`, serviceLocale);
  const commentsHref = `${href}#comments`;
  const threadKey = buildChemicalXCommentThreadKey(post.id);
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
      className="group cursor-pointer rounded-lg border border-border bg-card/30 px-4 py-3 transition-colors hover:border-primary/20 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary/70"
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-gray-300">
            {post.nickname}
          </span>
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

      <div className="text-sm leading-relaxed">
        <PostRenderer
          blocks={post.content}
          entityMap={entityMap}
          forceShowTooltips={forceShowTooltips}
        />
      </div>
    </article>
  );
}

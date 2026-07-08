"use client";

import Link from "next/link";
import { ExternalLink, Trash2 } from "lucide-react";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { localizeHrefWithGameLocale } from "@/lib/i18n";
import type { ThisOrThatResolvedPost } from "@/lib/this-or-that";
import { serviceMessages } from "@/messages/service";
import { ThisOrThatLikeButton } from "@/components/this-or-that/like-button";
import { ThisOrThatResourcePanel } from "@/components/this-or-that/resource-panel";

function formatRelativeTime(template: string, count: number): string {
  return template.replace("{count}", String(count));
}

function timeAgo(
  dateStr: string,
  copy: Record<"justNow" | "minutesAgo" | "hoursAgo" | "daysAgo", string>,
  dateLocale: string,
): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return copy.justNow;
  if (minutes < 60) return formatRelativeTime(copy.minutesAgo, minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return formatRelativeTime(copy.hoursAgo, hours);
  const days = Math.floor(hours / 24);
  if (days < 30) return formatRelativeTime(copy.daysAgo, days);
  return new Date(dateStr).toLocaleDateString(dateLocale);
}

export function ThisOrThatPostCard({
  resolvedPost,
  serviceLocale,
  gameLocale,
  isOwner,
  likeCount,
  liked,
  likesLoading,
  likesUnavailable,
  canLike,
  onDelete,
  onToggleLike,
}: {
  resolvedPost: ThisOrThatResolvedPost;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  isOwner: boolean;
  likeCount: number;
  liked: boolean;
  likesLoading: boolean;
  likesUnavailable: boolean;
  canLike: boolean;
  onDelete: (postId: string) => void;
  onToggleLike: (postId: string) => void;
}) {
  const { post, leftEntity, rightEntity } = resolvedPost;
  const copy = serviceMessages[serviceLocale].thisOrThat;
  const dateLocale = serviceLocale === "ko" ? "ko-KR" : "en-US";
  const href = localizeHrefWithGameLocale(`/this-or-that/${post.id}`, serviceLocale, gameLocale);

  if (!leftEntity || !rightEntity) return null;

  return (
    <article className="group flex h-full flex-col rounded-lg border border-border bg-card/25 px-4 py-3 transition-colors hover:border-yellow-500/20">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="block truncate text-sm font-semibold text-zinc-300">
            {post.nickname}
          </span>
          <span className="text-xs text-muted-foreground">
            {timeAgo(post.created_at, copy, dateLocale)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThisOrThatLikeButton
            count={likeCount}
            liked={liked}
            loading={likesLoading}
            unavailable={likesUnavailable}
            disabled={!canLike}
            onToggle={() => onToggleLike(post.id)}
            label={copy.like}
            className="px-1.5"
          />
          <Link
            href={href}
            prefetch={false}
            className="text-muted-foreground opacity-80 transition-colors hover:text-yellow-400 sm:opacity-0 sm:group-hover:opacity-100"
            title={copy.share}
          >
            <ExternalLink size={16} />
          </Link>
          {isOwner && (
            <button
              type="button"
              onClick={() => onDelete(post.id)}
              className="text-muted-foreground opacity-80 transition-colors hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100"
              title={copy.delete}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-2">
        <ThisOrThatResourcePanel
          entity={leftEntity}
          sideLabel={copy.leftLabel}
          serviceLocale={serviceLocale}
          gameLocale={gameLocale}
        />
        <div className="flex w-8 items-center justify-center font-game-title text-lg font-black text-yellow-500/80">
          VS
        </div>
        <ThisOrThatResourcePanel
          entity={rightEntity}
          sideLabel={copy.rightLabel}
          serviceLocale={serviceLocale}
          gameLocale={gameLocale}
        />
      </div>

      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-300">
        {post.reason}
      </p>
    </article>
  );
}

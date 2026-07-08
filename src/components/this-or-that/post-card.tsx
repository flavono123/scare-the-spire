"use client";

import { useCallback, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Link2, Trash2 } from "lucide-react";
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
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const dateLocale = serviceLocale === "ko" ? "ko-KR" : "en-US";
  const href = localizeHrefWithGameLocale(`/this-or-that/${post.id}`, serviceLocale, gameLocale);
  const openPost = useCallback(() => {
    router.push(href);
  }, [href, router]);
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openPost();
  }, [openPost]);
  const stopClick = useCallback((event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
  }, []);
  const handleCopy = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const url = new URL(href, window.location.origin).toString();
    void navigator.clipboard?.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }, [href]);

  if (!leftEntity || !rightEntity) return null;

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={openPost}
      onKeyDown={handleKeyDown}
      className="group flex h-full cursor-pointer flex-col rounded-lg border border-border bg-card/25 px-4 py-4 transition-colors hover:border-yellow-500/25 focus-visible:outline focus-visible:outline-1 focus-visible:outline-yellow-400/70"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 font-game-title text-xl font-semibold leading-snug spire-gold">
            {post.reason}
          </h2>
          <span className="mt-1 block text-xs text-muted-foreground">
            {timeAgo(post.created_at, copy, dateLocale)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2" onClick={stopClick}>
          <span onClick={stopClick}>
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
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="text-muted-foreground opacity-80 transition-colors hover:text-yellow-400 sm:opacity-0 sm:group-hover:opacity-100"
            title={copied ? copy.copied : copy.copyLink}
          >
            {copied ? <Check size={16} /> : <Link2 size={16} />}
          </button>
          {isOwner && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(post.id);
              }}
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
          assetOnly
        />
        <div className="flex w-8 items-center justify-center font-game-title text-lg font-black text-yellow-500/80">
          VS
        </div>
        <ThisOrThatResourcePanel
          entity={rightEntity}
          sideLabel={copy.rightLabel}
          serviceLocale={serviceLocale}
          gameLocale={gameLocale}
          assetOnly
        />
      </div>

      <div className="mt-auto flex justify-end pt-3">
        <span className="max-w-[70%] truncate rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-muted-foreground">
          {post.nickname}
        </span>
      </div>
    </article>
  );
}

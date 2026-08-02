"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Check, Link2, MessageCircle, Trash2 } from "lucide-react";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { localizeHrefWithGameLocale } from "@/lib/i18n";
import type { ThisOrThatResolvedPost } from "@/lib/this-or-that";
import { serviceMessages } from "@/messages/service";
import { ThisOrThatLikeButton } from "@/components/this-or-that/like-button";
import { ThisOrThatResourcePanel } from "@/components/this-or-that/resource-panel";
import {
  ThisOrThatVoteChoiceFrame,
  ThisOrThatVoteStatus,
} from "@/components/this-or-that/vote-display";
import {
  EMPTY_THIS_OR_THAT_VOTE_SUMMARY,
  type ThisOrThatVoteChoice,
  type ThisOrThatVoteSummary,
} from "@/lib/this-or-that-votes";
import { cn } from "@/lib/utils";

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
  commentCount,
  canLike,
  canVote,
  voteSummary,
  voteChoice,
  votePending,
  voteLoading,
  voteUnavailable,
  votePrompt,
  voteDone,
  onDelete,
  onToggleLike,
  onVote,
  onRetryVote,
}: {
  resolvedPost: ThisOrThatResolvedPost;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  isOwner: boolean;
  likeCount: number;
  liked: boolean;
  likesLoading: boolean;
  likesUnavailable: boolean;
  commentCount: number;
  canLike: boolean;
  canVote: boolean;
  voteSummary?: ThisOrThatVoteSummary;
  voteChoice?: ThisOrThatVoteChoice;
  votePending: boolean;
  voteLoading: boolean;
  voteUnavailable: boolean;
  votePrompt: string;
  voteDone: string;
  onDelete: (postId: string) => void;
  onToggleLike: (postId: string) => void;
  onVote: (choice: ThisOrThatVoteChoice) => void;
  onRetryVote: () => void;
}) {
  const { post, leftEntity, rightEntity } = resolvedPost;
  const copy = serviceMessages[serviceLocale].thisOrThat;
  const [copied, setCopied] = useState(false);
  const dateLocale = serviceLocale === "ko" ? "ko-KR" : "en-US";
  const href = localizeHrefWithGameLocale(`/this-or-that/${post.id}`, serviceLocale, gameLocale);
  const handleCopy = useCallback(() => {
    const url = new URL(href, window.location.origin).toString();
    void navigator.clipboard?.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }, [href]);

  if (!leftEntity || !rightEntity) return null;

  return (
    <article
      className="group flex h-full flex-col rounded-lg border border-border bg-card/25 px-4 py-4 transition-colors hover:border-yellow-500/25"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2>
            <Link
              href={href}
              className="line-clamp-2 font-game-title text-base font-semibold leading-snug spire-gold focus-visible:outline focus-visible:outline-1 focus-visible:outline-yellow-400/70"
            >
              {post.reason}
            </Link>
          </h2>
          <span className="mt-1 block text-xs text-muted-foreground">
            {timeAgo(post.created_at, copy, dateLocale)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-yellow-400"
            title={copy.commentsTitle}
          >
            <MessageCircle size={15} />
            <span className="tabular-nums">{commentCount}</span>
          </Link>
          <span>
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
              onClick={() => {
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
        <div className="relative min-w-0 rounded-md focus-within:outline focus-within:outline-2 focus-within:outline-cyan-300/80">
          <button
            type="button"
            onClick={() => onVote("left")}
            disabled={!canVote || votePending || Boolean(voteChoice)}
            aria-label={copy.choose.replace("{name}", leftEntity.nameKo).replace("{side}", copy.leftLabel)}
            aria-pressed={voteChoice === "left"}
            className="absolute inset-0 z-10 rounded-md disabled:cursor-not-allowed"
          />
          <div className={cn("pointer-events-none transition-[filter,opacity]", voteChoice === "right" && "opacity-50 grayscale")}>
            <ThisOrThatResourcePanel
              entity={leftEntity}
              sideLabel={copy.leftLabel}
              serviceLocale={serviceLocale}
              gameLocale={gameLocale}
              assetOnly
            />
          </div>
          <div className="pointer-events-none mt-1">
            <ThisOrThatVoteChoiceFrame side="left" label={copy.leftLabel} choice={voteChoice} />
          </div>
        </div>
        <div className="flex w-8 items-center justify-center font-game-title text-lg font-black text-yellow-500/80">
          VS
        </div>
        <div className="relative min-w-0 rounded-md focus-within:outline focus-within:outline-2 focus-within:outline-pink-300/80">
          <button
            type="button"
            onClick={() => onVote("right")}
            disabled={!canVote || votePending || Boolean(voteChoice)}
            aria-label={copy.choose.replace("{name}", rightEntity.nameKo).replace("{side}", copy.rightLabel)}
            aria-pressed={voteChoice === "right"}
            className="absolute inset-0 z-10 rounded-md disabled:cursor-not-allowed"
          />
          <div className={cn("pointer-events-none transition-[filter,opacity]", voteChoice === "left" && "opacity-50 grayscale")}>
            <ThisOrThatResourcePanel
              entity={rightEntity}
              sideLabel={copy.rightLabel}
              serviceLocale={serviceLocale}
              gameLocale={gameLocale}
              assetOnly
            />
          </div>
          <div className="pointer-events-none mt-1">
            <ThisOrThatVoteChoiceFrame side="right" label={copy.rightLabel} choice={voteChoice} />
          </div>
        </div>
      </div>

      <div className="mt-3">
        <ThisOrThatVoteStatus
          summary={voteSummary ?? EMPTY_THIS_OR_THAT_VOTE_SUMMARY}
          choice={voteChoice}
          prompt={votePrompt}
          done={voteDone}
          voteCountTemplate={copy.voteCount}
          voteBreakdownTemplate={copy.voteBreakdown}
          retryLabel={copy.retry}
          loading={voteLoading}
          pending={votePending}
          unavailable={voteUnavailable}
          onRetry={onRetryVote}
        />
      </div>

      <div className="mt-auto flex justify-end pt-2">
        <span className="max-w-[70%] truncate text-[11px] text-muted-foreground/80">
          {post.nickname}
        </span>
      </div>
    </article>
  );
}

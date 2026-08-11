"use client";

import { useCallback, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { localizeHrefWithGameLocale } from "@/lib/i18n";
import type { ThisOrThatResolvedPost } from "@/lib/this-or-that";
import { serviceMessages } from "@/messages/service";
import { GameUiHoverTip } from "@/components/game-ui-hover-tip";
import { OwnPostMark } from "@/components/own-post-mark";
import {
  INDEX_LUCIDE_ICON_CLASS,
  SPIRE_ACTION_CONTROL_CLASS,
} from "@/components/spire-icon";
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
  isOwner = false,
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
  onToggleLike,
  onVote,
  onRetryVote,
}: {
  resolvedPost: ThisOrThatResolvedPost;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  isOwner?: boolean;
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
  onToggleLike: (postId: string) => void;
  onVote: (choice: ThisOrThatVoteChoice) => void;
  onRetryVote: () => void;
}) {
  const { post, leftEntity, rightEntity } = resolvedPost;
  const copy = serviceMessages[serviceLocale].thisOrThat;
  const tips = serviceMessages[serviceLocale].engagementTips;
  const router = useRouter();
  const dateLocale = serviceLocale === "ko" ? "ko-KR" : "en-US";
  const href = localizeHrefWithGameLocale(`/this-or-that/${post.id}`, serviceLocale, gameLocale);
  const commentTip = commentCount > 0
    ? tips.commentCount.replace("{count}", String(commentCount))
    : tips.commentFirst;
  const handleCardClick = useCallback((event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("a, button, [role='button']")) return;
    router.push(href);
  }, [href, router]);

  if (!leftEntity || !rightEntity) return null;

  return (
    <article
      onClick={handleCardClick}
      className="flex h-full cursor-pointer flex-col rounded-lg border border-border bg-card/25 px-4 py-4 transition-colors hover:border-yellow-500/25"
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
          <GameUiHoverTip label={commentTip}>
            <Link
              href={`${href}#comments`}
              className={cn(SPIRE_ACTION_CONTROL_CLASS, "gap-1 text-xs text-muted-foreground")}
              aria-label={commentTip}
              onClick={(event) => event.stopPropagation()}
            >
              <MessageCircle size={15} className={INDEX_LUCIDE_ICON_CLASS} aria-hidden />
              <span className="tabular-nums">{commentCount}</span>
            </Link>
          </GameUiHoverTip>
          <ThisOrThatLikeButton
            count={likeCount}
            liked={liked}
            loading={likesLoading}
            unavailable={likesUnavailable}
            disabled={!canLike}
            onToggle={() => onToggleLike(post.id)}
            label={copy.like}
            tipLabel={tips.like}
            tipLabelActive={tips.unlike}
            lift
            className="px-1.5"
          />
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

      <div className="mt-auto flex items-center justify-end gap-1.5 pt-2">
        {isOwner && <OwnPostMark />}
        <span className="max-w-[70%] truncate text-[11px] text-muted-foreground/80">
          {post.nickname}
        </span>
      </div>
    </article>
  );
}

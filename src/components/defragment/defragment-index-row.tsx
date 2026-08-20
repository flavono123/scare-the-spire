"use client";

import { useCallback, type KeyboardEvent, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { GameUiHoverTip } from "@/components/game-ui-hover-tip";
import { LikeButton } from "@/components/like-button";
import {
  INDEX_LUCIDE_ICON_CLASS,
  SPIRE_ACTION_CONTROL_CLASS,
} from "@/components/spire-icon";
import { ThisOrThatLikeButton } from "@/components/this-or-that/like-button";
import Image from "@/components/ui/static-image";
import { useServiceLocale } from "@/hooks/use-service-locale";
import {
  DEFRAGMENT_FEED_SERVICE_META,
  defragmentItemCommentsHref,
  defragmentItemHref,
  defragmentItemThreadKey,
  type DefragmentFeedItem,
} from "@/lib/defragment";
import type { GameLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { serviceMessages } from "@/messages/service";

export function DefragmentIndexRow({
  item,
  typeLabel,
  gameLocale,
  userId,
  authReady,
  ensureUser,
  totLiked,
  totLikesLoading,
  totLikesUnavailable,
  totLikeCount,
  onToggleTotLike,
}: {
  item: DefragmentFeedItem;
  typeLabel: string;
  gameLocale: GameLocale;
  userId: string | null;
  authReady: boolean;
  ensureUser?: () => Promise<string | null>;
  totLiked?: boolean;
  totLikesLoading?: boolean;
  totLikesUnavailable?: boolean;
  totLikeCount?: number;
  onToggleTotLike?: (postId: string) => void;
}) {
  const serviceLocale = useServiceLocale();
  const tips = serviceMessages[serviceLocale].engagementTips;
  const totCopy = serviceMessages[serviceLocale].thisOrThat;
  const router = useRouter();
  const href = defragmentItemHref(item, serviceLocale, gameLocale);
  const commentsHref = defragmentItemCommentsHref(item, serviceLocale, gameLocale);
  const threadKey = defragmentItemThreadKey(item);
  const tokenSrc = DEFRAGMENT_FEED_SERVICE_META[item.service].tokenSrc;
  const commentTip = item.commentCount > 0
    ? tips.commentCount.replace("{count}", String(item.commentCount))
    : tips.commentFirst;

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
      data-defragment-row
      data-defragment-service={item.service}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="flex cursor-pointer items-center gap-2 border-b border-white/10 px-1 py-1.5 transition-colors hover:bg-[#3d5a80]/25 focus-visible:outline focus-visible:outline-1 focus-visible:outline-yellow-400/70"
    >
      <span className="flex w-28 shrink-0 items-center gap-1.5 sm:w-40">
        <Image
          src={tokenSrc}
          alt=""
          width={16}
          height={16}
          className="size-4 shrink-0 object-contain"
        />
        <span className="truncate text-xs text-muted-foreground">
          {typeLabel}
        </span>
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-[#c8b4e8] hover:underline">
        {item.title}
      </span>
      <span className="inline-flex w-[5.5rem] shrink-0 items-center justify-end gap-1 sm:w-24">
        {item.service === "this_or_that" ? (
          <ThisOrThatLikeButton
            count={totLikeCount ?? item.likeCount}
            liked={Boolean(totLiked)}
            loading={Boolean(totLikesLoading)}
            unavailable={Boolean(totLikesUnavailable)}
            disabled={!authReady}
            onToggle={() => onToggleTotLike?.(item.id)}
            label={totCopy.like}
            tipLabel={tips.like}
            tipLabelActive={tips.unlike}
            lift
            className="px-0.5"
          />
        ) : (
          <LikeButton
            storyId={threadKey}
            userId={userId}
            initialCount={item.likeCount}
            size={15}
            authReady={authReady}
            userStatusLoading="lazy"
            ensureUser={ensureUser}
            tipLabel={tips.like}
            tipLabelActive={tips.unlike}
            lift
            className="px-0.5"
          />
        )}
        <GameUiHoverTip label={commentTip}>
          <Link
            href={commentsHref}
            className={cn(
              SPIRE_ACTION_CONTROL_CLASS,
              "gap-0.5 text-xs text-muted-foreground",
            )}
            aria-label={commentTip}
            onClick={(event) => event.stopPropagation()}
          >
            <MessageCircle size={15} className={INDEX_LUCIDE_ICON_CLASS} aria-hidden />
            <span className="tabular-nums">{item.commentCount}</span>
          </Link>
        </GameUiHoverTip>
      </span>
    </article>
  );
}

"use client";

import { useCallback, type KeyboardEvent, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { GameUiHoverTip } from "@/components/game-ui-hover-tip";
import { LikeButton } from "@/components/like-button";
import { PostCreatedAt } from "@/components/post-created-at";
import { ProfileNickname } from "@/components/profile/profile-nickname";
import {
  INDEX_LUCIDE_ICON_CLASS,
  SPIRE_ACTION_CONTROL_CLASS,
  SpireGhostRevealIcon,
} from "@/components/spire-icon";
import { ThisOrThatLikeButton } from "@/components/this-or-that/like-button";
import { useServiceLocale } from "@/hooks/use-service-locale";
import {
  defragmentItemCommentsHref,
  defragmentItemHref,
  defragmentItemThreadKey,
  defragmentServiceMeta,
  type DefragmentFeedItem,
} from "@/lib/defragment";
import type { GameLocale } from "@/lib/i18n";
import { serviceDateLocale } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import { serviceMessages } from "@/messages/service";

/** Phone-first: long type names like 이거 아님 저거? may truncate. */
export const DEFRAGMENT_TYPE_COL_CLASS =
  "w-5 min-w-0 shrink-0 overflow-hidden sm:w-[4.75rem] md:w-20";
export const DEFRAGMENT_AUTHOR_COL_CLASS =
  "w-[4.25rem] min-w-0 shrink-0 sm:w-[5.75rem]";
export const DEFRAGMENT_DATE_COL_CLASS = "w-[4.5rem] shrink-0 sm:w-[5.5rem]";
export const DEFRAGMENT_COUNT_COL_CLASS = "w-10 shrink-0 sm:w-11";

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
  authorIconUrl = null,
  authorDuotone = null,
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
  /** Reserved for the profile-token session; idle rows stay nickname-only. */
  authorIconUrl?: string | null;
  authorDuotone?: { shadow: string; highlight: string } | null;
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].defragment;
  const tips = serviceMessages[serviceLocale].engagementTips;
  const totCopy = serviceMessages[serviceLocale].thisOrThat;
  const dateLocale = serviceDateLocale(serviceLocale);
  const router = useRouter();
  const href = defragmentItemHref(item, serviceLocale, gameLocale);
  const commentsHref = defragmentItemCommentsHref(item, serviceLocale, gameLocale);
  const threadKey = defragmentItemThreadKey(item);
  const tokenSrc = defragmentServiceMeta(item.service).tokenSrc;
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
      className="group flex cursor-pointer items-center gap-2 border-b border-border px-1 py-1.5 transition-colors hover:bg-muted/50 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary/70"
    >
      <GameUiHoverTip label={typeLabel} className={DEFRAGMENT_TYPE_COL_CLASS}>
        <span className="flex w-full min-w-0 items-center gap-1">
          <SpireGhostRevealIcon src={tokenSrc} size={14} className="shrink-0" />
          <span className="hidden min-w-0 truncate text-[10px] leading-none text-muted-foreground sm:inline">
            {typeLabel}
          </span>
        </span>
      </GameUiHoverTip>
      <span className="min-w-0 flex-1 truncate text-sm font-medium leading-snug text-foreground transition-colors hover:text-primary">
        {item.title}
      </span>
      <span className={cn(DEFRAGMENT_AUTHOR_COL_CLASS, "min-w-0")}>
        <ProfileNickname
          nickname={item.nickname}
          iconUrl={authorIconUrl}
          duotone={authorDuotone}
          size={14}
          className="w-full"
          tokenClassName="h-3.5 w-3.5"
          nicknameClassName="text-[11px] leading-none text-muted-foreground"
        />
      </span>
      <span className={cn(DEFRAGMENT_DATE_COL_CLASS, "min-w-0 truncate text-right")}>
        <PostCreatedAt
          createdAt={item.created_at}
          copy={copy}
          dateLocale={dateLocale}
          primary="absolute"
          className="text-[11px] leading-none text-zinc-500"
        />
      </span>
      <span className={cn(DEFRAGMENT_COUNT_COL_CLASS, "inline-flex justify-end")}>
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
            className="px-0.5 text-[11px]"
          />
        ) : threadKey ? (
          <LikeButton
            storyId={threadKey}
            userId={userId}
            initialCount={item.likeCount}
            size={14}
            authReady={authReady}
            userStatusLoading="lazy"
            ensureUser={ensureUser}
            tipLabel={tips.like}
            tipLabelActive={tips.unlike}
            lift
            className="px-0.5 text-[11px]"
          />
        ) : null}
      </span>
      <span className={cn(DEFRAGMENT_COUNT_COL_CLASS, "inline-flex justify-end")}>
        <GameUiHoverTip label={commentTip}>
          <Link
            href={commentsHref}
            prefetch={false}
            className={cn(
              SPIRE_ACTION_CONTROL_CLASS,
              "gap-0.5 text-[11px] text-muted-foreground",
            )}
            aria-label={commentTip}
            onClick={(event) => event.stopPropagation()}
          >
            <MessageCircle size={14} className={INDEX_LUCIDE_ICON_CLASS} aria-hidden />
            <span className="tabular-nums">{item.commentCount}</span>
          </Link>
        </GameUiHoverTip>
      </span>
    </article>
  );
}

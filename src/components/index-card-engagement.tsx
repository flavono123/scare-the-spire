"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { GameUiHoverTip } from "@/components/game-ui-hover-tip";
import { LikeButton } from "@/components/like-button";
import {
  INDEX_LUCIDE_ICON_CLASS,
  SPIRE_ACTION_CONTROL_CLASS,
} from "@/components/spire-icon";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";
import { cn } from "@/lib/utils";

/** Comment count → detail #comments. Like toggles on the shared likes table. */
export function IndexCardEngagement({
  commentsHref,
  commentCount,
  likeStoryId,
  likeCount,
  userId,
  authReady = true,
  ensureUser,
  className,
}: {
  commentsHref: string;
  commentCount: number;
  likeStoryId: string;
  likeCount: number;
  userId: string | null;
  authReady?: boolean;
  ensureUser?: () => Promise<string | null>;
  className?: string;
}) {
  const serviceLocale = useServiceLocale();
  const tips = serviceMessages[serviceLocale].engagementTips;
  const commentTip = commentCount > 0
    ? tips.commentCount.replace("{count}", String(commentCount))
    : tips.commentFirst;

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
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
          <span className="tabular-nums">{commentCount}</span>
        </Link>
      </GameUiHoverTip>
      <LikeButton
        storyId={likeStoryId}
        userId={userId}
        initialCount={likeCount}
        size={15}
        authReady={authReady}
        userStatusLoading="lazy"
        ensureUser={ensureUser}
        tipLabel={tips.like}
        tipLabelActive={tips.unlike}
        lift
        className="px-0.5"
      />
    </span>
  );
}

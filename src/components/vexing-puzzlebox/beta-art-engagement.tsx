"use client";

import { MessageCircle } from "lucide-react";
import { CommentSection } from "@/components/comment-section";
import { GameUiHoverTip } from "@/components/game-ui-hover-tip";
import { LikeButton } from "@/components/like-button";
import { INDEX_LUCIDE_ICON_CLASS, SPIRE_ACTION_CONTROL_CLASS } from "@/components/spire-icon";
import { buildBetaArtCommentThreadKey } from "@/lib/comment-threads";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { serviceMessages } from "@/messages/service";

export type BetaArtAuth = {
  userId: string | null;
  ready: boolean;
  ensureUser: () => Promise<string | null>;
};

/**
 * Likes and the comment count for one beta art. The thread is the art's own
 * (`beta-art:card:CASCADE`), so a later merge into the Compendium element's thread can
 * map it by key.
 */
export function BetaArtReactions({
  artKey,
  likeCount,
  commentCount,
  auth,
  commentsOpen,
  onComments,
  serviceLocale,
  size = 15,
  className,
}: {
  artKey: string;
  likeCount: number;
  commentCount: number;
  auth: BetaArtAuth;
  commentsOpen?: boolean;
  onComments: () => void;
  serviceLocale: ServiceLocale;
  size?: number;
  className?: string;
}) {
  const tips = serviceMessages[serviceLocale].engagementTips;
  const commentTip = commentCount > 0
    ? tips.commentCount.replace("{count}", String(commentCount))
    : tips.commentFirst;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} data-beta-art-reactions={artKey}>
      <GameUiHoverTip label={commentTip}>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onComments();
          }}
          aria-label={commentTip}
          aria-expanded={commentsOpen}
          className={cn(SPIRE_ACTION_CONTROL_CLASS, "gap-0.5 text-xs", commentsOpen ? "text-foreground" : "text-muted-foreground")}
        >
          <MessageCircle size={size} className={INDEX_LUCIDE_ICON_CLASS} aria-hidden />
          <span className="tabular-nums">{commentCount}</span>
        </button>
      </GameUiHoverTip>
      <LikeButton
        storyId={buildBetaArtCommentThreadKey(artKey)}
        userId={auth.userId}
        initialCount={likeCount}
        size={size}
        authReady={auth.ready}
        userStatusLoading="lazy"
        ensureUser={auth.ensureUser}
        tipLabel={tips.like}
        tipLabelActive={tips.unlike}
        lift
        className="px-0.5"
      />
    </span>
  );
}

/** The art's comment thread, opened under the stage without leaving the page. */
export function BetaArtComments({
  artKey,
  title,
  gameLocale,
  onCountChange,
}: {
  artKey: string;
  title: string;
  gameLocale: GameLocale;
  onCountChange: (count: number) => void;
}) {
  return (
    <section id="comments" className="mx-auto mt-5 max-w-2xl space-y-3" data-beta-art-comments={artKey}>
      <h2 className="font-game-title text-sm font-semibold">{title}</h2>
      <CommentSection
        key={artKey}
        threadKey={buildBetaArtCommentThreadKey(artKey)}
        entitiesGameLocale={gameLocale === "kor" ? undefined : gameLocale}
        onCountChange={onCountChange}
      />
    </section>
  );
}

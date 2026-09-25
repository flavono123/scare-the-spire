"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { GameUiHoverTip } from "@/components/game-ui-hover-tip";
import { ColorfulPhilosopherReactionIcon } from "@/components/colorful-philosophers/reaction-icon";
import { INDEX_LUCIDE_ICON_CLASS, SPIRE_ACTION_CONTROL_CLASS } from "@/components/spire-icon";
import { useAuth } from "@/hooks/use-auth";
import { useResourceReactions } from "@/hooks/use-resource-reactions";
import { useServiceLocale } from "@/hooks/use-service-locale";
import {
  COLORFUL_PHILOSOPHER_REACTIONS,
  type ColorfulPhilosopherPost,
  type ColorfulPhilosopherReaction,
} from "@/lib/colorful-philosophers";
import { serviceMessages } from "@/messages/service";
import { cn } from "@/lib/utils";

export function ColorfulPhilosopherIndexEngagement({
  post,
  commentsHref,
  commentCount,
}: {
  post: ColorfulPhilosopherPost;
  commentsHref: string;
  commentCount: number;
}) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].colorfulPhilosophers;
  const tips = serviceMessages[serviceLocale].engagementTips;
  const { userId, ensureUser } = useAuth();
  const resource = useResourceReactions(post.resourceType, post.resourceId, post.gameVersion, userId);

  const commentTip = commentCount > 0
    ? tips.commentCount.replace("{count}", String(commentCount))
    : tips.commentFirst;

  const choose = (next: ColorfulPhilosopherReaction) => {
    void (async () => {
      const activeUserId = userId ?? await ensureUser();
      if (!activeUserId) return;
      await resource.choose(next, activeUserId);
    })();
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <GameUiHoverTip label={commentTip}>
        <Link
          href={commentsHref}
          className={cn(SPIRE_ACTION_CONTROL_CLASS, "gap-0.5 text-xs text-muted-foreground")}
          aria-label={commentTip}
          onClick={(event) => event.stopPropagation()}
        >
          <MessageCircle size={15} className={INDEX_LUCIDE_ICON_CLASS} aria-hidden />
          <span className="tabular-nums">{commentCount}</span>
        </Link>
      </GameUiHoverTip>
      {COLORFUL_PHILOSOPHER_REACTIONS.map((reaction) => {
        const active = resource.kind === reaction;
        const tip = active ? copy.reactionClear[reaction] : copy.reactions[reaction];
        return (
          <GameUiHoverTip key={reaction} label={tip}>
            <button
              type="button"
              aria-pressed={active}
              aria-label={tip}
              onClick={(event) => {
                event.stopPropagation();
                choose(reaction);
              }}
              className={cn(SPIRE_ACTION_CONTROL_CLASS, "gap-0.5 px-0.5 text-xs text-muted-foreground")}
            >
              <ColorfulPhilosopherReactionIcon kind={reaction} active={active} lift size={15} />
              <span className={cn(
                "tabular-nums",
                active && reaction === "buff" && "text-[#34d399]",
                active && reaction === "nerf" && "text-[#f87171]",
                active && reaction === "rework" && "text-[#f472b6]",
              )}
              >
                {resource.counts[reaction]}
              </span>
            </button>
          </GameUiHoverTip>
        );
      })}
    </span>
  );
}

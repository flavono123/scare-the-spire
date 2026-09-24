"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { GameUiHoverTip } from "@/components/game-ui-hover-tip";
import { ColorfulPhilosopherReactionIcon } from "@/components/colorful-philosophers/reaction-icon";
import { INDEX_LUCIDE_ICON_CLASS, SPIRE_ACTION_CONTROL_CLASS } from "@/components/spire-icon";
import { useAuth } from "@/hooks/use-auth";
import {
  readColorfulPhilosopherReaction,
  saveColorfulPhilosopherReaction,
} from "@/hooks/use-colorful-philosopher-posts";
import { useServiceLocale } from "@/hooks/use-service-locale";
import {
  COLORFUL_PHILOSOPHER_REACTIONS,
  type ColorfulPhilosopherPost,
  type ColorfulPhilosopherReaction,
} from "@/lib/colorful-philosophers";
import { serviceMessages } from "@/messages/service";
import { cn } from "@/lib/utils";

function countsFromPost(post: ColorfulPhilosopherPost) {
  return { buff: post.buffCount, nerf: post.nerfCount, rework: post.reworkCount };
}

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
  const [kind, setKind] = useState<ColorfulPhilosopherReaction | null>(null);
  const [counts, setCounts] = useState(() => countsFromPost(post));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read this browser's reaction after paint
    setKind(readColorfulPhilosopherReaction(post.id));
  }, [post.id]);

  const commentTip = commentCount > 0
    ? tips.commentCount.replace("{count}", String(commentCount))
    : tips.commentFirst;

  const choose = (next: ColorfulPhilosopherReaction) => {
    const previous = kind;
    const nextKind = previous === next ? null : next;
    setKind(nextKind);
    setCounts((current) => {
      const updated = { ...current };
      if (previous) updated[previous] = Math.max(0, updated[previous] - 1);
      if (nextKind) updated[nextKind] += 1;
      return updated;
    });
    void (async () => {
      const activeUserId = userId ?? await ensureUser();
      if (!activeUserId) {
        setKind(previous);
        setCounts(countsFromPost(post));
        return;
      }
      const result = await saveColorfulPhilosopherReaction({
        postId: post.id,
        userId: activeUserId,
        previous,
        next,
      });
      if (!result.ok) {
        setKind(previous);
        setCounts(countsFromPost(post));
      }
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
        const active = kind === reaction;
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
              <span className="tabular-nums">{counts[reaction]}</span>
            </button>
          </GameUiHoverTip>
        );
      })}
    </span>
  );
}

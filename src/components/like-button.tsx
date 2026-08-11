"use client";

import { useState, type MouseEvent } from "react";
import { GameUiHoverTip } from "@/components/game-ui-hover-tip";
import { SPIRE_ACTION_CONTROL_CLASS, SpireLikeIcon } from "@/components/spire-icon";
import { EngagementSpinner, EngagementUnavailableIcon } from "@/components/engagement-spinner";
import { useLikes } from "@/hooks/use-likes";
import { cn } from "@/lib/utils";

export function LikeButton({
  storyId,
  userId,
  initialCount,
  size = 20,
  authReady = true,
  userStatusLoading = "eager",
  ensureUser,
  tipLabel,
  tipLabelActive,
  lift = false,
  className = "",
}: {
  storyId: string;
  userId: string | null;
  initialCount?: number;
  size?: number;
  authReady?: boolean;
  userStatusLoading?: "eager" | "lazy";
  ensureUser?: () => Promise<string | null>;
  tipLabel?: string;
  tipLabelActive?: string;
  lift?: boolean;
  className?: string;
}) {
  const { count, liked, loading, unavailable, toggle } = useLikes(storyId, userId, {
    initialCount,
    userStatusLoading,
  });
  const [authPending, setAuthPending] = useState(false);
  const pending = !authReady || loading || authPending;
  const blocked = unavailable;

  const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (pending || blocked) return;
    setAuthPending(true);
    try {
      let activeUserId = userId;
      if (!activeUserId && ensureUser) {
        activeUserId = await ensureUser();
      }
      if (!activeUserId) return;
      await toggle(activeUserId);
    } finally {
      setAuthPending(false);
    }
  };

  const button = (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending || blocked || (!userId && !ensureUser)}
      className={cn(
        SPIRE_ACTION_CONTROL_CLASS,
        "gap-1 text-xs text-muted-foreground disabled:opacity-40",
        liked && "text-[#d4a843]",
        className,
      )}
      aria-label={liked ? tipLabelActive ?? tipLabel : tipLabel}
      aria-pressed={liked}
    >
      {blocked ? (
        <EngagementUnavailableIcon size={size} />
      ) : pending ? (
        <EngagementSpinner size={size} />
      ) : (
        <>
          <SpireLikeIcon size={size} active={liked} lift={lift} />
          <span className="tabular-nums">{count}</span>
        </>
      )}
    </button>
  );

  if (!tipLabel || blocked || pending) return button;

  return (
    <GameUiHoverTip label={liked && tipLabelActive ? tipLabelActive : tipLabel}>
      {button}
    </GameUiHoverTip>
  );
}

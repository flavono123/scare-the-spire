"use client";

import { useState, type MouseEvent } from "react";
import { LikeControl } from "@/components/like-control";
import { useLikes } from "@/hooks/use-likes";

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

  const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (pending || unavailable) return;
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

  return (
    <LikeControl
      count={count}
      liked={liked}
      pending={pending}
      blocked={unavailable}
      disabled={!userId && !ensureUser}
      onToggle={handleClick}
      tipLabel={tipLabel}
      tipLabelActive={tipLabelActive}
      lift={lift}
      size={size}
      className={className}
    />
  );
}

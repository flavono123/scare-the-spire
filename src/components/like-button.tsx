"use client";

import { useState } from "react";
import Image from "@/components/ui/static-image";
import { useLikes } from "@/hooks/use-likes";
import { EngagementSpinner, EngagementUnavailableIcon } from "@/components/engagement-spinner";

export function LikeButton({
  storyId,
  userId,
  initialCount,
  size = 20,
  authReady = true,
  userStatusLoading = "eager",
  ensureUser,
  className = "",
}: {
  storyId: string;
  userId: string | null;
  initialCount?: number;
  size?: number;
  authReady?: boolean;
  userStatusLoading?: "eager" | "lazy";
  ensureUser?: () => Promise<string | null>;
  className?: string;
}) {
  const { count, liked, loading, unavailable, toggle } = useLikes(storyId, userId, {
    initialCount,
    userStatusLoading,
  });
  const [authPending, setAuthPending] = useState(false);
  const pending = !authReady || loading || authPending;
  const blocked = unavailable;

  const handleClick = async () => {
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

  return (
    <button
      onClick={handleClick}
      disabled={pending || blocked || (!userId && !ensureUser)}
      className={`flex items-center gap-1 text-xs text-muted-foreground transition-all ${className}`}
    >
      {blocked ? (
        <EngagementUnavailableIcon size={size} />
      ) : pending ? (
        <EngagementSpinner size={size} />
      ) : (
        <>
          <Image
            src="/images/relics/runic-dodecahedron.webp"
            alt="like"
            width={size}
            height={size}
            className={`transition-all ${liked ? "" : "opacity-40 grayscale"}`}
          />
          <span>{count}</span>
        </>
      )}
    </button>
  );
}

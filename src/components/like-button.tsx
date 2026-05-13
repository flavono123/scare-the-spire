"use client";

import Image from "@/components/ui/static-image";
import { useLikes } from "@/hooks/use-likes";
import { EngagementSpinner, EngagementUnavailableIcon } from "@/components/engagement-spinner";

export function LikeButton({
  storyId,
  userId,
  initialCount,
  size = 20,
  authReady = true,
  authUnavailable = false,
  className = "",
}: {
  storyId: string;
  userId: string | null;
  initialCount?: number;
  size?: number;
  authReady?: boolean;
  authUnavailable?: boolean;
  className?: string;
}) {
  const { count, liked, loading, unavailable, toggle } = useLikes(storyId, userId, { initialCount });
  const pending = !authReady || loading;
  const blocked = authUnavailable || unavailable;

  return (
    <button
      onClick={toggle}
      disabled={!userId || pending || blocked}
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

"use client";

import Image from "@/components/ui/static-image";
import { useLikes } from "@/hooks/use-likes";
import { EngagementSpinner, EngagementUnavailableIcon } from "@/components/engagement-spinner";

export function LikeButton({ storyId, userId }: { storyId: string; userId: string | null }) {
  const { count, liked, loading, unavailable, toggle } = useLikes(storyId, userId);

  return (
    <button
      onClick={toggle}
      disabled={!userId || loading || unavailable}
      className="flex items-center gap-1 text-xs text-muted-foreground transition-all"
    >
      {unavailable ? (
        <EngagementUnavailableIcon size={20} />
      ) : loading ? (
        <EngagementSpinner size={20} />
      ) : (
        <>
          <Image
            src="/images/relics/runic-dodecahedron.webp"
            alt="like"
            width={20}
            height={20}
            className={`transition-all ${liked ? "" : "opacity-40 grayscale"}`}
          />
          <span>{count}</span>
        </>
      )}
    </button>
  );
}

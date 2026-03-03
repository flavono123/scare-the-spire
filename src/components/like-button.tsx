"use client";

import Image from "next/image";
import { useLikes } from "@/hooks/use-likes";

export function LikeButton({ storyId, userId }: { storyId: string; userId: string | null }) {
  const { count, liked, toggle } = useLikes(storyId, userId);

  return (
    <button
      onClick={toggle}
      disabled={!userId}
      className="flex items-center gap-1 text-xs text-muted-foreground transition-all"
    >
      <Image
        src="/images/relics/runic-dodecahedron.webp"
        alt="like"
        width={20}
        height={20}
        className={`transition-all ${liked ? "" : "opacity-40 grayscale"}`}
      />
      <span>{count}</span>
    </button>
  );
}

"use client";

import Image from "@/components/ui/static-image";
import { sts1PotionImageUrl } from "@/lib/sts1/paths";
import type { Sts1Potion } from "@/lib/sts1/types";

export function Sts1PotionTile({ potion }: { potion: Sts1Potion }) {
  return (
    <article className="flex flex-col items-center gap-1 p-1">
      <Image
        src={sts1PotionImageUrl(potion)}
        alt={potion.name}
        width={48}
        height={64}
        className="h-16 w-12 object-contain"
      />
      <span className="line-clamp-2 text-center font-game-text text-xs">{potion.name}</span>
    </article>
  );
}

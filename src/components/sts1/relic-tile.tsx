"use client";

import Image from "@/components/ui/static-image";
import { sts1RelicImageUrl } from "@/lib/sts1/paths";
import type { Sts1Relic } from "@/lib/sts1/types";

export function Sts1RelicTile({ relic }: { relic: Sts1Relic }) {
  return (
    <article className="flex flex-col items-center gap-1 p-1">
      <Image
        src={sts1RelicImageUrl(relic)}
        alt={relic.name}
        width={64}
        height={64}
        className="h-16 w-16 object-contain"
      />
      <span className="line-clamp-2 text-center font-game-text text-xs">{relic.name}</span>
    </article>
  );
}

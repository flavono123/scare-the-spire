"use client";

import Image from "@/components/ui/static-image";
import { sts1PoolOutline } from "@/lib/sts1/card-style";
import { sts1PotionImageUrl } from "@/lib/sts1/paths";
import type { Sts1Potion } from "@/lib/sts1/types";

export function Sts1PotionTile({ potion }: { potion: Sts1Potion }) {
  return (
    <article className="relative block">
      <div className="flex h-14 w-14 items-center justify-center rounded-lg border-2 border-transparent bg-white/5 p-1 transition-all sm:h-16 sm:w-16 group-hover:z-10 group-hover:scale-110 group-hover:border-primary/60 group-hover:bg-primary/10">
        <Image
          src={sts1PotionImageUrl(potion)}
          alt={potion.name}
          width={48}
          height={48}
          className="h-10 w-10 object-contain sm:h-12 sm:w-12"
          style={{
            imageRendering: "pixelated",
            filter: sts1PoolOutline(potion.pool),
          }}
        />
      </div>
    </article>
  );
}

"use client";

import Image from "@/components/ui/static-image";
import { sts1PoolOutline } from "@/lib/sts1/card-style";
import { sts1RelicImageUrl } from "@/lib/sts1/paths";
import type { Sts1Relic } from "@/lib/sts1/types";

export function Sts1RelicTile({ relic }: { relic: Sts1Relic }) {
  return (
    <article className="relative block">
      <div className="h-14 w-14 rounded-lg border-2 border-transparent bg-white/5 p-1 transition-all sm:h-16 sm:w-16 group-hover:z-10 group-hover:scale-110 group-hover:border-primary/60 group-hover:bg-primary/10">
        <Image
          src={sts1RelicImageUrl(relic)}
          alt={relic.name}
          width={56}
          height={56}
          className="h-full w-full object-contain"
          style={{ filter: sts1PoolOutline(relic.pool) }}
        />
      </div>
    </article>
  );
}

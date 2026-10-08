"use client";

import Image from "@/components/ui/static-image";
import { sts1PowerImageUrl } from "@/lib/sts1/paths";
import type { Sts1Power } from "@/lib/sts1/types";

export function Sts1PowerTile({ power }: { power: Sts1Power }) {
  return (
    <article className="relative flex w-20 flex-col items-center gap-1 sm:w-24">
      <div className="flex h-14 w-14 items-center justify-center rounded-lg border-2 border-transparent bg-white/5 p-1 transition-all sm:h-16 sm:w-16 group-hover:z-10 group-hover:scale-110 group-hover:border-primary/60 group-hover:bg-primary/10">
        <Image
          src={sts1PowerImageUrl(power)}
          alt={power.name}
          width={64}
          height={64}
          className="h-full w-full object-contain"
        />
      </div>
      <span className="line-clamp-2 text-center font-game-text text-xs leading-tight text-gray-300 group-hover:text-primary">
        {power.name}
      </span>
    </article>
  );
}

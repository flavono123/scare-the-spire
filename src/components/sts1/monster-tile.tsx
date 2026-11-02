"use client";

import Image from "@/components/ui/static-image";
import { STS1_MONSTER_TYPE_COLORS } from "@/lib/sts1/card-style";
import { sts1MonsterImageUrl } from "@/lib/sts1/paths";
import type { Sts1Monster } from "@/lib/sts1/types";

export function Sts1MonsterTile({ monster }: { monster: Sts1Monster }) {
  return (
    <div className="flex h-full flex-col items-center gap-2 rounded-lg border border-border bg-compendium-rail p-3 transition-colors group-hover:border-primary/60 group-hover:bg-white/[0.04]">
      <div className="flex h-28 w-full items-center justify-center">
        <Image
          src={sts1MonsterImageUrl(monster)}
          alt={monster.name}
          width={144}
          height={112}
          loading="lazy"
          className="max-h-full max-w-full object-contain"
          style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.5))" }}
        />
      </div>
      <span
        className="text-center font-game-text text-sm font-bold"
        style={{ color: STS1_MONSTER_TYPE_COLORS[monster.type] }}
      >
        {monster.name}
      </span>
    </div>
  );
}

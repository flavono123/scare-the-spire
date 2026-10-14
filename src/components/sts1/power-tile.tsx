"use client";

import { useMemo } from "react";
import { CardSideTipsAnchor } from "@/components/codex/card-keyword-tip-stack";
import Image from "@/components/ui/static-image";
import type { CardSideTip } from "@/lib/card-keyword-tips";
import { sts1KeywordTipBody } from "@/lib/sts1/keyword-tips";
import { sts1PowerImageUrl } from "@/lib/sts1/paths";
import type { Sts1Power } from "@/lib/sts1/types";

const TYPE_HOVER: Record<Sts1Power["type"], string> = {
  buff: "group-hover:border-green-500/60 group-hover:bg-green-500/10",
  debuff: "group-hover:border-red-500/60 group-hover:bg-red-500/10",
};

/** Index tile: icon only, name + description in the in-game style hover tip. */
export function Sts1PowerTile({ power }: { power: Sts1Power }) {
  const tips = useMemo<CardSideTip[]>(() => [{
    kind: "keyword",
    id: power.id,
    title: power.name,
    description: sts1KeywordTipBody(power.description),
    iconUrl: sts1PowerImageUrl(power),
    variant: power.type,
    source: "power",
  }], [power]);

  return (
    <CardSideTipsAnchor mode="hover" preferSide="right" tips={tips} className="relative">
      <div
        className={`h-14 w-14 rounded-full border-2 border-transparent bg-white/5 p-1 transition-all sm:h-16 sm:w-16 group-hover:z-10 group-hover:scale-110 ${TYPE_HOVER[power.type]}`}
      >
        <Image
          src={sts1PowerImageUrl(power)}
          alt={power.name}
          width={64}
          height={64}
          className="h-full w-full object-contain drop-shadow-md"
        />
      </div>
    </CardSideTipsAnchor>
  );
}

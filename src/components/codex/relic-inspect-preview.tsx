"use client";

import type { ReactNode } from "react";
import Image from "@/components/ui/static-image";
import { DescriptionText } from "@/components/codex/codex-description";
import { RelicInspectSlab } from "@/components/codex/relic-inspect-slab";
import {
  characterOutlineFilter,
  RELIC_RARITY_LABELS,
  type CodexRelic,
} from "@/lib/codex-types";
import { cn } from "@/lib/utils";

export function RelicInspectPreview({
  relic,
  title,
  rarityLabel,
  density = "detail",
  className,
  titleAs = "div",
}: {
  relic: Pick<
    CodexRelic,
    "name" | "description" | "flavor" | "rarity" | "pool" | "imageUrl" | "deprecated"
  >;
  title?: ReactNode;
  rarityLabel?: string;
  density?: "detail" | "hover";
  className?: string;
  titleAs?: "h1" | "div";
}) {
  const displayTitle = title ?? relic.name;
  const artAlt = typeof displayTitle === "string" ? displayTitle : relic.name;
  const outline = characterOutlineFilter(relic.pool)
    ?? "drop-shadow(0 2px 4px rgba(0,0,0,0.3))";
  const artSize = density === "hover" ? 120 : 160;

  return (
    <RelicInspectSlab
      rarity={relic.rarity}
      rarityLabel={rarityLabel ?? RELIC_RARITY_LABELS[relic.rarity]}
      title={displayTitle}
      titleAs={titleAs}
      density={density}
      className={cn(
        density === "hover" && "w-[14rem] max-w-[min(14rem,calc(100vw-2rem))]",
        className,
      )}
      art={relic.imageUrl ? (
        <Image
          src={relic.imageUrl}
          alt={artAlt}
          width={artSize}
          height={artSize}
          className={cn(
            "relative z-[1] h-[62%] w-[62%] object-contain",
            relic.deprecated && "opacity-50 grayscale saturate-0",
          )}
          style={{ filter: outline }}
        />
      ) : (
        <div className="relative z-[1] flex h-[62%] w-[62%] items-center justify-center text-2xl text-gray-600">
          ?
        </div>
      )}
      description={<DescriptionText description={relic.description} className="block" />}
      flavor={relic.flavor ? <DescriptionText description={relic.flavor} /> : undefined}
    />
  );
}

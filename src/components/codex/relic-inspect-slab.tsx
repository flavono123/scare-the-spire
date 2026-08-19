"use client";

import type { ReactNode } from "react";
import Image from "@/components/ui/static-image";
import {
  RELIC_RARITY_COLORS,
  type RelicRarityKo,
} from "@/lib/codex-types";
import {
  RELIC_INSPECT_REWARD_PANEL,
  relicInspectFrameUrl,
} from "@/lib/relic-inspect-assets";
import { cn } from "@/lib/utils";

export function RelicInspectSlab({
  rarity,
  rarityLabel,
  title,
  art,
  description,
  flavor,
  className,
  titleAs: TitleTag = "h1",
}: {
  rarity: RelicRarityKo;
  rarityLabel: string;
  title: ReactNode;
  art: ReactNode;
  description: ReactNode;
  flavor?: ReactNode;
  className?: string;
  titleAs?: "h1" | "div";
}) {
  const rarityColor = RELIC_RARITY_COLORS[rarity];
  const inspectFrameUrl = relicInspectFrameUrl(rarity);

  return (
    <div
      data-relic-inspect-slab
      className={cn(
        "relative mx-auto w-full max-w-[28rem] aspect-square",
        className,
      )}
    >
      <Image
        src={RELIC_INSPECT_REWARD_PANEL}
        alt=""
        width={1128}
        height={1435}
        className="pointer-events-none absolute inset-0 h-full w-full object-fill"
        aria-hidden
      />

      <div className="relative z-10 flex h-full flex-col items-center px-[11%] pb-[9%] pt-[8%]">
        <TitleTag
          className="max-w-[90%] text-center font-game-title text-xl font-bold leading-tight sm:text-2xl"
          style={{ color: "#efc851", textShadow: "3px 3px 0 rgba(0,0,0,0.35)" }}
        >
          {title}
        </TitleTag>
        <p
          className="mt-1 font-game-text text-sm font-bold sm:text-base"
          style={{ color: rarityColor }}
        >
          {rarityLabel}
        </p>

        <div className="relative mt-3 flex w-[48%] max-w-[13.5rem] aspect-square shrink-0 items-center justify-center sm:mt-4">
          <Image
            src={RELIC_INSPECT_REWARD_PANEL}
            alt=""
            width={304}
            height={304}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-90"
            aria-hidden
          />
          {art}
          <Image
            src={inspectFrameUrl}
            alt=""
            width={408}
            height={408}
            className="pointer-events-none absolute inset-0 z-[2] h-full w-full object-contain"
            aria-hidden
          />
        </div>

        <div className="mt-auto flex w-full flex-col items-center gap-2 pt-3 text-center">
          <div className="w-full max-w-[22rem] font-game-text text-sm leading-relaxed text-gray-100 sm:text-base">
            {description}
          </div>
          {flavor ? (
            <>
              <div
                className="h-px w-[70%] max-w-[16rem] bg-gradient-to-r from-transparent via-white/35 to-transparent"
                aria-hidden
              />
              <div className="w-full max-w-[22rem] font-game-text text-xs italic leading-relaxed text-gray-300 sm:text-sm">
                {flavor}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

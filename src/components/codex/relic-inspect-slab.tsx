"use client";

import type { ReactNode } from "react";
import Image from "@/components/ui/static-image";
import {
  RELIC_RARITY_COLORS,
  type RelicRarityKo,
} from "@/lib/codex-types";
import {
  RELIC_INSPECT_FRAME_SIZE,
  RELIC_INSPECT_REWARD_PANEL,
  RELIC_INSPECT_REWARD_PANEL_SIZE,
  relicInspectFrameUrl,
} from "@/lib/relic-inspect-assets";
import { cn } from "@/lib/utils";

const PANEL_ASPECT =
  `${RELIC_INSPECT_REWARD_PANEL_SIZE.width} / ${RELIC_INSPECT_REWARD_PANEL_SIZE.height}`;
const FRAME_WIDTH_PERCENT =
  (RELIC_INSPECT_FRAME_SIZE.width / RELIC_INSPECT_REWARD_PANEL_SIZE.width) * 100;

export function RelicInspectSlab({
  rarity,
  rarityLabel,
  title,
  art,
  description,
  flavor,
  className,
  titleAs: TitleTag = "h1",
  density = "detail",
}: {
  rarity: RelicRarityKo;
  rarityLabel: string;
  title: ReactNode;
  art: ReactNode;
  description: ReactNode;
  flavor?: ReactNode;
  className?: string;
  titleAs?: "h1" | "div";
  density?: "detail" | "hover";
}) {
  const rarityColor = RELIC_RARITY_COLORS[rarity];
  const inspectFrameUrl = relicInspectFrameUrl(rarity);
  const hover = density === "hover";

  return (
    <div
      data-relic-inspect-slab
      data-relic-inspect-density={density}
      className={cn("dark relative mx-auto w-full max-w-[28rem]", className)}
      style={{ aspectRatio: PANEL_ASPECT }}
    >
      <Image
        src={RELIC_INSPECT_REWARD_PANEL}
        alt=""
        width={RELIC_INSPECT_REWARD_PANEL_SIZE.width}
        height={RELIC_INSPECT_REWARD_PANEL_SIZE.height}
        className="pointer-events-none absolute inset-0 h-full w-full object-fill"
        aria-hidden
      />

      <div className={cn(
        "relative z-10 flex h-full min-h-0 flex-col items-center px-[11%] pb-[9%] pt-[8%]",
        hover && "px-[10%] pb-[8%] pt-[7%]",
      )}>
        <TitleTag
          className={cn(
            "max-w-[90%] shrink-0 text-center font-game-title font-bold leading-tight",
            hover ? "text-sm" : "text-xl sm:text-2xl",
          )}
          style={{ color: "#efc851", textShadow: "3px 3px 0 rgba(0,0,0,0.35)" }}
        >
          {title}
        </TitleTag>
        <p
          className={cn(
            "mt-1 shrink-0 font-game-text font-bold",
            hover ? "text-[11px]" : "text-sm sm:text-base",
          )}
          style={{ color: rarityColor }}
        >
          {rarityLabel}
        </p>

        <div
          className={cn(
            "relative flex aspect-square shrink-0 items-center justify-center",
            hover ? "mt-1.5" : "mt-3 sm:mt-4",
          )}
          style={{ width: `${FRAME_WIDTH_PERCENT}%` }}
        >
          <Image
            src={RELIC_INSPECT_REWARD_PANEL}
            alt=""
            width={RELIC_INSPECT_FRAME_SIZE.width}
            height={RELIC_INSPECT_FRAME_SIZE.height}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-90"
            aria-hidden
          />
          {art}
          <Image
            src={inspectFrameUrl}
            alt=""
            width={RELIC_INSPECT_FRAME_SIZE.width}
            height={RELIC_INSPECT_FRAME_SIZE.height}
            className="pointer-events-none absolute inset-0 z-[2] h-full w-full object-contain"
            aria-hidden
          />
        </div>

        <div className={cn(
          "flex min-h-0 w-full flex-1 flex-col items-center gap-2 text-center",
          hover ? "mt-1.5 pt-1" : "mt-3 pt-2",
        )}>
          <div className={cn(
            "flex min-h-0 w-full max-w-[22rem] flex-1 flex-col overflow-hidden font-game-text text-gray-100",
            hover ? "text-[11px] leading-snug" : "text-sm leading-relaxed sm:text-base",
          )}>
            {description}
          </div>
          {flavor ? (
            <div className="mt-auto flex w-full max-w-[22rem] shrink-0 flex-col items-center gap-2">
              <div
                className="h-px w-[70%] max-w-[16rem] bg-gradient-to-r from-transparent via-white/35 to-transparent"
                aria-hidden
              />
              <div className={cn(
                "w-full font-game-text italic leading-relaxed text-gray-300",
                hover ? "text-[10px]" : "text-xs sm:text-sm",
              )}>
                {flavor}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

"use client";

import Image from "next/image";
import { useState } from "react";
import { HoverTip } from "@/components/codex/hover-tip";
import { useGameI18n } from "@/hooks/use-game-i18n";
import { characterIconSrc, partyDuplicateOrdinals } from "@/lib/history-party";
import { formatGameTemplate, gameUi, localizeGame } from "@/lib/sts2-game-i18n";
import type { ReplayRun } from "@/lib/sts2-run-replay";
import { cn } from "@/lib/utils";

const CHIP = 48;
const OVERLAP_X = 20;
const POP_PX = 6;

function characterLabel(id: string, tables: ReturnType<typeof useGameI18n>): string {
  return localizeGame(tables, "characters", id) ?? id.replace(/^CHARACTER\./, "");
}

export function PartyPortraitStack({
  run,
  focusedIndex,
  onFocus,
  size = "topbar",
}: {
  run: ReplayRun;
  focusedIndex: number;
  onFocus?: (index: number) => void;
  size?: "topbar" | "summary";
}) {
  const tables = useGameI18n();
  const characters = run.players.map((player) => player.character);
  const ordinals = partyDuplicateOrdinals(characters);
  const interactive = typeof onFocus === "function" && run.players.length > 1;
  const multi = run.players.length > 1;
  const chip = size === "summary" ? 48 : CHIP;
  const overlapX = size === "summary" ? 22 : OVERLAP_X;
  const popPx = multi ? POP_PX : 0;
  const width = chip + Math.max(0, characters.length - 1) * overlapX;
  const height = chip + popPx;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div
      className="relative shrink-0 overflow-visible"
      style={{ width, height }}
      data-testid="party-portrait-stack"
      data-focused-player={focusedIndex}
    >
      {characters.map((character, playerIndex) => {
        const label = characterLabel(character, tables);
        const ordinal = ordinals[playerIndex];
        const focused = playerIndex === focusedIndex;
        const title = ordinal != null ? `${label} ${ordinal}` : label;
        const inner = (
          <>
            <span className="absolute inset-1 overflow-hidden">
              <Image
                src={characterIconSrc(character)}
                alt=""
                fill
                sizes="44px"
                className={cn(
                  "object-contain transition-[filter] duration-200",
                  !focused && multi && "[filter:blur(2.5px)]",
                )}
              />
            </span>
            {ordinal != null && (
              <span
                className="absolute bottom-0.5 left-0.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-sm bg-black/75 px-0.5 text-[10px] font-bold leading-none text-amber-100"
                aria-hidden
              >
                {ordinal}
              </span>
            )}
            {focused && run.ascension > 0 && (
              <AscensionBadge ascension={run.ascension} />
            )}
            {hoveredIndex === playerIndex && (
              <span
                className="pointer-events-none absolute left-1/2 top-full z-50 -translate-x-1/2 translate-y-2"
                style={{ width: "max-content", maxWidth: 220 }}
              >
                <HoverTip title={title} compact>
                  {run.ascension > 0
                    ? formatGameTemplate(
                        gameUi(tables, "ascension", "Ascension {ascension}"),
                        { ascension: run.ascension },
                      )
                    : null}
                </HoverTip>
              </span>
            )}
          </>
        );
        const frameStyle = {
          width: chip,
          height: chip,
          left: playerIndex * overlapX,
          top: popPx,
          zIndex: focused ? 20 : 10,
          transform: focused && multi ? `translateY(-${popPx}px)` : undefined,
          backgroundImage: "url(/images/sts2/ui/topbar/top_bar_char_backdrop.png)",
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
        } as const;
        const frameClass = "absolute overflow-visible transition-transform duration-200";

        if (interactive) {
          return (
            <button
              key={playerIndex}
              type="button"
              aria-pressed={focused}
              aria-label={title}
              data-testid={`party-portrait-${playerIndex}`}
              className={cn(frameClass, "cursor-pointer")}
              style={frameStyle}
              onClick={() => onFocus(playerIndex)}
              onMouseEnter={() => setHoveredIndex(playerIndex)}
              onMouseLeave={() => setHoveredIndex(null)}
              onFocus={() => setHoveredIndex(playerIndex)}
              onBlur={() => setHoveredIndex(null)}
            >
              {inner}
            </button>
          );
        }

        return (
          <span
            key={playerIndex}
            aria-label={title}
            data-testid={`party-portrait-${playerIndex}`}
            className={frameClass}
            style={frameStyle}
            onMouseEnter={() => setHoveredIndex(playerIndex)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {inner}
          </span>
        );
      })}
    </div>
  );
}

function AscensionBadge({ ascension }: { ascension: number }) {
  const tables = useGameI18n();
  return (
    <span
      className="pointer-events-none absolute -bottom-0.5 -right-1 flex h-7 w-7 items-end justify-center"
      aria-label={formatGameTemplate(
        gameUi(tables, "ascension", "Ascension {ascension}"),
        { ascension },
      )}
    >
      <Image
        src="/images/sts2/ui/topbar/top_bar_ascension.png"
        alt=""
        fill
        sizes="28px"
        className="object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
        unoptimized
      />
      <span className="topbar-num relative z-10 mb-0.5 text-[13px] leading-none text-white">
        {ascension}
      </span>
    </span>
  );
}

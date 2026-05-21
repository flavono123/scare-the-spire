"use client";

import { useState, useRef, useCallback, memo } from "react";
import Image from "@/components/ui/static-image";
import type { ServiceLocale } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import type { CodexPower } from "@/lib/codex-types";
import { DescriptionText } from "./codex-description";
import { GameHoverTip, type HoverTipVariant } from "./hover-tip";

const TYPE_STYLES: Record<string, { border: string }> = {
  Buff: {
    border: "border-green-500/60 bg-green-500/10",
  },
  Debuff: {
    border: "border-red-500/60 bg-red-500/10",
  },
  None: {
    border: "border-zinc-500/60 bg-zinc-500/10",
  },
};

interface PowerTileProps {
  serviceLocale?: ServiceLocale;
  gameUi: CodexGameUiLabels;
  power: CodexPower;
  showBeta?: boolean;
  onClick?: () => void;
}

type TooltipPlacement = {
  horizontal: "left" | "right";
  vertical: "top" | "bottom";
};

const TOOLTIP_GAP = 12;
const TOOLTIP_WIDTH = 320;
const TOOLTIP_HEIGHT = 220;

function getPowerHoverTipVariant(power: CodexPower): HoverTipVariant {
  if (power.type === "Buff") return "buff";
  if (power.type === "Debuff") return "debuff";
  return "default";
}

export const PowerTile = memo(function PowerTile({ power, showBeta = false, onClick }: PowerTileProps) {
  const [hovered, setHovered] = useState(false);
  const tileRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<TooltipPlacement>({
    horizontal: "right",
    vertical: "top",
  });

  const style = TYPE_STYLES[power.type] ?? TYPE_STYLES.None;
  const imageUrl = showBeta && power.betaImageUrl ? power.betaImageUrl : power.imageUrl;

  const updatePlacement = useCallback(() => {
    const rect = tileRef.current?.getBoundingClientRect();
    if (!rect) return;
    const horizontal = rect.right + TOOLTIP_GAP + TOOLTIP_WIDTH > window.innerWidth
      ? "left"
      : "right";
    const vertical = rect.top + TOOLTIP_HEIGHT > window.innerHeight
      ? "bottom"
      : "top";
    setPlacement({ horizontal, vertical });
  }, []);

  return (
    <div
      ref={tileRef}
      className="relative group"
      onMouseEnter={() => {
        updatePlacement();
        setHovered(true);
      }}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <div
        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 p-1 transition-all cursor-pointer ${
          hovered
            ? `${style.border} scale-110 z-10`
            : "border-transparent bg-white/5 hover:bg-white/10"
        }`}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={power.name}
            width={56}
            height={56}
            className="w-full h-full object-contain drop-shadow-md"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
            ?
          </div>
        )}
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <div
          className={`pointer-events-none absolute z-50 hidden w-max max-w-80 md:block ${
            placement.horizontal === "right" ? "left-full ml-3" : "right-full mr-3"
          } ${placement.vertical === "top" ? "top-0" : "bottom-0"}`}
        >
          <GameHoverTip
            title={power.name}
            variant={getPowerHoverTipVariant(power)}
            style={{ minWidth: 280 }}
          >
            <DescriptionText description={power.description} className="block text-left" />
          </GameHoverTip>
        </div>
      )}
    </div>
  );
});

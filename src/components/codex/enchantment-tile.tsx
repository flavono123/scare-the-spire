"use client";

import { useState, useRef, useCallback, memo } from "react";
import Image from "@/components/ui/static-image";
import type { ServiceLocale } from "@/lib/i18n";
import { CodexEnchantment } from "@/lib/codex-types";
import { DescriptionText } from "./codex-description";
import { GameHoverTip } from "./hover-tip";

interface EnchantmentTileProps {
  serviceLocale?: ServiceLocale;
  enchantment: CodexEnchantment;
  onClick?: () => void;
}

type TooltipPlacement = {
  horizontal: "left" | "right";
  vertical: "top" | "bottom";
};

const TOOLTIP_GAP = 12;
const TOOLTIP_WIDTH = 400;
const TOOLTIP_HEIGHT = 220;

export const EnchantmentTile = memo(function EnchantmentTile({ serviceLocale = "ko", enchantment, onClick }: EnchantmentTileProps) {
  void serviceLocale;
  const [hovered, setHovered] = useState(false);
  const tileRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<TooltipPlacement>({
    horizontal: "right",
    vertical: "top",
  });

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
      onMouseEnter={() => { updatePlacement(); setHovered(true); }}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <div
        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-lg border-2 p-1 transition-all cursor-pointer ${
          hovered
            ? "border-purple-500/60 bg-purple-500/10 scale-110 z-10"
            : "border-transparent bg-white/5 hover:bg-white/10"
        }`}
      >
        {enchantment.imageUrl ? (
          <Image
            src={enchantment.imageUrl}
            alt={enchantment.name}
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
          className={`pointer-events-none absolute z-50 hidden max-w-[25rem] items-start gap-2.5 md:flex ${
            placement.horizontal === "right" ? "left-full ml-3" : "right-full mr-3"
          } ${placement.vertical === "top" ? "top-0" : "bottom-0"}`}
        >
          {enchantment.imageUrl && (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-black/20">
              <Image
                src={enchantment.imageUrl}
                alt={enchantment.name}
                width={64}
                height={64}
                className="h-14 w-14 object-contain drop-shadow-md"
              />
            </div>
          )}
          <GameHoverTip title={enchantment.name} style={{ minWidth: 280, maxWidth: 320 }}>
            <DescriptionText description={enchantment.description} className="block text-left" />
          </GameHoverTip>
        </div>
      )}
    </div>
  );
});

"use client";

import { useState, useRef, useCallback, memo } from "react";
import Link from "next/link";
import Image from "@/components/ui/static-image";
import { localizeHref, type ServiceLocale } from "@/lib/i18n";
import { buildCompendiumResourceDetailHref } from "@/lib/compendium-resource-links";
import type { CodexAffliction, CodexEnchantment } from "@/lib/codex-types";
import { DescriptionText } from "./codex-description";
import { GameHoverTip } from "./hover-tip";

interface EnchantmentTileProps {
  serviceLocale?: ServiceLocale;
  resource: CodexEnchantment | CodexAffliction;
  onClick?: () => void;
}

type TooltipPlacement = {
  horizontal: "left" | "right";
  vertical: "top" | "bottom";
};

const TOOLTIP_GAP = 12;
const TOOLTIP_WIDTH = 400;
const TOOLTIP_HEIGHT = 220;

export const EnchantmentTile = memo(function EnchantmentTile({ serviceLocale = "ko", resource, onClick }: EnchantmentTileProps) {
  const [hovered, setHovered] = useState(false);
  const tileRef = useRef<HTMLAnchorElement>(null);
  const [placement, setPlacement] = useState<TooltipPlacement>({
    horizontal: "right",
    vertical: "top",
  });
  const lifecycleClassName = resource.deprecated ? " opacity-50 grayscale saturate-0" : "";

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
    <Link
      ref={tileRef}
      href={localizeHref(buildCompendiumResourceDetailHref("enchantment", resource.id), serviceLocale)}
      className="relative group"
      onMouseEnter={() => { updatePlacement(); setHovered(true); }}
      onMouseLeave={() => setHovered(false)}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        onClick?.();
      }}
    >
      <div
        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-lg border-2 p-1 transition-all cursor-pointer${lifecycleClassName} ${
          hovered
            ? "border-purple-500/60 bg-purple-500/10 scale-110 z-10"
            : "border-transparent bg-white/5 hover:bg-white/10"
        }`}
      >
        {resource.imageUrl ? (
          <Image
            src={resource.imageUrl}
            alt={resource.name}
            width={56}
            height={56}
            loading="lazy"
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
          className={`pointer-events-none absolute z-50 hidden md:block ${
            placement.horizontal === "right" ? "left-full ml-3" : "right-full mr-3"
          } ${placement.vertical === "top" ? "top-0" : "bottom-0"}`}
        >
          <GameHoverTip title={resource.name} style={{ minWidth: 280, maxWidth: 320 }}>
            <DescriptionText description={resource.description} className="block text-left" />
          </GameHoverTip>
        </div>
      )}
    </Link>
  );
});

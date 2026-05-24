"use client";

import { useCallback, useRef, useState } from "react";
import Image from "@/components/ui/static-image";
import type { ServiceLocale } from "@/lib/i18n";
import { CodexRelic, characterOutlineFilter, type RelicPool } from "@/lib/codex-types";
import { DescriptionText } from "./codex-description";
import { GameHoverTip } from "./hover-tip";

// Game order: 아이언클래드, 사일런트, 리젠트, 네크로바인더, 디펙트
const VARIANT_POOLS: RelicPool[] = ["ironclad", "silent", "regent", "necrobinder", "defect"];

function stableHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pickStableVariant(relic: CodexRelic): RelicPool | null {
  if (!relic.variantImageUrls) return null;
  const pools = VARIANT_POOLS.filter((pool) => relic.variantImageUrls?.[pool]);
  if (pools.length === 0) return null;
  return pools[stableHash(relic.id) % pools.length] ?? null;
}

interface RelicTileProps {
  serviceLocale?: ServiceLocale;
  relic: CodexRelic;
  showBeta?: boolean;
  onClick?: (variantPool?: RelicPool) => void;
}

type TooltipPlacement = {
  horizontal: "left" | "right";
  vertical: "top" | "bottom";
};

const TOOLTIP_GAP = 12;
const TOOLTIP_WIDTH = 320;
const TOOLTIP_HEIGHT = 220;

export function RelicTile({ serviceLocale = "ko", relic, showBeta = false, onClick }: RelicTileProps) {
  void serviceLocale;
  const tileRef = useRef<HTMLDivElement>(null);
  const tileVariant = pickStableVariant(relic);
  const tileImageUrl = showBeta && relic.betaImageUrl
    ? relic.betaImageUrl
    : relic.imageUrl ?? (tileVariant ? relic.variantImageUrls?.[tileVariant] ?? null : null);

  const [hovered, setHovered] = useState(false);
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
      onMouseEnter={() => {
        updatePlacement();
        setHovered(true);
      }}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onClick?.(tileVariant ?? undefined)}
    >
      <div
        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-lg border-2 p-1 transition-all cursor-pointer ${
          hovered
            ? "border-yellow-500/60 bg-yellow-500/10 scale-110 z-10"
            : "border-transparent bg-white/5 hover:bg-white/10"
        }`}
      >
        {tileImageUrl ? (
          <Image
            src={tileImageUrl}
            alt={relic.name}
            width={56}
            height={56}
            loading="lazy"
            className="w-full h-full object-contain"
            style={{
              filter: characterOutlineFilter(relic.pool) ?? "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
            }}
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
          <GameHoverTip title={relic.name} style={{ minWidth: 280 }}>
            <DescriptionText description={relic.description} className="block text-left" />
          </GameHoverTip>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { CodexRelic, characterOutlineFilter, getCharacterColor, POOL_LABELS, type RelicPool, type RelicFilterPool } from "@/lib/codex-types";
import { DescriptionText } from "./codex-description";

// Game order: 아이언클래드, 사일런트, 리젠트, 네크로바인더, 디펙트
const VARIANT_POOLS: RelicPool[] = ["ironclad", "silent", "regent", "necrobinder", "defect"];

interface RelicTileProps {
  relic: CodexRelic;
  onClick?: (variantPool?: RelicPool) => void;
}

export function RelicTile({ relic, onClick }: RelicTileProps) {
  // For variant relics, pick a random character per mount
  const [tileVariant] = useState<RelicPool | null>(() => {
    if (!relic.variantImageUrls) return null;
    const pools = VARIANT_POOLS.filter((p) => relic.variantImageUrls![p]);
    return pools[Math.floor(Math.random() * pools.length)] ?? null;
  });
  const tileImageUrl = relic.imageUrl ?? (tileVariant ? relic.variantImageUrls?.[tileVariant] ?? null : null);

  const [hovered, setHovered] = useState(false);
  const tileRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipSide, setTooltipSide] = useState<"right" | "left">("right");

  const updateTooltipSide = useCallback(() => {
    if (!tileRef.current) return;
    const rect = tileRef.current.getBoundingClientRect();
    const spaceRight = window.innerWidth - rect.right;
    setTooltipSide(spaceRight < 280 ? "left" : "right");
  }, []);

  return (
    <div
      ref={tileRef}
      className="relative group"
      onMouseEnter={() => { updateTooltipSide(); setHovered(true); }}
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
          ref={tooltipRef}
          className={`absolute z-50 w-64 bg-[#0c0c20]/95 border border-white/15 rounded-lg shadow-2xl p-3 pointer-events-none ${
            tooltipSide === "right"
              ? "left-full ml-2 top-0"
              : "right-full mr-2 top-0"
          }`}
        >
          <div className="font-bold text-yellow-400 text-sm mb-1">
            {relic.name}
          </div>
          {relic.nameEn !== relic.name && (
            <div className="text-[10px] text-gray-500 mb-1.5">
              {relic.nameEn}
            </div>
          )}
          {relic.pool !== "shared" && (
            <div
              className="text-[10px] font-medium mb-1.5"
              style={{ color: getCharacterColor(relic.pool) }}
            >
              {POOL_LABELS[relic.pool as RelicFilterPool]}
            </div>
          )}
          <div className="text-xs text-gray-200 leading-relaxed">
            <DescriptionText description={relic.description} />
          </div>
        </div>
      )}
    </div>
  );
}

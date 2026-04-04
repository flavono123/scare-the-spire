"use client";

import { useState, useRef, useCallback, memo } from "react";
import Image from "next/image";
import { CodexEnchantment } from "@/lib/codex-types";
import { DescriptionText } from "./codex-description";

interface EnchantmentTileProps {
  enchantment: CodexEnchantment;
  onClick?: () => void;
}

export const EnchantmentTile = memo(function EnchantmentTile({ enchantment, onClick }: EnchantmentTileProps) {
  const [hovered, setHovered] = useState(false);
  const tileRef = useRef<HTMLDivElement>(null);
  const [tooltipSide, setTooltipSide] = useState<"right" | "left">("right");

  const updateTooltipSide = useCallback(() => {
    if (!tileRef.current) return;
    const rect = tileRef.current.getBoundingClientRect();
    const spaceRight = window.innerWidth - rect.right;
    setTooltipSide(spaceRight < 320 ? "left" : "right");
  }, []);

  return (
    <div
      ref={tileRef}
      className="relative group"
      onMouseEnter={() => { updateTooltipSide(); setHovered(true); }}
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
          className={`absolute z-50 w-72 bg-[#0c0c20]/95 border border-white/15 rounded-lg shadow-2xl p-3 pointer-events-none ${
            tooltipSide === "right"
              ? "left-full ml-2 top-0"
              : "right-full mr-2 top-0"
          }`}
        >
          {/* Name + badges */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-bold text-sm text-purple-400">
              {enchantment.name}
            </span>
            {enchantment.cardType && (
              <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${
                enchantment.cardType === "Attack"
                  ? "bg-red-500/15 text-red-400 border-red-500/30"
                  : "bg-blue-500/15 text-blue-400 border-blue-500/30"
              }`}>
                {enchantment.cardType === "Attack" ? "공격" : "스킬"} 전용
              </span>
            )}
            {enchantment.isStackable && (
              <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-400">
                중첩
              </span>
            )}
          </div>

          {enchantment.nameEn !== enchantment.name && (
            <div className="text-[10px] text-gray-500 mb-1.5">
              {enchantment.nameEn}
            </div>
          )}

          {/* Description */}
          <div className="text-xs text-gray-200 leading-relaxed">
            <DescriptionText description={enchantment.description} />
          </div>

          {/* Extra card text */}
          {enchantment.extraCardText && (
            <div className="mt-2 rounded border border-zinc-700/50 bg-zinc-800/50 px-2 py-1.5">
              <span className="block text-[9px] font-medium text-gray-500 mb-0.5">
                카드 텍스트
              </span>
              <div className="text-[11px] text-zinc-300 leading-relaxed">
                <DescriptionText description={enchantment.extraCardText} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

"use client";

import { useState, useRef, useCallback, memo } from "react";
import Image from "next/image";
import { CodexPower } from "@/lib/codex-types";
import { DescriptionText } from "./codex-description";

const TYPE_STYLES: Record<string, { border: string; text: string; badge: string }> = {
  Buff: {
    border: "border-green-500/60 bg-green-500/10",
    text: "text-green-400",
    badge: "bg-green-500/15 text-green-400 border-green-500/30",
  },
  Debuff: {
    border: "border-red-500/60 bg-red-500/10",
    text: "text-red-400",
    badge: "bg-red-500/15 text-red-400 border-red-500/30",
  },
  None: {
    border: "border-zinc-500/60 bg-zinc-500/10",
    text: "text-zinc-400",
    badge: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  },
};

interface PowerTileProps {
  power: CodexPower;
  onClick?: () => void;
}

export const PowerTile = memo(function PowerTile({ power, onClick }: PowerTileProps) {
  const [hovered, setHovered] = useState(false);
  const tileRef = useRef<HTMLDivElement>(null);
  const [tooltipSide, setTooltipSide] = useState<"right" | "left">("right");

  const style = TYPE_STYLES[power.type] ?? TYPE_STYLES.None;

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
      onClick={onClick}
    >
      <div
        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 p-1 transition-all cursor-pointer ${
          hovered
            ? `${style.border} scale-110 z-10`
            : "border-transparent bg-white/5 hover:bg-white/10"
        }`}
      >
        {power.imageUrl ? (
          <Image
            src={power.imageUrl}
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
          className={`absolute z-50 w-64 bg-[#0c0c20]/95 border border-white/15 rounded-lg shadow-2xl p-3 pointer-events-none ${
            tooltipSide === "right"
              ? "left-full ml-2 top-0"
              : "right-full mr-2 top-0"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-bold text-sm ${style.text}`}>
              {power.name}
            </span>
            <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${style.badge}`}>
              {power.type === "Buff" ? "버프" : power.type === "Debuff" ? "디버프" : "기타"}
            </span>
          </div>
          {power.nameEn !== power.name && (
            <div className="text-[10px] text-gray-500 mb-1.5">
              {power.nameEn}
            </div>
          )}
          <div className="text-xs text-gray-200 leading-relaxed">
            <DescriptionText description={power.description} />
          </div>
        </div>
      )}
    </div>
  );
});

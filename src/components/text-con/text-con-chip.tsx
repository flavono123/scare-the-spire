"use client";

import {
  calculateTextConFontSize,
  isHexBright,
  resolveTextConBg,
  resolveTextConText,
} from "@/lib/text-con";
import { cn } from "@/lib/utils";

export interface TextConChipProps {
  text: string;
  bgColor?: string;
  textColor?: string;
  size?: "sm" | "md" | "preview";
  className?: string;
}

export function TextConChip({
  text,
  bgColor,
  textColor,
  size = "md",
  className,
}: TextConChipProps) {
  const bg = resolveTextConBg(bgColor);
  const textClr = resolveTextConText(textColor);
  const isBright = isHexBright(bg.hex);

  const basePx = size === "preview" ? 144 : size === "sm" ? 64 : 100;
  const fontSizePx = calculateTextConFontSize(text, basePx);

  const sizeClass = {
    sm: "h-16 w-16 rounded-lg p-0.5",
    md: "h-24 w-24 sm:h-28 sm:w-28 rounded-xl sm:rounded-2xl p-1",
    preview: "h-36 w-36 sm:h-40 sm:w-40 rounded-2xl p-1.5",
  }[size];

  return (
    <div
      data-text-con=""
      data-text-con-bg={bg.id}
      data-text-con-text={textClr.id}
      className={cn(
        "relative flex aspect-square shrink-0 select-none flex-col items-center justify-center overflow-hidden text-center shadow-md",
        isBright ? "border border-black/15 shadow-black/10" : "border border-white/20 shadow-black/40",
        sizeClass,
        className,
      )}
      style={{
        backgroundColor: bg.hex,
        color: textClr.hex,
      }}
    >
      <span
        className="flex flex-col items-center justify-center font-game-title font-black tracking-tight whitespace-pre-wrap break-keep"
        style={{
          fontSize: `${fontSizePx}px`,
          lineHeight: 1.05,
        }}
      >
        {text}
      </span>
    </div>
  );
}

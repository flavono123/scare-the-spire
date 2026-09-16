"use client";

import {
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

  // Dynamic text size based on length
  const charCount = text.length;
  let textScaleClass = "text-sm sm:text-base";
  if (size === "preview") {
    textScaleClass = charCount <= 6 ? "text-2xl sm:text-3xl" : charCount <= 12 ? "text-xl sm:text-2xl" : "text-base sm:text-lg";
  } else if (size === "sm") {
    textScaleClass = charCount <= 6 ? "text-xs font-bold" : "text-[10px]";
  } else {
    // "md" (standard comment sticker)
    textScaleClass = charCount <= 6 ? "text-base sm:text-lg" : charCount <= 14 ? "text-sm sm:text-base" : "text-xs sm:text-sm";
  }

  const sizeClass = {
    sm: "h-16 w-16 rounded-lg p-1.5",
    md: "h-24 w-24 sm:h-28 sm:w-28 rounded-xl sm:rounded-2xl p-2 sm:p-2.5",
    preview: "h-36 w-36 sm:h-44 sm:w-44 rounded-2xl p-3 sm:p-4",
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
        className={cn(
          "font-game-title font-extrabold tracking-tight leading-snug whitespace-pre-wrap break-keep",
          textScaleClass,
        )}
      >
        {text}
      </span>
    </div>
  );
}

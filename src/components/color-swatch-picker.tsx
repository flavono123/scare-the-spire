"use client";

import { Check } from "lucide-react";
import {
  GAME_UI_HOVER_TIP_NAV_DELAY_MS,
  GameUiHoverTip,
} from "@/components/game-ui-hover-tip";
import { isHexBright } from "@/lib/text-con";
import { cn } from "@/lib/utils";

export interface ColorSwatchItem {
  id: string;
  label: string;
  hex: string;
}

export function ColorSwatchPicker({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: readonly ColorSwatchItem[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {items.map((item) => {
        const isSelected = item.id.toLowerCase() === value.toLowerCase();
        const isBright = isHexBright(item.hex);
        const checkColor = isBright ? "#18181B" : "#FFFFFF";

        return (
          <GameUiHoverTip
            key={item.id}
            label={item.label}
            delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}
          >
            <button
              type="button"
              role="radio"
              aria-label={item.label}
              aria-checked={isSelected}
              onClick={() => onChange(item.id)}
              className={cn(
                "relative flex h-7 w-7 items-center justify-center rounded-full border transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                isSelected
                  ? "scale-110 border-primary shadow-md"
                  : "border-black/20 hover:scale-105 hover:border-white/40 dark:border-white/20",
              )}
              style={{ backgroundColor: item.hex }}
            >
              {isSelected && (
                <Check
                  size={14}
                  strokeWidth={3}
                  style={{ color: checkColor }}
                  className="shrink-0 drop-shadow-sm"
                />
              )}
            </button>
          </GameUiHoverTip>
        );
      })}
    </div>
  );
}

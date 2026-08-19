"use client";

import { FilterSection } from "@/components/codex/codex-filters";
import {
  GameWaxCycleToggle,
  type GameWaxCycleValue,
} from "@/components/codex/game-checkbox";
import { SPIRE_ICON_COLORS } from "@/components/spire-icon";
import type { ServiceLocale } from "@/lib/i18n";
import type {
  TransfigureTokenColor,
  TransfigureTokenWax,
} from "@/lib/transfigure-types";
import { TRANSFIGURE_TOKEN_COLORS } from "@/lib/transfigure-types";
import { serviceMessages } from "@/messages/service";

export function TransfigureTokenAppearanceControls({
  color,
  wax,
  serviceLocale,
  waxLabel,
  meltedLabel,
  onColorChange,
  onWaxChange,
}: {
  color: TransfigureTokenColor | "";
  wax: TransfigureTokenWax;
  serviceLocale: ServiceLocale;
  waxLabel: string;
  meltedLabel: string;
  onColorChange: (color: TransfigureTokenColor | "") => void;
  onWaxChange: (wax: TransfigureTokenWax) => void;
}) {
  const copy = serviceMessages[serviceLocale].transfigure;

  return (
    <div
      className="border-t border-white/10 px-3 py-2"
      data-transfigure-token-appearance
    >
      <FilterSection label={copy.tokenAppearance}>
        <div className="flex flex-wrap gap-1.5">
          {TRANSFIGURE_TOKEN_COLORS.map((tokenColor) => {
            const active = color === tokenColor;
            const label = copy.tokenColors[tokenColor];
            return (
              <button
                key={tokenColor}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={active}
                onClick={() => {
                  onColorChange(active ? "" : tokenColor);
                }}
                className={`group relative h-9 w-9 rounded-lg border-2 p-1 transition-all ${
                  active
                    ? "border-yellow-500 bg-yellow-500/20"
                    : "border-white/10 bg-white/5 hover:border-white/30"
                }`}
              >
                <span
                  aria-hidden
                  className={`block h-full w-full rounded-md ${
                    active ? "" : "opacity-50 group-hover:opacity-100"
                  }`}
                  style={{ backgroundColor: SPIRE_ICON_COLORS[tokenColor] }}
                />
                <span className="pointer-events-none absolute -bottom-7 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-2 py-0.5 text-[10px] text-gray-200 opacity-0 transition-opacity group-hover:opacity-100">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
        <GameWaxCycleToggle
          value={wax as GameWaxCycleValue}
          onValueChange={(value) => onWaxChange(value)}
          waxLabel={waxLabel}
          meltedLabel={meltedLabel}
          size="sm"
          className="mt-1"
        />
      </FilterSection>
    </div>
  );
}

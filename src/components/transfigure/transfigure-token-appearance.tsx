"use client";

import { FilterSection } from "@/components/codex/codex-filters";
import {
  GameWaxCycleToggle,
  type GameWaxCycleValue,
} from "@/components/codex/game-checkbox";
import {
  GAME_UI_HOVER_TIP_NAV_DELAY_MS,
  GameUiHoverTip,
} from "@/components/game-ui-hover-tip";
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
              <GameUiHoverTip
                key={tokenColor}
                label={label}
                delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}
              >
                <button
                  type="button"
                  aria-label={label}
                  aria-pressed={active}
                  onClick={() => {
                    onColorChange(active ? "" : tokenColor);
                  }}
                  className={`relative h-9 w-9 rounded-lg border-2 p-1 transition-all ${
                    active
                      ? "border-primary bg-primary/20"
                      : "border-white/10 bg-white/5 hover:border-white/30"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`block h-full w-full rounded-md ${
                      active ? "" : "opacity-50 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: SPIRE_ICON_COLORS[tokenColor] }}
                  />
                </button>
              </GameUiHoverTip>
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

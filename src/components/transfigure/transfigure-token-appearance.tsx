"use client";

import { FilterSection, IconFilterButton } from "@/components/codex/codex-filters";
import {
  GameWaxCycleToggle,
  type GameWaxCycleValue,
} from "@/components/codex/game-checkbox";
import type { ServiceLocale } from "@/lib/i18n";
import type {
  TransfigureTokenColor,
  TransfigureTokenWax,
} from "@/lib/transfigure-types";
import { TRANSFIGURE_TOKEN_COLORS } from "@/lib/transfigure-types";
import { serviceMessages } from "@/messages/service";

export const TRANSFIGURE_TOKEN_COLOR_ICONS: Record<TransfigureTokenColor, string> = {
  gold: "/images/sts2/icons/gold_icon.webp",
  red: "/images/sts2/icons/ironclad_energy_icon.webp",
  green: "/images/sts2/icons/silent_energy_icon.webp",
  orange: "/images/sts2/icons/regent_energy_icon.webp",
  pink: "/images/sts2/icons/necrobinder_energy_icon.webp",
  aqua: "/images/sts2/icons/defect_energy_icon.webp",
  blue: "/images/sts2/ui/inspect-relic/relic_inspect_frame-uncommon.webp",
  purple: "/images/sts2/ui/inspect-relic/relic_inspect_frame-event.webp",
};

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
          {TRANSFIGURE_TOKEN_COLORS.map((tokenColor) => (
            <IconFilterButton
              key={tokenColor}
              icon={TRANSFIGURE_TOKEN_COLOR_ICONS[tokenColor]}
              label={copy.tokenColors[tokenColor]}
              active={color === tokenColor}
              onClick={() => {
                onColorChange(color === tokenColor ? "" : tokenColor);
              }}
            />
          ))}
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

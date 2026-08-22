"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import {
  GAME_UI_HOVER_TIP_NAV_DELAY_MS,
  GameUiHoverTip,
} from "@/components/game-ui-hover-tip";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  COLOR_SCHEME_PREFERENCES,
  type ColorSchemePreference,
} from "@/lib/color-scheme";
import { cn } from "@/lib/utils";

export type ColorSchemePickerCopy = {
  label: string;
  dark: string;
  darkHint: string;
  light: string;
  system: string;
  systemHint: string;
};

const ICONS = {
  dark: Moon,
  light: Sun,
  system: Monitor,
} as const;

function optionLabel(copy: ColorSchemePickerCopy, value: ColorSchemePreference): string {
  if (value === "dark") return `${copy.dark} (${copy.darkHint})`;
  if (value === "system") return `${copy.system} (${copy.systemHint})`;
  return copy.light;
}

export function ColorSchemePicker({ copy }: { copy: ColorSchemePickerCopy }) {
  const { preference, setPreference } = useColorScheme();

  return (
    <fieldset className="m-0 flex shrink-0 items-center gap-0.5 border-0 p-0" role="radiogroup" aria-label={copy.label}>
      <legend className="sr-only">{copy.label}</legend>
      {COLOR_SCHEME_PREFERENCES.map((value) => {
        const Icon = ICONS[value];
        const selected = preference === value;
        const label = optionLabel(copy, value);
        return (
          <GameUiHoverTip
            key={value}
            label={label}
            delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}
          >
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={label}
              onClick={() => setPreference(value)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground",
                selected && "bg-primary/10 text-primary",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" strokeWidth={2} />
            </button>
          </GameUiHoverTip>
        );
      })}
    </fieldset>
  );
}

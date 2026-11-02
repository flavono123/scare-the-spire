"use client";

import { useCompendiumDataState } from "@/components/codex/use-compendium-data";
import { useGameLocale } from "@/hooks/use-game-locale";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import type { GameLocale } from "@/lib/i18n";

const GAME_UI_DATA_KEYS = ["gameUi"] as const;

/**
 * Game UI labels for client surfaces that receive none from the server. The
 * built-in fallback labels are Korean, so only other locales load them.
 * `pending` lasts until they arrive or fail, so a caller can hold a preview
 * back instead of flashing the Korean label.
 */
export function useGameUiLabels(
  gameLocale: GameLocale,
  { enabled = true }: { enabled?: boolean } = {},
): { gameUi: CodexGameUiLabels | undefined; pending: boolean } {
  const needed = gameLocale !== "kor";
  const { data, status } = useCompendiumDataState(gameLocale, GAME_UI_DATA_KEYS, {
    enabled: needed && enabled,
  });
  return {
    gameUi: data?.gameUi,
    pending: needed && !data && status !== "failed",
  };
}

/** `useGameUiLabels` for the page's own game locale. */
export function usePageGameUiLabels(options?: { enabled?: boolean }) {
  return useGameUiLabels(useGameLocale(), options);
}

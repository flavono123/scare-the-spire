"use client";

import { useCallback } from "react";
import { useGameLocale } from "@/hooks/use-game-locale";
import { getServiceLocaleForGameLocale, localizeHrefWithGameLocale } from "@/lib/i18n";

/**
 * Returns a localizer that keeps the page's game locale. `localizeHref` only
 * knows the service locale, so on game-only locales (/ja, ...) it links to /en.
 */
export function useLocalizedHref(): (href: string) => string {
  const gameLocale = useGameLocale();
  return useCallback(
    (href: string) =>
      localizeHrefWithGameLocale(href, getServiceLocaleForGameLocale(gameLocale), gameLocale),
    [gameLocale],
  );
}

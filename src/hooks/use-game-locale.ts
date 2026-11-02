"use client";

import { usePathname } from "next/navigation";
import {
  DEFAULT_GAME_LOCALE_BY_SERVICE,
  getGameLocaleFromPathname,
  getServiceLocaleForGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";

export function useGameLocale(): GameLocale {
  const pathname = usePathname() ?? "/";
  return getGameLocaleFromPathname(pathname);
}

/**
 * The page's game locale when it belongs to `serviceLocale`, otherwise that
 * service locale's default. The static patch build has no pathname to read, so
 * the service locale it was given still decides there.
 */
export function useGameLocaleForService(serviceLocale?: ServiceLocale): GameLocale {
  const pathGameLocale = useGameLocale();
  if (!serviceLocale || getServiceLocaleForGameLocale(pathGameLocale) === serviceLocale) {
    return pathGameLocale;
  }
  return DEFAULT_GAME_LOCALE_BY_SERVICE[serviceLocale];
}

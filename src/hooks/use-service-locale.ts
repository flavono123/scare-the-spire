"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  getGameLocaleFromSearch,
  getServiceLocaleForGameLocale,
  getServiceLocaleFromPath,
  type ServiceLocale,
} from "@/lib/i18n";

export function useServiceLocale(): ServiceLocale {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const pathServiceLocale = getServiceLocaleFromPath(pathname);
  const gameLocale = getGameLocaleFromSearch(searchParams, pathServiceLocale);

  return getServiceLocaleForGameLocale(gameLocale);
}

"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  getGameLocaleFromSearch,
  getGameLocaleFromPathname,
  getServiceLocaleForGameLocale,
  getServiceLocaleFromPath,
  hasGameLocalePathPrefix,
  type ServiceLocale,
} from "@/lib/i18n";

const HTML_LANG_BY_SERVICE: Record<ServiceLocale, string> = {
  ko: "ko",
  en: "en",
};

export function LocaleDocumentAttributes() {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const pathServiceLocale = getServiceLocaleFromPath(pathname);
  const gameLocale = searchParams.has("gl") && !hasGameLocalePathPrefix(pathname)
    ? getGameLocaleFromSearch(searchParams, pathServiceLocale)
    : getGameLocaleFromPathname(pathname);
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = HTML_LANG_BY_SERVICE[serviceLocale];
    root.dataset.serviceLocale = serviceLocale;
    root.dataset.gameLocale = gameLocale;
  }, [gameLocale, serviceLocale]);

  return null;
}

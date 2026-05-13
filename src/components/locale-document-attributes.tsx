"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  getGameLocaleFromSearch,
  getServiceLocaleForGameLocale,
  getServiceLocaleFromPath,
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
  const gameLocale = getGameLocaleFromSearch(searchParams, pathServiceLocale);
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = HTML_LANG_BY_SERVICE[serviceLocale];
    root.dataset.serviceLocale = serviceLocale;
    root.dataset.gameLocale = gameLocale;
  }, [gameLocale, serviceLocale]);

  return null;
}

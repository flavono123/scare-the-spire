"use client";

import { usePathname } from "next/navigation";
import {
  getServiceLocaleForGameLocale,
  getServiceLocaleFromPath,
  type ServiceLocale,
} from "@/lib/i18n";

export function useServiceLocale(): ServiceLocale {
  const pathname = usePathname() ?? "/";
  const pathServiceLocale = getServiceLocaleFromPath(pathname);

  return getServiceLocaleForGameLocale(pathServiceLocale.gameLocale);
}

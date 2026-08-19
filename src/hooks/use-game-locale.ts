"use client";

import { usePathname } from "next/navigation";
import { getGameLocaleFromPathname, type GameLocale } from "@/lib/i18n";

export function useGameLocale(): GameLocale {
  const pathname = usePathname() ?? "/";
  return getGameLocaleFromPathname(pathname);
}

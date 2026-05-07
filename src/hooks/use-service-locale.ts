"use client";

import { usePathname } from "next/navigation";
import {
  getServiceLocaleFromPath,
  type ServiceLocale,
} from "@/lib/i18n";

export function useServiceLocale(): ServiceLocale {
  return getServiceLocaleFromPath(usePathname() ?? "/");
}

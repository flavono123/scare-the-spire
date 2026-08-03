import {
  localizeHrefWithGameLocale,
  stripGameLocaleFromPath,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";

export function sanitizeContactSourcePath(value: string | null | undefined): string {
  const path = value?.trim().split(/[?#]/, 1)[0] ?? "";
  if (!path.startsWith("/")) return "/";
  return path.slice(0, 512) || "/";
}

export function getContactHref(
  pathname: string,
  serviceLocale: ServiceLocale,
  gameLocale: GameLocale,
): string {
  const href = localizeHrefWithGameLocale("/contact", serviceLocale, gameLocale);
  const sourcePath = sanitizeContactSourcePath(pathname);
  if (stripGameLocaleFromPath(sourcePath) === "/contact") return href;
  return `${href}?from=${encodeURIComponent(sourcePath)}`;
}

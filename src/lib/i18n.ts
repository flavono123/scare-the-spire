export const SERVICE_LOCALES = ["ko", "en"] as const;

export type ServiceLocale = (typeof SERVICE_LOCALES)[number];

export const DEFAULT_SERVICE_LOCALE: ServiceLocale = "ko";
export const DEFAULT_GAME_LOCALE_BY_SERVICE: Record<ServiceLocale, string> = {
  ko: "kor",
  en: "eng",
};

export function isServiceLocale(value: string): value is ServiceLocale {
  return (SERVICE_LOCALES as readonly string[]).includes(value);
}

export function getServiceLocaleFromPath(pathname: string): ServiceLocale {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  return firstSegment === "en" ? "en" : DEFAULT_SERVICE_LOCALE;
}

export function stripServiceLocaleFromPath(pathname: string): string {
  if (pathname === "/en") return "/";
  if (pathname.startsWith("/en/")) return pathname.slice(3) || "/";
  return pathname || "/";
}

export function localizeHref(href: string, locale: ServiceLocale): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;

  const [path, suffix = ""] = href.split(/(?=[?#])/, 2);
  const unprefixed = stripServiceLocaleFromPath(path);
  const localizedPath = locale === "en" && unprefixed !== "/"
    ? `/en${unprefixed}`
    : locale === "en"
      ? "/en"
      : unprefixed;

  return `${localizedPath}${suffix}`;
}

export function switchServiceLocaleHref(
  pathname: string,
  locale: ServiceLocale,
  search = "",
): string {
  const localizedPath = localizeHref(stripServiceLocaleFromPath(pathname), locale);
  const normalizedSearch = search.replace(/^\?/, "");
  return normalizedSearch ? `${localizedPath}?${normalizedSearch}` : localizedPath;
}

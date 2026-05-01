export const SERVICE_LOCALES = ["ko", "en"] as const;
export const INTERNAL_SERVICE_LOCALE_QUERY = "_sl";

export type ServiceLocale = (typeof SERVICE_LOCALES)[number];

export const GAME_LOCALES = [
  "kor",
  "eng",
  "zhs",
  "jpn",
  "deu",
  "fra",
  "ita",
  "spa",
  "esp",
  "ptb",
  "rus",
  "pol",
  "tha",
  "tur",
] as const;

export type GameLocale = (typeof GAME_LOCALES)[number];

export const DEFAULT_SERVICE_LOCALE: ServiceLocale = "ko";
export const DEFAULT_GAME_LOCALE_BY_SERVICE: Record<ServiceLocale, GameLocale> = {
  ko: "kor",
  en: "eng",
};

export const GAME_LOCALE_LABELS: Record<
  GameLocale,
  Record<ServiceLocale, string>
> = {
  kor: { ko: "한국어", en: "Korean" },
  eng: { ko: "영어", en: "English" },
  zhs: { ko: "중국어 간체", en: "Chinese (Simplified)" },
  jpn: { ko: "일본어", en: "Japanese" },
  deu: { ko: "독일어", en: "German" },
  fra: { ko: "프랑스어", en: "French" },
  ita: { ko: "이탈리아어", en: "Italian" },
  spa: { ko: "스페인어", en: "Spanish" },
  esp: { ko: "스페인어 (중남미)", en: "Spanish (Latin America)" },
  ptb: { ko: "포르투갈어 (브라질)", en: "Portuguese (Brazil)" },
  rus: { ko: "러시아어", en: "Russian" },
  pol: { ko: "폴란드어", en: "Polish" },
  tha: { ko: "태국어", en: "Thai" },
  tur: { ko: "튀르키예어", en: "Turkish" },
};

export function isServiceLocale(value: string): value is ServiceLocale {
  return (SERVICE_LOCALES as readonly string[]).includes(value);
}

export function isGameLocale(value: string): value is GameLocale {
  return (GAME_LOCALES as readonly string[]).includes(value);
}

export function getServiceLocaleFromPath(pathname: string): ServiceLocale {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  return firstSegment === "en" ? "en" : DEFAULT_SERVICE_LOCALE;
}

export function getServiceLocaleFromInternalParam(
  value: string | string[] | undefined,
): ServiceLocale {
  const locale = Array.isArray(value) ? value[0] : value;
  return locale && isServiceLocale(locale) ? locale : DEFAULT_SERVICE_LOCALE;
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

export function getGameLocaleFromSearch(
  searchParams: URLSearchParams,
  serviceLocale: ServiceLocale,
): GameLocale {
  const requested = searchParams.get("gl");
  if (requested && isGameLocale(requested)) return requested;
  return DEFAULT_GAME_LOCALE_BY_SERVICE[serviceLocale];
}

export function withGameLocaleSearch(
  searchParams: URLSearchParams,
  gameLocale: GameLocale,
  serviceLocale: ServiceLocale,
): string {
  const next = new URLSearchParams(searchParams);
  next.delete(INTERNAL_SERVICE_LOCALE_QUERY);
  if (gameLocale === DEFAULT_GAME_LOCALE_BY_SERVICE[serviceLocale]) {
    next.delete("gl");
  } else {
    next.set("gl", gameLocale);
  }

  const query = next.toString();
  return query ? `?${query}` : "";
}

export function getGameLocaleFromSearchRecord(
  searchParams: Record<string, string | string[] | undefined>,
): GameLocale {
  const serviceLocale = getServiceLocaleFromInternalParam(
    searchParams[INTERNAL_SERVICE_LOCALE_QUERY],
  );
  const requested = searchParams.gl;
  const value = Array.isArray(requested) ? requested[0] : requested;
  if (value && isGameLocale(value)) return value;
  return DEFAULT_GAME_LOCALE_BY_SERVICE[serviceLocale];
}

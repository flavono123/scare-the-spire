export const SERVICE_LOCALES = ["ko", "en"] as const;
export const INTERNAL_SERVICE_LOCALE_QUERY = "_sl";
export const SERVICE_LOCALE_COOKIE = "sts-service-locale";
export const GAME_LOCALE_COOKIE = "sts-game-locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

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

const GAME_LOCALE_PATH_ALIASES = {
  en: "eng",
  eng: "eng",
  zhs: "zhs",
  jpn: "jpn",
  deu: "deu",
  fra: "fra",
  ita: "ita",
  spa: "spa",
  esp: "esp",
  ptb: "ptb",
  rus: "rus",
  pol: "pol",
  tha: "tha",
  tur: "tur",
} as const satisfies Record<string, GameLocale>;

export type GameLocalePathSegment = keyof typeof GAME_LOCALE_PATH_ALIASES;

export const GAME_LOCALE_PATH_SEGMENTS = Object.keys(
  GAME_LOCALE_PATH_ALIASES,
) as GameLocalePathSegment[];

export const DEFAULT_SERVICE_LOCALE: ServiceLocale = "ko";
export const DEFAULT_GAME_LOCALE_BY_SERVICE: Record<ServiceLocale, GameLocale> = {
  ko: "kor",
  en: "eng",
};

export function getServiceLocaleForGameLocale(
  gameLocale: GameLocale,
): ServiceLocale {
  return gameLocale === "kor" ? "ko" : "en";
}

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

export const GAME_LOCALE_NATIVE_LABELS: Record<GameLocale, string> = {
  kor: "한국어",
  eng: "English",
  zhs: "中文",
  jpn: "日本語",
  deu: "Deutsch",
  fra: "Français",
  ita: "Italiano",
  spa: "Español (Castellano)",
  esp: "Español (Latinoamérica)",
  ptb: "Português Brasileiro",
  rus: "Русский",
  pol: "Polski",
  tha: "ไทย",
  tur: "Türkçe",
};

export function isServiceLocale(value: string): value is ServiceLocale {
  return (SERVICE_LOCALES as readonly string[]).includes(value);
}

export function isGameLocale(value: string): value is GameLocale {
  return (GAME_LOCALES as readonly string[]).includes(value);
}

export function gameLocaleFromPathSegment(segment: string | undefined): GameLocale | null {
  if (!segment) return null;
  return GAME_LOCALE_PATH_ALIASES[segment.toLowerCase() as GameLocalePathSegment] ?? null;
}

export function hasGameLocalePathPrefix(pathname: string): boolean {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  return gameLocaleFromPathSegment(firstSegment) !== null;
}

export function getGameLocaleFromPathname(pathname: string): GameLocale {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  return gameLocaleFromPathSegment(firstSegment) ?? DEFAULT_GAME_LOCALE_BY_SERVICE.ko;
}

export function pathPrefixForGameLocale(gameLocale: GameLocale): string {
  if (gameLocale === "kor") return "";
  if (gameLocale === "eng") return "/en";
  return `/${gameLocale}`;
}

export function getServiceLocaleFromPath(pathname: string): ServiceLocale {
  return getServiceLocaleForGameLocale(getGameLocaleFromPathname(pathname));
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

export function stripGameLocaleFromPath(pathname: string): string {
  const normalized = pathname || "/";
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0) return "/";
  if (!gameLocaleFromPathSegment(segments[0])) return normalized;

  const stripped = `/${segments.slice(1).join("/")}`;
  return stripped === "/" ? "/" : stripped.replace(/\/$/, "");
}

export function localizeHref(href: string, locale: ServiceLocale): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;

  const [path, suffix = ""] = href.split(/(?=[?#])/, 2);
  const unprefixed = stripGameLocaleFromPath(stripServiceLocaleFromPath(path));
  const gameLocale = locale === "ko" ? "kor" : "eng";
  const prefix = pathPrefixForGameLocale(gameLocale);
  const localizedPath = prefix
    ? unprefixed === "/" ? prefix : `${prefix}${unprefixed}`
    : unprefixed;

  return `${localizedPath}${suffix}`;
}

export function localizeHrefWithGameLocale(
  href: string,
  serviceLocale: ServiceLocale,
  gameLocale: GameLocale,
): string {
  const localizedHref = localizeHref(href, serviceLocale);
  if (!localizedHref.startsWith("/") || localizedHref.startsWith("//")) {
    return localizedHref;
  }

  const [pathAndSearch, hash = ""] = localizedHref.split("#", 2);
  const [path, search = ""] = pathAndSearch.split("?", 2);
  const searchParams = new URLSearchParams(search);
  const gameSearch = withGameLocaleSearch(searchParams, gameLocale, serviceLocale);
  return `${switchGameLocalePath(path, gameLocale)}${gameSearch}${hash ? `#${hash}` : ""}`;
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

export function switchGameLocalePath(pathname: string, gameLocale: GameLocale): string {
  const unprefixed = stripGameLocaleFromPath(stripServiceLocaleFromPath(pathname));
  const prefix = pathPrefixForGameLocale(gameLocale);
  return prefix
    ? unprefixed === "/" ? prefix : `${prefix}${unprefixed}`
    : unprefixed;
}

export function switchGameLocaleHref(
  pathname: string,
  gameLocale: GameLocale,
  search = "",
): string {
  const localizedPath = switchGameLocalePath(pathname, gameLocale);
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
  void gameLocale;
  void serviceLocale;
  next.delete("gl");

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

export function getServiceLocaleFromSearchRecord(
  searchParams: Record<string, string | string[] | undefined>,
): ServiceLocale {
  return getServiceLocaleFromInternalParam(
    searchParams[INTERNAL_SERVICE_LOCALE_QUERY],
  );
}

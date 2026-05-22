import {
  DEFAULT_GAME_LOCALE_BY_SERVICE,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";

type HeaderReader = Pick<Headers, "get">;

const LATIN_AMERICA_COUNTRIES = new Set([
  "AR",
  "BO",
  "CL",
  "CO",
  "CR",
  "CU",
  "DO",
  "EC",
  "GT",
  "HN",
  "MX",
  "NI",
  "PA",
  "PE",
  "PR",
  "PY",
  "SV",
  "UY",
  "VE",
]);

const COUNTRY_GAME_LOCALES: Partial<Record<string, GameLocale>> = {
  AT: "deu",
  AU: "eng",
  BE: "fra",
  BR: "ptb",
  CA: "eng",
  CH: "deu",
  CN: "zhs",
  DE: "deu",
  ES: "spa",
  FR: "fra",
  GB: "eng",
  HK: "zhs",
  IE: "eng",
  IT: "ita",
  JP: "jpn",
  KR: "kor",
  MX: "esp",
  NZ: "eng",
  PL: "pol",
  PT: "ptb",
  RU: "rus",
  SG: "zhs",
  TH: "tha",
  TR: "tur",
  TW: "zhs",
  US: "eng",
};

for (const country of LATIN_AMERICA_COUNTRIES) {
  COUNTRY_GAME_LOCALES[country] = "esp";
}

function normalizeCountry(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

function countryFromHeaders(headers: HeaderReader): string | null {
  return (
    normalizeCountry(headers.get("x-vercel-ip-country"))
    ?? normalizeCountry(headers.get("cf-ipcountry"))
    ?? normalizeCountry(headers.get("x-country-code"))
    ?? normalizeCountry(headers.get("x-geo-country"))
  );
}

function parseAcceptLanguage(header: string | null): string[] {
  if (!header) return [];

  return header
    .split(",")
    .map((part, index) => {
      const [rawTag, ...params] = part.trim().split(";");
      const qParam = params.find((param) => param.trim().startsWith("q="));
      const q = qParam ? Number(qParam.trim().slice(2)) : 1;
      return {
        tag: rawTag.trim().toLowerCase(),
        q: Number.isFinite(q) ? q : 0,
        index,
      };
    })
    .filter((entry) => entry.tag && entry.q > 0)
    .sort((a, b) => (b.q !== a.q ? b.q - a.q : a.index - b.index))
    .map((entry) => entry.tag);
}

function gameLocaleFromLanguageTag(
  tag: string,
  country: string | null,
): GameLocale | null {
  const normalized = tag.toLowerCase().replace("_", "-");
  const [language, region] = normalized.split("-");
  const upperRegion = region?.toUpperCase() ?? country;

  switch (language) {
    case "ko":
      return "kor";
    case "en":
      return "eng";
    case "zh":
      return "zhs";
    case "ja":
      return "jpn";
    case "de":
      return "deu";
    case "fr":
      return "fra";
    case "it":
      return "ita";
    case "es":
      return upperRegion && LATIN_AMERICA_COUNTRIES.has(upperRegion)
        ? "esp"
        : "spa";
    case "pt":
      return "ptb";
    case "ru":
      return "rus";
    case "pl":
      return "pol";
    case "th":
      return "tha";
    case "tr":
      return "tur";
    default:
      return null;
  }
}

export function detectGameLocaleFromLanguageTags(
  tags: readonly string[],
  country: string | null = null,
): GameLocale | null {
  for (const tag of tags) {
    const gameLocale = gameLocaleFromLanguageTag(tag, country);
    if (gameLocale) return gameLocale;
  }

  return null;
}

export function detectGameLocaleFromNavigator(
  navigatorLike: Pick<Navigator, "language" | "languages">,
): GameLocale {
  const tags = navigatorLike.languages.length > 0
    ? navigatorLike.languages
    : [navigatorLike.language].filter(Boolean);

  return detectGameLocaleFromLanguageTags(tags) ?? DEFAULT_GAME_LOCALE_BY_SERVICE.ko;
}

export function detectGameLocaleFromHeaders(headers: HeaderReader): GameLocale {
  const country = countryFromHeaders(headers);
  const gameLocale = detectGameLocaleFromLanguageTags(
    parseAcceptLanguage(headers.get("accept-language")),
    country,
  );
  if (gameLocale) return gameLocale;

  if (country) {
    return COUNTRY_GAME_LOCALES[country] ?? DEFAULT_GAME_LOCALE_BY_SERVICE.en;
  }

  return DEFAULT_GAME_LOCALE_BY_SERVICE.ko;
}

export function detectServiceLocaleFromGameLocale(
  gameLocale: GameLocale,
): ServiceLocale {
  return gameLocale === "kor" ? "ko" : "en";
}

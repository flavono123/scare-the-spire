import {
  DEFAULT_GAME_LOCALE_BY_SERVICE,
  type GameLocale,
} from "@/lib/i18n";

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

function gameLocaleFromLanguageTag(tag: string): GameLocale | null {
  const normalized = tag.toLowerCase().replace("_", "-");
  const [language, region] = normalized.split("-");
  const upperRegion = region?.toUpperCase() ?? null;

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

export function detectGameLocaleFromLanguageTags(tags: readonly string[]): GameLocale | null {
  for (const tag of tags) {
    const gameLocale = gameLocaleFromLanguageTag(tag);
    if (gameLocale) return gameLocale;
  }

  return null;
}

/*
 * Search and audit crawlers (Googlebot, Google-InspectionTool, bingbot, Naver
 * Yeti, Daum, Yahoo Slurp, DuckDuckBot, Lighthouse, Mediapartners-Google, and
 * generic bot/crawl/spider agents). HeadlessChrome alone is not a crawler.
 */
const SEARCH_CRAWLER_USER_AGENT_PATTERN =
  /bot|crawl|spider|slurp|google-inspectiontool|mediapartners|lighthouse|\byeti\/|\bdaum(?:oa)?\//i;

/** True for crawler user agents, which must keep the requested language page. */
export function isSearchCrawlerUserAgent(userAgent: string | null | undefined): boolean {
  return Boolean(userAgent && SEARCH_CRAWLER_USER_AGENT_PATTERN.test(userAgent));
}

export function detectGameLocaleFromNavigator(
  navigatorLike: Pick<Navigator, "language" | "languages">,
): GameLocale {
  const tags = navigatorLike.languages.length > 0
    ? navigatorLike.languages
    : [navigatorLike.language].filter(Boolean);

  return detectGameLocaleFromLanguageTags(tags) ?? DEFAULT_GAME_LOCALE_BY_SERVICE.ko;
}

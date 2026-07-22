const STATIC_GAME_LOCALE_PREFIXES = new Set([
  "en",
  "zh",
  "ja",
  "de",
  "fr",
  "it",
  "es",
  "es-419",
  "pt",
  "ru",
  "pl",
  "th",
  "tr",
]);

const STATIC_SERVICE_PAGE_SEGMENTS = new Set([
  "byrdispatch",
  "chemical-x",
  "combo",
  "history-course",
  "profile",
  "this-or-that",
]);

const STATIC_LEGACY_PAGE_SEGMENTS = new Set([
  "cards",
  "potions",
  "relics",
]);

const STATIC_COMPENDIUM_SEGMENTS = new Set([
  "ancients",
  "bestiary",
  "cards",
  "characters",
  "enchantments",
  "encounters",
  "epochs",
  "events",
  "keywords",
  "monsters",
  "potions",
  "powers",
  "relics",
]);

export type StaticPageExtension = "html" | "rsc";

export function staticLegacyPageAssetPath(
  pathname: string,
  extension: StaticPageExtension,
): string | null {
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  const parts = normalizedPathname.split("/").filter(Boolean);
  if (parts.length < 1 || parts.length > 2 || !STATIC_LEGACY_PAGE_SEGMENTS.has(parts[0])) {
    return null;
  }

  return `/_cf_static_pages/${parts.join("/")}.${extension}`;
}

export function staticServicePageAssetPath(
  pathname: string,
  extension: StaticPageExtension,
): string | null {
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  const parts = normalizedPathname.split("/").filter(Boolean);
  const pageSegment = parts.at(-1);
  if (!pageSegment || !STATIC_SERVICE_PAGE_SEGMENTS.has(pageSegment)) return null;

  const isDefaultLocalePage = parts.length === 1;
  const isGameLocalePage = parts.length === 2 && STATIC_GAME_LOCALE_PREFIXES.has(parts[0]);
  if (!isDefaultLocalePage && !isGameLocalePage) return null;

  return `/_cf_static_pages/${parts.join("/")}.${extension}`;
}

export function staticCompendiumAssetPath(
  pathname: string,
  extension: StaticPageExtension,
): string | null {
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  const parts = normalizedPathname.split("/").filter(Boolean);
  const compendiumIndex = parts.indexOf("compendium");
  if (compendiumIndex < 0 || compendiumIndex > 1) return null;
  if (compendiumIndex === 1 && !STATIC_GAME_LOCALE_PREFIXES.has(parts[0])) return null;

  const relativeDepth = parts.length - compendiumIndex;
  if (relativeDepth === 1) {
    return `/_cf_static_pages/${parts.join("/")}.${extension}`;
  }

  const segment = parts[compendiumIndex + 1];
  if (!STATIC_COMPENDIUM_SEGMENTS.has(segment)) return null;

  const isIndex = relativeDepth === 2;
  const isDetail = relativeDepth === 3;
  if (!isIndex && !isDetail) return null;

  // Only the two service locales have direct static detail assets. Copying all
  // game-locale details would exceed the Workers Free static-asset limit.
  if (isDetail && compendiumIndex === 1 && parts[0] !== "en") return null;

  return `/_cf_static_pages/${parts.join("/")}.${extension}`;
}

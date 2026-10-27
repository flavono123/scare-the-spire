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
  "c-c-c-combo",
  "contact",
  "defragment",
  "history-course",
  "profile",
  "this-or-that",
  "transfigure",
  "pagestorm",
  "colorful-philosophers",
]);

const STATIC_NESTED_SERVICE_PAGES: ReadonlyArray<readonly [string, string]> = [
  ["pagestorm", "write"],
];

function isNestedStaticServicePage(parts: string[]): boolean {
  const hasLocale = STATIC_GAME_LOCALE_PREFIXES.has(parts[0] ?? "");
  const rest = hasLocale ? parts.slice(1) : parts;
  if (rest.length !== 2) return false;
  return STATIC_NESTED_SERVICE_PAGES.some(
    ([service, nested]) => rest[0] === service && rest[1] === nested,
  );
}

const STATIC_STS1_LEGACY_ALIAS_SEGMENTS = new Set([
  "cards",
  "potions",
  "relics",
]);

const STATIC_STS1_COMPENDIUM_SEGMENTS = new Set([
  ...STATIC_STS1_LEGACY_ALIAS_SEGMENTS,
  "characters",
  "powers",
]);

const STATIC_COMPENDIUM_SEGMENTS = new Set([
  "ancients",
  "badges",
  "bestiary",
  "cards",
  "characters",
  "enchantments",
  "encounters",
  "epochs",
  "events",
  "keywords",
  "modifiers",
  "ascensions",
  "monsters",
  "potions",
  "powers",
  "relics",
]);

export type StaticPageExtension = "html" | "rsc";

export function sts1LegacyAliasPath(pathname: string): string | null {
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  const parts = normalizedPathname.split("/").filter(Boolean);
  if (parts.length < 1 || parts.length > 2 || !STATIC_STS1_LEGACY_ALIAS_SEGMENTS.has(parts[0])) {
    return null;
  }
  return `/compendium/sts1/${parts.join("/")}`;
}

export function sts2CompendiumAliasPath(pathname: string): string | null {
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  const parts = normalizedPathname.split("/").filter(Boolean);
  const compendiumIndex = parts.indexOf("compendium");
  if (compendiumIndex < 0 || compendiumIndex > 1) return null;
  if (compendiumIndex === 1 && !STATIC_GAME_LOCALE_PREFIXES.has(parts[0])) return null;
  if (parts[compendiumIndex + 1] !== "sts2") return null;
  const rewritten = [...parts.slice(0, compendiumIndex + 1), ...parts.slice(compendiumIndex + 2)];
  if (rewritten.length === compendiumIndex + 1) return null;
  return `/${rewritten.join("/")}`;
}

export function staticLegacyPageAssetPath(
  pathname: string,
  extension: StaticPageExtension,
): string | null {
  const alias = sts1LegacyAliasPath(pathname);
  return alias ? staticCompendiumAssetPath(alias, extension) : null;
}

export function staticServicePageAssetPath(
  pathname: string,
  extension: StaticPageExtension,
): string | null {
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  const parts = normalizedPathname.split("/").filter(Boolean);
  if (isNestedStaticServicePage(parts)) {
    return `/_cf_static_pages/${parts.join("/")}.${extension}`;
  }

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
  if (segment === "sts1") {
    const type = parts[compendiumIndex + 2];
    if (!type || !STATIC_STS1_COMPENDIUM_SEGMENTS.has(type)) return null;
    const isIndex = relativeDepth === 3;
    const isDetail = relativeDepth === 4;
    if (!isIndex && !isDetail) return null;
    if (isDetail && compendiumIndex === 1 && parts[0] !== "en") return null;
    return `/_cf_static_pages/${parts.join("/")}.${extension}`;
  }

  if (!STATIC_COMPENDIUM_SEGMENTS.has(segment)) return null;

  const isIndex = relativeDepth === 2;
  const isDetail = relativeDepth === 3;
  if (!isIndex && !isDetail) return null;

  // Only the two service locales have direct static detail assets. Copying all
  // game-locale details would exceed the Workers Free static-asset limit.
  if (isDetail && compendiumIndex === 1 && parts[0] !== "en") return null;

  return `/_cf_static_pages/${parts.join("/")}.${extension}`;
}

export const STATIC_DETAIL_SHELL_SEGMENT = "__id__";

const STATIC_SERVICE_DETAIL_SEGMENTS = new Set([
  "chemical-x",
  "c-c-c-combo",
  "this-or-that",
  "transfigure",
  "history-course",
  "decisions-decisions",
  "pagestorm",
  "colorful-philosophers",
]);

const DEFRAGMENT_FEDERATED_SERVICES = new Set([
  "combo",
  "transfigure",
  "this_or_that",
  "chemical_x",
  "decisions_decisions",
  "favorite_tournament",
  "pagestorm",
  "history_course",
]);

const THIS_OR_THAT_NESTED_SEGMENTS = new Set(["tournament", "worldcup"]);
const PAGESTORM_NESTED_SEGMENTS = new Set(["write"]);

const RECORD_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function isRecordIdSegment(segment: string | undefined): boolean {
  return Boolean(segment && RECORD_ID_PATTERN.test(segment));
}

export function staticServiceDetailShellAssetPath(
  pathname: string,
  extension: StaticPageExtension,
): string | null {
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  const parts = normalizedPathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;

  let localePrefix: string[] = [];
  let rest = parts;
  if (STATIC_GAME_LOCALE_PREFIXES.has(parts[0])) {
    localePrefix = [parts[0]];
    rest = parts.slice(1);
  }

  if (
    rest.length === 3
    && rest[0] === "defragment"
    && DEFRAGMENT_FEDERATED_SERVICES.has(rest[1])
    && isRecordIdSegment(rest[2])
  ) {
    return `/_cf_static_pages/${[
      ...localePrefix,
      "defragment",
      rest[1],
      STATIC_DETAIL_SHELL_SEGMENT,
    ].join("/")}.${extension}`;
  }

  if (
    rest.length === 2
    && rest[0] === "defragment"
    && !DEFRAGMENT_FEDERATED_SERVICES.has(rest[1])
    && isRecordIdSegment(rest[1])
  ) {
    return `/_cf_static_pages/${[
      ...localePrefix,
      "defragment",
      STATIC_DETAIL_SHELL_SEGMENT,
    ].join("/")}.${extension}`;
  }

  if (
    rest.length === 3
    && rest[0] === "this-or-that"
    && rest[1] === "tournament"
    && isRecordIdSegment(rest[2])
  ) {
    return `/_cf_static_pages/${[
      ...localePrefix,
      "this-or-that",
      "tournament",
      STATIC_DETAIL_SHELL_SEGMENT,
    ].join("/")}.${extension}`;
  }

  if (
    rest.length === 2
    && rest[0] === "this-or-that"
    && THIS_OR_THAT_NESTED_SEGMENTS.has(rest[1])
  ) {
    return null;
  }

  if (
    rest.length === 2
    && rest[0] === "pagestorm"
    && PAGESTORM_NESTED_SEGMENTS.has(rest[1])
  ) {
    return null;
  }

  if (
    rest.length === 2
    && STATIC_SERVICE_DETAIL_SEGMENTS.has(rest[0])
    && isRecordIdSegment(rest[1])
  ) {
    return `/_cf_static_pages/${[
      ...localePrefix,
      rest[0],
      STATIC_DETAIL_SHELL_SEGMENT,
    ].join("/")}.${extension}`;
  }

  return null;
}

/**
 * Service pages the Worker took over from the Next runtime. Unlike the older
 * static branches they match only the exact path: a trailing slash keeps the
 * Next-style 308 that production returned before they became static.
 */
export const STATIC_EXACT_SERVICE_PAGES: ReadonlyArray<readonly string[]> = [
  ["decisions-decisions"],
  ["this-or-that", "tournament"],
];

function splitLocalePrefix(pathname: string): { localePrefix: string[]; rest: string[] } {
  const parts = pathname.split("/").filter(Boolean);
  if (STATIC_GAME_LOCALE_PREFIXES.has(parts[0] ?? "")) {
    return { localePrefix: [parts[0]], rest: parts.slice(1) };
  }
  return { localePrefix: [], rest: parts };
}

function isExactRoutePath(pathname: string): boolean {
  return pathname.startsWith("/") && !pathname.endsWith("/") && !pathname.includes("//");
}

export function staticExactServicePageAssetPath(
  pathname: string,
  extension: StaticPageExtension,
): string | null {
  if (!isExactRoutePath(pathname)) return null;
  const { localePrefix, rest } = splitLocalePrefix(pathname);
  const page = STATIC_EXACT_SERVICE_PAGES.find((segments) => (
    segments.length === rest.length && segments.every((segment, index) => rest[index] === segment)
  ));
  if (!page) return null;
  return `/_cf_static_pages/${[...localePrefix, ...page].join("/")}.${extension}`;
}

/** `/this-or-that/worldcup` was a Next `permanentRedirect` page. */
export function legacyWorldcupIndexRedirectPath(pathname: string): string | null {
  if (!isExactRoutePath(pathname)) return null;
  const { localePrefix, rest } = splitLocalePrefix(pathname);
  if (rest.length !== 2 || rest[0] !== "this-or-that" || rest[1] !== "worldcup") return null;
  return `/${[...localePrefix, "this-or-that", "tournament"].join("/")}`;
}

export interface PrerenderedRedirect {
  status: 307 | 308;
  location: string;
}

/**
 * Pages whose prerender is only a Next `redirect()` (307) or
 * `permanentRedirect()` (308). The Worker answers them with the same status
 * and relative Location instead of serving the meta-refresh HTML.
 */
export function prerenderedRedirect(pathname: string): PrerenderedRedirect | null {
  if (pathname === "/dev/pagestorm-editor") {
    return { status: 307, location: "/pagestorm/write" };
  }
  const worldcupIndex = legacyWorldcupIndexRedirectPath(pathname);
  return worldcupIndex ? { status: 308, location: worldcupIndex } : null;
}

export const STATIC_NOT_FOUND_ASSET_BASENAME = "404";

export function staticNotFoundAssetPath(extension: StaticPageExtension): string {
  return `/_cf_static_pages/${STATIC_NOT_FOUND_ASSET_BASENAME}.${extension}`;
}

export function legacyWorldcupDetailRedirectPath(pathname: string): string | null {
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  const parts = normalizedPathname.split("/").filter(Boolean);
  if (parts.length < 3) return null;

  let localePrefix: string[] = [];
  let rest = parts;
  if (STATIC_GAME_LOCALE_PREFIXES.has(parts[0])) {
    localePrefix = [parts[0]];
    rest = parts.slice(1);
  }

  if (
    rest.length === 3
    && rest[0] === "this-or-that"
    && rest[1] === "worldcup"
    && isRecordIdSegment(rest[2])
  ) {
    return `/${[...localePrefix, "this-or-that", "tournament", rest[2]].join("/")}`;
  }

  return null;
}

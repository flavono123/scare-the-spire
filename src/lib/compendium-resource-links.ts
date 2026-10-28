import { pathPrefixForGameLocale, type GameLocale } from "@/lib/i18n";

export type CompendiumResourceLinkType =
  | "affliction"
  | "ancient"
  | "badge"
  | "card"
  | "character"
  | "enchantment"
  | "encounter"
  | "epoch"
  | "event"
  | "keyword"
  | "monster"
  | "potion"
  | "power"
  | "relic"
  | "modifier"
  | "ascension";

type LinkConfig = {
  path: string;
  detailPath: string;
  param: string;
  search?: Record<string, string>;
};

const COMPENDIUM_RESOURCE_LINKS: Record<CompendiumResourceLinkType, LinkConfig> = {
  affliction: { path: "/compendium/enchantments", detailPath: "/compendium/enchantments", param: "affliction" },
  ancient: { path: "/compendium/ancients", detailPath: "/compendium/ancients", param: "ancient" },
  badge: { path: "/compendium/badges", detailPath: "/compendium/badges", param: "badge" },
  card: { path: "/compendium/cards", detailPath: "/compendium/cards", param: "card" },
  character: { path: "/compendium/characters", detailPath: "/compendium/characters", param: "character" },
  enchantment: { path: "/compendium/enchantments", detailPath: "/compendium/enchantments", param: "enchantment" },
  encounter: { path: "/compendium/bestiary", detailPath: "/compendium/encounters", param: "encounter", search: { view: "encounters" } },
  epoch: { path: "/compendium/epochs", detailPath: "/compendium/epochs", param: "epoch" },
  event: { path: "/compendium/events", detailPath: "/compendium/events", param: "event" },
  keyword: { path: "/compendium/keywords", detailPath: "/compendium/keywords", param: "keyword" },
  monster: { path: "/compendium/bestiary", detailPath: "/compendium/monsters", param: "monster" },
  potion: { path: "/compendium/potions", detailPath: "/compendium/potions", param: "potion" },
  power: { path: "/compendium/powers", detailPath: "/compendium/powers", param: "power" },
  relic: { path: "/compendium/relics", detailPath: "/compendium/relics", param: "relic" },
  modifier: { path: "/compendium/modifiers", detailPath: "/compendium/modifiers", param: "modifier" },
  ascension: { path: "/compendium/ascensions", detailPath: "/compendium/ascensions", param: "ascension" },
};

const COMPENDIUM_SELECTOR_PARAMS = new Set(
  Object.values(COMPENDIUM_RESOURCE_LINKS).map(({ param }) => param),
);

function localizedCompendiumPath(pathname: string): {
  localePrefix: string;
  path: string;
} | null {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const parts = normalized.split("/").filter(Boolean);
  const compendiumIndex = parts.indexOf("compendium");
  if (compendiumIndex < 0 || compendiumIndex > 1) return null;

  return {
    localePrefix: compendiumIndex === 1 ? `/${parts[0]}` : "",
    path: `/${parts.slice(compendiumIndex).join("/")}`,
  };
}

function supportsDirectCompendiumDetails(localePrefix: string): boolean {
  return localePrefix === "" || localePrefix === "/en";
}

export function isCompendiumResourceLinkType(
  value: string,
): value is CompendiumResourceLinkType {
  return Object.hasOwn(COMPENDIUM_RESOURCE_LINKS, value);
}

export function buildCompendiumResourceHref(
  type: CompendiumResourceLinkType,
  id: string,
): string {
  const config = COMPENDIUM_RESOURCE_LINKS[type];
  const params = new URLSearchParams(config.search);
  params.set(config.param, id.toLowerCase());
  return `${config.path}?${params.toString()}`;
}

export function buildCompendiumResourceDetailHref(
  type: CompendiumResourceLinkType,
  id: string,
): string {
  const config = COMPENDIUM_RESOURCE_LINKS[type];
  return `${config.detailPath}/${encodeURIComponent(id.toLowerCase())}`;
}

export function getCompendiumResourceIdFromUrl(
  url: URL,
  type: CompendiumResourceLinkType,
): string | null {
  const config = COMPENDIUM_RESOURCE_LINKS[type];
  const queryId = url.searchParams.get(config.param);
  if (queryId) return queryId;

  const localized = localizedCompendiumPath(url.pathname);
  if (!localized) return null;
  return detailIdFromPath(localized.path, config.detailPath);
}

function detailIdFromPath(path: string, detailPath: string): string | null {
  const detailPrefix = `${detailPath}/`;
  if (!path.startsWith(detailPrefix)) return null;

  const encodedId = path.slice(detailPrefix.length);
  if (!encodedId || encodedId.includes("/")) return null;
  try {
    return decodeURIComponent(encodedId);
  } catch {
    return null;
  }
}

export function getCompendiumResourceIdForSearchParam(
  url: URL,
  paramName: string,
): string | null {
  const entry = Object.entries(COMPENDIUM_RESOURCE_LINKS).find(
    ([, config]) => config.param === paramName,
  );
  return entry
    ? getCompendiumResourceIdFromUrl(url, entry[0] as CompendiumResourceLinkType)
    : url.searchParams.get(paramName);
}

export function updateCompendiumResourceModalUrl(
  url: URL,
  type: CompendiumResourceLinkType,
  id: string | null,
): URL {
  const config = COMPENDIUM_RESOURCE_LINKS[type];
  const localized = localizedCompendiumPath(url.pathname);
  const localePrefix = localized?.localePrefix ?? "";

  if (supportsDirectCompendiumDetails(localePrefix)) {
    const preserved = ["version", "beta"].flatMap((key) => {
      const value = url.searchParams.get(key);
      return value ? [[key, value] as const] : [];
    });
    url.pathname = id
      ? `${localePrefix}${buildCompendiumResourceDetailHref(type, id)}`
      : `${localePrefix}${config.path}`;
    url.search = "";
    if (!id && config.search) {
      url.search = new URLSearchParams(config.search).toString();
    }
    for (const [key, value] of preserved) url.searchParams.set(key, value);
  } else {
    url.pathname = `${localePrefix}${config.path}`;
    for (const param of COMPENDIUM_SELECTOR_PARAMS) {
      url.searchParams.delete(param);
    }
    if (config.search) {
      for (const [key, value] of Object.entries(config.search)) {
        url.searchParams.set(key, value);
      }
    }
    if (id) url.searchParams.set(config.param, id.toLowerCase());
  }

  url.hash = "";
  return url;
}

/**
 * The link an entry gets on a Compendium list page: its detail page where one
 * is published (Korean and English), otherwise the list's modal URL.
 */
export function buildCompendiumEntryHref(
  type: CompendiumResourceLinkType,
  id: string,
  gameLocale: GameLocale,
): string {
  const listPath = `${pathPrefixForGameLocale(gameLocale)}${COMPENDIUM_RESOURCE_LINKS[type].path}`;
  const url = updateCompendiumResourceModalUrl(new URL(listPath, "https://compendium.invalid"), type, id);
  return `${url.pathname}${url.search}`;
}

// STS1 list pages and the query param each one opens an entry with. The STS1
// character select has no such param, so its fallback is the plain list.
const STS1_LIST_SELECTOR_PARAMS: Record<string, string | null> = {
  cards: "card",
  characters: null,
  potions: "potion",
  powers: "power",
  relics: "relic",
};

/**
 * Game-only locales publish no Compendium detail pages, so a Korean or English
 * detail path moved onto one of them (language menu, browser-language
 * detection, saved-language redirect) would 404. Returns the list URL that
 * opens the same entry instead, or null when `href` is not a detail path on a
 * game-only locale. Enchantment and affliction details share one path, so it
 * maps to ?enchantment=<id>&affliction=<id>: the list opens the enchantment
 * when one has that id, otherwise the affliction.
 */
export function getGameOnlyCompendiumDetailFallbackHref(href: string): string | null {
  const url = new URL(href, "https://compendium.invalid");
  const localized = localizedCompendiumPath(url.pathname);
  if (!localized || supportsDirectCompendiumDetails(localized.localePrefix)) return null;

  const sts1Match = /^\/compendium\/sts1\/([^/]+)\/[^/]+$/.exec(localized.path);
  if (sts1Match) {
    const listType = sts1Match[1];
    if (!Object.hasOwn(STS1_LIST_SELECTOR_PARAMS, listType)) return null;
    const id = detailIdFromPath(localized.path, `/compendium/sts1/${listType}`);
    if (!id) return null;
    url.pathname = `${localized.localePrefix}/compendium/sts1/${listType}`;
    for (const param of COMPENDIUM_SELECTOR_PARAMS) url.searchParams.delete(param);
    const param = STS1_LIST_SELECTOR_PARAMS[listType];
    if (param) url.searchParams.set(param, id.toLowerCase());
    return `${url.pathname}${url.search}`;
  }

  for (const [type, config] of Object.entries(COMPENDIUM_RESOURCE_LINKS)) {
    if (type === "affliction") continue;
    const id = detailIdFromPath(localized.path, config.detailPath);
    if (!id) continue;
    const next = updateCompendiumResourceModalUrl(url, type as CompendiumResourceLinkType, id);
    if (type === "enchantment") {
      next.searchParams.set(COMPENDIUM_RESOURCE_LINKS.affliction.param, id.toLowerCase());
    }
    return `${next.pathname}${next.search}`;
  }

  return null;
}

export function getLegacyCompendiumDetailRedirectPath(url: URL): string | null {
  const localized = localizedCompendiumPath(url.pathname);
  if (!localized || !supportsDirectCompendiumDetails(localized.localePrefix)) return null;

  for (const [type, config] of Object.entries(COMPENDIUM_RESOURCE_LINKS)) {
    if (localized.path !== config.path) continue;
    const id = url.searchParams.get(config.param);
    if (!id) continue;
    return `${localized.localePrefix}${buildCompendiumResourceDetailHref(
      type as CompendiumResourceLinkType,
      id,
    )}`;
  }

  return null;
}

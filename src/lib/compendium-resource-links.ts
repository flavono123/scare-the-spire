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
  const detailPrefix = `${config.detailPath}/`;
  if (!localized.path.startsWith(detailPrefix)) return null;

  const encodedId = localized.path.slice(detailPrefix.length);
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
    url.pathname = id
      ? `${localePrefix}${buildCompendiumResourceDetailHref(type, id)}`
      : `${localePrefix}${config.path}`;
    url.search = "";
    if (!id && config.search) {
      url.search = new URLSearchParams(config.search).toString();
    }
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

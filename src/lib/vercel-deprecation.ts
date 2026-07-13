const LEGACY_PRODUCTION_HOST = "scare-the-spire.vercel.app";
const MIGRATION_TARGET_ORIGIN = "https://scare-the-spire.flavono123.workers.dev";
const MIGRATION_START_AT = Date.parse("2026-07-16T00:00:00+09:00");

const GAME_LOCALE_PATH_SEGMENTS = new Set([
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

const EXACT_PAGE_ROOTS = new Set(["byrdispatch", "profile", "sha-news"]);
const DETAIL_PAGE_ROOTS = new Set([
  "cards",
  "chemical-x",
  "history-course",
  "patches",
  "potions",
  "relics",
]);
const COMPENDIUM_RESOURCES = new Set([
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
const COMPENDIUM_DETAIL_RESOURCES = new Set(
  [...COMPENDIUM_RESOURCES].filter((resource) => resource !== "bestiary"),
);

function stripGameLocalePathSegment(segments: string[]): string[] {
  if (!GAME_LOCALE_PATH_SEGMENTS.has(segments[0] ?? "")) return segments;
  return segments.slice(1);
}

function isCompendiumPath(segments: string[]): boolean {
  if (segments.length === 1) return true;
  if (segments.length === 2) return COMPENDIUM_RESOURCES.has(segments[1]);
  return segments.length === 3 && COMPENDIUM_DETAIL_RESOURCES.has(segments[1]);
}

export function isLegacyPublicPagePath(pathname: string): boolean {
  const segments = stripGameLocalePathSegment(pathname.split("/").filter(Boolean));
  if (segments.length === 0) return true;

  const [root] = segments;
  if (EXACT_PAGE_ROOTS.has(root)) return segments.length === 1;
  if (DETAIL_PAGE_ROOTS.has(root)) return segments.length <= 2;
  if (root === "compendium" || root === "_codex") return isCompendiumPath(segments);
  return false;
}

export function shouldRedirectLegacyPage({
  hostname,
  method,
  pathname,
  now = Date.now(),
}: {
  hostname: string;
  method: string;
  pathname: string;
  now?: number;
}): boolean {
  return (
    hostname.toLowerCase() === LEGACY_PRODUCTION_HOST
    && (method === "GET" || method === "HEAD")
    && now >= MIGRATION_START_AT
    && isLegacyPublicPagePath(pathname)
  );
}

export function buildMigrationDestination(pathname: string, search: string): URL {
  const destination = new URL(pathname, MIGRATION_TARGET_ORIGIN);
  destination.search = search;
  return destination;
}

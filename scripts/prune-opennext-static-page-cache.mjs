import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STATIC_PAGES_DIR = path.join(".open-next", "assets", "_cf_static_pages");
const CACHE_DIR = path.join(".open-next", "cache");
const ASSET_CACHE_DIR = path.join(".open-next", "assets", "cdn-cgi", "_next_cache");
const DEFAULT_HANDLER_PATH = path.join(".open-next", "server-functions", "default", "handler.mjs");

function walkFiles(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

/** `_cf_static_pages/compendium/cards/bash.html` → `compendium/cards/bash` */
export function routeKeyFromStaticPage(relativePath) {
  return toPosix(relativePath).replace(/\.(html|rsc)$/i, "");
}

/**
 * Path relative to `.open-next/cache`.
 * `BUILDID/compendium/cards/bash.cache` → `compendium/cards/bash`.
 * Fetch-cache files are not page routes.
 */
export function routeKeyFromCacheFile(relativePath) {
  const posix = toPosix(relativePath);
  if (posix.startsWith("__fetch/") || posix.includes("/__fetch/")) return null;
  if (!posix.endsWith(".cache")) return null;
  const withoutExt = posix.slice(0, -".cache".length);
  const slash = withoutExt.indexOf("/");
  if (slash < 0) return null;
  return withoutExt.slice(slash + 1);
}

export function staticPageRouteKeys(staticPagesDir) {
  const keys = new Set();
  for (const file of walkFiles(staticPagesDir)) {
    const relative = path.relative(staticPagesDir, file);
    if (!/\.(html|rsc)$/i.test(relative)) continue;
    keys.add(routeKeyFromStaticPage(relative));
  }
  return keys;
}

export function pruneOpenNextStaticPageCache({
  cacheDir = CACHE_DIR,
  staticPagesDir = STATIC_PAGES_DIR,
  assetCacheDir = ASSET_CACHE_DIR,
  syncAssets = true,
} = {}) {
  if (!existsSync(staticPagesDir) || !statSync(staticPagesDir).isDirectory()) {
    throw new Error(
      `Missing ${staticPagesDir}. Run copy-cf-static-pages before pruning OpenNext cache.`,
    );
  }
  if (!existsSync(cacheDir) || !statSync(cacheDir).isDirectory()) {
    throw new Error(`Missing ${cacheDir}. Run opennextjs-cloudflare build first.`);
  }

  const staticKeys = staticPageRouteKeys(staticPagesDir);
  let pruned = 0;
  let kept = 0;

  for (const file of walkFiles(cacheDir)) {
    const relative = path.relative(cacheDir, file);
    const routeKey = routeKeyFromCacheFile(relative);
    if (!routeKey) {
      kept += 1;
      continue;
    }
    if (staticKeys.has(routeKey)) {
      rmSync(file);
      pruned += 1;
    } else {
      kept += 1;
    }
  }

  if (syncAssets) {
    rmSync(assetCacheDir, { recursive: true, force: true });
    mkdirSync(path.dirname(assetCacheDir), { recursive: true });
    cpSync(cacheDir, assetCacheDir, { recursive: true });
  }

  return { pruned, kept, staticRoutes: staticKeys.size };
}

/**
 * Keep in sync with `isPatchWorkerPath` in `workers/main-worker.ts`.
 * Patch paths are served by the patch Worker and never reach OpenNext.
 */
export function isPatchWorkerManifestPath(pathname) {
  if (pathname === "/dev" || pathname.startsWith("/dev/")) return false;
  return (
    pathname === "/patches" ||
    pathname.startsWith("/patches/") ||
    pathname === "/_patches" ||
    pathname.startsWith("/_patches/") ||
    pathname.startsWith("/images/neowsletters/") ||
    /^\/[^/]+\/patches(?:\/|$)/.test(pathname)
  );
}

/** `index` → `/`, `en` → `/en`, `compendium/cards/bash` → `/compendium/cards/bash`. */
export function manifestPathFromStaticRouteKey(routeKey) {
  return routeKey === "index" ? "/" : `/${routeKey}`;
}

function matchClosingBracket(code, openAt) {
  const open = code[openAt];
  if (open !== "{" && open !== "[") return -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = openAt; index < code.length; index += 1) {
    const char = code[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === "\"") inString = false;
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{" || char === "[") depth += 1;
    else if (char === "}" || char === "]") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/**
 * Prerender manifests are inlined as `routes:{...},dynamicRoutes:`.
 * The handler also contains an earlier empty stub, `routes:{},dynamicRoutes:{}`,
 * which must not hide the real table.
 */
function findPrerenderRouteTables(code) {
  const tables = [];
  const marker = "routes:{";
  let from = 0;
  while (from < code.length) {
    const start = code.indexOf(marker, from);
    if (start === -1) break;
    const braceAt = start + "routes:".length;
    const end = matchClosingBracket(code, braceAt);
    if (end !== -1 && code.startsWith(",dynamicRoutes:", end + 1)) {
      tables.push({ braceAt, end });
    }
    from = start + marker.length;
  }
  return tables;
}

function splitPrerenderRouteEntries(body) {
  const entries = [];
  let index = 0;
  while (index < body.length) {
    while (index < body.length && (body[index] === "," || body[index] === " " || body[index] === "\n")) {
      index += 1;
    }
    if (index >= body.length) break;
    if (body[index] !== "\"") {
      throw new Error("OpenNext prerender route key is not a string.");
    }
    const keyStart = index;
    const keyEnd = matchClosingQuote(body, index);
    if (keyEnd === -1) throw new Error("OpenNext prerender route key is unterminated.");
    const key = JSON.parse(body.slice(keyStart, keyEnd + 1));
    index = keyEnd + 1;
    while (index < body.length && body[index] === " ") index += 1;
    if (body[index] !== ":") throw new Error(`OpenNext prerender route ${key} is missing a value.`);
    index += 1;
    while (index < body.length && body[index] === " ") index += 1;
    if (body[index] !== "{") {
      throw new Error(`OpenNext prerender route ${key} value is not an object.`);
    }
    const valueEnd = matchClosingBracket(body, index);
    if (valueEnd === -1) throw new Error(`OpenNext prerender route ${key} value is unterminated.`);
    entries.push({ key, source: body.slice(keyStart, valueEnd + 1) });
    index = valueEnd + 1;
  }
  return entries;
}

function matchClosingQuote(code, quoteAt) {
  let escaped = false;
  for (let index = quoteAt + 1; index < code.length; index += 1) {
    const char = code[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") return index;
  }
  return -1;
}

function staticManifestPaths(staticPagesDir) {
  const paths = new Set();
  for (const routeKey of staticPageRouteKeys(staticPagesDir)) {
    paths.add(manifestPathFromStaticRouteKey(routeKey));
  }
  return paths;
}

/**
 * Drop prerender manifest entries the main Worker never sends to OpenNext.
 * Static pages are served from `_cf_static_pages`. Patch pages go to the patch
 * Worker. Entries that still fall through (dev pages, uncopied locales) stay.
 */
export function pruneOpenNextHandlerRoutes(
  handlerPath = DEFAULT_HANDLER_PATH,
  { staticPagesDir = STATIC_PAGES_DIR } = {},
) {
  if (!existsSync(handlerPath)) {
    throw new Error(`Missing ${handlerPath}. Run opennextjs-cloudflare build first.`);
  }
  if (!existsSync(staticPagesDir)) {
    throw new Error(`Missing ${staticPagesDir}. Run copy-cf-static-pages before pruning the handler.`);
  }
  const staticPaths = staticManifestPaths(staticPagesDir);
  if (staticPaths.size === 0) {
    throw new Error(`No static pages in ${staticPagesDir}; refusing to prune the prerender manifest.`);
  }

  const code = readFileSync(handlerPath, "utf8");
  const tables = findPrerenderRouteTables(code);
  if (tables.length === 0) {
    throw new Error(
      "OpenNext handler has no prerender routes table (routes:{...},dynamicRoutes:).",
    );
  }

  let removedRoutes = 0;
  let removedBytes = 0;
  let keptRoutes = 0;
  const replacements = [];

  for (const table of tables) {
    const literal = code.slice(table.braceAt, table.end + 1);
    if (literal === "{}") continue;
    const entries = splitPrerenderRouteEntries(code.slice(table.braceAt + 1, table.end));
    const kept = [];
    for (const entry of entries) {
      if (staticPaths.has(entry.key) || isPatchWorkerManifestPath(entry.key)) {
        removedRoutes += 1;
      } else {
        kept.push(entry.source);
        keptRoutes += 1;
      }
    }
    const next = `{${kept.join(",")}}`;
    if (next === literal) continue;
    removedBytes += literal.length - next.length;
    replacements.push({ start: table.braceAt, end: table.end + 1, next });
  }

  if (removedRoutes === 0) {
    const largestTableBytes = tables.reduce(
      (max, table) => Math.max(max, table.end - table.braceAt),
      0,
    );
    if (largestTableBytes > 256 * 1024) {
      throw new Error(
        `OpenNext prerender routes table is still ${largestTableBytes} bytes and no static or patch routes were removed.`,
      );
    }
  }

  if (replacements.length > 0) {
    let pruned = code;
    for (const replacement of replacements.reverse()) {
      pruned = pruned.slice(0, replacement.start) + replacement.next + pruned.slice(replacement.end);
    }
    writeFileSync(handlerPath, pruned, "utf8");
  }

  return { removedRoutes, removedBytes, keptRoutes };
}

const isMain = path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url);
if (isMain) {
  const result = pruneOpenNextStaticPageCache();
  console.log(
    `Pruned ${result.pruned} OpenNext cache file(s) that duplicate _cf_static_pages (${result.staticRoutes} static routes). Kept ${result.kept}.`,
  );
  const handlerPruned = pruneOpenNextHandlerRoutes();
  if (handlerPruned.removedRoutes > 0) {
    console.log(
      `Pruned ${handlerPruned.removedRoutes} static or patch prerender route(s) from OpenNext handler (${handlerPruned.removedBytes} bytes). Kept ${handlerPruned.keptRoutes}.`,
    );
  } else {
    console.log(
      `OpenNext handler prerender routes already omit static and patch pages (${handlerPruned.keptRoutes} kept).`,
    );
  }
}

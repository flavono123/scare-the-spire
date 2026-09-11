import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STATIC_PAGES_DIR = path.join(".open-next", "assets", "_cf_static_pages");
const CACHE_DIR = path.join(".open-next", "cache");
const ASSET_CACHE_DIR = path.join(".open-next", "assets", "cdn-cgi", "_next_cache");

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

const isMain = path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url);
if (isMain) {
  const result = pruneOpenNextStaticPageCache();
  console.log(
    `Pruned ${result.pruned} OpenNext cache file(s) that duplicate _cf_static_pages (${result.staticRoutes} static routes). Kept ${result.kept}.`,
  );
}

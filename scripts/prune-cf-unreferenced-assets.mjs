/**
 * Runs after `copy-cf-static-pages.mjs` on the main Worker asset directory.
 *
 * 1. Drops `/_next/static` files that no served file can reach. `next build`
 *    also emits client chunks for route handlers, dev pages, patch pages (the
 *    patch Worker serves those), redirect-only pages, and the Pages Router
 *    runtime; no HTML, RSC payload, or reachable chunk loads them. Reachability
 *    starts from every non-`_next` text asset and follows full chunk paths plus
 *    the content hashes in the webpack runtime's async chunk map.
 * 2. Fails when a served file references a public file that
 *    `cloudflare-asset-excludes.mjs` keeps out of the upload.
 */
import { readdirSync, readFileSync, rmdirSync, rmSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { CLOUDFLARE_ASSETS_DIR } from "./cloudflare-assets-dir.mjs";
import { publicAssetExcludeReason } from "./cloudflare-asset-excludes.mjs";

const TEXT_ASSET = /\.(html|rsc|js|mjs|css|json|txt|xml|webmanifest|atlas|svg)$/;
const NEXT_STATIC_PATH = /static\/(?:chunks|css|media)\/[A-Za-z0-9_%[\]().@+~-]+(?:\/[A-Za-z0-9_%[\]().@+~-]+)*\.(?:js|css|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|avif|ico)/g;
const CONTENT_HASH = /[0-9a-f]{16}/g;
const PUBLIC_ASSET_PATH = /\/(?:images|fonts|spine|audio|generated)\/[^\s"'`()<>\\?#]+/g;

function walkFiles(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(fullPath, files);
    else files.push(fullPath);
  }
  return files;
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function removeEmptyDirs(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) removeEmptyDirs(path.join(dir, entry.name));
  }
  if (readdirSync(dir).length === 0) rmdirSync(dir);
}

function safeDecode(value) {
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
}

/**
 * Lists `_next/static` files unreachable from the served text assets.
 * @param {string} assetsDir
 * @returns {{ total: number, reachable: string[], unreachable: string[] }}
 */
export function findUnreachableNextStatic(assetsDir) {
  const nextStaticDir = path.join(assetsDir, "_next", "static");
  const nextFiles = walkFiles(nextStaticDir).map((file) => toPosix(path.relative(assetsDir, file)));

  // Each file answers to its path below /_next/ ("static/chunks/...") and, for
  // hashed names, to its content hash (the async chunk map keys on id + hash).
  // CSS files are named by the bare hash ("static/css/<hash>.css"); with two
  // or more async CSS chunks the runtime writes only `{id:hash}` for them.
  const byToken = new Map();
  const addToken = (token, file) => {
    const files = byToken.get(token) ?? [];
    files.push(file);
    byToken.set(token, files);
  };
  for (const file of nextFiles) {
    addToken(file.slice("_next/".length), file);
    const hash = path.basename(file).match(/(?:^|[-.])([0-9a-f]{16})\.[a-z0-9]+$/);
    if (hash) addToken(hash[1], file);
  }

  const reachable = new Set();
  const queue = [];
  const mark = (token) => {
    for (const file of byToken.get(token) ?? []) {
      if (reachable.has(file)) continue;
      reachable.add(file);
      queue.push(file);
    }
  };
  const scanPaths = (text) => {
    for (const match of text.matchAll(NEXT_STATIC_PATH)) {
      mark(match[0]);
      mark(safeDecode(match[0]));
    }
  };

  let seedCount = 0;
  for (const file of walkFiles(assetsDir)) {
    const relativePath = toPosix(path.relative(assetsDir, file));
    if (relativePath.startsWith("_next/")) continue;
    if (!TEXT_ASSET.test(relativePath) && relativePath !== "_headers") continue;
    scanPaths(readFileSync(file, "utf8"));
    seedCount += 1;
  }

  while (queue.length > 0) {
    const file = queue.shift();
    if (!/\.(js|css)$/.test(file)) continue;
    const text = readFileSync(path.join(assetsDir, file), "utf8");
    scanPaths(text);
    for (const match of text.matchAll(CONTENT_HASH)) mark(match[0]);
  }

  const reachableList = [...reachable].sort();
  for (const required of ["_next/static/chunks/webpack-", "_next/static/chunks/main-app-"]) {
    if (!reachableList.some((file) => file.startsWith(required))) {
      throw new Error(
        `No served page reaches ${required}*.js (${seedCount} seed file(s)); `
        + "refusing to prune _next/static. Run copy-cf-static-pages.mjs first.",
      );
    }
  }

  return {
    total: nextFiles.length,
    reachable: reachableList,
    unreachable: nextFiles.filter((file) => !reachable.has(file)).sort(),
  };
}

/**
 * Lists excluded public files that a served text asset references by path.
 * @param {string} assetsDir
 * @param {string} publicDir
 * @returns {{ excluded: string[], referenced: Array<{ asset: string, from: string }> }}
 */
export function findReferencedExcludedAssets(assetsDir, publicDir) {
  const excluded = walkFiles(publicDir)
    .map((file) => toPosix(path.relative(publicDir, file)))
    .filter((relativePath) => publicAssetExcludeReason(relativePath, publicDir));
  const excludedPaths = new Set(excluded.map((relativePath) => `/${relativePath}`));
  const referenced = [];
  if (excludedPaths.size === 0) return { excluded, referenced };

  for (const file of walkFiles(assetsDir)) {
    const relativePath = toPosix(path.relative(assetsDir, file));
    if (!TEXT_ASSET.test(relativePath)) continue;
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(PUBLIC_ASSET_PATH)) {
      const assetPath = safeDecode(match[0]);
      if (excludedPaths.has(assetPath)) referenced.push({ asset: assetPath, from: relativePath });
    }
  }
  return { excluded, referenced };
}

function main() {
  const assetsDir = CLOUDFLARE_ASSETS_DIR;
  const publicDir = "public";

  const { excluded, referenced } = findReferencedExcludedAssets(assetsDir, publicDir);
  if (referenced.length > 0) {
    const lines = referenced.slice(0, 20).map(({ asset, from }) => `  ${asset} <- ${from}`);
    throw new Error(
      "Served files reference public files that scripts/cloudflare-asset-excludes.mjs keeps out "
      + `of the upload. Remove those entries before using the files:\n${lines.join("\n")}`,
    );
  }

  const { total, unreachable } = findUnreachableNextStatic(assetsDir);
  for (const file of unreachable) rmSync(path.join(assetsDir, file));
  removeEmptyDirs(path.join(assetsDir, "_next", "static"));

  console.log(
    `Pruned ${unreachable.length} unreachable /_next/static file(s); kept ${total - unreachable.length}/${total}.`,
  );
  console.log(`Verified ${excluded.length} excluded public file(s) are not referenced by served assets.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}

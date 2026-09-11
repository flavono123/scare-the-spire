import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  pruneOpenNextStaticPageCache,
  routeKeyFromCacheFile,
  routeKeyFromStaticPage,
} from "./prune-opennext-static-page-cache.mjs";

assert.equal(routeKeyFromStaticPage("compendium/cards/bash.html"), "compendium/cards/bash");
assert.equal(routeKeyFromStaticPage("en/compendium/sts1/relics/burning-blood.rsc"), "en/compendium/sts1/relics/burning-blood");
assert.equal(routeKeyFromStaticPage("index.html"), "index");
assert.equal(routeKeyFromStaticPage("history-course/__id__.html"), "history-course/__id__");

assert.equal(
  routeKeyFromCacheFile("BUILDID/compendium/cards/bash.cache"),
  "compendium/cards/bash",
);
assert.equal(
  routeKeyFromCacheFile("BUILDID/zh/compendium/cards/bash.cache"),
  "zh/compendium/cards/bash",
);
assert.equal(routeKeyFromCacheFile("__fetch/BUILDID/data"), null);
assert.equal(routeKeyFromCacheFile("BUILDID/__fetch/data.cache"), null);

const root = mkdtempSync(path.join(os.tmpdir(), "prune-opennext-cache-"));
const staticPagesDir = path.join(root, "_cf_static_pages");
const cacheDir = path.join(root, "cache");
const assetCacheDir = path.join(root, "assets", "cdn-cgi", "_next_cache");
const buildId = "test-build";

function write(file: string, contents = "x") {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, contents);
}

write(path.join(staticPagesDir, "compendium/cards/bash.html"));
write(path.join(staticPagesDir, "compendium/cards/bash.rsc"));
write(path.join(staticPagesDir, "index.html"));
write(path.join(cacheDir, buildId, "compendium/cards/bash.cache"), "static-dup");
write(path.join(cacheDir, buildId, "index.cache"), "home-dup");
write(path.join(cacheDir, buildId, "zh/compendium/cards/bash.cache"), "keep-game-locale");
write(path.join(cacheDir, "__fetch", buildId, "payload"), "keep-fetch");

const result = pruneOpenNextStaticPageCache({
  cacheDir,
  staticPagesDir,
  assetCacheDir,
  syncAssets: true,
});

assert.equal(result.pruned, 2);
assert.equal(result.kept, 2);
assert.equal(existsSync(path.join(cacheDir, buildId, "compendium/cards/bash.cache")), false);
assert.equal(existsSync(path.join(cacheDir, buildId, "index.cache")), false);
assert.equal(
  readFileSync(path.join(cacheDir, buildId, "zh/compendium/cards/bash.cache"), "utf8"),
  "keep-game-locale",
);
assert.equal(
  readFileSync(path.join(assetCacheDir, buildId, "zh/compendium/cards/bash.cache"), "utf8"),
  "keep-game-locale",
);
assert.equal(existsSync(path.join(assetCacheDir, buildId, "compendium/cards/bash.cache")), false);
assert.equal(
  readFileSync(path.join(assetCacheDir, "__fetch", buildId, "payload"), "utf8"),
  "keep-fetch",
);

console.log("prune-opennext-static-page-cache.spec.ts ok");

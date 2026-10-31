/**
 * Builds the main Worker's static asset directory from a finished
 * `next build`: `public/**` at the root, `.next/static/**` at
 * `/_next/static/**`, and `BUILD_ID` (the deployed build marker).
 * Public files matched by `cloudflare-asset-excludes.mjs` stay out.
 * `copy-cf-static-pages.mjs` then adds the prerendered pages, and
 * `prune-cf-unreferenced-assets.mjs` drops unreachable Next chunks.
 */
import { copyFileSync, cpSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";

import { BUILD_RECORD_FILE } from "./build-record.mjs";
import { CLOUDFLARE_ASSETS_DIR, CLOUDFLARE_BUILD_DIR } from "./cloudflare-assets-dir.mjs";
import {
  assertUnusedPublicSourcesExist,
  publicAssetExcludeReason,
} from "./cloudflare-asset-excludes.mjs";

const publicDir = "public";
const nextStaticDir = path.join(".next", "static");
const buildIdFile = path.join(".next", "BUILD_ID");

function countFiles(dir) {
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    count += entry.isDirectory() ? countFiles(path.join(dir, entry.name)) : 1;
  }
  return count;
}

for (const [label, target, isDirectory] of [
  ["public directory", publicDir, true],
  ["Next static output", nextStaticDir, true],
  ["Next build id", buildIdFile, false],
]) {
  const stat = statSync(target, { throwIfNoEntry: false });
  if (!stat || stat.isDirectory() !== isDirectory) {
    throw new Error(`Missing ${label}: ${target}. Run next build before collecting Cloudflare assets.`);
  }
}

assertUnusedPublicSourcesExist(publicDir);

// The record describes the assets replaced below. cf:build writes a new one when
// it finishes; a cf:preview (dev-tools) build leaves none, so --skip-build refuses it.
rmSync(path.join(CLOUDFLARE_BUILD_DIR, BUILD_RECORD_FILE), { force: true });

const excludedByRule = new Map();
rmSync(CLOUDFLARE_ASSETS_DIR, { recursive: true, force: true });
cpSync(publicDir, CLOUDFLARE_ASSETS_DIR, {
  recursive: true,
  dereference: true,
  filter: (source) => {
    const relativePath = path.relative(publicDir, source);
    if (!relativePath || statSync(source).isDirectory()) return true;
    const reason = publicAssetExcludeReason(relativePath, publicDir);
    if (!reason) return true;
    excludedByRule.set(reason, (excludedByRule.get(reason) ?? 0) + 1);
    return false;
  },
});
cpSync(nextStaticDir, path.join(CLOUDFLARE_ASSETS_DIR, "_next", "static"), {
  recursive: true,
  dereference: true,
});
copyFileSync(buildIdFile, path.join(CLOUDFLARE_ASSETS_DIR, "BUILD_ID"));

console.log(
  `Collected ${countFiles(CLOUDFLARE_ASSETS_DIR)} Cloudflare asset(s) in ${CLOUDFLARE_ASSETS_DIR} `
  + `(public, .next/static, BUILD_ID)`,
);
for (const [reason, count] of excludedByRule) {
  console.log(`  left out ${count} public file(s): ${reason}`);
}

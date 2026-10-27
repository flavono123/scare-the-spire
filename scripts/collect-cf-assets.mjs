/**
 * Builds the main Worker's static asset directory from a finished
 * `next build`: `public/**` at the root, `.next/static/**` at
 * `/_next/static/**`, and `BUILD_ID` (the deployed build marker).
 * `copy-cf-static-pages.mjs` then adds the prerendered pages.
 */
import { copyFileSync, cpSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";

import { CLOUDFLARE_ASSETS_DIR } from "./cloudflare-assets-dir.mjs";

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

rmSync(CLOUDFLARE_ASSETS_DIR, { recursive: true, force: true });
cpSync(publicDir, CLOUDFLARE_ASSETS_DIR, { recursive: true, dereference: true });
cpSync(nextStaticDir, path.join(CLOUDFLARE_ASSETS_DIR, "_next", "static"), {
  recursive: true,
  dereference: true,
});
copyFileSync(buildIdFile, path.join(CLOUDFLARE_ASSETS_DIR, "BUILD_ID"));

console.log(
  `Collected ${countFiles(CLOUDFLARE_ASSETS_DIR)} Cloudflare asset(s) in ${CLOUDFLARE_ASSETS_DIR} `
  + `(public, .next/static, BUILD_ID)`,
);

#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedIds = ["DARV", "NEOW", "NONUPEIPE", "OROBAS", "PAEL", "TANX", "TEZCATARA", "VAKUU"];
const expectedSpineIds = new Set(["NEOW", "TEZCATARA"]);
const manifest = readJson("data/sts2/ancient-scene-assets.json");
const spineAssets = new Map(readJson("data/sts2/ancient-spine-assets.json").map((asset) => [asset.id, asset]));
const releaseInfoPath = path.join(
  os.homedir(),
  "Library/Application Support/Steam/steamapps/common/Slay the Spire 2/SlayTheSpire2.app/Contents/Resources/release_info.json",
);
const releaseInfo = JSON.parse(fs.readFileSync(releaseInfoPath, "utf8"));

assert(manifest.length === expectedIds.length, `expected ${expectedIds.length} Ancient scenes, got ${manifest.length}`);
assert(new Set(manifest.map((entry) => entry.id)).size === expectedIds.length, "Ancient scene IDs must be unique");
assert(manifest.map((entry) => entry.id).join(",") === expectedIds.join(","), "Ancient scene IDs or order changed");

for (const entry of manifest) {
  assert(entry.source.gameVersion === releaseInfo.version, `${entry.id}: stale game version ${entry.source.gameVersion}`);
  assert(entry.source.scenePath === `scenes/events/background_scenes/${entry.id.toLowerCase()}.tscn`, `${entry.id}: wrong source scene`);
  assertStaticUrl(entry.token, `${entry.id}: token`);
  assertStaticUrl(entry.fallback.path, `${entry.id}: fallback`);
  if (entry.baseArt) assertStaticUrl(entry.baseArt.path, `${entry.id}: base art`);
  assert(["full", "partial", "unsupported"].includes(entry.vfx.support), `${entry.id}: invalid VFX support`);
  assert(entry.vfx.support !== "unsupported", `${entry.id}: Ancient VFX must retain at least one live effect`);
  for (const sceneUrl of Object.values(entry.vfx.manifestPaths)) assertStaticUrl(sceneUrl, `${entry.id}: VFX scene`);
  assert(Array.isArray(entry.alternatives), `${entry.id}: alternatives must be explicit`);

  const shouldHaveSpine = expectedSpineIds.has(entry.id);
  assert(Boolean(entry.spine) === shouldHaveSpine, `${entry.id}: unexpected Spine capability`);
  if (!entry.spine) continue;
  const asset = spineAssets.get(entry.spine.assetId);
  assert(asset, `${entry.id}: missing Spine index entry`);
  assert(asset.animations.includes(entry.spine.animation), `${entry.id}: missing animation ${entry.spine.animation}`);
  assert(entry.spine.skin === null || asset.skins.includes(entry.spine.skin), `${entry.id}: missing skin ${entry.spine.skin}`);
  for (const value of Object.values(entry.spine.viewport)) {
    assert(Number.isFinite(value) && value > 0, `${entry.id}: invalid viewport value ${value}`);
  }
  for (const url of [asset.atlasUrl, asset.binaryUrl, ...asset.textureUrls]) assertStaticUrl(url, `${entry.id}: Spine asset`);
  for (const textureUrl of asset.textureUrls) {
    const { width, height } = pngSize(staticPath(textureUrl));
    assert(width <= 4096 && height <= 4096, `${entry.id}: ${width}x${height} exceeds 4096 texture limit`);
  }
}

console.log(`validated ${manifest.length} Ancient scenes for ${releaseInfo.version} (${releaseInfo.commit})`);

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function staticPath(url) {
  const pathname = url.replace(/[?#].*$/, "").replace(/^\/+/, "");
  return path.join(repoRoot, "public", pathname);
}

function assertStaticUrl(url, label) {
  assert(typeof url === "string" && url.startsWith("/"), `${label}: invalid URL ${url}`);
  assert(fs.existsSync(staticPath(url)), `${label}: missing ${url}`);
}

function pngSize(filePath) {
  const header = fs.readFileSync(filePath).subarray(0, 24);
  assert(header.toString("ascii", 1, 4) === "PNG", `${filePath}: expected PNG texture`);
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

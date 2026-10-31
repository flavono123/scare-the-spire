/**
 * Files under `public/` that stay in the repository but are not uploaded as
 * main Worker static assets. A Workers Free version holds at most 20,000
 * files, and no page, chunk, data file, or user post loads these.
 *
 * `collect-cf-assets.mjs` skips them. `prune-cf-unreferenced-assets.mjs` (main
 * build) and `copy-patch-worker-assets.mjs` (patch build) fail when a served
 * file references one, so a new reference cannot silently 404 in production.
 * Drop an entry here before using the file.
 */
import { existsSync } from "node:fs";
import path from "node:path";

const SHARED_VFX_ROOT = "spine/sts2/vfx";
const SHARED_VFX_ATLAS = `${SHARED_VFX_ROOT}/spine-vfx.atlas`;

/** Single files kept as sources; the site serves something else in their place. */
export const UNUSED_PUBLIC_SOURCES = new Map([
  ["fonts/GyeonggiCheonnyeonBatangBold.ttf", "source of the served GyeonggiCheonnyeonBatangBold.woff2"],
  ["fonts/bitter_medium_italic.ttf", "extracted game font the site never loads"],
  ["fonts/source_code_pro_medium.ttf", "extracted game font the site never loads"],
  ["fonts/source_code_pro_semibold.ttf", "extracted game font the site never loads"],
  ...Array.from({ length: 10 }, (_, frame) => [
    `images/game-assets/card-misc/ancient_card_flame_${frame}.png`,
    "frame baked into ancient_card_flame_sheet.png",
  ]),
  ["images/game-assets/card-misc/card_highlight_ancient.png", "extracted game texture the card tile no longer draws"],
  ["images/game-assets/card-misc/card_portrait_border_plaque2.png", "extracted game texture the card tile never draws"],
  ["images/game-assets/card-misc/card_unplayable_icon.png", "extracted game texture the card tile never draws"],
  ["images/game-assets/card-misc/energy_star_layer_2.png", "extracted game texture the card tile never draws"],
  ["images/game-assets/card-misc/energy_star_layer_3.png", "extracted game texture the card tile never draws"],
  ["images/game-assets/card-library/pool_filter_other_direct.webp", "extracted filter icon the card library never draws"],
  ["images/game-assets/card-library/type_sort_other.webp", "extracted filter icon the card library never draws"],
  ["images/game-assets/card-library/type_sort_outline2.webp", "extracted filter icon the card library never draws"],
  [
    "generated/ancient-vfx/scenes/neow_behindBody.json",
    "stale Ancient scene layer; data/sts2/ancient-scene-assets.json dropped it in b23e0c6f",
  ],
]);

/**
 * @typedef {{ name: string, test: (relativePath: string, publicDir: string) => boolean }} ExcludeRule
 * @type {ExcludeRule[]}
 */
export const PUBLIC_ASSET_EXCLUDE_RULES = [
  {
    name: "OS or editor metadata",
    test: (relativePath) => /(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini)$/.test(relativePath),
  },
  {
    name: "source map",
    test: (relativePath) => relativePath.endsWith(".map"),
  },
  {
    name: "Godot resource or HDR source browsers cannot load",
    test: (relativePath) => /\.(tres|tscn|import|exr)$/.test(relativePath),
  },
  {
    // build-sts2-spine-index.mjs reads each spine/sts2/vfx/<folder>/*.atlas and
    // *.png, writes spine-vfx.atlas, and copies the pages next to it. Players
    // load only the shared atlas, the root pages, and the per-folder .skel.
    name: "per-VFX atlas or page merged into spine/sts2/vfx/spine-vfx.atlas",
    test: (relativePath, publicDir) => {
      const match = relativePath.match(/^spine\/sts2\/vfx\/[^/]+\/([^/]+)\.(atlas|png)$/);
      if (!match) return false;
      if (!existsSync(path.join(publicDir, SHARED_VFX_ATLAS))) return false;
      if (match[2] === "atlas") return true;
      return existsSync(path.join(publicDir, SHARED_VFX_ROOT, `${match[1]}.png`));
    },
  },
  {
    name: "unused source file",
    test: (relativePath) => UNUSED_PUBLIC_SOURCES.has(relativePath),
  },
];

/** Returns the matching rule name, or null when the file is uploaded. */
export function publicAssetExcludeReason(relativePath, publicDir) {
  const normalized = relativePath.split(path.sep).join("/");
  for (const rule of PUBLIC_ASSET_EXCLUDE_RULES) {
    if (rule.test(normalized, publicDir)) return rule.name;
  }
  return null;
}

/** Throws when an UNUSED_PUBLIC_SOURCES entry no longer exists in public/. */
export function assertUnusedPublicSourcesExist(publicDir) {
  const missing = [...UNUSED_PUBLIC_SOURCES.keys()]
    .filter((relativePath) => !existsSync(path.join(publicDir, relativePath)));
  if (missing.length > 0) {
    throw new Error(
      `UNUSED_PUBLIC_SOURCES lists files missing from ${publicDir}; remove them from `
      + `scripts/cloudflare-asset-excludes.mjs:\n${missing.map((file) => `  ${file}`).join("\n")}`,
    );
  }
}

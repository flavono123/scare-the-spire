import { readdirSync, statSync } from "node:fs";
import path from "node:path";

import {
  staticCompendiumAssetPath,
  type StaticPageExtension,
} from "../workers/static-page-routing";

const assetsRoot = path.join(".open-next", "assets");
const nextAppRoot = path.join(".next", "server", "app");
const maxAssetFiles = Number(process.env.CLOUDFLARE_STATIC_ASSET_LIMIT ?? 20_000);
const maxAssetBytes = Number(process.env.CLOUDFLARE_STATIC_ASSET_SIZE_LIMIT_MIB ?? 25) * 1024 * 1024;

const compendiumSegments = new Set([
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

const serviceLocales = [
  { label: "ko", pathPrefix: "", sourceParts: ["compendium"] },
  { label: "en", pathPrefix: "/en", sourceParts: ["en", "compendium"] },
] as const;

function walkFiles(dir: string, files: string[] = []): string[] {
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

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function checkServiceLocaleDetails(): Record<string, number> {
  const routeCounts: Record<string, number> = {};

  for (const locale of serviceLocales) {
    const sourceRoot = path.join(nextAppRoot, ...locale.sourceParts);
    const routeExtensions = new Map<string, Set<StaticPageExtension>>();

    for (const segmentEntry of readdirSync(sourceRoot, { withFileTypes: true })) {
      if (!segmentEntry.isDirectory() || !compendiumSegments.has(segmentEntry.name)) continue;

      const segmentRoot = path.join(sourceRoot, segmentEntry.name);
      for (const fileEntry of readdirSync(segmentRoot, { withFileTypes: true })) {
        if (!fileEntry.isFile()) continue;

        const extension = path.extname(fileEntry.name).slice(1);
        if (extension !== "html" && extension !== "rsc") continue;

        const id = path.basename(fileEntry.name, `.${extension}`);
        const routePath = `${locale.pathPrefix}/compendium/${segmentEntry.name}/${id}`;
        const extensions = routeExtensions.get(routePath) ?? new Set<StaticPageExtension>();
        extensions.add(extension);
        routeExtensions.set(routePath, extensions);

        const assetPath = staticCompendiumAssetPath(routePath, extension);
        assert(assetPath, `Static routing rejected ${locale.label} detail ${routePath}.${extension}`);

        const outputPath = path.join(assetsRoot, assetPath.slice(1));
        assert(
          statSync(outputPath, { throwIfNoEntry: false })?.isFile(),
          `Missing copied static detail asset: ${outputPath}`,
        );
      }
    }

    for (const [routePath, extensions] of routeExtensions) {
      assert(extensions.has("html"), `Missing generated HTML for ${routePath}`);
      assert(extensions.has("rsc"), `Missing generated RSC for ${routePath}`);
    }

    assert(routeExtensions.size > 0, `No ${locale.label} Compendium detail routes were found.`);
    routeCounts[locale.label] = routeExtensions.size;
  }

  assert(
    routeCounts.ko === routeCounts.en,
    `Service-locale detail route counts differ: ko=${routeCounts.ko}, en=${routeCounts.en}`,
  );
  assert(
    staticCompendiumAssetPath("/zh/compendium/powers/painful_stabs", "html") === null,
    "Game-only locale details must stay outside the direct static detail set.",
  );
  assert(
    staticCompendiumAssetPath("/zh/compendium/powers", "html")
      === "/_cf_static_pages/zh/compendium/powers.html",
    "Game-locale Compendium indexes must remain direct static pages.",
  );

  return routeCounts;
}

function checkCloudflareAssetLimits(): { count: number; largestBytes: number; largestPath: string } {
  const files = walkFiles(assetsRoot);
  assert(
    files.length <= maxAssetFiles,
    `Cloudflare static asset count ${files.length} exceeds the Free plan limit ${maxAssetFiles}.`,
  );

  let largestBytes = 0;
  let largestPath = "";
  for (const file of files) {
    const size = statSync(file).size;
    assert(
      size <= maxAssetBytes,
      `Cloudflare static asset exceeds ${maxAssetBytes / 1024 / 1024} MiB: ${file} (${size} bytes)`,
    );
    if (size > largestBytes) {
      largestBytes = size;
      largestPath = file;
    }
  }

  return { count: files.length, largestBytes, largestPath };
}

const routeCounts = checkServiceLocaleDetails();
const assetStats = checkCloudflareAssetLimits();

console.log(`Cloudflare static detail routes: ko=${routeCounts.ko}, en=${routeCounts.en}`);
console.log(`Cloudflare static assets: ${assetStats.count}/${maxAssetFiles}`);
console.log(
  `Largest Cloudflare static asset: ${(assetStats.largestBytes / 1024 / 1024).toFixed(2)} MiB (${assetStats.largestPath})`,
);

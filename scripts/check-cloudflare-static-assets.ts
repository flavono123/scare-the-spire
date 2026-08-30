import { readdirSync, statSync } from "node:fs";
import path from "node:path";

import {
  staticCompendiumAssetPath,
  staticLegacyPageAssetPath,
  staticServiceDetailShellAssetPath,
  staticServicePageAssetPath,
  type StaticPageExtension,
} from "../workers/static-page-routing";

const assetsRoot = path.join(".open-next", "assets");
const nextAppRoot = path.join(".next", "server", "app");
const maxAssetFiles = Number(process.env.CLOUDFLARE_STATIC_ASSET_LIMIT ?? 20_000);
const maxAssetBytes = Number(process.env.CLOUDFLARE_STATIC_ASSET_SIZE_LIMIT_MIB ?? 25) * 1024 * 1024;

const compendiumSegments = new Set([
  "ancients",
  "badges",
  "bestiary",
  "cards",
  "characters",
  "enchantments",
  "encounters",
  "epochs",
  "events",
  "keywords",
  "modifiers",
  "ascensions",
  "monsters",
  "potions",
  "powers",
  "relics",
]);

const serviceLocales = [
  { label: "ko", pathPrefix: "", sourceParts: ["compendium"] },
  { label: "en", pathPrefix: "/en", sourceParts: ["en", "compendium"] },
] as const;

const gameLocalePathPrefixes = [
  "",
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
] as const;

const staticServicePageSegments = [
  "byrdispatch",
  "chemical-x",
  "c-c-c-combo",
  "contact",
  "defragment",
  "history-course",
  "profile",
  "this-or-that",
  "transfigure",
] as const;
const staticDetailShellSegment = "__id__";
const staticServiceDetailShellSegments = [
  "chemical-x",
  "c-c-c-combo",
  "this-or-that",
  "transfigure",
  "history-course",
  "decisions-decisions",
] as const;
const defragmentFederatedServices = [
  "combo",
  "transfigure",
  "this_or_that",
  "chemical_x",
  "decisions_decisions",
  "favorite_tournament",
] as const;
const staticLegacyPageSegments = ["cards", "potions", "relics"] as const;
const staticMetadataAssets = ["robots.txt", "sitemap.xml"] as const;

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
  assert(
    staticCompendiumAssetPath("/zh/compendium/badges", "html")
      === "/_cf_static_pages/zh/compendium/badges.html",
    "Badge indexes must remain direct static pages for every game locale.",
  );
  assert(
    staticCompendiumAssetPath("/compendium/badges/speedy", "html")
      === "/_cf_static_pages/compendium/badges/speedy.html",
    "Korean badge details must remain direct static pages.",
  );
  assert(
    staticCompendiumAssetPath("/en/compendium/badges/speedy", "rsc")
      === "/_cf_static_pages/en/compendium/badges/speedy.rsc",
    "English badge details must remain direct static pages.",
  );
  assert(
    staticCompendiumAssetPath("/zh/compendium/badges/speedy", "html") === null,
    "Game-only badge details must stay outside the direct static detail set.",
  );

  return routeCounts;
}

function checkStaticServicePages(): number {
  let count = 0;

  for (const pathPrefix of gameLocalePathPrefixes) {
    for (const pageSegment of staticServicePageSegments) {
      const routePath = `/${pathPrefix ? `${pathPrefix}/` : ""}${pageSegment}`;
      for (const extension of ["html", "rsc"] satisfies StaticPageExtension[]) {
        const assetPath = staticServicePageAssetPath(routePath, extension);
        assert(assetPath, `Static routing rejected service page ${routePath}.${extension}`);

        const outputPath = path.join(assetsRoot, assetPath.slice(1));
        assert(
          statSync(outputPath, { throwIfNoEntry: false })?.isFile(),
          `Missing copied static service page: ${outputPath}`,
        );
        count += 1;
      }
    }
  }

  assert(
    staticServicePageAssetPath("/ko/chemical-x", "html") === null,
    "Unsupported /ko service locale prefix must not map to a static page.",
  );
  assert(
    staticServicePageAssetPath("/chemical-x/post-id", "html") === null,
    "Dynamic Chemical X detail routes must stay outside the static index set.",
  );
  assert(
    staticServicePageAssetPath("/history-course/run-id", "rsc") === null,
    "Dynamic History Course detail routes must stay outside the static index set.",
  );

  return count;
}

function checkStaticDetailShellRouting(): void {
  assert(
    staticServiceDetailShellAssetPath("/chemical-x/post-id", "html")
      === `/_cf_static_pages/chemical-x/${staticDetailShellSegment}.html`,
    "Chemical X details must rewrite to the static shell.",
  );
  assert(
    staticServiceDetailShellAssetPath("/en/history-course/1testbedsmoketest", "rsc")
      === `/_cf_static_pages/en/history-course/${staticDetailShellSegment}.rsc`,
    "Locale History Course details must rewrite to the static shell.",
  );
  assert(
    staticServiceDetailShellAssetPath("/defragment/transfigure/abc", "html")
      === `/_cf_static_pages/defragment/transfigure/${staticDetailShellSegment}.html`,
    "Federated 조각모음 details must rewrite to the matching service shell.",
  );
  assert(
    staticServiceDetailShellAssetPath("/zh/defragment/native-post", "html")
      === `/_cf_static_pages/zh/defragment/${staticDetailShellSegment}.html`,
    "Native 조각모음 details must rewrite to the native shell.",
  );
  assert(
    staticServiceDetailShellAssetPath("/defragment/combo", "html") === null,
    "Federated service names without a post id must not use the native shell.",
  );
  assert(
    staticServiceDetailShellAssetPath("/chemical-x/post-id/extra", "html") === null,
    "Nested extra path segments must fail closed.",
  );
  assert(
    staticServiceDetailShellAssetPath("/chemical-x", "html") === null,
    "Service indexes must not match the detail shell matcher.",
  );
  assert(
    staticServiceDetailShellAssetPath("/defragment/not_a_service/abc", "rsc") === null,
    "Unknown 조각모음 service names must fail closed.",
  );
}

function checkStaticDetailShellAssets(): number {
  checkStaticDetailShellRouting();
  let count = 0;

  for (const pathPrefix of gameLocalePathPrefixes) {
    for (const pageSegment of staticServiceDetailShellSegments) {
      const routePath = `/${pathPrefix ? `${pathPrefix}/` : ""}${pageSegment}/${staticDetailShellSegment}`;
      for (const extension of ["html", "rsc"] satisfies StaticPageExtension[]) {
        const assetPath = staticServiceDetailShellAssetPath(
          routePath.replace(staticDetailShellSegment, "post-id"),
          extension,
        );
        assert(assetPath, `Static routing rejected detail shell ${routePath}.${extension}`);
        const outputPath = path.join(assetsRoot, assetPath.slice(1));
        assert(
          statSync(outputPath, { throwIfNoEntry: false })?.isFile(),
          `Missing copied static detail shell: ${outputPath}`,
        );
        count += 1;
      }
    }

    const nativeDefragmentPath = `/${pathPrefix ? `${pathPrefix}/` : ""}defragment/${staticDetailShellSegment}`;
    for (const extension of ["html", "rsc"] satisfies StaticPageExtension[]) {
      const assetPath = staticServiceDetailShellAssetPath(
        nativeDefragmentPath.replace(staticDetailShellSegment, "native-post"),
        extension,
      );
      assert(assetPath, `Static routing rejected native 조각모음 shell ${nativeDefragmentPath}.${extension}`);
      const outputPath = path.join(assetsRoot, assetPath.slice(1));
      assert(
        statSync(outputPath, { throwIfNoEntry: false })?.isFile(),
        `Missing copied native 조각모음 shell: ${outputPath}`,
      );
      count += 1;
    }

    for (const service of defragmentFederatedServices) {
      const routePath = `/${pathPrefix ? `${pathPrefix}/` : ""}defragment/${service}/${staticDetailShellSegment}`;
      for (const extension of ["html", "rsc"] satisfies StaticPageExtension[]) {
        const assetPath = staticServiceDetailShellAssetPath(
          routePath.replace(staticDetailShellSegment, "post-id"),
          extension,
        );
        assert(assetPath, `Static routing rejected federated shell ${routePath}.${extension}`);
        const outputPath = path.join(assetsRoot, assetPath.slice(1));
        assert(
          statSync(outputPath, { throwIfNoEntry: false })?.isFile(),
          `Missing copied federated detail shell: ${outputPath}`,
        );
        count += 1;
      }
    }
  }

  return count;
}

function checkStaticCompendiumRoots(): number {
  let count = 0;

  for (const pathPrefix of gameLocalePathPrefixes) {
    const routePath = `/${pathPrefix ? `${pathPrefix}/` : ""}compendium`;
    for (const extension of ["html", "rsc"] satisfies StaticPageExtension[]) {
      const assetPath = staticCompendiumAssetPath(routePath, extension);
      assert(assetPath, `Static routing rejected Compendium root ${routePath}.${extension}`);

      const outputPath = path.join(assetsRoot, assetPath.slice(1));
      assert(
        statSync(outputPath, { throwIfNoEntry: false })?.isFile(),
        `Missing copied Compendium root: ${outputPath}`,
      );
      count += 1;
    }
  }

  return count;
}

function checkStaticLegacyPages(): number {
  let count = 0;

  for (const segment of staticLegacyPageSegments) {
    const routeExtensions = new Map<string, Set<StaticPageExtension>>();
    const sourceFiles = [
      path.join(nextAppRoot, `${segment}.html`),
      path.join(nextAppRoot, `${segment}.rsc`),
      ...readdirSync(path.join(nextAppRoot, segment), { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => path.join(nextAppRoot, segment, entry.name)),
    ];

    for (const sourceFile of sourceFiles) {
      const extension = path.extname(sourceFile).slice(1);
      if (extension !== "html" && extension !== "rsc") continue;

      const id = path.basename(sourceFile, `.${extension}`);
      const routePath = id === segment ? `/${segment}` : `/${segment}/${id}`;
      const extensions = routeExtensions.get(routePath) ?? new Set<StaticPageExtension>();
      extensions.add(extension);
      routeExtensions.set(routePath, extensions);

      const assetPath = staticLegacyPageAssetPath(routePath, extension);
      assert(assetPath, `Static routing rejected legacy page ${routePath}.${extension}`);
      const outputPath = path.join(assetsRoot, assetPath.slice(1));
      assert(
        statSync(outputPath, { throwIfNoEntry: false })?.isFile(),
        `Missing copied legacy page: ${outputPath}`,
      );
    }

    for (const [routePath, extensions] of routeExtensions) {
      assert(extensions.has("html"), `Missing generated HTML for ${routePath}`);
      assert(extensions.has("rsc"), `Missing generated RSC for ${routePath}`);
    }

    assert(routeExtensions.size > 0, `No legacy ${segment} routes were found.`);
    count += routeExtensions.size * 2;
  }

  assert(
    staticLegacyPageAssetPath("/en/cards/bash", "html") === null,
    "Legacy routes must not accept a game-locale prefix.",
  );
  assert(
    staticLegacyPageAssetPath("/cards/bash/extra", "rsc") === null,
    "Legacy routes must fail closed for nested paths.",
  );

  return count;
}

function checkStaticMetadataAssets(): number {
  for (const assetName of staticMetadataAssets) {
    const outputPath = path.join(assetsRoot, assetName);
    assert(
      statSync(outputPath, { throwIfNoEntry: false })?.isFile(),
      `Missing copied static metadata asset: ${outputPath}`,
    );
  }

  return staticMetadataAssets.length;
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
const staticServicePageCount = checkStaticServicePages();
const staticDetailShellCount = checkStaticDetailShellAssets();
const staticCompendiumRootCount = checkStaticCompendiumRoots();
const staticLegacyPageCount = checkStaticLegacyPages();
const staticMetadataAssetCount = checkStaticMetadataAssets();
const assetStats = checkCloudflareAssetLimits();

console.log(`Cloudflare static detail routes: ko=${routeCounts.ko}, en=${routeCounts.en}`);
console.log(`Cloudflare static service page assets: ${staticServicePageCount}`);
console.log(`Cloudflare static detail shell assets: ${staticDetailShellCount}`);
console.log(`Cloudflare static Compendium root assets: ${staticCompendiumRootCount}`);
console.log(`Cloudflare static legacy page assets: ${staticLegacyPageCount}`);
console.log(`Cloudflare static metadata assets: ${staticMetadataAssetCount}`);
console.log(`Cloudflare static assets: ${assetStats.count}/${maxAssetFiles}`);
console.log(
  `Largest Cloudflare static asset: ${(assetStats.largestBytes / 1024 / 1024).toFixed(2)} MiB (${assetStats.largestPath})`,
);

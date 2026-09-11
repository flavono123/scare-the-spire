import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import {
  legacyWorldcupDetailRedirectPath,
  staticCompendiumAssetPath,
  staticLegacyPageAssetPath,
  staticServiceDetailShellAssetPath,
  staticServicePageAssetPath,
  sts1LegacyAliasPath,
  sts2CompendiumAliasPath,
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
  "pagestorm",
] as const;
const staticNestedServicePages = [
  ["pagestorm", "write"],
] as const;
const staticDetailShellSegment = "__id__";
const staticServiceDetailShellSegments = [
  "chemical-x",
  "c-c-c-combo",
  "this-or-that",
  "transfigure",
  "history-course",
  "decisions-decisions",
  "pagestorm",
] as const;
const defragmentFederatedServices = [
  "combo",
  "transfigure",
  "this_or_that",
  "chemical_x",
  "decisions_decisions",
  "favorite_tournament",
  "pagestorm",
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
  assert(
    staticServicePageAssetPath("/pagestorm/write", "html")
      === "/_cf_static_pages/pagestorm/write.html",
    "Pagestorm write must map to a nested static page.",
  );
  assert(
    staticServicePageAssetPath("/en/pagestorm/write", "rsc")
      === "/_cf_static_pages/en/pagestorm/write.rsc",
    "Locale Pagestorm write must map to a nested static page.",
  );
  assert(
    staticServicePageAssetPath("/pagestorm/write/extra", "html") === null,
    "Pagestorm write must fail closed for extra path segments.",
  );
  assert(
    staticServiceDetailShellAssetPath("/pagestorm/write", "html") === null,
    "Pagestorm write must not use an unbounded ID shell.",
  );
  assert(
    staticServiceDetailShellAssetPath("/pagestorm/post-id", "html")
      === `/_cf_static_pages/pagestorm/${staticDetailShellSegment}.html`,
    "Pagestorm details must rewrite to the static shell.",
  );

  for (const pathPrefix of gameLocalePathPrefixes) {
    for (const [service, nested] of staticNestedServicePages) {
      const routePath = `/${pathPrefix ? `${pathPrefix}/` : ""}${service}/${nested}`;
      for (const extension of ["html", "rsc"] satisfies StaticPageExtension[]) {
        const assetPath = staticServicePageAssetPath(routePath, extension);
        assert(assetPath, `Static routing rejected nested service page ${routePath}.${extension}`);
        const outputPath = path.join(assetsRoot, assetPath.slice(1));
        assert(
          statSync(outputPath, { throwIfNoEntry: false })?.isFile(),
          `Missing copied nested static service page: ${outputPath}`,
        );
        count += 1;
      }
    }
  }

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
  assert(
    staticServiceDetailShellAssetPath("/this-or-that/tournament", "html") === null,
    "This or That tournament index must not match the post-id shell.",
  );
  assert(
    staticServiceDetailShellAssetPath("/this-or-that/tournament/post-id", "html")
      === `/_cf_static_pages/this-or-that/tournament/${staticDetailShellSegment}.html`,
    "This or That tournament details must rewrite to the static shell.",
  );
  assert(
    staticServiceDetailShellAssetPath("/en/this-or-that/worldcup/post-id", "rsc") === null,
    "Legacy worldcup details must redirect instead of using a static shell.",
  );
  assert(
    legacyWorldcupDetailRedirectPath("/this-or-that/worldcup/post-id")
      === "/this-or-that/tournament/post-id",
    "Legacy worldcup details must 308 to the tournament path.",
  );
  assert(
    legacyWorldcupDetailRedirectPath("/zh/this-or-that/worldcup/post-id")
      === "/zh/this-or-that/tournament/post-id",
    "Locale worldcup details must keep the game-locale prefix.",
  );
  assert(
    legacyWorldcupDetailRedirectPath("/this-or-that/worldcup/post-id/extra") === null,
    "Nested worldcup extra path segments must fail closed.",
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

    const tournamentPath = `/${pathPrefix ? `${pathPrefix}/` : ""}this-or-that/tournament/${staticDetailShellSegment}`;
    for (const extension of ["html", "rsc"] satisfies StaticPageExtension[]) {
      const assetPath = staticServiceDetailShellAssetPath(
        tournamentPath.replace(staticDetailShellSegment, "post-id"),
        extension,
      );
      assert(assetPath, `Static routing rejected tournament shell ${tournamentPath}.${extension}`);
      const outputPath = path.join(assetsRoot, assetPath.slice(1));
      assert(
        statSync(outputPath, { throwIfNoEntry: false })?.isFile(),
        `Missing copied tournament detail shell: ${outputPath}`,
      );
      count += 1;
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
  assert(
    sts1LegacyAliasPath("/cards") === "/compendium/sts1/cards",
    "STS1 /cards must alias to /compendium/sts1/cards",
  );
  assert(
    sts1LegacyAliasPath("/cards/bash") === "/compendium/sts1/cards/bash",
    "STS1 /cards/:id must alias to /compendium/sts1/cards/:id",
  );
  assert(
    staticLegacyPageAssetPath("/cards", "html")
      === "/_cf_static_pages/compendium/sts1/cards.html",
    "Legacy /cards must serve the STS1 Compendium index asset.",
  );
  assert(
    staticLegacyPageAssetPath("/cards/bash", "rsc")
      === "/_cf_static_pages/compendium/sts1/cards/bash.rsc",
    "Legacy /cards/:id must serve the STS1 Compendium detail asset.",
  );
  assert(
    staticLegacyPageAssetPath("/en/cards/bash", "html") === null,
    "Legacy routes must not accept a game-locale prefix.",
  );
  assert(
    staticLegacyPageAssetPath("/cards/bash/extra", "rsc") === null,
    "Legacy routes must fail closed for nested paths.",
  );
  assert(
    sts2CompendiumAliasPath("/compendium/sts2/cards") === "/compendium/cards",
    "STS2 alias indexes must strip the sts2 segment.",
  );
  assert(
    sts2CompendiumAliasPath("/en/compendium/sts2/relics/anchor") === "/en/compendium/relics/anchor",
    "STS2 alias details must strip the sts2 segment.",
  );
  assert(
    staticCompendiumAssetPath("/compendium/sts1/cards", "html")
      === "/_cf_static_pages/compendium/sts1/cards.html",
    "STS1 indexes must be direct static pages.",
  );
  assert(
    staticCompendiumAssetPath("/en/compendium/sts1/cards/bash", "rsc")
      === "/_cf_static_pages/en/compendium/sts1/cards/bash.rsc",
    "English STS1 details must be direct static pages.",
  );
  assert(
    staticCompendiumAssetPath("/zh/compendium/sts1/cards/bash", "html") === null,
    "Game-only locale STS1 details must stay outside the direct static detail set.",
  );
  assert(
    staticCompendiumAssetPath("/zh/compendium/sts1/cards", "html")
      === "/_cf_static_pages/zh/compendium/sts1/cards.html",
    "Game-locale STS1 indexes must remain direct static pages.",
  );

  let count = 0;
  for (const localePrefix of ["", "en"]) {
    const sourceRoot = localePrefix
      ? path.join(nextAppRoot, localePrefix, "compendium", "sts1")
      : path.join(nextAppRoot, "compendium", "sts1");
    assert(
      statSync(sourceRoot, { throwIfNoEntry: false })?.isDirectory(),
      `Missing generated STS1 Compendium directory: ${sourceRoot}`,
    );

    for (const segment of staticLegacyPageSegments) {
      const indexHtml = path.join(sourceRoot, `${segment}.html`);
      const indexRsc = path.join(sourceRoot, `${segment}.rsc`);
      assert(statSync(indexHtml, { throwIfNoEntry: false })?.isFile(), `Missing ${indexHtml}`);
      assert(statSync(indexRsc, { throwIfNoEntry: false })?.isFile(), `Missing ${indexRsc}`);
      const indexRoute = `${localePrefix ? `/${localePrefix}` : ""}/compendium/sts1/${segment}`;
      for (const extension of ["html", "rsc"] as const) {
        const assetPath = staticCompendiumAssetPath(indexRoute, extension);
        assert(assetPath, `Static routing rejected STS1 index ${indexRoute}.${extension}`);
        assert(
          statSync(path.join(assetsRoot, assetPath.slice(1)), { throwIfNoEntry: false })?.isFile(),
          `Missing copied STS1 index: ${assetPath}`,
        );
      }
      count += 2;

      const detailRoot = path.join(sourceRoot, segment);
      const detailFiles = readdirSync(detailRoot, { withFileTypes: true })
        .filter((entry) => entry.isFile());
      const routeExtensions = new Map<string, Set<StaticPageExtension>>();
      for (const fileEntry of detailFiles) {
        const extension = path.extname(fileEntry.name).slice(1);
        if (extension !== "html" && extension !== "rsc") continue;
        const id = path.basename(fileEntry.name, `.${extension}`);
        const routePath = `${indexRoute}/${id}`;
        const extensions = routeExtensions.get(routePath) ?? new Set<StaticPageExtension>();
        extensions.add(extension);
        routeExtensions.set(routePath, extensions);
        const assetPath = staticCompendiumAssetPath(routePath, extension);
        assert(assetPath, `Static routing rejected STS1 detail ${routePath}.${extension}`);
        assert(
          statSync(path.join(assetsRoot, assetPath.slice(1)), { throwIfNoEntry: false })?.isFile(),
          `Missing copied STS1 detail: ${assetPath}`,
        );
      }
      for (const [routePath, extensions] of routeExtensions) {
        assert(extensions.has("html"), `Missing generated HTML for ${routePath}`);
        assert(extensions.has("rsc"), `Missing generated RSC for ${routePath}`);
      }
      assert(routeExtensions.size > 0, `No STS1 ${segment} detail routes were found.`);
      count += routeExtensions.size * 2;
    }
  }

  for (const segment of staticLegacyPageSegments) {
    const zhIndex = path.join(nextAppRoot, "zh", "compendium", "sts1", `${segment}.html`);
    assert(
      statSync(zhIndex, { throwIfNoEntry: false })?.isFile(),
      `Missing game-locale STS1 index: ${zhIndex}`,
    );
    const zhAsset = staticCompendiumAssetPath(`/zh/compendium/sts1/${segment}`, "html");
    assert(zhAsset, `Static routing rejected game-locale STS1 index /zh/compendium/sts1/${segment}`);
    assert(
      statSync(path.join(assetsRoot, zhAsset.slice(1)), { throwIfNoEntry: false })?.isFile(),
      `Missing copied game-locale STS1 index: ${zhAsset}`,
    );
    count += 1;
  }

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
const incrementalCacheRoot = path.join(assetsRoot, "cdn-cgi", "_next_cache");
const incrementalCacheCount = existsSync(incrementalCacheRoot)
  ? walkFiles(incrementalCacheRoot).length
  : 0;
console.log(`Cloudflare static assets: ${assetStats.count}/${maxAssetFiles}`);
console.log(
  `OpenNext incremental cache assets: ${incrementalCacheCount} (page routes already in _cf_static_pages are omitted)`,
);
console.log(
  `Largest Cloudflare static asset: ${(assetStats.largestBytes / 1024 / 1024).toFixed(2)} MiB (${assetStats.largestPath})`,
);

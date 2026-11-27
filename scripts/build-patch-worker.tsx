// Must stay first: src/lib/data-env.ts reads the environment when it is imported.
import "./load-build-env";
/* eslint-disable @next/next/no-css-tags, @next/next/no-head-element, @next/next/no-img-element, @next/next/no-sync-scripts */
import { fork } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import React, { type ReactNode } from "react";
import type { Metadata } from "next";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { build as buildClientBundle, stop as stopClientBundler, type Plugin } from "esbuild";
import {
  PatchDetailPage,
  getPatchDetailMetadata,
  getPatchSeoTitle,
} from "@/components/patches/patch-detail-page";
import {
  PatchListPage,
  getPatchListMetadata,
} from "@/components/patches/patch-list-page";
import {
  getResourcePatchIndexMetadata,
  ResourcePatchIndexPage,
} from "@/components/patches/resource-patch-index-page";
import {
  getNeowsletterDetailMetadata,
  NeowsletterDetailPage,
} from "@/components/patches/neowsletter-detail-page";
import {
  getNeowsletterListMetadata,
  NeowsletterListPage,
} from "@/components/patches/neowsletter-list-page";
import { NotFoundView } from "@/components/not-found-view";
import { loadPatchBuildCompendiumResourceManifest } from "@/lib/compendium-resource-manifest";
import { CompendiumDetailLinksProvider } from "@/components/compendium-detail-links";
import {
  GAME_LOCALE_PATH_SEGMENTS,
  GAME_LOCALE_NATIVE_LABELS,
  gameLocaleFromPathSegment,
  getServiceLocaleForGameLocale,
  localizeHrefWithGameLocale,
  switchGameLocaleHref,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { UNSET_PROFILE_TOKEN_URL } from "@/lib/user-profile";
import { getContactHref } from "@/lib/contact-routing";
import { COLOR_SCHEME_BOOT_SCRIPT, THEME_COLOR_DARK } from "@/lib/color-scheme";
import { getSTS2Patches } from "@/lib/data";
import { getNeowsletters } from "@/lib/neowsletters";
import { getSiteOrigin } from "@/lib/site-origin";
import {
  searchCanonicalPath,
  searchLanguageAlternatePaths,
} from "@/lib/search-canonical";
import { serviceMessages } from "@/messages/service";
import { PATCH_NOT_FOUND_KO_SEGMENT, patchNotFoundAssetPath } from "../workers/patch-not-found";
import { LATEST_PATCH_VERSION_ASSET } from "../workers/patch-worker-assets";
import { contactMessages } from "@/messages/contact";
import {
  gameOnlyLanguageNavLocales,
  serviceLanguageNavLocales,
} from "@/lib/site-nav-items";
import { SiteTopBar } from "@/components/site-top-bar";
import { topBarMenuRows, topBarPatchLinks } from "@/lib/top-bar-menu";

// 840 pages load the same catalogs: parse each data file once per process (src/lib/read-json-file.ts).
process.env.JSON_FILE_MEMO ??= "1";

type StaticPatchRoute = {
  pathname: string;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  element: ReactNode;
  metadata: Metadata;
  clientScripts?: string[];
  article?: {
    headline: string;
    datePublished: string;
    sourceUrl: string | null;
  };
};

type RouteJob = () => Promise<StaticPatchRoute>;

const outDir = path.join(process.cwd(), ".patch-worker/assets");
const patchCommentsClientPath = path.join(
  process.cwd(),
  "src/components/patches/patch-comments-client.js",
);
const patchNavIndicatorsClientPath = path.join(
  process.cwd(),
  "src/components/patches/patch-nav-indicators-client.ts",
);
const patchRichCommentsClientPath = path.join(
  process.cwd(),
  "src/components/patches/patch-rich-comments-client.tsx",
);
const patchStaticSpineClientPath = path.join(
  process.cwd(),
  "src/components/patches/patch-static-spine-client.js",
);
const patchStaticCardPreviewClientPath = path.join(
  process.cwd(),
  "src/components/patches/patch-static-card-preview-client.ts",
);
const patchGlobalSearchClientPath = path.join(
  process.cwd(),
  "src/components/patches/patch-global-search-client.ts",
);
const resourcePatchIndexClientPath = path.join(
  process.cwd(),
  "src/components/patches/resource-patch-index-client.tsx",
);
const spinePlayerClientPath = path.join(
  process.cwd(),
  "node_modules/@esotericsoftware/spine-player/dist/iife/spine-player.min.js",
);
const cloudflareWebAnalyticsToken =
  process.env.NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN ||
  "a505206e64e843ba88936f23d296cd3b";

const patchClientNextShims: Plugin = {
  name: "patch-client-next-shims",
  setup(build) {
    build.onResolve({ filter: /^next\/(?:dynamic|image|link|navigation)$/ }, (args) => ({
      path: args.path,
      namespace: "patch-next-shim",
    }));
    build.onLoad({ filter: /.*/, namespace: "patch-next-shim" }, (args) => {
      if (args.path === "next/dynamic") {
        return {
          loader: "tsx",
          resolveDir: process.cwd(),
          contents: `
            import React from "react";
            export default function dynamic(loader, options = {}) {
              const LazyComponent = React.lazy(async () => {
                const component = await loader();
                return { default: component.default ?? component };
              });
              return function DynamicComponent(props) {
                const fallback = options.loading ? React.createElement(options.loading) : null;
                return React.createElement(
                  React.Suspense,
                  { fallback },
                  React.createElement(LazyComponent, props),
                );
              };
            }
          `,
        };
      }

      if (args.path === "next/link") {
        return {
          loader: "tsx",
          resolveDir: process.cwd(),
          contents: `
            import React from "react";
            const Link = React.forwardRef(function Link({ href, children, ...props }, ref) {
              const resolvedHref = typeof href === "string" ? href : href?.pathname ?? "#";
              return React.createElement("a", { ...props, ref, href: resolvedHref }, children);
            });
            export default Link;
          `,
        };
      }

      if (args.path === "next/image") {
        return {
          loader: "tsx",
          resolveDir: process.cwd(),
          contents: `
            import React from "react";
            const Image = React.forwardRef(function Image({
              src,
              alt = "",
              fill = false,
              priority,
              quality,
              unoptimized,
              placeholder,
              blurDataURL,
              style,
              ...props
            }, ref) {
              void quality;
              void unoptimized;
              void placeholder;
              void blurDataURL;
              const resolvedSrc = typeof src === "string" ? src : src?.src ?? "";
              const resolvedStyle = fill
                ? { position: "absolute", inset: 0, width: "100%", height: "100%", ...style }
                : style;
              return React.createElement("img", {
                ...props,
                ref,
                alt,
                loading: priority ? "eager" : props.loading,
                src: resolvedSrc,
                style: resolvedStyle,
              });
            });
            export default Image;
          `,
        };
      }

      return {
        loader: "js",
        contents: `export function usePathname() { return window.location.pathname; }`,
      };
    });
  },
};

function escapeInlineJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function metadataTitle(metadata: StaticPatchRoute["metadata"], fallback: string): string {
  const title = metadata.title;
  if (typeof title === "string") return title;
  if (title && typeof title === "object") {
    if ("absolute" in title && typeof title.absolute === "string") return title.absolute;
    if ("default" in title && typeof title.default === "string") return title.default;
  }
  return fallback;
}

function metadataDescription(metadata: StaticPatchRoute["metadata"]): string {
  return typeof metadata.description === "string" ? metadata.description : "";
}

function metadataImage(metadata: StaticPatchRoute["metadata"]): string | null {
  const openGraphImages = metadata.openGraph?.images;
  const image = Array.isArray(openGraphImages) ? openGraphImages[0] : openGraphImages;
  if (!image) return null;
  if (typeof image === "string") return image;
  if (image instanceof URL) return image.toString();
  if (image.url instanceof URL) return image.url.toString();
  return typeof image.url === "string" ? image.url : null;
}

function StaticPatchHeader({
  serviceLocale,
  gameLocale,
  pathname,
}: {
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  pathname: string;
}) {
  const messages = serviceMessages[serviceLocale];
  const placeCopy = messages.placeIndex;
  const searchCopy = messages.globalSearch.placeholder;
  const languages = [...serviceLanguageNavLocales, ...gameOnlyLanguageNavLocales].map((locale) => ({
    locale,
    href: switchGameLocaleHref(pathname, locale),
    label: GAME_LOCALE_NATIVE_LABELS[locale],
    active: locale === gameLocale,
    gameOnly: !(serviceLanguageNavLocales as readonly GameLocale[]).includes(locale),
  }));

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm" data-top-bar>
      <SiteTopBar
        brand={{ href: localizeHrefWithGameLocale("/", serviceLocale, gameLocale), label: messages.brand }}
        patches={{
          href: localizeHrefWithGameLocale("/patches", serviceLocale, gameLocale),
          label: messages.nav.patches,
          items: topBarPatchLinks(serviceLocale, gameLocale),
          attentionMarker: "patches",
        }}
        menu={{
          label: placeCopy.menu,
          rows: topBarMenuRows(serviceLocale, gameLocale),
          newLabel: placeCopy.newLabel,
          moreLabel: placeCopy.more,
          allHref: localizeHrefWithGameLocale("/menu", serviceLocale, gameLocale),
          allLabel: placeCopy.menuTitle,
          attentionMarker: "toy-box",
        }}
        search={(
          <button
            type="button"
            data-patch-global-search-trigger
            aria-controls="patch-global-search-overlay"
            aria-expanded="false"
            aria-label={searchCopy}
            className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2.5 text-left text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-white/[0.07] sm:max-w-[18rem] lg:max-w-[22rem]"
          >
            <svg className="h-4 w-4 shrink-0 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span className="min-w-0 flex-1 truncate">{searchCopy}</span>
            <kbd className="hidden shrink-0 rounded border border-white/10 bg-black/20 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 sm:inline">
              ⌘K
            </kbd>
          </button>
        )}
        profile={{
          href: localizeHrefWithGameLocale("/profile", serviceLocale, gameLocale),
          label: messages.profile.navLabel,
          icon: (
            <img src={UNSET_PROFILE_TOKEN_URL} alt="" width={24} height={24} data-profile-character-icon className="h-[18px] w-[18px] object-contain sm:h-6 sm:w-6" />
          ),
          languageLabel: messages.languageSelect,
          languages,
        }}
      />
    </header>
  );
}

function StaticMailboxLauncher({
  serviceLocale,
  gameLocale,
  pathname,
}: {
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  pathname: string;
}) {
  const label = contactMessages[serviceLocale].navLabel;
  return (
    <a
      href={getContactHref(pathname, serviceLocale, gameLocale)}
      aria-label={label}
      data-contact-launcher="floating"
      className="group fixed right-3 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background/90 shadow-[0_8px_28px_rgba(0,0,0,0.18)] backdrop-blur-sm transition-[border-color,background-color,transform] bottom-[calc(0.75rem+env(safe-area-inset-bottom))] hover:-translate-y-0.5 hover:border-primary/45 hover:bg-muted"
    >
      <span className="relative inline-flex h-8 w-8 items-center justify-center">
        <img src="/images/sts2/relics/tiny_mailbox.webp" alt="" width={34} height={34} className="h-full w-full object-contain drop-shadow-md transition-transform group-hover:scale-110" />
        <span hidden data-nav-attention="mailbox" className="nav-attention-dot" />
      </span>
    </a>
  );
}

function StaticGlobalSearchOverlay({ serviceLocale }: { serviceLocale: ServiceLocale }) {
  const copy = serviceMessages[serviceLocale].globalSearch;

  return (
    <div
      id="patch-global-search-overlay"
      data-patch-global-search-overlay
      data-empty-message={copy.empty}
      data-loading-message={copy.loading}
      data-no-results-message={copy.noResults}
      data-load-failed-message={copy.loadFailed}
      data-sts1-prefix={copy.sts1Prefix}
      data-type-labels={JSON.stringify(copy.labels)}
      role="dialog"
      aria-modal="true"
      aria-label={copy.placeholder}
      className="fixed inset-0 z-[1000] px-3 pt-16 sm:pt-24"
      hidden
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
      <div
        data-patch-global-search-panel
        className="relative z-10 mx-auto w-full max-w-xl overflow-hidden rounded-lg border border-white/10 bg-[#111827] shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
          <svg className="h-4 w-4 shrink-0 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            data-patch-global-search-input
            aria-label={copy.placeholder}
            placeholder={copy.placeholder}
            className="h-10 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
            inputMode="search"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
        <div
          data-patch-global-search-results
          aria-live="polite"
          className="max-h-[min(28rem,calc(100dvh-9rem))] overflow-y-auto p-1.5"
        >
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            {copy.empty}
          </div>
        </div>
      </div>
    </div>
  );
}

function routeOutputPath(pathname: string): string {
  const stripped = pathname.replace(/^\/+|\/+$/g, "");
  const normalized = stripped || "index";
  return path.join(outDir, normalized, "index.html");
}

function renderShell(route: StaticPatchRoute): string {
  const siteOrigin = getSiteOrigin().replace(/\/$/, "");
  const title = metadataTitle(route.metadata, route.serviceLocale === "ko" ? "슬서운 변경" : "Scare the Changes");
  const description = metadataDescription(route.metadata);
  const image = metadataImage(route.metadata);
  // ko and en are self-canonical; other game locales fold into /en.
  const canonicalUrl = `${siteOrigin}${searchCanonicalPath(route.pathname)}`;
  const languageAlternates = Object.entries(searchLanguageAlternatePaths(route.pathname))
    .map(([hrefLang, alternatePath]) => ({ hrefLang, href: `${siteOrigin}${alternatePath}` }));
  const lang = route.serviceLocale === "ko" ? "ko" : "en";
  const articleStructuredData = route.article ? {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: route.article.headline,
    description,
    ...(image ? { image: [image] } : {}),
    datePublished: route.article.datePublished,
    inLanguage: lang,
    mainEntityOfPage: canonicalUrl,
    author: {
      "@type": "Organization",
      name: serviceMessages[route.serviceLocale].brand,
      url: siteOrigin,
    },
    publisher: {
      "@type": "Organization",
      name: serviceMessages[route.serviceLocale].brand,
      url: siteOrigin,
      logo: {
        "@type": "ImageObject",
        url: `${siteOrigin}/images/sts2/icons/app_icon.png`,
      },
    },
    ...(route.article.sourceUrl ? { isBasedOn: route.article.sourceUrl } : {}),
  } : null;
  const routeClientScripts = (route.clientScripts ?? [])
    .map((src) => `<script src="${src}" defer></script>`)
    .join("");
  const app = renderToStaticMarkup(
    <>
      <StaticPatchHeader
        serviceLocale={route.serviceLocale}
        gameLocale={route.gameLocale}
        pathname={route.pathname}
      />
      <StaticGlobalSearchOverlay serviceLocale={route.serviceLocale} />
      <main>
        <CompendiumDetailLinksProvider>{route.element}</CompendiumDetailLinksProvider>
      </main>
      <StaticMailboxLauncher
        serviceLocale={route.serviceLocale}
        gameLocale={route.gameLocale}
        pathname={route.pathname}
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `document.addEventListener("toggle",function(e){var d=e.target;if(!(d instanceof HTMLDetailsElement)||!d.matches("[data-static-nav-dropdown]")||!d.open)return;document.querySelectorAll("details[data-static-nav-dropdown][open]").forEach(function(o){if(o!==d)o.removeAttribute("open")})},true);document.addEventListener("pointerdown",function(e){document.querySelectorAll("details[data-static-nav-dropdown][open]").forEach(function(d){if(!d.contains(e.target))d.removeAttribute("open")})});document.addEventListener("keydown",function(e){if(e.key==="Escape")document.querySelectorAll("details[data-static-nav-dropdown][open]").forEach(function(d){d.removeAttribute("open")})});`,
        }}
      />
    </>,
  );
  const cloudflareWebAnalytics = renderToStaticMarkup(
    <script
      type="module"
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={JSON.stringify({ token: cloudflareWebAnalyticsToken })}
    />,
  );

  return `<!doctype html>${renderToStaticMarkup(
    <html
      lang={lang}
      data-service-locale={route.serviceLocale}
      data-game-locale={route.gameLocale}
      className="patch-static-fonts"
    >
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content={THEME_COLOR_DARK} />
        <script dangerouslySetInnerHTML={{ __html: COLOR_SCHEME_BOOT_SCRIPT }} />
        <title>{title}</title>
        {description && <meta name="description" content={description} />}
        <link rel="canonical" href={canonicalUrl} />
        {languageAlternates.map(({ hrefLang, href }) => (
          <link key={hrefLang} rel="alternate" hrefLang={hrefLang} href={href} />
        ))}
        <link rel="preload" href="/fonts/GyeonggiCheonnyeonBatangBold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="stylesheet" href="/_patches/patch.css" />
        <link rel="icon" href="/favicon.ico" />
        <meta property="og:title" content={title} />
        {description && <meta property="og:description" content={description} />}
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:locale" content={lang === "ko" ? "ko_KR" : "en_US"} />
        <meta property="og:type" content={route.article ? "article" : "website"} />
        {route.article && <meta property="article:published_time" content={route.article.datePublished} />}
        {image && <meta property="og:image" content={image} />}
        <meta name="twitter:card" content="summary_large_image" />
        {articleStructuredData && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: escapeInlineJson(articleStructuredData) }}
          />
        )}
      </head>
      <body
        className="font-service antialiased bg-background text-foreground"
        dangerouslySetInnerHTML={{
          // Only the data env (step 6): patch-comments-client.js calls the same-origin /api, and the
          // value must match the Worker's API_DATA_ENV (src/lib/data-env.ts).
          __html: `${app}<script id="sts-patch-comments-config" type="application/json">${escapeInlineJson({
            dataEnv: process.env.NEXT_PUBLIC_SUPABASE_ENV ?? "production",
          })}</script><script src="/_patches/patch-nav-indicators.js" defer></script><script src="/_patches/patch-global-search.js" defer></script><script src="/_patches/patch-static-card-preview.js" defer></script><script src="/_patches/patch-static-spine.js" defer></script><script src="/_patches/patch-rich-comments.js" defer></script><script src="/_patches/patch-comments.js" defer></script>${routeClientScripts}${cloudflareWebAnalytics}`,
        }}
      />
    </html>,
  )}`;
}

async function writePatchClientAssets() {
  const clientAssets = [
    [patchCommentsClientPath, path.join(outDir, "_patches/patch-comments.js")],
    [patchStaticSpineClientPath, path.join(outDir, "_patches/patch-static-spine.js")],
    [spinePlayerClientPath, path.join(outDir, "_patches/spine-player.min.js")],
  ] as const;

  for (const [sourcePath, destinationPath] of clientAssets) {
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.copyFile(sourcePath, destinationPath);
  }

  await buildClientBundle({
    entryPoints: [patchStaticCardPreviewClientPath],
    outfile: path.join(outDir, "_patches/patch-static-card-preview.js"),
    bundle: true,
    minify: true,
    platform: "browser",
    format: "iife",
    target: ["es2022"],
  });

  // Browser bundles must not read Node `process` at runtime. Replace every
  // NEXT_PUBLIC_* / SITE_* env access the client graph may touch. Step 6: the
  // bundles name no Supabase project or key, only the data env (src/lib/data-env.ts).
  const patchClientEnvDefines = {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process.env.NEXT_PUBLIC_SUPABASE_ENV": JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_ENV ?? "production"),
    "process.env.NEXT_PUBLIC_SITE_ORIGIN": JSON.stringify(process.env.NEXT_PUBLIC_SITE_ORIGIN ?? ""),
    "process.env.NEXT_PUBLIC_SITE_URL": JSON.stringify(process.env.NEXT_PUBLIC_SITE_URL ?? ""),
    "process.env.SITE_URL": JSON.stringify(process.env.SITE_URL ?? ""),
  };

  await buildClientBundle({
    entryPoints: [patchRichCommentsClientPath],
    outfile: path.join(outDir, "_patches/patch-rich-comments.js"),
    bundle: true,
    minify: true,
    platform: "browser",
    format: "iife",
    target: ["es2022"],
    plugins: [patchClientNextShims],
    define: patchClientEnvDefines,
  });

  await buildClientBundle({
    entryPoints: [patchNavIndicatorsClientPath],
    outfile: path.join(outDir, "_patches/patch-nav-indicators.js"),
    bundle: true,
    minify: true,
    platform: "browser",
    format: "iife",
    target: ["es2022"],
    plugins: [patchClientNextShims],
    define: patchClientEnvDefines,
  });

  await buildClientBundle({
    entryPoints: [patchGlobalSearchClientPath],
    outfile: path.join(outDir, "_patches/patch-global-search.js"),
    bundle: true,
    minify: true,
    platform: "browser",
    format: "iife",
    target: ["es2022"],
  });

  await buildClientBundle({
    entryPoints: [resourcePatchIndexClientPath],
    outfile: path.join(outDir, "_patches/resource-patch-index.js"),
    bundle: true,
    minify: true,
    platform: "browser",
    format: "iife",
    target: ["es2022"],
    plugins: [patchClientNextShims],
    define: patchClientEnvDefines,
  });
  stopClientBundler();
}

async function writeRoute(route: StaticPatchRoute) {
  const filePath = routeOutputPath(route.pathname);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${renderShell(route)}\n`);
  console.log(`Wrote ${path.relative(process.cwd(), filePath)}`);
}

async function writeNotFoundPages() {
  const pages = [
    { segment: PATCH_NOT_FOUND_KO_SEGMENT, pathname: "/patches", gameLocale: "kor" as GameLocale },
    ...GAME_LOCALE_PATH_SEGMENTS.map((segment) => {
      const gameLocale = gameLocaleFromPathSegment(segment);
      if (!gameLocale) throw new Error(`Unsupported game locale segment: ${segment}`);
      return { segment, pathname: `/${segment}/patches`, gameLocale };
    }),
  ];
  for (const { segment, pathname, gameLocale } of pages) {
    const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
    const messages = serviceMessages[serviceLocale];
    const filePath = path.join(outDir, patchNotFoundAssetPath(segment));
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${renderShell({
      pathname,
      serviceLocale,
      gameLocale,
      metadata: { title: `${messages.notFound.title} - ${messages.brand}` },
      element: (
        <NotFoundView
          serviceLocale={serviceLocale}
          pathPrefix={segment === PATCH_NOT_FOUND_KO_SEGMENT ? "" : `/${segment}`}
        />
      ),
    })}\n`);
  }
  console.log(`Wrote ${pages.length} not-found pages`);
}

async function localizedPatchRoutes(version?: string) {
  return GAME_LOCALE_PATH_SEGMENTS.map((segment) => {
    const gameLocale = gameLocaleFromPathSegment(segment);
    if (!gameLocale) throw new Error(`Unsupported game locale segment: ${segment}`);
    const pathname = version ? `/${segment}/patches/${version}` : `/${segment}/patches`;
    return {
      pathname,
      gameLocale,
      serviceLocale: getServiceLocaleForGameLocale(gameLocale),
    };
  });
}

/** Every page in build order; each job renders its route only when called. */
async function routeJobs(): Promise<RouteJob[]> {
  const jobs: RouteJob[] = [];
  const patches = await getSTS2Patches();
  jobs.push(async () => ({
    pathname: "/patches",
    serviceLocale: "ko",
    gameLocale: "kor",
    metadata: getPatchListMetadata("ko"),
    element: await PatchListPage({ serviceLocale: "ko", gameLocale: "kor" }),
  }));

  for (const route of await localizedPatchRoutes()) {
    jobs.push(async () => ({
      ...route,
      metadata: getPatchListMetadata(route.serviceLocale),
      element: await PatchListPage({
        serviceLocale: route.serviceLocale,
        gameLocale: route.gameLocale,
      }),
    }));
  }

  jobs.push(async () => ({
    pathname: "/patches/changes",
    serviceLocale: "ko",
    gameLocale: "kor",
    metadata: getResourcePatchIndexMetadata("ko"),
    element: await ResourcePatchIndexPage({
      serviceLocale: "ko",
      gameLocale: "kor",
      renderHydratableHtml: renderToString,
    }),
    clientScripts: ["/_patches/resource-patch-index.js"],
  }));

  for (const route of await localizedPatchRoutes("changes")) {
    jobs.push(async () => ({
      ...route,
      metadata: getResourcePatchIndexMetadata(route.serviceLocale),
      element: await ResourcePatchIndexPage({
        serviceLocale: route.serviceLocale,
        gameLocale: route.gameLocale,
        renderHydratableHtml: renderToString,
      }),
      clientScripts: ["/_patches/resource-patch-index.js"],
    }));
  }

  const neowsletters = await getNeowsletters();
  jobs.push(async () => ({
    pathname: "/patches/neowsletters",
    serviceLocale: "ko",
    gameLocale: "kor",
    metadata: getNeowsletterListMetadata("ko"),
    element: await NeowsletterListPage({ serviceLocale: "ko", gameLocale: "kor" }),
  }));

  for (const route of await localizedPatchRoutes("neowsletters")) {
    jobs.push(async () => ({
      ...route,
      metadata: getNeowsletterListMetadata(route.serviceLocale),
      element: await NeowsletterListPage({
        serviceLocale: route.serviceLocale,
        gameLocale: route.gameLocale,
      }),
    }));
  }

  for (const issue of neowsletters) {
    jobs.push(async () => ({
      pathname: `/patches/neowsletters/${issue.id}`,
      serviceLocale: "ko",
      gameLocale: "kor",
      metadata: await getNeowsletterDetailMetadata({
        issueId: issue.id,
        serviceLocale: "ko",
      }),
      element: await NeowsletterDetailPage({
        issueId: issue.id,
        serviceLocale: "ko",
        gameLocale: "kor",
        staticHoverPreviews: true,
      }),
      article: {
        headline: issue.titleKo,
        datePublished: issue.date,
        sourceUrl: issue.sourceUrl,
      },
    }));

    for (const route of await localizedPatchRoutes(`neowsletters/${issue.id}`)) {
      jobs.push(async () => ({
        ...route,
        metadata: await getNeowsletterDetailMetadata({
          issueId: issue.id,
          serviceLocale: route.serviceLocale,
        }),
        element: await NeowsletterDetailPage({
          issueId: issue.id,
          serviceLocale: route.serviceLocale,
          gameLocale: route.gameLocale,
          staticHoverPreviews: true,
        }),
        article: {
          headline: route.serviceLocale === "ko" ? issue.titleKo : issue.title,
          datePublished: issue.date,
          sourceUrl: issue.sourceUrl,
        },
      }));
    }
  }

  for (const patch of patches) {
    const { version } = patch;
    const isPublished = !patch.status || patch.status === "ready";
    jobs.push(async () => ({
      pathname: `/patches/${version}`,
      serviceLocale: "ko",
      gameLocale: "kor",
      metadata: await getPatchDetailMetadata({ version, serviceLocale: "ko" }),
      element: await PatchDetailPage({
        version,
        serviceLocale: "ko",
        gameLocale: "kor",
        staticHoverPreviews: true,
      }),
      article: isPublished ? {
        headline: getPatchSeoTitle(patch, "ko"),
        datePublished: patch.date,
        sourceUrl: patch.steamUrl,
      } : undefined,
    }));

    for (const route of await localizedPatchRoutes(version)) {
      jobs.push(async () => ({
        ...route,
        metadata: await getPatchDetailMetadata({
          version,
          serviceLocale: route.serviceLocale,
        }),
        element: await PatchDetailPage({
          version,
          serviceLocale: route.serviceLocale,
          gameLocale: route.gameLocale,
          staticHoverPreviews: true,
        }),
        article: isPublished ? {
          headline: getPatchSeoTitle(patch, route.serviceLocale),
          datePublished: patch.date,
          sourceUrl: patch.steamUrl,
        } : undefined,
      }));
    }
  }
  return jobs;
}

const SHARD_FLAG = "--shard=";

/** Renders every `count`-th route job from `index`; the parent runs one of these per core. */
async function renderShard(index: number, count: number) {
  const jobs = await routeJobs();
  for (let job = index; job < jobs.length; job += count) {
    await writeRoute(await jobs[job]());
  }
}

function runShard(index: number, count: number, env: NodeJS.ProcessEnv): Promise<void> {
  // fork keeps process.execArgv, so each child loads through tsx like this process.
  const child = fork(process.argv[1], [`${SHARD_FLAG}${index}/${count}`], { env, stdio: "inherit" });
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`patch html shard ${index}/${count} exited with ${signal ?? code}`));
    });
  });
}

async function main() {
  const shard = process.argv.find((arg) => arg.startsWith(SHARD_FLAG));
  if (shard) {
    const [index, count] = shard.slice(SHARD_FLAG.length).split("/").map(Number);
    await renderShard(index, count);
    return;
  }

  await writePatchClientAssets();
  if (process.argv.includes("--clients-only")) return;

  await writeNotFoundPages();
  // Same order as the patch list (patch-list-page.tsx): its first card is /patches/latest.
  const [latest] = [...await getSTS2Patches()].sort((a, b) => b.date.localeCompare(a.date));
  await fs.writeFile(path.join(outDir, LATEST_PATCH_VERSION_ASSET), latest.version);

  // One manifest read for the whole build, so every page and shard links the same resources.
  const manifestFile = path.join(outDir, "..", "compendium-resource-manifest.json");
  await fs.writeFile(manifestFile, JSON.stringify(await loadPatchBuildCompendiumResourceManifest()));
  const env = { ...process.env, PATCH_COMPENDIUM_MANIFEST_FILE: manifestFile };

  const count = Math.max(1, Number(process.env.PATCH_HTML_JOBS) || os.availableParallelism());
  console.log(`patch html: ${count} shards on ${os.availableParallelism()} cpus`);
  await Promise.all(Array.from({ length: count }, (_, index) => runShard(index, count, env)));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

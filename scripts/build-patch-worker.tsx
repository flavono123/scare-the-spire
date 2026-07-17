/* eslint-disable @next/next/no-css-tags, @next/next/no-head-element, @next/next/no-img-element */
import fs from "fs/promises";
import path from "path";
import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadEnvConfig } from "@next/env";
import { build as buildClientBundle, stop as stopClientBundler } from "esbuild";
import {
  PatchDetailPage,
  generatePatchDetailStaticParams,
  getPatchDetailMetadata,
} from "@/components/patches/patch-detail-page";
import {
  PatchListPage,
  getPatchListMetadata,
} from "@/components/patches/patch-list-page";
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
import { DEFAULT_USER_PROFILE, characterIconUrl } from "@/lib/user-profile";
import { getSiteOrigin } from "@/lib/site-origin";
import { serviceMessages } from "@/messages/service";
import {
  gameOnlyLanguageNavLocales,
  getToyBoxNavItems,
  legacySts1NavItems,
  localizeCodexNavItems,
  serviceLanguageNavLocales,
  sts1NavItems,
  sts2NavItems,
  type NavDropdownItem,
} from "@/lib/site-nav-items";

type StaticPatchRoute = {
  pathname: string;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  element: ReactNode;
  metadata: Awaited<ReturnType<typeof getPatchDetailMetadata>> | ReturnType<typeof getPatchListMetadata>;
};

loadEnvConfig(process.cwd());

const outDir = path.join(process.cwd(), ".patch-worker/assets");
const patchCommentsClientPath = path.join(
  process.cwd(),
  "src/components/patches/patch-comments-client.js",
);
const patchStaticSpineClientPath = path.join(
  process.cwd(),
  "src/components/patches/patch-static-spine-client.js",
);
const patchGlobalSearchClientPath = path.join(
  process.cwd(),
  "src/components/patches/patch-global-search-client.ts",
);
const spinePlayerClientPath = path.join(
  process.cwd(),
  "node_modules/@esotericsoftware/spine-player/dist/iife/spine-player.min.js",
);

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

function StaticNavIconLink({
  href,
  icon,
  label,
  active = false,
  iconSize = 22,
  profileCharacterIcon = false,
}: {
  href: string;
  icon: string;
  label: string;
  active?: boolean;
  iconSize?: number;
  profileCharacterIcon?: boolean;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      title={label}
      className={`group inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors ${
        active
          ? "border-yellow-500/35 bg-yellow-500/10"
          : "border-transparent hover:border-yellow-500/25 hover:bg-white/[0.05]"
      }`}
    >
      <img
        src={icon}
        alt=""
        width={iconSize}
        height={iconSize}
        data-profile-character-icon={profileCharacterIcon ? "" : undefined}
        className="object-contain transition-transform group-hover:scale-110"
        style={{ width: iconSize, height: iconSize }}
      />
    </a>
  );
}

function StaticGameDropdown({
  icon,
  alt,
  items,
  align = "right",
}: {
  icon: string;
  alt: string;
  items: NavDropdownItem[];
  align?: "left" | "right";
}) {
  return (
    <details data-static-nav-dropdown className="patch-static-dropdown relative group">
      <summary
        className="flex cursor-pointer items-center gap-0.5 rounded-md px-1 py-1 transition-colors hover:bg-white/5 sm:gap-1 sm:px-1.5"
        title={alt}
        aria-label={alt}
      >
        <img
          src={icon}
          alt={alt}
          width={28}
          height={28}
          className="h-6 w-6 rounded-sm object-contain brightness-90 transition-all group-open:brightness-125 hover:brightness-110 sm:h-7 sm:w-7"
        />
        <svg
          className="hidden h-3 w-3 text-muted-foreground transition-transform group-open:rotate-180 sm:block"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div
        className={`absolute top-full z-50 mt-1 min-w-[140px] rounded-md border border-border bg-background py-1 shadow-lg ${
          align === "right" ? "right-0" : "left-0"
        }`}
      >
        {items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex items-center gap-2.5 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          >
            <img src={item.icon} alt="" width={18} height={18} className="shrink-0 object-contain" />
            <span className="whitespace-nowrap">{item.label}</span>
          </a>
        ))}
      </div>
    </details>
  );
}

function StaticLanguageDropdown({
  pathname,
  value,
  label,
}: {
  pathname: string;
  value: GameLocale;
  label: string;
}) {
  return (
    <details data-static-nav-dropdown className="patch-static-dropdown relative group">
      <summary
        className="flex h-8 min-w-[4.5rem] max-w-[5.5rem] cursor-pointer items-center justify-between gap-1 rounded-md border border-border bg-background/80 px-2 text-left text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-white/5 sm:min-w-[5.75rem] sm:max-w-[8.25rem] sm:gap-2 sm:px-2.5 sm:text-sm"
        aria-label={label}
        title={label}
      >
        <span className="truncate">{GAME_LOCALE_NATIVE_LABELS[value]}</span>
        <svg
          className="h-3.5 w-3.5 shrink-0 text-yellow-400 transition-transform group-open:rotate-180 sm:h-4 sm:w-4"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M10 14.5 3.5 5.5h13L10 14.5Z" />
        </svg>
      </summary>
      <div className="absolute right-0 top-full z-50 mt-1 max-h-[min(32rem,calc(100vh-4rem))] w-[14.5rem] overflow-y-auto rounded-md border border-border bg-background/95 py-1 shadow-xl">
        {serviceLanguageNavLocales.map((locale) => (
          <a
            key={locale}
            href={switchGameLocaleHref(pathname, locale)}
            aria-current={locale === value ? "true" : undefined}
            className={`flex items-center justify-between gap-3 px-3 py-2 text-sm transition-colors ${
              locale === value
                ? "bg-yellow-500/10 text-yellow-300"
                : "text-foreground hover:bg-white/5"
            }`}
          >
            <span className="truncate text-base font-semibold" title={GAME_LOCALE_NATIVE_LABELS[locale]}>
              {GAME_LOCALE_NATIVE_LABELS[locale]}
            </span>
          </a>
        ))}
        <div className="my-1 border-t border-border/70 px-3 pb-1 pt-2">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-200/70">
            only game locale
          </span>
        </div>
        {gameOnlyLanguageNavLocales.map((locale) => (
          <a
            key={locale}
            href={switchGameLocaleHref(pathname, locale)}
            aria-current={locale === value ? "true" : undefined}
            className={`block px-3 py-2 text-sm transition-colors ${
              locale === value
                ? "bg-yellow-500/10 text-yellow-300"
                : "text-foreground hover:bg-white/5"
            }`}
          >
            <span className="block truncate text-base font-semibold" title={GAME_LOCALE_NATIVE_LABELS[locale]}>
              {GAME_LOCALE_NATIVE_LABELS[locale]}
            </span>
          </a>
        ))}
      </div>
    </details>
  );
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
  const patchHref = localizeHrefWithGameLocale("/patches", serviceLocale, gameLocale);
  const profileHref = localizeHrefWithGameLocale("/profile", serviceLocale, gameLocale);
  const searchCopy = messages.globalSearch.placeholder;
  const toyBoxLabel = serviceLocale === "ko" ? "장난감 상자" : "Toy Box";
  const toyBoxItems = getToyBoxNavItems({ serviceLocale, gameLocale });
  const sts2Items = localizeCodexNavItems(sts2NavItems, serviceLocale, gameLocale, { useGameLabels: true });
  const sts1Items = legacySts1NavItems(sts1NavItems, serviceLocale);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex h-12 items-center gap-1.5 px-2 sm:gap-2 sm:px-4">
        <div className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-2">
          <a
            href={localizeHrefWithGameLocale("/", serviceLocale, gameLocale)}
            className="flex shrink-0 items-center gap-1 text-sm font-bold text-yellow-500 sm:gap-1.5 sm:text-base"
          >
            <img
              src="/images/bone_tea.png"
              alt=""
              width={22}
              height={22}
              className="h-[18px] w-[18px] object-contain sm:h-[22px] sm:w-[22px]"
            />
            <span className="max-[560px]:sr-only">{messages.brand}</span>
          </a>

          <StaticNavIconLink
            href={patchHref}
            icon="/images/sts2/nav/patch_notes_icon.png"
            label={messages.nav.patches}
            active
          />

          <StaticGameDropdown
            icon="/images/sts2/relics/toy_box.webp"
            alt={toyBoxLabel}
            items={toyBoxItems}
            align="left"
          />
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-0.5 sm:gap-1">
          <button
            type="button"
            data-patch-global-search-trigger
            aria-controls="patch-global-search-overlay"
            aria-expanded="false"
            aria-label={searchCopy}
            className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2.5 text-left text-sm text-muted-foreground transition-colors hover:border-yellow-500/40 hover:bg-white/[0.07] sm:max-w-[18rem] lg:max-w-[22rem]"
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

          <div className="hidden xl:block">
            <StaticLanguageDropdown
              pathname={pathname}
              value={gameLocale}
              label={messages.languageSelect}
            />
          </div>
          <StaticGameDropdown
            icon="/images/sts2/icons/app_icon.png"
            alt={messages.games.sts2Codex}
            items={sts2Items}
            align="right"
          />
          <StaticGameDropdown
            icon="/images/sts1_app_icon.png"
            alt={messages.games.sts1}
            items={sts1Items}
            align="right"
          />
          <StaticNavIconLink
            href={profileHref}
            icon={characterIconUrl(DEFAULT_USER_PROFILE.characterId)}
            label={messages.profile.navLabel}
            iconSize={24}
            profileCharacterIcon
          />
        </div>
      </div>
      <div className="sr-only">
        {toyBoxItems.map((item) => (
          <a key={item.href} href={item.href}>{item.label}</a>
        ))}
        {sts2Items.map((item) => (
          <a key={item.href} href={item.href}>{item.label}</a>
        ))}
        {sts1Items.map((item) => (
          <a key={item.href} href={item.href}>{item.label}</a>
        ))}
      </div>
    </header>
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
          <svg className="h-4 w-4 shrink-0 text-yellow-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
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
  const canonicalUrl = `${siteOrigin}${route.pathname}`;
  const lang = route.serviceLocale === "ko" ? "ko" : "en";
  const app = renderToStaticMarkup(
    <>
      <StaticPatchHeader
        serviceLocale={route.serviceLocale}
        gameLocale={route.gameLocale}
        pathname={route.pathname}
      />
      <StaticGlobalSearchOverlay serviceLocale={route.serviceLocale} />
      <main>{route.element}</main>
      <script
        dangerouslySetInnerHTML={{
          __html: `document.addEventListener("toggle",function(e){var d=e.target;if(!(d instanceof HTMLDetailsElement)||!d.matches("[data-static-nav-dropdown]")||!d.open)return;document.querySelectorAll("details[data-static-nav-dropdown][open]").forEach(function(o){if(o!==d)o.removeAttribute("open")})},true);document.addEventListener("pointerdown",function(e){document.querySelectorAll("details[data-static-nav-dropdown][open]").forEach(function(d){if(!d.contains(e.target))d.removeAttribute("open")})});document.addEventListener("keydown",function(e){if(e.key==="Escape")document.querySelectorAll("details[data-static-nav-dropdown][open]").forEach(function(d){d.removeAttribute("open")})});`,
        }}
      />
    </>,
  );

  return `<!doctype html>${renderToStaticMarkup(
    <html
      lang={lang}
      data-service-locale={route.serviceLocale}
      data-game-locale={route.gameLocale}
      className="dark patch-static-fonts"
    >
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        {description && <meta name="description" content={description} />}
        <link rel="canonical" href={canonicalUrl} />
        <link rel="preload" href="/fonts/GyeonggiCheonnyeonBatangBold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="stylesheet" href="/_patches/patch.css" />
        <link rel="icon" href="/favicon.ico" />
        <meta property="og:title" content={title} />
        {description && <meta property="og:description" content={description} />}
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="website" />
        {image && <meta property="og:image" content={image} />}
        <meta name="twitter:card" content="summary_large_image" />
      </head>
      <body
        className="font-service antialiased bg-background text-foreground"
        dangerouslySetInnerHTML={{
          __html: `${app}<script id="sts-patch-comments-config" type="application/json">${escapeInlineJson({
            supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
            supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
            supabaseEnv: process.env.NEXT_PUBLIC_SUPABASE_ENV ?? "production",
          })}</script><script src="/_patches/patch-global-search.js" defer></script><script src="/_patches/patch-static-spine.js" defer></script><script src="/_patches/patch-comments.js" defer></script>`,
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
    entryPoints: [patchGlobalSearchClientPath],
    outfile: path.join(outDir, "_patches/patch-global-search.js"),
    bundle: true,
    minify: true,
    platform: "browser",
    format: "iife",
    target: ["es2022"],
  });
  stopClientBundler();
}

async function writeRoute(route: StaticPatchRoute) {
  const filePath = routeOutputPath(route.pathname);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${renderShell(route)}\n`);
  console.log(`Wrote ${path.relative(process.cwd(), filePath)}`);
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

async function main() {
  await writePatchClientAssets();

  const versions = await generatePatchDetailStaticParams();
  const routes: StaticPatchRoute[] = [
    {
      pathname: "/patches",
      serviceLocale: "ko",
      gameLocale: "kor",
      metadata: getPatchListMetadata("ko"),
      element: await PatchListPage({ serviceLocale: "ko", gameLocale: "kor" }),
    },
  ];

  for (const route of await localizedPatchRoutes()) {
    routes.push({
      ...route,
      metadata: getPatchListMetadata(route.serviceLocale),
      element: await PatchListPage({
        serviceLocale: route.serviceLocale,
        gameLocale: route.gameLocale,
      }),
    });
  }

  for (const { version } of versions) {
    routes.push({
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
    });

    for (const route of await localizedPatchRoutes(version)) {
      routes.push({
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
      });
    }
  }

  await Promise.all(routes.map(writeRoute));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

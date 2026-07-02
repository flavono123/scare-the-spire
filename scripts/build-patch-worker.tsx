/* eslint-disable @next/next/no-css-tags, @next/next/no-head-element, @next/next/no-img-element */
import fs from "fs/promises";
import path from "path";
import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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
  gameLocaleFromPathSegment,
  getServiceLocaleForGameLocale,
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { getCodexNavGameLabel } from "@/lib/codex-nav-game-labels";
import { DEFAULT_USER_PROFILE, characterIconUrl } from "@/lib/user-profile";
import { getSiteOrigin } from "@/lib/site-origin";
import { serviceMessages } from "@/messages/service";

type StaticPatchRoute = {
  pathname: string;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  element: ReactNode;
  metadata: Awaited<ReturnType<typeof getPatchDetailMetadata>> | ReturnType<typeof getPatchListMetadata>;
};

const outDir = path.join(process.cwd(), ".patch-worker/assets");

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
}: {
  href: string;
  icon: string;
  label: string;
  active?: boolean;
  iconSize?: number;
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
        className="object-contain transition-transform group-hover:scale-110"
        style={{ width: iconSize, height: iconSize }}
      />
    </a>
  );
}

function StaticPatchHeader({
  serviceLocale,
  gameLocale,
}: {
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  const messages = serviceMessages[serviceLocale];
  const patchHref = localizeHrefWithGameLocale("/patches", serviceLocale, gameLocale);
  const chemicalHref = localizeHrefWithGameLocale("/chemical-x", serviceLocale, gameLocale);
  const historyHref = localizeHrefWithGameLocale("/history-course", serviceLocale, gameLocale);
  const compendiumHref = localizeHrefWithGameLocale("/compendium/cards", serviceLocale, gameLocale);
  const profileHref = localizeHrefWithGameLocale("/profile", serviceLocale, gameLocale);
  const searchCopy = serviceLocale === "ko" ? "통합 검색" : "Unified search";
  const toyBoxLabel = serviceLocale === "ko" ? "장난감 상자" : "Toy Box";
  const historyLabel = getCodexNavGameLabel(gameLocale, "historyCourse") ?? messages.nav.historyCourse;

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

          <a
            href={chemicalHref}
            aria-label={toyBoxLabel}
            title={toyBoxLabel}
            className="group inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-transparent transition-colors hover:border-yellow-500/25 hover:bg-white/[0.05]"
          >
            <img
              src="/images/sts2/relics/toy_box.webp"
              alt=""
              width={24}
              height={24}
              className="h-6 w-6 object-contain transition-transform group-hover:scale-110"
            />
          </a>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-0.5 sm:gap-1">
          <div
            className="hidden h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2.5 text-left text-sm text-muted-foreground sm:flex sm:max-w-[18rem] lg:max-w-[22rem]"
            aria-hidden="true"
          >
            <svg className="h-4 w-4 shrink-0 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span className="min-w-0 flex-1 truncate">{searchCopy}</span>
            <kbd className="hidden shrink-0 rounded border border-white/10 bg-black/20 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 sm:inline">
              ⌘K
            </kbd>
          </div>

          <StaticNavIconLink
            href={compendiumHref}
            icon="/images/sts2/icons/app_icon.png"
            label={messages.games.sts2Codex}
            iconSize={24}
          />
          <StaticNavIconLink
            href={historyHref}
            icon="/images/sts2/relics/history_course.webp"
            label={historyLabel}
            iconSize={24}
          />
          <StaticNavIconLink
            href={profileHref}
            icon={characterIconUrl(DEFAULT_USER_PROFILE.characterId)}
            label={messages.profile.navLabel}
            iconSize={24}
          />
        </div>
      </div>
      <div className="sr-only">
        <a href={chemicalHref}>{messages.nav.chemicalX}</a>
        <a href={historyHref}>{historyLabel}</a>
      </div>
    </header>
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
      <StaticPatchHeader serviceLocale={route.serviceLocale} gameLocale={route.gameLocale} />
      <main>{route.element}</main>
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
        dangerouslySetInnerHTML={{ __html: app }}
      />
    </html>,
  )}`;
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

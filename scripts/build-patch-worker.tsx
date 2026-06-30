/* eslint-disable @next/next/no-css-tags, @next/next/no-head-element, @next/next/no-html-link-for-pages */
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
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { getSiteOrigin } from "@/lib/site-origin";

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

function StaticPatchHeader({ serviceLocale }: { serviceLocale: ServiceLocale }) {
  const copy = serviceLocale === "ko"
    ? {
        brand: "슬서운 이야기",
        patches: "패치 노트",
        compendium: "모음집",
        chemical: "케미컬 X",
      }
    : {
        brand: "Scare the Spire",
        patches: "Patch Notes",
        compendium: "Compendium",
        chemical: "Chemical X",
      };

  return (
    <header className="border-b border-border bg-background/95">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <a href="/" className="font-game-title text-sm font-bold text-foreground">
          {copy.brand}
        </a>
        <nav className="ml-auto flex items-center gap-3 text-xs font-semibold text-muted-foreground">
          <a className="text-yellow-300" href="/patches">{copy.patches}</a>
          <a className="transition-colors hover:text-foreground" href="/compendium/cards">{copy.compendium}</a>
          <a className="transition-colors hover:text-foreground" href="/chemical-x">{copy.chemical}</a>
        </nav>
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
      <StaticPatchHeader serviceLocale={route.serviceLocale} />
      <main>{route.element}</main>
    </>,
  );

  return `<!doctype html>${renderToStaticMarkup(
    <html
      lang={lang}
      data-service-locale={route.serviceLocale}
      data-game-locale={route.gameLocale}
      className="dark"
    >
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        {description && <meta name="description" content={description} />}
        <link rel="canonical" href={canonicalUrl} />
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
      element: await PatchDetailPage({ version, serviceLocale: "ko", gameLocale: "kor" }),
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

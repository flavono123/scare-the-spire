/**
 * Request handling the main Worker reproduces from the Next/OpenNext runtime
 * it replaced, for paths no static branch serves. Each rule mirrors what
 * production returned before OpenNext was removed (same status, same
 * relative Location, no body), in the order OpenNext applied them.
 */

import { staticAssetAliasRedirectPath } from "./static-asset-aliases";
import { isGameLocalePrefix } from "./static-page-routing";

const PERMANENT_REDIRECT_STATUS = 308;

function relativeRedirect(location: string): Response {
  return new Response(null, {
    status: PERMANENT_REDIRECT_STATUS,
    headers: { Location: location },
  });
}

/** OpenNext answered Pages Router data requests (none exist here) with `{}`. */
export function nextDataNotFound(request: Request, url: URL): Response | null {
  if (!url.pathname.startsWith("/_next/data")) return null;
  return new Response(request.method === "HEAD" ? null : "{}", {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}

/** `/foo//bar` -> 308 `/foo/bar`, query kept. */
export function repeatedSlashRedirect(url: URL): Response | null {
  if (!url.pathname.includes("//")) return null;
  return relativeRedirect(`${url.pathname.replace(/\/\/+/g, "/")}${url.search}`);
}

/**
 * Next's default `skipTrailingSlashRedirect: false`: `/foo/` -> 308 `/foo`,
 * query kept. OpenNext skipped it for `/api/` paths, which Next then matched
 * as if the slash were absent.
 */
export function trailingSlashRedirect(url: URL): Response | null {
  const { pathname } = url;
  if (pathname === "/" || !pathname.endsWith("/") || pathname.startsWith("/api/")) return null;
  return relativeRedirect(`${pathname.slice(0, -1)}${url.search}`);
}

const KOREAN_LOCALE_ALIAS_SEGMENTS = new Set(["ko", "kor"]);

/**
 * next.config.ts redirects `/ko`, `/ko/:path*`, `/kor`, `/kor/:path*` to the
 * prefixless Korean path (permanent, case-sensitive, query kept).
 */
export function koreanLocaleAliasRedirect(url: URL): Response | null {
  const match = /^\/([^/]+)(\/.*)?$/.exec(url.pathname);
  if (!match || !KOREAN_LOCALE_ALIAS_SEGMENTS.has(match[1])) return null;
  return relativeRedirect(`${match[2] || "/"}${url.search}`);
}

/**
 * next.config.ts static asset alias redirects for what the Worker's GET/HEAD
 * alias branch does not catch: other methods, and `/api/...` aliases with a
 * trailing slash (no trailing-slash redirect there). Query kept, like OpenNext.
 */
export function staticAssetAliasConfigRedirect(url: URL): Response | null {
  const destination = staticAssetAliasRedirectPath(url.pathname.replace(/(.)\/$/, "$1"));
  return destination ? relativeRedirect(`${destination}${url.search}`) : null;
}

/**
 * `[gameLocale]` routes lowercased their segment, so OpenNext rendered
 * `/EN/...` as the `/en/...` page on demand (or failed with 500 where that
 * render needed data). Static assets exist only under the lowercase prefix,
 * so a case variant of a game locale prefix redirects there, query kept.
 */
export function gameLocaleCaseRedirect(url: URL): Response | null {
  const match = /^\/([^/]+)(\/.*)?$/.exec(url.pathname);
  if (!match) return null;
  const locale = match[1].toLowerCase();
  if (locale === match[1] || !isGameLocalePrefix(locale)) return null;
  return relativeRedirect(`/${locale}${match[2] ?? ""}${url.search}`);
}

/**
 * Applied in OpenNext order: data route, repeated slash, trailing slash,
 * config redirects. The game locale case redirect replaces on-demand renders.
 */
export function nextRoutingResponse(request: Request, url: URL): Response | null {
  return (
    nextDataNotFound(request, url)
    ?? repeatedSlashRedirect(url)
    ?? trailingSlashRedirect(url)
    ?? koreanLocaleAliasRedirect(url)
    ?? staticAssetAliasConfigRedirect(url)
    ?? gameLocaleCaseRedirect(url)
  );
}

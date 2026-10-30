type PatchWorkerBinding = {
  fetch(request: Request): Promise<Response>;
};

type AssetsBinding = {
  fetch(request: Request): Promise<Response>;
};

type Env = {
  ASSETS?: AssetsBinding;
  PATCH_WORKER?: PatchWorkerBinding;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  NEXT_PUBLIC_SUPABASE_ENV?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_ENV?: string;
};

type ExecutionContextLike = {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException?(): void;
};

import { getLegacyCompendiumDetailRedirectPath } from "../src/lib/compendium-resource-links";
import { handleLinkPreviewRequest, LINK_PREVIEW_PATH } from "../src/lib/link-preview-handler";
import { staticAssetAliasRedirectPath } from "./static-asset-aliases";
import { maybeEnrichServiceDetailShell } from "./detail-shell-og";
import { withLocalizedDocumentRoot } from "./document-locale";
import { nextRoutingResponse } from "./next-routing-parity";
import { redactPathname } from "./path-redaction";
import {
  legacyWorldcupDetailRedirectPath,
  prerenderedRedirect,
  staticCompendiumAssetPath,
  staticExactServicePageAssetPath,
  staticLegacyPageAssetPath,
  staticNotFoundAssetPath,
  staticServiceDetailShellAssetPath,
  staticServicePageAssetPath,
  sts2CompendiumAliasPath,
} from "./static-page-routing";

function isPatchWorkerPath(pathname: string): boolean {
  if (pathname === "/dev" || pathname.startsWith("/dev/")) return false;
  return (
    pathname === "/patches" ||
    pathname.startsWith("/patches/") ||
    pathname === "/_patches" ||
    pathname.startsWith("/_patches/") ||
    pathname.startsWith("/images/neowsletters/") ||
    /^\/[^/]+\/patches(?:\/|$)/.test(pathname)
  );
}

const GAME_LOCALE_PATH_SEGMENTS = new Set([
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
]);

function isRscRequest(request: Request, url: URL): boolean {
  return request.headers.get("rsc") === "1" || url.searchParams.has("_rsc");
}

/**
 * Query for a redirect that answers an RSC request. Keeping `_rsc` makes the
 * browser fetch (and cache) the RSC target under its own cache-busting URL,
 * never under the document URL.
 */
function rscRedirectSearch(request: Request, url: URL): string {
  return isRscRequest(request, url) ? url.search : "";
}

function isDocumentRequest(request: Request, url: URL): boolean {
  if (isRscRequest(request, url)) return false;

  const accept = request.headers.get("accept");
  return !accept || accept.includes("text/html") || accept.includes("*/*");
}

function localePathSegmentForLanguageTag(languageTag: string): string | null {
  const tag = languageTag.toLowerCase();
  if (tag === "ko" || tag.startsWith("ko-")) return "";
  if (tag === "zh" || tag.startsWith("zh-")) return "zh";
  if (tag === "es-419" || tag.startsWith("es-419-")) return "es-419";
  if (tag === "pt-br" || tag.startsWith("pt-br-")) return "pt";

  const primary = tag.split("-")[0];
  if (GAME_LOCALE_PATH_SEGMENTS.has(primary)) return primary;
  return null;
}

function preferredLocalePathSegment(request: Request): string {
  const acceptLanguage = request.headers.get("accept-language");
  if (!acceptLanguage) return "";

  const candidates = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag = "", ...parameters] = part.trim().split(";");
      const qParameter = parameters.find((parameter) => parameter.trim().startsWith("q="));
      const q = qParameter ? Number(qParameter.trim().slice(2)) : 1;
      return {
        index,
        q: Number.isFinite(q) ? q : 0,
        tag: tag.trim(),
      };
    })
    .filter((candidate) => candidate.tag && candidate.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);

  for (const candidate of candidates) {
    const pathSegment = localePathSegmentForLanguageTag(candidate.tag);
    if (pathSegment !== null) return pathSegment;
  }

  return "";
}

function maybeRedirectRootToPreferredLocale(request: Request, url: URL): Response | null {
  if ((request.method !== "GET" && request.method !== "HEAD") || url.pathname !== "/") return null;
  if (!isDocumentRequest(request, url)) return null;

  const pathSegment = preferredLocalePathSegment(request);
  if (!pathSegment) return null;

  const redirectUrl = new URL(request.url);
  redirectUrl.pathname = `/${pathSegment}`;
  return Response.redirect(redirectUrl.toString(), 302);
}

function maybeRedirectLegacyCompendiumDetail(request: Request, url: URL): Response | null {
  if ((request.method !== "GET" && request.method !== "HEAD") || !isDocumentRequest(request, url)) {
    return null;
  }

  const redirectPath = getLegacyCompendiumDetailRedirectPath(url);
  if (!redirectPath) return null;

  const redirectUrl = new URL(request.url);
  redirectUrl.pathname = redirectPath;
  redirectUrl.search = "";
  redirectUrl.hash = "";
  return new Response(null, {
    status: 308,
    headers: {
      "Cache-Control": "public, max-age=86400",
      Location: redirectUrl.toString(),
    },
  });
}

function maybeRedirectStaticAssetAlias(request: Request, url: URL): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const destination = staticAssetAliasRedirectPath(url.pathname);
  if (!destination) return null;

  const redirectUrl = new URL(request.url);
  redirectUrl.pathname = destination;
  redirectUrl.search = "";
  redirectUrl.hash = "";
  return new Response(null, {
    status: 308,
    headers: {
      "Cache-Control": "public, max-age=86400",
      Location: redirectUrl.toString(),
    },
  });
}

function maybeRedirectLegacyWorldcupDetail(request: Request, url: URL): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const redirectPath = legacyWorldcupDetailRedirectPath(url.pathname);
  if (!redirectPath) return null;

  const redirectUrl = new URL(request.url);
  redirectUrl.pathname = redirectPath;
  redirectUrl.search = rscRedirectSearch(request, url);
  redirectUrl.hash = "";
  return new Response(null, {
    status: 308,
    headers: {
      "Cache-Control": "public, max-age=86400",
      Location: redirectUrl.toString(),
    },
  });
}

function staticHomeAssetPath(pathname: string, request: Request, url: URL): string | null {
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  const isHomePath = normalizedPathname === "/";
  const maybeLocalePath = normalizedPathname.slice(1);

  if (!isHomePath && (!maybeLocalePath || maybeLocalePath.includes("/") || !GAME_LOCALE_PATH_SEGMENTS.has(maybeLocalePath))) {
    return null;
  }

  const extension = isRscRequest(request, url) ? "rsc" : "html";
  return isHomePath
    ? `/_cf_static_pages/index.${extension}`
    : `/_cf_static_pages/${maybeLocalePath}.${extension}`;
}

/**
 * The HTML and RSC payloads of a page share one URL, chosen by the `RSC`
 * header. Next sent this Vary so no cache serves one for the other.
 */
const STATIC_PAGE_VARY = "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch";

async function fetchStaticPageAsset(
  request: Request,
  env: Env,
  assetPath: string,
  pageType: string,
): Promise<Response | null> {
  if (!env.ASSETS || (request.method !== "GET" && request.method !== "HEAD")) return null;

  const assetUrl = new URL(request.url);
  assetUrl.pathname = assetPath;
  assetUrl.search = "";

  let assetResponse = await env.ASSETS.fetch(new Request(assetUrl, request));
  if ([301, 302, 307, 308].includes(assetResponse.status)) {
    const location = assetResponse.headers.get("Location");
    if (location?.startsWith("/_cf_static_pages/")) {
      const redirectedAssetUrl = new URL(request.url);
      redirectedAssetUrl.pathname = location;
      redirectedAssetUrl.search = "";
      assetResponse = await env.ASSETS.fetch(new Request(redirectedAssetUrl, request));
    }
  }
  if (assetResponse.status === 404) return null;

  const headers = new Headers(assetResponse.headers);
  headers.set("Cache-Control", "public, max-age=0, s-maxage=31536000, stale-while-revalidate=86400");
  headers.set("Vary", STATIC_PAGE_VARY);
  headers.set("x-cf-static-page", pageType);
  if (assetPath.endsWith(".rsc")) {
    headers.set("Content-Type", "text/x-component; charset=utf-8");
  } else {
    headers.set("Content-Type", "text/html; charset=utf-8");
  }

  return new Response(request.method === "HEAD" ? null : assetResponse.body, {
    status: assetResponse.status,
    statusText: assetResponse.statusText,
    headers,
  });
}

async function maybeServeStaticHomePage(request: Request, env: Env, url: URL): Promise<Response | null> {
  const assetPath = staticHomeAssetPath(url.pathname, request, url);
  return assetPath ? fetchStaticPageAsset(request, env, assetPath, "home") : null;
}

async function maybeServeStaticCompendiumPage(request: Request, env: Env, url: URL): Promise<Response | null> {
  const extension = isRscRequest(request, url) ? "rsc" : "html";
  const pathname = sts2CompendiumAliasPath(url.pathname) ?? url.pathname;
  const assetPath = staticCompendiumAssetPath(pathname, extension);
  return assetPath ? fetchStaticPageAsset(request, env, assetPath, "compendium") : null;
}

async function maybeServeStaticServicePage(request: Request, env: Env, url: URL): Promise<Response | null> {
  const extension = isRscRequest(request, url) ? "rsc" : "html";
  const assetPath = staticServicePageAssetPath(url.pathname, extension);
  return assetPath ? fetchStaticPageAsset(request, env, assetPath, "service") : null;
}

async function maybeServeStaticServiceDetailShell(
  request: Request,
  env: Env,
  ctx: ExecutionContextLike,
  url: URL,
): Promise<Response | null> {
  const extension = isRscRequest(request, url) ? "rsc" : "html";
  const assetPath = staticServiceDetailShellAssetPath(url.pathname, extension);
  if (!assetPath) return null;

  const baseResponse = await fetchStaticPageAsset(request, env, assetPath, "shell");
  if (!baseResponse || baseResponse.status !== 200 || extension === "rsc") {
    return baseResponse;
  }

  return maybeEnrichServiceDetailShell(request, env, ctx, url, baseResponse);
}

async function maybeServeStaticLegacyPage(request: Request, env: Env, url: URL): Promise<Response | null> {
  const extension = isRscRequest(request, url) ? "rsc" : "html";
  const assetPath = staticLegacyPageAssetPath(url.pathname, extension);
  return assetPath ? fetchStaticPageAsset(request, env, assetPath, "legacy") : null;
}

async function maybeServeStaticExactServicePage(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response | null> {
  const extension = isRscRequest(request, url) ? "rsc" : "html";
  const assetPath = staticExactServicePageAssetPath(url.pathname, extension);
  return assetPath ? fetchStaticPageAsset(request, env, assetPath, "service") : null;
}

function isReadMethod(method: string): boolean {
  return method === "GET" || method === "HEAD";
}

const READ_METHODS_ALLOW = "GET, HEAD";
const LINK_PREVIEW_ALLOW = "GET, HEAD, OPTIONS";

/** The asset a static branch would serve for a GET/HEAD to this path. */
function staticPageAssetPath(request: Request, url: URL): string | null {
  const extension = isRscRequest(request, url) ? "rsc" : "html";
  const { pathname } = url;
  return (
    staticHomeAssetPath(pathname, request, url)
    ?? staticServicePageAssetPath(pathname, extension)
    ?? staticServiceDetailShellAssetPath(pathname, extension)
    ?? staticLegacyPageAssetPath(pathname, extension)
    ?? staticCompendiumAssetPath(sts2CompendiumAliasPath(pathname) ?? pathname, extension)
    ?? staticExactServicePageAssetPath(pathname, extension)
  );
}

/**
 * Whether a GET/HEAD here finds a page; other methods then get 405. A path
 * shape whose asset is missing (an unknown detail ID) is a 404 for any method.
 */
async function staticPageExists(request: Request, env: Env, url: URL): Promise<boolean> {
  if (prerenderedRedirect(url.pathname)) return true;
  const assetPath = staticPageAssetPath(request, url);
  if (!assetPath) return false;
  const probe = await fetchStaticPageAsset(
    new Request(request.url, { method: "HEAD" }),
    env,
    assetPath,
    "probe",
  );
  return probe !== null;
}

/** Next answered non-GET requests to prerendered pages the same way. */
function methodNotAllowed(): Response {
  return new Response("Method Not Allowed", {
    status: 405,
    headers: { Allow: READ_METHODS_ALLOW },
  });
}

/** Mirrors the Next route handler: GET, auto HEAD, auto OPTIONS, else 405. */
async function serveLinkPreview(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { Allow: LINK_PREVIEW_ALLOW } });
  }
  if (!isReadMethod(request.method)) {
    return new Response(null, { status: 405, headers: { Allow: LINK_PREVIEW_ALLOW } });
  }

  const response = await handleLinkPreviewRequest(request);
  return request.method === "HEAD" ? new Response(null, response) : response;
}

function isLinkPreviewPath(pathname: string): boolean {
  return pathname === LINK_PREVIEW_PATH || pathname === `${LINK_PREVIEW_PATH}/`;
}

function maybeServePrerenderedRedirect(request: Request, url: URL): Response | null {
  if (!isReadMethod(request.method)) return null;
  const redirect = prerenderedRedirect(url.pathname);
  if (!redirect) return null;

  // Same status, Location, and cache policy as the former prerendered page.
  return new Response(null, {
    status: redirect.status,
    headers: {
      "Cache-Control": "s-maxage=31536000",
      Location: `${redirect.location}${rscRedirectSearch(request, url)}`,
    },
  });
}

const NOT_FOUND_CACHE_CONTROL = "private, no-cache, no-store, max-age=0, must-revalidate";

function logStaticNotFound(request: Request, url: URL, rsc: boolean): void {
  if (!rsc && !request.headers.get("accept")?.includes("text/html")) return;
  console.log(`cf-static-404 ${rsc ? "rsc" : "document"} ${redactPathname(url.pathname)}`);
}

/** Next's prerendered not-found page, served for every unmatched path. */
async function serveStaticNotFound(request: Request, env: Env, url: URL): Promise<Response> {
  const rsc = isRscRequest(request, url);
  logStaticNotFound(request, url, rsc);

  const isHead = request.method === "HEAD";
  const headers = new Headers({
    "Cache-Control": NOT_FOUND_CACHE_CONTROL,
    Vary: STATIC_PAGE_VARY,
    "x-cf-static-page": "not-found",
  });
  const asset = await fetchStaticPageAsset(
    new Request(request.url, { method: isHead ? "HEAD" : "GET" }),
    env,
    staticNotFoundAssetPath(rsc ? "rsc" : "html"),
    "not-found",
  );
  if (asset?.status !== 200) {
    await asset?.body?.cancel();
    headers.set("Content-Type", "text/plain; charset=utf-8");
    return new Response(isHead ? null : "Not Found", { status: 404, headers });
  }

  headers.set("Content-Type", rsc ? "text/x-component" : "text/html; charset=utf-8");
  const response = new Response(asset.body, { status: 404, headers });
  return rsc ? response : withLocalizedDocumentRoot(response, url.pathname);
}

/**
 * Everything the static branches above did not serve. Production sent these
 * to OpenNext; the Worker now reproduces its answers without a renderer.
 */
async function serveUnmatchedRequest(request: Request, env: Env, url: URL): Promise<Response> {
  const nextRouting = nextRoutingResponse(request, url);
  if (nextRouting) return nextRouting;

  if (isLinkPreviewPath(url.pathname)) return serveLinkPreview(request);

  const redirect = maybeServePrerenderedRedirect(request, url);
  if (redirect) return redirect;

  const exactServiceResponse = await maybeServeStaticExactServicePage(request, env, url);
  if (exactServiceResponse) return exactServiceResponse;

  if (!isReadMethod(request.method) && await staticPageExists(request, env, url)) {
    return methodNotAllowed();
  }

  return serveStaticNotFound(request, env, url);
}

const mainWorker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContextLike): Promise<Response> {
    const url = new URL(request.url);
    const localeRedirect = maybeRedirectRootToPreferredLocale(request, url);
    if (localeRedirect) return localeRedirect;

    const legacyCompendiumRedirect = maybeRedirectLegacyCompendiumDetail(request, url);
    if (legacyCompendiumRedirect) return legacyCompendiumRedirect;

    const legacyWorldcupRedirect = maybeRedirectLegacyWorldcupDetail(request, url);
    if (legacyWorldcupRedirect) return legacyWorldcupRedirect;

    const staticAliasRedirect = maybeRedirectStaticAssetAlias(request, url);
    if (staticAliasRedirect) return staticAliasRedirect;

    if (isPatchWorkerPath(url.pathname)) {
      if (env.PATCH_WORKER) return env.PATCH_WORKER.fetch(request);

      return new Response("Patch service unavailable", {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
          "Retry-After": "60",
        },
      });
    }

    const staticHomeResponse = await maybeServeStaticHomePage(request, env, url);
    if (staticHomeResponse) return staticHomeResponse;

    const staticServiceResponse = await maybeServeStaticServicePage(request, env, url);
    if (staticServiceResponse) return staticServiceResponse;

    const staticServiceDetailShellResponse = await maybeServeStaticServiceDetailShell(request, env, ctx, url);
    if (staticServiceDetailShellResponse) return staticServiceDetailShellResponse;

    const staticLegacyResponse = await maybeServeStaticLegacyPage(request, env, url);
    if (staticLegacyResponse) return staticLegacyResponse;

    const staticCompendiumResponse = await maybeServeStaticCompendiumPage(request, env, url);
    if (staticCompendiumResponse) return staticCompendiumResponse;

    return serveUnmatchedRequest(request, env, url);
  },
};

export default mainWorker;

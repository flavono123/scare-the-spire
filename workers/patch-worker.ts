import { gameLocaleFromPathSegment } from "../src/lib/i18n";
import { PATCH_NOT_FOUND_KO_SEGMENT, patchNotFoundAssetPath } from "./patch-not-found";
import { LATEST_PATCH_VERSION_ASSET } from "./patch-worker-assets";
import { withSecurityHeaders } from "./security-headers";

type Env = {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
};

/** /patches/latest and /<locale>/patches/latest: a redirect to that language's newest patch page. */
async function latestPatchRedirect(env: Env, url: URL): Promise<Response | null> {
  const match = /^(?:\/([^/]+))?\/patches\/latest\/?$/.exec(url.pathname);
  if (!match) return null;
  const segment = match[1];
  if (segment && !gameLocaleFromPathSegment(segment.toLowerCase())) return null;
  const asset = await env.ASSETS.fetch(new Request(new URL(LATEST_PATCH_VERSION_ASSET, url)));
  if (asset.status !== 200) return null;
  const version = (await asset.text()).trim();
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${segment ? `/${segment}` : ""}/patches/${version}${url.search}`,
      "Cache-Control": "no-store",
    },
  });
}

function isFilePath(pathname: string): boolean {
  return (
    pathname.startsWith("/_patches/") ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/fonts/") ||
    /\.[a-z0-9]+$/i.test(pathname)
  );
}

function assetPathForUrl(url: URL): string {
  if (isFilePath(url.pathname)) return url.pathname;
  return `${url.pathname.replace(/\/$/, "")}/index.html`;
}

function isPageRequest(request: Request, url: URL): boolean {
  return (
    (request.method === "GET" || request.method === "HEAD")
    && !isFilePath(url.pathname)
    && request.headers.get("rsc") !== "1"
    && !url.searchParams.has("_rsc")
  );
}

/** The built not-found page of the path's language, with the status it means. */
async function notFoundPage(request: Request, env: Env, url: URL): Promise<Response | null> {
  const segment = url.pathname.split("/")[1]?.toLowerCase();
  const assetUrl = new URL(request.url);
  assetUrl.pathname = patchNotFoundAssetPath(
    gameLocaleFromPathSegment(segment) ? segment : PATCH_NOT_FOUND_KO_SEGMENT,
  );
  assetUrl.search = "";
  const asset = await env.ASSETS.fetch(new Request(assetUrl, { method: request.method }));
  if (asset.status !== 200) return null;

  const headers = new Headers(asset.headers);
  headers.set("Cache-Control", "no-store");
  headers.delete("ETag");
  return new Response(asset.body, { status: 404, headers });
}

const patchWorker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const latest = await latestPatchRedirect(env, url);
    if (latest) return withSecurityHeaders(latest);
    const assetUrl = new URL(request.url);
    assetUrl.pathname = assetPathForUrl(url);
    const response = await env.ASSETS.fetch(new Request(assetUrl, request));
    if (response.status === 404 && isPageRequest(request, url)) {
      const page = await notFoundPage(request, env, url);
      if (page) return withSecurityHeaders(page);
    }
    return withSecurityHeaders(response);
  },
};

export default patchWorker;

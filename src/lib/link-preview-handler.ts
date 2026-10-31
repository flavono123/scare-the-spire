import { isPublicHttpUrl, MAX_HEAD_SIZE, readOpenGraph, type LinkPreview } from "@/lib/link-preview";
import {
  parseYouTubeVideoId,
  resolveYouTubeReference,
  youtubeThumbnailUrl,
} from "@/lib/youtube-reference";

/**
 * Framework-free `/api/link-preview` handler. The Next route (for `next dev`)
 * and the static main Worker both call it, so responses stay identical.
 */

const TIMEOUT_MS = 3000;
const MAX_REDIRECTS = 10;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const HEAD_END = "</head>";

export const LINK_PREVIEW_PATH = "/api/link-preview";

function jsonResponse(
  body: unknown,
  { status = 200, cacheControl }: { status?: number; cacheControl?: string } = {},
): Response {
  const headers = new Headers({ "content-type": "application/json" });
  if (cacheControl) headers.set("cache-control", cacheControl);
  return new Response(JSON.stringify(body), { status, headers });
}

function emptyPreview(cacheControl?: string): Response {
  const preview: LinkPreview = { title: "", description: "", image: "" };
  return jsonResponse(preview, { cacheControl });
}

/**
 * Follows redirects by hand so every hop, not only the first and the final
 * URL, must pass `isPublicHttpUrl`. Returns null when a hop leaves the public
 * web; the private URL is never requested.
 */
async function fetchPublicPage(
  target: URL,
  requestHost: string,
  signal: AbortSignal,
): Promise<{ response: Response; url: URL } | null> {
  let url = target;
  for (let redirects = 0; ; redirects += 1) {
    const response = await fetch(url, {
      redirect: "manual",
      signal,
      headers: {
        accept: "text/html",
        "user-agent": "scare-the-spire-link-preview",
      },
    });
    const location = response.headers.get("location");
    if (!REDIRECT_STATUSES.has(response.status) || !location) return { response, url };
    await response.body?.cancel().catch(() => undefined);
    if (redirects >= MAX_REDIRECTS) throw new Error("too many redirects");

    let next: URL | null;
    try {
      next = isPublicHttpUrl(new URL(location, url).href, requestHost);
    } catch {
      next = null;
    }
    if (!next) return null;
    url = next;
  }
}

function isHtml(response: Response): boolean {
  const mediaType = response.headers.get("content-type")?.split(";")[0];
  return mediaType?.trim().toLowerCase() === "text/html";
}

/**
 * Reads up to the end of the head. Only new text can complete `</head>`, so a
 * page dripping one byte at a time costs no more than a single large chunk.
 */
async function readHead(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let html = "";
  while (size < MAX_HEAD_SIZE) {
    const step = await reader.read();
    if (step.done) break;
    const chunk = step.value.subarray(0, MAX_HEAD_SIZE - size);
    size += chunk.byteLength;
    const searchFrom = Math.max(0, html.length - HEAD_END.length + 1);
    html += decoder.decode(chunk, { stream: true });
    if (html.slice(searchFrom).toLowerCase().includes(HEAD_END)) break;
  }
  await reader.cancel().catch(() => undefined);
  return html;
}

export async function handleLinkPreviewRequest(request: Request): Promise<Response> {
  // Pages call this same-origin; another site must not spend the Worker's fetches.
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return jsonResponse({ message: "forbidden" }, { status: 403 });
  }

  const { hostname: requestHost, searchParams } = new URL(request.url);
  const target = isPublicHttpUrl(searchParams.get("url") ?? "", requestHost);
  if (!target) return jsonResponse({ message: "unsupported url" }, { status: 400 });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // YouTube puts og:title ~800 KB into the page; oEmbed answers directly.
    const videoId = parseYouTubeVideoId(target.href);
    if (videoId) {
      const reference = await resolveYouTubeReference(target.href, controller.signal);
      const preview: LinkPreview = {
        title: reference.title,
        description: "",
        image: youtubeThumbnailUrl(videoId),
      };
      return jsonResponse(preview, { cacheControl: "public, max-age=86400" });
    }
    const page = await fetchPublicPage(target, requestHost, controller.signal);
    if (!page) return emptyPreview();
    const { response, url: pageUrl } = page;
    if (!response.ok || !response.body || !isHtml(response)) {
      await response.body?.cancel().catch(() => undefined);
      return emptyPreview("public, max-age=300");
    }
    const preview = readOpenGraph(await readHead(response.body), pageUrl.href);
    return jsonResponse(preview, { cacheControl: "public, max-age=86400" });
  } catch {
    return emptyPreview("public, max-age=60");
  } finally {
    clearTimeout(timeout);
  }
}

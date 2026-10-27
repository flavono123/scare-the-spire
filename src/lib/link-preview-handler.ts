import { isPublicHttpUrl, readOpenGraph, type LinkPreview } from "@/lib/link-preview";
import {
  parseYouTubeVideoId,
  resolveYouTubeReference,
  youtubeThumbnailUrl,
} from "@/lib/youtube-reference";

/**
 * Framework-free `/api/link-preview` handler. The Next route (for `next dev`)
 * and the static main Worker both call it, so responses stay identical.
 */

// Enough for heads that inline large scripts before their meta tags.
const MAX_BYTES = 128_000;
const TIMEOUT_MS = 3000;

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

export async function handleLinkPreviewRequest(request: Request): Promise<Response> {
  const raw = new URL(request.url).searchParams.get("url") ?? "";
  const target = isPublicHttpUrl(raw);
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
    const response = await fetch(target, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept: "text/html",
        "user-agent": "scare-the-spire-link-preview",
      },
    });
    if (!response.ok || !response.body) {
      return emptyPreview("public, max-age=300");
    }
    if (!isPublicHttpUrl(response.url || target.href)) {
      return emptyPreview();
    }
    const reader = response.body.getReader();
    let size = 0;
    const decoder = new TextDecoder();
    let html = "";
    while (size < MAX_BYTES) {
      const step = await reader.read();
      if (step.done) break;
      size += step.value.byteLength;
      html += decoder.decode(step.value, { stream: true });
      if (html.toLowerCase().includes("</head>")) break;
    }
    await reader.cancel().catch(() => undefined);
    const preview = readOpenGraph(html, response.url || target.href);
    return jsonResponse(preview, { cacheControl: "public, max-age=86400" });
  } catch {
    return emptyPreview("public, max-age=60");
  } finally {
    clearTimeout(timeout);
  }
}

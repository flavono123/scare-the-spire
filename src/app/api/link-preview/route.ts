import { NextResponse } from "next/server";
import { isPublicHttpUrl, readOpenGraph, type LinkPreview } from "@/lib/link-preview";
import {
  parseYouTubeVideoId,
  resolveYouTubeReference,
  youtubeThumbnailUrl,
} from "@/lib/youtube-reference";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Enough for heads that inline large scripts before their meta tags.
const MAX_BYTES = 128_000;
const TIMEOUT_MS = 3000;

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url") ?? "";
  const target = isPublicHttpUrl(raw);
  if (!target) return NextResponse.json({ message: "unsupported url" }, { status: 400 });

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
      return NextResponse.json(preview, {
        headers: { "cache-control": "public, max-age=86400" },
      });
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
      return NextResponse.json({ title: "", description: "", image: "" }, {
        headers: { "cache-control": "public, max-age=300" },
      });
    }
    if (!isPublicHttpUrl(response.url || target.href)) {
      return NextResponse.json({ title: "", description: "", image: "" });
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
    return NextResponse.json(preview, {
      headers: { "cache-control": "public, max-age=86400" },
    });
  } catch {
    return NextResponse.json({ title: "", description: "", image: "" }, {
      headers: { "cache-control": "public, max-age=60" },
    });
  } finally {
    clearTimeout(timeout);
  }
}

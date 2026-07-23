const YOUTUBE_VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
]);
const YOUTUBE_EMBED_HOSTS = new Set([
  ...YOUTUBE_HOSTS,
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

export interface YouTubeReference {
  videoId: string;
  title: string;
}

interface YouTubeOEmbedResponse {
  provider_name?: unknown;
  title?: unknown;
  type?: unknown;
}

function validVideoId(candidate: string | null | undefined): string | null {
  const trimmed = candidate?.trim() ?? "";
  return YOUTUBE_VIDEO_ID_RE.test(trimmed) ? trimmed : null;
}

export function parseYouTubeVideoId(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const hostname = url.hostname.toLowerCase();
  if (hostname === "youtu.be" || hostname === "www.youtu.be") {
    return validVideoId(url.pathname.split("/").filter(Boolean)[0]);
  }

  if (!YOUTUBE_EMBED_HOSTS.has(hostname)) return null;

  if (YOUTUBE_HOSTS.has(hostname) && url.pathname === "/watch") {
    return validVideoId(url.searchParams.get("v"));
  }

  const [route, candidate] = url.pathname.split("/").filter(Boolean);
  if (["embed", "live", "shorts"].includes(route ?? "")) {
    return validVideoId(candidate);
  }

  return null;
}

export function isYouTubeVideoId(videoId: string): boolean {
  return YOUTUBE_VIDEO_ID_RE.test(videoId);
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export async function resolveYouTubeReference(
  input: string,
  signal?: AbortSignal,
): Promise<YouTubeReference> {
  const videoId = parseYouTubeVideoId(input);
  if (!videoId) throw new Error("invalid YouTube URL");

  const endpoint = new URL("https://www.youtube.com/oembed");
  endpoint.searchParams.set("url", youtubeWatchUrl(videoId));
  endpoint.searchParams.set("format", "json");

  const response = await fetch(endpoint, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error("YouTube metadata unavailable");

  const payload = await response.json() as YouTubeOEmbedResponse;
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  if (
    payload.provider_name !== "YouTube"
    || payload.type !== "video"
    || !title
  ) {
    throw new Error("invalid YouTube metadata");
  }

  return {
    videoId,
    title: title.slice(0, 200),
  };
}

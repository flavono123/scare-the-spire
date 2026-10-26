import type { LinkPreview } from "@/lib/link-preview";

export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  const endpoint = new URL("/api/link-preview", window.location.origin);
  endpoint.searchParams.set("url", url);
  const response = await fetch(endpoint, { headers: { accept: "application/json" } });
  if (!response.ok) return { title: "", description: "", image: "" };
  const payload = await response.json() as Partial<LinkPreview>;
  return {
    title: typeof payload.title === "string" ? payload.title.trim() : "",
    description: typeof payload.description === "string" ? payload.description.trim() : "",
    image: typeof payload.image === "string" ? payload.image.trim() : "",
  };
}

export type { LinkPreview };

const EMPTY_PREVIEW: LinkPreview = { title: "", description: "", image: "" };
const previewCache = new Map<string, Promise<LinkPreview>>();

/**
 * One request per URL per page view, shared by every hover preview and
 * title lookup. Failures resolve to an empty preview and are cached too.
 */
export function cachedLinkPreview(url: string): Promise<LinkPreview> {
  let pending = previewCache.get(url);
  if (!pending) {
    pending = fetchLinkPreview(url).catch(() => EMPTY_PREVIEW);
    previewCache.set(url, pending);
  }
  return pending;
}

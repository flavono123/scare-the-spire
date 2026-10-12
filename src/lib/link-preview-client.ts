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

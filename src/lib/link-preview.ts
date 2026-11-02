import { getSiteOrigin } from "@/lib/site-origin";

export interface LinkPreview {
  title: string;
  description: string;
  image: string;
}

// Every Worker of this account: production, testbed, patch, version previews.
const OWN_WORKERS_SUFFIX = ".flavono123.workers.dev";

/**
 * Enough for heads that inline large scripts before their meta tags. Pages are
 * untrusted and Workers Free allows 10 ms of CPU, so reading stays linear in this.
 */
export const MAX_HEAD_SIZE = 128_000;
const MAX_META_TAGS = 512;
const MAX_TAG_LENGTH = 16_000;

const META_KEY = /(?:property|name)\s*=\s*(["'])([\s\S]*?)\1/i;
const META_CONTENT = /content\s*=\s*(["'])([\s\S]*?)\1/i;

const MAX_CODE_POINT = 0x10ffff;

/** `fromCodePoint` throws past U+10FFFF; one bad entity must not cost the preview. */
function decodeCodePoint(code: number): string {
  return code <= MAX_CODE_POINT ? String.fromCodePoint(code) : "";
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => decodeCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => decodeCodePoint(Number.parseInt(dec, 10)))
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * One pass over the head. Each tag ends at the next `>`, so when none is left
 * no later tag can close either and the scan stops instead of retrying.
 */
function readHeadTags(head: string): { meta: Map<string, string>; title: string } {
  const meta = new Map<string, string>();
  let title: string | null = null;
  let metaTags = 0;

  const tagStart = /<(meta|title)\b/gi;
  for (let match = tagStart.exec(head); match; match = tagStart.exec(head)) {
    const tagEnd = head.indexOf(">", match.index);
    if (tagEnd < 0) break;
    tagStart.lastIndex = tagEnd + 1;

    if (match[1].toLowerCase() === "title") {
      if (title !== null) continue;
      const textStart = tagEnd + 1;
      const textLength = head.slice(textStart).search(/<\/title>/i);
      title = textLength < 0 ? "" : head.slice(textStart, textStart + textLength);
      if (textLength >= 0) tagStart.lastIndex = textStart + textLength;
      continue;
    }

    metaTags += 1;
    if (metaTags > MAX_META_TAGS) break;
    if (tagEnd - match.index > MAX_TAG_LENGTH) continue;
    const tag = head.slice(match.index, tagEnd + 1);
    const key = tag.match(META_KEY)?.[2]?.toLowerCase();
    if (!key || meta.has(key)) continue;
    const content = tag.match(META_CONTENT)?.[2];
    if (content) meta.set(key, content);
  }

  return { meta, title: title ?? "" };
}

function absoluteUrl(value: string, baseUrl: string): string {
  if (!value) return "";
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return "";
  }
}

export function readOpenGraph(html: string, pageUrl: string): LinkPreview {
  const bounded = html.slice(0, MAX_HEAD_SIZE);
  const headEnd = bounded.search(/<\/head>/i);
  const { meta, title } = readHeadTags(headEnd >= 0 ? bounded.slice(0, headEnd) : bounded);
  const content = (key: string) => decodeHtml(meta.get(key) ?? "");
  return {
    title: content("og:title") || content("twitter:title") || decodeHtml(title),
    description: content("og:description") || content("description") || content("twitter:description"),
    image: absoluteUrl(content("og:image") || content("twitter:image"), pageUrl),
  };
}

/** `requestHost` is the host serving this request; the site never previews itself. */
export function isPublicHttpUrl(raw: string, requestHost?: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== "80" && url.port !== "443") return null;
  const host = url.hostname.toLowerCase().replace(/\.+$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return null;
  if (host === "internal" || host.endsWith(".internal")) return null;
  if (host === requestHost || host === new URL(getSiteOrigin()).hostname || host.endsWith(OWN_WORKERS_SUFFIX)) return null;
  if (host === "::1" || host.includes(":")) return null;
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const parts = ipv4.slice(1).map(Number);
    if (parts.some((part) => part > 255)) return null;
    const [a, b, c] = parts;
    if (
      a === 0 || a === 10 || a === 127
      || (a === 100 && b >= 64 && b <= 127) // carrier-grade NAT
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 0 && (c === 0 || c === 2)) // protocol assignments, TEST-NET-1
      || (a === 192 && b === 168)
      || (a === 198 && (b === 18 || b === 19)) // benchmarking
      || (a === 198 && b === 51 && c === 100) // TEST-NET-2
      || (a === 203 && b === 0 && c === 113) // TEST-NET-3
      || a >= 224 // multicast, reserved, broadcast
    ) return null;
  }
  return url;
}

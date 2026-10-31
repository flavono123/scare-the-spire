import { getSiteOrigin } from "@/lib/site-origin";

export interface LinkPreview {
  title: string;
  description: string;
  image: string;
}

// Every Worker of this account: production, testbed, patch, version previews.
const OWN_WORKERS_SUFFIX = ".flavono123.workers.dev";

const META_VALUE = String.raw`(["'])([\s\S]*?)\1`;

function decodeHtml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function metaContent(html: string, key: string): string {
  const pattern = new RegExp(`<meta\\b[^>]*>`, "gi");
  for (const tag of html.match(pattern) ?? []) {
    const name = tag.match(new RegExp(`(?:property|name)\\s*=\\s*${META_VALUE}`, "i"));
    if (name?.[2]?.toLowerCase() !== key) continue;
    const content = tag.match(new RegExp(`content\\s*=\\s*${META_VALUE}`, "i"));
    if (content?.[2]) return decodeHtml(content[2]);
  }
  return "";
}

function documentTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? decodeHtml(match[1]) : "";
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
  const headEnd = html.toLowerCase().indexOf("</head>");
  const head = headEnd >= 0 ? html.slice(0, headEnd) : html.slice(0, 128_000);
  const image = metaContent(head, "og:image") || metaContent(head, "twitter:image");
  return {
    title: metaContent(head, "og:title") || metaContent(head, "twitter:title") || documentTitle(head),
    description: metaContent(head, "og:description") || metaContent(head, "description") || metaContent(head, "twitter:description"),
    image: absoluteUrl(image, pageUrl),
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

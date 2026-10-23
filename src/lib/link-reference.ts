/**
 * Off-site links that comment-family posts keep as a titled link block.
 *
 * Pagestorm turns any pasted URL into a link labelled with its Open Graph
 * title. Short posts (C-C-C-Combo) only do that for hosts whose titles are
 * worth showing and whose pages answer link previews; YouTube keeps its own
 * video block with a thumbnail. Open Graph images are not used here: many
 * hosts (DC Inside among them) refuse hotlinked images.
 */

export const LINK_REFERENCE_TITLE_MAX_CHARS = 200;

const TITLED_LINK_HOSTS = ["dcinside.com"] as const;

function hostMatches(hostname: string, host: string): boolean {
  return hostname === host || hostname.endsWith(`.${host}`);
}

export function parseHttpUrl(input: string): URL | null {
  try {
    const url = new URL(input.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** Hosts whose pasted URLs become titled link blocks in short posts. */
export function isTitledLinkUrl(input: string | URL): boolean {
  const url = typeof input === "string" ? parseHttpUrl(input) : input;
  if (!url) return false;
  const hostname = url.hostname.toLowerCase();
  return TITLED_LINK_HOSTS.some((host) => hostMatches(hostname, host));
}

export function isSafeLinkHref(href: string): boolean {
  return parseHttpUrl(href) != null;
}

export function normalizeLinkTitle(title: string, href: string): string {
  const trimmed = title.replace(/\s+/g, " ").trim();
  return (trimmed || href).slice(0, LINK_REFERENCE_TITLE_MAX_CHARS);
}

export type TextSegment =
  | { kind: "text"; text: string }
  | { kind: "url"; href: string };

/**
 * Split plain text around http(s) URLs. Trailing punctuation that usually
 * ends a sentence stays text.
 */
export function splitTextUrls(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(/https?:\/\/[^\s<>"'\]\[]+/gi)) {
    const start = match.index ?? 0;
    let href = match[0];
    while (/[.,!?;:)]$/.test(href)) href = href.slice(0, -1);
    if (!parseHttpUrl(href)) continue;
    if (start > last) segments.push({ kind: "text", text: text.slice(last, start) });
    segments.push({ kind: "url", href });
    last = start + href.length;
  }
  if (last < text.length) segments.push({ kind: "text", text: text.slice(last) });
  return segments;
}

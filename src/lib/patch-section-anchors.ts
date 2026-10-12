const SECTION_HEADING_RE = /^(#{2,6})\s+(.+)$/;

export function plainPatchHeading(raw: string): string {
  return raw
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/\[(?:gold|blue|red|green|aqua|orange|pink|purple|silver)(?::[^\]]+)?]/g, "")
    .replace(/\[\/(?:gold|blue|red|green|aqua|orange|pink|purple|silver)]/g, "")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function patchHeadingSlug(text: string): string {
  const base = plainPatchHeading(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "section";
}

export function patchSectionHeadings(markdown: string): string[] {
  const headings: string[] = [];
  for (const line of markdown.split("\n")) {
    const match = line.trim().match(SECTION_HEADING_RE);
    if (!match) continue;
    headings.push(plainPatchHeading(match[2]));
  }
  return headings;
}

function uniqueSlug(text: string, used: Map<string, number>): string {
  const slug = patchHeadingSlug(text);
  const count = (used.get(slug) ?? 0) + 1;
  used.set(slug, count);
  return count === 1 ? slug : `${slug}-${count}`;
}

/**
 * Stable ids from the English note, paired by heading order with the
 * rendered locale. Extra headings in one locale keep their own slug.
 */
export function patchSectionAnchorIds(canonicalMarkdown: string, localizedMarkdown: string): string[] {
  const canonical = patchSectionHeadings(canonicalMarkdown);
  const localized = patchSectionHeadings(localizedMarkdown);
  const used = new Map<string, number>();
  const shared = Math.min(canonical.length, localized.length);
  const ids = canonical.slice(0, shared).map((heading) => uniqueSlug(heading, used));
  for (const heading of localized.slice(shared)) ids.push(uniqueSlug(heading, used));
  return ids;
}

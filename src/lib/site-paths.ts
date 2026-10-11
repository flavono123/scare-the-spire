import type { ServiceLocale } from "@/lib/i18n";
import { localizeHref, stripGameLocaleFromPath, stripServiceLocaleFromPath } from "@/lib/i18n";
import { DEFAULT_SITE_ORIGIN } from "@/lib/site-origin";

export type SitePathKind = "page" | "neowsletter" | "neowsletter-section" | "neowsletter-line";

export type SitePathEntry = {
  href: string;
  kind: SitePathKind;
  labelKo: string;
  labelEn: string;
  titleKo: string;
  titleEn: string;
  previewKo: string;
  previewEn: string;
};

export type SitePathIndex = {
  entries: SitePathEntry[];
};

const SITE_HOSTS = new Set([
  new URL(DEFAULT_SITE_ORIGIN).hostname,
  "localhost",
  "127.0.0.1",
]);

export function canonicalSitePath(raw: string): string | null {
  const sitePath = toSitePath(raw);
  if (!sitePath) return null;
  const hashAt = sitePath.indexOf("#");
  const beforeHash = hashAt >= 0 ? sitePath.slice(0, hashAt) : sitePath;
  const hash = hashAt >= 0 ? sitePath.slice(hashAt) : "";
  const queryAt = beforeHash.indexOf("?");
  const pathname = queryAt >= 0 ? beforeHash.slice(0, queryAt) : beforeHash;
  const search = queryAt >= 0 ? beforeHash.slice(queryAt) : "";
  const canonical = stripGameLocaleFromPath(stripServiceLocaleFromPath(pathname));
  return `${canonical}${search}${hash}`;
}

export function toSitePath(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("//")) return null;
  if (trimmed.startsWith("/")) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!SITE_HOSTS.has(url.hostname)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function sitePathText(entry: SitePathEntry, locale: ServiceLocale, field: "label" | "title" | "preview"): string {
  if (locale === "en") {
    if (field === "label") return entry.labelEn || entry.labelKo;
    if (field === "title") return entry.titleEn || entry.titleKo;
    return entry.previewEn || entry.previewKo;
  }
  if (field === "label") return entry.labelKo || entry.labelEn;
  if (field === "title") return entry.titleKo || entry.titleEn;
  return entry.previewKo || entry.previewEn;
}

export function localizedSiteHref(href: string, locale: ServiceLocale): string {
  return localizeHref(href, locale);
}

/** Text immediately before the cursor that is an in-site path being typed. */
export function openSitePathQuery(textBefore: string): string | null {
  const match = textBefore.match(/(?:^|[\s([{])(\/[^\s{}\n]*)$/);
  return match?.[1] ?? null;
}

export function rankSitePaths(
  query: string,
  entries: readonly SitePathEntry[],
  locale: ServiceLocale,
  limit = 8,
): SitePathEntry[] {
  const q = query.trim().toLowerCase();
  if (!q.startsWith("/")) return [];
  if (q === "/") {
    return entries.filter((entry) => entry.kind === "page").slice(0, limit);
  }
  const needle = q.slice(1);
  const ranked: Array<{ entry: SitePathEntry; score: number }> = [];
  for (const entry of entries) {
    const href = entry.href.toLowerCase();
    const localized = localizedSiteHref(entry.href, locale).toLowerCase();
    const label = sitePathText(entry, locale, "label").toLowerCase();
    const preview = sitePathText(entry, locale, "preview").toLowerCase();
    let score = 3;
    if (href.startsWith(q) || localized.startsWith(q)) score = 0;
    else if (href.includes(needle) || localized.includes(needle)) score = 1;
    else if (label.includes(needle) || preview.includes(needle)) score = 2;
    else continue;
    ranked.push({ entry, score });
  }
  ranked.sort((left, right) => left.score - right.score || left.entry.href.length - right.entry.href.length);
  return ranked.slice(0, limit).map((item) => item.entry);
}

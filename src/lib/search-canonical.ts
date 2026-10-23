import type { Metadata } from "next";
import {
  hasGameLocalePathPrefix,
  stripGameLocaleFromPath,
  stripServiceLocaleFromPath,
  type ServiceLocale,
} from "@/lib/i18n";
import { absoluteSiteUrl } from "@/lib/site-origin";

/*
 * Search index policy:
 * - ko (prefixless) and en (/en/...) are the two indexable languages. Each is
 *   self-canonical and lists reciprocal ko, en, and x-default alternates.
 * - Every other game-locale prefix (/ja, /zh, /de, ...) shares the English
 *   service UI, so it canonicalizes to its /en counterpart.
 * - x-default points at en: visitors outside ko/en get the English UI.
 */
export const SEARCH_X_DEFAULT_LOCALE: ServiceLocale = "en";

export type SearchLanguageAlternates = Record<ServiceLocale | "x-default", string>;

/** Locale-free path: drops /en or game-locale prefixes and maps /codex to /compendium. */
export function searchBasePath(pathname: string): string {
  const [path] = pathname.split(/[?#]/, 1);
  const stripped = stripGameLocaleFromPath(stripServiceLocaleFromPath(path || "/"));
  return stripped === "/codex" || stripped.startsWith("/codex/")
    ? stripped.replace(/^\/codex/, "/compendium")
    : stripped || "/";
}

/** Indexable search path for a service locale: prefixless ko or /en. */
export function searchPathForLocale(
  pathname: string,
  serviceLocale: ServiceLocale,
): string {
  const basePath = searchBasePath(pathname);
  if (serviceLocale === "ko") return basePath;
  return basePath === "/" ? "/en" : `/en${basePath}`;
}

/** Search locale a request path belongs to: prefixless is ko, any locale prefix is en. */
export function searchLocaleForPath(pathname: string): ServiceLocale {
  const [path] = pathname.split(/[?#]/, 1);
  return hasGameLocalePathPrefix(path || "/") ? "en" : "ko";
}

export function searchCanonicalPath(
  pathname: string,
  serviceLocale: ServiceLocale = searchLocaleForPath(pathname),
): string {
  return searchPathForLocale(pathname, serviceLocale);
}

export function absoluteSearchCanonicalUrl(
  pathname: string,
  serviceLocale?: ServiceLocale,
): string {
  return absoluteSiteUrl(searchCanonicalPath(pathname, serviceLocale));
}

/** Reciprocal hreflang map shared by the ko and en variants of a page. */
export function searchLanguageAlternates(pathname: string): SearchLanguageAlternates {
  const ko = absoluteSiteUrl(searchPathForLocale(pathname, "ko"));
  const en = absoluteSiteUrl(searchPathForLocale(pathname, "en"));
  return {
    ko,
    en,
    "x-default": SEARCH_X_DEFAULT_LOCALE === "ko" ? ko : en,
  };
}

/**
 * Apply the search canonical, hreflang alternates, and og:url for a page.
 * `pathname` may be locale-free; `serviceLocale` picks the ko or en variant.
 */
export function withSearchCanonical(
  metadata: Metadata,
  pathname: string,
  serviceLocale: ServiceLocale,
): Metadata {
  const canonicalUrl = absoluteSearchCanonicalUrl(pathname, serviceLocale);
  return {
    ...metadata,
    alternates: {
      ...metadata.alternates,
      canonical: canonicalUrl,
      languages: searchLanguageAlternates(pathname),
    },
    ...(metadata.openGraph
      ? {
          openGraph: {
            ...metadata.openGraph,
            url: canonicalUrl,
          },
        }
      : {}),
  };
}

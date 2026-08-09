import type { Metadata } from "next";
import {
  stripGameLocaleFromPath,
  stripServiceLocaleFromPath,
} from "@/lib/i18n";
import { absoluteSiteUrl } from "@/lib/site-origin";

/** Prefixless Korean path used as the single search canonical (option A). */
export function koreanSearchPath(pathname: string): string {
  const [path] = pathname.split(/[?#]/, 1);
  const stripped = stripGameLocaleFromPath(stripServiceLocaleFromPath(path || "/"));
  return stripped === "/codex" || stripped.startsWith("/codex/")
    ? stripped.replace(/^\/codex/, "/compendium")
    : stripped || "/";
}

export function absoluteKoreanCanonicalUrl(pathname: string): string {
  return absoluteSiteUrl(koreanSearchPath(pathname));
}

/** Point locale/en variants at the Korean URL without changing page UI. */
export function withKoreanSearchCanonical(
  metadata: Metadata,
  pathname: string,
): Metadata {
  const canonicalUrl = absoluteKoreanCanonicalUrl(pathname);
  return {
    ...metadata,
    alternates: {
      ...metadata.alternates,
      canonical: canonicalUrl,
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

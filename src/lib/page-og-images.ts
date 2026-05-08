import type { Metadata } from "next";

export type PageOgImage = {
  url: string;
  width: number;
  height: number;
  alt: string;
};

export type PageOgImageRule = {
  pattern: string;
  label: string;
  image: PageOgImage;
};

export const DEFAULT_PAGE_OG_IMAGE: PageOgImage = {
  url: "/images/sts2/cards/coordinate.webp",
  width: 1000,
  height: 760,
  alt: "슬서운 이야기 — 협력 Coordinate",
};

export const PATCH_NOTES_PAGE_OG_IMAGE: PageOgImage = {
  url: "/images/sts2/cards/foregone_conclusion.webp",
  width: 1000,
  height: 760,
  alt: "슬서운 이야기 패치 노트 — 필연적인 결과 Foregone Conclusion",
};

export const PAGE_OG_IMAGE_RULES = [
  {
    pattern: "/patches",
    label: "패치 목록",
    image: PATCH_NOTES_PAGE_OG_IMAGE,
  },
  {
    pattern: "/patches/*",
    label: "패치 상세",
    image: PATCH_NOTES_PAGE_OG_IMAGE,
  },
] as const satisfies readonly PageOgImageRule[];

function normalizePathname(pathname: string): string {
  const withoutQuery = pathname.split(/[?#]/, 1)[0] ?? "/";
  const withLeadingSlash = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  const normalized = withLeadingSlash.replace(/\/+/g, "/").replace(/\/$/, "");
  return normalized || "/";
}

export function routePatternMatches(pattern: string, pathname: string): boolean {
  const normalizedPattern = normalizePathname(pattern);
  const normalizedPathname = normalizePathname(pathname);

  if (normalizedPattern.endsWith("/*")) {
    const basePattern = normalizePathname(normalizedPattern.slice(0, -2));
    return normalizedPathname === basePattern || normalizedPathname.startsWith(`${basePattern}/`);
  }

  return normalizedPattern === normalizedPathname;
}

export function findPageOgImageRule(pathname: string): PageOgImageRule | null {
  return PAGE_OG_IMAGE_RULES.find((rule) => routePatternMatches(rule.pattern, pathname)) ?? null;
}

export function getPageOgImage(pathname: string): PageOgImage {
  return findPageOgImageRule(pathname)?.image ?? DEFAULT_PAGE_OG_IMAGE;
}

export function withPageOgImage(metadata: Metadata, pathname: string): Metadata {
  const image = getPageOgImage(pathname);

  return {
    ...metadata,
    openGraph: {
      ...(metadata.openGraph ?? {}),
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      ...(metadata.twitter ?? {}),
      images: [image.url],
    },
  };
}

import type { Metadata } from "next";
import { cacheBustSts2ImageUrl } from "@/lib/sts2-image-cache";

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
  url: cacheBustSts2ImageUrl("/images/sts2/og/patch-notes.jpg"),
  width: 1200,
  height: 630,
  alt: "슬서운 이야기 패치 노트 — 필연적인 결과 Foregone Conclusion",
};

export const CHEMICAL_X_PAGE_OG_IMAGE: PageOgImage = {
  url: "/images/sts2/cards/eradicate.webp",
  width: 1000,
  height: 760,
  alt: "케미컬X — 척결 Eradicate",
};

export const HISTORY_COURSE_PAGE_OG_IMAGE: PageOgImage = {
  url: "/images/sts2/cards/spoils_map.webp",
  width: 1000,
  height: 760,
  alt: "히스토리 코스 — 보물 지도 Spoils Map",
};

export const PAGE_OG_IMAGE_RULES = [
  {
    pattern: "/chemical-x",
    label: "케미컬X",
    image: CHEMICAL_X_PAGE_OG_IMAGE,
  },
  {
    pattern: "/chemical-x/*",
    label: "케미컬X 상세",
    image: CHEMICAL_X_PAGE_OG_IMAGE,
  },
  {
    pattern: "/history-course",
    label: "히스토리 코스",
    image: HISTORY_COURSE_PAGE_OG_IMAGE,
  },
  {
    pattern: "/history-course/*",
    label: "히스토리 코스 상세",
    image: HISTORY_COURSE_PAGE_OG_IMAGE,
  },
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

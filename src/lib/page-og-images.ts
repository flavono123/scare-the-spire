import type { Metadata } from "next";
import { absoluteSiteUrl, SITE_METADATA_BASE } from "@/lib/site-origin";
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

export const COMBO_PAGE_OG_IMAGE: PageOgImage = {
  url: "/images/sts2/events/amalgamator.webp",
  width: 3440,
  height: 1616,
  alt: "코오오옴보 — 융합자 Amalgamator",
};

export const HISTORY_COURSE_PAGE_OG_IMAGE: PageOgImage = {
  url: "/images/sts2/cards/spoils_map.webp",
  width: 1000,
  height: 760,
  alt: "히스토리 코스 — 보물 지도 Spoils Map",
};

export const THIS_OR_THAT_PAGE_OG_IMAGE: PageOgImage = {
  url: "/images/sts2/events/this_or_that.webp",
  width: 3440,
  height: 1616,
  alt: "이거 아님 저거? — This or That?",
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
    pattern: "/combo",
    label: "코오오옴보",
    image: COMBO_PAGE_OG_IMAGE,
  },
  {
    pattern: "/combo/*",
    label: "코오오옴보 상세",
    image: COMBO_PAGE_OG_IMAGE,
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
    pattern: "/this-or-that",
    label: "이거 아님 저거?",
    image: THIS_OR_THAT_PAGE_OG_IMAGE,
  },
  {
    pattern: "/this-or-that/*",
    label: "이거 아님 저거? 상세",
    image: THIS_OR_THAT_PAGE_OG_IMAGE,
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
  const rawImage = getPageOgImage(pathname);
  const image = {
    ...rawImage,
    url: absoluteSiteUrl(rawImage.url),
  };

  return {
    ...metadata,
    metadataBase: SITE_METADATA_BASE,
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

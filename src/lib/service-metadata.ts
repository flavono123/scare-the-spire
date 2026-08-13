import type { Metadata } from "next";
import type { ServiceLocale } from "@/lib/i18n";
import { DEFAULT_PAGE_OG_IMAGE, type PageOgImage } from "@/lib/page-og-images";
import {
  withKoreanSearchCanonical,
} from "@/lib/search-canonical";
import { absoluteSiteUrl, SITE_METADATA_BASE } from "@/lib/site-origin";
import { serviceMessages } from "@/messages/service";

export {
  absoluteKoreanCanonicalUrl,
  koreanSearchPath,
  withKoreanSearchCanonical,
} from "@/lib/search-canonical";

type ServiceMetadataCopy = {
  siteDescription: string;
  patchesTitle: string;
  patchesDescription: string;
  chemicalXTitle: string;
  chemicalXDescription: string;
  comboTitle: string;
  comboDescription: string;
  transfigureTitle: string;
  transfigureDescription: string;
};

type ServiceOgImage = PageOgImage | {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
};

const SERVICE_METADATA_COPY: Record<ServiceLocale, ServiceMetadataCopy> = {
  ko: {
    siteDescription: "슬레이 더 스파이어 2 패치노트, 백과사전, 커뮤니티",
    patchesTitle: "슬레이 더 스파이어 2 패치 노트 및 업데이트 내역",
    patchesDescription: "슬레이 더 스파이어 2 전체 패치 노트, 업데이트 내역, 카드·유물 변경 정보를 한국어로 확인하세요.",
    chemicalXTitle: "케미컬 X(구 트윕터)",
    chemicalXDescription: "슬레이 더 스파이어 2 고봉밥 트윕",
    comboTitle: "코오오옴보",
    comboDescription: "카드, 유물, 포션 등 슬레이 더 스파이어 2 게임 요소 조합을 공유합니다.",
    transfigureTitle: "변형",
    transfigureDescription: "슬레이 더 스파이어 2 게임 요소를 골라 설명을 새롭게 써서 공유합니다.",
  },
  en: {
    siteDescription: "Slay the Spire 2 patch notes, Compendium, and community.",
    patchesTitle: "Slay the Spire 2 Patch Notes & Update History",
    patchesDescription: "Complete Slay the Spire 2 patch notes, update history, and linked card and relic changes.",
    chemicalXTitle: "Chemical X (formerly Twipter)",
    chemicalXDescription: "Full Slay the Spire 2 twips.",
    comboTitle: "C-c-c-Combo",
    comboDescription: "Share combinations of Slay the Spire 2 Compendium resources, including cards, relics, and potions.",
    transfigureTitle: "Transfigure",
    transfigureDescription: "Choose a Slay the Spire 2 game element, rewrite its description, and share it.",
  },
};

export function getServiceMetadataCopy(
  serviceLocale: ServiceLocale,
): ServiceMetadataCopy {
  return SERVICE_METADATA_COPY[serviceLocale];
}

export function getServiceBrand(serviceLocale: ServiceLocale): string {
  return serviceMessages[serviceLocale].brand;
}

const GAME_TITLE: Record<ServiceLocale, string> = {
  ko: "슬레이 더 스파이어 2",
  en: "Slay the Spire 2",
};

export function getGameTitle(serviceLocale: ServiceLocale): string {
  return GAME_TITLE[serviceLocale];
}

/** Shared Toy Box post OG description: game · brand · service · service copy. */
export function composeToyBoxPostOgDescription({
  serviceLocale,
  serviceName,
  serviceDescription,
}: {
  serviceLocale: ServiceLocale;
  serviceName: string;
  serviceDescription: string;
}): string {
  return [
    getGameTitle(serviceLocale),
    getServiceBrand(serviceLocale),
    serviceName,
    serviceDescription,
  ].join(" · ");
}

function absoluteServiceOgImage<T extends ServiceOgImage>(image: T): T {
  return {
    ...image,
    url: absoluteSiteUrl(image.url),
  };
}

export function getServiceTitle(
  serviceLocale: ServiceLocale,
  pageTitle?: string,
): string {
  const brand = getServiceBrand(serviceLocale);
  return pageTitle ? `${pageTitle} - ${brand}` : brand;
}

export function getDefaultServiceMetadata(
  serviceLocale: ServiceLocale,
): Metadata {
  const brand = getServiceBrand(serviceLocale);
  const description = getServiceMetadataCopy(serviceLocale).siteDescription;
  const image = absoluteServiceOgImage(DEFAULT_PAGE_OG_IMAGE);

  return {
    metadataBase: SITE_METADATA_BASE,
    title: {
      default: brand,
      template: `%s - ${brand}`,
    },
    description,
    openGraph: {
      title: brand,
      description,
      siteName: brand,
      images: [image],
      locale: serviceLocale === "ko" ? "ko_KR" : "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: brand,
      description,
      images: [image.url],
    },
  };
}

export function getServiceOgMetadata({
  serviceLocale,
  title,
  description,
  image = DEFAULT_PAGE_OG_IMAGE,
  canonicalPath,
}: {
  serviceLocale: ServiceLocale;
  title: string;
  description: string;
  image?: ServiceOgImage;
  canonicalPath?: string;
}): Metadata {
  const fullTitle = getServiceTitle(serviceLocale, title);
  const brand = getServiceBrand(serviceLocale);
  const ogImage = absoluteServiceOgImage(image);

  const metadata: Metadata = {
    metadataBase: SITE_METADATA_BASE,
    title: {
      absolute: fullTitle,
    },
    description,
    openGraph: {
      title: fullTitle,
      description,
      siteName: brand,
      images: [ogImage],
      locale: serviceLocale === "ko" ? "ko_KR" : "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [ogImage.url],
    },
  };

  return canonicalPath
    ? withKoreanSearchCanonical(metadata, canonicalPath)
    : metadata;
}

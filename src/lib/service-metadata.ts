import type { Metadata } from "next";
import type { ServiceLocale } from "@/lib/i18n";
import { DEFAULT_PAGE_OG_IMAGE, type PageOgImage } from "@/lib/page-og-images";
import { serviceMessages } from "@/messages/service";

type ServiceMetadataCopy = {
  siteDescription: string;
  patchesTitle: string;
  patchesDescription: string;
  chemicalXTitle: string;
  chemicalXDescription: string;
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
    patchesTitle: "슬서운 변경",
    patchesDescription: "슬레이 더 스파이어 2 패치 노트 고봉밥 버전",
    chemicalXTitle: "케미컬 X(구 트윕터)",
    chemicalXDescription: "슬레이 더 스파이어 2 고봉밥 트윕",
  },
  en: {
    siteDescription: "Slay the Spire 2 patch notes, Compendium, and community.",
    patchesTitle: "Scare the Changes",
    patchesDescription: "Full rich Slay the Spire 2 patch notes.",
    chemicalXTitle: "Chemical X (formerly Twipter)",
    chemicalXDescription: "Full Slay the Spire 2 twips.",
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

  return {
    title: {
      default: brand,
      template: `%s - ${brand}`,
    },
    description,
    openGraph: {
      title: brand,
      description,
      siteName: brand,
      images: [DEFAULT_PAGE_OG_IMAGE],
      locale: serviceLocale === "ko" ? "ko_KR" : "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: brand,
      description,
      images: [DEFAULT_PAGE_OG_IMAGE.url],
    },
  };
}

export function getServiceOgMetadata({
  serviceLocale,
  title,
  description,
  image = DEFAULT_PAGE_OG_IMAGE,
}: {
  serviceLocale: ServiceLocale;
  title: string;
  description: string;
  image?: ServiceOgImage;
}): Metadata {
  const fullTitle = getServiceTitle(serviceLocale, title);
  const brand = getServiceBrand(serviceLocale);

  return {
    title: {
      absolute: fullTitle,
    },
    description,
    openGraph: {
      title: fullTitle,
      description,
      siteName: brand,
      images: [image],
      locale: serviceLocale === "ko" ? "ko_KR" : "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image.url],
    },
  };
}

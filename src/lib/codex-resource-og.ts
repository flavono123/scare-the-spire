import type { Metadata } from "next";
import { getCodexMetadata } from "@/lib/codex-service";
import { stripCodexMarkup } from "@/lib/codex-search";
import type { ServiceLocale } from "@/lib/i18n";
import { DEFAULT_PAGE_OG_IMAGE } from "@/lib/page-og-images";

export type RouteSearchParamValue = string | string[] | undefined;

export type CodexOgResource = {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
};

export function firstRouteSearchParam(value: RouteSearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function findCodexResourceByRouteId<T extends { id: string }>(
  resources: T[],
  id: string | undefined,
): T | undefined {
  if (!id) return undefined;
  return resources.find((item) => item.id.toLowerCase() === id.toLowerCase());
}

export function plainCodexOgDescription(description: string | null | undefined): string {
  return stripCodexMarkup(description ?? "").replace(/\s+/g, " ").trim();
}

export function getCodexResourceOgMetadata(
  serviceLocale: ServiceLocale,
  collectionTitle: string,
  resource: CodexOgResource,
): Metadata {
  const metadata = getCodexMetadata(serviceLocale, `${resource.name} — ${collectionTitle}`);
  const description = plainCodexOgDescription(resource.description) || metadata.description;
  const imageUrl = resource.imageUrl ?? DEFAULT_PAGE_OG_IMAGE.url;
  const image = {
    url: imageUrl,
    alt: resource.name,
  };

  return {
    ...metadata,
    description,
    openGraph: {
      title: resource.name,
      description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: resource.name,
      description,
      images: [imageUrl],
    },
  };
}

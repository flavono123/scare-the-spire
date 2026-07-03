import type { Metadata } from "next";
import { getCodexMetadata } from "@/lib/codex-service";
import { stripCodexMarkup } from "@/lib/codex-search";
import type { ServiceLocale } from "@/lib/i18n";
import { DEFAULT_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import { absoluteSiteUrl, SITE_METADATA_BASE } from "@/lib/site-origin";
import {
  getMadScienceCardTypeFromId,
  getMadScienceVariantId,
} from "@/lib/tinker-time";
import type { CodexCard } from "@/lib/codex-types";

export type SearchParamValue = string | string[] | undefined;

export function firstSearchParam(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function isBetaArtSearchParam(value: SearchParamValue): boolean {
  const normalized = firstSearchParam(value)?.toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

export function findCardByCodexRouteId<T extends { id: string }>(
  cards: T[],
  id: string | undefined,
): T | undefined {
  if (!id) return undefined;
  const madScienceType = getMadScienceCardTypeFromId(id);
  const resolvedId = madScienceType ? getMadScienceVariantId(madScienceType) : id;
  return cards.find((c) => c.id.toLowerCase() === resolvedId.toLowerCase());
}

function cardOgDescription(description: string): string {
  return stripCodexMarkup(description).replace(/\s+/g, " ").trim();
}

export function getCodexCardOgMetadata(
  serviceLocale: ServiceLocale,
  cardLibraryTitle: string,
  card: CodexCard,
  opts?: {
    useBetaArt?: boolean;
  },
): Metadata {
  const metadata = getCodexMetadata(serviceLocale, `${card.name} — ${cardLibraryTitle}`);
  const description = cardOgDescription(card.description);
  const rawImageUrl = opts?.useBetaArt && card.betaImageUrl
    ? card.betaImageUrl
    : card.imageUrl ?? card.betaImageUrl ?? DEFAULT_PAGE_OG_IMAGE.url;
  const imageUrl = absoluteSiteUrl(rawImageUrl);
  const image = {
    url: imageUrl,
    width: 1000,
    height: 760,
    alt: card.name,
  };

  return {
    ...metadata,
    metadataBase: SITE_METADATA_BASE,
    description,
    openGraph: {
      title: card.name,
      description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: card.name,
      description,
      images: [imageUrl],
    },
  };
}

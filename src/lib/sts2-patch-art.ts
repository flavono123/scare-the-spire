import type { EntityInfo } from "@/components/patch-note-renderer";
import type { ServiceLocale } from "@/lib/i18n";
import type { STS2Patch, STS2PatchArt } from "@/lib/types";

export interface ResolvedPatchArt {
  imageUrl: string;
  alt: string;
  objectPosition: string;
}

const DEFAULT_PATCH_ART: ResolvedPatchArt = {
  imageUrl: "/images/sts2/patches/default-art.webp",
  alt: "Slay the Spire 2 banner art",
  objectPosition: "center",
};

const FALLBACK_ART_ENTITY_TYPES = new Set<STS2PatchArt["type"]>(["card", "event", "ancient"]);

function artAlt(art: STS2PatchArt, serviceLocale: ServiceLocale, fallback: string): string {
  if (serviceLocale === "ko") return art.altKo ?? art.alt ?? fallback;
  return art.alt ?? art.altKo ?? fallback;
}

function defaultPatchArt(serviceLocale: ServiceLocale): ResolvedPatchArt {
  return {
    ...DEFAULT_PATCH_ART,
    alt: serviceLocale === "ko" ? "슬레이 더 스파이어 2 배너 아트" : DEFAULT_PATCH_ART.alt,
  };
}

function epochArtImageUrl(id: string): string {
  return `/images/sts2/epochs/${id.toLowerCase()}.webp`;
}

function ancientBackgroundImageUrl(id: string): string {
  return `/images/sts2/ancients-bg/${id.toLowerCase()}_bg.webp`;
}

function resolveExplicitPatchArt(
  art: STS2PatchArt,
  entitiesByKey: Map<string, EntityInfo>,
  serviceLocale: ServiceLocale,
): ResolvedPatchArt | null {
  const objectPosition = art.objectPosition ?? "center";

  if (art.type === "image") {
    if (!art.imageUrl) return null;
    return {
      imageUrl: art.imageUrl,
      alt: artAlt(art, serviceLocale, defaultPatchArt(serviceLocale).alt),
      objectPosition,
    };
  }

  if (!art.id) return null;

  if (art.type === "epoch") {
    return {
      imageUrl: art.imageUrl ?? epochArtImageUrl(art.id),
      alt: artAlt(art, serviceLocale, `Epoch art: ${art.id}`),
      objectPosition,
    };
  }

  if (art.type === "ancient") {
    const entity = entitiesByKey.get(`ancient:${art.id}`);
    return {
      imageUrl: art.imageUrl ?? ancientBackgroundImageUrl(art.id),
      alt: artAlt(art, serviceLocale, entity?.nameKo ?? entity?.nameEn ?? `Ancient art: ${art.id}`),
      objectPosition,
    };
  }

  const entity = entitiesByKey.get(`${art.type}:${art.id}`);
  const imageUrl = art.imageUrl ?? entity?.imageUrl ?? entity?.cardData?.imageUrl ?? entity?.cardData?.betaImageUrl;
  if (!imageUrl) return null;

  return {
    imageUrl,
    alt: artAlt(art, serviceLocale, entity?.nameKo ?? entity?.nameEn ?? `${art.type} art: ${art.id}`),
    objectPosition,
  };
}

function resolveFeaturedEntityArt(
  patch: STS2Patch,
  entitiesByKey: Map<string, EntityInfo>,
  serviceLocale: ServiceLocale,
): ResolvedPatchArt | null {
  const featured = (patch.featuredEntities ?? []).find((entity) =>
    FALLBACK_ART_ENTITY_TYPES.has(entity.type as STS2PatchArt["type"]),
  );
  if (!featured) return null;

  return resolveExplicitPatchArt(
    { type: featured.type as STS2PatchArt["type"], id: featured.id },
    entitiesByKey,
    serviceLocale,
  );
}

export function resolvePatchArt(
  patch: STS2Patch,
  entitiesByKey: Map<string, EntityInfo>,
  serviceLocale: ServiceLocale,
): ResolvedPatchArt {
  if (patch.art) {
    const explicit = resolveExplicitPatchArt(patch.art, entitiesByKey, serviceLocale);
    if (explicit) return explicit;
  }

  return resolveFeaturedEntityArt(patch, entitiesByKey, serviceLocale) ?? defaultPatchArt(serviceLocale);
}

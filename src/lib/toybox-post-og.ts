import type { EntityType } from "@/components/patch-note-renderer";
import type { PostBlock } from "@/lib/chemical-types";
import { COMBO_KEYWORD_IMAGE_URL } from "@/lib/combo-resource-visuals";
import {
  extractComboHistoryRunReferences,
  extractComboResourceRefs,
  extractComboYouTubeReference,
  type ComboResourceRef,
} from "@/lib/combo-types";
import {
  CHEMICAL_X_PAGE_OG_IMAGE,
  HISTORY_COURSE_PAGE_OG_IMAGE,
  type PageOgImage,
} from "@/lib/page-og-images";
import { isCoverSpec, type CoverSpec } from "@/lib/run-cover-types";
import {
  getMadScienceVariantPartsFromId,
  TINKER_CARD_IMAGE_BY_TYPE,
} from "@/lib/tinker-time";
import { youtubeThumbnailUrl } from "@/lib/youtube-reference";

export const OG_TITLE_MAX_LENGTH = 80;

export function clipOgDescription(value: string, fallback = "", max = 180): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return fallback;
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export function truncateOgTitle(value: string): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  if (trimmed.length <= OG_TITLE_MAX_LENGTH) return trimmed;
  return `${trimmed.slice(0, OG_TITLE_MAX_LENGTH - 1).trimEnd()}…`;
}

function resourceSlug(id: string): string {
  return id.replace(/^(CARD|CHARACTER|RELIC|POTION|POWER)\./i, "").toLowerCase();
}

function cardArtUrl(cardId: string): string {
  const parts = getMadScienceVariantPartsFromId(cardId);
  if (parts) return TINKER_CARD_IMAGE_BY_TYPE[parts.cardType];
  return `/images/sts2/cards/${resourceSlug(cardId)}.webp`;
}

function characterSelectUrl(characterId: string): string {
  return `/images/sts2/characters/select_${resourceSlug(characterId)}.webp`;
}

/**
 * Static path for a Compendium resource. No catalog load — missing files fall
 * through to the caller’s service OG image.
 */
export function toyboxResourceOgImageUrl(
  type: string,
  id: string,
): string | null {
  const trimmedId = id.trim();
  if (!trimmedId) return null;
  const slug = resourceSlug(trimmedId);

  switch (type) {
    case "card":
      return cardArtUrl(trimmedId);
    case "relic":
      return `/images/sts2/relics/${slug}.webp`;
    case "potion":
      return `/images/sts2/potions/${slug}.webp`;
    case "power":
      return `/images/sts2/powers/${slug}_power.webp`;
    case "enchantment":
      return `/images/sts2/enchantments/${slug}.webp`;
    case "event":
      return `/images/sts2/events/${slug}.webp`;
    case "monster":
      return `/images/sts2/monsters-render/${slug}.webp`;
    case "ancient":
      return `/images/sts2/ancients/${slug}.webp`;
    case "epoch":
      return `/images/sts2/epochs/${slug}.webp`;
    case "character":
      return characterSelectUrl(trimmedId);
    case "keyword":
      return COMBO_KEYWORD_IMAGE_URL;
    default:
      return null;
  }
}

export function coverOgImageFromFields(fields: {
  character: string;
  coverSpec: CoverSpec | null;
}): PageOgImage {
  const cover = isCoverSpec(fields.coverSpec) ? fields.coverSpec : null;
  if (cover?.background.kind === "card-beta") {
    return {
      url: cardArtUrl(cover.background.cardId),
      width: 1000,
      height: 760,
      alt: cover.phrase || HISTORY_COURSE_PAGE_OG_IMAGE.alt,
    };
  }
  return {
    url: characterSelectUrl(fields.character),
    width: 1000,
    height: 760,
    alt: cover?.phrase || HISTORY_COURSE_PAGE_OG_IMAGE.alt,
  };
}

export function asPostBlocks(value: unknown): PostBlock[] {
  return Array.isArray(value) ? value as PostBlock[] : [];
}

export function asComboResources(value: unknown): ComboResourceRef[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as { type?: unknown; id?: unknown };
    if (typeof record.type !== "string" || typeof record.id !== "string") return [];
    if (!record.id.trim()) return [];
    return [{ type: record.type as ComboResourceRef["type"], id: record.id }];
  });
}

export function firstComboOgResource(
  resources: ComboResourceRef[],
  content: PostBlock[],
): ComboResourceRef | null {
  return resources[0] ?? extractComboResourceRefs(content)[0] ?? null;
}

export function comboPostOgImage(fields: {
  content: PostBlock[];
  resources: ComboResourceRef[];
}): PageOgImage | null {
  const youtube = extractComboYouTubeReference(fields.content);
  if (youtube) {
    return {
      url: youtubeThumbnailUrl(youtube.videoId),
      width: 480,
      height: 360,
      alt: youtube.title,
    };
  }

  const historyRun = extractComboHistoryRunReferences(fields.content)[0];
  if (historyRun) {
    return coverOgImageFromFields({
      character: historyRun.snapshot.character,
      coverSpec: historyRun.snapshot.coverSpec ?? null,
    });
  }

  const resource = firstComboOgResource(fields.resources, fields.content);
  if (!resource) return null;
  const url = toyboxResourceOgImageUrl(resource.type, resource.id);
  if (!url) return null;
  return {
    url,
    width: 1000,
    height: 760,
    alt: resource.id,
  };
}

export function firstChemicalKeywordResource(
  content: PostBlock[],
): { type: EntityType; id: string } | null {
  for (const block of content) {
    if (block.type !== "keyword") continue;
    if (!block.entityType || !block.entityId?.trim()) continue;
    return { type: block.entityType, id: block.entityId };
  }
  return null;
}

export function postBlockOgImage(content: PostBlock[], fallback: PageOgImage): PageOgImage {
  const keyword = firstChemicalKeywordResource(content);
  const keywordUrl = keyword ? toyboxResourceOgImageUrl(keyword.type, keyword.id) : null;
  if (keywordUrl) {
    return { url: keywordUrl, width: 1000, height: 760, alt: keyword?.id ?? fallback.alt };
  }
  for (const block of content) {
    if (block.type === "entity") {
      const url = toyboxResourceOgImageUrl(block.entityType, block.entityId);
      if (url) return { url, width: 1000, height: 760, alt: block.displayText || fallback.alt };
    }
    if (block.type === "card-con") {
      const url = toyboxResourceOgImageUrl("card", block.cardId);
      if (url) return { url, width: 1000, height: 760, alt: block.displayText || fallback.alt };
    }
  }
  return fallback;
}

export function chemicalPostOgImage(content: PostBlock[]): PageOgImage {
  const keyword = firstChemicalKeywordResource(content);
  const url = keyword
    ? toyboxResourceOgImageUrl(keyword.type, keyword.id)
    : null;
  if (!url) return CHEMICAL_X_PAGE_OG_IMAGE;
  return {
    url,
    width: 1000,
    height: 760,
    alt: keyword?.id ?? CHEMICAL_X_PAGE_OG_IMAGE.alt,
  };
}

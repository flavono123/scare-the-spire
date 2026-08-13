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
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import {
  getMadScienceVariantPartsFromId,
  TINKER_CARD_IMAGE_BY_TYPE,
} from "@/lib/tinker-time";
import { youtubeThumbnailUrl } from "@/lib/youtube-reference";

export const OG_TITLE_MAX_LENGTH = 80;

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

function asPostBlocks(value: unknown): PostBlock[] {
  return Array.isArray(value) ? value as PostBlock[] : [];
}

function asComboResources(value: unknown): ComboResourceRef[] {
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

async function selectToyBoxOgRow<T>(
  operation: string,
  table: string,
  id: string,
  columns: string,
): Promise<T | null> {
  if (!supabaseEnabled || !id) return null;
  const result = await withSupabaseTimeout(
    operation,
    supabase
      .from(table)
      .select(columns)
      .eq("id", id)
      .eq("env", supabaseEnv)
      .maybeSingle(),
  ).catch(() => ({ data: null, error: true }));
  if ("error" in result && result.error) return null;
  if (!result.data) return null;
  return result.data as T;
}

export async function getTransfigurePostOgFields(id: string): Promise<{
  title: string | null;
  transformedName: string | null;
  resourceType: string;
  resourceId: string;
} | null> {
  const row = await selectToyBoxOgRow<{
    title: string | null;
    transformed_name: string | null;
    resource_type: string;
    resource_id: string;
  }>(
    "transfigure_posts.select.og-fields",
    "transfigure_posts",
    id,
    "title, transformed_name, resource_type, resource_id",
  );
  if (!row?.resource_type || !row.resource_id) return null;
  return {
    title: row.title,
    transformedName: row.transformed_name,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
  };
}

export async function getComboPostOgFields(id: string): Promise<{
  contentText: string;
  content: PostBlock[];
  resources: ComboResourceRef[];
} | null> {
  const row = await selectToyBoxOgRow<{
    content_text: string | null;
    content: unknown;
    resources: unknown;
  }>(
    "combo_posts.select.og-fields",
    "combo_posts",
    id,
    "content_text, content, resources",
  );
  if (!row) return null;
  return {
    contentText: typeof row.content_text === "string" ? row.content_text : "",
    content: asPostBlocks(row.content),
    resources: asComboResources(row.resources),
  };
}

export async function getThisOrThatPostOgFields(id: string): Promise<{
  reason: string;
  leftType: string;
  leftId: string;
} | null> {
  const row = await selectToyBoxOgRow<{
    reason: string | null;
    left_type: string;
    left_id: string;
  }>(
    "this_or_that_posts.select.og-fields",
    "this_or_that_posts",
    id,
    "reason, left_type, left_id",
  );
  if (!row?.left_type || !row.left_id) return null;
  return {
    reason: typeof row.reason === "string" ? row.reason : "",
    leftType: row.left_type,
    leftId: row.left_id,
  };
}

export async function getChemicalPostOgFields(id: string): Promise<{
  contentText: string;
  content: PostBlock[];
} | null> {
  const row = await selectToyBoxOgRow<{
    content_text: string | null;
    content: unknown;
  }>(
    "chemical_posts.select.og-fields",
    "chemical_posts",
    id,
    "content_text, content",
  );
  if (!row) return null;
  return {
    contentText: typeof row.content_text === "string" ? row.content_text : "",
    content: asPostBlocks(row.content),
  };
}

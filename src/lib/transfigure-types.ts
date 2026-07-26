import type { EntityInfo, EntityType } from "@/components/patch-note-renderer";
import type { PostBlock } from "@/lib/chemical-types";
import { stripCodexMarkup } from "@/lib/codex-search";
import type { GameLocale } from "@/lib/i18n";

export const TRANSFIGURE_RESOURCE_TYPES = [
  "card",
  "character",
  "keyword",
  "relic",
  "potion",
  "power",
  "enchantment",
  "affliction",
  "event",
  "ancient",
  "epoch",
] as const satisfies readonly EntityType[];

export type TransfigureResourceType = (typeof TRANSFIGURE_RESOURCE_TYPES)[number];

export interface TransfigureResourceRef {
  type: TransfigureResourceType;
  id: string;
}

export interface TransfigurePost {
  id: string;
  user_id: string;
  nickname: string;
  resource_type: TransfigureResourceType;
  resource_id: string;
  source_text: string;
  source_game_locale: GameLocale;
  content: PostBlock[];
  content_text: string;
  env: string;
  created_at: string;
}

export function isTransfigureResourceType(
  type: EntityType,
): type is TransfigureResourceType {
  return TRANSFIGURE_RESOURCE_TYPES.includes(type as TransfigureResourceType);
}

export function getTransfigureEntityDescription(entity: EntityInfo): string | null {
  if (!isTransfigureResourceType(entity.type)) return null;

  return (
    entity.cardData?.description
    ?? entity.characterData?.description
    ?? entity.keywordData?.description
    ?? entity.relicData?.description
    ?? entity.potionData?.description
    ?? entity.powerData?.description
    ?? entity.enchantmentData?.description
    ?? entity.afflictionData?.description
    ?? entity.eventData?.description
    ?? entity.ancientData?.description
    ?? entity.epochData?.description
    ?? null
  );
}

export function getTransfigureSourceText(entity: EntityInfo): string | null {
  const description = getTransfigureEntityDescription(entity);
  if (!description) return null;

  const text = stripCodexMarkup(description).replace(/\s+/g, " ").trim();
  return text || null;
}

export function transfigureResourceKey(resource: TransfigureResourceRef): string {
  return `${resource.type}:${resource.id}`;
}

export function isTransfiguredContent(
  blocks: PostBlock[],
  sourceText: string,
): boolean {
  const normalizedSource = sourceText.replace(/\s+/g, " ").trim();
  const normalizedContent = blocks
    .map((block) => {
      if (block.type === "text") return block.text;
      if (block.type === "keyword") return block.text;
      if (block.type === "entity") return block.displayText;
      return block.title;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();

  return (
    normalizedContent !== normalizedSource
    || blocks.some((block) => block.type !== "text")
  );
}

export function findTransfigureEntity(
  entities: EntityInfo[],
  resource: TransfigureResourceRef,
): EntityInfo | undefined {
  return entities.find(
    (entity) => entity.type === resource.type && entity.id === resource.id,
  );
}

import type { EntityInfo, EntityType } from "@/components/patch-note-renderer";
import {
  hasCardUpgrade,
  renderCardDescription,
} from "@/components/codex/codex-description";
import type { PostBlock } from "@/lib/chemical-types";
import { historyRunPlainText } from "@/lib/history-run-reference";
import {
  buildEntityKeywordIndex,
  entityKeywordDescription,
  resolveEntityKeyword,
} from "@/lib/chemical-utils";
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
  title: string | null;
  resource_type: TransfigureResourceType;
  resource_id: string;
  source_text: string;
  source_game_locale: GameLocale;
  transformed_name: string | null;
  transformed_cost: string | null;
  upgraded_content: PostBlock[] | null;
  upgraded_content_text: string | null;
  transformed_upgrade_cost: string | null;
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

function appendTextBlock(blocks: PostBlock[], text: string) {
  if (!text) return;
  const previous = blocks.at(-1);
  if (previous?.type === "text") {
    previous.text += text;
    return;
  }
  blocks.push({ type: "text", text });
}

function getTransfigureBlocksFromDescription(
  description: string,
  entities: EntityInfo[],
): PostBlock[] {
  const blocks: PostBlock[] = [];
  const keywordIndex = buildEntityKeywordIndex(entities);
  const goldPattern = /\[gold(?:\s+[^\]]*)?\]([\s\S]*?)\[\/gold\]/gi;
  let cursor = 0;

  for (const match of description.matchAll(goldPattern)) {
    if (match.index == null) continue;
    appendTextBlock(
      blocks,
      stripCodexMarkup(description.slice(cursor, match.index)).replace(/\s+/g, " "),
    );

    const text = stripCodexMarkup(match[1] ?? "").replace(/\s+/g, " ").trim();
    if (text) {
      const keywordEntity = resolveEntityKeyword(text, keywordIndex);
      const keywordDescription = keywordEntity
        ? entityKeywordDescription(keywordEntity)
        : null;
      blocks.push({
        type: "keyword",
        text,
        keyword: keywordEntity?.nameKo ?? text,
        description: keywordDescription
          ? stripCodexMarkup(keywordDescription).replace(/\s+/g, " ").trim()
          : text,
        entityId: keywordEntity?.id,
        entityType: keywordEntity?.type,
      });
    }
    cursor = match.index + match[0].length;
  }

  appendTextBlock(
    blocks,
    stripCodexMarkup(description.slice(cursor)).replace(/\s+/g, " "),
  );

  const first = blocks[0];
  if (first?.type === "text") first.text = first.text.trimStart();
  const last = blocks.at(-1);
  if (last?.type === "text") last.text = last.text.trimEnd();
  return blocks;
}

export function getTransfigureInitialBlocks(
  entity: EntityInfo,
  entities: EntityInfo[],
): PostBlock[] {
  const description = getTransfigureEntityDescription(entity);
  return description
    ? getTransfigureBlocksFromDescription(description, entities)
    : [];
}

export function getTransfigureUpgradeDescription(
  entity: EntityInfo,
): string | null {
  if (
    entity.type !== "card"
    || !entity.cardData
    || !hasCardUpgrade(entity.cardData)
  ) {
    return null;
  }
  return renderCardDescription(entity.cardData, { upgradeLevel: 1 });
}

export function getTransfigureUpgradeSourceText(
  entity: EntityInfo,
): string | null {
  const description = getTransfigureUpgradeDescription(entity);
  if (!description) return null;
  const text = stripCodexMarkup(description).replace(/\s+/g, " ").trim();
  return text || null;
}

export function getTransfigureUpgradeInitialBlocks(
  entity: EntityInfo,
  entities: EntityInfo[],
): PostBlock[] | null {
  const description = getTransfigureUpgradeDescription(entity);
  return description
    ? getTransfigureBlocksFromDescription(description, entities)
    : null;
}

export function transfigureBlocksToGameDescription(blocks: PostBlock[]): string {
  return blocks.map((block) => {
    if (block.type === "text") return block.text;
    if (block.type === "keyword") return `[gold]${block.text}[/gold]`;
    if (block.type === "entity") return `[gold]${block.displayText}[/gold]`;
    if (block.type === "history-run") return historyRunPlainText(block);
    return block.title;
  }).join("");
}

export function getTransfigureSourceCost(entity: EntityInfo): string | null {
  if (entity.type !== "card" || !entity.cardData) return null;
  if (entity.cardData.isXCost) return "X";
  return entity.cardData.cost >= 0 ? String(entity.cardData.cost) : null;
}

export function getTransfigureUpgradeSourceCost(
  entity: EntityInfo,
): string | null {
  if (entity.type !== "card" || !entity.cardData) return null;
  if (entity.cardData.isXCost) return "X";
  const upgradedCost = (
    entity.cardData.upgrade?.cost
    ?? entity.cardData.specialUpgrade?.upgrade.cost
  );
  if (typeof upgradedCost === "number" && upgradedCost >= 0) {
    return String(upgradedCost);
  }
  return getTransfigureSourceCost(entity);
}

export function normalizeTransfigureCostInput(value: string): string {
  const cleaned = value.toUpperCase().replace(/[^0-9X]/g, "");
  return cleaned.includes("X") ? "X" : cleaned.slice(0, 2);
}

export function normalizeTransfigureName(
  value: string,
  sourceName: string,
): string | null {
  const trimmed = value.trim();
  return trimmed && trimmed !== sourceName.trim() ? trimmed : null;
}

export function normalizeTransfigureCost(
  value: string,
  sourceCost: string | null,
): string | null {
  const trimmed = value.trim().toUpperCase();
  return trimmed && trimmed !== sourceCost ? trimmed : null;
}

export function isTransfigureChanged({
  blocks,
  sourceText,
  sourceBlocks,
  transformedName,
  sourceName,
  transformedCost,
  sourceCost,
  upgradedBlocks,
  sourceUpgradeText,
  sourceUpgradeBlocks,
  transformedUpgradeCost = "",
  sourceUpgradeCost = null,
}: {
  blocks: PostBlock[];
  sourceText: string;
  sourceBlocks: PostBlock[];
  transformedName: string;
  sourceName: string;
  transformedCost: string;
  sourceCost: string | null;
  upgradedBlocks?: PostBlock[] | null;
  sourceUpgradeText?: string | null;
  sourceUpgradeBlocks?: PostBlock[] | null;
  transformedUpgradeCost?: string;
  sourceUpgradeCost?: string | null;
}): boolean {
  return (
    isTransfiguredContent(blocks, sourceText, sourceBlocks)
    || normalizeTransfigureName(transformedName, sourceName) != null
    || normalizeTransfigureCost(transformedCost, sourceCost) != null
    || (
      upgradedBlocks != null
      && sourceUpgradeText != null
      && sourceUpgradeBlocks != null
      && isTransfiguredContent(
        upgradedBlocks,
        sourceUpgradeText,
        sourceUpgradeBlocks,
      )
    )
    || normalizeTransfigureCost(
      transformedUpgradeCost,
      sourceUpgradeCost,
    ) != null
  );
}

export function transfigureResourceKey(resource: TransfigureResourceRef): string {
  return `${resource.type}:${resource.id}`;
}

export function isTransfiguredContent(
  blocks: PostBlock[],
  sourceText: string,
  sourceBlocks?: PostBlock[],
): boolean {
  const normalizedSource = sourceText.replace(/\s+/g, " ").trim();
  const normalizedContent = blocks
    .map((block) => {
      if (block.type === "text") return block.text;
      if (block.type === "keyword") return block.text;
      if (block.type === "entity") return block.displayText;
      if (block.type === "history-run") return historyRunPlainText(block);
      return block.title;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();

  if (normalizedContent !== normalizedSource) return true;
  if (sourceBlocks) {
    const signature = (items: PostBlock[]) => items.map((block) => {
      if (block.type === "text") return `text:${block.text.replace(/\s+/g, " ")}`;
      if (block.type === "keyword") {
        return `keyword:${block.text}:${block.keyword ?? ""}:${block.entityType ?? ""}:${block.entityId ?? ""}`;
      }
      if (block.type === "entity") {
        return `entity:${block.displayText}:${block.entityType}:${block.entityId}`;
      }
      if (block.type === "history-run") {
        return `history-run:${block.runId}`;
      }
      return `youtube:${block.videoId}:${block.title}`;
    }).join("|");
    return signature(blocks) !== signature(sourceBlocks);
  }
  return blocks.some((block) => block.type !== "text");
}

export function findTransfigureEntity(
  entities: EntityInfo[],
  resource: TransfigureResourceRef,
): EntityInfo | undefined {
  return entities.find(
    (entity) => entity.type === resource.type && entity.id === resource.id,
  );
}

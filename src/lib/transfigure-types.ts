import type { EntityInfo, EntityType } from "@/components/patch-note-renderer";
import {
  hasCardUpgrade,
  renderCardDescription,
} from "@/components/codex/codex-description";
import type { PostBlock } from "@/lib/chemical-types";
import type {
  CardRarityKo,
  CardTypeKo,
  CodexCard,
} from "@/lib/codex-types";
import { historyRunPlainText } from "@/lib/history-run-reference";
import {
  buildEntityKeywordIndex,
  entityKeywordDescription,
  resolveEntityKeyword,
} from "@/lib/chemical-utils";
import { stripCodexMarkup } from "@/lib/codex-search";
import type { GameLocale } from "@/lib/i18n";
import {
  CARD_BOTTOM_KEYWORD_ORDER,
  CARD_TOP_KEYWORD_ORDER,
  getCardDisplayKeywords,
  splitCardDisplayKeywords,
} from "@/lib/sts2-card-keywords";

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

export const TRANSFIGURE_CARD_TYPES = [
  "공격",
  "스킬",
  "파워",
] as const satisfies readonly CardTypeKo[];

export const TRANSFIGURE_CARD_RARITIES = [
  "일반",
  "고급",
  "희귀",
] as const satisfies readonly CardRarityKo[];

export type TransfigureCardType = (typeof TRANSFIGURE_CARD_TYPES)[number];
export type TransfigureCardRarity = (typeof TRANSFIGURE_CARD_RARITIES)[number];

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
  transformed_card_type: TransfigureCardType | null;
  transformed_card_rarity: TransfigureCardRarity | null;
  card_top_keywords: string[];
  card_bottom_keywords: string[];
  upgraded_content: PostBlock[] | null;
  upgraded_content_text: string | null;
  transformed_upgrade_cost: string | null;
  upgraded_card_top_keywords: string[];
  upgraded_card_bottom_keywords: string[];
  show_upgrade: boolean;
  content: PostBlock[];
  content_text: string;
  env: string;
  created_at: string;
}

export interface TransfigureCardKeywords {
  top: string[];
  bottom: string[];
}

export function isTransfigureResourceType(
  type: EntityType,
): type is TransfigureResourceType {
  return TRANSFIGURE_RESOURCE_TYPES.includes(type as TransfigureResourceType);
}

export function getTransfigureEntityDescription(entity: EntityInfo): string | null {
  if (!isTransfigureResourceType(entity.type)) return null;
  if (entity.cardData) {
    return entity.cardData.description;
  }

  return (
    entity.characterData?.description
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

export function getTransfigureCardKeywords(
  entity: EntityInfo,
  upgradeLevel = 0,
): TransfigureCardKeywords | null {
  if (entity.type !== "card" || !entity.cardData) return null;
  const {
    preDescriptionKeywords,
    postDescriptionKeywords,
  } = splitCardDisplayKeywords(
    getCardDisplayKeywords(entity.cardData, { upgradeLevel }),
  );
  return {
    top: preDescriptionKeywords,
    bottom: postDescriptionKeywords,
  };
}

export function getTransfigureUpgradeCardKeywords(
  entity: EntityInfo,
): TransfigureCardKeywords | null {
  if (
    entity.type !== "card"
    || !entity.cardData
    || !hasCardUpgrade(entity.cardData)
  ) {
    return null;
  }
  return getTransfigureCardKeywords(entity, 1);
}

export function normalizeTransfigureCardKeywords(
  keywords: TransfigureCardKeywords | null | undefined,
): TransfigureCardKeywords {
  const top = new Set(keywords?.top ?? []);
  const bottom = new Set(keywords?.bottom ?? []);
  return {
    top: CARD_TOP_KEYWORD_ORDER.filter((keyword) => top.has(keyword)),
    bottom: CARD_BOTTOM_KEYWORD_ORDER.filter((keyword) => bottom.has(keyword)),
  };
}

export function transfigureCardKeywordsEqual(
  left: TransfigureCardKeywords | null | undefined,
  right: TransfigureCardKeywords | null | undefined,
): boolean {
  const normalizedLeft = normalizeTransfigureCardKeywords(left);
  const normalizedRight = normalizeTransfigureCardKeywords(right);
  return (
    normalizedLeft.top.join("\u0000") === normalizedRight.top.join("\u0000")
    && normalizedLeft.bottom.join("\u0000")
      === normalizedRight.bottom.join("\u0000")
  );
}

/** Author shorthand → Codex BBCode: `@@` → `[energy:2]`, `***` → `[star:3]`. */
export function encodeTransfigureCostTokens(text: string): string {
  return text
    .replace(/@+/g, (match) => `[energy:${match.length}]`)
    .replace(/\*+/g, (match) => `[star:${match.length}]`);
}

/** Codex BBCode → author shorthand for the transfigure editor. */
export function decodeTransfigureCostTokens(text: string): string {
  return text
    .replace(/\[energy:(\d+)\]/gi, (_, count: string) => "@".repeat(Number(count)))
    .replace(/\[star:(\d+)\]/gi, (_, count: string) => "*".repeat(Number(count)));
}

function stripTransfigureDescriptionText(text: string): string {
  return stripCodexMarkup(decodeTransfigureCostTokens(text)).replace(/\s+/g, " ");
}

export function getTransfigureSourceText(entity: EntityInfo): string | null {
  const description = getTransfigureEntityDescription(entity);
  if (!description) return null;

  const text = stripTransfigureDescriptionText(description).trim();
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

/** Append description text while promoting `@` / `*` runs to cost-token blocks. */
function appendDescriptionText(blocks: PostBlock[], text: string) {
  if (!text) return;
  const tokenRe = /(@+|\*+)/g;
  let cursor = 0;
  for (const match of text.matchAll(tokenRe)) {
    if (match.index == null) continue;
    appendTextBlock(blocks, text.slice(cursor, match.index));
    const token = match[0]!;
    const kind = token[0] === "@" ? "energy" as const : "star" as const;
    const previous = blocks.at(-1);
    if (previous?.type === "cost-token" && previous.kind === kind) {
      previous.count += token.length;
    } else {
      blocks.push({ type: "cost-token", kind, count: token.length });
    }
    cursor = match.index + token.length;
  }
  appendTextBlock(blocks, text.slice(cursor));
}

export function getTransfigureBlocksFromDescription(
  description: string,
  entities: EntityInfo[],
): PostBlock[] {
  const blocks: PostBlock[] = [];
  const keywordIndex = buildEntityKeywordIndex(entities);
  const goldPattern = /\[gold(?:\s+[^\]]*)?\]([\s\S]*?)\[\/gold\]/gi;
  let cursor = 0;

  for (const match of description.matchAll(goldPattern)) {
    if (match.index == null) continue;
    appendDescriptionText(
      blocks,
      stripTransfigureDescriptionText(description.slice(cursor, match.index)),
    );

    const text = stripTransfigureDescriptionText(match[1] ?? "").trim();
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
          ? stripTransfigureDescriptionText(keywordDescription).trim()
          : text,
        entityId: keywordEntity?.id,
        entityType: keywordEntity?.type,
      });
    }
    cursor = match.index + match[0].length;
  }

  appendDescriptionText(
    blocks,
    stripTransfigureDescriptionText(description.slice(cursor)),
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
  const text = stripTransfigureDescriptionText(description).trim();
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
  return encodeTransfigureCostTokens(blocks.map((block) => {
    if (block.type === "text") return block.text;
    if (block.type === "cost-token") {
      return block.kind === "energy"
        ? `[energy:${Math.max(1, Math.floor(block.count) || 1)}]`
        : `[star:${Math.max(1, Math.floor(block.count) || 1)}]`;
    }
    if (block.type === "keyword") return `[gold]${block.text}[/gold]`;
    if (block.type === "entity") return `[gold]${block.displayText}[/gold]`;
    if (block.type === "history-run") return historyRunPlainText(block);
    return block.title;
  }).join(""));
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

export function isTransfigureCardType(
  value: unknown,
): value is TransfigureCardType {
  return TRANSFIGURE_CARD_TYPES.includes(value as TransfigureCardType);
}

export function isTransfigureCardRarity(
  value: unknown,
): value is TransfigureCardRarity {
  return TRANSFIGURE_CARD_RARITIES.includes(value as TransfigureCardRarity);
}

export function canTransfigureCardMetadata(
  sourceType: CardTypeKo | null | undefined,
  sourceRarity: CardRarityKo | null | undefined,
): boolean {
  return isTransfigureCardType(sourceType)
    && (sourceRarity === "기본" || isTransfigureCardRarity(sourceRarity));
}

export function normalizeTransfigureCardType(
  value: string | null | undefined,
  sourceType: CardTypeKo | null,
): TransfigureCardType | null {
  return isTransfigureCardType(value) && value !== sourceType ? value : null;
}

export function normalizeTransfigureCardRarity(
  value: string | null | undefined,
  sourceRarity: CardRarityKo | null,
): TransfigureCardRarity | null {
  return isTransfigureCardRarity(value) && value !== sourceRarity ? value : null;
}

export function getTransfigureCardTypeLabel(
  entities: EntityInfo[],
  type: TransfigureCardType,
): string {
  return entities.find((entity) => entity.cardData?.type === type)
    ?.cardData?.typeLabel ?? type;
}

export function getTransfigureCardRarityLabel(
  entities: EntityInfo[],
  rarity: TransfigureCardRarity,
): string {
  return entities.find((entity) => entity.cardData?.rarity === rarity)
    ?.cardData?.rarityLabel ?? rarity;
}

export function applyTransfigureCardMetadata(
  card: CodexCard,
  entities: EntityInfo[],
  transformedCardType?: TransfigureCardType | null,
  transformedCardRarity?: TransfigureCardRarity | null,
): CodexCard {
  if (!canTransfigureCardMetadata(card.type, card.rarity)) return card;

  return {
    ...card,
    type: transformedCardType ?? card.type,
    typeLabel: transformedCardType
      ? getTransfigureCardTypeLabel(entities, transformedCardType)
      : card.typeLabel,
    rarity: transformedCardRarity ?? card.rarity,
    rarityLabel: transformedCardRarity
      ? getTransfigureCardRarityLabel(entities, transformedCardRarity)
      : card.rarityLabel,
  };
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
  showUpgrade = false,
  cardKeywords = null,
  sourceCardKeywords = null,
  upgradedCardKeywords = null,
  sourceUpgradedCardKeywords = null,
  transformedCardType = "",
  sourceCardType = null,
  transformedCardRarity = "",
  sourceCardRarity = null,
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
  showUpgrade?: boolean;
  cardKeywords?: TransfigureCardKeywords | null;
  sourceCardKeywords?: TransfigureCardKeywords | null;
  upgradedCardKeywords?: TransfigureCardKeywords | null;
  sourceUpgradedCardKeywords?: TransfigureCardKeywords | null;
  transformedCardType?: string;
  sourceCardType?: CardTypeKo | null;
  transformedCardRarity?: string;
  sourceCardRarity?: CardRarityKo | null;
}): boolean {
  const canChangeCardMetadata = canTransfigureCardMetadata(
    sourceCardType,
    sourceCardRarity,
  );

  return (
    showUpgrade
    || (
      canChangeCardMetadata
      && (
        normalizeTransfigureCardType(transformedCardType, sourceCardType) != null
        || normalizeTransfigureCardRarity(
          transformedCardRarity,
          sourceCardRarity,
        ) != null
      )
    )
    || !transfigureCardKeywordsEqual(cardKeywords, sourceCardKeywords)
    || !transfigureCardKeywordsEqual(
      upgradedCardKeywords,
      sourceUpgradedCardKeywords,
    )
    || isTransfiguredContent(blocks, sourceText, sourceBlocks)
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

export function transfigureBlocksSignature(items: PostBlock[]): string {
  const tokens: string[] = [];
  let text = "";
  const flushText = () => {
    if (!text) return;
    tokens.push(`text:${text
      .replace(/\r\n?/g, "\n")
      .replace(/[^\S\n]+/g, " ")
      .replace(/ *\n */g, "\n")}`);
    text = "";
  };

  for (const block of items) {
    if (block.type === "text") {
      text += block.text;
      continue;
    }
    flushText();
    if (block.type === "keyword") {
      tokens.push(
        `keyword:${block.text}:${block.keyword ?? ""}:${block.description ?? ""}:${block.entityType ?? ""}:${block.entityId ?? ""}`,
      );
    } else if (block.type === "cost-token") {
      tokens.push(`cost-token:${block.kind}:${block.count}`);
    } else if (block.type === "entity") {
      tokens.push(
        `entity:${block.displayText}:${block.entityType}:${block.entityId}`,
      );
    } else if (block.type === "history-run") {
      tokens.push(`history-run:${block.runId}:${JSON.stringify(block.snapshot)}`);
    } else {
      tokens.push(`youtube:${block.videoId}:${block.title}`);
    }
  }
  flushText();
  return tokens.join("|");
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
      if (block.type === "cost-token") {
        return block.kind === "energy"
          ? "@".repeat(Math.max(1, Math.floor(block.count) || 1))
          : "*".repeat(Math.max(1, Math.floor(block.count) || 1));
      }
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
    return (
      transfigureBlocksSignature(blocks)
      !== transfigureBlocksSignature(sourceBlocks)
    );
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

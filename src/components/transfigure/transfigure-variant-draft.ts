import type { EntityInfo } from "@/components/patch-note-renderer";
import type { SaveTransfigureVariantInput } from "@/hooks/use-transfigure-posts";
import type { PostBlock } from "@/lib/chemical-types";
import { blocksToPlainText } from "@/lib/chemical-utils";
import type { CardColor, CardRarityKo, CardTypeKo } from "@/lib/codex-types";
import {
  canTransfigureCardMetadata,
  getTransfigureCardKeywords,
  getTransfigureInitialBlocks,
  getTransfigureSourceCost,
  getTransfigureSourceStarCost,
  getTransfigureSourceText,
  getTransfigureUpgradeCardKeywords,
  getTransfigureUpgradeInitialBlocks,
  getTransfigureUpgradeSourceCost,
  getTransfigureUpgradeSourceStarCost,
  getTransfigureUpgradeSourceText,
  isTransfigureChanged,
  isTransfigureResourceType,
  normalizeTransfigureCardColor,
  normalizeTransfigureCardKeywords,
  normalizeTransfigureCardRarity,
  normalizeTransfigureCardType,
  transfigureBlocksSignature,
  transfigureHasExistingRefsOrDiff,
  transfigureSourceHasEnergyCost,
  transfigureSourceHasStarCost,
  TRANSFIGURE_DEFAULT_ADDED_COST,
  type TransfigureCardColor,
  type TransfigureCardKeywords,
  type TransfigureCardRarity,
  type TransfigureCardType,
  type TransfigureChangeCheck,
  type TransfigureTokenColor,
  type TransfigureTokenWax,
  type TransfigureVariant,
} from "@/lib/transfigure-types";

export interface TransfigureVariantSource {
  sourceText: string | null;
  sourceBlocks: PostBlock[];
  sourceCost: string | null;
  sourceStarCost: string | null;
  sourceCardType: CardTypeKo | null;
  sourceCardRarity: CardRarityKo | null;
  sourceCardColor: CardColor | null;
  sourceCardKeywords: TransfigureCardKeywords | null;
  sourceUpgradeText: string | null;
  sourceUpgradeBlocks: PostBlock[] | null;
  sourceUpgradeCost: string | null;
  sourceUpgradeStarCost: string | null;
  sourceUpgradedCardKeywords: TransfigureCardKeywords | null;
}

/** Editor state for one variant. `seed*` only seeds the rich editor on first mount. */
export interface TransfigureVariantDraft {
  uid: string;
  entity: EntityInfo;
  seedBlocks: PostBlock[];
  seedUpgradeBlocks: PostBlock[] | null;
  blocks: PostBlock[];
  upgradedBlocks: PostBlock[] | null;
  transformedName: string;
  transformedCost: string;
  transformedStarCost: string;
  showEnergyCost: boolean;
  showStarCost: boolean;
  transformedCardType: TransfigureCardType | "";
  transformedCardRarity: TransfigureCardRarity | "";
  transformedCardColor: TransfigureCardColor | "";
  showCardTypeChange: boolean;
  showCardRarityChange: boolean;
  showCardColorChange: boolean;
  cardKeywords: TransfigureCardKeywords | null;
  transformedUpgradeCost: string;
  transformedUpgradeStarCost: string;
  upgradedCardKeywords: TransfigureCardKeywords | null;
  showUpgrade: boolean;
  tokenColor: TransfigureTokenColor | "";
  tokenWax: TransfigureTokenWax;
}

const variantSourceCache = new WeakMap<
  EntityInfo[],
  Map<string, TransfigureVariantSource>
>();

/** Cached per entity list: source parsing builds a keyword index over every entity. */
export function getTransfigureVariantSource(
  entity: EntityInfo,
  entities: EntityInfo[],
): TransfigureVariantSource {
  let cache = variantSourceCache.get(entities);
  if (!cache) {
    cache = new Map();
    variantSourceCache.set(entities, cache);
  }
  const key = `${entity.type}:${entity.id}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const source = buildTransfigureVariantSource(entity, entities);
  cache.set(key, source);
  return source;
}

function buildTransfigureVariantSource(
  entity: EntityInfo,
  entities: EntityInfo[],
): TransfigureVariantSource {
  return {
    sourceText: getTransfigureSourceText(entity),
    sourceBlocks: getTransfigureInitialBlocks(entity, entities),
    sourceCost: getTransfigureSourceCost(entity),
    sourceStarCost: getTransfigureSourceStarCost(entity),
    sourceCardType: entity.cardData?.type ?? null,
    sourceCardRarity: entity.cardData?.rarity ?? null,
    sourceCardColor: entity.cardData?.color ?? null,
    sourceCardKeywords: getTransfigureCardKeywords(entity),
    sourceUpgradeText: getTransfigureUpgradeSourceText(entity),
    sourceUpgradeBlocks: getTransfigureUpgradeInitialBlocks(entity, entities),
    sourceUpgradeCost: getTransfigureUpgradeSourceCost(entity),
    sourceUpgradeStarCost: getTransfigureUpgradeSourceStarCost(entity),
    sourceUpgradedCardKeywords: getTransfigureUpgradeCardKeywords(entity),
  };
}

export function createTransfigureVariantDraft(
  entity: EntityInfo,
  source: TransfigureVariantSource,
  variant: TransfigureVariant | null = null,
): TransfigureVariantDraft {
  const metadataEditable = canTransfigureCardMetadata(
    entity.cardData?.type,
    entity.cardData?.rarity,
  );
  const cardType = metadataEditable
    ? normalizeTransfigureCardType(
      variant?.transformed_card_type,
      entity.cardData?.type ?? null,
    )
    : null;
  const cardRarity = metadataEditable
    ? normalizeTransfigureCardRarity(
      variant?.transformed_card_rarity,
      entity.cardData?.rarity ?? null,
    )
    : null;
  const cardColor = normalizeTransfigureCardColor(
    variant?.transformed_card_color,
    entity.cardData?.color ?? null,
  );
  const seedBlocks = variant?.content ?? source.sourceBlocks;
  const seedUpgradeBlocks = variant?.upgraded_content ?? source.sourceUpgradeBlocks;

  return {
    uid: globalThis.crypto.randomUUID(),
    entity,
    seedBlocks,
    seedUpgradeBlocks,
    blocks: seedBlocks,
    upgradedBlocks: seedUpgradeBlocks,
    transformedName: variant?.transformed_name ?? "",
    transformedCost: variant?.transformed_cost ?? "",
    transformedStarCost: variant?.transformed_star_cost ?? "",
    showEnergyCost: variant?.omit_energy_cost
      ? false
      : (
        transfigureSourceHasEnergyCost(source.sourceCost)
        || Boolean(variant?.transformed_cost)
      ),
    showStarCost: (
      transfigureSourceHasStarCost(source.sourceStarCost)
      || Boolean(variant?.transformed_star_cost)
      || Boolean(variant?.transformed_upgrade_star_cost)
    ),
    transformedCardType: cardType ?? "",
    transformedCardRarity: cardRarity ?? "",
    transformedCardColor: cardColor ?? "",
    showCardTypeChange: cardType != null,
    showCardRarityChange: cardRarity != null,
    showCardColorChange: cardColor != null,
    cardKeywords: variant
      ? { top: variant.card_top_keywords, bottom: variant.card_bottom_keywords }
      : source.sourceCardKeywords,
    transformedUpgradeCost: variant?.transformed_upgrade_cost ?? "",
    transformedUpgradeStarCost: variant?.transformed_upgrade_star_cost ?? "",
    upgradedCardKeywords: variant?.upgraded_content
      ? {
        top: variant.upgraded_card_top_keywords,
        bottom: variant.upgraded_card_bottom_keywords,
      }
      : source.sourceUpgradedCardKeywords,
    showUpgrade: variant?.show_upgrade ?? false,
    tokenColor: variant?.token_color ?? "",
    tokenWax: variant?.token_wax ?? "off",
  };
}

export function transfigureDraftOmitsEnergyCost(
  draft: TransfigureVariantDraft,
  source: TransfigureVariantSource,
): boolean {
  return transfigureSourceHasEnergyCost(source.sourceCost) && !draft.showEnergyCost;
}

function buildChangeCheck(
  draft: TransfigureVariantDraft,
  source: TransfigureVariantSource,
): TransfigureChangeCheck | null {
  if (!source.sourceText || !isTransfigureResourceType(draft.entity.type)) {
    return null;
  }
  return {
    blocks: draft.blocks,
    sourceText: source.sourceText,
    sourceBlocks: source.sourceBlocks,
    transformedName: draft.transformedName,
    sourceName: draft.entity.nameKo,
    transformedCost: draft.transformedCost,
    sourceCost: source.sourceCost,
    transformedStarCost: draft.transformedStarCost,
    sourceStarCost: source.sourceStarCost,
    transformedCardType: draft.transformedCardType,
    sourceCardType: source.sourceCardType,
    transformedCardRarity: draft.transformedCardRarity,
    sourceCardRarity: source.sourceCardRarity,
    transformedCardColor: draft.transformedCardColor,
    sourceCardColor: source.sourceCardColor,
    omitEnergyCost: transfigureDraftOmitsEnergyCost(draft, source),
    upgradedBlocks: draft.upgradedBlocks,
    sourceUpgradeText: source.sourceUpgradeText,
    sourceUpgradeBlocks: source.sourceUpgradeBlocks,
    transformedUpgradeCost: draft.transformedUpgradeCost,
    sourceUpgradeCost: source.sourceUpgradeCost,
    transformedUpgradeStarCost: draft.transformedUpgradeStarCost,
    sourceUpgradeStarCost: source.sourceUpgradeStarCost,
    cardKeywords: draft.cardKeywords,
    sourceCardKeywords: source.sourceCardKeywords,
    upgradedCardKeywords: draft.upgradedCardKeywords,
    sourceUpgradedCardKeywords: source.sourceUpgradedCardKeywords,
    showUpgrade: draft.showUpgrade,
    resourceType: draft.entity.type,
    tokenColor: draft.tokenColor,
    tokenWax: draft.tokenWax,
  };
}

export type TransfigureVariantBlockReason = "invalidDescription" | "anchorOrDiffRequired";

export function transfigureVariantBlockReason(
  draft: TransfigureVariantDraft,
  source: TransfigureVariantSource,
): TransfigureVariantBlockReason | null {
  const descriptionsValid = (
    blocksToPlainText(draft.blocks).trim().length >= 2
    && (
      draft.upgradedBlocks == null
      || blocksToPlainText(draft.upgradedBlocks).trim().length >= 2
    )
  );
  if (!descriptionsValid) return "invalidDescription";
  const check = buildChangeCheck(draft, source);
  if (
    !check
    || !isTransfigureChanged(check)
    || !transfigureHasExistingRefsOrDiff(check)
  ) {
    return "anchorOrDiffRequired";
  }
  return null;
}

export function transfigureVariantSaveInput(
  draft: TransfigureVariantDraft,
  source: TransfigureVariantSource,
): SaveTransfigureVariantInput | null {
  const { entity } = draft;
  if (!source.sourceText || !isTransfigureResourceType(entity.type)) return null;
  const sourceHasEnergyCost = transfigureSourceHasEnergyCost(source.sourceCost);
  const sourceHasStarCost = transfigureSourceHasStarCost(source.sourceStarCost);
  const addsEnergyCost = draft.showEnergyCost && !sourceHasEnergyCost;
  const addsStarCost = draft.showStarCost && !sourceHasStarCost;

  return {
    blocks: draft.blocks,
    resource: { type: entity.type, id: entity.id },
    sourceText: source.sourceText,
    sourceBlocks: source.sourceBlocks,
    sourceName: entity.nameKo,
    sourceCost: source.sourceCost,
    sourceStarCost: source.sourceStarCost,
    sourceCardType: source.sourceCardType,
    sourceCardRarity: source.sourceCardRarity,
    sourceCardColor: source.sourceCardColor,
    sourceUpgradeText: source.sourceUpgradeText,
    sourceUpgradeBlocks: source.sourceUpgradeBlocks,
    sourceUpgradeCost: source.sourceUpgradeCost,
    sourceUpgradeStarCost: source.sourceUpgradeStarCost,
    sourceCardKeywords: source.sourceCardKeywords,
    sourceUpgradedCardKeywords: source.sourceUpgradedCardKeywords,
    transformedName: draft.transformedName,
    transformedCost: addsEnergyCost
      ? (draft.transformedCost.trim() || TRANSFIGURE_DEFAULT_ADDED_COST)
      : draft.transformedCost,
    transformedStarCost: addsStarCost
      ? (draft.transformedStarCost.trim() || TRANSFIGURE_DEFAULT_ADDED_COST)
      : draft.transformedStarCost,
    transformedCardType: draft.transformedCardType,
    transformedCardRarity: draft.transformedCardRarity,
    transformedCardColor: draft.transformedCardColor,
    omitEnergyCost: transfigureDraftOmitsEnergyCost(draft, source),
    cardKeywords: draft.cardKeywords,
    upgradedBlocks: draft.upgradedBlocks,
    transformedUpgradeCost: addsEnergyCost && source.sourceUpgradeText
      ? (draft.transformedUpgradeCost.trim() || TRANSFIGURE_DEFAULT_ADDED_COST)
      : draft.transformedUpgradeCost,
    transformedUpgradeStarCost: addsStarCost && source.sourceUpgradeText
      ? (
        draft.transformedUpgradeStarCost.trim()
        || source.sourceUpgradeStarCost
        || TRANSFIGURE_DEFAULT_ADDED_COST
      )
      : draft.transformedUpgradeStarCost,
    upgradedCardKeywords: draft.upgradedCardKeywords,
    showUpgrade: draft.showUpgrade,
    tokenColor: draft.tokenColor,
    tokenWax: draft.tokenWax,
  };
}

/** Stable comparison key for "is there anything to save" in edit mode. */
export function transfigureVariantDraftSignature(
  draft: TransfigureVariantDraft,
  source: TransfigureVariantSource,
): string {
  return JSON.stringify([
    `${draft.entity.type}:${draft.entity.id}`,
    draft.transformedName.trim(),
    draft.transformedCost.trim(),
    draft.transformedStarCost.trim(),
    transfigureDraftOmitsEnergyCost(draft, source),
    draft.transformedCardType,
    draft.transformedCardRarity,
    draft.transformedCardColor,
    draft.transformedUpgradeCost.trim(),
    draft.transformedUpgradeStarCost.trim(),
    normalizeTransfigureCardKeywords(draft.cardKeywords),
    normalizeTransfigureCardKeywords(draft.upgradedCardKeywords),
    draft.showUpgrade,
    draft.tokenColor || null,
    draft.tokenWax === "off" ? null : draft.tokenWax,
    transfigureBlocksSignature(draft.blocks),
    draft.upgradedBlocks == null
      ? null
      : transfigureBlocksSignature(draft.upgradedBlocks),
  ]);
}

/**
 * 인챈트 적용 가능 규칙 SSOT.
 *
 * 게임 소스: src/Core/Models/Enchantments/<Name>.cs::CanEnchant / CanEnchantCardType
 * 베이스: src/Core/Models/EnchantmentModel.cs::CanEnchant
 *
 * 베이스 룰(모든 인챈트에 공통 적용):
 *  - CardType이 Curse/Status/Token 범위면 거부 (CardType - 4 ≤ 2 → false)
 *  - Deck pile + Unplayable 키워드면 거부 (코덱스에선 무시)
 *  - 이미 다른 인챈트가 붙어 있으면 거부 (코덱스에선 단일 토글이라 무시)
 *
 * + 인챈트별 추가 룰 (CanEnchantCardType / CanEnchant override).
 */

import type { CodexCard, CodexEnchantment } from "./codex-types";

// 게임의 CardType enum 4..6 = Curse / Status / Token (제외 대상)
const EXCLUDED_TYPES_KO: ReadonlySet<string> = new Set([
  "저주",
  "상태이상",
  "토큰",
  "퀘스트", // 퀘스트도 인챈트 못 붙임
]);

interface CardLikeForRule {
  type: string;            // KO: 공격/스킬/파워/저주/...
  rarity: string;          // KO
  keywords: string[];      // KO list
  tags: string[] | null;   // EN tags from data (Strike/Defend/...)
  block: number | null;
  isXCost: boolean;
}

/** 카드가 block을 얻는 카드인지 — 게임 CardModel.GainsBlock 근사 */
function gainsBlock(card: CardLikeForRule): boolean {
  return (card.block != null && card.block > 0) ||
    Boolean(card.tags?.some((t) => t.toLowerCase() === "defend"));
}

function hasTag(card: CardLikeForRule, tag: string): boolean {
  const t = tag.toLowerCase();
  return Boolean(card.tags?.some((x) => x.toLowerCase() === t));
}

function hasKeyword(card: CardLikeForRule, kw: string): boolean {
  return card.keywords.includes(kw);
}

/**
 * 베이스 EnchantmentModel.CanEnchant — 모든 인챈트에 공통 적용.
 */
function baseCanEnchant(card: CardLikeForRule): boolean {
  if (EXCLUDED_TYPES_KO.has(card.type)) return false;
  return true;
}

/** 카드 타입(KO) → 게임 CardType(EN) */
const TYPE_KO_TO_EN: Record<string, "Attack" | "Skill" | "Power" | null> = {
  공격: "Attack",
  스킬: "Skill",
  파워: "Power",
  저주: null,
  상태이상: null,
  토큰: null,
  퀘스트: null,
};

/**
 * 인챈트 ID → 적용 가능성 검사 함수 (게임 CanEnchant 그대로).
 * 추가 ID는 게임에서 baseCanEnchant만 적용되므로 fallback.
 */
const ENCHANT_RULES: Record<string, (card: CardLikeForRule) => boolean> = {
  ADROIT: baseCanEnchant,
  CLONE: baseCanEnchant,
  CORRUPTED: (c) => baseCanEnchant(c) && TYPE_KO_TO_EN[c.type] === "Attack",
  GLAM: baseCanEnchant,
  // Goopy: Defend 태그 카드만
  GOOPY: (c) => baseCanEnchant(c) && hasTag(c, "Defend"),
  IMBUED: (c) => baseCanEnchant(c) && TYPE_KO_TO_EN[c.type] === "Skill",
  INKY: baseCanEnchant,
  INSTINCT: (c) => baseCanEnchant(c) && TYPE_KO_TO_EN[c.type] === "Attack",
  MOMENTUM: (c) => baseCanEnchant(c) && TYPE_KO_TO_EN[c.type] === "Attack",
  // Nimble: GainsBlock = true
  NIMBLE: (c) => baseCanEnchant(c) && gainsBlock(c),
  PERFECT_FIT: baseCanEnchant,
  // RoyallyApproved: Attack 또는 Skill (Power 제외)
  ROYALLY_APPROVED: (c) => {
    const t = TYPE_KO_TO_EN[c.type];
    return baseCanEnchant(c) && (t === "Attack" || t === "Skill");
  },
  SHARP: (c) => baseCanEnchant(c) && TYPE_KO_TO_EN[c.type] === "Attack",
  // Slither: X-cost 제외 + Unplayable 제외
  SLITHER: (c) =>
    baseCanEnchant(c) && !c.isXCost && !hasKeyword(c, "사용불가"),
  SLUMBERING_ESSENCE: baseCanEnchant,
  // SoulsPower: Exhaust 키워드 가진 카드만
  SOULS_POWER: (c) => baseCanEnchant(c) && hasKeyword(c, "소멸"),
  SOWN: baseCanEnchant,
  // Spiral: Basic 희귀도 + (Strike OR Defend)
  SPIRAL: (c) =>
    baseCanEnchant(c) && c.rarity === "기본" &&
    (hasTag(c, "Strike") || hasTag(c, "Defend")),
  STEADY: baseCanEnchant,
  SWIFT: baseCanEnchant,
  TEZCATARAS_EMBER: baseCanEnchant,
  VIGOROUS: (c) => baseCanEnchant(c) && TYPE_KO_TO_EN[c.type] === "Attack",
};

/** 데이터 ID 정규화 (TEZCATARAS_EMBER, ROYALLY_APPROVED 등). */
function normalizeId(id: string): string {
  return id.toUpperCase().replace(/[\s-]/g, "_");
}

// =============================================================================
// 인챈트가 OnEnchant에서 카드에 추가/제거하는 키워드
// 게임 소스: src/Core/Models/Enchantments/<Name>.cs::OnEnchant
// =============================================================================

/** 인챈트가 카드에 추가하는 키워드 (한국어). */
const ENCHANT_ADDED_KEYWORDS: Record<string, string[]> = {
  GOOPY: ["소멸"],
  ROYALLY_APPROVED: ["선천성", "보존"],
  STEADY: ["보존"],
  TEZCATARAS_EMBER: ["영구"],
};

/** 인챈트가 카드에서 제거하는 키워드. */
const ENCHANT_REMOVED_KEYWORDS: Record<string, string[]> = {
  SOULS_POWER: ["소멸"],
};

export function getEnchantAddedKeywords(enchant: CodexEnchantment): string[] {
  return ENCHANT_ADDED_KEYWORDS[normalizeId(enchant.id)] ?? [];
}

export function getEnchantRemovedKeywords(enchant: CodexEnchantment): string[] {
  return ENCHANT_REMOVED_KEYWORDS[normalizeId(enchant.id)] ?? [];
}

// =============================================================================
// 인챈트별 카드 코스트 변경 (게임 OnEnchant)
// TezcatarasEmber: cost 0으로 강제
// =============================================================================

const ENCHANT_FORCED_COST: Record<string, number> = {
  TEZCATARAS_EMBER: 0,
};

export function getEnchantForcedCost(
  enchant: CodexEnchantment,
): number | null {
  const v = ENCHANT_FORCED_COST[normalizeId(enchant.id)];
  return v ?? null;
}

// =============================================================================
// 인챈트 텍스트 amount 치환
// description/extra_card_text의 [blue]X[/blue] 또는 X를 실제 amount로 교체.
// =============================================================================

/**
 * "X" 또는 "[blue]X[/blue]" 자리를 amount로 치환.
 * "Apply [blue]X[/blue] [gold]Weak[/gold]." → "Apply [blue]2[/blue] [gold]Weak[/gold]."
 */
export function substituteAmount(text: string | null, amount: number): string | null {
  if (!text) return text;
  // [blue]X[/blue] → [blue]N[/blue]
  let out = text.replace(/\[blue\]X\[\/blue\]/g, `[blue]${amount}[/blue]`);
  // 단독 X (영문/한글 단어 경계) → N
  // "Lose 2 HP." 같이 이미 숫자가 있는 경우는 건드리지 않음.
  out = out.replace(/(^|[^A-Za-z])X([^A-Za-z]|$)/g, `$1${amount}$2`);
  return out;
}

export function canEnchantCard(enchant: CodexEnchantment, card: CodexCard): boolean {
  const rule = ENCHANT_RULES[normalizeId(enchant.id)];
  const cardLike: CardLikeForRule = {
    type: card.type,
    rarity: card.rarity,
    keywords: card.keywords,
    tags: card.tags,
    block: card.block,
    isXCost: card.isXCost,
  };
  if (rule) return rule(cardLike);
  return baseCanEnchant(cardLike);
}

// =============================================================================
// 인챈트 amount — 게임 ShowAmount = true 인 인챈트들의 기본 표시값
// 코덱스 미리보기에서 보여주는 baseline. 실제 게임에선 이벤트/유물로 결정.
// 게임 default는 EnchantmentModel.Amount = 1, Adroit/Sharp/Vigorous/Nimble/Swift 등 ShowAmount 인 것만 표시.
// =============================================================================

const SHOW_AMOUNT_IDS: ReadonlySet<string> = new Set([
  "ADROIT",
  "SHARP",
  "VIGOROUS",
  "NIMBLE",
  "SWIFT",
  "SOWN",
  "SPIRAL",
  "GOOPY",
]);

export function shouldShowAmount(enchant: CodexEnchantment): boolean {
  return SHOW_AMOUNT_IDS.has(normalizeId(enchant.id));
}

/** 게임 EnchantmentModel.Amount 기본값 — 코덱스 프리뷰용 baseline. */
export const DEFAULT_ENCHANT_AMOUNT = 1;

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

/** 인챈트가 카드에 추가하는 키워드 (한국어). amount 의존 키워드는 함수로. */
const ENCHANT_ADDED_KEYWORDS: Record<string, string[]> = {
  GOOPY: ["소멸"],
  ROYALLY_APPROVED: ["선천성", "보존"],
  STEADY: ["보존"],
  TEZCATARAS_EMBER: ["영구"],
};

/**
 * amount(또는 Times)가 함께 표시되는 키워드 인챈트.
 * Spiral/Glam → "재사용 N"
 */
const ENCHANT_ADDED_KEYWORDS_WITH_AMOUNT: Record<string, string> = {
  SPIRAL: "재사용",
  GLAM: "재사용",
};

/** 인챈트가 카드에서 제거하는 키워드. */
const ENCHANT_REMOVED_KEYWORDS: Record<string, string[]> = {
  SOULS_POWER: ["소멸"],
};

export interface EnchantKeywordChunk {
  text: string;        // "영구" / "재사용 1"
  fromEnchant: true;
}

export function getEnchantAddedKeywords(
  enchant: CodexEnchantment,
  amount: number,
): string[] {
  const id = normalizeId(enchant.id);
  const keywords = ENCHANT_ADDED_KEYWORDS[id]?.slice() ?? [];
  const amountKw = ENCHANT_ADDED_KEYWORDS_WITH_AMOUNT[id];
  if (amountKw) {
    keywords.push(`${amountKw} ${amount}`);
  }
  return keywords;
}

export function getEnchantRemovedKeywords(enchant: CodexEnchantment): string[] {
  return ENCHANT_REMOVED_KEYWORDS[normalizeId(enchant.id)] ?? [];
}

// =============================================================================
// 인챈트가 카드의 damage/block 에 미치는 효과
// 출처: src/Core/Models/Enchantments/<Name>.cs::EnchantDamageAdditive / EnchantBlockAdditive
// (IsPoweredAttack/IsPoweredCardOrMonsterMoveBlock 조건은 정상 사용 환경 가정)
// =============================================================================

export interface EnchantStatModifier {
  damageAdd?: number;
  damageMultiplier?: number; // Corrupted: 1.5
  blockAdd?: number;
}

export function getEnchantStatModifier(
  enchant: CodexEnchantment,
  amount: number,
): EnchantStatModifier {
  switch (normalizeId(enchant.id)) {
    // Damage additive
    case "INKY":
      return { damageAdd: 2 };       // CanonicalVars: DamageVar(2m)
    case "TEZCATARAS_EMBER":
      return { damageAdd: 3 };       // CanonicalVars: DamageVar(3m)
    case "SHARP":
    case "VIGOROUS":
      return { damageAdd: amount };
    // Damage multiplicative
    case "CORRUPTED":
      return { damageMultiplier: 1.5 }; // "50% 더 많은 피해"
    // Block additive
    case "ADROIT":
    case "NIMBLE":
      return { blockAdd: amount };
    case "GOOPY":
      // Goopy: AfterCardPlayed에서 amount++, EnchantBlockAdditive(amount-1)
      // 처음 적용 시는 amount=1 → 0 추가. 미리보기에선 0.
      return { blockAdd: Math.max(0, amount - 1) };
    default:
      return {};
  }
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
 *
 * asEnergyIcon=true: X 자리에 [energy:N] (Sown — 에너지 아이콘 N개로 표시).
 */
export function substituteAmount(
  text: string | null,
  amount: number,
  options: { asEnergyIcon?: boolean } = {},
): string | null {
  if (!text) return text;
  const replacement = options.asEnergyIcon
    ? `[energy:${amount}]`
    : String(amount);
  // [blue]X[/blue] → replacement
  let out = text.replace(/\[blue\]X\[\/blue\]/g, replacement);
  // 단독 X (영문/한글 단어 경계) → replacement
  out = out.replace(/(^|[^A-Za-z])X([^A-Za-z]|$)/g, `$1${replacement}$2`);
  // SmartFormat {Amount:energyIcons()} 도 처리 (description_raw 직접 사용 시)
  out = out.replace(/\{Amount:energyIcons\(\)\}/g, `[energy:${amount}]`);
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
// 인챈트 amount — 게임 ShowAmount = true 인 인챈트만 슬롯에 amount 표시.
// 소스: src/Core/Models/Enchantments/<Name>.cs::ShowAmount
// =============================================================================

const SHOW_AMOUNT_IDS: ReadonlySet<string> = new Set([
  "ADROIT",
  "SHARP",
  "VIGOROUS",
  "NIMBLE",
  "SWIFT",
  // Sown은 ShowAmount 없음 — extra_card_text의 X 자리를 에너지 아이콘으로 채움
  // Spiral/Glam은 ShowAmount 없음 — "재사용 N" 키워드만 추가
  // Goopy는 ShowAmount 없음 — 사용 시 자동 증가
]);

export function shouldShowAmount(enchant: CodexEnchantment): boolean {
  return SHOW_AMOUNT_IDS.has(normalizeId(enchant.id));
}

/**
 * 게임 유물/이벤트가 부여하는 amount 프리셋.
 * 출처: src/Core/Models/Relics/*.cs, src/Core/Models/Events/*.cs (CardCmd.Enchant 호출)
 *
 * - ADROIT:    Kifuda(목패) = 3
 * - SHARP:     SelfHelpBook(자기계발서, 책 뒷면) = 2, GnarledHammer(옹이진 망치) = 3
 * - SWIFT:     WingCharm(날개 부적) = 1, SelfHelpBook(자기계발서) = 2, BeautifulBracelet(아름다운 팔찌) = 3
 * - NIMBLE:    SelfHelpBook(자기계발서) = 2, FresnelLens(프레넬 렌즈) = 2
 * - MOMENTUM:  PunchDagger(펀치 단도) = 5
 * - VIGOROUS:  StoneOfAllTime(영원의 돌) = 8
 *
 * 그 외 amount=1 고정인 인챈트는 프리셋 [1].
 */
export const ENCHANT_AMOUNT_PRESETS: Record<string, number[]> = {
  ADROIT: [3],
  SHARP: [2, 3],
  SWIFT: [1, 2, 3],
  NIMBLE: [2],
  MOMENTUM: [5],
  VIGOROUS: [8],
  // 아래는 ShowAmount=false 지만 카드 효과에 amount가 영향을 주는 인챈트 (선택용)
  GOOPY: [1],
  SOWN: [1],
  SPIRAL: [1],
  GLAM: [1],
};

export function getEnchantAmountPresets(enchant: CodexEnchantment): number[] {
  return ENCHANT_AMOUNT_PRESETS[normalizeId(enchant.id)] ?? [1];
}

/** 게임 EnchantmentModel.Amount 기본값 — 코덱스 프리뷰용 baseline. */
export const DEFAULT_ENCHANT_AMOUNT = 1;

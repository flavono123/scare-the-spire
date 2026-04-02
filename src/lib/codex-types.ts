// Types for STS2 codex card data

export type CardColor =
  | "ironclad"
  | "silent"
  | "defect"
  | "necrobinder"
  | "regent"
  | "colorless"
  | "curse"
  | "event"
  | "status"
  | "token"
  | "quest";

export type CardTypeKo = "공격" | "스킬" | "파워" | "저주" | "상태이상" | "퀘스트";
export type CardRarityKo =
  | "기본"
  | "일반"
  | "고급"
  | "희귀"
  | "고대의 존재"
  | "이벤트"
  | "토큰"
  | "저주"
  | "상태이상"
  | "퀘스트";

export type CharacterColor = "red" | "green" | "blue" | "purple" | "orange";

export interface CodexCard {
  id: string;
  name: string; // Korean
  nameEn: string; // English
  description: string; // Korean, with BBCode markup
  descriptionRaw: string; // Korean, with {Var:diff()} templates
  vars: Record<string, number>; // Base variable values for description template
  cost: number;
  isXCost: boolean;
  isXStarCost: boolean;
  starCost: number | null;
  type: CardTypeKo;
  rarity: CardRarityKo;
  color: CardColor;
  damage: number | null;
  block: number | null;
  hitCount: number | null;
  keywords: string[];
  tags: string[];
  upgrade: Record<string, string | number> | null;
  imageUrl: string | null; // local path
  betaImageUrl: string | null; // local path
}

export interface CodexCharacter {
  id: string;
  name: string; // Korean
  color: CharacterColor;
  imageUrl: string; // local path to char_select image
}

// Filter category for card browsing
export type CardFilterCategory =
  | "ironclad"
  | "silent"
  | "defect"
  | "necrobinder"
  | "regent"
  | "colorless"
  | "event"
  | "curse"
  | "status"
  | "ancient";

// Card color -> display label mapping
export const COLOR_LABELS: Record<CardFilterCategory, string> = {
  ironclad: "아이언클래드",
  silent: "사일런트",
  defect: "디펙트",
  necrobinder: "네크로바인더",
  regent: "리젠트",
  colorless: "무색",
  event: "이벤트",
  curse: "저주",
  status: "상태이상",
  ancient: "고대의 존재",
};

// Short aliases for search tokens
export const COLOR_ALIASES: Record<string, CardFilterCategory> = {
  아클: "ironclad",
  아이언클래드: "ironclad",
  ironclad: "ironclad",
  사일: "silent",
  사일런트: "silent",
  silent: "silent",
  디펙: "defect",
  디펙트: "defect",
  defect: "defect",
  네크로: "necrobinder",
  네크로바인더: "necrobinder",
  necrobinder: "necrobinder",
  리젠: "regent",
  리젠트: "regent",
  regent: "regent",
  무색: "colorless",
  colorless: "colorless",
  이벤트: "event",
  event: "event",
  저주: "curse",
  curse: "curse",
  상태이상: "status",
  status: "status",
  고대: "ancient",
  ancient: "ancient",
};

// Relic types
export type RelicRarityKo =
  | "시작 유물"
  | "일반 유물"
  | "고급 유물"
  | "희귀 유물"
  | "상점 유물"
  | "이벤트 유물"
  | "고대 유물"
  | "None";

export type RelicPool =
  | "shared"
  | "ironclad"
  | "silent"
  | "defect"
  | "necrobinder"
  | "regent";

export interface CodexRelic {
  id: string;
  name: string; // Korean
  nameEn: string; // English
  description: string; // Korean, with BBCode markup
  descriptionRaw: string; // Korean, with {Var} templates
  flavor: string;
  rarity: RelicRarityKo;
  pool: RelicPool;
  imageUrl: string | null; // local path
}

// Relic rarity display order and labels
export const RELIC_RARITY_ORDER: RelicRarityKo[] = [
  "시작 유물",
  "일반 유물",
  "고급 유물",
  "희귀 유물",
  "상점 유물",
  "이벤트 유물",
  "고대 유물",
  "None",
];

export const RELIC_RARITY_LABELS: Record<RelicRarityKo, string> = {
  "시작 유물": "시작",
  "일반 유물": "일반",
  "고급 유물": "고급",
  "희귀 유물": "희귀",
  "상점 유물": "상점",
  "이벤트 유물": "이벤트",
  "고대 유물": "고대",
  None: "기타",
};

export const RELIC_RARITY_COLORS: Record<RelicRarityKo, string> = {
  "시작 유물": "#ffd740", // gold
  "일반 유물": "#b0b0b0", // gray
  "고급 유물": "#4fc3f7", // blue
  "희귀 유물": "#ffd740", // gold
  "상점 유물": "#81c784", // green
  "이벤트 유물": "#ce93d8", // purple
  "고대 유물": "#ff8a65", // orange
  None: "#8b8b8b", // dim gray
};

export const RELIC_RARITY_DESCRIPTIONS: Record<RelicRarityKo, string> = {
  "시작 유물": "각 캐릭터가 도전 시작 시 가지고 시작하는 유물들입니다.",
  "일반 유물": "흔하게 발견되는 약한 유물들입니다.",
  "고급 유물": "일반 유물보다 드물게 나타나는 강력한 유물들입니다.",
  "희귀 유물": "매우 드물게 나타나는 가장 강력한 유물들입니다.",
  "상점 유물": "상점에서만 구매할 수 있는 유물들입니다.",
  "이벤트 유물": "특정 이벤트를 통해서만 획득할 수 있는 유물들입니다.",
  "고대 유물": "고대의 존재를 처치하면 획득할 수 있는 유물들입니다.",
  None: "특수 유물입니다.",
};

// Pool filter for relics (character or shared)
export type RelicFilterPool = "shared" | "ironclad" | "silent" | "defect" | "necrobinder" | "regent";

export const POOL_LABELS: Record<RelicFilterPool, string> = {
  shared: "공용",
  ironclad: "아이언클래드",
  silent: "사일런트",
  defect: "디펙트",
  necrobinder: "네크로바인더",
  regent: "리젠트",
};

export const POOL_ALIASES: Record<string, RelicFilterPool> = {
  공용: "shared",
  shared: "shared",
  아클: "ironclad",
  아이언클래드: "ironclad",
  ironclad: "ironclad",
  사일: "silent",
  사일런트: "silent",
  silent: "silent",
  디펙: "defect",
  디펙트: "defect",
  defect: "defect",
  네크로: "necrobinder",
  네크로바인더: "necrobinder",
  necrobinder: "necrobinder",
  리젠: "regent",
  리젠트: "regent",
  regent: "regent",
};

export const RARITY_ALIASES: Record<string, RelicRarityKo> = {
  시작: "시작 유물",
  starter: "시작 유물",
  일반: "일반 유물",
  common: "일반 유물",
  고급: "고급 유물",
  uncommon: "고급 유물",
  희귀: "희귀 유물",
  rare: "희귀 유물",
  상점: "상점 유물",
  shop: "상점 유물",
  이벤트: "이벤트 유물",
  event: "이벤트 유물",
  고대: "고대 유물",
  ancient: "고대 유물",
  boss: "고대 유물",
};

// Potion types
export type PotionRarityKo = "일반" | "고급" | "희귀" | "이벤트" | "토큰";
export type PotionPool =
  | "shared"
  | "ironclad"
  | "silent"
  | "defect"
  | "necrobinder"
  | "regent"
  | "event";

export interface CodexPotion {
  id: string;
  name: string; // Korean
  nameEn: string; // English
  description: string; // Korean, with BBCode markup
  descriptionRaw: string; // Korean, with {Var:diff()} templates
  rarity: PotionRarityKo;
  pool: PotionPool;
  imageUrl: string; // local path
}

export const POTION_RARITY_ORDER: PotionRarityKo[] = [
  "일반",
  "고급",
  "희귀",
  "이벤트",
  "토큰",
];

export const POTION_RARITY_CONFIG: Record<
  PotionRarityKo,
  { label: string; color: string; description: string }
> = {
  일반: {
    label: "일반",
    color: "#b0b0b0",
    description: "첨탑에서 가장 자주 발견되는 포션들입니다.",
  },
  고급: {
    label: "고급",
    color: "#4fc3f7",
    description: "일반 포션보다 드물게 나타나는 강력한 포션들입니다.",
  },
  희귀: {
    label: "희귀",
    color: "#ffd740",
    description: "아주 드물게 만나볼 수 있는 희귀하고 강력한 포션들입니다.",
  },
  이벤트: {
    label: "특별",
    color: "#81c784",
    description:
      "이벤트에서 얻거나 다른 수단을 통해 생성할 수 있는 포션들입니다.",
  },
  토큰: {
    label: "특별",
    color: "#81c784",
    description:
      "이벤트에서 얻거나 다른 수단을 통해 생성할 수 있는 포션들입니다.",
  },
};

export const POTION_RARITY_ALIASES: Record<string, PotionRarityKo> = {
  일반: "일반",
  common: "일반",
  고급: "고급",
  uncommon: "고급",
  희귀: "희귀",
  rare: "희귀",
  특별: "이벤트",
  이벤트: "이벤트",
  event: "이벤트",
  토큰: "토큰",
  token: "토큰",
};

// Power types
export type PowerType = "Buff" | "Debuff" | "None";
export type PowerStackType = "Counter" | "Single" | "Duration" | "Intensity" | "None";

export interface CodexPower {
  id: string;
  name: string;        // Korean
  nameEn: string;      // English
  description: string; // Korean, with BBCode markup
  descriptionRaw: string | null;
  type: PowerType;
  stackType: PowerStackType;
  allowNegative: boolean;
  imageUrl: string | null; // local path
}

export const POWER_TYPE_ORDER: PowerType[] = ["Buff", "Debuff", "None"];

export const POWER_TYPE_CONFIG: Record<PowerType, { label: string; color: string; description: string }> = {
  Buff: { label: "버프", color: "#81c784", description: "아군에게 유리한 효과를 부여하는 파워입니다." },
  Debuff: { label: "디버프", color: "#ef5350", description: "적이나 아군에게 불리한 효과를 부여하는 파워입니다." },
  None: { label: "기타", color: "#8b8b8b", description: "내부 전용 파워입니다." },
};

export const POWER_TYPE_ALIASES: Record<string, PowerType> = {
  버프: "Buff", buff: "Buff",
  디버프: "Debuff", debuff: "Debuff",
  기타: "None", other: "None", none: "None",
};

export const POWER_STACK_TYPE_ALIASES: Record<string, PowerStackType> = {
  카운터: "Counter", counter: "Counter",
  단일: "Single", single: "Single",
  지속: "Duration", duration: "Duration",
  강도: "Intensity", intensity: "Intensity",
};

// Enchantment types
export interface CodexEnchantment {
  id: string;
  name: string;        // Korean
  nameEn: string;      // English
  description: string; // Korean, with BBCode markup
  descriptionRaw: string | null;
  extraCardText: string | null;
  cardType: "Attack" | "Skill" | null; // null = any card type
  isStackable: boolean;
  imageUrl: string | null; // local path
}

export type EnchantmentCardTypeFilter = "Attack" | "Skill" | "Any";

export const ENCHANTMENT_CARD_TYPE_CONFIG: Record<EnchantmentCardTypeFilter, { label: string; color: string }> = {
  Attack: { label: "공격", color: "#ef5350" },
  Skill: { label: "스킬", color: "#4fc3f7" },
  Any: { label: "전체", color: "#b0b0b0" },
};

export const ENCHANTMENT_CARD_TYPE_ALIASES: Record<string, EnchantmentCardTypeFilter> = {
  공격: "Attack", attack: "Attack",
  스킬: "Skill", skill: "Skill",
  전체: "Any", any: "Any",
};

// Event types
export interface EventOption {
  id: string;
  title: string;
  description: string;
}

export interface EventPage {
  id: string;
  description: string | null;
  options: EventOption[] | null;
}

export type EventAct =
  | "Act 1 - Overgrowth"
  | "Underdocks"
  | "Act 2 - Hive"
  | "Act 3 - Glory";

export interface CodexEvent {
  id: string;
  name: string;        // Korean
  nameEn: string;      // English
  description: string; // Korean, with BBCode markup
  act: EventAct | null;
  options: EventOption[] | null;
  pages: EventPage[] | null;
  imageUrl: string | null; // local path to event art
}

export const EVENT_ACT_ORDER: (EventAct | null)[] = [
  "Act 1 - Overgrowth",
  "Underdocks",
  "Act 2 - Hive",
  "Act 3 - Glory",
  null,
];

export const EVENT_ACT_CONFIG: Record<string, { label: string; labelKo: string; color: string; border: string; bg: string }> = {
  "Act 1 - Overgrowth": { label: "Overgrowth", labelKo: "1막 — 과성장", color: "text-green-400", border: "border-green-500/40", bg: "bg-green-500/10" },
  Underdocks: { label: "Underdocks", labelKo: "언더독스", color: "text-blue-400", border: "border-blue-500/40", bg: "bg-blue-500/10" },
  "Act 2 - Hive": { label: "Hive", labelKo: "2막 — 벌집", color: "text-orange-400", border: "border-orange-500/40", bg: "bg-orange-500/10" },
  "Act 3 - Glory": { label: "Glory", labelKo: "3막 — 영광", color: "text-yellow-400", border: "border-yellow-500/40", bg: "bg-yellow-500/10" },
};

export const EVENT_ACT_UNKNOWN = {
  label: "Unknown", labelKo: "미지정", color: "text-zinc-400", border: "border-zinc-500/40", bg: "bg-zinc-500/10",
};

export const EVENT_ACT_ALIASES: Record<string, EventAct | "none"> = {
  "1막": "Act 1 - Overgrowth",
  과성장: "Act 1 - Overgrowth",
  overgrowth: "Act 1 - Overgrowth",
  언더독스: "Underdocks",
  underdocks: "Underdocks",
  "2막": "Act 2 - Hive",
  벌집: "Act 2 - Hive",
  hive: "Act 2 - Hive",
  "3막": "Act 3 - Glory",
  영광: "Act 3 - Glory",
  glory: "Act 3 - Glory",
  미지정: "none",
};

export const TYPE_ALIASES: Record<string, CardTypeKo> = {
  공격: "공격",
  attack: "공격",
  스킬: "스킬",
  skill: "스킬",
  파워: "파워",
  power: "파워",
  저주: "저주",
  curse: "저주",
  상태이상: "상태이상",
  퀘스트: "퀘스트",
};

// Character color mapping (aligned with dev/text-effects reference)
export const CHARACTER_COLORS: Record<string, string> = {
  ironclad: "#f87171",
  silent: "#34d399",
  defect: "#22d3ee",
  necrobinder: "#f472b6",
  regent: "#fb923c",
};

/**
 * Get character color for a pool value.
 * Returns the color hex or undefined for non-character pools (shared, event).
 */
export function getCharacterColor(pool: string): string | undefined {
  return CHARACTER_COLORS[pool];
}

/**
 * CSS filter for a solid 1px outline around a transparent PNG image.
 * Uses 4 directional drop-shadows with 0 blur to create a crisp outline.
 */
export function characterOutlineFilter(pool: string): string | undefined {
  const color = CHARACTER_COLORS[pool];
  if (!color) return undefined;
  return `drop-shadow(1px 0 0 ${color}) drop-shadow(-1px 0 0 ${color}) drop-shadow(0 1px 0 ${color}) drop-shadow(0 -1px 0 ${color})`;
}

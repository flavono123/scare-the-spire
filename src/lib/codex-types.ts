// Types for STS2 codex card data

export interface CodexLifecycle {
  introducedInPatch?: string;
  deprecated?: boolean;
  deprecatedInPatch?: string;
}

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

export interface CodexCard extends CodexLifecycle {
  id: string;
  name: string; // selected game locale
  nameEn: string; // English
  description: string; // selected game locale, with BBCode markup
  descriptionEn: string; // English, with BBCode markup
  descriptionRaw: string; // selected game locale, with {Var:diff()} templates
  descriptionRawEn: string; // English, with {Var:diff()} templates
  madScienceBaseDescriptionRaw?: string; // original Mad Science template for variant recomputation
  vars: Record<string, number>; // Base variable values for description template
  cost: number;
  isXCost: boolean;
  isXStarCost: boolean;
  starCost: number | null;
  type: CardTypeKo; // Korean canonical key
  typeLabel: string; // selected game locale
  rarity: CardRarityKo; // Korean canonical key
  rarityLabel: string; // selected game locale
  color: CardColor;
  visualColor?: CardColor; // game VisualCardPool when frame/energy visuals differ from Pool
  damage: number | null;
  block: number | null;
  hitCount: number | null;
  keywords: string[];
  keywordLabels: Record<string, string>; // Korean keyword -> selected game locale label
  tags: string[];
  appliedPowerIds: string[]; // Canonical power ids applied or granted by this card
  upgrade: Record<string, string | number> | null;
  maxUpgradeLevel: number;
  specialUpgrade?: {
    upgrade: Record<string, string | number>;
    maxLevel: number;
    imageUrls?: string[]; // index 0 is base art; the last entry repeats for higher levels
  };
  imageUrl: string | null; // local path
  betaImageUrl: string | null; // local path
  madScienceLabels?: {
    eventTitle: string;
    riderChoiceDescriptions: Record<string, string>;
    typeChoiceLabel: string;
    riderChoiceLabels: Record<string, string>;
  };
}

export type CodexKeywordSource = "cardKeyword" | "staticHoverTip";

export interface CodexKeyword {
  id: string;
  name: string; // selected game locale
  nameEn: string; // English
  description: string; // selected game locale, with BBCode markup
  descriptionEn: string; // English, with BBCode markup
  descriptionRaw: string;
  descriptionRawEn: string;
  source: CodexKeywordSource;
  sourceId: string;
  imageUrl: null;
  sortOrder: number;
}

export interface CodexCharacter {
  id: string;
  name: string; // selected game locale
  nameEn: string; // English
  description: string; // selected game locale, with BBCode markup
  descriptionEn: string; // English, with BBCode markup
  startingHp: number;
  startingGold: number;
  maxEnergy: number;
  orbSlots: number | null;
  startingDeckIds: string[];
  startingRelicIds: string[];
  unlocksAfter: string | null;
  gender: string | null;
  color: CharacterColor;
  dialogueColor: string | null;
  quotes: CodexCharacterQuotes;
  ancientInteractions: CharacterAncientInteraction[];
  imageUrl: string; // local path to char_select image
  iconUrl: string; // local path to character icon
  iconOutlineUrl: string; // local path to character outline icon
  selectImageUrl: string; // local path to select pose
  selectBackgroundImageUrl: string | null; // local path to character select background image
  selectVfxImageUrls: string[]; // local paths to character select overlay VFX textures
  combatImageUrl: string; // local path to combat fallback image
  restImageUrl: string; // local path to rest fallback image
  characterSelectSpineAsset: MonsterSpineAsset | null;
  spineAsset: MonsterSpineAsset | null;
}

export interface CodexCharacterQuotes {
  eventDeathPrevention: string;
  goldMonologue: string;
  aromaPrinciple: string;
  banterAlive: string;
  banterDead: string;
  unlockText: string | null;
  cardsModifierTitle: string;
  cardsModifierDescription: string;
}

export interface CharacterAncientInteraction {
  id: string;
  ancientId: string;
  ancientName: string;
  lines: CharacterAncientDialogueLine[];
}

export interface CharacterAncientDialogueLine {
  order: number;
  speaker: "ancient" | "character";
  text: string;
}

// Filter category for card browsing
export type CardFilterCategory =
  | "ironclad"
  | "silent"
  | "defect"
  | "necrobinder"
  | "regent"
  | "colorless"
  | "token"
  | "event"
  | "quest"
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
  token: "토큰",
  event: "이벤트",
  quest: "퀘스트",
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
  토큰: "token",
  token: "token",
  이벤트: "event",
  event: "event",
  퀘스트: "quest",
  quest: "quest",
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

export interface CodexRelic extends CodexLifecycle {
  id: string;
  name: string; // Korean
  nameEn: string; // English
  description: string; // Korean, with BBCode markup (templates baked from vars)
  descriptionEn: string; // English, with BBCode markup (templates baked from vars)
  descriptionRaw: string; // Korean, with {Var} templates
  descriptionRawEn: string; // English, with {Var} templates
  vars: Record<string, number | string>; // Base variable values for description template
  flavor: string;
  rarity: RelicRarityKo;
  pool: RelicPool;
  imageUrl: string | null; // local path
  betaImageUrl: string | null; // local path
  variantImageUrls: Partial<Record<RelicPool, string>> | null; // character-specific image variants
  iconVariants: RelicIconVariant[] | null; // relic-specific icon variants
}

export interface RelicIconVariant {
  id: string;
  labelKo: string;
  labelEn: string;
  imageUrl: string;
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

export interface CodexPotion extends CodexLifecycle {
  id: string;
  name: string; // Korean
  nameEn: string; // English
  description: string; // Korean, with BBCode markup (templates baked from vars)
  descriptionEn: string; // English, with BBCode markup (templates baked from vars)
  descriptionRaw: string; // Korean, with {Var:diff()} templates
  descriptionRawEn: string; // English, with {Var:diff()} templates
  vars: Record<string, number | string>; // Base variable values for description template
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

export interface CodexPower extends CodexLifecycle {
  id: string;
  name: string;        // Korean
  nameEn: string;      // English
  description: string; // Korean, with BBCode markup (templates baked from vars)
  descriptionEn: string; // English, with BBCode markup (templates baked from vars)
  descriptionRaw: string | null;
  descriptionRawEn: string | null;
  vars: Record<string, number | string>; // Base variable values for description template
  type: PowerType;
  stackType: PowerStackType;
  allowNegative: boolean;
  imageUrl: string | null; // local path
  betaImageUrl: string | null; // local path
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
export interface CodexEnchantment extends CodexLifecycle {
  id: string;
  name: string;        // Korean
  nameEn: string;      // English
  description: string; // Korean, with BBCode markup
  descriptionEn: string; // English, with BBCode markup
  descriptionRaw: string | null;
  descriptionRawEn: string | null;
  extraCardText: string | null;
  extraCardTextEn: string | null;
  vars: Record<string, number>; // Base variable values from extracted game code
  cardType: "Attack" | "Skill" | null; // null = any card type
  isStackable: boolean;
  imageUrl: string | null; // local path
}

// Affliction types
export interface CodexAffliction extends CodexLifecycle {
  id: string;
  name: string;        // selected game locale
  nameEn: string;      // English
  description: string; // selected game locale, with BBCode markup
  descriptionEn: string; // English, with BBCode markup
  descriptionRaw: string | null;
  descriptionRawEn: string | null;
  extraCardText: string | null;
  extraCardTextEn: string | null;
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

export interface CodexEvent extends CodexLifecycle {
  id: string;
  name: string;        // Korean
  nameEn: string;      // English
  description: string; // Korean, with BBCode markup
  descriptionEn: string; // English, with BBCode markup
  act: EventAct | null;
  acts: EventAct[] | null;
  options: EventOption[] | null;
  pages: EventPage[] | null;
  imageUrl: string | null; // local path to event art
}

// Dialogue line from an ancient encounter
export interface AncientDialogueLine {
  order: string;       // e.g. "0-0", "1-0r" (r = returning)
  speaker: "ancient" | "character";
  text: string;        // Korean, with BBCode markup
}

export interface CodexAncient extends CodexLifecycle {
  id: string;
  name: string;        // Korean
  nameEn: string;      // English
  epithet: string;     // Korean title/alias
  epithetEn: string;   // English title/alias
  description: string; // Korean, with BBCode markup
  descriptionEn: string; // English, with BBCode markup
  act: EventAct | null;
  relicIds: string[];  // IDs of relics this ancient drops
  dialogue: Record<string, AncientDialogueLine[]>; // key = character name or "Returning"/"First Visit"
  imageUrl: string | null;
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
  Underdocks: { label: "Underdocks", labelKo: "1막 — 지하 선착장", color: "text-green-400", border: "border-green-500/40", bg: "bg-green-500/10" },
  "Act 2 - Hive": { label: "Hive", labelKo: "2막 — 군락", color: "text-orange-400", border: "border-orange-500/40", bg: "bg-orange-500/10" },
  "Act 3 - Glory": { label: "Glory", labelKo: "3막 — 영광", color: "text-yellow-400", border: "border-yellow-500/40", bg: "bg-yellow-500/10" },
};

export const EVENT_ACT_UNKNOWN = {
  label: "Any Act", labelKo: "막 무관", color: "text-zinc-400", border: "border-zinc-500/40", bg: "bg-zinc-500/10",
};

export function getEventActs(event: Pick<CodexEvent, "act" | "acts">): (EventAct | null)[] {
  if (event.acts && event.acts.length > 0) return event.acts;
  return [event.act];
}

export const EVENT_ACT_ALIASES: Record<string, EventAct | "none"> = {
  "1막": "Act 1 - Overgrowth",
  과성장: "Act 1 - Overgrowth",
  overgrowth: "Act 1 - Overgrowth",
  act1: "Act 1 - Overgrowth",
  "act 1": "Act 1 - Overgrowth",
  "지하 선착장": "Underdocks",
  지하선착장: "Underdocks",
  underdocks: "Underdocks",
  "2막": "Act 2 - Hive",
  군락: "Act 2 - Hive",
  hive: "Act 2 - Hive",
  act2: "Act 2 - Hive",
  "act 2": "Act 2 - Hive",
  "3막": "Act 3 - Glory",
  영광: "Act 3 - Glory",
  glory: "Act 3 - Glory",
  act3: "Act 3 - Glory",
  "act 3": "Act 3 - Glory",
  "막 무관": "none",
  미지정: "none",
  none: "none",
  any: "none",
};

export type EpochAffiliation =
  | "ironclad"
  | "silent"
  | "defect"
  | "necrobinder"
  | "regent"
  | "darv"
  | "neow"
  | "nonupeipe"
  | "orobas"
  | "pael"
  | "tanx"
  | "tezcatara"
  | "vakuu"
  | "world"
  | "spire"
  | "reopening"
  | "unknown";

export type EpochUnlockCondition =
  | "score"
  | "play_run"
  | "all_characters"
  | "beat_act1"
  | "beat_act2"
  | "beat_act3"
  | "kill_elites"
  | "kill_bosses"
  | "ascension"
  | "encounter_ancients";

export type EpochUnlockReward =
  | "card"
  | "relic"
  | "potion"
  | "character"
  | "ancient"
  | "event"
  | "mode"
  | "act"
  | "ascension"
  | "timeline"
  | "none"
  | "unknown";

export interface CodexEpoch extends CodexLifecycle {
  id: string;
  name: string;        // selected game locale
  nameEn: string;      // English
  description: string; // selected game locale, with BBCode markup
  descriptionEn: string; // English, with BBCode markup
  era: string;
  eraGroup: string;
  eraName: string | null;
  eraYear: string | null;
  eraPosition: number;
  sortOrder: number;
  storyId: string | null;
  affiliation: EpochAffiliation;
  affiliations: EpochAffiliation[];
  unlockInfo: string;
  unlockInfoEn: string;
  unlockText: string | null;
  unlockTextEn: string | null;
  unlockConditions: EpochUnlockCondition[];
  unlockRewards: EpochUnlockReward[];
  unlocksCards: string[];
  unlocksRelics: string[];
  unlocksPotions: string[];
  expandsTimeline: string[];
  imageUrl: string | null;
  betaImageUrl: string | null;
}

export const EPOCH_AFFILIATION_ORDER: EpochAffiliation[] = [
  "ironclad",
  "silent",
  "regent",
  "necrobinder",
  "defect",
  "neow",
  "darv",
  "orobas",
  "pael",
  "tanx",
  "tezcatara",
  "nonupeipe",
  "vakuu",
  "world",
  "reopening",
  "spire",
  "unknown",
];

export const EPOCH_UNLOCK_CONDITION_ORDER: EpochUnlockCondition[] = [
  "score",
  "play_run",
  "all_characters",
  "beat_act1",
  "beat_act2",
  "beat_act3",
  "kill_elites",
  "kill_bosses",
  "ascension",
  "encounter_ancients",
];

export const EPOCH_UNLOCK_REWARD_ORDER: EpochUnlockReward[] = [
  "card",
  "relic",
  "potion",
  "character",
  "ancient",
  "event",
  "mode",
  "act",
  "ascension",
  "timeline",
  "none",
  "unknown",
];

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

// Monster types
export type MonsterType = "Normal" | "Elite" | "Boss";

export interface MonsterMove {
  id: string;
  name: string; // Korean
  nameEn: string; // English
  kind?: "move" | "animation";
  animationId?: string;
  actionTypes: MonsterActionType[];
  intents: string[];
  intentDetails: MonsterMoveIntentDetail[];
  powerApplications: MonsterMovePowerApplication[];
  cardApplications: MonsterMoveCardApplication[];
}

export interface DamageValue {
  normal: number | null;
  ascension: number | null;
}

export interface MonsterMoveIntentDetail {
  type: string;
  damageKey?: string | null;
  blockKey?: string | null;
  repeat?: DamageValue | null;
  repeatExpression?: string | null;
}

export type MonsterActionType = "attack" | "defense" | "debuff" | "buff" | "special";

export type MonsterMovePowerTarget = "self" | "player" | "ally" | "enemy" | "unknown";

export interface MonsterMovePowerApplication {
  powerId: string;
  powerName: string;
  powerNameEn: string;
  powerType: PowerType | "None";
  target: MonsterMovePowerTarget;
  amount: DamageValue | null;
  imageUrl: string | null;
}

export interface MonsterMoveCardApplication {
  cardId: string;
  cardName: string;
  cardNameEn: string;
  cardType: CardTypeKo;
  cardRarity: CardRarityKo;
  cardColor: CardColor;
  applicationKind: "add" | "upgrade";
  amount: DamageValue | null;
  imageUrl: string | null;
}

export type MonsterMoveTransitionKind = "fixed" | "random" | "conditional";

export interface MonsterMoveTransition {
  from: string;
  to: string;
  chance: number | null;
  kind?: MonsterMoveTransitionKind;
  condition?: string | null;
}

export type MonsterMoveGraphStateKind = "move" | "random" | "conditional";
export type MonsterMoveRepeatRule = "forever" | "max_consecutive" | "cannot_repeat" | "once";

export interface MonsterMoveGraphRandomBranch {
  to: string;
  weight: number | null;
  weightExpression: string | null;
  baseChance: number | null;
  repeat: MonsterMoveRepeatRule;
  maxRepeats: number | null;
  cooldown: number;
}

export interface MonsterMoveGraphConditionalBranch {
  to: string;
  condition: string | null;
}

export interface MonsterMoveGraphMoveState {
  id: string;
  kind: "move";
  next: string | null;
}

export interface MonsterMoveGraphRandomState {
  id: string;
  kind: "random";
  branches: MonsterMoveGraphRandomBranch[];
}

export interface MonsterMoveGraphConditionalState {
  id: string;
  kind: "conditional";
  branches: MonsterMoveGraphConditionalBranch[];
}

export type MonsterMoveGraphState =
  | MonsterMoveGraphMoveState
  | MonsterMoveGraphRandomState
  | MonsterMoveGraphConditionalState;

export interface MonsterMoveGraph {
  initial: string | null;
  confidence: "static" | "partial";
  transitions: MonsterMoveTransition[];
  states?: MonsterMoveGraphState[];
}

export interface MonsterSpineEffectAsset {
  id: string;
  source: string;
  atlasUrl: string;
  binaryUrl: string;
  textureUrls: string[];
  animations: string[];
  idleAnimation: string;
  durationSeconds: number;
  usable?: boolean;
  parseError?: string;
}

export interface MonsterSkinPartOption {
  id: string;
  labelKo: string;
  labelEn: string;
  attachmentCount: number;
}

export interface MonsterSkinPart {
  id: string;
  labelKo: string;
  labelEn: string;
  options: MonsterSkinPartOption[];
}

export interface MonsterPhobiaModeSkin {
  normalSkin: string;
  phobiaSkin: string;
}

export interface MonsterSpineTrackAnimation {
  track: number;
  animation: string;
  loop?: boolean;
  idleAnimation?: string;
}

export interface MonsterSpineViewport {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  padLeft?: string | number;
  padRight?: string | number;
  padTop?: string | number;
  padBottom?: string | number;
}

export interface MonsterSpineAsset {
  id: string;
  source: string;
  renderStatus: string;
  renderTags: string[];
  atlasUrl: string;
  binaryUrl: string;
  textureUrls: string[];
  skin: string | null;
  skins: string[];
  skinParts?: MonsterSkinPart[];
  defaultSkinCombination?: string[];
  phobiaMode?: MonsterPhobiaModeSkin;
  viewport?: MonsterSpineViewport;
  skinVariants?: {
    id: string;
    label: string;
    attachmentCount: number;
  }[];
  animations: string[];
  bestiaryAnimations: string[];
  idleAnimation: string;
  idleTracks?: MonsterSpineTrackAnimation[];
  moveAnimations: Record<string, string[]>;
  moveAnimationTracks?: Record<string, MonsterSpineTrackAnimation[]>;
  moveEffects: Record<string, MonsterSpineEffectAsset[]>;
}

export interface MonsterPhobiaModeScene {
  scenePath: string;
  viewBox: MonsterPhobiaModeRect;
  sprite: {
    position: MonsterPhobiaModeVector;
    scale: MonsterPhobiaModeVector;
    width: number;
    height: number;
  };
  particles: MonsterPhobiaModeParticle[];
}

export interface MonsterPhobiaModeParticle {
  name: string;
  type: "GPUParticles2D" | "CPUParticles2D";
  position: MonsterPhobiaModeVector;
  amount: number;
  lifetime: number;
  preprocess: number;
  localCoords: boolean;
  texture: {
    imageUrl: string;
    source: string;
    ctex: string;
    width: number;
    height: number;
  };
  material: {
    emissionRingRadius: number;
    emissionRingInnerRadius: number;
    initialVelocityMin: number;
    initialVelocityMax: number;
    orbitVelocityMin: number;
    orbitVelocityMax: number;
    scaleMin: number;
    scaleMax: number;
    spread: number;
  };
}

export interface MonsterPhobiaModeVector {
  x: number;
  y: number;
}

export interface MonsterPhobiaModeRect extends MonsterPhobiaModeVector {
  width: number;
  height: number;
}

export interface CodexMonster extends CodexLifecycle {
  id: string;
  name: string;        // Korean
  nameEn: string;      // English
  type: MonsterType;
  showInCompendium: boolean;
  minHp: number | null;
  maxHp: number | null;
  minHpAscension: number | null;
  maxHpAscension: number | null;
  moves: MonsterMove[];
  bestiaryMoves: MonsterMove[];
  initialPowerApplications: MonsterMovePowerApplication[];
  moveGraph: MonsterMoveGraph | null;
  damageValues: Record<string, DamageValue> | null;
  blockValues: Record<string, DamageValue> | null;
  imageUrl: string | null;       // Spine render portrait (512x512)
  bossImageUrl: string | null;   // boss encounter token icon (bosses/ dir)
  phobiaModeImageUrl: string | null;
  phobiaModePartImageUrls: Record<string, string> | null;
  phobiaModeScene: MonsterPhobiaModeScene | null;
  phobiaModePartScenes: Record<string, MonsterPhobiaModeScene> | null;
  spineAsset: MonsterSpineAsset | null;
}

export type EncounterRoomType = "Monster" | "Elite" | "Boss";

export interface EncounterMonsterRef {
  id: string;
  name: string; // Korean
  nameEn: string; // English
}

export interface EncounterComposition {
  id: string;
  weight: number;
  slots: EncounterMonsterRef[][];
  slotNames: Array<string | null>;
}

export type EncounterSceneAmbientVfx =
  | { kind: "none" | "fireflies" }
  | { kind: "queen"; lightTextureUrl: string };

export interface EncounterSceneMonsterSlot {
  slotName: string;
  sourcePosition: { x: number; y: number };
  x: number;
  y: number;
}

export interface EncounterSceneCombatMonsterLayout {
  monsterId: string;
  sourceScene: string;
  bounds: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
  visualPosition: { x: number; y: number };
  visualScale: { x: number; y: number };
}

export interface EncounterSceneCombatLayout {
  coordinateSize: { width: number; height: number };
  cameraScaling: number;
  cameraOffset: { x: number; y: number };
  usesFixedSlots: boolean;
  enemyRegionWidth: number;
  enemyGap: number;
  enemyMinStart: number;
  enemyBaselineY: number;
  monsters: EncounterSceneCombatMonsterLayout[];
}

export interface EncounterSceneAsset {
  id: string;
  backgroundUrl: string;
  sourceScene: string;
  sourceLayers: string[];
  ambientVfx: EncounterSceneAmbientVfx;
  backgroundSpineAsset: MonsterSpineAsset | null;
  monsterSlots: EncounterSceneMonsterSlot[];
  combatLayout: EncounterSceneCombatLayout;
}

export interface CodexEncounter extends CodexLifecycle {
  id: string;
  name: string;        // Korean
  nameEn: string;      // English
  roomType: EncounterRoomType;
  isWeak: boolean;
  act: EventAct | null;
  tags: string[] | null;
  monsters: EncounterMonsterRef[];
  compositions: EncounterComposition[] | null;
  lossText: string;
  imageUrl: string | null;
  scene: EncounterSceneAsset | null;
}

export const MONSTER_TYPE_ORDER: MonsterType[] = ["Normal", "Elite", "Boss"];

export const MONSTER_TYPE_CONFIG: Record<MonsterType, { label: string; color: string; description: string }> = {
  Normal: { label: "일반", color: "#f5f0df", description: "첨탑에서 가장 자주 만나게 되는 몬스터들입니다." },
  Elite: { label: "엘리트", color: "#a855f7", description: "강력한 능력을 가진 상위 몬스터들입니다." },
  Boss: { label: "보스", color: "#ef5350", description: "각 막의 끝에서 기다리는 강대한 적들입니다." },
};

export const MONSTER_TYPE_ALIASES: Record<string, MonsterType> = {
  일반: "Normal", normal: "Normal",
  엘리트: "Elite", elite: "Elite",
  보스: "Boss", boss: "Boss",
};

export const ENCOUNTER_ROOM_TYPE_CONFIG: Record<EncounterRoomType, { label: string; color: string }> = {
  Monster: { label: "일반 전투", color: "#f5f0df" },
  Elite: { label: "엘리트 전투", color: "#a855f7" },
  Boss: { label: "보스 전투", color: "#ef5350" },
};

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

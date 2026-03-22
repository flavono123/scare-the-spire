// Types for spire-codex card data

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

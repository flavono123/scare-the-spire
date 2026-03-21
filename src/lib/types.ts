export type CardClass = "ironclad" | "silent" | "defect" | "watcher" | "colorless" | "curse" | "status";
export type CardType = "attack" | "skill" | "power" | "status" | "curse";
export type Rarity = "starter" | "common" | "uncommon" | "rare" | "boss" | "shop" | "event" | "special";
export type DiffType = "number" | "text" | "enum" | "image" | "boolean" | "rework";

export interface Card {
  id: string;
  name: string;
  nameKo: string;
  class: CardClass;
  cardType: CardType;
  rarity: Rarity;
  cost: number | "X" | "unplayable";
  costUpgraded?: number | "X" | "unplayable";
  description?: string;
  descriptionUpgraded?: string;
  image?: string;
  imageBeta?: string;
  deprecated?: boolean;
}

export type PotionRarity = "common" | "uncommon" | "rare";
export type CharacterClass = "Ironclad" | "Silent" | "Defect" | "Watcher";

export interface Relic {
  id: string;
  name: string;
  nameKo: string;
  rarity: Rarity;
  character: CharacterClass | null;
  description: string;
  deprecated?: boolean;
}

export interface Potion {
  id: string;
  name: string;
  nameKo: string;
  rarity: PotionRarity;
  character: CharacterClass | null;
  description: string;
}

export interface AttributeDiff {
  attribute: string;
  displayName: string;
  before: string | number;
  after: string | number;
  diffType: DiffType;
  upgraded?: boolean;  // true = upgrade-only change, undefined/false = base
}

export interface Change {
  id: string;
  entityType: "card" | "relic" | "potion";
  entityId: string;
  patch: string;
  date?: string;
  summary?: string;
  diffs: AttributeDiff[];
}

export interface LinkedEntity {
  entityType: "card" | "relic" | "potion";
  entityId: string;
  changeId?: string;
  label?: string;  // e.g. "삭제", "대체"
}

// STS2 patch types
export type PatchType = "release" | "hotfix" | "beta" | "stable";
export type STS2EntityType = "card" | "relic" | "potion" | "enemy" | "blessing";

export interface STS2Patch {
  id: string;
  version: string;
  date: string;
  title: string;
  titleKo: string;
  type: PatchType;
  steamUrl: string | null;
  summary: string;
  summaryKo: string;
  hasBalanceChanges: boolean;
}

export interface STS2AttributeDiff {
  attribute: string;
  displayName: string;
  displayNameKo: string;
  before: string | number | boolean;
  after: string | number | boolean;
  diffType: DiffType;
  upgraded?: boolean;
}

export interface STS2Change {
  id: string;
  entityType: STS2EntityType;
  entityId: string;
  patch: string;
  date?: string;
  character: string | null;
  summary?: string;
  summaryKo?: string;
  diffs: STS2AttributeDiff[];
}

export interface Story {
  id: string;
  sentence: string;
  entityType: "card" | "relic" | "potion";
  entityId: string;
  changeId: string;
  linkedEntities?: LinkedEntity[];
  tags?: string[];
}

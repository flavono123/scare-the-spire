export type CardClass = "ironclad" | "silent" | "defect" | "watcher" | "colorless" | "curse" | "status";
export type CardType = "attack" | "skill" | "power" | "status" | "curse";
export type Rarity = "starter" | "common" | "uncommon" | "rare" | "boss" | "shop" | "event" | "special";
export type DiffType = "number" | "text" | "enum" | "image";

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

export interface Story {
  id: string;
  sentence: string;
  entityType: "card" | "relic" | "potion";
  entityId: string;
  changeId: string;
  tags?: string[];
}

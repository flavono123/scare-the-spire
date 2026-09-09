export const STS1_GAME_LOCALES = [
  "kor",
  "eng",
  "zhs",
  "jpn",
  "deu",
  "fra",
  "ita",
  "spa",
  "ptb",
  "rus",
  "pol",
  "tha",
  "tur",
] as const;

export type Sts1GameLocale = (typeof STS1_GAME_LOCALES)[number];

export type Sts1CardColor =
  | "ironclad"
  | "silent"
  | "defect"
  | "watcher"
  | "colorless"
  | "curse";

export type Sts1CardType = "attack" | "skill" | "power" | "status" | "curse";

export type Sts1CardRarity =
  | "basic"
  | "special"
  | "common"
  | "uncommon"
  | "rare"
  | "curse";

export type Sts1RelicTier =
  | "starter"
  | "common"
  | "uncommon"
  | "rare"
  | "shop"
  | "special"
  | "boss"
  | "deprecated";

export type Sts1RelicPool = "shared" | "ironclad" | "silent" | "defect" | "watcher";

export type Sts1PotionRarity = "common" | "uncommon" | "rare";

export type Sts1PotionPool = Sts1RelicPool;

export type Sts1ResourceType = "cards" | "relics" | "potions";

export interface Sts1CardUpgrade {
  damage?: number;
  block?: number;
  magic?: number;
  cost?: number;
  exhaust?: boolean;
  innate?: boolean;
  ethereal?: boolean;
  retain?: boolean;
  damageScalesWithTimesUpgraded?: boolean;
}

export interface Sts1Card {
  id: string;
  slug: string;
  legacySlugs: string[];
  color: Sts1CardColor;
  cardColor: string;
  type: Sts1CardType;
  rarity: Sts1CardRarity;
  cost: number;
  damage: number | null;
  block: number | null;
  magic: number | null;
  exhaust: boolean;
  ethereal: boolean;
  innate: boolean;
  retain: boolean;
  portrait: string | null;
  upgrade: Sts1CardUpgrade | null;
  unlimitedUpgrade: boolean;
  hasBetaArt: boolean;
  name: string;
  nameEn: string;
  description: string;
  upgradeDescription: string;
  extendedDescription: string[];
}

export interface Sts1Relic {
  id: string;
  slug: string;
  legacySlugs: string[];
  tier: Sts1RelicTier;
  pool: Sts1RelicPool;
  image: string;
  hasLargeArt: boolean;
  name: string;
  nameEn: string;
  flavor: string;
  description: string;
  descriptions: string[];
}

export interface Sts1Potion {
  id: string;
  slug: string;
  legacySlugs: string[];
  rarity: Sts1PotionRarity;
  pool: Sts1PotionPool;
  size: string;
  potionColor: string;
  potency: number | null;
  thrown: boolean;
  name: string;
  nameEn: string;
  description: string;
  descriptions: string[];
}

export interface Sts1Keyword {
  id: string;
  names: string[];
  description: string;
}

export interface Sts1UiLabels {
  cardLibraryTitle: string;
  relicCollectionTitle: string;
  potionLabTitle: string;
  viewUpgrades: string;
  betaArt: string;
  types: Record<"attack" | "skill" | "power" | "curse" | "status", string>;
  extras: Record<"colorless" | "curse" | "status" | "special", string>;
  sort: Record<"rarity" | "type" | "name" | "cost", string>;
  relicTiers: Record<Exclude<Sts1RelicTier, "deprecated">, string>;
  relicTierDescriptions: Record<Exclude<Sts1RelicTier, "deprecated">, string>;
  potionRarities: Record<Sts1PotionRarity, string>;
  potionRarityDescriptions: Record<Sts1PotionRarity, string>;
  characters: Record<"ironclad" | "silent" | "defect" | "watcher", string>;
  shared: string;
}

export interface Sts1CardStats {
  cost: number;
  damage: number | null;
  block: number | null;
  magic: number | null;
  exhaust: boolean;
  ethereal: boolean;
  innate: boolean;
  retain: boolean;
  nameSuffix: string;
  upgraded: boolean;
}

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

export type Sts1PowerType = "buff" | "debuff";

export type Sts1CharacterId = "ironclad" | "silent" | "defect" | "watcher";

export type Sts1ResourceType = "cards" | "relics" | "potions" | "powers" | "characters";

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
  /**
   * CSS px (x right, y down) the game moves a trimmed `cards.atlas` portrait:
   * renderPortrait centers the packed region and ignores its atlas offset.
   */
  portraitShift?: [number, number];
  /** Same drift for the `oldCards.atlas` beta portrait. */
  betaPortraitShift?: [number, number];
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

export interface Sts1PowerSources {
  cards: string[];
  relics: string[];
  potions: string[];
}

export interface Sts1Power {
  id: string;
  slug: string;
  legacySlugs: string[];
  type: Sts1PowerType;
  /** `single` when the constructor sets `amount = -1` (no stack counter). */
  stackType: "counter" | "single";
  canGoNegative: boolean;
  isTurnBased: boolean;
  image: string;
  sources: Sts1PowerSources;
  name: string;
  nameEn: string;
  description: string;
  descriptions: string[];
}

export interface Sts1ResourceRef {
  type: Extract<Sts1ResourceType, "cards" | "relics" | "potions">;
  id: string;
  slug: string;
  name: string;
  imageUrl: string;
}

export interface Sts1CharacterSelectEffect {
  sound?: string;
  shakeIntensity?: "LOW" | "MED" | "HIGH";
  shakeDuration?: "SHORT" | "MED" | "LONG" | "XLONG";
  shakeVertical?: boolean;
  pitchMin?: number;
  pitchMax?: number;
}

export interface Sts1Character {
  id: Sts1CharacterId;
  slug: string;
  legacySlugs: string[];
  playerClass: string;
  hp: number;
  maxHp: number;
  maxOrbs: number;
  gold: number;
  cardDraw: number;
  startingRelicIds: string[];
  startingDeckIds: string[];
  selectEffect: Sts1CharacterSelectEffect;
  name: string;
  nameEn: string;
  title: string;
  flavor: string;
}

export interface Sts1CharacterSelectUi {
  choose: string;
  embark: string;
  back: string;
  hp: string;
  gold: string;
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
  powersTitle: string;
  charactersTitle: string;
  powerTypes: Record<Sts1PowerType, string>;
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

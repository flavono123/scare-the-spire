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

export type Sts1MonsterType = "normal" | "elite" | "boss";

export type Sts1Dungeon = "exordium" | "city" | "beyond" | "ending";

export type Sts1ResourceType = "cards" | "relics" | "potions" | "powers" | "monsters" | "characters";

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

export interface Sts1MonsterHitPoints {
  ascension: number;
  min: number;
  max: number;
}

/** AbstractMonster.Intent values a move can show. */
export type Sts1MonsterIntent =
  | "ATTACK"
  | "ATTACK_BUFF"
  | "ATTACK_DEBUFF"
  | "ATTACK_DEFEND"
  | "BUFF"
  | "DEBUFF"
  | "STRONG_DEBUFF"
  | "DEFEND"
  | "DEFEND_DEBUFF"
  | "DEFEND_BUFF"
  | "ESCAPE"
  | "MAGIC"
  | "SLEEP"
  | "STUN"
  | "UNKNOWN";

/** A fixed number, or an inclusive random roll such as `random(5, 7)`. */
export type Sts1MonsterAmount = number | { min: number; max: number };
export type Sts1MonsterEffectTarget = "self" | "player" | "ally";

export interface Sts1MonsterEffects {
  block?: { target: Sts1MonsterEffectTarget; amount: Sts1MonsterAmount | null }[];
  powers?: { power: string; target: Sts1MonsterEffectTarget; amount: Sts1MonsterAmount | null }[];
  cards?: { card: string; amount: number; pile: "discard" | "draw" | "hand" | "discard-and-deck" }[];
  heal?: { target: Sts1MonsterEffectTarget; amount: Sts1MonsterAmount | null }[];
  /** Monster IDs. */
  summons?: string[];
  flags?: ("escape" | "suicide")[];
}

/** Values from this ascension level up, until the next tier. */
export interface Sts1MonsterMoveTier extends Sts1MonsterEffects {
  ascension: number;
  intent?: Sts1MonsterIntent;
  /** The damage the intent shows (`setMove`). */
  damage?: Sts1MonsterAmount;
  /** Hit count when the intent shows `damage × multiplier`. */
  multiplier?: number;
  /** Damage of each queued hit (`takeTurn`). */
  hits?: (Sts1MonsterAmount | null)[];
}

export interface Sts1MonsterStartingTier extends Sts1MonsterEffects {
  ascension: number;
}

/** `spine` plays a skeleton clip; `motion` is the game's whole-sprite lunge, hop or shake. */
export interface Sts1MonsterMoveTrigger {
  type: "spine" | "motion";
  name: string;
}

export interface Sts1MonsterMove {
  /** The move byte the game queues. */
  id: number;
  /** The constant's name in the monster class, e.g. `CHOMP`. */
  key: string | null;
  /** Localized name when the game names the move, else null. */
  name: string | null;
  nameEn: string | null;
  triggers: Sts1MonsterMoveTrigger[];
  tiers: Sts1MonsterMoveTier[];
}

export interface Sts1MonsterRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A Spine 3.4 skeleton converted to 4.2, in skeleton units (y up). */
export interface Sts1MonsterSpine {
  skeletonUrl: string;
  atlasUrl: string;
  idle: string;
  animations: string[];
  /** Union of every clip's bounds: the player's fixed viewport. */
  viewport: Sts1MonsterRect;
  /** Where the still image sits inside the viewport. */
  still: Sts1MonsterRect;
}

/** A number the game computed from positions and rolls: `c + sum(t[name] * value(name))`. */
export type Sts1VfxNumber = number | { c: number; t: Record<string, number> };

export type Sts1VfxArg =
  | Sts1VfxNumber
  | boolean
  | string
  | null
  | { color: string | number | number[] }
  | { enum: string }
  | { creature: "monster" | "player" }
  | { hitbox: "monster" | "player" };

/** One step of a move's `takeTurn`, `at` seconds after the turn starts. */
export type Sts1VfxEvent =
  | { at: number; type: "spine" | "motion" | "state"; name: string }
  | { at: number; type: "effect"; effect: string; args: Sts1VfxArg[]; list?: "top" }
  | { at: number; type: "shake"; intensity: string; dur: string };

/** What the constructor tells the stage about the monster's body, in game units. */
export interface Sts1MonsterVfx {
  /** `hb_x, hb_y, hb_w, hb_h` from `super(...)`. */
  hitbox?: [number, number, number, number];
  offset?: [number, number];
  /** `loadAnimation`'s scale: the game draws the skeleton at 1/scale. */
  skeletonScale?: number;
  /** The image `AbstractMonster` draws when there is no skeleton. */
  image?: string;
  /**
   * Spine speeds the game sets: `start` for the clip the constructor starts,
   * `clips` for clips `changeState` starts, `state` for the AnimationState.
   */
  timeScales?: { start?: Record<string, number>; clips?: Record<string, number>; state?: number };
  /** Move id -> timeline. */
  moves: Record<string, Sts1VfxEvent[]>;
}

export interface Sts1Monster {
  id: string;
  slug: string;
  legacySlugs: string[];
  dungeon: Sts1Dungeon;
  type: Sts1MonsterType;
  hitPoints: Sts1MonsterHitPoints[];
  name: string;
  nameEn: string;
  moves: Sts1MonsterMove[];
  startingEffects: Sts1MonsterStartingTier[];
  spine: Sts1MonsterSpine | null;
  vfx: Sts1MonsterVfx | null;
}

/** Names and links for the powers, cards and monsters a monster's moves reference. */
export interface Sts1MonsterRefs {
  powers: Record<string, { slug: string; name: string; image: string; type: Sts1PowerType }>;
  cards: Record<string, { slug: string; name: string }>;
  monsters: Record<string, { slug: string; name: string }>;
}

export interface Sts1MonsterLabels {
  hitPoints: string;
  ascension: string;
  types: Record<Sts1MonsterType, string>;
  dungeons: Record<Sts1Dungeon, { act: string; name: string }>;
  /** Intent tooltip headers (AbstractMonster.TEXT). */
  intents: Record<Sts1MonsterIntent, string>;
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
  monstersTitle: string;
  charactersTitle: string;
  powerTypes: Record<Sts1PowerType, string>;
  monsters: Sts1MonsterLabels;
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

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

export type Sts1ResourceType =
  | "cards"
  | "relics"
  | "potions"
  | "powers"
  | "monsters"
  | "characters"
  | "events"
  | "keywords"
  | "ascensions"
  | "modifiers"
  | "blights"
  | "neow"
  | "achievements"
  | "score-bonuses";

/** Types with a detail page per entry; the others are a single list page. */
export type Sts1DetailResourceType = Exclude<Sts1ResourceType, "ascensions" | "neow" | "achievements" | "score-bonuses">;

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
  /** Every STS1 list's title (getSts1NavLabel). */
  listTitles: Record<Sts1ResourceType, string>;
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

/** A localized text with its numbers left as var references, joined in order. */
export type Sts1TextTemplate = (string | { v: string })[];

export type Sts1VarValue =
  | number
  | { min: number; max: number }
  | { of: "maxHp" | "currentHp" | "gold"; pct?: number; frac?: [number, number] }
  | { list: number[] };

export interface Sts1VarTier {
  ascension: number;
  value: Sts1VarValue;
}

type Sts1EntityRefType = "card" | "relic" | "potion" | "monster" | "power" | "blight";
/** Keywords and mods are only named in text, so pages that mention them add them on top. */
export type Sts1RefType = Sts1EntityRefType | "keyword" | "modifier";

/** Something the game text names without the game tipping it (keywords and mods by slug). */
export interface Sts1Mention {
  type: Sts1RefType;
  id: string;
}

/** A fixed item, one of a small list (`pool`), or a generic draw (`tier`, not drawn as a token). */
export interface Sts1ItemRef {
  type: "card" | "relic" | "potion";
  id?: string;
  pool?: string[] | "curse";
  tier?: string;
  upgraded?: boolean;
  count?: number;
}

export interface Sts1EntityRef {
  slug: string;
  name: string;
  imageUrl: string;
}

/** Names, links and art for every card, relic, potion, monster and power a page names. */
export type Sts1EntityRefs = Record<Sts1EntityRefType, Record<string, Sts1EntityRef>> & Partial<Record<"keyword" | "modifier", Record<string, Sts1EntityRef>>> & {
  /** Card ids `AbstractDungeon.getCurse()` draws from, when a ref asks for a random curse. */
  cursePool?: string[];
};

export interface Sts1EventOutcome {
  next: string;
  chance?: number;
  /** The branch the game takes for this character, not a roll. */
  character?: Sts1CharacterId;
  gains?: Sts1ItemRef[];
  loses?: Sts1ItemRef[];
}

export interface Sts1EventOption {
  label: Sts1TextTemplate;
  lockedLabel?: Sts1TextTemplate;
  disabled?: boolean;
  preview?: Sts1ItemRef;
  next?: string | null;
  outcomes?: Sts1EventOutcome[];
  gains?: Sts1ItemRef[];
  loses?: Sts1ItemRef[];
  combat?: { encounters: string[][] };
  ascension?: { min?: number; max?: number };
  /** Cards its text names that it neither gives nor takes (Back to Basics upgrades Strikes and Defends). */
  mentions?: Sts1ItemRef[];
}

export interface Sts1EventBodyVariant {
  characters?: Sts1CharacterId[];
  monster?: string;
  body: Sts1TextTemplate;
}

export interface Sts1EventScene {
  body: Sts1TextTemplate;
  bodyVariants?: Sts1EventBodyVariant[];
  image?: string | null;
  options: Sts1EventOption[];
}

export type Sts1EventGroup = "exordium" | "city" | "beyond" | "shrine" | "special";

export interface Sts1Event {
  id: string;
  slug: string;
  legacySlugs: string[];
  name: string;
  nameEn: string;
  kind: "image" | "room";
  image: string | null;
  /** Room events without art: the monsters the room shows instead. */
  artMonsters: string[];
  /** Monsters the text names outside any fight (the Cultists in Nest). */
  mentionMonsters: string[];
  groups: Sts1EventGroup[];
  dungeons: Sts1Dungeon[];
  vars: Record<string, Sts1VarTier[]>;
  start: string;
  scenes: Record<string, Sts1EventScene>;
}

export interface Sts1EventLabels {
  title: string;
  groups: Record<Sts1EventGroup, string>;
  dungeons: Record<Sts1Dungeon, { act: string; name: string }>;
  characters: Record<Sts1CharacterId, string>;
  ascension: string;
  /** Proceed Screen DESCRIPTIONS[0]: the button the event ends with. */
  proceed: string;
}

export type Sts1KeywordKind = "keyword" | "orb" | "stance";

export interface Sts1CompendiumKeyword {
  id: string;
  slug: string;
  legacySlugs: string[];
  kind: Sts1KeywordKind;
  name: string;
  nameEn: string;
  /** Every spelling the game tips (keywords.json NAMES). */
  names: string[];
  description: string;
  image: string | null;
  /** Stances have no icon: StanceAuraEffect's aura color stands in. */
  color?: string;
  /** Cards, relics, potions and powers whose text names this keyword. */
  users: { type: "cards" | "relics" | "potions" | "powers"; slug: string; name: string; imageUrl: string }[];
  /** What its text names besides keywords (FATAL names Minion). */
  mentions: Sts1Mention[];
}

export interface Sts1Ascension {
  level: number;
  description: string;
  /** The level changes monster hit points, damage or moves. */
  monsterStats: boolean;
  mentions: Sts1Mention[];
}

export interface Sts1Modifier {
  id: string;
  slug: string;
  legacySlugs: string[];
  name: string;
  nameEn: string;
  description: string;
  color: string | null;
  icon: string | null;
  dailyOnly: boolean;
  exclusive: string[];
  refs: Sts1ItemRef[];
  /** Powers and other mods its text names. */
  mentions: Sts1Mention[];
}

export interface Sts1Blight {
  id: string;
  slug: string;
  legacySlugs: string[];
  name: string;
  nameEn: string;
  description: string;
  stackDescription: string | null;
  image: string;
  unique: boolean;
  mentions: Sts1Mention[];
}

export interface Sts1NeowReward {
  type: string;
  label: string;
  refs: Sts1ItemRef[];
}

export interface Sts1NeowCategory {
  index: number;
  rewards: Sts1NeowReward[];
  drawbacks: Sts1NeowReward[];
}

export interface Sts1Neow {
  name: string;
  greeting: string;
  categories: Sts1NeowCategory[];
}

export interface Sts1Achievement {
  key: string;
  slug: string;
  name: string;
  description: string;
  image: string;
  hidden: boolean;
  refs: { type: Sts1RefType | "character"; id: string }[];
}

export interface Sts1ScoreBonus {
  id: string;
  slug: string;
  name: string;
  description: string;
  points: string;
  screens: ("death" | "victory")[];
}

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

export type StoryGame = "sts1" | "sts2";
export type StoryEntityType =
  | "character"
  | "card"
  | "relic"
  | "potion"
  | "power"
  | "enchantment"
  | "affliction"
  | "event"
  | "monster"
  | "encounter"
  | "ancient"
  | "epoch";

export interface LinkedEntity {
  game?: StoryGame;
  entityType: StoryEntityType;
  entityId: string;
  changeId?: string;
  label?: string;  // e.g. "삭제", "대체"
}

// STS2 patch types
export type PatchType = "release" | "hotfix" | "beta" | "stable";
export type STS2EntityType = StoryEntityType | "enemy" | "blessing";
export type STS2PatchFeaturedEntityType =
  | "character"
  | "card"
  | "relic"
  | "potion"
  | "power"
  | "enchantment"
  | "affliction"
  | "event"
  | "monster"
  | "encounter"
  | "ancient"
  | "epoch";

export interface STS2PatchFeaturedEntity {
  type: STS2PatchFeaturedEntityType;
  id: string;
}

export type STS2PatchArtType = "card" | "epoch" | "event" | "ancient" | "image";

export interface STS2PatchArt {
  type: STS2PatchArtType;
  id?: string;
  imageUrl?: string;
  alt?: string;
  altKo?: string;
  objectPosition?: string;
}

export interface STS2Patch {
  id: string;
  version: string;
  versionLabel?: string;
  versionLabelKo?: string;
  date: string;
  title: string;
  titleKo: string;
  type: PatchType;
  status?: "ready" | "building" | "watching";
  steamUrl: string | null;
  summary: string;
  summaryKo: string;
  hasBalanceChanges: boolean;
  art?: STS2PatchArt;
  featuredEntities?: STS2PatchFeaturedEntity[];
}

export interface STS2AttributeDiff {
  attribute: string;
  displayName: string;
  displayNameKo: string;
  before: string | number | boolean;
  after: string | number | boolean;
  beforeKo?: string | number | boolean;
  afterKo?: string | number | boolean;
  diffType: DiffType;
  upgraded?: boolean;
}

export interface STS2ChangeRelatedEntity {
  type: STS2EntityType;
  id: string;
}

export interface STS2ChangeVisualDiff {
  type: "monster-pattern";
  variant?: "full" | "compact";
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
  fieldDiffs?: EntityFieldDiff[];
  relatedEntities?: STS2ChangeRelatedEntity[];
  visualDiff?: STS2ChangeVisualDiff;
}

// =============================================================================
// Entity versioning — machine-applicable diffs for reconstructing past versions
// =============================================================================

export type VersionedEntityType =
  | "card"
  | "relic"
  | "potion"
  | "power"
  | "enchantment"
  | "affliction"
  | "event"
  | "monster"
  | "encounter"
  | "ancient"
  | "epoch";

/** A single field-level diff that maps to an actual entity field (e.g. CodexCard.cost). */
export interface EntityFieldDiff {
  field: string;              // CodexCard/CodexRelic/CodexPotion field name
  before?: unknown;           // Exact value BEFORE this patch
  after?: unknown;            // Exact value AFTER this patch
  upgraded?: boolean;         // true = applies to upgrade sub-fields only
}

/** All field-level diffs for one entity in one patch. */
export interface EntityVersionDiff {
  entityType: VersionedEntityType;
  entityId: string;           // e.g. "PREPARED"
  patch: string;              // e.g. "v0.100.0"
  diffs: EntityFieldDiff[];
}

/** Metadata for the current codex data snapshot. */
export interface CodexMeta {
  version: string;            // Patch version this snapshot represents
  extractedAt: string;        // ISO date of extraction
}

export interface Story {
  id: string;
  game?: StoryGame;
  publishedAt?: string;
  sentence: string;
  entityType?: StoryEntityType;
  entityId?: string;
  changeId?: string;
  linkedEntities?: LinkedEntity[];
  tags?: string[];
  /** Patch reference for text-only stories without entity links */
  source?: string;
}

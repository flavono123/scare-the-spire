import type { EntityInfo, EntityType } from "@/components/patch-note-renderer";
import { isEtcRarity } from "@/lib/card-annotations";
import {
  CHARACTER_COLORS,
  EPOCH_AFFILIATION_ORDER,
  EVENT_ACT_ORDER,
  getEventActs,
  MODIFIER_POLARITY_ORDER,
  MONSTER_TYPE_ORDER,
  POTION_RARITY_ORDER,
  POWER_TYPE_ORDER,
  RELIC_RARITY_ORDER,
  type CardColor,
  type CardFilterCategory,
  type CardTypeKo,
  type CodexCard,
  type CodexKeywordSource,
  type EnchantmentCardTypeFilter,
  type EpochAffiliation,
  type EventAct,
  type ModifierPolarity,
  type MonsterType,
  type PotionPool,
  type PotionRarityKo,
  type PowerType,
  type RelicPool,
  type RelicRarityKo,
} from "@/lib/codex-types";
import sts2Meta from "../../data/sts2/meta.json";

export const DECISIONS_DECISIONS_HREF = "/decisions-decisions";
export const DECISIONS_DECISIONS_TOKEN_SRC =
  "/images/sts2/powers/buffer_power.webp";
export const DECISIONS_DECISIONS_BACKGROUND_SRC =
  "/images/sts2/cards/decisions_decisions.webp";

export const DECISIONS_DECISIONS_TABLE = "decisions_decisions_posts";
export const DECISIONS_DECISIONS_FEED_SERVICE = "decisions_decisions";

/** Smaller than CardTile `mini` (150px). */
export const DECISIONS_DECISIONS_CARD_WIDTH = 72;

export const DECISIONS_DECISIONS_TITLE_MIN_CHARS = 1;
export const DECISIONS_DECISIONS_TITLE_MAX_CHARS = 80;
export const DECISIONS_DECISIONS_NOTE_MAX_CHARS = 500;

export const DECISIONS_DECISIONS_GAME_VERSION = sts2Meta.version;

export const UNRANKED_ROW_ID = "unranked";

export const DECISIONS_DECISIONS_RESOURCE_TYPES = [
  "character",
  "card",
  "relic",
  "potion",
  "power",
  "enchantment",
  "monster",
  "event",
  "ancient",
  "epoch",
  "keyword",
  "ascension",
  "modifier",
] as const satisfies readonly EntityType[];

export type DecisionsDecisionsResourceType =
  (typeof DECISIONS_DECISIONS_RESOURCE_TYPES)[number];

export type DecisionsDecisionsResourceRef = {
  type: DecisionsDecisionsResourceType;
  id: string;
};

export const SPIRE_TIER_COLOR_KEYS = [
  "gold",
  "green",
  "aqua",
  "orange",
  "red",
  "blue",
  "pink",
  "purple",
  "silver",
  "bronze",
] as const;

export const CHARACTER_TIER_COLOR_KEYS = [
  "ironclad",
  "silent",
  "defect",
  "necrobinder",
  "regent",
] as const;

export type SpireTierColorKey = (typeof SPIRE_TIER_COLOR_KEYS)[number];
export type CharacterTierColorKey = (typeof CHARACTER_TIER_COLOR_KEYS)[number];
export type TierColorKey = SpireTierColorKey | CharacterTierColorKey;

export interface TierRow {
  id: string;
  label: string;
  color: TierColorKey;
}

export interface TierPlacement {
  type: DecisionsDecisionsResourceType;
  id: string;
  rowId: string;
  sort: number;
}

export interface DecisionsDecisionsPost {
  id: string;
  user_id: string;
  nickname: string;
  title: string;
  note: string;
  preset_key: string;
  game_version: string;
  rows: TierRow[];
  placements: TierPlacement[];
  extra_ids: DecisionsDecisionsResourceRef[];
  env: string;
  created_at: string;
  like_count?: number;
  comment_count?: number;
}

export const DEFAULT_TIER_ROWS: readonly TierRow[] = [
  { id: "s", label: "S", color: "gold" },
  { id: "a", label: "A", color: "green" },
  { id: "b", label: "B", color: "aqua" },
  { id: "c", label: "C", color: "orange" },
  { id: "d", label: "D", color: "red" },
];

/** Same hexes as Transfigure token appearance / `SPIRE_ICON_COLORS`. */
const SPIRE_TIER_BAR: Record<SpireTierColorKey, string> = {
  gold: "#EFC851",
  green: "#34d399",
  aqua: "#22d3ee",
  orange: "#fb923c",
  red: "#f87171",
  blue: "#60a5fa",
  pink: "#f472b6",
  purple: "#c084fc",
  silver: "#8ad6e0",
  bronze: "#d7a470",
};

export const TIER_PALETTE_KEYS = [
  "gold",
  "red",
  "green",
  "orange",
  "pink",
  "aqua",
  "blue",
  "purple",
] as const satisfies readonly SpireTierColorKey[];

export type TierPaletteKey = (typeof TIER_PALETTE_KEYS)[number];

const SPIRE_TIER_TEXT: Record<SpireTierColorKey, string> = {
  gold: "spire-gold",
  green: "spire-green",
  aqua: "spire-aqua",
  orange: "spire-orange",
  red: "spire-red",
  blue: "spire-blue",
  pink: "spire-pink",
  purple: "spire-purple",
  silver: "spire-silver",
  bronze: "spire-bronze",
};

const PLAYABLE_CARD_TYPES = new Set<CardTypeKo>(["공격", "스킬", "파워"]);

export function isDecisionsDecisionsResourceType(
  type: EntityType,
): type is DecisionsDecisionsResourceType {
  return DECISIONS_DECISIONS_RESOURCE_TYPES.includes(
    type as DecisionsDecisionsResourceType,
  );
}

export function isSpireTierColorKey(value: unknown): value is SpireTierColorKey {
  return SPIRE_TIER_COLOR_KEYS.includes(value as SpireTierColorKey);
}

export function isCharacterTierColorKey(
  value: unknown,
): value is CharacterTierColorKey {
  return CHARACTER_TIER_COLOR_KEYS.includes(value as CharacterTierColorKey);
}

export function isTierColorKey(value: unknown): value is TierColorKey {
  return isSpireTierColorKey(value) || isCharacterTierColorKey(value);
}

export function tierColorBar(color: TierColorKey): string {
  if (isCharacterTierColorKey(color)) {
    return CHARACTER_COLORS[color] ?? SPIRE_TIER_BAR.gold;
  }
  return SPIRE_TIER_BAR[color];
}

export function tierColorTextClass(color: TierColorKey): string {
  if (isCharacterTierColorKey(color)) {
    return SPIRE_TIER_TEXT[
      color === "ironclad"
        ? "red"
        : color === "silent"
        ? "green"
        : color === "defect"
        ? "aqua"
        : color === "necrobinder"
        ? "pink"
        : "orange"
    ];
  }
  return SPIRE_TIER_TEXT[color];
}

export function resourceKey(
  ref: Pick<DecisionsDecisionsResourceRef, "type" | "id">,
): string {
  return `${ref.type}:${ref.id}`;
}

export function entityToResourceRef(
  entity: EntityInfo,
): DecisionsDecisionsResourceRef | null {
  if (!isDecisionsDecisionsResourceType(entity.type)) return null;
  return { type: entity.type, id: entity.id };
}

export const CUSTOM_PRESET_KEY = "custom";

export const CARD_POOL_MINORS = [
  "ironclad",
  "silent",
  "defect",
  "necrobinder",
  "regent",
  "colorless",
] as const satisfies readonly CardColor[];

/** Compendium card-library affiliation keys, character row then extras. */
export const CARD_AFFILIATION_MINORS = [
  "ironclad",
  "silent",
  "defect",
  "necrobinder",
  "regent",
  "colorless",
  "ancient",
  "status",
  "curse",
  "event",
  "quest",
  "token",
] as const satisfies readonly CardFilterCategory[];

export const RELIC_POOL_MINORS = [
  "shared",
  "ironclad",
  "silent",
  "defect",
  "necrobinder",
  "regent",
] as const satisfies readonly RelicPool[];

export const RELIC_AFFILIATION_MINORS = [
  "ironclad",
  "silent",
  "defect",
  "necrobinder",
  "regent",
  "shared",
  "event",
] as const satisfies readonly (RelicPool | "event")[];

export const POTION_POOL_MINORS = [
  "all",
  "shared",
  "ironclad",
  "silent",
  "defect",
  "necrobinder",
  "regent",
  "event",
] as const satisfies readonly (PotionPool | "all")[];

export const POTION_AFFILIATION_MINORS = [
  "ironclad",
  "silent",
  "defect",
  "necrobinder",
  "regent",
  "shared",
  "event",
] as const satisfies readonly PotionPool[];

export const CARD_KIND_MINORS = ["공격", "스킬", "파워"] as const satisfies readonly CardTypeKo[];

export const CARD_RARITY_MINORS = ["일반", "고급", "희귀", "기타"] as const;

export const RELIC_RARITY_MINORS = RELIC_RARITY_ORDER.filter(
  (rarity) => rarity !== "None",
);

export const POTION_RARITY_MINORS = POTION_RARITY_ORDER;

export const POWER_KIND_MINORS = POWER_TYPE_ORDER;

export const ENCHANTMENT_KIND_MINORS = [
  "Attack",
  "Skill",
  "Any",
] as const satisfies readonly EnchantmentCardTypeFilter[];

export const MONSTER_KIND_MINORS = MONSTER_TYPE_ORDER;

export const ACT_MINORS = EVENT_ACT_ORDER.map((act) => act ?? "none");

export const KEYWORD_KIND_MINORS = [
  "cardKeyword",
  "staticHoverTip",
] as const satisfies readonly CodexKeywordSource[];

export const MODIFIER_KIND_MINORS = MODIFIER_POLARITY_ORDER;

export const EPOCH_AFFILIATION_MINORS = EPOCH_AFFILIATION_ORDER;

export type DecisionsPoolMajor = DecisionsDecisionsResourceType;

export type DecisionsFilterDim = "affiliation" | "kind" | "rarity" | "act";

export type DecisionsFilterDims = {
  affiliation: Set<string>;
  kind: Set<string>;
  rarity: Set<string>;
  act: Set<string>;
};

export type DecisionsDecisionsPresetKind = "custom" | "cards" | "relics" | "potions";

export type DecisionsDecisionsPresetDef =
  | { key: typeof CUSTOM_PRESET_KEY; kind: "custom" }
  | { key: string; kind: "cards"; color: CardColor }
  | { key: string; kind: "relics"; pool: RelicPool }
  | { key: string; kind: "potions"; pool: PotionPool | "all" };

export const DECISIONS_DECISIONS_PRESET_DEFS: readonly DecisionsDecisionsPresetDef[] = [
  { key: CUSTOM_PRESET_KEY, kind: "custom" },
  { key: "cards-ironclad", kind: "cards", color: "ironclad" },
  { key: "cards-silent", kind: "cards", color: "silent" },
  { key: "cards-defect", kind: "cards", color: "defect" },
  { key: "cards-necrobinder", kind: "cards", color: "necrobinder" },
  { key: "cards-regent", kind: "cards", color: "regent" },
  { key: "cards-colorless", kind: "cards", color: "colorless" },
  { key: "relics-shared", kind: "relics", pool: "shared" },
  { key: "potions-all", kind: "potions", pool: "all" },
];

export function isDecisionsDecisionsPresetKey(value: unknown): boolean {
  return DECISIONS_DECISIONS_PRESET_DEFS.some((preset) => preset.key === value);
}

export function findPresetDef(key: string): DecisionsDecisionsPresetDef {
  return DECISIONS_DECISIONS_PRESET_DEFS.find((preset) => preset.key === key)
    ?? DECISIONS_DECISIONS_PRESET_DEFS[0]!;
}

function isPlayableCard(entity: EntityInfo, color: CardColor): boolean {
  const card = entity.cardData;
  if (entity.type !== "card" || !card || card.deprecated) return false;
  if (!PLAYABLE_CARD_TYPES.has(card.type)) return false;
  return card.color === color;
}

function isPoolRelic(entity: EntityInfo, pool: RelicPool): boolean {
  const relic = entity.relicData;
  if (entity.type !== "relic" || !relic || relic.deprecated) return false;
  return relic.pool === pool;
}

function isPotion(entity: EntityInfo, pool: PotionPool | "all"): boolean {
  const potion = entity.potionData;
  if (entity.type !== "potion" || !potion || potion.deprecated) return false;
  if (pool === "all") return true;
  return potion.pool === pool;
}

/** Same affiliation rules as Compendium `card-library` sidebar chips. */
function cardMatchesFilterCategory(card: CodexCard, category: CardFilterCategory): boolean {
  switch (category) {
    case "ancient":
      return card.rarity === "고대의 존재";
    case "colorless":
      return card.color === "colorless";
    case "token":
      return card.rarity === "토큰";
    case "event":
      return card.rarity === "이벤트";
    case "quest":
      return card.rarity === "퀘스트" || card.type === "퀘스트" || card.color === "quest";
    case "curse":
      return card.color === "curse" || card.rarity === "저주" || card.type === "저주";
    case "status":
      return card.color === "status" || card.rarity === "상태이상" || card.type === "상태이상";
    default:
      return card.color === category;
  }
}

function isAffiliationCard(entity: EntityInfo, category: CardFilterCategory): boolean {
  const card = entity.cardData;
  if (entity.type !== "card" || !card || card.deprecated) return false;
  return cardMatchesFilterCategory(card, category);
}

function isAffiliationRelic(entity: EntityInfo, pool: RelicPool | "event"): boolean {
  const relic = entity.relicData;
  if (entity.type !== "relic" || !relic || relic.deprecated) return false;
  if (pool === "event") return relic.rarity === "이벤트 유물";
  return relic.pool === pool;
}

function isCardFilterCategory(value: string): value is CardFilterCategory {
  return (CARD_AFFILIATION_MINORS as readonly string[]).includes(value);
}

function isRelicAffiliation(value: string): value is RelicPool | "event" {
  return (RELIC_AFFILIATION_MINORS as readonly string[]).includes(value);
}

export function stampPresetIds(
  def: DecisionsDecisionsPresetDef,
  entities: EntityInfo[],
): DecisionsDecisionsResourceRef[] {
  if (def.kind === "custom") return [];
  const matches = entities.filter((entity) => {
    if (def.kind === "cards") return isPlayableCard(entity, def.color);
    if (def.kind === "relics") return isPoolRelic(entity, def.pool);
    return isPotion(entity, def.pool);
  });
  return matches
    .map(entityToResourceRef)
    .filter((ref): ref is DecisionsDecisionsResourceRef => ref != null);
}

export function stampAllPresetIds(
  entities: EntityInfo[],
): Record<string, DecisionsDecisionsResourceRef[]> {
  const stamps: Record<string, DecisionsDecisionsResourceRef[]> = {};
  for (const def of DECISIONS_DECISIONS_PRESET_DEFS) {
    stamps[def.key] = stampPresetIds(def, entities);
  }
  return stamps;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asResourceType(value: unknown): DecisionsDecisionsResourceType | null {
  return isDecisionsDecisionsResourceType(value as EntityType)
    ? value as DecisionsDecisionsResourceType
    : null;
}

function normalizeRow(value: unknown, index: number): TierRow | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = asString(record.id)?.trim() || `row-${index}`;
  const label = asString(record.label)?.trim() || id.toUpperCase();
  const color = isTierColorKey(record.color) ? record.color : "gold";
  if (id === UNRANKED_ROW_ID) return null;
  return { id, label: label.slice(0, 12), color };
}

function normalizePlacement(value: unknown, index: number): TierPlacement | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const type = asResourceType(record.type);
  const id = asString(record.id)?.trim();
  const rowId = asString(record.rowId)?.trim();
  if (!type || !id || !rowId) return null;
  const sort = typeof record.sort === "number" && Number.isFinite(record.sort)
    ? record.sort
    : index;
  return { type, id, rowId, sort };
}

function normalizeRef(value: unknown): DecisionsDecisionsResourceRef | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const type = asResourceType(record.type);
  const id = asString(record.id)?.trim();
  if (!type || !id) return null;
  return { type, id };
}

export function normalizeDecisionsDecisionsPost(raw: unknown): DecisionsDecisionsPost {
  const record = raw && typeof raw === "object"
    ? raw as Record<string, unknown>
    : {};
  const rows = Array.isArray(record.rows)
    ? record.rows
      .map(normalizeRow)
      .filter((row): row is TierRow => row != null)
    : [...DEFAULT_TIER_ROWS];
  const placements = Array.isArray(record.placements)
    ? record.placements
      .map(normalizePlacement)
      .filter((item): item is TierPlacement => item != null)
    : [];
  const extraIds = Array.isArray(record.extra_ids)
    ? record.extra_ids
      .map(normalizeRef)
      .filter((item): item is DecisionsDecisionsResourceRef => item != null)
    : [];

  return {
    id: asString(record.id) ?? "",
    user_id: asString(record.user_id) ?? "",
    nickname: asString(record.nickname) ?? "",
    title: asString(record.title) ?? "",
    note: asString(record.note) ?? "",
    preset_key: isDecisionsDecisionsPresetKey(record.preset_key)
      ? String(record.preset_key)
      : CUSTOM_PRESET_KEY,
    game_version: asString(record.game_version) ?? DECISIONS_DECISIONS_GAME_VERSION,
    rows: rows.length > 0 ? rows : [...DEFAULT_TIER_ROWS],
    placements,
    extra_ids: extraIds,
    env: asString(record.env) ?? "",
    created_at: asString(record.created_at) ?? "",
    like_count: typeof record.like_count === "number" ? record.like_count : undefined,
    comment_count: typeof record.comment_count === "number"
      ? record.comment_count
      : undefined,
  };
}

export function cloneDefaultRows(): TierRow[] {
  return DEFAULT_TIER_ROWS.map((row) => ({ ...row }));
}

export function tierColorHex(color: TierColorKey): string {
  return tierColorBar(color).toLowerCase();
}

export function usedTierColorHexes(
  rows: readonly TierRow[],
  exceptRowId?: string,
): Set<string> {
  return new Set(
    rows
      .filter((row) => row.id !== exceptRowId)
      .map((row) => tierColorHex(row.color)),
  );
}

export function nextUnusedTierColor(rows: readonly TierRow[]): TierPaletteKey | null {
  const used = usedTierColorHexes(rows);
  return TIER_PALETTE_KEYS.find((key) => !used.has(tierColorHex(key))) ?? null;
}

export function namedPresetDefs(): DecisionsDecisionsPresetDef[] {
  return DECISIONS_DECISIONS_PRESET_DEFS.filter((preset) => preset.kind !== "custom");
}

export function emptyFilterDims(): DecisionsFilterDims {
  return {
    affiliation: new Set(),
    kind: new Set(),
    rarity: new Set(),
    act: new Set(),
  };
}

export function cloneFilterDims(dims: DecisionsFilterDims): DecisionsFilterDims {
  return {
    affiliation: new Set(dims.affiliation),
    kind: new Set(dims.kind),
    rarity: new Set(dims.rarity),
    act: new Set(dims.act),
  };
}

export function toggleFilterDim(
  dims: DecisionsFilterDims,
  dim: DecisionsFilterDim,
  key: string,
): DecisionsFilterDims {
  const next = cloneFilterDims(dims);
  if (next[dim].has(key)) next[dim].delete(key);
  else next[dim].add(key);
  return next;
}

export function dimsHaveSelection(dims: DecisionsFilterDims): boolean {
  return dims.affiliation.size > 0
    || dims.kind.size > 0
    || dims.rarity.size > 0
    || dims.act.size > 0;
}

export function namedPresetKeyFromFilter(
  major: DecisionsPoolMajor | null,
  dims: DecisionsFilterDims,
): string {
  if (!major) return CUSTOM_PRESET_KEY;
  if (dims.kind.size > 0 || dims.rarity.size > 0 || dims.act.size > 0) {
    return CUSTOM_PRESET_KEY;
  }
  if (major === "card") {
    if (dims.affiliation.size !== 1) return CUSTOM_PRESET_KEY;
    const key = `cards-${[...dims.affiliation][0]}`;
    return isDecisionsDecisionsPresetKey(key) ? key : CUSTOM_PRESET_KEY;
  }
  if (major === "relic") {
    if (dims.affiliation.size !== 1) return CUSTOM_PRESET_KEY;
    const key = `relics-${[...dims.affiliation][0]}`;
    return isDecisionsDecisionsPresetKey(key) ? key : CUSTOM_PRESET_KEY;
  }
  if (major === "potion") {
    if (dims.affiliation.size === 0) return "potions-all";
    if (dims.affiliation.size !== 1) return CUSTOM_PRESET_KEY;
    const key = `potions-${[...dims.affiliation][0]}`;
    return isDecisionsDecisionsPresetKey(key) ? key : CUSTOM_PRESET_KEY;
  }
  return CUSTOM_PRESET_KEY;
}

export function filterStateFromPresetKey(key: string): {
  major: DecisionsPoolMajor | null;
  dims: DecisionsFilterDims;
} {
  const dims = emptyFilterDims();
  const def = findPresetDef(key);
  if (def.kind === "custom") return { major: null, dims };
  if (def.kind === "cards") {
    dims.affiliation.add(def.color);
    return { major: "card", dims };
  }
  if (def.kind === "relics") {
    dims.affiliation.add(def.pool);
    return { major: "relic", dims };
  }
  return { major: "potion", dims };
}

function isPotionPoolValue(value: string): value is PotionPool | "all" {
  return (POTION_POOL_MINORS as readonly string[]).includes(value);
}

function isRelicRarity(value: string): value is RelicRarityKo {
  return (RELIC_RARITY_ORDER as readonly string[]).includes(value);
}

function isPotionRarity(value: string): value is PotionRarityKo {
  return (POTION_RARITY_ORDER as readonly string[]).includes(value);
}

function isPowerType(value: string): value is PowerType {
  return (POWER_TYPE_ORDER as readonly string[]).includes(value);
}

function isEnchantmentKind(value: string): value is EnchantmentCardTypeFilter {
  return (ENCHANTMENT_KIND_MINORS as readonly string[]).includes(value);
}

function isMonsterType(value: string): value is MonsterType {
  return (MONSTER_TYPE_ORDER as readonly string[]).includes(value);
}

function isKeywordSource(value: string): value is CodexKeywordSource {
  return (KEYWORD_KIND_MINORS as readonly string[]).includes(value);
}

function isModifierPolarity(value: string): value is ModifierPolarity {
  return (MODIFIER_POLARITY_ORDER as readonly string[]).includes(value);
}

function isEpochAffiliation(value: string): value is EpochAffiliation {
  return (EPOCH_AFFILIATION_ORDER as readonly string[]).includes(value);
}

function isCardKind(value: string): value is CardTypeKo {
  return (CARD_KIND_MINORS as readonly string[]).includes(value);
}

function actKey(act: EventAct | null | undefined): string {
  return act ?? "none";
}

function entityIsDeprecated(entity: EntityInfo): boolean {
  return Boolean(
    entity.cardData?.deprecated
    || entity.relicData?.deprecated
    || entity.potionData?.deprecated
    || entity.powerData?.deprecated
    || entity.enchantmentData?.deprecated
    || entity.eventData?.deprecated
    || entity.monsterData?.deprecated
    || entity.ancientData?.deprecated
    || entity.epochData?.deprecated
  );
}

function monsterActKeys(
  entity: EntityInfo,
  encounterActs: Map<string, Set<string>>,
): Set<string> {
  return encounterActs.get(entity.id) ?? new Set(["none"]);
}

export function encounterActKeysByMonster(
  entities: readonly EntityInfo[],
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const entity of entities) {
    if (entity.type !== "encounter" || !entity.encounterData) continue;
    const key = actKey(entity.encounterData.act);
    for (const monster of entity.encounterData.monsters ?? []) {
      const acts = map.get(monster.id) ?? new Set<string>();
      acts.add(key);
      map.set(monster.id, acts);
    }
  }
  return map;
}

function matchesAffiliation(
  entity: EntityInfo,
  major: DecisionsPoolMajor,
  keys: ReadonlySet<string>,
): boolean {
  if (keys.size === 0) return true;
  if (major === "card") {
    return [...keys].some((key) => (
      isCardFilterCategory(key) && isAffiliationCard(entity, key)
    ));
  }
  if (major === "relic") {
    return [...keys].some((key) => (
      isRelicAffiliation(key) && isAffiliationRelic(entity, key)
    ));
  }
  if (major === "potion") {
    return [...keys].some((key) => (
      isPotionPoolValue(key) && isPotion(entity, key)
    ));
  }
  if (major === "epoch") {
    const affiliations = entity.epochData?.affiliations ?? [];
    const primary = entity.epochData?.affiliation;
    return [...keys].some((key) => (
      isEpochAffiliation(key)
      && (affiliations.includes(key) || primary === key)
    ));
  }
  return true;
}

function matchesKind(entity: EntityInfo, major: DecisionsPoolMajor, keys: ReadonlySet<string>): boolean {
  if (keys.size === 0) return true;
  if (major === "card") {
    const type = entity.cardData?.type;
    return Boolean(type && [...keys].some((key) => isCardKind(key) && type === key));
  }
  if (major === "power") {
    const type = entity.powerData?.type;
    return Boolean(type && [...keys].some((key) => isPowerType(key) && type === key));
  }
  if (major === "enchantment") {
    const kind: EnchantmentCardTypeFilter = entity.enchantmentData?.cardType ?? "Any";
    return [...keys].some((key) => isEnchantmentKind(key) && kind === key);
  }
  if (major === "monster") {
    const type = entity.monsterData?.type;
    return Boolean(type && [...keys].some((key) => isMonsterType(key) && type === key));
  }
  if (major === "keyword") {
    const source = entity.keywordData?.source;
    return Boolean(source && [...keys].some((key) => isKeywordSource(key) && source === key));
  }
  if (major === "modifier") {
    const polarity = entity.modifierData?.polarity;
    return Boolean(polarity && [...keys].some((key) => isModifierPolarity(key) && polarity === key));
  }
  return true;
}

function matchesRarity(entity: EntityInfo, major: DecisionsPoolMajor, keys: ReadonlySet<string>): boolean {
  if (keys.size === 0) return true;
  if (major === "card") {
    const card = entity.cardData;
    if (!card) return false;
    return [...keys].some((key) => (
      key === "기타" ? isEtcRarity(card) : card.rarity === key
    ));
  }
  if (major === "relic") {
    const rarity = entity.relicData?.rarity;
    return Boolean(rarity && [...keys].some((key) => isRelicRarity(key) && rarity === key));
  }
  if (major === "potion") {
    const rarity = entity.potionData?.rarity;
    return Boolean(rarity && [...keys].some((key) => isPotionRarity(key) && rarity === key));
  }
  return true;
}

function matchesAct(
  entity: EntityInfo,
  major: DecisionsPoolMajor,
  keys: ReadonlySet<string>,
  encounterActs: Map<string, Set<string>>,
): boolean {
  if (keys.size === 0) return true;
  if (major === "event") {
    if (!entity.eventData) return false;
    const acts = getEventActs(entity.eventData).map(actKey);
    return acts.some((act) => keys.has(act));
  }
  if (major === "ancient") {
    return keys.has(actKey(entity.ancientData?.act));
  }
  if (major === "monster") {
    const acts = monsterActKeys(entity, encounterActs);
    return [...keys].some((key) => acts.has(key));
  }
  return true;
}

function matchesFilter(
  entity: EntityInfo,
  major: DecisionsPoolMajor,
  dims: DecisionsFilterDims,
  encounterActs: Map<string, Set<string>>,
): boolean {
  if (entity.type !== major || entityIsDeprecated(entity)) return false;
  return matchesAffiliation(entity, major, dims.affiliation)
    && matchesKind(entity, major, dims.kind)
    && matchesRarity(entity, major, dims.rarity)
    && matchesAct(entity, major, dims.act, encounterActs);
}

export function poolFilterIsReady(
  major: DecisionsPoolMajor | null,
  dims: DecisionsFilterDims,
): boolean {
  if (!major) return false;
  if (major === "card") return dimsHaveSelection(dims);
  return true;
}

export function stampFilterIds(
  entities: EntityInfo[],
  major: DecisionsPoolMajor | null,
  dims: DecisionsFilterDims,
): DecisionsDecisionsResourceRef[] {
  if (!poolFilterIsReady(major, dims) || !major) return [];
  const encounterActs = encounterActKeysByMonster(entities);
  return entities
    .filter((entity) => matchesFilter(entity, major, dims, encounterActs))
    .map(entityToResourceRef)
    .filter((ref): ref is DecisionsDecisionsResourceRef => ref != null);
}

export function reorderTierRows(
  rows: readonly TierRow[],
  fromId: string,
  toId: string,
): TierRow[] {
  if (fromId === toId) return [...rows];
  const from = rows.findIndex((row) => row.id === fromId);
  const to = rows.findIndex((row) => row.id === toId);
  if (from < 0 || to < 0) return [...rows];
  const next = [...rows];
  const [moved] = next.splice(from, 1);
  if (!moved) return [...rows];
  next.splice(to, 0, moved);
  return next;
}

export function placementText(
  post: Pick<DecisionsDecisionsPost, "rows" | "placements">,
  entitiesByKey: Map<string, EntityInfo>,
): string {
  const lines: string[] = [];
  for (const row of post.rows) {
    const names = post.placements
      .filter((item) => item.rowId === row.id)
      .toSorted((left, right) => left.sort - right.sort)
      .map((item) => entitiesByKey.get(resourceKey(item))?.nameKo ?? item.id);
    lines.push(`${row.label}: ${names.join(", ")}`);
  }
  return lines.join("\n");
}

import type { EntityInfo, EntityType } from "@/components/patch-note-renderer";
import {
  CHARACTER_COLORS,
  type CardColor,
  type CardTypeKo,
  type PotionPool,
  type RelicPool,
} from "@/lib/codex-types";
import sts2Meta from "../../data/sts2/meta.json";

export const DECISIONS_DECISIONS_HREF = "/decisions-decisions";
export const DECISIONS_DECISIONS_TOKEN_SRC =
  "/images/sts2/potions/skill_potion.webp";
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
  "card",
  "relic",
  "potion",
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

const SPIRE_TIER_BAR: Record<SpireTierColorKey, string> = {
  gold: "#d4a843",
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

const CUSTOM_PRESET_KEY = "custom";

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

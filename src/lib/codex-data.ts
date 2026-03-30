import fs from "fs/promises";
import path from "path";
import {
  CodexCard,
  CodexCharacter,
  CodexRelic,
  CodexPotion,
  CardColor,
  RelicRarityKo,
  RelicPool,
  PotionRarityKo,
  PotionPool,
} from "./codex-types";
import type { EntityVersionDiff, EntityFieldDiff, STS2Patch, CodexMeta } from "./types";

const DATA_DIR = path.join(process.cwd(), "data/spire-codex");

// Raw spire-codex JSON card shape
interface RawCard {
  id: string;
  name: string;
  description: string;
  description_raw: string;
  vars: Record<string, number> | null;
  cost: number;
  is_x_cost: boolean | null;
  is_x_star_cost: boolean | null;
  star_cost: number | null;
  type: string;
  rarity: string;
  color: string;
  damage: number | null;
  block: number | null;
  hit_count: number | null;
  keywords: string[] | null;
  tags: string[] | null;
  upgrade: Record<string, string | number> | null;
  image_url: string | null;
  beta_image_url: string | null;
}

interface RawCharacter {
  id: string;
  name: string;
  color: string;
  image_url: string;
}

function spireCodexImageToLocal(url: string | null): string | null {
  if (!url) return null;
  // /static/images/cards/abrasive.png -> /images/spire-codex/cards/abrasive.png
  // /static/images/cards/beta/abrasive.png -> /images/spire-codex/cards-beta/abrasive.png
  const match = url.match(/\/static\/images\/(.+)/);
  if (!match) return null;
  const relativePath = match[1];
  // Map cards/beta/ subdirectory to cards-beta/
  const mapped = relativePath.replace(/^cards\/beta\//, "cards-beta/");
  return `/images/spire-codex/${mapped}`;
}

function mapCard(kor: RawCard, eng: RawCard): CodexCard {
  return {
    id: kor.id,
    name: kor.name,
    nameEn: eng.name,
    description: kor.description,
    descriptionRaw: kor.description_raw,
    vars: kor.vars ?? {},
    cost: kor.cost,
    isXCost: kor.is_x_cost ?? false,
    isXStarCost: kor.is_x_star_cost ?? false,
    starCost: kor.star_cost,
    type: kor.type as CodexCard["type"],
    rarity: kor.rarity as CodexCard["rarity"],
    color: kor.color as CardColor,
    damage: kor.damage,
    block: kor.block,
    hitCount: kor.hit_count,
    keywords: kor.keywords ?? [],
    tags: kor.tags ?? [],
    upgrade: kor.upgrade,
    imageUrl: spireCodexImageToLocal(kor.image_url),
    betaImageUrl: spireCodexImageToLocal(kor.beta_image_url),
  };
}

async function readJson<T>(relativePath: string): Promise<T> {
  const filePath = path.join(DATA_DIR, relativePath);
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

export async function getCodexCards(): Promise<CodexCard[]> {
  const [korCards, engCards] = await Promise.all([
    readJson<RawCard[]>("kor/cards.json"),
    readJson<RawCard[]>("eng/cards.json"),
  ]);

  const engById = new Map(engCards.map((c) => [c.id, c]));

  return korCards
    .filter((c) => c.image_url) // exclude cards without images
    .map((kor) => {
      const eng = engById.get(kor.id) ?? kor;
      return mapCard(kor, eng);
    });
}

// Raw spire-codex JSON relic shape
interface RawRelic {
  id: string;
  name: string;
  description: string;
  description_raw: string;
  flavor: string;
  rarity: string;
  pool: string;
  image_url: string | null;
}

function mapRelic(kor: RawRelic, eng: RawRelic): CodexRelic {
  return {
    id: kor.id,
    name: kor.name,
    nameEn: eng.name,
    description: kor.description,
    descriptionRaw: kor.description_raw,
    flavor: kor.flavor,
    rarity: kor.rarity as RelicRarityKo,
    pool: kor.pool as RelicPool,
    imageUrl: spireCodexImageToLocal(kor.image_url),
  };
}

export async function getCodexRelics(): Promise<CodexRelic[]> {
  const [korRelics, engRelics] = await Promise.all([
    readJson<RawRelic[]>("kor/relics.json"),
    readJson<RawRelic[]>("eng/relics.json"),
  ]);

  const engById = new Map(engRelics.map((r) => [r.id, r]));

  return korRelics.map((kor) => {
    const eng = engById.get(kor.id) ?? kor;
    return mapRelic(kor, eng);
  });
}

// Raw spire-codex JSON potion shape
interface RawPotion {
  id: string;
  name: string;
  description: string;
  description_raw: string;
  rarity: string;
  pool: string;
  image_url: string;
}

function mapPotion(kor: RawPotion, eng: RawPotion): CodexPotion {
  return {
    id: kor.id,
    name: kor.name,
    nameEn: eng.name,
    description: kor.description,
    descriptionRaw: kor.description_raw,
    rarity: kor.rarity as PotionRarityKo,
    pool: kor.pool as PotionPool,
    imageUrl: spireCodexImageToLocal(kor.image_url) ?? "",
  };
}

export async function getCodexPotions(): Promise<CodexPotion[]> {
  const [korPotions, engPotions] = await Promise.all([
    readJson<RawPotion[]>("kor/potions.json"),
    readJson<RawPotion[]>("eng/potions.json"),
  ]);

  const engById = new Map(engPotions.map((p) => [p.id, p]));

  return korPotions.map((kor) => {
    const eng = engById.get(kor.id) ?? kor;
    return mapPotion(kor, eng);
  });
}

// Game order for characters
const CHARACTER_ORDER = ["IRONCLAD", "SILENT", "DEFECT", "NECROBINDER", "REGENT"];

export async function getCodexCharacters(): Promise<CodexCharacter[]> {
  const raw = await readJson<RawCharacter[]>("kor/characters.json");

  const mapped = raw.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color as CodexCharacter["color"],
    imageUrl: spireCodexImageToLocal(c.image_url) ?? "",
  }));

  // Sort by game order
  mapped.sort((a, b) => {
    const ai = CHARACTER_ORDER.indexOf(a.id);
    const bi = CHARACTER_ORDER.indexOf(b.id);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return mapped;
}

// =============================================================================
// Entity versioning — reconstruct past versions via backward diff application
// =============================================================================

/**
 * Compare two version strings (e.g. "0.100.0" vs "0.101.0").
 * Returns negative if a < b, positive if a > b, 0 if equal.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map(Number);
  const pb = b.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Normalize version string to "v0.101.0" form */
function normalizeVersion(v: string): string {
  return v.startsWith("v") ? v : `v${v}`;
}

/**
 * Apply a single field diff in reverse (after→before) to an entity object.
 * Supports dot-notation paths like "vars.Damage" or "upgrade.cost".
 */
function applyReverseDiff(entity: Record<string, unknown>, diff: EntityFieldDiff): void {
  const parts = diff.field.split(".");
  if (parts.length === 1) {
    // Simple field — full replacement with "before" value
    entity[parts[0]] = diff.before;
  } else {
    // Nested field (e.g. "vars.Damage")
    const parent = entity[parts[0]];
    if (parent && typeof parent === "object") {
      const nested = { ...(parent as Record<string, unknown>) };
      nested[parts[1]] = diff.before;
      entity[parts[0]] = nested;
    }
  }
}

/**
 * Get patches that occurred between targetVersion (exclusive) and currentVersion (inclusive),
 * sorted descending (newest first) for backward reconstruction.
 */
function getPatchesBetween(
  targetVersion: string,
  currentVersion: string,
  patches: STS2Patch[],
): STS2Patch[] {
  const target = normalizeVersion(targetVersion);
  const current = normalizeVersion(currentVersion);

  return patches
    .filter((p) => {
      const pv = normalizeVersion(p.version);
      // Include patches that are > target and <= current
      return compareVersions(pv, target) > 0 && compareVersions(pv, current) <= 0;
    })
    .sort((a, b) => compareVersions(b.version, a.version)); // newest first
}

/**
 * Reconstruct a card at a specific version by applying reverse diffs.
 * Returns a new card object (does not mutate the original).
 */
export function reconstructCardAtVersion(
  card: CodexCard,
  targetVersion: string,
  currentVersion: string,
  versionDiffs: EntityVersionDiff[],
  patches: STS2Patch[],
): CodexCard {
  if (compareVersions(normalizeVersion(targetVersion), normalizeVersion(currentVersion)) >= 0) {
    return card; // Target is current or newer
  }

  const patchesToRevert = getPatchesBetween(targetVersion, currentVersion, patches);
  const result: Record<string, unknown> = { ...card };

  // Deep-copy mutable fields
  result.vars = { ...(card.vars ?? {}) };
  result.upgrade = card.upgrade ? { ...card.upgrade } : null;
  result.keywords = [...(card.keywords ?? [])];
  result.tags = [...(card.tags ?? [])];

  for (const patch of patchesToRevert) {
    const diffs = versionDiffs.filter(
      (d) => d.entityType === "card" && d.entityId === card.id && d.patch === normalizeVersion(patch.version),
    );
    for (const vd of diffs) {
      for (const diff of vd.diffs) {
        if (!diff.upgraded) {
          applyReverseDiff(result, diff);
        }
      }
    }
  }

  return result as unknown as CodexCard;
}

/**
 * Reconstruct a relic at a specific version.
 */
export function reconstructRelicAtVersion(
  relic: CodexRelic,
  targetVersion: string,
  currentVersion: string,
  versionDiffs: EntityVersionDiff[],
  patches: STS2Patch[],
): CodexRelic {
  if (compareVersions(normalizeVersion(targetVersion), normalizeVersion(currentVersion)) >= 0) {
    return relic;
  }

  const patchesToRevert = getPatchesBetween(targetVersion, currentVersion, patches);
  const result: Record<string, unknown> = { ...relic };

  for (const patch of patchesToRevert) {
    const diffs = versionDiffs.filter(
      (d) => d.entityType === "relic" && d.entityId === relic.id && d.patch === normalizeVersion(patch.version),
    );
    for (const vd of diffs) {
      for (const diff of vd.diffs) {
        applyReverseDiff(result, diff);
      }
    }
  }

  return result as unknown as CodexRelic;
}

/**
 * Get the list of patch versions that have entity version diffs,
 * sorted from newest to oldest.
 */
export function getVersionsWithDiffs(
  patches: STS2Patch[],
  versionDiffs: EntityVersionDiff[],
): string[] {
  const patchVersionsWithDiffs = new Set(versionDiffs.map((d) => d.patch));
  // Always include the current (latest) version
  const allVersions = patches
    .filter((p) => p.hasBalanceChanges || patchVersionsWithDiffs.has(normalizeVersion(p.version)))
    .map((p) => p.version)
    .sort((a, b) => compareVersions(b, a)); // newest first

  return allVersions;
}

import { bakeDescription } from "./codex-bake";
import type { CodexCard, CodexRelic, CodexPotion, CodexEvent } from "./codex-types";
import type { EntityVersionDiff, EntityFieldDiff, STS2Patch, VersionedEntityType } from "./types";

/** Combat-only card vars. The loader omits these when baking library text. */
const CARD_RUNTIME_DESCRIPTION_VARS: Record<string, readonly string[]> = {
  TIMES_UP: ["CalculatedDamage"],
};

export function resolveKnownVersion(
  requested: string | null | undefined,
  versions: readonly string[],
): string | null {
  if (!requested) return null;
  const normalized = requested.replace(/^v/i, "");
  const match = versions.find((version) => compareVersions(version, normalized) === 0);
  return match ? match.replace(/^v/i, "") : null;
}

function isGameVersion(version: string): boolean {
  return /^v?\d+\.\d+(?:\.\d+)*$/i.test(version);
}

export function latestPatchVersion(patches: readonly { version: string }[]): string {
  return patches.reduce((latest, patch) => {
    if (!isGameVersion(patch.version)) return latest;
    return !latest || compareVersions(patch.version, latest) > 0 ? patch.version : latest;
  }, "");
}

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

function isDescriptionField(field: string): boolean {
  return field === "description" || field.startsWith("description.");
}

export function varsForBake(
  entityType: VersionedEntityType,
  id: unknown,
  vars: unknown,
): Record<string, number | string> {
  if (!vars || typeof vars !== "object" || Array.isArray(vars)) return {};
  const baked: Record<string, number | string> = {};
  for (const [key, value] of Object.entries(vars)) {
    if (typeof value === "number" || typeof value === "string") baked[key] = value;
  }
  if (entityType === "card" && typeof id === "string") {
    for (const key of CARD_RUNTIME_DESCRIPTION_VARS[id] ?? []) delete baked[key];
  }
  return baked;
}

/**
 * Number-only patches often store `vars` without a new baked `description`.
 * Library tiles paint `description`, so rebuild it from the historical template
 * unless a reverted patch already supplied the description string.
 */
function syncBakedDescription(
  entity: Record<string, unknown>,
  entityType: VersionedEntityType,
  snapshot: { descriptionRaw: unknown; varsJson: string },
  descriptionDiffApplied: boolean,
): void {
  if (descriptionDiffApplied) return;
  if (typeof entity.descriptionRaw !== "string" || entity.descriptionRaw.length === 0) return;
  const varsJson = JSON.stringify(entity.vars ?? null);
  if (entity.descriptionRaw === snapshot.descriptionRaw && varsJson === snapshot.varsJson) return;
  entity.description = bakeDescription(
    entity.descriptionRaw,
    varsForBake(entityType, entity.id, entity.vars),
  );
}

/**
 * The English companion of syncBakedDescription: when the English template was
 * reverted without a baked descriptionEn diff, bake it again.
 */
function syncBakedEnglishDescription(
  entity: Record<string, unknown>,
  entityType: VersionedEntityType,
  snapshotRawEn: unknown,
  descriptionEnDiffApplied: boolean,
): void {
  if (descriptionEnDiffApplied) return;
  if (typeof entity.descriptionRawEn !== "string" || entity.descriptionRawEn.length === 0) return;
  if (entity.descriptionRawEn === snapshotRawEn) return;
  entity.descriptionEn = bakeDescription(
    entity.descriptionRawEn,
    varsForBake(entityType, entity.id, entity.vars),
  );
}

/**
 * Apply a single field diff in reverse (after→before) to an entity object.
 * Supports dot-notation paths like "vars.Damage" or "upgrade.cost".
 */
/** Set on an entity reconstructed to a version whose own text is not known. */
export const VERSION_TEXT_UNPINNED_FIELD = "versionTextUnpinned";

/**
 * Lifecycle fields describe when an entity exists, not its state at a version.
 * Reverting them would erase `introducedInPatch` and make an entity look
 * available before it was added.
 */
const LIFECYCLE_FIELDS = new Set(["introducedInPatch", "deprecated", "deprecatedInPatch"]);

function applyReverseDiff(entity: Record<string, unknown>, diff: EntityFieldDiff): void {
  if (LIFECYCLE_FIELDS.has(diff.field)) return;
  const parts = diff.field.split(".");
  if (parts.length === 1) {
    // Simple field — full replacement with "before" value
    entity[parts[0]] =
      diff.before && typeof diff.before === "object"
        ? Array.isArray(diff.before)
          ? [...diff.before]
          : { ...(diff.before as Record<string, unknown>) }
        : diff.before;
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
  if (relic.vars && typeof relic.vars === "object") {
    result.vars = { ...(relic.vars as Record<string, unknown>) };
  }

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
 * Reconstruct a potion at a specific version.
 */
export function reconstructPotionAtVersion(
  potion: CodexPotion,
  targetVersion: string,
  currentVersion: string,
  versionDiffs: EntityVersionDiff[],
  patches: STS2Patch[],
): CodexPotion {
  if (compareVersions(normalizeVersion(targetVersion), normalizeVersion(currentVersion)) >= 0) {
    return potion;
  }

  const patchesToRevert = getPatchesBetween(targetVersion, currentVersion, patches);
  const result: Record<string, unknown> = { ...potion };
  if (potion.vars && typeof potion.vars === "object") {
    result.vars = { ...(potion.vars as Record<string, unknown>) };
  }

  for (const patch of patchesToRevert) {
    const diffs = versionDiffs.filter(
      (d) => d.entityType === "potion" && d.entityId === potion.id && d.patch === normalizeVersion(patch.version),
    );
    for (const vd of diffs) {
      for (const diff of vd.diffs) {
        applyReverseDiff(result, diff);
      }
    }
  }

  return result as unknown as CodexPotion;
}

/**
 * Reconstruct an event at a specific version.
 * Deep-copies options and pages arrays since they are mutable.
 */
export function reconstructEventAtVersion(
  event: CodexEvent,
  targetVersion: string,
  currentVersion: string,
  versionDiffs: EntityVersionDiff[],
  patches: STS2Patch[],
): CodexEvent {
  if (compareVersions(normalizeVersion(targetVersion), normalizeVersion(currentVersion)) >= 0) {
    return event;
  }

  const patchesToRevert = getPatchesBetween(targetVersion, currentVersion, patches);
  const result: Record<string, unknown> = { ...event };

  // Deep-copy mutable fields
  if (event.options) {
    result.options = event.options.map((o) => ({ ...o }));
  }
  if (event.acts) {
    result.acts = [...event.acts];
  }
  if (event.pages) {
    result.pages = event.pages.map((p) => ({
      ...p,
      options: p.options ? p.options.map((o) => ({ ...o })) : null,
    }));
  }

  for (const patch of patchesToRevert) {
    const diffs = versionDiffs.filter(
      (d) => d.entityType === "event" && d.entityId === event.id && d.patch === normalizeVersion(patch.version),
    );
    for (const vd of diffs) {
      for (const diff of vd.diffs) {
        applyReverseDiff(result, diff);
      }
    }
  }

  return result as unknown as CodexEvent;
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
  // Include: release (base), patches with balance changes, patches with version diffs
  const allVersions = patches
    .filter((p) =>
      p.type === "release" ||
      p.hasBalanceChanges ||
      patchVersionsWithDiffs.has(normalizeVersion(p.version)),
    )
    .map((p) => p.version)
    .sort((a, b) => compareVersions(b, a)); // newest first

  return allVersions;
}

/**
 * Generic entity version reconstruction.
 * Works for any entity type — if no diffs exist, returns the entity unchanged.
 */
export function reconstructEntityAtVersion<T extends { id: string }>(
  entity: T,
  entityType: VersionedEntityType,
  targetVersion: string,
  currentVersion: string,
  versionDiffs: EntityVersionDiff[],
  patches: STS2Patch[],
): T {
  if (compareVersions(normalizeVersion(targetVersion), normalizeVersion(currentVersion)) >= 0) {
    return entity;
  }

  const patchesToRevert = getPatchesBetween(targetVersion, currentVersion, patches);
  const result: Record<string, unknown> = { ...entity };

  // Deep-copy common mutable fields if they exist
  if ("vars" in entity && entity.vars && typeof entity.vars === "object") {
    result.vars = { ...(entity.vars as Record<string, unknown>) };
  }
  if ("upgrade" in entity && entity.upgrade && typeof entity.upgrade === "object") {
    result.upgrade = { ...(entity.upgrade as Record<string, unknown>) };
  }
  if ("keywords" in entity && Array.isArray(entity.keywords)) {
    result.keywords = [...entity.keywords];
  }
  if ("tags" in entity && Array.isArray(entity.tags)) {
    result.tags = [...entity.tags];
  }
  if ("damageValues" in entity && entity.damageValues && typeof entity.damageValues === "object") {
    result.damageValues = { ...(entity.damageValues as Record<string, unknown>) };
  }
  if ("blockValues" in entity && entity.blockValues && typeof entity.blockValues === "object") {
    result.blockValues = { ...(entity.blockValues as Record<string, unknown>) };
  }
  // Monster structures are replaced wholesale by their diffs; copy so reverted
  // results never share arrays with the cached current entity.
  for (const key of ["moves", "bestiaryMoves", "initialPowerApplications"]) {
    if (key in entity && Array.isArray((entity as Record<string, unknown>)[key])) {
      result[key] = [...((entity as Record<string, unknown>)[key] as unknown[])];
    }
  }
  if ("moveGraph" in entity && entity.moveGraph && typeof entity.moveGraph === "object") {
    result.moveGraph = { ...(entity.moveGraph as Record<string, unknown>) };
  }
  if ("options" in entity && Array.isArray(entity.options)) {
    result.options = entity.options.map((option) => (
      option && typeof option === "object" ? { ...(option as Record<string, unknown>) } : option
    ));
  }

  const bakedSnapshot = {
    descriptionRaw: result.descriptionRaw,
    varsJson: JSON.stringify(result.vars ?? null),
  };
  const snapshotRawEn = result.descriptionRawEn;
  let descriptionDiffApplied = false;
  let descriptionEnDiffApplied = false;

  for (const patch of patchesToRevert) {
    const diffs = versionDiffs.filter(
      (d) => d.entityType === entityType && d.entityId === entity.id && d.patch === normalizeVersion(patch.version),
    );
    for (const vd of diffs) {
      for (const diff of vd.diffs) {
        if (!diff.upgraded) {
          if (isDescriptionField(diff.field)) descriptionDiffApplied = true;
          if (diff.field === "descriptionEn") descriptionEnDiffApplied = true;
          applyReverseDiff(result, diff);
        }
      }
    }
  }

  syncBakedDescription(result, entityType, bakedSnapshot, descriptionDiffApplied);
  syncBakedEnglishDescription(result, entityType, snapshotRawEn, descriptionEnDiffApplied);
  if (usesVariablesTheVersionLacks(entity as Record<string, unknown>, result)) {
    result[VERSION_TEXT_UNPINNED_FIELD] = true;
  }

  return result as unknown as T;
}

/**
 * True when the template still names a variable the entity has today but not
 * at the reconstructed version. That text came from a later version (no diff
 * restored the old wording), and baking it leaves "X".
 */
function usesVariablesTheVersionLacks(current: Record<string, unknown>, reconstructed: Record<string, unknown>): boolean {
  const raw = reconstructed.descriptionRaw;
  if (typeof raw !== "string") return false;
  const currentVars = (current.vars ?? {}) as Record<string, unknown>;
  const versionVars = (reconstructed.vars ?? {}) as Record<string, unknown>;
  for (const [, name] of raw.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)/g)) {
    if (currentVars[name] != null && versionVars[name] == null) return true;
  }
  return false;
}

import type { CodexCard, CodexRelic } from "./codex-types";
import type { EntityVersionDiff, EntityFieldDiff, STS2Patch } from "./types";

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

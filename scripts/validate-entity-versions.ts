#!/usr/bin/env npx tsx
/**
 * validate-entity-versions.ts
 *
 * Validates the integrity of the backward compaction data pipeline.
 * Catches baseline drift, broken diff chains, and orphaned diffs.
 *
 * Usage: npx tsx scripts/validate-entity-versions.ts
 * Exit code: 0 = pass (warnings OK), 1 = errors found
 */

import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EntityFieldDiff {
  field: string;
  before: unknown;
  after: unknown;
  upgraded?: boolean;
}

interface EntityVersionDiff {
  entityType: "card" | "relic" | "potion";
  entityId: string;
  patch: string;
  diffs: EntityFieldDiff[];
}

interface STS2Patch {
  id: string;
  version: string;
  hasBalanceChanges: boolean;
}

interface CodexMeta {
  version: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJson<T>(relPath: string): T {
  const fullPath = path.join(process.cwd(), relPath);
  return JSON.parse(fs.readFileSync(fullPath, "utf-8"));
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (a === undefined || b === undefined) return a === b;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }

  if (typeof a === "object" && typeof b === "object") {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);
    for (const key of keys) {
      if (!deepEqual(aObj[key], bObj[key])) return false;
    }
    return true;
  }

  return false;
}

function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map(Number);
  const pb = b.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Map camelCase diff field to snake_case JSON field */
const FIELD_TO_RAW: Record<string, string> = {
  cost: "cost",
  type: "type",
  rarity: "rarity",
  description: "description",
  descriptionRaw: "description_raw",
  damage: "damage",
  block: "block",
  hitCount: "hit_count",
  starCost: "star_cost",
  isXCost: "is_x_cost",
  isXStarCost: "is_x_star_cost",
  vars: "vars",
  keywords: "keywords",
  tags: "tags",
  upgrade: "upgrade",
  pool: "pool",
  flavor: "flavor",
};

/** Get a value from a raw entity by camelCase field path */
function getField(entity: Record<string, unknown>, camelField: string): unknown {
  const parts = camelField.split(".");
  const rawField = FIELD_TO_RAW[parts[0]] ?? parts[0];

  if (parts.length === 1) {
    return entity[rawField];
  }

  // Nested: "vars.Damage" -> entity.vars.Damage
  const parent = entity[rawField];
  if (parent && typeof parent === "object") {
    return (parent as Record<string, unknown>)[parts[1]];
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const meta = readJson<CodexMeta>("data/sts2/meta.json");
  const patches = readJson<STS2Patch[]>("data/sts2-patches.json");
  const diffs = readJson<EntityVersionDiff[]>("data/sts2-entity-versions.json");

  const cards = readJson<Record<string, unknown>[]>("data/sts2/kor/cards.json");
  const relics = readJson<Record<string, unknown>[]>("data/sts2/kor/relics.json");
  const potions = readJson<Record<string, unknown>[]>("data/sts2/kor/potions.json");

  const baselineMap: Record<string, Map<string, Record<string, unknown>>> = {
    card: new Map(cards.map((c) => [c.id as string, c])),
    relic: new Map(relics.map((r) => [r.id as string, r])),
    potion: new Map(potions.map((p) => [p.id as string, p])),
  };

  let errors = 0;
  let warnings = 0;

  const currentVersion = `v${meta.version}`;
  console.log(`Baseline version: ${currentVersion}`);
  console.log(`Patches: ${patches.length}, Entity diffs: ${diffs.length}\n`);

  // ── Check 1: Baseline-latest consistency ──
  // For the latest patch that touches each entity, "after" must match baseline
  console.log("=== Check 1: Baseline matches latest diff 'after' values ===");

  // Group diffs by entity, find latest patch per entity
  const entityDiffs = new Map<string, EntityVersionDiff[]>();
  for (const d of diffs) {
    const key = `${d.entityType}:${d.entityId}`;
    if (!entityDiffs.has(key)) entityDiffs.set(key, []);
    entityDiffs.get(key)!.push(d);
  }

  for (const [key, eDiffs] of entityDiffs) {
    // Sort by patch version, newest first
    const sorted = eDiffs.sort((a, b) => compareVersions(b.patch, a.patch));
    const latest = sorted[0];

    // Only check if the latest patch matches current version
    if (compareVersions(latest.patch, currentVersion) !== 0) continue;

    const baseline = baselineMap[latest.entityType]?.get(latest.entityId);
    if (!baseline) continue;

    for (const fieldDiff of latest.diffs) {
      if (fieldDiff.upgraded) continue; // skip upgrade-only diffs
      const actual = getField(baseline, fieldDiff.field);
      if (!deepEqual(actual, fieldDiff.after)) {
        console.error(
          `  [ERROR] ${key}.${fieldDiff.field}: baseline=${JSON.stringify(actual)}, expected=${JSON.stringify(fieldDiff.after)}`
        );
        errors++;
      }
    }
  }

  if (errors === 0) console.log("  All baseline values match latest diffs.\n");
  else console.log();

  // ── Check 2: Diff chain integrity ──
  console.log("=== Check 2: Diff chain integrity (before[N] == after[N-1]) ===");

  for (const [key, eDiffs] of entityDiffs) {
    // Sort by patch version ascending
    const sorted = eDiffs.sort((a, b) => compareVersions(a.patch, b.patch));

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      for (const currDiff of curr.diffs) {
        const prevDiff = prev.diffs.find((d) => d.field === currDiff.field);
        if (prevDiff && !deepEqual(prevDiff.after, currDiff.before)) {
          console.error(
            `  [ERROR] ${key}.${currDiff.field}: ${prev.patch}.after=${JSON.stringify(prevDiff.after)} != ${curr.patch}.before=${JSON.stringify(currDiff.before)}`
          );
          errors++;
        }
      }
    }
  }

  if (errors === 0) console.log("  All diff chains are consistent.\n");
  else console.log();

  // ── Check 3: Orphan detection ──
  console.log("=== Check 3: Orphan detection ===");

  for (const d of diffs) {
    const baseline = baselineMap[d.entityType]?.get(d.entityId);
    if (!baseline) {
      console.warn(`  [WARN] Orphaned diff: ${d.entityType}:${d.entityId} (patch ${d.patch}) not in baseline`);
      warnings++;
    }
  }

  if (warnings === 0) console.log("  No orphaned diffs found.\n");
  else console.log();

  // ── Check 4: Field path validation ──
  console.log("=== Check 4: Field path validation ===");

  const validCardFields = new Set([
    "cost", "type", "rarity", "description", "descriptionRaw",
    "damage", "block", "hitCount", "starCost", "isXCost", "isXStarCost",
    "vars", "keywords", "tags", "upgrade",
  ]);
  const validRelicFields = new Set([
    "description", "descriptionRaw", "rarity", "pool", "flavor",
  ]);
  const validPotionFields = new Set([
    "description", "descriptionRaw", "rarity", "pool",
  ]);

  const fieldSets: Record<string, Set<string>> = {
    card: validCardFields,
    relic: validRelicFields,
    potion: validPotionFields,
  };

  for (const d of diffs) {
    const validFields = fieldSets[d.entityType];
    if (!validFields) continue;

    for (const fieldDiff of d.diffs) {
      const topField = fieldDiff.field.split(".")[0];
      if (!validFields.has(topField)) {
        console.error(
          `  [ERROR] Invalid field path: ${d.entityType}:${d.entityId}.${fieldDiff.field}`
        );
        errors++;
      }
    }
  }

  if (errors === 0) console.log("  All field paths valid.\n");
  else console.log();

  // ── Summary ──
  console.log("=== Summary ===");
  console.log(`Errors: ${errors}`);
  console.log(`Warnings: ${warnings}`);

  if (errors > 0) {
    console.error("\nValidation FAILED.");
    process.exit(1);
  } else {
    console.log("\nValidation PASSED.");
  }
}

main();

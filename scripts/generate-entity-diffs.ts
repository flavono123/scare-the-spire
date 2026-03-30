#!/usr/bin/env npx tsx
/**
 * generate-entity-diffs.ts
 *
 * Compares old (backup) vs new (current) STS2 codex data and generates
 * EntityVersionDiff entries for the backward compaction system.
 *
 * Usage:
 *   npx tsx scripts/generate-entity-diffs.ts --old data/sts2-old --new data/sts2 --patch v0.102.0
 *
 * The script:
 * 1. Reads old and new cards/relics/potions JSON (kor language, which is the primary)
 * 2. Compares field-by-field using the normalized CodexCard/CodexRelic/CodexPotion shapes
 * 3. Outputs EntityVersionDiff[] to stdout (or appends to sts2-entity-versions.json with --write)
 */

import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Types (mirrored from src/lib/types.ts to keep script standalone)
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

// ---------------------------------------------------------------------------
// Raw JSON shapes from STS2 data files (snake_case)
// ---------------------------------------------------------------------------

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

interface RawPotion {
  id: string;
  name: string;
  description: string;
  description_raw: string;
  rarity: string;
  pool: string;
  image_url: string;
}

// ---------------------------------------------------------------------------
// Comparison helpers
// ---------------------------------------------------------------------------

/** Deep equality check for JSON-serializable values */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
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

// ---------------------------------------------------------------------------
// Card diff — fields that matter for backward compaction
// ---------------------------------------------------------------------------

// Fields to compare for cards (matching what entity-versioning.ts can reconstruct)
const CARD_SIMPLE_FIELDS = [
  "cost",
  "type",
  "rarity",
  "description",
  "description_raw",
  "damage",
  "block",
  "hit_count",
  "star_cost",
  "is_x_cost",
  "is_x_star_cost",
] as const;

// Map from raw snake_case field to the camelCase field used in EntityVersionDiff
const CARD_FIELD_MAP: Record<string, string> = {
  cost: "cost",
  type: "type",
  rarity: "rarity",
  description: "description",
  description_raw: "descriptionRaw",
  damage: "damage",
  block: "block",
  hit_count: "hitCount",
  star_cost: "starCost",
  is_x_cost: "isXCost",
  is_x_star_cost: "isXStarCost",
};

function diffCards(oldCard: RawCard, newCard: RawCard): EntityFieldDiff[] {
  const diffs: EntityFieldDiff[] = [];

  // Simple fields
  for (const field of CARD_SIMPLE_FIELDS) {
    const oldVal = oldCard[field];
    const newVal = newCard[field];
    if (!deepEqual(oldVal, newVal)) {
      diffs.push({
        field: CARD_FIELD_MAP[field],
        before: oldVal,
        after: newVal,
      });
    }
  }

  // vars (Record<string, number>) — compare as whole object if keys changed, or per-key
  const oldVars = oldCard.vars ?? {};
  const newVars = newCard.vars ?? {};
  const allVarKeys = new Set([...Object.keys(oldVars), ...Object.keys(newVars)]);
  const varKeysChanged = !deepEqual(new Set(Object.keys(oldVars)), new Set(Object.keys(newVars)));

  if (varKeysChanged) {
    // Whole vars object changed (e.g. rework: different var names)
    if (!deepEqual(oldVars, newVars)) {
      diffs.push({ field: "vars", before: oldVars, after: newVars });
    }
  } else {
    // Same keys — diff individual values
    for (const key of allVarKeys) {
      if (!deepEqual(oldVars[key], newVars[key])) {
        diffs.push({ field: `vars.${key}`, before: oldVars[key], after: newVars[key] });
      }
    }
  }

  // keywords (string[])
  const oldKw = oldCard.keywords ?? [];
  const newKw = newCard.keywords ?? [];
  if (!deepEqual(oldKw, newKw)) {
    diffs.push({ field: "keywords", before: oldKw, after: newKw });
  }

  // tags (string[])
  const oldTags = oldCard.tags ?? [];
  const newTags = newCard.tags ?? [];
  if (!deepEqual(oldTags, newTags)) {
    diffs.push({ field: "tags", before: oldTags, after: newTags });
  }

  // upgrade (Record<string, string|number> | null) — compare as whole object if keys differ
  const oldUpgrade = oldCard.upgrade;
  const newUpgrade = newCard.upgrade;
  if (!deepEqual(oldUpgrade, newUpgrade)) {
    const oldKeys = oldUpgrade ? Object.keys(oldUpgrade) : [];
    const newKeys = newUpgrade ? Object.keys(newUpgrade) : [];
    const keysChanged = !deepEqual(new Set(oldKeys), new Set(newKeys));

    if (keysChanged || oldUpgrade === null || newUpgrade === null) {
      // Whole upgrade object changed
      diffs.push({ field: "upgrade", before: oldUpgrade, after: newUpgrade });
    } else {
      // Same keys — diff per-key
      for (const key of new Set([...oldKeys, ...newKeys])) {
        if (!deepEqual(oldUpgrade![key], newUpgrade![key])) {
          diffs.push({ field: `upgrade.${key}`, before: oldUpgrade![key], after: newUpgrade![key] });
        }
      }
    }
  }

  return diffs;
}

// ---------------------------------------------------------------------------
// Relic diff
// ---------------------------------------------------------------------------

const RELIC_SIMPLE_FIELDS = ["description", "description_raw", "rarity", "pool", "flavor"] as const;
const RELIC_FIELD_MAP: Record<string, string> = {
  description: "description",
  description_raw: "descriptionRaw",
  rarity: "rarity",
  pool: "pool",
  flavor: "flavor",
};

function diffRelics(oldRelic: RawRelic, newRelic: RawRelic): EntityFieldDiff[] {
  const diffs: EntityFieldDiff[] = [];
  for (const field of RELIC_SIMPLE_FIELDS) {
    const oldVal = oldRelic[field];
    const newVal = newRelic[field];
    if (!deepEqual(oldVal, newVal)) {
      diffs.push({ field: RELIC_FIELD_MAP[field], before: oldVal, after: newVal });
    }
  }
  return diffs;
}

// ---------------------------------------------------------------------------
// Potion diff
// ---------------------------------------------------------------------------

const POTION_SIMPLE_FIELDS = ["description", "description_raw", "rarity", "pool"] as const;
const POTION_FIELD_MAP: Record<string, string> = {
  description: "description",
  description_raw: "descriptionRaw",
  rarity: "rarity",
  pool: "pool",
};

function diffPotions(oldPotion: RawPotion, newPotion: RawPotion): EntityFieldDiff[] {
  const diffs: EntityFieldDiff[] = [];
  for (const field of POTION_SIMPLE_FIELDS) {
    const oldVal = oldPotion[field];
    const newVal = newPotion[field];
    if (!deepEqual(oldVal, newVal)) {
      diffs.push({ field: POTION_FIELD_MAP[field], before: oldVal, after: newVal });
    }
  }
  return diffs;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function parseArgs(): { oldDir: string; newDir: string; patch: string; write: boolean } {
  const args = process.argv.slice(2);
  let oldDir = "";
  let newDir = "";
  let patch = "";
  let write = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--old":
        oldDir = args[++i];
        break;
      case "--new":
        newDir = args[++i];
        break;
      case "--patch":
        patch = args[++i];
        break;
      case "--write":
        write = true;
        break;
    }
  }

  if (!oldDir || !newDir || !patch) {
    console.error("Usage: npx tsx scripts/generate-entity-diffs.ts --old <dir> --new <dir> --patch <version> [--write]");
    console.error("");
    console.error("  --old    Path to old STS2 data directory (e.g. data/sts2-old)");
    console.error("  --new    Path to new STS2 data directory (e.g. data/sts2)");
    console.error("  --patch  Patch version string (e.g. v0.102.0)");
    console.error("  --write  Append results to data/sts2-entity-versions.json (default: stdout only)");
    process.exit(1);
  }

  // Normalize patch to v-prefixed
  if (!patch.startsWith("v")) patch = `v${patch}`;

  return { oldDir, newDir, patch, write };
}

function main() {
  const { oldDir, newDir, patch, write } = parseArgs();
  const allDiffs: EntityVersionDiff[] = [];

  // --- Cards ---
  const oldCardsPath = path.join(oldDir, "kor/cards.json");
  const newCardsPath = path.join(newDir, "kor/cards.json");

  if (fs.existsSync(oldCardsPath) && fs.existsSync(newCardsPath)) {
    const oldCards = readJson<RawCard[]>(oldCardsPath);
    const newCards = readJson<RawCard[]>(newCardsPath);
    const oldById = new Map(oldCards.map((c) => [c.id, c]));
    const newById = new Map(newCards.map((c) => [c.id, c]));

    // Cards that exist in both — check for changes
    for (const [id, newCard] of newById) {
      const oldCard = oldById.get(id);
      if (!oldCard) continue; // new card added — no backward diff needed
      const diffs = diffCards(oldCard, newCard);
      if (diffs.length > 0) {
        allDiffs.push({ entityType: "card", entityId: id, patch, diffs });
      }
    }

    // Cards removed in new version
    for (const [id] of oldById) {
      if (!newById.has(id)) {
        console.error(`[WARN] Card ${id} removed in new version — manual handling may be needed`);
      }
    }

    // Cards added in new version
    for (const [id] of newById) {
      if (!oldById.has(id)) {
        console.error(`[INFO] Card ${id} added in new version — no backward diff needed`);
      }
    }
  }

  // --- Relics ---
  const oldRelicsPath = path.join(oldDir, "kor/relics.json");
  const newRelicsPath = path.join(newDir, "kor/relics.json");

  if (fs.existsSync(oldRelicsPath) && fs.existsSync(newRelicsPath)) {
    const oldRelics = readJson<RawRelic[]>(oldRelicsPath);
    const newRelics = readJson<RawRelic[]>(newRelicsPath);
    const oldById = new Map(oldRelics.map((r) => [r.id, r]));
    const newById = new Map(newRelics.map((r) => [r.id, r]));

    for (const [id, newRelic] of newById) {
      const oldRelic = oldById.get(id);
      if (!oldRelic) continue;
      const diffs = diffRelics(oldRelic, newRelic);
      if (diffs.length > 0) {
        allDiffs.push({ entityType: "relic", entityId: id, patch, diffs });
      }
    }

    for (const [id] of oldById) {
      if (!newById.has(id)) {
        console.error(`[WARN] Relic ${id} removed in new version`);
      }
    }
    for (const [id] of newById) {
      if (!oldById.has(id)) {
        console.error(`[INFO] Relic ${id} added in new version`);
      }
    }
  }

  // --- Potions ---
  const oldPotionsPath = path.join(oldDir, "kor/potions.json");
  const newPotionsPath = path.join(newDir, "kor/potions.json");

  if (fs.existsSync(oldPotionsPath) && fs.existsSync(newPotionsPath)) {
    const oldPotions = readJson<RawPotion[]>(oldPotionsPath);
    const newPotions = readJson<RawPotion[]>(newPotionsPath);
    const oldById = new Map(oldPotions.map((p) => [p.id, p]));
    const newById = new Map(newPotions.map((p) => [p.id, p]));

    for (const [id, newPotion] of newById) {
      const oldPotion = oldById.get(id);
      if (!oldPotion) continue;
      const diffs = diffPotions(oldPotion, newPotion);
      if (diffs.length > 0) {
        allDiffs.push({ entityType: "potion", entityId: id, patch, diffs });
      }
    }

    for (const [id] of oldById) {
      if (!newById.has(id)) {
        console.error(`[WARN] Potion ${id} removed in new version`);
      }
    }
    for (const [id] of newById) {
      if (!oldById.has(id)) {
        console.error(`[INFO] Potion ${id} added in new version`);
      }
    }
  }

  // --- Output ---
  console.error(`\n=== Summary ===`);
  console.error(`Patch: ${patch}`);
  console.error(`Cards changed: ${allDiffs.filter((d) => d.entityType === "card").length}`);
  console.error(`Relics changed: ${allDiffs.filter((d) => d.entityType === "relic").length}`);
  console.error(`Potions changed: ${allDiffs.filter((d) => d.entityType === "potion").length}`);
  console.error(`Total diffs: ${allDiffs.reduce((sum, d) => sum + d.diffs.length, 0)} field changes`);

  if (allDiffs.length === 0) {
    console.error("\nNo entity changes detected.");
    return;
  }

  // Pretty-print new diffs to stdout
  console.log(JSON.stringify(allDiffs, null, 2));

  if (write) {
    const versionsPath = path.join(process.cwd(), "data/sts2-entity-versions.json");
    const existing: EntityVersionDiff[] = fs.existsSync(versionsPath)
      ? readJson<EntityVersionDiff[]>(versionsPath)
      : [];

    // Remove any existing diffs for this patch (idempotent re-run)
    const filtered = existing.filter((d) => d.patch !== patch);
    const merged = [...filtered, ...allDiffs];

    fs.writeFileSync(versionsPath, JSON.stringify(merged, null, 2) + "\n");
    console.error(`\nWritten ${allDiffs.length} entries to ${versionsPath}`);
    console.error(`Total entries in file: ${merged.length}`);
  } else {
    console.error("\nDry run — use --write to append to sts2-entity-versions.json");
  }
}

main();

/**
 * List the elements a patch changed, with the Korean text before and after.
 * This is the approval list for a version short, plus ready capture targets.
 *
 *   pnpm shorts:changes --versions     # versions the picker offers, with change counts
 *   pnpm shorts:changes 0.111.0
 *   pnpm shorts:changes 0.111.0 --json
 *
 * "before" is the previous version the Compendium version picker offers.
 * Rows whose text, costs, keywords, type, and rarity do not move are marked
 * `same-tile`; a tile capture of them would look identical.
 */

import { getEntityVersionDiffs, getSTS2Changes, getSTS2Patches } from "../src/lib/data";
import { compareVersions, getVersionsWithDiffs } from "../src/lib/entity-versioning";
import { getVersionedEntity } from "../src/lib/versioned-entity-api";
import type { VersionedEntityType } from "../src/lib/types";

/** Change entity type -> Compendium route segment. */
const ROUTES: Partial<Record<string, string>> = {
  card: "cards",
  relic: "relics",
  potion: "potions",
  enchantment: "enchantments",
  power: "powers",
  monster: "monsters",
  event: "events",
};

interface Row {
  type: string;
  id: string;
  name: string | null;
  summaryKo: string | null;
  before: string | null;
  after: string | null;
  tileBefore: Record<string, unknown>;
  tileAfter: Record<string, unknown>;
  sameTile: boolean;
  targets: { asIs: string; toBe: string } | null;
}

/** Fields besides the description that change what a tile shows. */
const TILE_FIELDS = ["cost", "starCost", "keywords", "type", "rarity"];

function tileFields(entity: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return Object.fromEntries(TILE_FIELDS.map((field) => [field, entity?.[field] ?? null]));
}

function plain(text: unknown): string | null {
  if (typeof text !== "string") return null;
  return text
    .replace(/\[(?:energy|star):(\d+)\]/g, "($1)")
    .replace(/\[\/?[a-z]+(?:[:=][^\]]*)?\]/gi, "")
    .trim();
}

async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const json = args.includes("--json");
  const wanted = args.find((arg) => !arg.startsWith("--"))?.replace(/^v/, "");
  if (!wanted && !args.includes("--versions")) {
    console.log("usage: pnpm shorts:changes <version> [--json]\n       pnpm shorts:changes --versions");
    process.exit(1);
  }

  const [patches, versionDiffs, changes] = await Promise.all([
    getSTS2Patches(),
    getEntityVersionDiffs(),
    getSTS2Changes(),
  ]);
  const versions = getVersionsWithDiffs(patches, versionDiffs);

  if (!wanted) {
    console.log("version   date        kind      changes by type");
    for (const version of versions) {
      const patch = patches.find((entry) => entry.version === version);
      const counts = new Map<string, Set<string>>();
      for (const change of changes) {
        if (change.patch.replace(/^v/, "") !== version) continue;
        const ids = counts.get(change.entityType) ?? new Set<string>();
        ids.add(change.entityId);
        counts.set(change.entityType, ids);
      }
      const summary = [...counts].map(([type, ids]) => `${type} ${ids.size}`).join(", ") || "-";
      console.log(`${version.padEnd(9)} ${String(patch?.date ?? "").padEnd(11)} ${String(patch?.type ?? "").padEnd(9)} ${summary}`);
    }
    return;
  }
  const previous = versions.find((version) => compareVersions(version, wanted) < 0);
  if (!previous) throw new Error(`no selectable version before ${wanted}`);

  const patchChanges = changes.filter((change) => change.patch.replace(/^v/, "") === wanted);
  const seen = new Set<string>();
  const rows: Row[] = [];
  for (const change of patchChanges) {
    const key = `${change.entityType}:${change.entityId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const entityType = change.entityType as VersionedEntityType;
    const load = (version: string) =>
      getVersionedEntity<Record<string, unknown> & { id: string }>({
        entityType,
        entityId: change.entityId,
        version,
        locale: "kor",
      }).catch(() => null);
    const [asIs, toBe] = await Promise.all([load(previous), load(wanted)]);
    const before = plain(asIs?.entity?.description);
    const after = plain(toBe?.entity?.description);
    const tileBefore = tileFields(asIs?.entity);
    const tileAfter = tileFields(toBe?.entity);
    const route = ROUTES[change.entityType];
    rows.push({
      type: change.entityType,
      id: change.entityId,
      name: (toBe?.entity?.name ?? asIs?.entity?.name ?? null) as string | null,
      summaryKo: change.summaryKo ?? null,
      before,
      after,
      tileBefore,
      tileAfter,
      sameTile: before === after && JSON.stringify(tileBefore) === JSON.stringify(tileAfter),
      targets: route
        ? { asIs: `${route}/${change.entityId}@${previous}`, toBe: `${route}/${change.entityId}@${wanted}` }
        : null,
    });
  }

  if (json) {
    console.log(JSON.stringify({ version: wanted, previous, rows }, null, 2));
    return;
  }

  console.log(`v${wanted}  (as-is = v${previous})  ${rows.length} elements\n`);
  for (const row of rows) {
    const flag = row.sameTile ? "  [same-tile]" : "";
    console.log(`${row.type} ${row.id}  ${row.name ?? ""}${flag}`);
    if (row.summaryKo) console.log(`  note : ${row.summaryKo}`);
    const moved = TILE_FIELDS
      .filter((field) => JSON.stringify(row.tileBefore[field]) !== JSON.stringify(row.tileAfter[field]))
      .map((field) => `${field} ${JSON.stringify(row.tileBefore[field])} -> ${JSON.stringify(row.tileAfter[field])}`);
    console.log(`  as-is: ${row.before?.replace(/\n/g, " ") ?? "-"}`);
    console.log(`  to-be: ${row.after?.replace(/\n/g, " ") ?? "-"}`);
    if (moved.length > 0) console.log(`  also : ${moved.join(", ")}`);
    if (row.targets) console.log(`  shots: ${row.targets.asIs}  ${row.targets.toBe}`);
    console.log("");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

/**
 * List the elements a patch changed, with the Korean text before and after.
 * This is the approval list for a version short, plus ready capture targets.
 *
 *   pnpm shorts:changes --versions     # versions the picker offers, with change counts
 *   pnpm shorts:changes 0.111.0
 *   pnpm shorts:changes 0.111.0 --json
 *
 * "before" is the previous version the Compendium version picker offers.
 * Every row has a `class`:
 *   new           the element first ships in this version (`introducedInPatch`); there is no as-is
 *   same-tile     text (whitespace and line breaks ignored), costs, keywords, type and rarity do not move:
 *                 a tile capture would look identical
 *   wording       only the phrasing moved: the numbers, the highlighted words (keywords, powers, cards)
 *                 and the tile fields are the same ("보존" -> "보존을 얻습니다"), the effect is not
 *   tile_changed  anything else that shows on the tile
 */

import {
  getCodexCards,
  getCodexEnchantments,
  getCodexEpochs,
  getCodexPotions,
  getCodexPowers,
  getCodexRelics,
} from "../src/lib/codex-data";
import { getEntityVersionDiffs, getSTS2Changes, getSTS2PatchLines, getSTS2Patches } from "../src/lib/data";
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

type RowClass = "new" | "same-tile" | "wording" | "tile_changed";

interface Row {
  class: RowClass;
  type: string;
  id: string;
  name: string | null;
  summaryKo: string | null;
  /** Korean patch-note lines about this element; they carry the 버프/너프/리워크 label. */
  patchLines: string[];
  before: string | null;
  after: string | null;
  tileBefore: Record<string, unknown>;
  tileAfter: Record<string, unknown>;
  sameTile: boolean;
  targets: { asIs: string | null; toBe: string } | null;
}

/** Fields besides the description that change what a tile shows. */
const TILE_FIELDS = ["cost", "starCost", "keywords", "type", "rarity"];

function tileFields(entity: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return Object.fromEntries(TILE_FIELDS.map((field) => [field, entity?.[field] ?? null]));
}

/** Whitespace and line breaks are layout, not text: "피해 6.\n약화 1" and "피해 6. 약화 1" are the same. */
function squash(text: string | null): string | null {
  return text === null ? null : text.replace(/\s+/g, " ").trim();
}

/** The numbers and the highlighted spans of a raw description: what a rewording leaves alone. */
function effectSignature(raw: unknown): string {
  const text = typeof raw === "string" ? raw : "";
  const spans = [...text.matchAll(/\[([a-z]+)(?:[:=][^\]]*)?\]([^\[]*)\[\/\1\]/gi)].map((match) => `${match[1]}:${match[2].replace(/\s+/g, "")}`);
  const numbers = text.replace(/\[\/?[a-z]+(?:[:=][^\]]*)?\]/gi, " ").match(/\d+/g) ?? [];
  return JSON.stringify({ spans, numbers });
}

function plain(text: unknown): string | null {
  if (typeof text !== "string") return null;
  return text
    .replace(/\[(?:energy|star):(\d+)\]/g, "($1)")
    .replace(/\[\/?[a-z]+(?:[:=][^\]]*)?\]/gi, "")
    .trim();
}

interface IntroducedEntity {
  type: string;
  id: string;
  name: string | null;
  description: string | null;
  entity: Record<string, unknown>;
}

/** Every element whose `introducedInPatch` is this version, by the type names the change list uses. */
async function introducedIn(version: string): Promise<IntroducedEntity[]> {
  const gameLocale = "kor" as const;
  const [cards, relics, potions, powers, enchantments, epochs] = await Promise.all([
    getCodexCards({ gameLocale }),
    getCodexRelics({ gameLocale }),
    getCodexPotions({ gameLocale }),
    getCodexPowers({ gameLocale }),
    getCodexEnchantments({ gameLocale }),
    getCodexEpochs({ gameLocale }),
  ]);
  const lists: [string, { id: string; name?: string; description?: string; introducedInPatch?: string }[]][] = [
    ["card", cards],
    ["relic", relics],
    ["potion", potions],
    ["power", powers],
    ["enchantment", enchantments],
    ["epoch", epochs],
  ];
  return lists.flatMap(([type, list]) =>
    list
      .filter((entry) => entry.introducedInPatch?.replace(/^v/, "") === version)
      .map((entry) => ({
        type,
        id: entry.id,
        name: entry.name ?? null,
        description: entry.description ?? null,
        entity: entry as unknown as Record<string, unknown>,
      })));
}

async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const json = args.includes("--json");
  const wanted = args.find((arg) => !arg.startsWith("--"))?.replace(/^v/, "");
  if (!wanted && !args.includes("--versions")) {
    console.log("usage: pnpm shorts:changes <version> [--json]\n       pnpm shorts:changes --versions");
    process.exit(1);
  }

  const [patches, versionDiffs, changes, patchLines] = await Promise.all([
    getSTS2Patches(),
    getEntityVersionDiffs(),
    getSTS2Changes(),
    getSTS2PatchLines(),
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

  const versionLines = patchLines.filter((line) => line.version.replace(/^v/, "") === wanted);
  // Most lines carry no entity refs, so fall back to the Korean name at the start of the line.
  const linesFor = (id: string, name: string | null) =>
    versionLines
      .filter((line) =>
        line.entityRefs.some((ref) => ref.id.toLowerCase() === id.toLowerCase()) ||
        (name !== null && line.textKo.startsWith(`${name} (`)))
      .map((line) => line.textKo);

  const patchChanges = changes.filter((change) => change.patch.replace(/^v/, "") === wanted);
  // Elements that first ship in this version have no change entry; the loaders know them by introducedInPatch.
  const introduced = await introducedIn(wanted);
  const introducedKeys = new Set(introduced.map((entry) => `${entry.type}:${entry.id}`));
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
    const sameFields = JSON.stringify(tileBefore) === JSON.stringify(tileAfter);
    const sameText = squash(before) === squash(after);
    const rowClass: RowClass = introducedKeys.has(key)
      ? "new"
      : sameText && sameFields
        ? "same-tile"
        : sameFields && effectSignature(asIs?.entity?.description) === effectSignature(toBe?.entity?.description)
          ? "wording"
          : "tile_changed";
    const route = ROUTES[change.entityType];
    const name = (toBe?.entity?.name ?? asIs?.entity?.name ?? null) as string | null;
    rows.push({
      class: rowClass,
      type: change.entityType,
      id: change.entityId,
      name,
      // Older patches have only the English summary.
      summaryKo: change.summaryKo ?? change.summary ?? null,
      patchLines: linesFor(change.entityId, name),
      before,
      after,
      tileBefore,
      tileAfter,
      sameTile: rowClass === "same-tile",
      targets: route
        ? { asIs: rowClass === "new" ? null : `${route}/${change.entityId}@${previous}`, toBe: `${route}/${change.entityId}@${wanted}` }
        : null,
    });
  }
  for (const entry of introduced) {
    const key = `${entry.type}:${entry.id}`;
    if (seen.has(key)) continue;
    const route = ROUTES[entry.type];
    rows.push({
      class: "new",
      type: entry.type,
      id: entry.id,
      name: entry.name,
      summaryKo: null,
      patchLines: linesFor(entry.id, entry.name),
      before: null,
      after: plain(entry.description),
      tileBefore: tileFields(null),
      tileAfter: tileFields(entry.entity),
      sameTile: false,
      targets: route ? { asIs: null, toBe: `${route}/${entry.id}@${wanted}` } : null,
    });
  }

  if (json) {
    console.log(JSON.stringify({ version: wanted, previous, rows }, null, 2));
    return;
  }

  console.log(`v${wanted}  (as-is = v${previous})  ${rows.length} elements\n`);
  for (const row of rows) {
    const flag = row.class === "tile_changed" ? "" : `  [${row.class}]`;
    console.log(`${row.type} ${row.id}  ${row.name ?? ""}${flag}`);
    for (const line of row.patchLines) console.log(`  patch: ${line}`);
    if (row.summaryKo) console.log(`  note : ${row.summaryKo}`);
    const moved = TILE_FIELDS
      .filter((field) => JSON.stringify(row.tileBefore[field]) !== JSON.stringify(row.tileAfter[field]))
      .map((field) => `${field} ${JSON.stringify(row.tileBefore[field])} -> ${JSON.stringify(row.tileAfter[field])}`);
    console.log(`  as-is: ${row.before?.replace(/\n/g, " ") ?? "-"}`);
    console.log(`  to-be: ${row.after?.replace(/\n/g, " ") ?? "-"}`);
    if (moved.length > 0) console.log(`  also : ${moved.join(", ")}`);
    if (row.targets) console.log(`  shots: ${row.targets.asIs ?? "(new)"}  ${row.targets.toBe}`);
    console.log("");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

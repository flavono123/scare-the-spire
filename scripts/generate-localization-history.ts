/**
 * Pin each game locale's titles and description templates per version.
 *
 *   pnpm i18n:history
 *
 * Reads the raw localization committed for every selectable version from
 * LOCALE_TEXT_PINNED_FROM on (see scripts/lib/localization-snapshots.ts) and
 * writes data/sts2/localization-history.json. The version API uses it so an
 * older Compendium version shows that version's text in every locale.
 *
 * Run it after each localization sync, once the new tables are committed or in
 * the working tree.
 */

import { writeFileSync } from "node:fs";
import path from "node:path";
import {
  getCodexCards,
  getCodexEnchantments,
  getCodexPotions,
  getCodexRelics,
} from "../src/lib/codex-data";
import { getCodexMeta, getSTS2Changes, getSTS2Patches, deriveEntityVersionDiffs } from "../src/lib/data";
import { bakeDescription } from "../src/lib/codex-bake";
import { compareVersions, getVersionsWithDiffs } from "../src/lib/entity-versioning";
import { GAME_LOCALES, type GameLocale } from "../src/lib/i18n";
import {
  LOCALE_TEXT_PINNED_FROM,
  type LocalizationHistory,
  type TrackedField,
} from "../src/lib/localization-history";
import type { VersionedEntityType } from "../src/lib/types";
import { tableAt, versionSnapshots, type LocalizationTable } from "./lib/localization-snapshots";

const SOURCES: { type: VersionedEntityType; table: string; load: (gameLocale: GameLocale) => Promise<{ id: string }[]> }[] = [
  { type: "card", table: "cards", load: (gameLocale) => getCodexCards({ includeDeprecated: true, gameLocale }) },
  { type: "relic", table: "relics", load: (gameLocale) => getCodexRelics({ gameLocale }) },
  { type: "potion", table: "potions", load: (gameLocale) => getCodexPotions({ gameLocale }) },
  { type: "enchantment", table: "enchantments", load: (gameLocale) => getCodexEnchantments({ gameLocale }) },
];

const FIELDS: [TrackedField, (id: string) => string][] = [
  ["name", (id) => `${id}.title`],
  ["descriptionRaw", (id) => `${id}.description`],
];

const SENTINEL_BASE = 987650;

/**
 * Read the numbers a baked text was made with. Each variable in the template
 * gets a sentinel value, the template is baked, and the sentinels become
 * capture groups matched against the text. Whitespace is ignored.
 */
function extractVars(template: string, baked: string): Record<string, number> | null {
  const names = [...new Set([...template.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)/g)].map((match) => match[1]))];
  if (names.length === 0) return null;
  if (names.length > 10) return null;
  const sentinels = Object.fromEntries(names.map((name, index) => [name, SENTINEL_BASE + index]));
  const probe = bakeDescription(template, sentinels).replace(/\s+/g, "");
  const order: string[] = [];
  const pattern = probe
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    // Sentinels are 98765N, so N is the variable's index (at most ten variables).
    .replace(new RegExp(`${String(SENTINEL_BASE).slice(0, -1)}(\\d)`, "g"), (_, digit: string) => {
      order.push(names[Number(digit)]);
      return "(-?\\d+)";
    });
  if (order.length === 0) return null;
  const match = new RegExp(`^${pattern}$`).exec(baked.replace(/\s+/g, ""));
  if (match) {
    const values: Record<string, number> = {};
    order.forEach((name, index) => {
      values[name] = Number(match[index + 1]);
    });
    return values;
  }
  // The wording can drift while the numbers line up, as when an authored text
  // mixes a later version's phrasing with its own numbers. Then read the
  // numbers in order: fixed numbers must agree, sentinels take the value.
  // Only with a single variable, since reordered wording would swap values.
  if (order.length !== 1) return null;
  const probeNumbers = [...probe.matchAll(/-?\d+/g)].map((item) => item[0]);
  const bakedNumbers = [...baked.matchAll(/-?\d+/g)].map((item) => item[0]);
  if (probeNumbers.length !== bakedNumbers.length) return null;
  const values: Record<string, number> = {};
  for (let index = 0; index < probeNumbers.length; index += 1) {
    const sentinel = Number(probeNumbers[index]) - SENTINEL_BASE;
    if (sentinel >= 0 && sentinel < names.length) values[names[sentinel]] = Number(bakedNumbers[index]);
    else if (probeNumbers[index] !== bakedNumbers[index]) return null;
  }
  return Object.keys(values).length > 0 ? values : null;
}

function clean(value: unknown): string | undefined {
  return typeof value === "string" ? value.replace(/\r/g, "") : undefined;
}

async function main() {
  const [patches, changes, meta] = await Promise.all([getSTS2Patches(), getSTS2Changes(), getCodexMeta()]);
  const selectable = getVersionsWithDiffs(patches, deriveEntityVersionDiffs(changes))
    .filter((version) => compareVersions(version, LOCALE_TEXT_PINNED_FROM) >= 0);
  const snapshots = versionSnapshots(selectable, patches, meta.version);
  if (snapshots[0]?.version !== LOCALE_TEXT_PINNED_FROM) {
    throw new Error(`no localization snapshot for ${LOCALE_TEXT_PINNED_FROM}; got ${snapshots[0]?.version ?? "none"}`);
  }

  const history: LocalizationHistory = {
    pinnedFrom: LOCALE_TEXT_PINNED_FROM,
    snapshots: snapshots.map(({ version, commit }) => ({ version, commit: commit.slice(0, 12) })),
    text: {},
    varDiffs: [],
    untracked: {},
  };
  let points = 0;

  for (const locale of GAME_LOCALES) {
    for (const source of SOURCES) {
      const entities = await source.load(locale);
      const tables: LocalizationTable[] = snapshots.map(({ commit }) => tableAt(commit, locale, source.table));
      const current = tables[tables.length - 1];
      for (const entity of entities as (Record<string, unknown> & { id: string })[]) {
        for (const [field, keyOf] of FIELDS) {
          const key = keyOf(entity.id);
          const latest = clean(current[key]);
          if (latest === undefined && entity[field] === undefined) continue;
          // The site renders this field from somewhere other than the table
          // (or the table lacks it), so the table's history cannot replace it.
          if (latest === undefined || clean(entity[field]) !== latest) {
            ((history.untracked[locale] ??= {})[source.type] ??= []).push(`${entity.id}.${field}`);
            continue;
          }
          const timeline: [string, string][] = [];
          snapshots.forEach(({ version }, index) => {
            const value = clean(tables[index][key]);
            if (value === undefined) return;
            if (timeline.length === 0 || timeline[timeline.length - 1][1] !== value) timeline.push([version, value]);
          });
          if (timeline.length < 2) continue;
          const byId = (((history.text[locale] ??= {})[source.type] ??= {})[entity.id] ??= {});
          byId[field] = timeline;
          points += timeline.length - 1;
        }
      }
    }
  }

  // Authored diffs sometimes record a number change only inside the Korean
  // baked text. Recover it so baking the pinned template shows the old number.
  for (const change of changes) {
    const type = change.entityType as VersionedEntityType;
    const source = SOURCES.find((entry) => entry.type === type);
    const diff = change.fieldDiffs?.find((item) => item.field === "description");
    if (!source || !diff || typeof diff.before !== "string" || typeof diff.after !== "string") continue;
    const at = snapshots.findIndex(({ version }) => `v${version}` === change.patch);
    if (at < 1) continue;
    const key = `${change.entityId}.description`;
    const beforeTemplate = clean(tableAt(snapshots[at - 1].commit, "kor", source.table)[key]);
    const afterTemplate = clean(tableAt(snapshots[at].commit, "kor", source.table)[key]);
    if (!beforeTemplate || !afterTemplate) continue;
    // Reverting needs only the old value. The new one is kept when it reads
    // cleanly; a rework can drop the variable, or a later edit can reword the
    // authored after text.
    const before = extractVars(beforeTemplate, diff.before);
    if (!before) continue;
    const after = extractVars(afterTemplate, diff.after) ?? {};
    const recorded = new Set((change.fieldDiffs ?? []).map((item) => item.field));
    for (const [name, value] of Object.entries(before)) {
      const field = `vars.${name}`;
      if (after[name] === value || recorded.has(field)) continue;
      history.varDiffs.push({ entityType: type, entityId: change.entityId, patch: change.patch, field, before: value, after: after[name] ?? null });
    }
  }

  const out = path.resolve(__dirname, "..", "data", "sts2", "localization-history.json");
  writeFileSync(out, `${JSON.stringify(history)}\n`);
  const untracked = Object.values(history.untracked).flatMap((byType) => Object.values(byType ?? {}).flat()).length;
  console.log(`${out}: ${snapshots.length} snapshots, ${points} text changes, ${history.varDiffs.length} recovered numbers, ${untracked} untracked fields`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

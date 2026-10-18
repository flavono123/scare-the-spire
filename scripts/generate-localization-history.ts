/**
 * Pin each game locale's titles and description templates per version.
 *
 *   pnpm i18n:history [--out file]
 *
 * Reads the game's own localization of every archived build from
 * LOCALE_TEXT_PINNED_FROM on (see scripts/lib/localization-snapshots.ts and the
 * build archive in AGENTS.md) and writes data/sts2/localization-history.json.
 * The version API uses it so an older Compendium version shows that version's
 * text in every locale.
 *
 * Run it after each localization sync. A current version that is not archived
 * yet reads the working tree.
 */

import { writeFileSync } from "node:fs";
import path from "node:path";
import {
  getCodexCards,
  getCodexEnchantments,
  getCodexPotions,
  getCodexRelics,
} from "../src/lib/codex-data";
import { getCodexMeta, getSTS2Changes, getSTS2Patches } from "../src/lib/data";
import { bakeDescription } from "../src/lib/codex-bake";
import { compareVersions } from "../src/lib/entity-versioning";
import { GAME_LOCALES, type GameLocale } from "../src/lib/i18n";
import {
  LOCALE_TEXT_PINNED_FROM,
  type LocalizationHistory,
  type TrackedField,
} from "../src/lib/localization-history";
import type { VersionedEntityType } from "../src/lib/types";
import { BUILDS_DIR, tableAt, versionSnapshots, type LocalizationTable } from "./lib/localization-snapshots";

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

/**
 * Ids a build used for an entity that has another id elsewhere: table ->
 * current id -> build -> the id in that build's tables. Found by listing
 * ids that vanish from one build's tables and come back in the next.
 */
const BUILD_ID_ALIASES: Record<string, Record<string, Record<string, string>>> = {
  // v0.100.0 reworked Prepared under the id PREPARE, then rolled it back.
  cards: { PREPARED: { "0.100.0": "PREPARE" } },
};

/** The text table entry for an entity in one build, honoring BUILD_ID_ALIASES. */
function entryAt(build: string, locale: GameLocale, table: string, id: string, suffix: string): string | undefined {
  return clean(tableAt(build, locale, table)[`${BUILD_ID_ALIASES[table]?.[id]?.[build] ?? id}.${suffix}`]);
}

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
  const { snapshots, missing, unlisted } = versionSnapshots(LOCALE_TEXT_PINNED_FROM, patches, meta.version);
  if (!snapshots[0] || compareVersions(snapshots[0].version, LOCALE_TEXT_PINNED_FROM) !== 0) {
    throw new Error(
      `no archived build for ${LOCALE_TEXT_PINNED_FROM} (first snapshot: ${snapshots[0]?.version ?? "none"}); is the build archive at ${BUILDS_DIR} extracted? See AGENTS.md.`,
    );
  }
  if (missing.length > 0) console.warn(`patches without an archived build (their text changes fold into the next patch): ${missing.join(", ")}`);
  if (unlisted.length > 0) console.warn(`archived builds without a patch entry (their text changes fold into the next patch): ${unlisted.join(", ")}`);

  const history: LocalizationHistory = {
    pinnedFrom: LOCALE_TEXT_PINNED_FROM,
    snapshots,
    text: {},
    varDiffs: [],
    untracked: {},
  };
  let points = 0;

  for (const locale of GAME_LOCALES) {
    for (const source of SOURCES) {
      const entities = await source.load(locale);
      const tables: LocalizationTable[] = snapshots.map(({ build }) => tableAt(build, locale, source.table));
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
          snapshots.forEach(({ version, build }, index) => {
            const value = clean(tables[index][keyOf(BUILD_ID_ALIASES[source.table]?.[entity.id]?.[build] ?? entity.id)]);
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
  // A variable recorded as vars.X at this patch or an earlier one is already
  // tracked explicitly up to here, so its baked text is not second-guessed.
  const recordedVars = new Map<string, string[]>();
  for (const change of changes) {
    for (const item of change.fieldDiffs ?? []) {
      if (!item.field.startsWith("vars.")) continue;
      const key = `${change.entityType}:${change.entityId}:${item.field}`;
      recordedVars.set(key, [...(recordedVars.get(key) ?? []), change.patch.replace(/^v/, "")]);
    }
  }
  const recordedBy = (key: string, patch: string) =>
    (recordedVars.get(key) ?? []).some((at) => compareVersions(at, patch.replace(/^v/, "")) <= 0);
  for (const change of changes) {
    const type = change.entityType as VersionedEntityType;
    const source = SOURCES.find((entry) => entry.type === type);
    const diff = change.fieldDiffs?.find((item) => item.field === "description");
    if (!source || !diff || typeof diff.before !== "string" || typeof diff.after !== "string") continue;
    const at = snapshots.findIndex(({ version }) => `v${version}` === change.patch);
    // Pinned range: the game's own templates. At or before its first version
    // there is no earlier snapshot, so use the templates the change itself
    // records (descriptionRaw).
    const rawDiff = change.fieldDiffs?.find((item) => item.field === "descriptionRaw");
    const beforeTemplate = at >= 1
      ? entryAt(snapshots[at - 1].build, "kor", source.table, change.entityId, "description")
      : at < 1 && compareVersions(change.patch.replace(/^v/, ""), LOCALE_TEXT_PINNED_FROM) <= 0 ? clean(rawDiff?.before) : undefined;
    const afterTemplate = at >= 1
      ? entryAt(snapshots[at].build, "kor", source.table, change.entityId, "description")
      : at < 1 && compareVersions(change.patch.replace(/^v/, ""), LOCALE_TEXT_PINNED_FROM) <= 0 ? clean(rawDiff?.after) : undefined;
    // A numbers-only change at the pinned start may record no template at
    // all. Then the earliest pinned Korean template stands in, but only if it
    // reads the authored after text exactly (the wording did not move since).
    let fallbackTemplate: string | undefined;
    if (!beforeTemplate && !rawDiff && at < 1 && compareVersions(change.patch.replace(/^v/, ""), LOCALE_TEXT_PINNED_FROM) <= 0) {
      const pinned = entryAt(snapshots[0].build, "kor", source.table, change.entityId, "description");
      if (pinned && extractVars(pinned, diff.after)) fallbackTemplate = pinned;
    }
    if (!(beforeTemplate && afterTemplate) && !fallbackTemplate) continue;
    // Reverting needs only the old value. The new one is kept when it reads
    // cleanly; a rework can drop the variable, or a later edit can reword the
    // authored after text.
    const before = extractVars(beforeTemplate ?? fallbackTemplate!, diff.before);
    if (!before) continue;
    const after = extractVars(afterTemplate ?? fallbackTemplate!, diff.after) ?? {};
    const recorded = new Set((change.fieldDiffs ?? []).map((item) => item.field));
    for (const [name, value] of Object.entries(before)) {
      const field = `vars.${name}`;
      if (after[name] === value || recorded.has(field) || recordedBy(`${type}:${change.entityId}:${field}`, change.patch)) continue;
      history.varDiffs.push({ entityType: type, entityId: change.entityId, patch: change.patch, field, before: value, after: after[name] ?? null });
    }
  }

  const outAt = process.argv.indexOf("--out");
  const out = outAt >= 0 ? path.resolve(process.argv[outAt + 1]) : path.resolve(__dirname, "..", "data", "sts2", "localization-history.json");
  writeFileSync(out, `${JSON.stringify(history)}\n`);
  const untracked = Object.values(history.untracked).flatMap((byType) => Object.values(byType ?? {}).flat()).length;
  console.log(`${out}: ${snapshots.length} snapshots, ${points} text changes, ${history.varDiffs.length} recovered numbers, ${untracked} untracked fields`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

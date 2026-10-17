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
          if (latest === undefined) continue;
          // The site renders this field differently from the table, so the
          // table's history cannot replace it.
          if (clean(entity[field]) !== latest) {
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

  const out = path.resolve(__dirname, "..", "data", "sts2", "localization-history.json");
  writeFileSync(out, `${JSON.stringify(history)}\n`);
  const untracked = Object.values(history.untracked).flatMap((byType) => Object.values(byType ?? {}).flat()).length;
  console.log(`${out}: ${snapshots.length} snapshots, ${points} text changes, ${untracked} untracked fields`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

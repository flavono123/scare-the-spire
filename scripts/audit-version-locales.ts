/**
 * Check what the Compendium shows for older versions in every game locale.
 *
 * Ground truth is the raw game localization committed for each version
 * (`data/sts2/localization` in git history). For every selectable version that
 * has such a snapshot, compare the versioned entity's title and description
 * template in each locale with that snapshot.
 *
 *   pnpm exec tsx scripts/audit-version-locales.ts [--out report.md] [--json findings.json] [--samples 5]
 *
 * A row counts only when the current version matches the current table, so
 * fields the site always renders differently are not blamed on versioning.
 */

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { getSTS2Changes, getSTS2Patches, getEntityVersionDiffs } from "../src/lib/data";
import { compareVersions, getVersionsWithDiffs } from "../src/lib/entity-versioning";
import { GAME_LOCALES, type GameLocale } from "../src/lib/i18n";
import type { VersionedEntityType } from "../src/lib/types";
import { getVersionedEntities, getVersionedEntity } from "../src/lib/versioned-entity-api";
import { LOCALE_TEXT_PINNED_FROM } from "../src/lib/localization-history";
import { getCodexMeta } from "../src/lib/data";

const TABLES: [VersionedEntityType, string][] = [
  ["card", "cards"],
  ["relic", "relics"],
  ["potion", "potions"],
  ["enchantment", "enchantments"],
  ["power", "powers"],
];

const HANGUL = /[가-힣]/;
type Table = Record<string, string>;
type Entity = Record<string, unknown> & { id: string };

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
}

/** Last localization commit dated on or after `from` and before `until`. */
function snapshotCommit(from: string, until: string | null): string | null {
  const log = git(["log", "--format=%H %cs", "--", "data/sts2/localization/"]).trim().split("\n");
  for (const line of log) {
    const [hash, date] = line.split(" ");
    if (date >= from && (until === null || date < until)) return hash;
  }
  return null;
}

const tableCache = new Map<string, Table>();
function tableAt(commit: string, locale: GameLocale, table: string): Table {
  const key = `${commit}:${locale}:${table}`;
  const cached = tableCache.get(key);
  if (cached) return cached;
  let parsed: Table = {};
  try {
    parsed = JSON.parse(git(["show", `${commit}:data/sts2/localization/${locale}/${table}.json`])) as Table;
  } catch {
    parsed = {};
  }
  tableCache.set(key, parsed);
  return parsed;
}

function templateKey(type: VersionedEntityType, id: string, table: Table): string {
  if (type === "power" && table[`${id}.smartDescription`] !== undefined) return `${id}.smartDescription`;
  return `${id}.description`;
}

/**
 * korean-leak: another locale shows a reverted Korean diff.
 * cosmetic: same words once line breaks, spacing, and color tags are ignored.
 * stale: the latest text where the game had different wording at that version.
 * other: neither the latest nor that version's text.
 */
const KINDS = ["korean-leak", "cosmetic", "stale", "other"] as const;
type Kind = (typeof KINDS)[number];

function words(value: string): string {
  return value.replace(/\[\/?[a-z]+(?:[:=][^\]]*)?\]/gi, "").replace(/\s+/g, "");
}

interface Finding {
  version: string;
  locale: GameLocale;
  type: VersionedEntityType;
  id: string;
  field: "title" | "description";
  kind: Kind;
  shown: string;
  expected: string;
}

function norm(value: unknown): string {
  return typeof value === "string" ? value.replace(/\r/g, "").trim() : "";
}

async function main() {
  const args = process.argv.slice(2);
  const outAt = args.indexOf("--out");
  const out = outAt >= 0 ? args[outAt + 1] : null;
  const samplesAt = args.indexOf("--samples");
  const samples = samplesAt >= 0 ? Number(args[samplesAt + 1]) : 5;

  const [patches, versionDiffs, meta] = await Promise.all([getSTS2Patches(), getEntityVersionDiffs(), getCodexMeta()]);
  const ordered = [...patches]
    .filter((patch) => /^\d+\.\d+/.test(patch.version))
    .sort((a, b) => compareVersions(a.version, b.version));
  const selectable = getVersionsWithDiffs(patches, versionDiffs);
  const head = git(["rev-parse", "HEAD"]).trim();

  const findings: Finding[] = [];
  const checked: { version: string; commit: string; compared: number }[] = [];

  for (const version of [...selectable].reverse()) {
    const index = ordered.findIndex((patch) => patch.version === version);
    const patch = ordered[index];
    const next = ordered[index + 1] ?? null;
    const commit = version === meta.version ? head : snapshotCommit(patch.date, next?.date ?? null);
    if (!commit) continue;
    let compared = 0;
    for (const locale of GAME_LOCALES) {
      for (const [type, tableName] of TABLES) {
        const table = tableAt(commit, locale, tableName);
        const current = tableAt(head, locale, tableName);
        if (Object.keys(table).length === 0) continue;
        const [atVersion, atLatest] = await Promise.all([
          getVersionedEntities<Entity>({ entityType: type, version, locale }),
          getVersionedEntities<Entity>({ entityType: type, version: meta.version, locale }),
        ]);
        const latestById = new Map(atLatest.map((result) => [result.entityId, result.entity]));
        for (const result of atVersion) {
          const entity = result.entity;
          if (!entity) continue;
          const latest = latestById.get(result.entityId);
          const fields: [Finding["field"], string, string][] = [
            ["title", `${entity.id}.title`, "name"],
            ["description", templateKey(type, entity.id, table), "descriptionRaw"],
          ];
          for (const [field, key, prop] of fields) {
            const expected = norm(table[key]);
            if (!expected) continue;
            // Skip fields the site renders differently even at the latest version.
            const latestKey = field === "title" ? `${entity.id}.title` : templateKey(type, entity.id, current);
            if (norm(latest?.[prop]) !== norm(current[latestKey])) continue;
            compared += 1;
            const shown = norm(entity[prop]);
            if (shown === expected) continue;
            const kind: Kind =
              locale !== "kor" && HANGUL.test(shown) && !HANGUL.test(expected)
                ? "korean-leak"
                : words(shown) === words(expected)
                  ? "cosmetic"
                  : shown === norm(current[latestKey])
                    ? "stale"
                    : "other";
            findings.push({ version, locale, type, id: entity.id, field, kind, shown, expected });
          }
        }
      }
    }
    checked.push({ version, commit: commit.slice(0, 8), compared });
  }

  const lines: string[] = ["# Version x locale audit", ""];
  lines.push(`| version | snapshot | compared | wrong | ${KINDS.join(" | ")} |`, `| --- | --- | --- | --- | ${KINDS.map(() => "---").join(" | ")} |`);
  for (const row of checked) {
    const rows = findings.filter((f) => f.version === row.version);
    const count = (kind: Finding["kind"]) => rows.filter((f) => f.kind === kind).length;
    lines.push(`| ${row.version} | ${row.commit} | ${row.compared} | ${rows.length} | ${KINDS.map(count).join(" | ")} |`);
  }
  lines.push("", "## By locale (all versions)", "", "| locale | wrong |", "| --- | --- |");
  for (const locale of GAME_LOCALES) {
    lines.push(`| ${locale} | ${findings.filter((f) => f.locale === locale).length} |`);
  }
  lines.push("", "## By type and field", "", `| type | field | ${KINDS.join(" | ")} |`, `| --- | --- | ${KINDS.map(() => "---").join(" | ")} |`);
  for (const [type] of TABLES) {
    for (const field of ["title", "description"] as const) {
      const rows = findings.filter((f) => f.type === type && f.field === field);
      lines.push(`| ${type} | ${field} | ${KINDS.map((kind) => rows.filter((f) => f.kind === kind).length).join(" | ")} |`);
    }
  }
  for (const kind of KINDS) {
    lines.push("", `## Samples: ${kind}`, "");
    for (const f of findings.filter((item) => item.kind === kind).slice(0, samples)) {
      lines.push(`- v${f.version} ${f.locale} ${f.type} ${f.id} ${f.field}`);
      lines.push(`  - shown: ${JSON.stringify(f.shown)}`);
      lines.push(`  - game:  ${JSON.stringify(f.expected)}`);
    }
  }
  // Wording the Korean diffs got wrong; cosmetic rows left out.
  const korRows = findings.filter((f) => f.locale === "kor" && f.kind !== "cosmetic");
  lines.push("", `## Korean wording mismatches (${korRows.length})`, "");
  for (const f of korRows) {
    lines.push(`- v${f.version} ${f.type} ${f.id} ${f.field}: shown ${JSON.stringify(f.shown)} / game ${JSON.stringify(f.expected)}`);
  }

  // Independent check: authored Korean diffs carry the baked text players saw,
  // numbers included. The reconstructed Korean text should read the same.
  const changes = await getSTS2Changes();
  const authored: string[] = [];
  let authoredSame = 0;
  for (const change of changes) {
    const patch = change.patch.replace(/^v/, "");
    const diff = change.fieldDiffs?.find((item) => item.field === "description");
    const type = change.entityType as VersionedEntityType;
    if (!diff || typeof diff.before !== "string" || !TABLES.some(([t]) => t === type)) continue;
    const previous = selectable.find((version) => compareVersions(version, patch) < 0);
    if (!previous || compareVersions(previous, LOCALE_TEXT_PINNED_FROM) < 0) continue;
    const result = await getVersionedEntity<Entity>({ entityType: type, entityId: change.entityId, version: previous, locale: "kor" });
    const shown = norm(result.entity?.description);
    if (shown.replace(/\s+/g, "") === diff.before.replace(/\s+/g, "")) {
      authoredSame += 1;
      continue;
    }
    authored.push(`- ${type} ${change.entityId} v${previous} (diff ${change.patch})\n  - shown:    ${JSON.stringify(shown)}\n  - authored: ${JSON.stringify(diff.before)}`);
  }
  lines.push("", `## Korean text vs authored diffs (${authoredSame} same, ${authored.length} differ)`, "", ...authored);

  const jsonAt = args.indexOf("--json");
  if (jsonAt >= 0) writeFileSync(args[jsonAt + 1], `${JSON.stringify(findings, null, 1)}\n`);

  const report = `${lines.join("\n")}\n`;
  if (out) writeFileSync(out, report);
  console.log(report);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

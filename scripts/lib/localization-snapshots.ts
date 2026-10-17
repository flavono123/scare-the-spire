/**
 * Raw game localization as it was at each selectable version.
 *
 * `data/sts2/localization` is overwritten on every game sync, so each version's
 * tables live in git history. A version's snapshot is the last localization
 * commit made on or after its patch date and before the next patch. The current
 * version reads the working tree.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { compareVersions } from "../../src/lib/entity-versioning";
import type { GameLocale } from "../../src/lib/i18n";
import type { STS2Patch } from "../../src/lib/types";

export type LocalizationTable = Record<string, string>;

const ROOT = path.resolve(__dirname, "..", "..");
const LOCALIZATION = "data/sts2/localization";
/** Pseudo commit for the working tree. */
export const WORKING_TREE = "WORKTREE";

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
}

let commitLog: { hash: string; date: string }[] | null = null;

/** Last localization commit dated on or after `from` and before `until`. */
export function snapshotCommit(from: string, until: string | null): string | null {
  commitLog ??= git(["log", "--format=%H %cs", "--", `${LOCALIZATION}/`])
    .trim()
    .split("\n")
    .map((line) => {
      const [hash, date] = line.split(" ");
      return { hash, date };
    });
  const hit = commitLog.find(({ date }) => date >= from && (until === null || date < until));
  return hit?.hash ?? null;
}

export interface VersionSnapshot {
  version: string;
  commit: string;
}

/**
 * Snapshot for each of `versions` (oldest first) that has one. `currentVersion`
 * reads the working tree.
 */
export function versionSnapshots(
  versions: readonly string[],
  patches: readonly STS2Patch[],
  currentVersion: string,
): VersionSnapshot[] {
  const ordered = patches
    .filter((patch) => /^\d+\.\d+/.test(patch.version))
    .sort((a, b) => compareVersions(a.version, b.version));
  const snapshots: VersionSnapshot[] = [];
  for (const version of [...versions].sort(compareVersions)) {
    if (version === currentVersion) {
      snapshots.push({ version, commit: WORKING_TREE });
      continue;
    }
    const index = ordered.findIndex((patch) => patch.version === version);
    if (index < 0) continue;
    const next = ordered[index + 1] ?? null;
    const commit = snapshotCommit(ordered[index].date, next?.date ?? null);
    if (commit) snapshots.push({ version, commit });
  }
  return snapshots;
}

const tableCache = new Map<string, LocalizationTable>();

export function tableAt(commit: string, locale: GameLocale, table: string): LocalizationTable {
  const key = `${commit}:${locale}:${table}`;
  const cached = tableCache.get(key);
  if (cached) return cached;
  const file = `${LOCALIZATION}/${locale}/${table}.json`;
  let parsed: LocalizationTable = {};
  try {
    const raw = commit === WORKING_TREE
      ? readFileSync(path.join(ROOT, file), "utf8")
      : git(["show", `${commit}:${file}`]);
    parsed = JSON.parse(raw) as LocalizationTable;
  } catch {
    parsed = {};
  }
  tableCache.set(key, parsed);
  return parsed;
}

/**
 * Raw game localization as it was in each archived build.
 *
 * The build archive (STS2_BUILDS_DIR, default ~/sts2-builds, see AGENTS.md)
 * holds every build's own text tables at
 * `<version>/canonical/loc/<locale>/<table>.json`
 * (written by scripts/sts2_canonical_extract.py). A patch's snapshot is the
 * build of the same version. The current version falls back to the working
 * tree (`data/sts2/localization`, overwritten on every game sync) when it is
 * not archived yet.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { compareVersions } from "../../src/lib/entity-versioning";
import type { GameLocale } from "../../src/lib/i18n";
import type { STS2Patch } from "../../src/lib/types";

export type LocalizationTable = Record<string, string>;

export const BUILDS_DIR = process.env.STS2_BUILDS_DIR ?? path.join(os.homedir(), "sts2-builds");

const ROOT = path.resolve(__dirname, "..", "..");
const LOCALIZATION = "data/sts2/localization";
/** Pseudo build for the working tree. */
export const WORKING_TREE = "WORKTREE";

export interface VersionSnapshot {
  /** The patch's version label, as the patch list spells it (e.g. "0.98", "0.103.1"). */
  version: string;
  /** Archive directory name, or WORKING_TREE. */
  build: string;
}

/** Archived builds that carry extracted localization, oldest first. */
export function archivedBuilds(): string[] {
  if (!existsSync(BUILDS_DIR)) return [];
  return readdirSync(BUILDS_DIR)
    .filter((dir) => /^\d+\.\d+\.\d+$/.test(dir) && existsSync(path.join(BUILDS_DIR, dir, "canonical", "loc", "kor")))
    .sort(compareVersions);
}

/**
 * Snapshots for every patch from `from` up to `currentVersion` (oldest first)
 * whose build is archived. A patch without a build is left out and reported in
 * `missing`; a build without a patch entry (a hotfix the patch list does not
 * know) is reported in `unlisted`. Either way, the text change folds into the
 * next snapshot. `currentVersion` reads the working tree when its build is not
 * archived.
 */
export function versionSnapshots(
  from: string,
  patches: readonly STS2Patch[],
  currentVersion: string,
): { snapshots: VersionSnapshot[]; missing: string[]; unlisted: string[] } {
  const archived = archivedBuilds();
  const ordered = patches
    .filter((patch) => /^\d+\.\d+/.test(patch.version))
    .sort((a, b) => compareVersions(a.version, b.version));
  const snapshots: VersionSnapshot[] = [];
  const missing: string[] = [];
  for (const { version } of ordered) {
    if (compareVersions(version, from) < 0 || compareVersions(version, currentVersion) > 0) continue;
    const build = archived.find((dir) => compareVersions(dir, version) === 0);
    if (build) snapshots.push({ version, build });
    else if (compareVersions(version, currentVersion) === 0) snapshots.push({ version, build: WORKING_TREE });
    else missing.push(version);
  }
  const unlisted = archived.filter(
    (dir) => compareVersions(dir, from) >= 0
      && compareVersions(dir, currentVersion) <= 0
      && !snapshots.some(({ version }) => compareVersions(version, dir) === 0),
  );
  return { snapshots, missing, unlisted };
}

const tableCache = new Map<string, LocalizationTable>();

export function tableAt(build: string, locale: GameLocale, table: string): LocalizationTable {
  const key = `${build}:${locale}:${table}`;
  const cached = tableCache.get(key);
  if (cached) return cached;
  const file = build === WORKING_TREE
    ? path.join(ROOT, LOCALIZATION, locale, `${table}.json`)
    : path.join(BUILDS_DIR, build, "canonical", "loc", locale, `${table}.json`);
  const parsed: LocalizationTable = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as LocalizationTable) : {};
  tableCache.set(key, parsed);
  return parsed;
}

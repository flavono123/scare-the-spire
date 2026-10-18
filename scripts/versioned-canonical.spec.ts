/**
 * Regression test: the versioned entity API must not drift further from the
 * canonical per-build data (game dll + PCK of every archived build).
 *
 * Known drift is listed in scripts/versioned-canonical-baseline.json. A mismatch
 * that is not in the baseline fails the test; baseline entries that no longer
 * mismatch are reported so they can be removed (`--update-baseline` rewrites it).
 * Without the build archive (see AGENTS.md) the test is skipped.
 *
 *   pnpm test:version-canonical [--update-baseline] [--version 0.100.0]
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { BUILDS_DIR, runAudit, type Mismatch } from "./audit-version-api-canonical";

const BASELINE = path.join(__dirname, "versioned-canonical-baseline.json");
const key = (m: Mismatch) => `${m.type}:${m.id}:${m.field}`;

async function main() {
  const arg = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
  const only = arg("--version");
  const { versions, mismatches } = await runAudit(only);
  if (versions.length === 0) {
    console.log(`SKIP: build archive missing or not extracted (${BUILDS_DIR})`);
    return;
  }
  const current: Record<string, string[]> = {};
  for (const m of mismatches) (current[m.version] ??= []).push(key(m));
  for (const v of Object.keys(current)) current[v].sort();

  if (process.argv.includes("--update-baseline")) {
    const prev = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, "utf-8")) : {};
    const next = only ? { ...prev, [only]: current[only] ?? [] } : current;
    fs.writeFileSync(BASELINE, JSON.stringify(next, null, 0).replace(/\],"/g, "],\n\"") + "\n");
    console.log(`baseline written: ${Object.values(next).reduce((n: number, a: any) => n + a.length, 0)} entries`);
    return;
  }

  const baseline: Record<string, string[]> = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, "utf-8")) : {};
  const fresh: string[] = [];
  const fixed: string[] = [];
  for (const v of versions) {
    const known = new Set(baseline[v] ?? []);
    const now = new Set(current[v] ?? []);
    for (const k of now) if (!known.has(k)) fresh.push(`${v} ${k}`);
    for (const k of known) if (!now.has(k)) fixed.push(`${v} ${k}`);
  }
  if (fixed.length) console.log(`${fixed.length} baseline entries no longer mismatch (run --update-baseline to drop them), e.g. ${fixed.slice(0, 3).join("; ")}`);
  assert.equal(fresh.length, 0, `new drift from canonical build data (${fresh.length}):\n${fresh.slice(0, 40).join("\n")}`);
  console.log(`OK: ${versions.length} builds, ${mismatches.length} known mismatches, no new drift`);
}

main().catch((e) => { console.error(e); process.exit(1); });

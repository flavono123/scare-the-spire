/**
 * Audit the versioned entity API against the canonical per-build data extracted
 * from the archived game builds (scripts/sts2_canonical_extract.py).
 *
 * The archive lives outside the repo (STS2_BUILDS_DIR, default ~/sts2-builds).
 * Without it the audit reports "archive missing" and nothing is compared.
 *
 *   pnpm tsx scripts/audit-version-api-canonical.ts [--json out.json] [--version 0.100.0]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getVersionedEntities } from "../src/lib/versioned-entity-api";
import type { VersionedEntityType } from "../src/lib/types";

export const BUILDS_DIR = process.env.STS2_BUILDS_DIR ?? path.join(os.homedir(), "sts2-builds");

export interface Mismatch {
  version: string;
  type: string;
  id: string;
  field: string;
  api: unknown;
  canonical: unknown;
}

type Canon = Record<string, Record<string, any>>;
type Entity = Record<string, any>;

const MIN_VERSION = [0, 98, 0];

function versionParts(v: string): number[] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function atLeast(v: number[], min: number[]): boolean {
  for (let i = 0; i < 3; i++) if (v[i] !== min[i]) return v[i] > min[i];
  return true;
}

export function archivedVersions(): string[] {
  if (!fs.existsSync(BUILDS_DIR)) return [];
  return fs
    .readdirSync(BUILDS_DIR)
    .filter((d) => versionParts(d) && atLeast(versionParts(d)!, MIN_VERSION))
    .filter((d) => fs.existsSync(path.join(BUILDS_DIR, d, "canonical", "monsters.json")))
    .sort((a, b) => {
      const pa = versionParts(a)!, pb = versionParts(b)!;
      return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2];
    });
}

function readCanon(version: string, kind: string): Canon {
  return JSON.parse(fs.readFileSync(path.join(BUILDS_DIR, version, "canonical", `${kind}.json`), "utf-8"));
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const DATA_DIR = path.join(process.cwd(), "data/sts2");

/** The API serves Korean display strings; pair the repo's kor/eng tables to translate them back. */
function displayToEnglish(table: string, fields: string[]): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = Object.fromEntries(fields.map((f) => [f, {}]));
  const read = (lang: string): Entity[] => JSON.parse(fs.readFileSync(path.join(DATA_DIR, lang, `${table}.json`), "utf-8"));
  const eng = new Map(read("eng").map((e) => [e.id, e]));
  for (const k of read("kor")) {
    const e = eng.get(k.id);
    if (!e) continue;
    for (const f of fields) {
      const kv = k[f], ev = e[f];
      if (Array.isArray(kv) && Array.isArray(ev)) kv.forEach((x: string, i: number) => { if (ev[i] !== undefined) out[f][x] = ev[i]; });
      else if (typeof kv === "string" && typeof ev === "string") out[f][kv] = ev;
    }
  }
  return out;
}

const tr = (map: Record<string, string>, v: unknown) => (typeof v === "string" ? (map[v] ?? v) : v);
const rarityWord = (v: unknown) => (typeof v === "string" ? v.split(" ")[0] : v);
const pair = (v: any) => (v ? { normal: v.normal ?? null, ascension: v.ascension ?? null } : undefined);
const IGNORED_ID = /^(DEPRECATED_|MOCK_|MULTI_ATTACK_MOVE|ONE_HP_MONSTER|BIG_DUMMY|ATTACK_MOVE|GENERIC$|OSTY$)/;

function pushDiff(out: Mismatch[], version: string, type: string, id: string, field: string, api: unknown, canonical: unknown) {
  if (IGNORED_ID.test(id)) return;
  if (!same(api, canonical)) out.push({ version, type, id, field, api, canonical });
}

function auditCards(version: string, api: Map<string, Entity>, canon: Canon, out: Mismatch[]) {
  const T = displayToEnglish("cards", ["type", "rarity", "target", "keywords"]);
  for (const [id, c] of Object.entries(canon)) {
    const e = api.get(id);
    if (!e) { if (!IGNORED_ID.test(id)) out.push({ version, type: "card", id, field: "(exists)", api: null, canonical: "present" }); continue; }
    if (!c.isXCost) pushDiff(out, version, "card", id, "cost", e.cost, c.cost);
    else pushDiff(out, version, "card", id, "isXCost", Boolean(e.isXCost ?? e.is_x_cost), true);
    pushDiff(out, version, "card", id, "type", tr(T.type, e.type), c.type);
    pushDiff(out, version, "card", id, "rarity", tr(T.rarity, e.rarity), c.rarity);
    for (const [k, v] of Object.entries<number>(c.vars)) {
      if (e.vars?.[k] !== undefined) pushDiff(out, version, "card", id, `vars.${k}`, e.vars[k], v);
      else if (k.endsWith("Power") === false && !(k in (e.vars ?? {}))) pushDiff(out, version, "card", id, `vars.${k}`, undefined, v);
    }
    // Upgrade: numeric deltas keyed by lowercase var name, plus cost.
    const up = (e.upgrade ?? {}) as Record<string, string | number>;
    for (const [k, d] of Object.entries<number>(c.upgrade.vars)) {
      const raw = up[k.toLowerCase()] ?? up[k.toLowerCase().replace(/power$/, "")];
      const apiDelta = raw === undefined ? undefined : Number(String(raw).replace("+", ""));
      pushDiff(out, version, "card", id, `upgrade.${k}`, apiDelta, d);
    }
    if (c.upgrade.cost !== null) {
      const raw = up.cost;
      // API stores the upgraded cost, canonical stores the delta.
      const apiUpgraded = raw === undefined ? undefined : Number(raw);
      pushDiff(out, version, "card", id, "upgrade.cost", apiUpgraded, c.cost + c.upgrade.cost);
    }
    if (c.keywords !== null) pushDiff(out, version, "card", id, "keywords", [...(e.keywords ?? [])].map((k: string) => tr(T.keywords, k)).sort(), [...c.keywords].sort());
  }
  for (const id of api.keys()) if (!canon[id] && !IGNORED_ID.test(id)) out.push({ version, type: "card", id, field: "(exists)", api: "present", canonical: null });
}

function auditVarsAndRarity(type: string, version: string, api: Map<string, Entity>, canon: Canon, out: Mismatch[], rarityMap: Record<string, string> = {}) {
  for (const [id, c] of Object.entries(canon)) {
    const e = api.get(id);
    if (!e) { if (!IGNORED_ID.test(id)) out.push({ version, type, id, field: "(exists)", api: null, canonical: "present" }); continue; }
    if ("rarity" in c) pushDiff(out, version, type, id, "rarity", rarityWord(tr(rarityMap, e.rarity)), c.rarity);
    for (const [k, v] of Object.entries<number>(c.vars)) pushDiff(out, version, type, id, `vars.${k}`, e.vars?.[k], v);
  }
  for (const id of api.keys()) if (!canon[id] && !IGNORED_ID.test(id)) out.push({ version, type, id, field: "(exists)", api: "present", canonical: null });
}

function auditMonsters(version: string, api: Map<string, Entity>, canon: Canon, out: Mismatch[]) {
  for (const [id, c] of Object.entries(canon)) {
    if (c.error) continue;
    const e = api.get(id);
    if (!e) { if (!IGNORED_ID.test(id)) out.push({ version, type: "monster", id, field: "(exists)", api: null, canonical: "present" }); continue; }
    if (c.minHp !== null) {
      pushDiff(out, version, "monster", id, "minHp", e.minHp, c.minHp);
      pushDiff(out, version, "monster", id, "minHpAscension", e.minHpAscension, c.minHpAscension);
    }
    const apiDmg = e.damageValues ?? {};
    for (const [k, v] of Object.entries<any>(c.damageValues)) pushDiff(out, version, "monster", id, `damageValues.${k}`, pair(apiDmg[k]), pair(v));
    for (const k of Object.keys(apiDmg)) if (!(k in c.damageValues)) pushDiff(out, version, "monster", id, `damageValues.${k}`, pair(apiDmg[k]), undefined);
    const apiBlk = e.blockValues ?? {};
    for (const [k, v] of Object.entries<any>(c.blockValues)) pushDiff(out, version, "monster", id, `blockValues.${k}`, pair(apiBlk[k]), pair(v));
    const apiMoves = (e.moves ?? []).map((m: any) => m.id);
    if (c.moveIds.length > 0) pushDiff(out, version, "monster", id, "moveIds", [...apiMoves].sort(), [...c.moveIds].sort());
    if (c.moveGraph) {
      const g = e.moveGraph;
      pushDiff(out, version, "monster", id, "moveGraph.initial", g?.initial, c.moveGraph.initial);
      const edges = (x: any[] | undefined) => (x ?? []).map((t: any) => `${t.from ?? t[0]}>${t.to ?? t[1]}`).sort();
      pushDiff(out, version, "monster", id, "moveGraph.edges", edges(g?.transitions), edges(c.moveGraph.transitions));
    }
  }
}

export async function runAudit(onlyVersion?: string): Promise<{ versions: string[]; mismatches: Mismatch[] }> {
  const versions = archivedVersions().filter((v) => !onlyVersion || v === onlyVersion);
  const mismatches: Mismatch[] = [];
  for (const version of versions) {
    const tag = `v${version}`;
    const load = async (type: VersionedEntityType) => {
      const rows = await getVersionedEntities<Entity & { id: string }>({ entityType: type, version: tag, locale: "eng" });
      return new Map(rows.filter((r) => r.entity).map((r) => [r.entityId, r.entity as Entity]));
    };
    auditCards(version, await load("card"), readCanon(version, "cards"), mismatches);
    auditVarsAndRarity("relic", version, await load("relic"), readCanon(version, "relics"), mismatches, displayToEnglish("relics", ["rarity"]).rarity);
    auditVarsAndRarity("potion", version, await load("potion"), readCanon(version, "potions"), mismatches, displayToEnglish("potions", ["rarity"]).rarity);
    const powers = Object.fromEntries(Object.entries(readCanon(version, "powers")).map(([id, v]) => [id.replace(/_POWER$/, ""), v]));
    auditVarsAndRarity("power", version, await load("power"), powers, mismatches);
    auditMonsters(version, await load("monster"), readCanon(version, "monsters"), mismatches);
  }
  return { versions, mismatches };
}

if (process.argv[1] && process.argv[1].endsWith("audit-version-api-canonical.ts")) {
  const arg = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
  runAudit(arg("--version")).then(({ versions, mismatches }) => {
    if (versions.length === 0) { console.log(`archive missing or empty: ${BUILDS_DIR}`); return; }
    const byVersion = new Map<string, Map<string, number>>();
    for (const m of mismatches) {
      const t = byVersion.get(m.version) ?? new Map();
      t.set(m.type, (t.get(m.type) ?? 0) + 1);
      byVersion.set(m.version, t);
    }
    for (const v of versions) console.log(v.padEnd(8), JSON.stringify(Object.fromEntries(byVersion.get(v) ?? [])));
    console.log(`total mismatches: ${mismatches.length}`);
    const out = arg("--json");
    if (out) fs.writeFileSync(out, JSON.stringify(mismatches, null, 1));
  });
}

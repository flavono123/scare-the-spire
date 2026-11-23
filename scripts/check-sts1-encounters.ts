/**
 * Self-check for data/sts1/encounters.json (written by
 * `python3 scripts/extract-sts1-compendium.py --only encounters`).
 *
 * Usage: tsx scripts/check-sts1-encounters.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Ref = { id: string; count: number };
type Composition = { monsters: Ref[]; choices?: { pick: number; from: Ref[] }[] };
type Encounter = Composition & { key: string; slug: string; variants?: Composition[] };

// Encounter keys the game gives no name (getEncounterName returns ""). None today.
const UNNAMED_ALLOWLIST = new Set<string>();

const root = join(__dirname, "..", "data", "sts1");
const read = (path: string) => JSON.parse(readFileSync(join(root, path), "utf8"));
const encounters: Encounter[] = read("encounters.json").encounters;
const monsterIds = new Set((read("monsters.json") as { id: string }[]).map((row) => row.id));
const names = { kor: read("localization/kor/encounters.json"), eng: read("localization/eng/encounters.json") };

const errors: string[] = [];
const slugs = new Set<string>();
for (const encounter of encounters) {
  if (slugs.has(encounter.slug)) errors.push(`duplicate slug ${encounter.slug}`);
  slugs.add(encounter.slug);
  const parts = [encounter, ...(encounter.variants ?? [])];
  const refs = parts.flatMap((part) => [...part.monsters, ...(part.choices ?? []).flatMap((choice) => choice.from)]);
  if (refs.length === 0) errors.push(`${encounter.key}: no monsters`);
  for (const ref of refs) {
    if (!monsterIds.has(ref.id)) errors.push(`${encounter.key}: unknown monster ${ref.id}`);
  }
  for (const [locale, table] of Object.entries(names)) {
    if (!table[encounter.key] && !UNNAMED_ALLOWLIST.has(encounter.key)) errors.push(`${encounter.key}: no ${locale} name`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`${encounters.length} encounters checked`);

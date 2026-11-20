/**
 * Validates data/sts1/events/*.json (schema in data/sts1/events/README.md):
 * every text index exists in every locale, every var/scene/id resolves, every
 * scene is reachable, and reports DESCRIPTIONS/OPTIONS indices no scene uses.
 *
 * Usage: tsx scripts/check-sts1-events.ts [--strict]   (--strict fails on unused indices)
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { Sts1RawEvent, Sts1RawPart } from "../src/lib/sts1/events";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data/sts1");
const LOCALES = ["kor", "eng", "zhs", "jpn", "deu", "fra", "ita", "spa", "ptb", "rus", "pol", "tha", "tur"];
const CHARACTERS = new Set(["ironclad", "silent", "defect", "watcher"]);
// Strings only the card-select grid shows; the schema has no field for them.
const GRID_PROMPTS: Record<string, { o?: number[]; d?: number[] }> = {
  "Accursed Blacksmith": { o: [3], d: [3] },
  "Back to Basics": { o: [2] },
  Beggar: { o: [6] },
  "Bonfire Elementals": { o: [3] },
  Designer: { o: [15, 16, 17] },
  "Drug Dealer": { o: [5] },
  Duplicator: { o: [2] },
  "Golden Wing": { o: [9] },
  "Living Wall": { o: [3, 4, 5] },
  "The Cleric": { o: [7] },
  "The Library": { o: [4] },
  "Wheel of Change": { o: [9] },
  Purifier: { o: [2] },
  Transmorgrifier: { o: [2] },
  "Upgrade Shrine": { o: [2] },
  NoteForYourself: { d: [2] },
  // OPTIONS[2] ("Reveal the Boss") is never added; DESCRIPTIONS[3] is " ".
  "Knowing Skull": { o: [2], d: [3] },
  // Requires Humanity: unused by ForgottenAltar.
  "Forgotten Altar": { o: [5] },
};

type Loc = Record<string, { NAME?: string; DESCRIPTIONS?: string[]; OPTIONS?: string[] }>;
const read = <T,>(file: string): T => JSON.parse(readFileSync(path.join(DATA, file), "utf8")) as T;
const ids = (file: string) => new Set(read<{ id: string }[]>(file).map((row) => row.id));
const known = { card: ids("cards.json"), relic: ids("relics.json"), potion: ids("potions.json"), monster: ids("monsters.json") };
const locs = Object.fromEntries(LOCALES.map((locale) => [locale, read<Loc>(`localization/${locale}/events.json`)]));
const strict = process.argv.includes("--strict");

const errors: string[] = [];
const unused: string[] = [];
const files = readdirSync(path.join(DATA, "events")).filter((name) => name.endsWith(".json"));

for (const file of files) {
  const event = read<Sts1RawEvent>(`events/${file}`);
  const where = (scene: string, detail: string) => `${file} ${scene}: ${detail}`;
  if (!locs.eng[event.id]) errors.push(`${file}: no events.json entry ${event.id}`);
  for (const id of event.mentionMonsters ?? []) if (!known.monster.has(id)) errors.push(`${file}: mentioned monster ${id}`);
  const used = { d: new Set<number>(), o: new Set<number>() };
  const checkParts = (scene: string, parts: readonly Sts1RawPart[] | undefined) => {
    for (const part of parts ?? []) {
      if ("d" in part || "o" in part) {
        const key = "d" in part ? "d" : "o";
        const index = "d" in part ? part.d : part.o;
        const owner = part.ev ?? event.id;
        if (!part.ev) used[key].add(index);
        for (const locale of LOCALES) {
          const table = key === "d" ? locs[locale][owner]?.DESCRIPTIONS : locs[locale][owner]?.OPTIONS;
          if (!table || table[index] === undefined) errors.push(where(scene, `${locale} ${owner} ${key}${index} missing`));
        }
      } else if ("v" in part && typeof part.v === "string" && !event.vars?.[part.v]) {
        errors.push(where(scene, `var ${part.v} undefined`));
      } else if ("card" in part && !known.card.has(part.card)) errors.push(where(scene, `card ${part.card}`));
      else if ("relic" in part && !known.relic.has(part.relic)) errors.push(where(scene, `relic ${part.relic}`));
      else if ("potion" in part && !known.potion.has(part.potion)) errors.push(where(scene, `potion ${part.potion}`));
    }
  };
  const checkRef = (scene: string, ref: { type: string; id?: string; pool?: string[] | string } | undefined) => {
    if (!ref) return;
    const set = known[ref.type as keyof typeof known];
    if (!set) return errors.push(where(scene, `ref type ${ref.type}`));
    if (ref.id && !set.has(ref.id)) errors.push(where(scene, `${ref.type} ${ref.id} unknown`));
    if (Array.isArray(ref.pool)) for (const id of ref.pool) if (!set.has(id)) errors.push(where(scene, `${ref.type} ${id} unknown`));
  };
  const reachable = new Set<string>([event.start]);
  const queue = [event.start];
  if (!event.scenes[event.start]) errors.push(`${file}: start ${event.start} missing`);
  while (queue.length) {
    const key = queue.shift()!;
    const scene = event.scenes[key];
    if (!scene) continue;
    checkParts(key, scene.body);
    for (const variant of scene.bodyVariants ?? []) {
      checkParts(key, variant.body);
      for (const character of variant.characters ?? []) if (!CHARACTERS.has(character)) errors.push(where(key, `character ${character}`));
      if (variant.monster && !known.monster.has(variant.monster)) errors.push(where(key, `monster ${variant.monster}`));
    }
    for (const option of scene.options) {
      checkParts(key, option.label);
      checkParts(key, option.lockedLabel);
      [option.preview, ...(option.gains ?? []), ...(option.loses ?? []), ...(option.mentions ?? [])].forEach((ref) => checkRef(key, ref));
      for (const group of option.combat?.encounters ?? []) {
        for (const id of group) if (!known.monster.has(id)) errors.push(where(key, `monster ${id}`));
      }
      const targets = [
        ...(option.next ? [option.next] : []),
        ...(option.outcomes ?? []).map((outcome) => {
          [...(outcome.gains ?? []), ...(outcome.loses ?? [])].forEach((ref) => checkRef(key, ref));
          return outcome.next;
        }),
      ];
      if (option.next === undefined && !option.outcomes) errors.push(where(key, "option has neither next nor outcomes"));
      for (const target of targets) {
        if (!event.scenes[target]) errors.push(where(key, `next ${target} missing`));
        else if (!reachable.has(target)) {
          reachable.add(target);
          queue.push(target);
        }
      }
    }
  }
  for (const key of Object.keys(event.scenes)) if (!reachable.has(key)) errors.push(`${file}: scene ${key} unreachable`);
  const skip = GRID_PROMPTS[event.id] ?? {};
  for (const key of ["d", "o"] as const) {
    const table = (key === "d" ? locs.eng[event.id]?.DESCRIPTIONS : locs.eng[event.id]?.OPTIONS) ?? [];
    table.forEach((text, index) => {
      if (used[key].has(index) || skip[key]?.includes(index) || !text.trim()) return;
      unused.push(`${file} ${key}${index}: ${text.slice(0, 60)}`);
    });
  }
}

console.log(`${files.length} events checked`);
if (unused.length) console.log(`unused text:\n  ${unused.join("\n  ")}`);
if (errors.length) {
  console.error(`errors:\n  ${errors.join("\n  ")}`);
  process.exit(1);
}
if (strict && unused.length) process.exit(1);

import { cache } from "react";
import { readFile } from "fs/promises";
import path from "path";
import type { GameLocale } from "@/lib/i18n";
import { getSts1Monsters } from "./data";
import { getSts1Events, getSts1RawEvents } from "./events";
import { sts1GameLocale } from "./locale";
import { sts1MonsterImageUrl } from "./paths";
import type { Sts1Dungeon } from "./types";

export type Sts1EncounterPool = "weak" | "strong" | "elite" | "boss" | "event";
type MonsterCount = { id: string; count: number };
type RawEncounter = {
  key: string;
  slug: string;
  dungeons: Sts1Dungeon[];
  pools: Sts1EncounterPool[];
  weights?: Record<string, number>;
  events?: string[];
  monsters: MonsterCount[];
  choices?: { pick: number; from: MonsterCount[]; independent?: boolean }[];
  variants?: { monsters: MonsterCount[] }[];
};

export type Sts1EncounterMonster = { slug: string; name: string; imageUrl: string; count: number };

export interface Sts1Encounter {
  key: string;
  slug: string;
  legacySlugs: string[];
  name: string;
  nameEn: string;
  dungeons: Sts1Dungeon[];
  pools: Sts1EncounterPool[];
  /** "<dungeon>:<pool>" -> MonsterInfo weight in that act's list. */
  weights: Record<string, number>;
  events: { slug: string; name: string }[];
  monsters: Sts1EncounterMonster[];
  /** Random parts: pick N of these (draws with replacement when independent). */
  choices: { pick: number; independent: boolean; from: Sts1EncounterMonster[] }[];
  /** Whole compositions one coin flip chooses between. */
  variants: Sts1EncounterMonster[][];
}

async function readNames(gameLocale: GameLocale): Promise<Record<string, string>> {
  const file = path.join(process.cwd(), "data/sts1/localization", sts1GameLocale(gameLocale), "encounters.json");
  return JSON.parse(await readFile(file, "utf8")) as Record<string, string>;
}

/** MonsterHelper's encounters: the act lists and weights each comes from, and who it fields. */
export const getSts1Encounters = cache(async (gameLocale: GameLocale = "kor"): Promise<Sts1Encounter[]> => {
  const [raw, names, engNames, monsters, events, rawEvents] = await Promise.all([
    readFile(path.join(process.cwd(), "data/sts1/encounters.json"), "utf8").then((text) => (JSON.parse(text) as { encounters: RawEncounter[] }).encounters),
    readNames(gameLocale),
    readNames("eng"),
    getSts1Monsters(gameLocale),
    getSts1Events(gameLocale),
    getSts1RawEvents(),
  ]);
  const monsterById = new Map(monsters.map((monster) => [monster.id, monster]));
  const eventById = new Map(events.map((event) => [event.id, event]));
  // Encounter data names the event class ("Colosseum"); event rows keep "city.Colosseum".
  const eventByClass = new Map(rawEvents.flatMap((event) => {
    const row = eventById.get(event.id);
    return row ? [[event.className.split(".").at(-1) ?? event.className, row] as const] : [];
  }));
  const resolve = (rows: readonly MonsterCount[]): Sts1EncounterMonster[] => rows.flatMap(({ id, count }) => {
    const monster = monsterById.get(id);
    return monster ? [{ slug: monster.slug, name: monster.name, imageUrl: sts1MonsterImageUrl(monster), count }] : [];
  });
  return raw.map((row) => ({
    key: row.key,
    slug: row.slug,
    legacySlugs: [],
    name: names[row.key] ?? row.key,
    nameEn: engNames[row.key] ?? row.key,
    dungeons: row.dungeons,
    pools: row.pools,
    weights: row.weights ?? {},
    events: (row.events ?? []).flatMap((className) => {
      const event = eventByClass.get(className);
      return event ? [{ slug: event.slug, name: event.name }] : [];
    }),
    monsters: resolve(row.monsters),
    choices: (row.choices ?? []).map((choice) => ({ pick: choice.pick, independent: Boolean(choice.independent), from: resolve(choice.from) })),
    variants: (row.variants ?? []).map((variant) => resolve(variant.monsters)),
  }));
});

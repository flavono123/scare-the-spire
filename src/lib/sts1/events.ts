import { cache } from "react";
import { readdir, readFile } from "fs/promises";
import path from "path";
import type { GameLocale } from "@/lib/i18n";
import { getSts1Cards, getSts1Monsters, getSts1Potions, getSts1Powers, getSts1Relics } from "./data";
import { sts1GameLocale } from "./locale";
import {
  sts1CardPortraitUrl,
  sts1MonsterImageUrl,
  sts1PotionImageUrl,
  sts1PowerImageUrl,
  sts1RelicImageUrl,
} from "./paths";
import type {
  Sts1CharacterId,
  Sts1Dungeon,
  Sts1EntityRefs,
  Sts1Event,
  Sts1EventGroup,
  Sts1EventOption,
  Sts1EventScene,
  Sts1ItemRef,
  Sts1TextTemplate,
  Sts1VarTier,
} from "./types";

const DATA_ROOT = path.join(process.cwd(), "data", "sts1");

/** A part of a game text before localization (data/sts1/events/README.md). */
export type Sts1RawPart =
  | { d: number; ev?: string }
  | { o: number; ev?: string }
  | { t: number }
  | { v: string | number | { min: number; max: number } }
  | { s: string }
  | { card: string }
  | { relic: string }
  | { potion: string }
  | { pick: "card" | "relic" | "potion"; color?: "r" };

type RawOption = Omit<Sts1EventOption, "label" | "lockedLabel"> & {
  label: Sts1RawPart[];
  lockedLabel?: Sts1RawPart[];
  note?: string;
};
type RawScene = Omit<Sts1EventScene, "body" | "bodyVariants" | "options"> & {
  body: Sts1RawPart[];
  bodyVariants?: { characters?: Sts1CharacterId[]; monster?: string; body: Sts1RawPart[] }[];
  options: RawOption[];
  note?: string;
};
export type Sts1RawEvent = {
  id: string;
  className: string;
  kind: "image" | "room";
  image: string | null;
  start: string;
  vars?: Record<string, Sts1VarTier[]>;
  scenes: Record<string, RawScene>;
};

type EventLoc = Record<string, { NAME?: string; DESCRIPTIONS?: string[]; OPTIONS?: string[] }>;
type NameLoc = Record<string, { name: string }>;

type EventPools = {
  lists: { name: string; dungeon: string | null; ids: string[] }[];
};

const POOL_DUNGEONS: Record<string, Sts1Dungeon> = {
  exordium: "exordium",
  theCity: "city",
  theBeyond: "beyond",
  theEnding: "ending",
};

// Reached from the act 3 boss chest, not drawn from a list.
const EVENT_DUNGEON_OVERRIDES: Record<string, Sts1Dungeon[]> = {
  "Spire Heart": ["beyond"],
};

export function sts1EventSlug(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(path.join(DATA_ROOT, relativePath), "utf8")) as T;
}

export const getSts1RawEvents = cache(async (): Promise<Sts1RawEvent[]> => {
  const files = (await readdir(path.join(DATA_ROOT, "events"))).filter((name) => name.endsWith(".json")).sort();
  return Promise.all(files.map((name) => readJson<Sts1RawEvent>(`events/${name}`)));
});

export interface Sts1TextSources {
  events: EventLoc;
  cards: NameLoc;
  relics: NameLoc;
  potions: NameLoc;
  /** `{ t: i }` parts: TEXT of the table the caller names. */
  table?: string[];
  /** What a `{ pick }` part shows: the item the player's own deck/relics/potions supplies. */
  pick?: Record<"card" | "relic" | "potion", string>;
}

/** Localizes parts into a template; numbers stay `{ v }` refs for the ascension the viewer picks. */
export function resolveSts1Parts(parts: readonly Sts1RawPart[], sources: Sts1TextSources, eventId?: string): Sts1TextTemplate {
  const out: Sts1TextTemplate = [];
  const push = (text: string | undefined) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (typeof last === "string") out[out.length - 1] = last + text;
    else out.push(text);
  };
  for (const part of parts) {
    if ("d" in part) push(sources.events[part.ev ?? eventId ?? ""]?.DESCRIPTIONS?.[part.d]);
    else if ("o" in part) push(sources.events[part.ev ?? eventId ?? ""]?.OPTIONS?.[part.o]);
    else if ("t" in part) push(sources.table?.[part.t]);
    else if ("s" in part) push(part.s);
    else if ("card" in part) push(sources.cards[part.card]?.name ?? part.card);
    else if ("relic" in part) push(sources.relics[part.relic]?.name ?? part.relic);
    else if ("potion" in part) push(sources.potions[part.potion]?.name ?? part.potion);
    // The player's own item; FontHelper.colorString prefixes each word with #r.
    else if ("pick" in part) push(`${part.color ? `#${part.color}` : ""}${sources.pick?.[part.pick] ?? "???"}`);
    else if ("v" in part) {
      if (typeof part.v === "string") out.push({ v: part.v });
      else push(typeof part.v === "number" ? String(part.v) : `${part.v.min}–${part.v.max}`);
    }
  }
  return out;
}

export const getSts1TextSources = cache(async (gameLocale: GameLocale = "kor"): Promise<Sts1TextSources> => {
  const locale = sts1GameLocale(gameLocale);
  const [events, cards, relics, potions] = await Promise.all([
    readJson<EventLoc>(`localization/${locale}/events.json`),
    readJson<NameLoc>(`localization/${locale}/cards.json`),
    readJson<NameLoc>(`localization/${locale}/relics.json`),
    readJson<NameLoc>(`localization/${locale}/potions.json`),
  ]);
  return { events, cards, relics, potions };
});

function eventGroups(id: string, pools: EventPools): { groups: Sts1EventGroup[]; dungeons: Sts1Dungeon[] } {
  const groups = new Set<Sts1EventGroup>();
  const dungeons = new Set<Sts1Dungeon>(EVENT_DUNGEON_OVERRIDES[id] ?? []);
  for (const list of pools.lists) {
    if (!list.ids.includes(id)) continue;
    const dungeon = list.dungeon ? POOL_DUNGEONS[list.dungeon] : null;
    if (list.name === "specialOneTimeEventList") groups.add("special");
    if (list.name === "shrineList") groups.add("shrine");
    if (dungeon) {
      dungeons.add(dungeon);
      if (list.name === "eventList") groups.add(dungeon === "ending" ? "beyond" : dungeon as Sts1EventGroup);
    }
  }
  return { groups: [...groups], dungeons: [...dungeons] };
}

export const getSts1Events = cache(async (gameLocale: GameLocale = "kor"): Promise<Sts1Event[]> => {
  const locale = sts1GameLocale(gameLocale);
  const [raw, sources, eng, pools] = await Promise.all([
    getSts1RawEvents(),
    getSts1TextSources(gameLocale),
    locale === "eng" ? Promise.resolve(null) : readJson<EventLoc>("localization/eng/events.json"),
    readJson<EventPools>("event-pools.json"),
  ]);
  return raw.map((event): Sts1Event => {
    const resolve = (parts: readonly Sts1RawPart[]) => resolveSts1Parts(parts, sources, event.id);
    const scenes = Object.fromEntries(Object.entries(event.scenes).map(([key, scene]) => [key, {
      body: resolve(scene.body),
      ...(scene.bodyVariants ? {
        bodyVariants: scene.bodyVariants.map((variant) => ({ ...variant, body: resolve(variant.body) })),
      } : {}),
      ...(scene.image !== undefined ? { image: scene.image } : {}),
      options: scene.options.map(({ note: _note, label, lockedLabel, ...option }) => ({
        ...option,
        label: resolve(label),
        ...(lockedLabel ? { lockedLabel: resolve(lockedLabel) } : {}),
      })),
    } satisfies Sts1EventScene]));
    const name = sources.events[event.id]?.NAME ?? event.id;
    return {
      id: event.id,
      slug: sts1EventSlug(event.id),
      legacySlugs: [],
      name,
      nameEn: eng?.[event.id]?.NAME ?? name,
      kind: event.kind,
      image: event.image,
      ...eventGroups(event.id, pools),
      vars: event.vars ?? {},
      start: event.start,
      scenes,
    };
  });
});

export async function getSts1Event(id: string, gameLocale: GameLocale = "kor"): Promise<Sts1Event | undefined> {
  const needle = id.toLowerCase();
  return (await getSts1Events(gameLocale)).find((event) => event.slug === needle);
}

export function sts1ItemRefIds(refs: readonly (Sts1ItemRef | undefined)[]): Record<"card" | "relic" | "potion", Set<string>> {
  const ids = { card: new Set<string>(), relic: new Set<string>(), potion: new Set<string>() };
  for (const ref of refs) {
    if (!ref) continue;
    if (ref.id) ids[ref.type].add(ref.id);
    if (Array.isArray(ref.pool)) ref.pool.forEach((id) => ids[ref.type].add(id));
  }
  return ids;
}

/** The refs every option of these events names, plus the cards a random curse draws from. */
export function sts1EventItemRefs(events: readonly Sts1Event[]): { items: Sts1ItemRef[]; monsters: string[] } {
  const items: Sts1ItemRef[] = [];
  const monsters: string[] = [];
  for (const event of events) {
    for (const scene of Object.values(event.scenes)) {
      for (const option of scene.options) {
        if (option.preview) items.push(option.preview);
        items.push(...(option.gains ?? []), ...(option.loses ?? []));
        for (const outcome of option.outcomes ?? []) items.push(...(outcome.gains ?? []), ...(outcome.loses ?? []));
        for (const group of option.combat?.encounters ?? []) monsters.push(...group);
      }
      for (const variant of scene.bodyVariants ?? []) if (variant.monster) monsters.push(variant.monster);
    }
  }
  return { items, monsters };
}

/**
 * Names, links and art for these game ids. `curse` adds the cards
 * `AbstractDungeon.getCurse()` draws from (CardLibrary curses minus the special ones).
 */
export async function getSts1EntityRefs(
  wanted: { items?: readonly Sts1ItemRef[]; monsters?: readonly string[]; powers?: readonly string[]; blights?: readonly string[] },
  gameLocale: GameLocale = "kor",
): Promise<Sts1EntityRefs> {
  const ids = sts1ItemRefIds(wanted.items ?? []);
  const curse = (wanted.items ?? []).some((ref) => ref.pool === "curse");
  const [cards, relics, potions, monsters, powers] = await Promise.all([
    getSts1Cards(gameLocale),
    getSts1Relics(gameLocale),
    getSts1Potions(gameLocale),
    wanted.monsters?.length ? getSts1Monsters(gameLocale) : Promise.resolve([]),
    wanted.powers?.length ? getSts1Powers(gameLocale) : Promise.resolve([]),
  ]);
  const curseIds = new Set(sts1CursePool(cards));
  const monsterIds = new Set(wanted.monsters ?? []);
  const powerIds = new Set(wanted.powers ?? []);
  return {
    card: Object.fromEntries(cards
      .filter((card) => ids.card.has(card.id) || (curse && curseIds.has(card.id)))
      .map((card) => [card.id, { slug: card.slug, name: card.name, imageUrl: sts1CardPortraitUrl(card) }])),
    relic: Object.fromEntries(relics
      .filter((relic) => ids.relic.has(relic.id))
      .map((relic) => [relic.id, { slug: relic.slug, name: relic.name, imageUrl: sts1RelicImageUrl(relic) }])),
    potion: Object.fromEntries(potions
      .filter((potion) => ids.potion.has(potion.id))
      .map((potion) => [potion.id, { slug: potion.slug, name: potion.name, imageUrl: sts1PotionImageUrl(potion) }])),
    monster: Object.fromEntries(monsters
      .filter((monster) => monsterIds.has(monster.id))
      .map((monster) => [monster.id, { slug: monster.slug, name: monster.name, imageUrl: sts1MonsterImageUrl(monster) }])),
    power: Object.fromEntries(powers
      .filter((power) => powerIds.has(power.id))
      .map((power) => [power.id, { slug: power.slug, name: power.name, imageUrl: sts1PowerImageUrl(power) }])),
    blight: {},
    ...(curse ? { cursePool: [...curseIds] } : {}),
  };
}

// AbstractDungeon.getCurse → CardLibrary.getCurse skips these (CurseOfTheBell, Necronomicurse, AscendersBane, Pride).
const NON_RANDOM_CURSES = new Set(["AscendersBane", "CurseOfTheBell", "Necronomicurse", "Pride"]);

export function sts1CursePool(cards: readonly { id: string; color: string; rarity: string }[]): string[] {
  return cards.filter((card) => card.color === "curse" && card.rarity === "curse" && !NON_RANDOM_CURSES.has(card.id)).map((card) => card.id);
}

import { cache } from "react";
import { readFile } from "fs/promises";
import path from "path";
import type { GameLocale } from "@/lib/i18n";
import {
  getSts1Cards,
  getSts1Keywords,
  getSts1Potions,
  getSts1Powers,
  getSts1Relics,
  getSts1UiLabels,
} from "./data";
import { getSts1EntityRefs, getSts1TextSources, resolveSts1Parts, type Sts1RawPart } from "./events";
import { sts1KeywordNameOccurs } from "./keyword-tips";
import { sts1GameLocale } from "./locale";
import {
  sts1BlightImageUrl,
  sts1CardPortraitUrl,
  sts1OrbImageUrl,
  sts1PotionImageUrl,
  sts1PowerImageUrl,
  sts1RelicImageUrl,
  sts1RunModUrl,
} from "./paths";
import type {
  Sts1Achievement,
  Sts1Ascension,
  Sts1Blight,
  Sts1CompendiumKeyword,
  Sts1EntityRefs,
  Sts1EventLabels,
  Sts1ItemRef,
  Sts1Mention,
  Sts1Modifier,
  Sts1Monster,
  Sts1Neow,
  Sts1NeowReward,
  Sts1RefType,
  Sts1ScoreBonus,
  Sts1TextTemplate,
} from "./types";

const DATA_ROOT = path.join(process.cwd(), "data", "sts1");

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(path.join(DATA_ROOT, relativePath), "utf8")) as T;
}

async function readLoc<T>(gameLocale: GameLocale, file: string): Promise<T> {
  return readJson<T>(`localization/${sts1GameLocale(gameLocale)}/${file}`);
}

type UiTables = Record<string, { TEXT?: string[]; EXTRA_TEXT?: string[] } | null>;

export const getSts1UiExtras = cache(async (gameLocale: GameLocale = "kor"): Promise<UiTables> => (
  readLoc<UiTables>(gameLocale, "ui-extras.json")
));

/** Template to plain text, for numbers the data fixes (no ascension tiers). */
function plainTemplate(template: Sts1TextTemplate): string {
  return template.map((part) => (typeof part === "string" ? part : "")).join("");
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** `{ v: { of: "maxHp", pct } }` and friends, which the shared part resolver keeps as text. */
function numberParts(parts: readonly RawPart[]): Sts1RawPart[] {
  return parts.map((part) => {
    if ("v" in part && typeof part.v === "object" && part.v && "of" in part.v) {
      const value = part.v as { of: string; pct?: number; frac?: [number, number] };
      return { s: value.frac ? `${value.frac[0]}/${value.frac[1]}` : value.pct != null ? `${value.pct}%` : "X" };
    }
    if ("u" in part) return { s: "" };
    return part as Sts1RawPart;
  });
}

type RawPart = Sts1RawPart | { u: number } | { v: { of: string; pct?: number; frac?: [number, number]; formula?: string } };

function resolveTable(parts: readonly RawPart[], table: string[] | undefined, unique?: string[]): string {
  const out: string[] = [];
  for (const part of parts) {
    if ("u" in part) out.push(unique?.[part.u] ?? "");
    else out.push(plainTemplate(resolveSts1Parts(numberParts([part]), { events: {}, cards: {}, relics: {}, potions: {}, table })));
  }
  return out.join("");
}

// ---------------------------------------------------------------- events

export const getSts1EventLabels = cache(async (gameLocale: GameLocale = "kor"): Promise<Sts1EventLabels> => {
  const [labels, sources] = await Promise.all([getSts1UiLabels(gameLocale), getSts1TextSources(gameLocale)]);
  const korean = sts1GameLocale(gameLocale) === "kor";
  return {
    title: labels.listTitles.events,
    groups: {
      exordium: `${labels.monsters.dungeons.exordium.act} ${labels.monsters.dungeons.exordium.name}`,
      city: `${labels.monsters.dungeons.city.act} ${labels.monsters.dungeons.city.name}`,
      beyond: `${labels.monsters.dungeons.beyond.act} ${labels.monsters.dungeons.beyond.name}`,
      shrine: korean ? "사당" : "Shrine",
      special: labels.shared,
    },
    dungeons: labels.monsters.dungeons,
    characters: labels.characters,
    ascension: labels.monsters.ascension,
    proceed: sources.events["Proceed Screen"]?.DESCRIPTIONS?.[0] ?? "",
  };
});

// ---------------------------------------------------------------- keywords

type OrbLoc = Record<string, { NAME: string; DESCRIPTION: string[] }>;

/** Orb.updateDescription: DESCRIPTION[0] + passive + DESCRIPTION[1] + evoke + DESCRIPTION[2] (base amounts). */
const ORB_AMOUNTS: Record<string, { image: string; amounts: number[] }> = {
  Lightning: { image: "lightning", amounts: [3, 8] },
  Frost: { image: "frost", amounts: [2, 5] },
  Dark: { image: "dark", amounts: [6, 6] },
  // Plasma.updateDescription draws the passive as an [E] orb and inserts only the evoke amount.
  Plasma: { image: "plasma", amounts: [2] },
  Empty: { image: "empty", amounts: [] },
};
const ORB_ORDER = ["Lightning", "Frost", "Dark", "Plasma", "Empty"];
const STANCE_ORDER = ["Wrath", "Calm", "Divinity"];
/** StanceAuraEffect particle colors (the middle of each random range). */
const STANCE_COLORS: Record<string, string> = {
  Wrath: "rgb(166 13 38)",
  Calm: "rgb(134 166 255)",
  Divinity: "rgb(166 13 166)",
};

function interleave(parts: string[], amounts: number[]): string {
  return parts.map((part, index) => `${part}${index < amounts.length ? amounts[index] : ""}`).join("");
}

/** Game elements a keyword's text names that the game does not tip. */
const KEYWORD_MENTIONS: Record<string, Sts1Mention[]> = {
  FATAL: [{ type: "power", id: "Minion" }],
};

export const getSts1CompendiumKeywords = cache(async (gameLocale: GameLocale = "kor"): Promise<Sts1CompendiumKeyword[]> => {
  const locale = sts1GameLocale(gameLocale);
  const [keywords, engKeywords, orbs, engOrbs, stances, engStances, cards, relics, potions, powers] = await Promise.all([
    getSts1Keywords(gameLocale),
    getSts1Keywords("eng"),
    readLoc<OrbLoc>(gameLocale, "orbs.json"),
    readJson<OrbLoc>("localization/eng/orbs.json"),
    readLoc<OrbLoc>(gameLocale, "stances.json"),
    readJson<OrbLoc>("localization/eng/stances.json"),
    getSts1Cards(gameLocale),
    getSts1Relics(gameLocale),
    getSts1Potions(gameLocale),
    getSts1Powers(gameLocale),
  ]);
  const engById = new Map(engKeywords.map((keyword) => [keyword.id, keyword]));
  const texts = [
    ...cards.filter((card) => card.rarity !== "special" || card.color !== "curse").map((card) => ({
      type: "cards" as const, slug: card.slug, name: card.name, imageUrl: sts1CardPortraitUrl(card),
      text: `${card.description} ${card.upgradeDescription}`,
    })),
    ...relics.filter((relic) => relic.tier !== "deprecated").map((relic) => ({
      type: "relics" as const, slug: relic.slug, name: relic.name, imageUrl: sts1RelicImageUrl(relic), text: relic.description,
    })),
    ...potions.map((potion) => ({
      type: "potions" as const, slug: potion.slug, name: potion.name, imageUrl: sts1PotionImageUrl(potion), text: potion.description,
    })),
    ...powers.map((power) => ({
      type: "powers" as const, slug: power.slug, name: power.name, imageUrl: sts1PowerImageUrl(power), text: power.description,
    })),
  ].map((row) => ({ ...row, text: row.text.replace(/#[rgbyp]/g, "").replace(/\bNL\b/g, " ") }));
  const usersOf = (names: readonly string[]) => texts
    .filter((row) => names.some((name) => sts1KeywordNameOccurs(row.text, name)))
    .map((row) => ({ type: row.type, slug: row.slug, name: row.name, imageUrl: row.imageUrl }));

  const rows: Sts1CompendiumKeyword[] = keywords.map((keyword) => ({
    id: keyword.id,
    slug: slugify(keyword.id),
    legacySlugs: [],
    kind: "keyword",
    name: keyword.names[0],
    nameEn: engById.get(keyword.id)?.names[0] ?? keyword.names[0],
    names: keyword.names,
    description: keyword.description,
    image: null,
    users: usersOf(keyword.names),
    mentions: KEYWORD_MENTIONS[keyword.id] ?? [],
  }));
  for (const id of ORB_ORDER) {
    const orb = orbs[id] ?? engOrbs[id];
    if (!orb) continue;
    const { image, amounts } = ORB_AMOUNTS[id];
    rows.push({
      id: `orb-${id}`,
      slug: `orb-${slugify(id)}`,
      legacySlugs: [],
      kind: "orb",
      name: orb.NAME,
      nameEn: engOrbs[id]?.NAME ?? orb.NAME,
      names: [orb.NAME],
      description: interleave(orb.DESCRIPTION, amounts),
      image,
      users: id === "Empty" ? [] : usersOf([orb.NAME]),
      mentions: [],
    });
  }
  for (const id of STANCE_ORDER) {
    const stance = stances[id] ?? engStances[id];
    if (!stance?.NAME) continue;
    rows.push({
      id: `stance-${id}`,
      slug: `stance-${slugify(id)}`,
      legacySlugs: [],
      kind: "stance",
      name: stance.NAME,
      nameEn: engStances[id]?.NAME ?? stance.NAME,
      names: [stance.NAME],
      description: stance.DESCRIPTION.join(""),
      image: null,
      color: STANCE_COLORS[id],
      users: usersOf([stance.NAME]),
      mentions: [],
    });
  }
  void locale;
  return rows;
});

export async function getSts1CompendiumKeyword(id: string, gameLocale: GameLocale = "kor") {
  return (await getSts1CompendiumKeywords(gameLocale)).find((row) => row.slug === id.toLowerCase());
}

/** Section titles: the keyword list's own name, "Orb", and the game's word for stance (keyword STANCE). */
export async function getSts1KeywordKindLabels(gameLocale: GameLocale = "kor") {
  const [labels, keywords] = await Promise.all([getSts1UiLabels(gameLocale), getSts1Keywords(gameLocale)]);
  const korean = sts1GameLocale(gameLocale) === "kor";
  return {
    keyword: labels.listTitles.keywords,
    orb: korean ? "구체" : "Orbs",
    stance: keywords.find((keyword) => keyword.id === "STANCE")?.names[0] ?? "Stance",
  };
}

// ---------------------------------------------------------------- ascension

type AscensionData = { levels: { level: number; index: number; monsterStats: boolean; mentions?: Sts1Mention[] }[] };

export const getSts1Ascensions = cache(async (gameLocale: GameLocale = "kor"): Promise<Sts1Ascension[]> => {
  const [data, ui] = await Promise.all([readJson<AscensionData>("ascension.json"), getSts1UiExtras(gameLocale)]);
  const text = ui.AscensionModeDescriptions?.TEXT ?? [];
  return data.levels.map((level) => ({
    level: level.level,
    slug: String(level.level),
    legacySlugs: [],
    description: text[level.index] ?? "",
    monsterStats: level.monsterStats,
    mentions: level.mentions ?? [],
  }));
});

export async function getSts1Ascension(id: string, gameLocale: GameLocale = "kor") {
  return (await getSts1Ascensions(gameLocale)).find((row) => row.slug === id);
}

// ---------------------------------------------------------------- modifiers

type RawModRef = { type: Sts1RefType; id?: string; pool?: string | string[]; tier?: string };
type RawMod = {
  id: string;
  screenIndex: number | null;
  color: string | null;
  icon: string | null;
  dailyGroup: string | null;
  exclusive: string[];
  refs: RawModRef[];
};
type ModLoc = Record<string, { NAME: string; DESCRIPTION: string }>;

export type Sts1ModifierRow = Sts1Modifier & {
  onScreen: boolean;
  /** One of ModHelper's daily lists (starter, generic, difficulty) draws it. */
  daily: boolean;
  blightRefs: string[];
};

export const getSts1Modifiers = cache(async (gameLocale: GameLocale = "kor"): Promise<Sts1ModifierRow[]> => {
  const [data, loc, eng, blights] = await Promise.all([
    readJson<{ mods: RawMod[] }>("run-mods.json"),
    readLoc<ModLoc>(gameLocale, "run-mods.json"),
    readJson<ModLoc>("localization/eng/run-mods.json"),
    readJson<RawBlights>("blights.json"),
  ]);
  return data.mods.map((mod) => {
    const text = loc[mod.id] ?? eng[mod.id] ?? { NAME: mod.id, DESCRIPTION: "" };
    const blightRefs = mod.refs.flatMap((ref) => {
      if (ref.type !== "blight") return [];
      if (ref.pool === "endless") return [...blights.pools.endless.everyLoop, ...blights.pools.endless.uniqueSequence];
      if (ref.pool === "chestBlights") return blights.pools.chestBlights.ids;
      return ref.id ? [ref.id] : [];
    });
    return {
      id: mod.id,
      slug: slugify(mod.id),
      legacySlugs: [],
      name: text.NAME,
      nameEn: eng[mod.id]?.NAME ?? text.NAME,
      description: text.DESCRIPTION,
      color: mod.color,
      icon: mod.icon ? mod.icon.replace(/\.png$/, "") : null,
      dailyOnly: false,
      exclusive: mod.exclusive.map(slugify),
      mentions: mod.refs.filter((ref) => (ref.type === "power" || ref.type === "modifier" || ref.type === "keyword") && ref.id)
        .map((ref) => ({ type: ref.type, id: ref.id! })),
      refs: mod.refs.filter((ref): ref is Sts1ItemRef & RawModRef => ref.type === "card" || ref.type === "relic" || ref.type === "potion")
        .map((ref) => ({ type: ref.type, ...(ref.id ? { id: ref.id } : {}), ...(Array.isArray(ref.pool) ? { pool: ref.pool } : {}), ...(ref.tier ? { tier: ref.tier } : {}) })),
      onScreen: mod.screenIndex != null,
      daily: mod.dailyGroup === "starter" || mod.dailyGroup === "generic" || mod.dailyGroup === "difficulty",
      blightRefs,
    };
  });
});

export async function getSts1Modifier(id: string, gameLocale: GameLocale = "kor") {
  return (await getSts1Modifiers(gameLocale)).find((row) => row.slug === id.toLowerCase());
}

export async function getSts1ModifierLabels(gameLocale: GameLocale = "kor") {
  const ui = await getSts1UiExtras(gameLocale);
  const korean = sts1GameLocale(gameLocale) === "kor";
  return {
    title: ui.CustomModeScreen?.TEXT?.[6] ?? "Modifiers",
    customMode: ui.CustomModeScreen?.TEXT?.[0] ?? "Custom Mode",
    daily: ui.DailyScreen?.TEXT?.[0] ?? "Daily Challenge",
    // Not on the Custom Mode screen nor in any daily list: text and classes left in the game, unplayable.
    deprecated: korean ? "폐기됨" : "Deprecated",
    exclusive: korean ? "같이 쓸 수 없는 모드" : "Can't be used with",
  };
}

// ---------------------------------------------------------------- blights

type RawBlight = {
  id: string;
  image: string;
  unique: boolean;
  description: RawPart[];
  stackDescription?: RawPart[];
  refs?: Sts1Mention[];
};
type RawBlights = {
  blights: RawBlight[];
  pools: { chestBlights: { ids: string[] }; endless: { everyLoop: string[]; uniqueSequence: string[] } };
};
type BlightLoc = Record<string, { NAME: string; DESCRIPTION: string[] }>;

/** `{ v: { of: "counter" } }` reads the blight's counter; the stacked text shows it as N. */
function counterParts(parts: readonly RawPart[]): RawPart[] {
  return parts.map((part) => ("v" in part && typeof part.v === "object" && part.v && "of" in part.v && part.v.of === "counter" ? { s: "N" } : part));
}

export const getSts1Blights = cache(async (gameLocale: GameLocale = "kor"): Promise<Sts1Blight[]> => {
  const [data, loc, eng] = await Promise.all([
    readJson<RawBlights>("blights.json"),
    readLoc<BlightLoc>(gameLocale, "blights.json"),
    readJson<BlightLoc>("localization/eng/blights.json"),
  ]);
  return data.blights.map((blight) => {
    const text = loc[blight.id] ?? eng[blight.id] ?? { NAME: blight.id, DESCRIPTION: [] };
    return {
      id: blight.id,
      slug: slugify(blight.id),
      legacySlugs: [],
      name: text.NAME,
      nameEn: eng[blight.id]?.NAME ?? text.NAME,
      description: resolveTable(blight.description, text.DESCRIPTION),
      stackDescription: blight.stackDescription ? resolveTable(counterParts(blight.stackDescription), text.DESCRIPTION) : null,
      image: sts1BlightImageUrl(blight.image),
      unique: blight.unique,
      mentions: blight.refs ?? [],
    };
  });
});

export async function getSts1Blight(id: string, gameLocale: GameLocale = "kor") {
  return (await getSts1Blights(gameLocale)).find((row) => row.slug === id.toLowerCase());
}

export async function getSts1BlightRefs(ids: readonly string[], gameLocale: GameLocale = "kor"): Promise<Sts1EntityRefs["blight"]> {
  const blights = await getSts1Blights(gameLocale);
  const wanted = new Set(ids);
  return Object.fromEntries(blights.filter((row) => wanted.has(row.id)).map((row) => [row.id, { slug: row.slug, name: row.name, imageUrl: row.image }]));
}

/**
 * Refs for a page: item refs (pools and tiers included) plus mentions of any type,
 * so text and tokens can link keywords, mods and blights next to cards and monsters.
 */
export async function getSts1PageRefs(
  { items = [], mentions = [] }: { items?: readonly Sts1ItemRef[]; mentions?: readonly Sts1Mention[] },
  gameLocale: GameLocale = "kor",
): Promise<Sts1EntityRefs> {
  const of = (type: Sts1RefType) => new Set(mentions.filter((mention) => mention.type === type).map((mention) => mention.id));
  const itemMentions = mentions
    .filter((mention) => mention.type === "card" || mention.type === "relic" || mention.type === "potion")
    .map((mention) => ({ type: mention.type as Sts1ItemRef["type"], id: mention.id }));
  const keywordIds = of("keyword");
  const modIds = of("modifier");
  const [refs, blights, keywords, mods] = await Promise.all([
    getSts1EntityRefs({ items: [...items, ...itemMentions], monsters: [...of("monster")], powers: [...of("power")] }, gameLocale),
    getSts1BlightRefs([...of("blight")], gameLocale),
    keywordIds.size ? getSts1CompendiumKeywords(gameLocale) : Promise.resolve([]),
    modIds.size ? getSts1Modifiers(gameLocale) : Promise.resolve([]),
  ]);
  return {
    ...refs,
    blight: { ...refs.blight, ...blights },
    keyword: Object.fromEntries(keywords.filter((row) => keywordIds.has(row.slug))
      .map((row) => [row.slug, { slug: row.slug, name: row.name, imageUrl: row.image ? sts1OrbImageUrl(row.image) : "" }])),
    modifier: Object.fromEntries(mods.filter((row) => modIds.has(row.slug))
      .map((row) => [row.slug, { slug: row.slug, name: row.name, imageUrl: row.icon ? sts1RunModUrl(row.icon) : "" }])),
  };
}

// ---------------------------------------------------------------- Neow

type RawNeowReward = { type: string; label: RawPart[]; refs?: RawModRef[]; excludedDrawbacks?: string[] };
type RawNeow = {
  categories: { index: number; rewards: RawNeowReward[] }[];
  drawbacks: RawNeowReward[];
  miniBlessing: { rewards: RawNeowReward[] };
  dialog: { blessing: { text: number }; miniBlessing: { text: { min: number } } };
};
type NeowLoc = {
  event: { NAMES?: string[]; TEXT?: string[]; OPTIONS?: string[] };
  reward: { TEXT?: string[]; UNIQUE_REWARDS?: string[] };
};

export type Sts1NeowData = Sts1Neow & {
  miniGreeting: string;
  mini: Sts1NeowReward[];
  /** Category 2 pairs the game never offers together (drawback type → reward types). */
  excluded: Record<string, string[]>;
};

export const getSts1Neow = cache(async (gameLocale: GameLocale = "kor"): Promise<Sts1NeowData> => {
  const [data, loc] = await Promise.all([readJson<RawNeow>("neow.json"), readLoc<NeowLoc>(gameLocale, "neow.json")]);
  const toReward = (reward: RawNeowReward): Sts1NeowReward => ({
    type: reward.type,
    label: resolveTable(reward.label, loc.reward.TEXT, loc.reward.UNIQUE_REWARDS),
    refs: (reward.refs ?? [])
      .filter((ref) => (ref.type === "card" || ref.type === "relic" || ref.type === "potion") && ref.id)
      .map((ref) => ({ type: ref.type as Sts1ItemRef["type"], id: ref.id })),
  });
  const drawbacks = data.drawbacks.map(toReward);
  return {
    name: loc.event.NAMES?.[0] ?? "Neow",
    greeting: loc.event.TEXT?.[data.dialog.blessing.text] ?? "",
    miniGreeting: loc.event.TEXT?.[data.dialog.miniBlessing.text.min] ?? "",
    categories: data.categories.map((category) => ({
      index: category.index,
      rewards: category.rewards.map(toReward),
      drawbacks: category.index === 2 ? drawbacks : [],
    })),
    mini: data.miniBlessing.rewards.map(toReward),
    excluded: neowExclusions(data),
  };
});

/** NeowReward.getRewardOptions(2) skips a reward whose `excludedDrawbacks` holds the rolled drawback. */
function neowExclusions(data: RawNeow): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const reward of data.categories.find((category) => category.index === 2)?.rewards ?? []) {
    for (const drawback of reward.excludedDrawbacks ?? []) (out[drawback] ??= []).push(reward.type);
  }
  return out;
}

type NpcSpine = Record<string, { skeleton: string; idle: string; animations: string[]; viewport: Sts1Monster["spine"] extends infer S ? S extends { viewport: infer V } ? V : never : never; still: { x: number; y: number; width: number; height: number } }>;

/** Neow's skeleton (scripts/render-sts1-monsters.mjs --npcs), shaped for the bestiary's stage. */
export async function getSts1NeowStage(gameLocale: GameLocale = "kor"): Promise<Sts1Monster> {
  const [spine, neow] = await Promise.all([readJson<NpcSpine>("npc-spine.json"), getSts1Neow(gameLocale)]);
  const art = spine.neow;
  return {
    id: "Neow",
    slug: "neow",
    legacySlugs: [],
    dungeon: "exordium",
    type: "normal",
    hitPoints: [],
    name: neow.name,
    nameEn: "Neow",
    moves: [],
    startingEffects: [],
    spine: {
      idle: art.idle,
      animations: art.animations,
      viewport: art.viewport,
      still: art.still,
      skeletonUrl: `/spine/sts1/npcs/neow/${art.skeleton}`,
      atlasUrl: "/spine/sts1/npcs/neow/skeleton.atlas",
    },
    vfx: null,
  };
}

export async function getSts1NeowLabels(gameLocale: GameLocale = "kor") {
  const korean = sts1GameLocale(gameLocale) === "kor";
  // NeowEvent draws category 0-3 on buttons 1-4 and names none of them, so the filter goes by position.
  return korean
    ? { filter: "선택지", slots: ["첫 번째 선택지", "두 번째 선택지", "세 번째 선택지", "네 번째 선택지"], mini: "첫 보스에 닿지 못한 다음 판" }
    : { filter: "Option", slots: ["1st option", "2nd option", "3rd option", "4th option"], mini: "After a run that missed the first boss" };
}

// ---------------------------------------------------------------- achievements

type RawAchievement = { key: string; index: number; image: string; hidden: boolean; refs: { type: Sts1RefType | "character"; id: string }[] };
type AchievementLoc = { AchievementGrid: { NAMES: string[]; TEXT: string[] } };

export const getSts1Achievements = cache(async (gameLocale: GameLocale = "kor"): Promise<Sts1Achievement[]> => {
  const [data, loc, eng] = await Promise.all([
    readJson<{ items: RawAchievement[] }>("achievements.json"),
    readLoc<AchievementLoc>(gameLocale, "achievements.json"),
    readJson<AchievementLoc>("localization/eng/achievements.json"),
  ]);
  return data.items.map((item) => ({
    key: item.key,
    slug: slugify(item.key),
    legacySlugs: [],
    name: loc.AchievementGrid.NAMES[item.index] ?? item.key,
    nameEn: eng.AchievementGrid.NAMES[item.index] ?? item.key,
    description: loc.AchievementGrid.TEXT[item.index] ?? "",
    image: item.image,
    hidden: item.hidden,
    refs: item.refs,
  }));
});

export async function getSts1Achievement(id: string, gameLocale: GameLocale = "kor") {
  return (await getSts1Achievements(gameLocale)).find((row) => row.slug === id.toLowerCase());
}

// ---------------------------------------------------------------- score bonuses

type RawScoreLine = {
  id: string | null;
  text?: { death?: [string, number]; victory?: [string, number] };
  points?: { fixed?: number; per?: number; of?: string; percent?: number; increasing?: boolean };
  screens: ("death" | "victory")[];
  unused?: boolean;
  refs?: { type: Sts1RefType; id: string }[];
};
type ScoreLoc = Record<string, { NAME: string; DESCRIPTIONS: string[] }>;

export type Sts1ScoreBonusRow = Sts1ScoreBonus & { unused: boolean; total: boolean; refs: { type: Sts1RefType; id: string }[] };

function formatPoints(points: RawScoreLine["points"]): string {
  if (!points) return "";
  if (points.fixed != null) return points.fixed > 0 ? `+${points.fixed}` : String(points.fixed);
  if (points.percent != null) return `+${points.percent}% × N`;
  if (points.per != null) return points.increasing ? `${points.per} × N(N+1)/2` : `${points.per} × N`;
  return "";
}

export const getSts1ScoreBonuses = cache(async (gameLocale: GameLocale = "kor"): Promise<Sts1ScoreBonusRow[]> => {
  const [data, loc, eng, ui] = await Promise.all([
    readJson<{ lines: RawScoreLine[] }>("score-bonuses.json"),
    readLoc<ScoreLoc>(gameLocale, "score-bonuses.json"),
    readJson<ScoreLoc>("localization/eng/score-bonuses.json"),
    getSts1UiExtras(gameLocale),
  ]);
  const uiText = (ref: [string, number] | undefined) => {
    if (!ref) return "";
    const table = ref[0].replace(/^ui\.json\s+/, "").replace(/\s+TEXT$/, "");
    return ui[table]?.TEXT?.[ref[1]] ?? "";
  };
  return data.lines.map((line, index) => {
    const text = line.id ? loc[line.id] ?? eng[line.id] : null;
    const name = text?.NAME ?? uiText(line.text?.death ?? line.text?.victory);
    const total = !line.id && !line.points;
    return {
      id: line.id ?? `line-${index}`,
      slug: line.id ? slugify(line.id) : `line-${index}`,
      legacySlugs: [],
      name,
      nameEn: (line.id ? eng[line.id]?.NAME : undefined) ?? name,
      description: text?.DESCRIPTIONS?.[0] ?? "",
      points: formatPoints(line.points),
      screens: line.screens,
      unused: Boolean(line.unused),
      total,
      refs: line.refs ?? [],
    };
  });
});

export async function getSts1ScoreBonus(id: string, gameLocale: GameLocale = "kor") {
  return (await getSts1ScoreBonuses(gameLocale)).find((row) => !row.total && row.slug === id.toLowerCase());
}

export async function getSts1ScoreLabels(gameLocale: GameLocale = "kor") {
  const ui = await getSts1UiExtras(gameLocale);
  const korean = sts1GameLocale(gameLocale) === "kor";
  return {
    title: ui.DeathScreen?.TEXT?.[6] ?? "Score",
    death: ui.DeathScreen?.TEXT?.[9] ?? "Defeat",
    victory: ui.VictoryScreen?.TEXT?.[12] ?? "Victory",
    unused: korean ? "게임에서 쓰지 않는 점수 보너스" : "Score bonuses the game never awards",
  };
}

export { getSts1EntityRefs };

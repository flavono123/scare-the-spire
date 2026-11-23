import { cache } from "react";
import { readFile } from "fs/promises";
import path from "path";
import type { GameLocale } from "@/lib/i18n";
import {
  getSts1Achievements,
  getSts1Ascensions,
  getSts1Blights,
  getSts1CompendiumKeywords,
  getSts1Modifiers,
  getSts1Neow,
  getSts1ScoreBonuses,
} from "./compendium-extras";
import {
  getSts1Cards,
  getSts1Characters,
  getSts1Monsters,
  getSts1Potions,
  getSts1Powers,
  getSts1Relics,
  getSts1UiLabels,
} from "./data";
import { getSts1Events, sts1EventItemRefs } from "./events";
import { sts1KeywordNameOccurs } from "./keyword-tips";
import { matchSts1Name, parseSts1Pieces } from "./smart-words";
import type { Sts1ItemRef, Sts1ResourceType, Sts1TextTemplate } from "./types";

/** Every kind a related rail can list, in the order the rail lists them. */
export const STS1_RELATED_KINDS = [
  "cards",
  "relics",
  "potions",
  "powers",
  "keywords",
  "monsters",
  "characters",
  "events",
  "modifiers",
  "blights",
  "ascensions",
  "achievements",
  "score-bonuses",
  "neow",
] as const satisfies readonly Sts1ResourceType[];

export type Sts1RelatedKind = (typeof STS1_RELATED_KINDS)[number];
export type Sts1RelatedItem = { slug: string; name: string };
export type Sts1RelatedGroup = { kind: Sts1RelatedKind; items: Sts1RelatedItem[]; label?: string };

/** Why two resources are linked; the audit report groups by it. */
export type Sts1RelationSource =
  | "text"
  | "keyword"
  | "power-source"
  | "monster-move"
  | "event"
  | "character"
  | "modifier"
  | "mention"
  | "card-preview"
  | "ascension"
  | "achievement"
  | "score-bonus"
  | "neow";

type NodeKey = `${Sts1RelatedKind}:${string}`;
type RelationExtras = {
  cardPreviews: Record<string, string[]>;
  ascension: Record<string, { monsters?: string[]; events?: string[] }>;
};

const ASCENSION_SLUG = (level: number) => String(level);
// Levels that change the player rather than a monster or event: start damaged (6), one potion slot fewer (11), lower max HP (14).
const PLAYER_ASCENSION_LEVELS = new Set([6, 11, 14]);

// Colored words that spell a name but mean something else: prose ("#p어둠의 #p지배"), a description of
// another item ("#y장식된 #y단검" is the Ritual Dagger card), or a translation that names the Dark orb "어둠".
const TEXT_MISREADS = new Set([
  "events:fountain-of-cleansing|cards:darkness",
  "events:fountain-of-cleansing|cards:establishment",
  "events:fountain-of-cleansing|powers:establishmentpower",
  "events:nest|monsters:dagger",
  "relics:symbiotic-virus|cards:darkness",
]);
const TEXT_MEANT: [string, string][] = [["relics:symbiotic-virus", "keywords:orb-dark"]];

function node(kind: Sts1RelatedKind, slug: string): NodeKey {
  return `${kind}:${slug}`;
}

function templateText(template: Sts1TextTemplate): string {
  return template.map((part) => (typeof part === "string" ? part : " ")).join("");
}

/**
 * Who links to whom across the STS1 compendium, both ways. Built once from Korean text
 * (links are by slug, so every locale shares them); names come per locale in `getSts1Related`.
 */
export const getSts1RelationGraph = cache(async () => {
  const [
    cards, relics, potions, powers, monsters, characters, events,
    keywords, mods, blights, ascensions, achievements, scores, neow, extras,
  ] = await Promise.all([
    getSts1Cards("kor"),
    getSts1Relics("kor"),
    getSts1Potions("kor"),
    getSts1Powers("kor"),
    getSts1Monsters("kor"),
    getSts1Characters("kor"),
    getSts1Events("kor"),
    getSts1CompendiumKeywords("kor"),
    getSts1Modifiers("kor"),
    getSts1Blights("kor"),
    getSts1Ascensions("kor"),
    getSts1Achievements("kor"),
    getSts1ScoreBonuses("kor"),
    getSts1Neow("kor"),
    readFile(path.join(process.cwd(), "data/sts1/relation-extras.json"), "utf8").then((raw) => JSON.parse(raw) as RelationExtras),
  ]);

  const slugOf = {
    card: new Map(cards.map((row) => [row.id, row.slug])),
    relic: new Map(relics.map((row) => [row.id, row.slug])),
    potion: new Map(potions.map((row) => [row.id, row.slug])),
    power: new Map(powers.map((row) => [row.id, row.slug])),
    monster: new Map(monsters.map((row) => [row.id, row.slug])),
    character: new Map(characters.map((row) => [row.id, row.slug])),
    event: new Map(events.map((row) => [row.id, row.slug])),
    blight: new Map(blights.map((row) => [row.id, row.slug])),
    keyword: new Map(keywords.map((row) => [row.slug, row.slug])),
    modifier: new Map(mods.map((row) => [row.slug, row.slug])),
  };
  const KIND_OF = {
    card: "cards", relic: "relics", potion: "potions", power: "powers", monster: "monsters", character: "characters",
    event: "events", blight: "blights", keyword: "keywords", modifier: "modifiers",
  } as const satisfies Record<keyof typeof slugOf, Sts1RelatedKind>;
  const ref = (type: keyof typeof slugOf, id: string | undefined): NodeKey | null => {
    const slug = id ? slugOf[type].get(id) : undefined;
    return slug ? node(KIND_OF[type], slug) : null;
  };

  const edges = new Map<NodeKey, Map<NodeKey, Set<Sts1RelationSource>>>();
  const link = (from: NodeKey | null, to: NodeKey | null, source: Sts1RelationSource) => {
    if (!from || !to || from === to) return;
    for (const [a, b] of [[from, to], [to, from]] as const) {
      let targets = edges.get(a);
      if (!targets) edges.set(a, (targets = new Map()));
      let sources = targets.get(b);
      if (!sources) targets.set(b, (sources = new Set()));
      sources.add(source);
    }
  };
  // Fixed ids and named small pools; a random curse or a rarity draw names nothing in particular.
  const items = (from: NodeKey, refs: readonly (Sts1ItemRef | undefined)[], source: Sts1RelationSource) => {
    for (const item of refs) {
      if (!item) continue;
      for (const id of [...(item.id ? [item.id] : []), ...(Array.isArray(item.pool) ? item.pool : [])]) {
        link(from, ref(item.type, id), source);
      }
    }
  };

  // Names a colored run of game text can spell (FontHelper colors the words the game means as terms).
  const byName = new Map<string, NodeKey[]>();
  const addName = (name: string, key: NodeKey | null) => {
    if (!name || !key) return;
    const list = byName.get(name) ?? [];
    if (!list.includes(key)) list.push(key);
    byName.set(name, list);
  };
  for (const row of cards) addName(row.name, node("cards", row.slug));
  for (const row of relics) addName(row.name, node("relics", row.slug));
  for (const row of potions) addName(row.name, node("potions", row.slug));
  for (const row of powers) addName(row.name, node("powers", row.slug));
  for (const row of monsters) addName(row.name, node("monsters", row.slug));
  for (const row of blights) addName(row.name, node("blights", row.slug));
  for (const row of keywords) for (const name of row.names) addName(name, node("keywords", row.slug));
  const scanText = (from: NodeKey, text: string) => {
    const pieces = parseSts1Pieces(text);
    for (let index = 0; index < pieces.length; index++) {
      const match = matchSts1Name(pieces, index, (name) => byName.get(name), { coloredOnly: true });
      if (!match) continue;
      for (const key of match.ref) if (!TEXT_MISREADS.has(`${from}|${key}`)) link(from, key, "text");
      index = match.end;
    }
  };

  // Plain game text names keywords by word, as TipHelper finds them on cards (event prose is left to colors).
  const scanKeywords = (from: NodeKey, text: string) => {
    const plain = text.replace(/#[rgbyp]/g, "").replace(/\bNL\b/g, " ");
    for (const keyword of keywords) {
      if (keyword.names.some((name) => sts1KeywordNameOccurs(plain, name))) link(from, node("keywords", keyword.slug), "keyword");
    }
  };

  for (const row of relics) scanText(node("relics", row.slug), row.description);
  for (const [from, to] of TEXT_MEANT) link(from as NodeKey, to as NodeKey, "text");
  for (const row of potions) scanText(node("potions", row.slug), row.description);
  for (const row of powers) scanText(node("powers", row.slug), row.description);
  for (const [from, text] of [
    ...blights.map((row) => [node("blights", row.slug), `${row.description} ${row.stackDescription ?? ""}`] as const),
    ...mods.map((row) => [node("modifiers", row.slug), row.description] as const),
    ...achievements.map((row) => [node("achievements", row.slug), row.description] as const),
    ...scores.filter((row) => !row.total).map((row) => [node("score-bonuses", row.slug), row.description] as const),
    ...ascensions.map((row) => [node("ascensions", ASCENSION_SLUG(row.level)), row.description] as const),
  ]) {
    scanText(from, text);
    scanKeywords(from, text);
  }
  for (const row of keywords) scanText(node("keywords", row.slug), row.description);
  for (const event of events) {
    const from = node("events", event.slug);
    for (const scene of Object.values(event.scenes)) {
      scanText(from, templateText(scene.body));
      for (const variant of scene.bodyVariants ?? []) scanText(from, templateText(variant.body));
      for (const option of scene.options) scanText(from, templateText(option.label));
    }
  }

  // Keywords a card, relic, potion or power's text uses (the game tips them), and the power or card
  // that goes by the keyword's name (인공물 the keyword and 인공물 the power, 단도 the keyword and the card).
  const powerByName = new Map(powers.map((row) => [row.name, row.slug]));
  const cardByName = new Map(cards.map((row) => [row.name, row.slug]));
  for (const keyword of keywords) {
    const from = node("keywords", keyword.slug);
    const power = powerByName.get(keyword.name);
    const card = cardByName.get(keyword.name);
    if (power) link(from, node("powers", power), "keyword");
    if (card) link(from, node("cards", card), "keyword");
    for (const user of keyword.users) link(from, node(user.type, user.slug), "keyword");
    for (const mention of keyword.mentions) link(from, ref(mention.type as keyof typeof slugOf, mention.id), "mention");
  }
  for (const power of powers) {
    const from = node("powers", power.slug);
    for (const id of power.sources.cards) link(from, ref("card", id), "power-source");
    for (const id of power.sources.relics) link(from, ref("relic", id), "power-source");
    for (const id of power.sources.potions) link(from, ref("potion", id), "power-source");
  }
  for (const monster of monsters) {
    const from = node("monsters", monster.slug);
    for (const tier of [...monster.moves.flatMap((move) => move.tiers), ...monster.startingEffects]) {
      for (const row of tier.powers ?? []) link(from, ref("power", row.power), "monster-move");
      for (const row of tier.cards ?? []) link(from, ref("card", row.card), "monster-move");
      for (const id of tier.summons ?? []) link(from, ref("monster", id), "monster-move");
    }
  }
  for (const event of events) {
    const from = node("events", event.slug);
    const { items: eventItems, monsters: eventMonsters } = sts1EventItemRefs([event]);
    items(from, eventItems, "event");
    for (const id of eventMonsters) link(from, ref("monster", id), "event");
  }
  for (const character of characters) {
    const from = node("characters", character.slug);
    for (const id of character.startingDeckIds) link(from, ref("card", id), "character");
    for (const id of character.startingRelicIds) link(from, ref("relic", id), "character");
    for (const row of relics) if (row.pool === character.id) link(from, node("relics", row.slug), "character");
    for (const row of potions) if (row.pool === character.id) link(from, node("potions", row.slug), "character");
  }
  for (const mod of mods) {
    const from = node("modifiers", mod.slug);
    items(from, mod.refs, "modifier");
    for (const mention of mod.mentions) link(from, ref(mention.type as keyof typeof slugOf, mention.id), "modifier");
    for (const id of mod.blightRefs) link(from, ref("blight", id), "modifier");
  }
  for (const blight of blights) {
    for (const mention of blight.mentions) link(node("blights", blight.slug), ref(mention.type as keyof typeof slugOf, mention.id), "mention");
  }
  for (const [cardId, targets] of Object.entries(extras.cardPreviews)) {
    for (const target of targets) link(ref("card", cardId), ref("card", target), "card-preview");
  }
  for (const row of ascensions) {
    const from = node("ascensions", ASCENSION_SLUG(row.level));
    for (const mention of row.mentions) link(from, ref(mention.type as keyof typeof slugOf, mention.id), "mention");
    const checked = extras.ascension[String(row.level)] ?? {};
    for (const id of checked.monsters ?? []) link(from, ref("monster", id), "ascension");
    for (const id of checked.events ?? []) link(from, ref("event", id), "ascension");
    // Map generation, reward and player rules the game applies without a monster or event class of its own.
    if (row.level === 1) for (const monster of monsters) if (monster.type === "elite") link(from, node("monsters", monster.slug), "ascension");
    if (row.level === 13) for (const monster of monsters) if (monster.type === "boss") link(from, node("monsters", monster.slug), "ascension");
    if (row.level === 15) link(from, ref("event", "NoteForYourself"), "ascension");
    if (row.level === 20) for (const monster of monsters) if (monster.type === "boss" && monster.dungeon === "beyond") link(from, node("monsters", monster.slug), "ascension");
    if (PLAYER_ASCENSION_LEVELS.has(row.level)) for (const character of characters) link(from, node("characters", character.slug), "ascension");
  }
  for (const row of achievements) {
    const from = node("achievements", row.slug);
    for (const target of row.refs) link(from, ref(target.type as keyof typeof slugOf, target.id), "achievement");
    // ASCEND_10 / ASCEND_20: beat that ascension level.
    const level = /^ASCEND_(\d+)$/.exec(row.key)?.[1];
    if (level && ascensions.some((ascension) => String(ascension.level) === level)) link(from, node("ascensions", level), "achievement");
  }
  for (const row of scores) {
    if (row.total) continue;
    const from = node("score-bonuses", row.slug);
    for (const target of row.refs) link(from, ref(target.type as keyof typeof slugOf, target.id), "score-bonus");
  }
  const neowNode = node("neow", "neow");
  for (const reward of [...neow.categories.flatMap((category) => [...category.rewards, ...category.drawbacks]), ...neow.mini]) {
    items(neowNode, reward.refs, "neow");
  }
  return edges;
});

/** Each kind's rows in game order, named for this locale. */
const getSts1RelatedNames = cache(async (gameLocale: GameLocale) => {
  const [cards, relics, potions, powers, monsters, characters, events, keywords, mods, blights, ascensions, achievements, scores, neow, labels] = await Promise.all([
    getSts1Cards(gameLocale),
    getSts1Relics(gameLocale),
    getSts1Potions(gameLocale),
    getSts1Powers(gameLocale),
    getSts1Monsters(gameLocale),
    getSts1Characters(gameLocale),
    getSts1Events(gameLocale),
    getSts1CompendiumKeywords(gameLocale),
    getSts1Modifiers(gameLocale),
    getSts1Blights(gameLocale),
    getSts1Ascensions(gameLocale),
    getSts1Achievements(gameLocale),
    getSts1ScoreBonuses(gameLocale),
    getSts1Neow(gameLocale),
    getSts1UiLabels(gameLocale),
  ]);
  const ordered = (rows: readonly { slug: string; name: string }[]) => new Map(rows.map((row, index) => [row.slug, { name: row.name, index }]));
  const ascensionLabel = labels.monsters.ascension;
  return {
    cards: ordered(cards),
    relics: ordered(relics),
    potions: ordered(potions),
    powers: ordered(powers),
    keywords: ordered(keywords),
    monsters: ordered(monsters),
    characters: ordered(characters),
    events: ordered(events),
    modifiers: ordered(mods),
    blights: ordered(blights),
    ascensions: ordered(ascensions.map((row) => ({ slug: ASCENSION_SLUG(row.level), name: `${ascensionLabel} ${row.level}` }))),
    achievements: ordered(achievements),
    "score-bonuses": ordered(scores.filter((row) => !row.total)),
    neow: ordered([{ slug: "neow", name: neow.name }]),
  } satisfies Record<Sts1RelatedKind, Map<string, { name: string; index: number }>>;
});

/** The related rail for one resource: every kind it links to, in game order. */
export async function getSts1Related(kind: Sts1RelatedKind, slug: string, gameLocale: GameLocale = "kor"): Promise<Sts1RelatedGroup[]> {
  const [graph, names] = await Promise.all([getSts1RelationGraph(), getSts1RelatedNames(gameLocale)]);
  const targets = [...(graph.get(node(kind, slug))?.keys() ?? [])];
  return STS1_RELATED_KINDS.flatMap((target) => {
    const rows = names[target];
    const items = targets
      .filter((key) => key.startsWith(`${target}:`))
      .map((key) => key.slice(target.length + 1))
      .flatMap((targetSlug) => {
        const row = rows.get(targetSlug);
        return row ? [{ slug: targetSlug, name: row.name, index: row.index }] : [];
      })
      .sort((a, b) => a.index - b.index)
      .map(({ slug: itemSlug, name }) => ({ slug: itemSlug, name }));
    return items.length ? [{ kind: target, items }] : [];
  });
}

/** Rails for every row of a list, for list pages that open details in a modal. */
export async function getSts1RelatedMap(kind: Sts1RelatedKind, slugs: readonly string[], gameLocale: GameLocale = "kor") {
  const entries = await Promise.all(slugs.map(async (slug) => [slug, await getSts1Related(kind, slug, gameLocale)] as const));
  return Object.fromEntries(entries) as Record<string, Sts1RelatedGroup[]>;
}

/**
 * Blitz merchant room (pure, no DOM). Read from the 0.113.0 source:
 * MerchantInventory.GetBlitzEntries / UpdateEntries, BlitzMerchantEntry (+ each *Entry.cs),
 * NMerchantInventory (open/close tweens, selection text), NMerchantSlot / NBlitzMerchantSlot
 * (hover scale, hover tip alignment, used/disabled look) and NMerchantHand (pointing).
 */
import { nextRandom, seedRandom } from "../combat-sim/rng";
import { formatLoc, type GameLang, type LocVars } from "./loc-format";

/** BlitzMerchantEntryType, in enum order. Everything from Glam on is cursed (`IsCursed`). */
export const BLITZ_ENTRY_TYPES = [
  "CardUpgrade", "UpgradedCardReward", "RandomUpgrades", "CardTransform", "CardRemoval",
  "CardRewards", "ColorlessCardReward", "Potions", "CardEnchant", "EnchantedCardReward",
  "PrismaticCardReward", "RareCardReward", "UpgradedRareCard", "Relic", "Glam",
  "TwoMoreChoices", "CardRewardOfEachRarity", "UpgradedRareCardReward", "TwoRelics", "FullHealAndMaxHp",
] as const;
export type BlitzEntryType = (typeof BLITZ_ENTRY_TYPES)[number];

const FIRST_CURSED = BLITZ_ENTRY_TYPES.indexOf("Glam");
export const isCursed = (type: BlitzEntryType) => BLITZ_ENTRY_TYPES.indexOf(type) >= FIRST_CURSED;
/** BlitzMerchantEntry.RareBlitzEntries: half weight in the draw, and the slot gets RareVfx. */
export const RARE_ENTRIES: BlitzEntryType[] = ["PrismaticCardReward", "RareCardReward", "UpgradedRareCard"];
/** BlitzRunModel.shopEnchantmentOptions: (enchantment, amount). */
export const SHOP_ENCHANTMENTS: [string, number][] = [["SHARP", 2], ["NIMBLE", 3], ["ADROIT", 3], ["STEADY", 1], ["SWIFT", 2], ["VIGOROUS", 5]];
/** EnchantmentModel.ShowAmount overrides (Sharp, Nimble, Adroit, Swift, Vigorous). */
const SHOWS_AMOUNT = new Set(["SHARP", "NIMBLE", "ADROIT", "SWIFT", "VIGOROUS"]);
export const CHARACTERS = ["IRONCLAD", "SILENT", "DEFECT", "REGENT", "NECROBINDER", "FOOL"];
const ENTRY_COUNT = 6;
const DEFAULT_CHOICES = 3;

export interface BlitzMerchantData {
  entries: { type: BlitzEntryType; key: string; iconUrl: string; tokenUrl: string }[];
  enchantIcons: Record<string, string>;
  loc: Record<GameLang, {
    merchant: Record<string, string>;
    enchantments: Record<string, { title: string; description: string }>;
    static: Record<string, { title: string; description: string }>;
    keywords: Record<string, { title: string; description: string }>;
    characters: Record<string, string>;
  }>;
}

export type BlitzAction =
  | { do: "wait"; ms: number }
  | { do: "open" }
  | { do: "close" }
  | { do: "hover"; entry: string }
  | { do: "unhover" }
  | { do: "buy"; entry: string };

export interface BlitzMerchantInput {
  node: "blitz_merchant";
  version: string;
  locale: GameLang;
  seed: number;
  /** The player's character (merchant pose, and excluded from the prismatic draw). */
  character: string;
  /** Combat background of the room (the act's). */
  act: string;
  /** The six entries in slot order; drawn from `seed` like GetBlitzEntries when omitted. */
  entries?: BlitzEntryType[];
  /** An entry the drawn stock must hold (the seed is advanced until a draw has it). */
  include?: BlitzEntryType;
  /** CardEnchant's enchantment (`SHARP`...), else drawn from `seed`. */
  enchant?: string;
  /** PrismaticCardReward's character, else drawn from `seed`. */
  prismatic?: string;
  /** Inventory starts open (skips the room). */
  startOpen?: boolean;
  script: BlitzAction[];
}

export interface HoverTipView {
  title: string;
  /** BBCode (gold, blue, red, purple). */
  description: string;
  icon: string | null;
}

export interface BlitzEntryView {
  index: number;
  type: BlitzEntryType;
  iconUrl: string;
  tokenUrl: string;
  rare: boolean;
  cursed: boolean;
  tips: HoverTipView[];
  /** NBlitzMerchantSlot.CreateHoverTip: column 3 opens to the left. */
  tipAlign: "left" | "right";
}

export type EntryStatus = "available" | "used" | "disabled";

/** One script step on the timeline. */
export interface BlitzBeat {
  action: BlitzAction;
  /** Slot it resolved to (hover, buy). */
  slot: number | null;
  start: number;
  end: number;
  rejected?: string;
}

export interface BlitzMerchantResult {
  input: BlitzMerchantInput;
  stock: BlitzEntryView[];
  beats: BlitzBeat[];
  duration: number;
  actionEnds: number[];
  warnings: string[];
  notSimulated: string[];
  selectionText: (remaining: number) => string;
}

// --- Stock ------------------------------------------------------------------------

interface Rng {
  state: number;
}

function next(rng: Rng): number {
  const [value, state] = nextRandom(rng.state);
  rng.state = state;
  return value;
}

function weighted<T>(rng: Rng, items: T[], weight: (item: T) => number): T {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  let roll = next(rng) * total;
  for (const item of items) {
    roll -= weight(item);
    if (roll < 0) return item;
  }
  return items[items.length - 1];
}

/**
 * GetBlitzEntries: five weighted draws without replacement from the non-cursed types
 * (rare ones weigh 0.5), then one cursed type, in that slot order. The weights and order are
 * the game's; the random numbers are this simulator's seeded stream, not PlayerRng.Shops.
 */
export function drawStock(seed: number): BlitzEntryType[] {
  const rng: Rng = { state: seedRandom(seed) };
  const normal = BLITZ_ENTRY_TYPES.filter((type) => !isCursed(type));
  const cursed = BLITZ_ENTRY_TYPES.filter(isCursed);
  const out: BlitzEntryType[] = [];
  for (let i = 0; i < ENTRY_COUNT - 1; i += 1) {
    const pick = weighted(rng, normal, (type) => (RARE_ENTRIES.includes(type) ? 0.5 : 1));
    normal.splice(normal.indexOf(pick), 1);
    out.push(pick);
  }
  out.push(cursed[Math.floor(next(rng) * cursed.length)]);
  return out;
}

/** The first seed from `seed` on whose draw holds `include` (and that seed). */
export function stockWith(seed: number, include: BlitzEntryType): { seed: number; entries: BlitzEntryType[] } {
  for (let s = seed; s < seed + 10_000; s += 1) {
    const entries = drawStock(s);
    if (entries.includes(include)) return { seed: s, entries };
  }
  throw new Error(`no seed from ${seed} draws ${include}`);
}

export function parseEntryType(raw: string): BlitzEntryType | null {
  const flat = raw.replace(/[_\s-]/g, "").toLowerCase();
  return BLITZ_ENTRY_TYPES.find((type) => type.toLowerCase() === flat) ?? null;
}

// --- Hover tips --------------------------------------------------------------------

function snake(type: string): string {
  return type.replace(/(?<!^)(?=[A-Z])/g, "_").toLowerCase();
}

export function entryTips(
  type: BlitzEntryType,
  data: BlitzMerchantData,
  lang: GameLang,
  choice: { enchant: [string, number]; prismatic: string },
): HoverTipView[] {
  const loc = data.loc[lang];
  const line = (part: "title" | "description", vars: LocVars) =>
    formatLoc(loc.merchant[`MERCHANT.blitz.${snake(type)}_entry.${part}`], vars, lang);
  const enchantTip = (id: string, amount: number): HoverTipView[] => {
    // HoverTipFactory.FromEnchantment: a mutable copy at that Amount, then its HoverTips
    // (HoverTip(Title, DynamicDescription, Icon) + ExtraHoverTips).
    const text = loc.enchantments[id];
    const vars: LocVars = { Amount: amount, Block: amount };
    const tips: HoverTipView[] = [{ title: text.title, description: formatLoc(text.description, vars, lang), icon: data.enchantIcons[id] ?? null }];
    if (id === "STEADY") tips.push({ ...loc.keywords.RETAIN, icon: null });
    if (id === "GLAM") {
      const replay = loc.static.REPLAY_DYNAMIC;
      tips.push({ title: formatLoc(replay.title, { Times: 1 }, lang), description: formatLoc(replay.description, { Times: 1 }, lang), icon: null });
    }
    return tips;
  };
  if (type === "CardEnchant") {
    const [id, amount] = choice.enchant;
    const title = loc.enchantments[id].title;
    return [
      { title: line("title", { Enchantment: title }), description: line("description", { Enchantment: title, Amount: SHOWS_AMOUNT.has(id) ? amount : 1 }), icon: null },
      ...enchantTip(id, amount),
    ];
  }
  if (type === "Glam") {
    const title = loc.enchantments.GLAM.title;
    return [{ title: line("title", { Enchantment: title }), description: line("description", { Enchantment: title, Amount: 1 }), icon: null }, ...enchantTip("GLAM", 1)];
  }
  if (type === "PrismaticCardReward") {
    const name = loc.characters[choice.prismatic];
    return [{ title: line("title", { Character: name }), description: line("description", { Character: name }), icon: null }];
  }
  return [{ title: line("title", {}), description: line("description", {}), icon: null }];
}

// --- Timeline ----------------------------------------------------------------------

/** NMerchantInventory.DoOpenAnimation: backstop 1.0 s, rug 0.7 s; the step lasts the longer one. */
export const OPEN_MS = 1000;
/** NMerchantInventory.Close: backstop 0.8 s, rug 0.5 s. */
export const CLOSE_MS = 800;

export function runBlitzMerchant(input: BlitzMerchantInput, data: BlitzMerchantData): BlitzMerchantResult {
  const warnings: string[] = [];
  const rng: Rng = { state: seedRandom(input.seed ^ 0x51ed) };
  let types = input.entries;
  if (types && types.length !== ENTRY_COUNT) throw new Error(`entries: the Blitz merchant has ${ENTRY_COUNT} slots, got ${types.length}`);
  if (types) {
    if (types.slice(0, 5).some(isCursed) || !isCursed(types[5])) warnings.push("entries: the game puts five non-cursed entries first and one cursed entry last");
    if (new Set(types).size !== types.length) warnings.push("entries: the game never stocks the same entry twice");
  } else if (input.include) {
    const drawn = stockWith(input.seed, input.include);
    if (drawn.seed !== input.seed) warnings.push(`seed ${input.seed} does not draw ${input.include}; using seed ${drawn.seed}`);
    types = drawn.entries;
  } else {
    types = drawStock(input.seed);
  }
  const enchant = input.enchant
    ? SHOP_ENCHANTMENTS.find(([id]) => id === input.enchant!.toUpperCase())
    : SHOP_ENCHANTMENTS[Math.floor(next(rng) * SHOP_ENCHANTMENTS.length)];
  if (!enchant) throw new Error(`enchant must be one of ${SHOP_ENCHANTMENTS.map(([id]) => id).join(", ")}`);
  const others = CHARACTERS.filter((c) => c !== input.character);
  const prismatic = input.prismatic?.toUpperCase() ?? others[Math.floor(next(rng) * others.length)];
  if (!CHARACTERS.includes(prismatic)) throw new Error(`prismatic must be one of ${CHARACTERS.join(", ")}`);
  if (prismatic === input.character) warnings.push("prismatic: the game draws a character other than the player's");

  const byType = new Map(data.entries.map((entry) => [entry.type, entry]));
  const stock: BlitzEntryView[] = types.map((type, index) => ({
    index,
    type,
    iconUrl: byType.get(type)!.iconUrl,
    tokenUrl: byType.get(type)!.tokenUrl,
    rare: RARE_ENTRIES.includes(type),
    cursed: isCursed(type),
    tips: entryTips(type, data, input.locale, { enchant, prismatic }),
    tipAlign: index % 3 === 2 ? "left" : "right",
  }));

  const slotOf = (ref: string): number | null => {
    const n = Number(ref);
    if (Number.isInteger(n) && n >= 1 && n <= ENTRY_COUNT) return n - 1;
    const type = parseEntryType(ref);
    const at = type ? types!.indexOf(type) : -1;
    return at >= 0 ? at : null;
  };

  const beats: BlitzBeat[] = [];
  let t = 0;
  let open = Boolean(input.startOpen);
  let remaining = DEFAULT_CHOICES;
  const status: EntryStatus[] = stock.map(() => "available");
  for (const action of input.script) {
    let duration = 0;
    let slot: number | null = null;
    let rejected: string | undefined;
    if (action.do === "wait") duration = action.ms;
    else if (action.do === "open") {
      if (open) rejected = "already open";
      else { open = true; duration = OPEN_MS; }
    } else if (action.do === "close") {
      if (!open) rejected = "not open";
      else { open = false; duration = CLOSE_MS; }
    } else if (action.do === "hover" || action.do === "buy") {
      slot = slotOf(action.entry);
      if (slot === null) rejected = `${action.entry} is not in this stock (${types.join(", ")})`;
      else if (!open) rejected = "the inventory is closed";
      else if (status[slot] !== "available") rejected = `${stock[slot].type} is ${status[slot]} (its hitbox ignores the mouse)`;
      else if (action.do === "buy") {
        status[slot] = "used";
        remaining -= 1;
        if (stock[slot].type === "TwoMoreChoices") remaining += 2;
        if (remaining <= 0) status.forEach((s, i) => { if (s === "available") status[i] = "disabled"; });
      }
    }
    if (rejected) warnings.push(`${action.do}${"entry" in action ? `:${action.entry}` : ""}: ${rejected}`);
    beats.push({ action, slot, start: t, end: t + duration, rejected });
    t += duration;
  }

  const loc = data.loc[input.locale].merchant;
  return {
    input: { ...input, entries: types, enchant: enchant[0], prismatic },
    stock,
    beats,
    duration: t,
    actionEnds: beats.map((beat) => beat.end),
    warnings,
    notSimulated: [
      "the selection screen a bought entry opens (card reward, deck pick, relic, potion), its curse and its run history line",
      "the merchant's fire (vfx_stepped_shader_fire_flat), embers, glows and the slot RareVfx / CursedVfx particles",
      "the room's lights and star particles, and the background's animated layers (the act's `a` layers are drawn as one image)",
      "the merchant's speech when the last choice is used (ShowForBlitzFinished)",
      "sounds",
    ],
    selectionText: (n: number) =>
      n > 0 ? formatLoc(loc["MERCHANT.blitzSelection.remaining"], { Amount: n }, input.locale) : loc["MERCHANT.blitzSelection.none"],
  };
}

// --- State at a time -----------------------------------------------------------------

export interface SlotState {
  scale: number;
  status: EntryStatus;
  /** Purchase failed wiggle offset (px), NMerchantSlot.WiggleAnimation. */
  wiggle: number;
}

export interface BlitzMerchantState {
  t: number;
  /** Backstop alpha (0..0.8) and rug y (game px). */
  backstop: number;
  rugY: number;
  open: boolean;
  hovered: number | null;
  /** Slot whose tip is shown (the hovered one). */
  tipSlot: number | null;
  slots: SlotState[];
  remaining: number;
  /** Merchant hand position (game px) and its rotate_me bone rotation (deg). */
  hand: { x: number; y: number; rotation: number };
  /** The last slot hovered so far (the camera frames it). */
  framed: number | null;
}

const ease = {
  linear: (x: number) => x,
  sineInOut: (x: number) => -(Math.cos(Math.PI * x) - 1) / 2,
  quintOut: (x: number) => 1 - (1 - x) ** 5,
  cubicOut: (x: number) => 1 - (1 - x) ** 3,
  expoOut: (x: number) => (x >= 1 ? 1 : 1 - 2 ** (-10 * x)),
};

function tween(from: number, to: number, startMs: number, durationS: number, curve: (x: number) => number, t: number): number {
  const x = Math.min(1, Math.max(0, (t - startMs) / (durationS * 1000)));
  return from + (to - from) * curve(x);
}

/** Layout numbers the state needs (from data/sts2/blitz-merchant.json `layout`). */
export interface BlitzStateLayout {
  rugX: number;
  rugOpenY: number;
  rugClosedY: number;
  backstopAlpha: number;
  slots: [number, number][];
  handStart: [number, number];
  /** MerchantHandOffset of a Blitz slot: Left * 30 + Left * 18. */
  handOffset: [number, number];
  inventoryWidth: number;
}

// shortcut: a seeded value-gradient noise stands in for FastNoiseLite Perlin (frequency 1); upgrade if the hand drift must match the game frame for frame.
function noise1d(x: number): number {
  const grad = (i: number) => {
    const [value] = nextRandom(seedRandom(i * 7919 + 17));
    return value * 2 - 1;
  };
  const i = Math.floor(x);
  const f = x - i;
  const fade = f * f * f * (f * (f * 6 - 15) + 10);
  return (grad(i) * f * (1 - fade) + grad(i + 1) * (f - 1) * fade) * 2;
}

const HAND_DT = 1 / 60;

export function blitzMerchantStateAt(result: BlitzMerchantResult, layout: BlitzStateLayout, t: number): BlitzMerchantState {
  const { beats } = result;
  let backstop = result.input.startOpen ? layout.backstopAlpha : 0;
  let rugY = result.input.startOpen ? layout.rugOpenY : layout.rugClosedY;
  let open = Boolean(result.input.startOpen);
  let hovered: number | null = null;
  let framed: number | null = null;
  let remaining = DEFAULT_CHOICES;
  const slots: SlotState[] = result.stock.map(() => ({ scale: 1, status: "available", wiggle: 0 }));
  // Per-slot tween origin (scale at the change, time, target).
  const scaleTween = result.stock.map(() => ({ from: 1, to: 1, at: -Infinity, duration: 0.05, curve: ease.linear }));
  const scaleAt = (i: number, time: number) => {
    const s = scaleTween[i];
    return tween(s.from, s.to, s.at, s.duration, s.curve, time);
  };
  // Hand pointing: [time, target slot or null, linger seconds].
  const pointing: { at: number; slot: number | null; linger: number }[] = [];
  const unhover = (time: number) => {
    if (hovered === null) return;
    const i = hovered;
    scaleTween[i] = { from: scaleAt(i, time), to: 1, at: time, duration: 0.5, curve: ease.expoOut };
    pointing.push({ at: time, slot: null, linger: 2 });
    hovered = null;
  };
  for (const beat of beats) {
    if (beat.start > t) break;
    if (beat.rejected) continue;
    const { action } = beat;
    if (action.do === "open") {
      backstop = tween(backstop, layout.backstopAlpha, beat.start, 1.0, ease.sineInOut, t);
      rugY = tween(rugY, layout.rugOpenY, beat.start, 0.7, ease.quintOut, t);
      open = true;
    } else if (action.do === "close") {
      unhover(beat.start);
      pointing.push({ at: beat.start, slot: null, linger: 0 });
      backstop = tween(backstop, 0, beat.start, 0.8, ease.sineInOut, t);
      rugY = tween(rugY, layout.rugClosedY, beat.start, 0.5, ease.cubicOut, t);
      open = false;
    } else if (action.do === "hover" && beat.slot !== null) {
      if (hovered !== beat.slot) unhover(beat.start);
      const i: number = beat.slot;
      scaleTween[i] = { from: scaleAt(i, beat.start), to: 1.1, at: beat.start, duration: 0.05, curve: ease.linear };
      pointing.push({ at: beat.start, slot: i, linger: 0 });
      hovered = i;
      framed = i;
    } else if (action.do === "unhover") {
      unhover(beat.start);
    } else if (action.do === "buy" && beat.slot !== null) {
      const i = beat.slot;
      if (hovered === i) unhover(beat.start);
      slots[i].status = "used";
      remaining -= 1;
      if (result.stock[i].type === "TwoMoreChoices") remaining += 2;
      if (remaining <= 0) slots.forEach((slot) => { if (slot.status === "available") slot.status = "disabled"; });
      // TriggerMerchantHandToPointHere: point, then StopPointing(2).
      pointing.push({ at: beat.start, slot: i, linger: 0 }, { at: beat.start, slot: null, linger: 2 });
      framed = i;
    }
  }
  slots.forEach((slot, i) => { slot.scale = scaleAt(i, t); });

  // NMerchantHand._Process, stepped at 60 fps from the start: lerp toward the target plus drift.
  const slotPos = (i: number): [number, number] => [layout.rugX + layout.slots[i][0], layout.rugOpenY + layout.slots[i][1]];
  let [x, y] = layout.handStart;
  let target: [number, number] = [...layout.handStart];
  let returnAt = Infinity;
  let p = 0;
  const steps = Math.floor(t / 1000 / HAND_DT);
  for (let step = 1; step <= steps; step += 1) {
    const time = step * HAND_DT;
    while (p < pointing.length && pointing[p].at / 1000 <= time) {
      const point = pointing[p];
      if (point.slot !== null) {
        const [sx, sy] = slotPos(point.slot);
        target = [sx + layout.handOffset[0], sy + layout.handOffset[1]];
        returnAt = Infinity;
      } else {
        returnAt = point.at / 1000 + point.linger;
      }
      p += 1;
    }
    if (time >= returnAt) {
      target = [...layout.handStart];
      returnAt = Infinity;
    }
    const nx = noise1d(time * 0.1) + 0.4;
    const ny = noise1d((time + 0.25) * 0.1) - 0.5;
    const k = HAND_DT * 4;
    x += (target[0] + nx * 100 - x) * k;
    y += (target[1] + ny * 100 - y) * k;
  }
  const rotation = -10 + 20 * ((x - layout.inventoryWidth * 0.5 - 50) * 0.01);

  return { t, backstop, rugY, open, hovered, tipSlot: hovered, slots, remaining, hand: { x, y, rotation }, framed };
}

/** Frame times for a capture at `fps`, ending on the last frame. */
export function frameTimes(duration: number, fps: number): number[] {
  const count = Math.floor((duration / 1000) * fps) + 1;
  return Array.from({ length: count }, (_, i) => Math.min(duration, Math.round((i * 1000) / fps)));
}

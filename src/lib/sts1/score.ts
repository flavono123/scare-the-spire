/**
 * GameOverScreen.calcScore / checkScoreBonus as numbers, plus the limits a real run
 * (no console) puts on each one, so the calculator never shows a score no seed can make.
 */

export type Sts1RunOutcome = "death" | "victory" | "heart";

export interface Sts1ScoreInput {
  outcome: Sts1RunOutcome;
  floor: number;
  monsters: number;
  /** Elite rooms cleared in acts 1-3 (TheEnding's elite counts toward nothing but Champion). */
  elites: [number, number, number];
  bosses: number;
  /** Elites killed without taking damage. */
  champion: number;
  /** Bosses killed without taking damage (3+ is Beyond Perfect). */
  perfect: number;
  ascension: number;
  overkill: boolean;
  combo: boolean;
  poopy: boolean;
  speed: "none" | "speedster" | "lightSpeed";
  highlander: boolean;
  shiny: boolean;
  gold: 0 | 1000 | 2000 | 3000;
  mystery: boolean;
  collector: number;
  pauper: boolean;
  deck: "none" | "librarian" | "encyclopedian";
  maxHp: "none" | "wellFed" | "stuffed";
  curses: boolean;
}

export const STS1_SCORE_DEFAULTS: Sts1ScoreInput = {
  outcome: "death",
  floor: 1,
  monsters: 0,
  elites: [0, 0, 0],
  bosses: 0,
  champion: 0,
  perfect: 0,
  ascension: 0,
  overkill: false,
  combo: false,
  poopy: false,
  speed: "none",
  highlander: false,
  shiny: false,
  gold: 0,
  mystery: false,
  collector: 0,
  pauper: false,
  deck: "none",
  maxHp: "none",
  curses: false,
};

// Act k's first floor: Exordium 1, The City 18, The Beyond 35 (each act is 15 rows, a boss and,
// in acts 1-2, a treasure room). Boss floors 16, 33, 50; TheEnding is rest, shop, elite, Heart.
const ACT_START = [1, 18, 35] as const;
const BOSS_FLOORS = [16, 33, 50] as const;
// shortcut: the floor count past the Heart is taken loosely (57), not read from TheEnding's map; tighten if a run shows otherwise.
const MAX_FLOOR = 57;
const HEART_FLOOR = 54;
// RoomTypeAssigner: no elite on the first five rows, row 8 is the treasure, row 14 the campfire.
const ELITE_ROWS = [5, 6, 7, 9, 10, 11, 12, 13] as const;
// The most enemies one hallway fight can drop (Lots of Slimes: five small slimes), with room to spare.
const MONSTERS_PER_FLOOR = 8;
const MAX_COLLECTOR = 30;

export interface Sts1ScoreLimits {
  floor: [number, number];
  monsters: [number, number];
  elites: [[number, number], [number, number], [number, number]];
  bosses: [number, number];
  champion: [number, number];
  perfect: [number, number];
  ascension: [number, number];
  collector: [number, number];
  victoryOnly: boolean;
}

export function sts1ScoreLimits(input: Sts1ScoreInput): Sts1ScoreLimits {
  const won = input.outcome !== "death";
  const heart = input.outcome === "heart";
  const floorMin = heart ? HEART_FLOOR : won ? BOSS_FLOORS[2] : 1;
  const floor = Math.min(Math.max(input.floor, floorMin), MAX_FLOOR);
  const elites = ACT_START.map((start) => [0, ELITE_ROWS.filter((row) => start + row <= floor).length] as [number, number]) as Sts1ScoreLimits["elites"];
  // A boss behind you is a boss killed; standing on its floor, it may still be alive.
  const passed = BOSS_FLOORS.filter((boss) => floor > boss).length;
  const reached = BOSS_FLOORS.filter((boss) => floor >= boss).length;
  const doubleBoss = input.ascension >= 20 && floor >= BOSS_FLOORS[2] ? 1 : 0;
  const bossMin = won ? 3 + doubleBoss + (heart ? 1 : 0) : passed + (floor > BOSS_FLOORS[2] ? doubleBoss : 0);
  const bossMax = won ? bossMin : reached + doubleBoss;
  const eliteTotal = input.elites.reduce((sum, count, act) => sum + Math.min(count, elites[act][1]), 0);
  // TheEnding's Spire Shield and Spear fight scores no elite line but can still be a Champion kill.
  const endingElite = floor > HEART_FLOOR - 1 ? 1 : 0;
  const bosses = Math.min(Math.max(input.bosses, bossMin), bossMax);
  return {
    floor: [floorMin, MAX_FLOOR],
    monsters: [0, floor * MONSTERS_PER_FLOOR],
    elites,
    bosses: [bossMin, bossMax],
    champion: [0, eliteTotal + endingElite],
    perfect: [0, bosses],
    ascension: [0, 20],
    collector: [0, MAX_COLLECTOR],
    victoryOnly: won,
  };
}

function clamp(value: number, [min, max]: [number, number]): number {
  return Math.min(Math.max(Math.round(value) || 0, min), max);
}

/** The input pulled inside what a run can reach; fields are settled in dependency order. */
export function clampSts1ScoreInput(input: Sts1ScoreInput): Sts1ScoreInput {
  let next = { ...input, ascension: clamp(input.ascension, [0, 20]) };
  next = { ...next, floor: clamp(next.floor, sts1ScoreLimits(next).floor) };
  let limits = sts1ScoreLimits(next);
  next = {
    ...next,
    monsters: clamp(next.monsters, limits.monsters),
    elites: next.elites.map((count, act) => clamp(count, limits.elites[act])) as Sts1ScoreInput["elites"],
    bosses: clamp(next.bosses, limits.bosses),
    collector: clamp(next.collector, limits.collector),
  };
  limits = sts1ScoreLimits(next);
  next = { ...next, champion: clamp(next.champion, limits.champion), perfect: clamp(next.perfect, limits.perfect) };
  if (!limits.victoryOnly) next = { ...next, speed: "none", highlander: false, pauper: false };
  return next;
}

export type Sts1ScoreLine = { key: string; points: number };

/** Every line the run screen would print, in calcScore order, and the total. */
export function sts1Score(raw: Sts1ScoreInput): { lines: Sts1ScoreLine[]; total: number } {
  const input = clampSts1ScoreInput(raw);
  const won = input.outcome !== "death";
  const base: Sts1ScoreLine[] = [
    { key: "floors", points: input.floor * 5 },
    { key: "monsters", points: input.monsters * 2 },
    { key: "Exordium Elites Killed", points: input.elites[0] * 10 },
    { key: "City Elites Killed", points: input.elites[1] * 20 },
    { key: "Beyond Elites Killed", points: input.elites[2] * 30 },
    { key: "Bosses Slain", points: (50 * input.bosses * (input.bosses + 1)) / 2 },
    { key: "Champion", points: input.champion * 25 },
    input.perfect >= 3 ? { key: "Beyond Perfect", points: 200 } : { key: "Perfect", points: input.perfect * 50 },
    { key: "Overkill", points: input.overkill ? 25 : 0 },
    { key: "Combo", points: input.combo ? 25 : 0 },
  ];
  const baseTotal = base.reduce((sum, line) => sum + line.points, 0);
  // MathUtils.round(base * 0.05 * level): floor(x + 0.5); ascension mode only.
  const ascension = input.ascension > 0 ? Math.floor(baseTotal * 0.05 * input.ascension + 0.5) : 0;
  const bonuses: Sts1ScoreLine[] = [
    { key: "Ascension", points: ascension },
    { key: "Poopy", points: input.poopy ? -1 : 0 },
    { key: input.speed === "lightSpeed" ? "Light Speed" : "Speedster", points: !won ? 0 : input.speed === "lightSpeed" ? 50 : input.speed === "speedster" ? 25 : 0 },
    { key: "Highlander", points: won && input.highlander ? 100 : 0 },
    { key: "Shiny", points: input.shiny ? 50 : 0 },
    { key: input.gold === 3000 ? "I Like Gold" : input.gold === 2000 ? "Raining Money" : "Money Money", points: { 0: 0, 1000: 25, 2000: 50, 3000: 75 }[input.gold] },
    { key: "Mystery Machine", points: input.mystery ? 25 : 0 },
    { key: "Collector", points: input.collector * 25 },
    { key: "Pauper", points: won && input.pauper ? 50 : 0 },
    { key: input.deck === "encyclopedian" ? "Encyclopedian" : "Librarian", points: { none: 0, librarian: 25, encyclopedian: 50 }[input.deck] },
    { key: input.maxHp === "stuffed" ? "Stuffed" : "Well Fed", points: { none: 0, wellFed: 25, stuffed: 50 }[input.maxHp] },
    { key: "Curses", points: input.curses ? 100 : 0 },
    { key: "Heartbreaker", points: input.outcome === "heart" ? 250 : 0 },
  ];
  const lines = [...base, ...bonuses];
  return { lines, total: lines.reduce((sum, line) => sum + line.points, 0) };
}

/**
 * Bonuses the game prints at most one of (checkScoreBonus picks the highest tier; Beyond Perfect replaces
 * Perfect): the score table shows the tier an input reaches, or the first tier when it reaches none.
 */
export const STS1_SCORE_TIERS: { ids: string[]; reached: (input: Sts1ScoreInput) => number }[] = [
  { ids: ["Money Money", "Raining Money", "I Like Gold"], reached: (input) => ({ 0: -1, 1000: 0, 2000: 1, 3000: 2 })[input.gold] },
  { ids: ["Librarian", "Encyclopedian"], reached: (input) => ({ none: -1, librarian: 0, encyclopedian: 1 })[input.deck] },
  { ids: ["Well Fed", "Stuffed"], reached: (input) => ({ none: -1, wellFed: 0, stuffed: 1 })[input.maxHp] },
  { ids: ["Speedster", "Light Speed"], reached: (input) => ({ none: -1, speedster: 0, lightSpeed: 1 })[input.speed] },
  { ids: ["Perfect", "Beyond Perfect"], reached: (input) => (input.perfect >= 3 ? 1 : input.perfect > 0 ? 0 : -1) },
];

/** The ids of tiered bonuses the table hides for this input (every tier but the shown one). */
export function sts1HiddenTierIds(input: Sts1ScoreInput): Set<string> {
  const hidden = new Set<string>();
  for (const tier of STS1_SCORE_TIERS) {
    const shown = Math.max(tier.reached(input), 0);
    tier.ids.forEach((id, index) => { if (index !== shown) hidden.add(id); });
  }
  return hidden;
}

/** Tiered bonuses the input has not reached yet (shown dimmed). */
export function sts1UnreachedTierIds(input: Sts1ScoreInput): Set<string> {
  return new Set(STS1_SCORE_TIERS.filter((tier) => tier.reached(input) < 0).map((tier) => tier.ids[0]));
}

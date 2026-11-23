/**
 * ScoreUtility.CalculateScore (STS2 0.113.0) as numbers, plus the limits a real run (no console,
 * no custom modifiers) puts on each input, so the calculator never shows a score no seed can make.
 * Line keys are the SCORE_LINE ids in data/sts2/localization/<locale>/game_over_screen.json.
 */
import type { Sts2RunBadge } from "@/lib/sts2/run-score";

export type Sts2ScoreMode = "normal" | "dread";

export interface Sts2ScoreInput {
  won: boolean;
  mode: Sts2ScoreMode;
  ascension: number;
  players: number;
  /** MapPointHistory entries per act: every map point entered, the act's Ancient and boss(es) included. */
  floors: [number, number, number];
  /** Gold gained by the whole party (ScoreUtility sums every player; the game-over line shows only yours). */
  goldGained: number;
  elitesKilled: number;
  bossesSlain: number;
}

export const STS2_SCORE_DEFAULTS: Sts2ScoreInput = {
  won: false,
  mode: "normal",
  ascension: 0,
  players: 1,
  floors: [1, 0, 0],
  goldGained: 0,
  elitesKilled: 0,
  bossesSlain: 0,
};

// ModelDb.Acts: Overgrowth or Underdocks, then Hive, then Glory; BaseNumberOfRooms 15/15, 14, 13.
const ACT_ROOMS = [15, 14, 13] as const;
// GoldenPathActMap._defaultPointTypes (Golden Compass): 16 rooms in a line, one fewer in multiplayer (RemoveAt(2)).
// The compass is Tezcatara's, Hive's Ancient, and GoldenCompass.AfterObtained remaps the act it is taken in, so only
// act 2 can be a Golden Path: 18 floors solo / 17 in multiplayer, two more than the standard act 2 (real runs: 5 won
// solo A10 runs, act 2 = 18 floors, compass from act 2's Ancient).
const GOLDEN_PATH_ACT = 1;
const GOLDEN_PATH_ROOMS = ["M", "U", "M", "R", "M", "R", "U", "T", "U", "T", "U", "S", "E", "R", "E", "R"];
// AscensionLevel enum ends at DoubleBoss = 10; RunManager.GenerateRooms adds a second boss to the last act at that level.
const MAX_ASCENSION = 10;
const DOUBLE_BOSS = 10;
// NMultiplayerHostSubmenu: InitializeMultiplayerAsHost(netService, 4) for every lobby type.
const MAX_PLAYERS = 4;
// StandardActMap._lowestRowByPointType[Elite].
const ELITE_LOWEST_ROW = 6;
// No game cap on gold gained; 30,000 a player is far past any real run (300 points of gold line) without blocking outliers.
const GOLD_PER_PLAYER = 30_000;

export interface Sts2ScoreLimits {
  floors: [[number, number], [number, number], [number, number]];
  goldGained: [number, number];
  elitesKilled: [number, number];
  bossesSlain: [number, number];
  ascension: [number, number];
  players: [number, number];
}

const doubleBoss = (input: Sts2ScoreInput) => input.mode === "dread" || input.ascension >= DOUBLE_BOSS;

// ActModel.GetNumberOfRooms: BaseNumberOfRooms, minus one in multiplayer (excludes the Ancient and boss rows).
const rooms = (act: number, players: number) => ACT_ROOMS[act] - (players > 1 ? 1 : 0);

// GetNumberOfFloors = rooms + Ancient + boss; StandardActMap adds SecondBossMapPoint to the last act on Double Boss.
function standardFloors(act: number, input: Sts2ScoreInput): number {
  return rooms(act, input.players) + 2 + (act === 2 && doubleBoss(input) ? 1 : 0);
}

const goldenPathRooms = (players: number) => (players > 1 ? GOLDEN_PATH_ROOMS.filter((_, i) => i !== 2) : GOLDEN_PATH_ROOMS);

function maxFloors(act: number, input: Sts2ScoreInput): number {
  return act === GOLDEN_PATH_ACT ? goldenPathRooms(input.players).length + 2 : standardFloors(act, input);
}

/**
 * Most elites one path can fight in an act's first `visitedRows` rows. StandardActMap: elites from row 6, never on the
 * last row (rest sites) or the treasure row (row count - 7), and never two in a row along a path (parent/child rules).
 * Unknown rooms never roll elites (UnknownMapPointOdds.baseEliteOdds = -1).
 */
function standardEliteMax(act: number, players: number, visitedRows: number): number {
  const last = rooms(act, players);
  const treasure = last - 6;
  let count = 0;
  let previous = -2;
  for (let row = ELITE_LOWEST_ROW; row < last && row <= visitedRows; row++) {
    if (row === treasure || row === previous + 1) continue;
    count++;
    previous = row;
  }
  return count;
}

// Act 2 may be a Golden Path (two elites, late): longer than the standard map it must be one; otherwise either map.
function eliteMax(act: number, input: Sts2ScoreInput, visitedRows: number): number {
  const standard = standardEliteMax(act, input.players, visitedRows);
  if (act !== GOLDEN_PATH_ACT) return standard;
  const golden = goldenPathRooms(input.players).slice(0, visitedRows).filter((room) => room === "E").length;
  return input.floors[act] > standardFloors(act, input) ? golden : Math.max(standard, golden);
}

export function sts2ScoreLimits(input: Sts2ScoreInput): Sts2ScoreLimits {
  const floors = [0, 1, 2].map((act) => {
    if (act > 0 && input.floors[act - 1] < standardFloors(act - 1, input)) return [0, 0];
    // A loss may end on act 1's first floor (Neow), or before it when abandoned (real run: 0 floors, score 0).
    const min = input.won ? standardFloors(act, input) : 0;
    return [min, maxFloors(act, input)];
  }) as Sts2ScoreLimits["floors"];
  const lastAct = input.floors.reduce((last, count, act) => (count > 0 ? act : last), 0);
  // GetElitesKilledCount drops a final elite room, so a loss can't count its last floor as an elite.
  const elites = input.floors.reduce((sum, count, act) => {
    const lost = !input.won && act === lastAct;
    return sum + eliteMax(act, input, Math.max(0, count - (lost ? 2 : 1)));
  }, 0);
  // GetBossesSlainCount: every boss room entered, except the last room of a run not won (the fight it died in, or the
  // room it was abandoned in). Standing on act 3's second boss (its full length) means the first fell. Killing that
  // second boss is the win, so a loss never counts it: 3 at most (real runs: 42 A10 deaths there, all 3 bosses; no
  // loss among 793 runs has 4). Act 3 is never a Golden Path, so a won Double Boss run always slew 4.
  const secondBossPoint = doubleBoss(input) && input.floors[2] === standardFloors(2, input);
  const wonBosses = 3 + (doubleBoss(input) ? 1 : 0);
  const bosses: [number, number] = input.won
    ? [wonBosses, wonBosses]
    : [lastAct, lastAct + (lastAct === 2 && secondBossPoint ? 1 : 0)];
  return {
    floors,
    goldGained: [0, GOLD_PER_PLAYER * input.players],
    elitesKilled: [0, elites],
    bossesSlain: bosses,
    ascension: input.mode === "dread" ? [MAX_ASCENSION, MAX_ASCENSION] : [0, MAX_ASCENSION],
    players: [1, MAX_PLAYERS],
  };
}

function clamp(value: number, [min, max]: [number, number]): number {
  return Math.min(Math.max(Math.round(value) || 0, min), max);
}

/** The input pulled inside what a run can reach; fields are settled in dependency order. */
export function clampSts2ScoreInput(input: Sts2ScoreInput): Sts2ScoreInput {
  // NCustomRunScreen / NAscensionPanel: Dread runs are locked to ascension 10.
  let next: Sts2ScoreInput = { ...input, floors: [...input.floors] };
  next.players = clamp(next.players, [1, MAX_PLAYERS]);
  next.ascension = clamp(next.ascension, sts2ScoreLimits(next).ascension);
  for (let act = 0; act < 3; act++) next.floors[act] = clamp(next.floors[act], sts2ScoreLimits(next).floors[act]);
  const limits = sts2ScoreLimits(next);
  next = {
    ...next,
    goldGained: clamp(next.goldGained, limits.goldGained),
    elitesKilled: clamp(next.elitesKilled, limits.elitesKilled),
    bossesSlain: clamp(next.bossesSlain, limits.bossesSlain),
  };
  return next;
}

export type Sts2ScoreLineKey = "floorsClimbed" | "goldGained" | "elitesKilled" | "bossesSlain" | "ascension" | "dread";
/** `count` fills the SCORE_LINE placeholder; `points` is what the line adds, so lines sum to the total. */
export type Sts2ScoreLine = { key: Sts2ScoreLineKey; count: number; points: number; multiplier?: number };

/** The lines NGameOverScreen.AnimateScoreLines prints (elites, bosses and ascension only when above 0) and the total. */
export function sts2Score(raw: Sts2ScoreInput): { lines: Sts2ScoreLine[]; total: number } {
  const input = clampSts2ScoreInput(raw);
  const lines: Sts2ScoreLine[] = [
    { key: "floorsClimbed", count: input.floors.reduce((a, b) => a + b, 0), points: input.floors.reduce((sum, count, act) => sum + count * 10 * (act + 1), 0) },
    { key: "goldGained", count: input.goldGained, points: Math.floor(input.goldGained / (100 * input.players)) },
  ];
  if (input.elitesKilled > 0) lines.push({ key: "elitesKilled", count: input.elitesKilled, points: input.elitesKilled * 50 });
  if (input.bossesSlain > 0) lines.push({ key: "bossesSlain", count: input.bossesSlain, points: input.bossesSlain * 100 });
  const base = lines.reduce((sum, line) => sum + line.points, 0);
  let total = base;
  if (input.mode === "dread") {
    total = base * 3;
    lines.push({ key: "dread", count: 0, points: total - base, multiplier: 3 });
  } else if (input.ascension > 0) {
    // (int)((double)num * (1.0 + (double)ascension * 0.1)): same doubles in JS, truncated toward zero.
    const multiplier = 1 + input.ascension * 0.1;
    total = Math.trunc(base * multiplier);
    lines.push({ key: "ascension", count: input.ascension, points: total - base, multiplier: Math.round(multiplier * 10) / 10 });
  }
  return { lines, total };
}

/**
 * The badges the calculator's inputs settle on their own, at the tier reached (ScoreUtility.GetBadges rules, 0.113.0).
 * Only ELITE (GetElitesKilledCount: 3 / 6 / 9) reads nothing but these inputs. Every other badge needs the run file
 * (src/lib/sts2/run-score.ts sts2RunBadges): CURSES, HIGHLANDER, HONED, BIG_DECK, TINY_DECK, TEAM_PLAYER (final deck),
 * DOUBLE_SNECKO, ILIKESHINY (relics), FAMISHED, GLUTTON, TABLET (final max HP), MONEY_MONEY (final gold, not gold
 * gained), KACHING (gold spent in shops), HEALER, RESTFUL, RESTLESS (rest site choices), MYSTERY_MACHINE (? rooms),
 * PERFECT (damage taken at bosses), SPEEDY (win time), CCCCOMBO, DAMAGE_LEADER, DEBUFFER (combat stats).
 */
export function sts2BadgesFromInput(raw: Sts2ScoreInput): Sts2RunBadge[] {
  const { elitesKilled } = clampSts2ScoreInput(raw);
  const rarity = elitesKilled >= 9 ? "gold" : elitesKilled >= 6 ? "silver" : elitesKilled >= 3 ? "bronze" : null;
  return rarity ? [{ id: "ELITE", rarity }] : [];
}

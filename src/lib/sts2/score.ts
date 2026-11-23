/**
 * ScoreUtility.CalculateScore (STS2 0.113.0) as numbers, plus the limits a real run (no console,
 * no custom modifiers) puts on each input, so the calculator never shows a score no seed can make.
 * Line keys are the SCORE_LINE ids in data/sts2/localization/<locale>/game_over_screen.json.
 */

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
// GoldenPathActMap._defaultPointTypes (Golden Compass): 16 rooms, one fewer in multiplayer, and no second boss point.
const GOLDEN_PATH_ROOMS = 16;
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

// shortcut: any act may become a Golden Path (Golden Compass is in Tezcatara's offer and EventRelicPool), so every act's
// ceiling is that map's length; a Golden Compass picked up mid-act may stretch an act further, which this ignores.
function maxFloors(act: number, input: Sts2ScoreInput): number {
  return Math.max(GOLDEN_PATH_ROOMS - (input.players > 1 ? 1 : 0) + 2, standardFloors(act, input));
}

/**
 * Most elites one path can fight in an act's first `visitedRows` rows. StandardActMap: elites from row 6, never on the
 * last row (rest sites) or the treasure row (row count - 7), and never two in a row along a path (parent/child rules).
 * Unknown rooms never roll elites (UnknownMapPointOdds.baseEliteOdds = -1). The Golden Path's two elites never beat this.
 */
function eliteMax(act: number, players: number, visitedRows: number): number {
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

export function sts2ScoreLimits(input: Sts2ScoreInput): Sts2ScoreLimits {
  const floors = [0, 1, 2].map((act) => {
    if (act > 0 && input.floors[act - 1] < standardFloors(act - 1, input)) return [0, 0];
    const min = input.won ? standardFloors(act, input) : act === 0 ? 1 : 0;
    return [min, maxFloors(act, input)];
  }) as Sts2ScoreLimits["floors"];
  const lastAct = input.floors.reduce((last, count, act) => (count > 0 ? act : last), 0);
  // GetElitesKilledCount drops a final elite room, so a loss can't count its last floor as an elite.
  const elites = input.floors.reduce((sum, count, act) => {
    const lost = !input.won && act === lastAct;
    return sum + eliteMax(act, input.players, Math.max(0, count - (lost ? 2 : 1)));
  }, 0);
  // GetBossesSlainCount: every boss room entered, except the last room of a loss. Standing on act 3's second boss
  // (its full standard length) means the first fell; the same floor count on a Golden Path does not, hence the range.
  const secondBossPoint = doubleBoss(input) && input.floors[2] === standardFloors(2, input);
  // A won Golden Path act 3 (longer than the standard map) has no SecondBossMapPoint, so only three bosses.
  const wonBosses = 3 + (doubleBoss(input) && input.floors[2] <= standardFloors(2, input) ? 1 : 0);
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

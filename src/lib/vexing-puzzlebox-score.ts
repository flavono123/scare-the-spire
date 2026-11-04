/**
 * Puzzlebox scores. `submit_puzzlebox_run` in Supabase scores the same run records with the
 * same numbers, so a change here needs the matching migration.
 */

export const PUZZLEBOX_GAMES = ["connections", "beta-quiz"] as const;
export type PuzzleboxGame = (typeof PUZZLEBOX_GAMES)[number];

export type ScorePartId =
  | "display"
  | "groups"
  | "mistakeBonus"
  | "purpleFirst"
  | "reverseRainbow"
  | "rocksLeft"
  | "correct"
  | "speed"
  | "streak"
  | "lives";

export type ScorePart = { id: ScorePartId; points: number; count: number };
export type ScoreBreakdown = { total: number; perfect: boolean; parts: ScorePart[] };

/**
 * What the player had on screen during the run: pictures, game-language names, English names.
 * Anything shown at any point counts as shown. A locale with no separate game-language name
 * sends `local: false`, so every locale starts from the same bonus.
 */
export type RunDisplay = { token: boolean; local: boolean; original: boolean };

export const ALL_SHOWN: RunDisplay = { token: true, local: true, original: true };

export function mergeDisplay(left: RunDisplay | undefined, right: RunDisplay): RunDisplay {
  if (!left) return { ...right };
  return { token: left.token || right.token, local: left.local || right.local, original: left.original || right.original };
}

/** Points for each hidden part: a picture gives away the most. */
export type DisplayBonus = { token: number; local: number; original: number };

export function displayBonus(shown: RunDisplay | undefined, bonus: DisplayBonus): number {
  if (!shown) return 0;
  return (shown.token ? 0 : bonus.token) + (shown.local ? 0 : bonus.local) + (shown.original ? 0 : bonus.original);
}

/** The most hiding can earn: everything off but one name. */
function maxDisplayBonus(bonus: DisplayBonus): number {
  return bonus.token + Math.max(bonus.local, bonus.original);
}

export const CONNECTIONS_GROUP_SIZE = 4;
export const CONNECTIONS_MISTAKE_LIMIT = 4;
export const CONNECTIONS_ROCK_SLOTS = 3;
/** Points for each solved group by level: yellow, green, blue, purple. */
export const CONNECTIONS_LEVEL_POINTS = [10, 15, 20, 25] as const;
/** Bonus for a full solve by mistakes made: none, one, two. */
export const CONNECTIONS_MISTAKE_BONUS = [20, 10, 5] as const;
export const CONNECTIONS_PURPLE_FIRST = 5;
/** Purple, blue, green, yellow in that order. Replaces the purple-first bonus. */
export const CONNECTIONS_REVERSE_RAINBOW = 10;
/** Added to a full solve for each rock still on the belt. A thrown or discarded rock earns nothing. */
export const CONNECTIONS_ROCK_LEFT_POINTS = 10;
/** Added to a full solve for each part kept hidden the whole run. */
export const CONNECTIONS_DISPLAY_BONUS: DisplayBonus = { token: 10, local: 5, original: 5 };
export const CONNECTIONS_MAX_SCORE = 100
  + CONNECTIONS_ROCK_SLOTS * CONNECTIONS_ROCK_LEFT_POINTS
  + maxDisplayBonus(CONNECTIONS_DISPLAY_BONUS);
const PURPLE_LEVEL = 3;

export type ConnectionsRun = {
  /** Levels of each submitted group's members, in submit order. */
  guesses: number[][];
  /** Rocks thrown. A perfect run throws none; discarding one keeps it perfect. */
  rocks: number;
  /** Rocks still on the belt at the end: neither thrown nor discarded. */
  rocksLeft: number;
  shown: RunDisplay;
};

/** Replays the guesses: which levels were solved, in what order, and the mistakes made. */
export function replayConnections(guesses: readonly (readonly number[])[]): { solved: number[]; mistakes: number } {
  const solved: number[] = [];
  let mistakes = 0;
  for (const levels of guesses) {
    if (solved.length === CONNECTIONS_LEVEL_POINTS.length || mistakes >= CONNECTIONS_MISTAKE_LIMIT) break;
    const level = levels[0];
    if (levels.length === CONNECTIONS_GROUP_SIZE && levels.every((item) => item === level) && !solved.includes(level)) {
      solved.push(level);
    } else {
      mistakes += 1;
    }
  }
  return { solved, mistakes };
}

export function scoreConnections(run: ConnectionsRun): ScoreBreakdown {
  const { solved, mistakes } = replayConnections(run.guesses);
  const cleared = solved.length === CONNECTIONS_LEVEL_POINTS.length;
  const rocks = Math.max(0, Math.min(CONNECTIONS_ROCK_SLOTS, Math.floor(run.rocks)));
  const rocksLeft = Math.max(0, Math.min(CONNECTIONS_ROCK_SLOTS - rocks, Math.floor(run.rocksLeft)));
  const reverseRainbow = cleared && solved.every((level, index) => level === PURPLE_LEVEL - index);
  const purpleFirst = cleared && !reverseRainbow && solved[0] === PURPLE_LEVEL;
  const parts: ScorePart[] = [
    {
      id: "groups",
      count: solved.length,
      points: solved.reduce((sum, level) => sum + (CONNECTIONS_LEVEL_POINTS[level] ?? 0), 0),
    },
    { id: "mistakeBonus", count: mistakes, points: cleared ? CONNECTIONS_MISTAKE_BONUS[mistakes] ?? 0 : 0 },
    { id: "purpleFirst", count: purpleFirst ? 1 : 0, points: purpleFirst ? CONNECTIONS_PURPLE_FIRST : 0 },
    { id: "reverseRainbow", count: reverseRainbow ? 1 : 0, points: reverseRainbow ? CONNECTIONS_REVERSE_RAINBOW : 0 },
    { id: "display", count: 0, points: cleared ? displayBonus(run.shown, CONNECTIONS_DISPLAY_BONUS) : 0 },
    { id: "rocksLeft", count: rocksLeft, points: cleared ? rocksLeft * CONNECTIONS_ROCK_LEFT_POINTS : 0 },
  ];
  const total = parts.reduce((sum, part) => sum + part.points, 0);
  return { total, perfect: cleared && mistakes === 0 && rocks === 0, parts };
}

export const BETA_QUIZ_LIVES = 3;
export const BETA_QUIZ_CORRECT_POINTS = 10;
export const BETA_QUIZ_LIFE_POINTS = 5;
/** Every correct answer from the third in a row on earns this much more. */
export const BETA_QUIZ_STREAK_FROM = 3;
export const BETA_QUIZ_STREAK_POINTS = 2;
/** A correct answer within this long of the art appearing earns the whole speed bonus... */
export const BETA_QUIZ_SPEED_FULL_MS = 1000;
/** ...which falls in a straight line to nothing here. The clock stops measuring after this. */
export const BETA_QUIZ_SPEED_ZERO_MS = 10000;
export const BETA_QUIZ_SPEED_MAX = 10;
/** Added to each right answer for each part hidden while it was asked. */
export const BETA_QUIZ_DISPLAY_BONUS: DisplayBonus = { token: 5, local: 2, original: 2 };

export type BetaQuizAnswer = {
  /** Which of the four choices was picked, in the order shown. */
  pick: number;
  correct: boolean;
  /** Time from the art appearing to the pick, while the page was visible. */
  ms: number;
  shown: RunDisplay;
};

export type BetaQuizRun = { questions: number; answers: BetaQuizAnswer[] };

/** Whole milliseconds, as the run record stores them. */
export function betaQuizSpeedBonus(ms: number): number {
  if (!Number.isFinite(ms)) return 0;
  const whole = Math.max(0, Math.round(ms));
  if (whole >= BETA_QUIZ_SPEED_ZERO_MS) return 0;
  if (whole <= BETA_QUIZ_SPEED_FULL_MS) return BETA_QUIZ_SPEED_MAX;
  // Integer math so the server's numeric rounding lands on the same points.
  return Math.round((BETA_QUIZ_SPEED_MAX * (BETA_QUIZ_SPEED_ZERO_MS - whole)) / (BETA_QUIZ_SPEED_ZERO_MS - BETA_QUIZ_SPEED_FULL_MS));
}

export function scoreBetaQuiz(run: BetaQuizRun): ScoreBreakdown {
  let correct = 0;
  let wrong = 0;
  let streak = 0;
  let streakPoints = 0;
  let streakCount = 0;
  let speed = 0;
  let display = 0;
  for (const answer of run.answers) {
    if (wrong >= BETA_QUIZ_LIVES) break;
    if (answer.correct) {
      correct += 1;
      streak += 1;
      speed += betaQuizSpeedBonus(answer.ms);
      display += displayBonus(answer.shown, BETA_QUIZ_DISPLAY_BONUS);
      if (streak >= BETA_QUIZ_STREAK_FROM) {
        streakPoints += BETA_QUIZ_STREAK_POINTS;
        streakCount += 1;
      }
    } else {
      wrong += 1;
      streak = 0;
    }
  }
  const lives = Math.max(0, BETA_QUIZ_LIVES - wrong);
  const parts: ScorePart[] = [
    { id: "correct", count: correct, points: correct * BETA_QUIZ_CORRECT_POINTS },
    { id: "speed", count: correct, points: speed },
    { id: "display", count: correct, points: display },
    { id: "streak", count: streakCount, points: streakPoints },
    { id: "lives", count: lives, points: lives * BETA_QUIZ_LIFE_POINTS },
  ];
  return {
    total: parts.reduce((sum, part) => sum + part.points, 0),
    perfect: run.questions > 0 && correct === run.questions,
    parts,
  };
}

/** The best a set of this many questions can score: all fast, all right, no life lost. */
export function betaQuizMaxScore(questions: number): number {
  return questions * (BETA_QUIZ_CORRECT_POINTS + BETA_QUIZ_SPEED_MAX + maxDisplayBonus(BETA_QUIZ_DISPLAY_BONUS))
    + Math.max(0, questions - BETA_QUIZ_STREAK_FROM + 1) * BETA_QUIZ_STREAK_POINTS
    + BETA_QUIZ_LIVES * BETA_QUIZ_LIFE_POINTS;
}

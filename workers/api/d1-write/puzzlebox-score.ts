/**
 * puzzlebox_score_run and puzzlebox_run_display (Supabase public schema) in TypeScript, line for line,
 * for the step 5 D1 submit (design 4.5). Every `raise exception ... using errcode = '22023'` is a
 * PuzzleboxRunError, which the API answers `invalid` as it answers 22023 today. Numbers follow
 * Postgres: `::numeric::integer` and `round(numeric)` round half away from zero, and an integer
 * outside int4 is an error (22003, also `invalid`).
 */

export class PuzzleboxRunError extends Error {}

type Json = unknown;

export type ScoredRun = {
  score: number;
  perfect: boolean;
  cleared: boolean;
  mistakes: number;
  rocks: number;
  /** connections */
  solved?: number[];
  /** beta-quiz */
  questions?: number;
  picks?: number[];
  corrects?: boolean[];
  speed?: number;
  /** The normalized replay stored in puzzlebox_runs.run. */
  run: Record<string, Json>;
};

const LEVEL_POINTS = [10, 15, 20, 25];
const MISTAKE_BONUS = [20, 10, 5];
const INT4_MAX = 2147483647;

function fail(message: string): never {
  throw new PuzzleboxRunError(message);
}

function isObject(value: Json): value is Record<string, Json> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** numeric -> integer (round half away from zero; int4 range). */
function pgInt(value: number): number {
  if (!Number.isFinite(value)) fail("numeric value out of range");
  const rounded = Math.sign(value) * Math.floor(Math.abs(value) + 0.5);
  if (rounded > INT4_MAX || rounded < -INT4_MAX - 1) fail("integer out of range");
  return rounded === 0 ? 0 : rounded;
}

function isNumber(value: Json): value is number {
  return typeof value === "number";
}

export function puzzleboxRunDisplay(shown: Json): [boolean, boolean, boolean] {
  if (!isObject(shown) || typeof shown.token !== "boolean" || typeof shown.local !== "boolean" || typeof shown.original !== "boolean") {
    fail("shown must be three booleans");
  }
  if (!(shown.token || shown.local || shown.original)) fail("something must be shown");
  return [shown.token, shown.local, shown.original];
}

function scoreConnections(run: Record<string, Json>): ScoredRun {
  const guesses = run.guesses;
  if (!Array.isArray(guesses) || guesses.length < 1 || guesses.length > 32) fail("guesses must be 1 to 32 groups");
  if (!isNumber(run.rocks)) fail("rocks must be a number");
  const rocks = pgInt(run.rocks);
  if (rocks < 0 || rocks > 3) fail("rocks must be 0 to 3");
  if (!isNumber(run.rocksLeft)) fail("rocksLeft must be a number");
  const rocksLeft = pgInt(run.rocksLeft);
  if (rocksLeft < 0 || rocksLeft > 3 - rocks) fail("rocksLeft must be 0 to 3 less the rocks thrown");
  const shown = puzzleboxRunDisplay(run.shown);

  const solved: number[] = [];
  let mistakes = 0;
  for (const guess of guesses) {
    if (solved.length === 4 || mistakes >= 4) fail("guess after the end");
    if (!Array.isArray(guess) || guess.length !== 4) fail("a guess is four levels");
    const levels: number[] = [];
    for (const item of guess) {
      if (!isNumber(item) || ![0, 1, 2, 3].includes(item)) fail("levels are 0 to 3");
      levels.push(pgInt(item));
    }
    const level = levels[0];
    if (levels[1] === level && levels[2] === level && levels[3] === level && !solved.includes(level)) {
      solved.push(level);
    } else {
      mistakes += 1;
    }
  }
  if (solved.length < 4 && mistakes < 4) fail("run is not finished");

  const cleared = solved.length === 4;
  const reverseRainbow = cleared && solved.join(",") === "3,2,1,0";
  const purpleFirst = cleared && !reverseRainbow && solved[0] === 3;
  let score = 0;
  for (const level of solved) score += LEVEL_POINTS[level];
  if (cleared) {
    score += MISTAKE_BONUS[mistakes] ?? 0;
    score += (shown[0] ? 0 : 10) + (shown[1] ? 0 : 5) + (shown[2] ? 0 : 5);
    score += rocksLeft * 10;
  }
  if (purpleFirst) score += 5;
  if (reverseRainbow) score += 10;
  return {
    score,
    perfect: cleared && mistakes === 0 && rocks === 0,
    cleared,
    mistakes,
    rocks,
    solved,
    run: { guesses, rocks, rocksLeft, shown: run.shown },
  };
}

function scoreBetaQuiz(run: Record<string, Json>): ScoredRun {
  if (!isNumber(run.questions)) fail("questions must be a number");
  const questions = pgInt(run.questions);
  if (questions < 1 || questions > 30) fail("questions must be 1 to 30");
  const answers = run.answers;
  if (!Array.isArray(answers) || answers.length < 1 || answers.length > questions) fail("answers must be 1 to questions");

  const picks: number[] = [];
  const corrects: boolean[] = [];
  let correctCount = 0;
  let wrong = 0;
  let streak = 0;
  let streakPoints = 0;
  let speed = 0;
  let displayPoints = 0;
  for (const answer of answers) {
    if (wrong >= 3) fail("answer after the end");
    const pick = isObject(answer) ? answer.pick : undefined;
    const correct = isObject(answer) ? answer.correct : undefined;
    const msValue = isObject(answer) ? answer.ms : undefined;
    if (!isNumber(pick) || ![0, 1, 2, 3].includes(pick) || typeof correct !== "boolean" || !isNumber(msValue)) {
      fail("an answer is a pick, a result, and a time");
    }
    const ms = pgInt(Math.min(600000, Math.max(0, pgRound(msValue))));
    const shown = puzzleboxRunDisplay((answer as Record<string, Json>).shown);
    picks.push(pgInt(pick));
    corrects.push(correct);
    if (correct) {
      correctCount += 1;
      streak += 1;
      speed += ms >= 10000 ? 0 : ms <= 1000 ? 10 : pgInt(pgRound((10 * (10000 - ms)) / 9000));
      if (streak >= 3) streakPoints += 2;
      displayPoints += (shown[0] ? 0 : 5) + (shown[1] ? 0 : 2) + (shown[2] ? 0 : 2);
    } else {
      wrong += 1;
      streak = 0;
    }
  }
  if (answers.length < questions && wrong < 3) fail("run is not finished");
  const score = correctCount * 10 + speed + displayPoints + streakPoints + Math.max(0, 3 - wrong) * 5;
  return {
    score,
    perfect: correctCount === questions,
    cleared: wrong < 3,
    mistakes: wrong,
    rocks: 0,
    questions,
    picks,
    corrects,
    speed,
    run: { questions, answers },
  };
}

/** round(numeric): half away from zero, kept as a number (no int4 check). */
function pgRound(value: number): number {
  if (!Number.isFinite(value)) fail("numeric value out of range");
  const rounded = Math.sign(value) * Math.floor(Math.abs(value) + 0.5);
  return rounded === 0 ? 0 : rounded;
}

export function puzzleboxScoreRun(game: string, run: Json): ScoredRun {
  if (!isObject(run)) fail("run must be an object");
  if (game === "connections") return scoreConnections(run);
  if (game === "beta-quiz") return scoreBetaQuiz(run);
  return fail("unknown game");
}

/** Postgres text -> boolean (`::boolean`): t/f, yes/no, on/off, 1/0 and unique prefixes; else an error. */
export function pgBoolean(text: string): boolean {
  const value = text.trim().toLowerCase();
  if (value === "") fail("invalid input syntax for type boolean");
  if ("true".startsWith(value) || "yes".startsWith(value) || value === "on" || value === "1") return true;
  if ("false".startsWith(value) || "no".startsWith(value) || value === "off" || value === "of" || value === "0") return false;
  return fail("invalid input syntax for type boolean");
}

export type PuzzleboxPlayer = {
  nickname: string;
  avatar_id: string | null;
  avatar_kind: string | null;
  palette_id: string | null;
  palette_swapped: boolean;
};

function jsonText(value: Json): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

/** submit_puzzlebox_run's player normalization. */
export function normalizePuzzleboxPlayer(player: Record<string, Json>): PuzzleboxPlayer {
  const nickname = Array.from((jsonText(player.nickname) ?? "").replace(/^ +| +$/g, "")).slice(0, 24).join("") || "?";
  let avatarKind = jsonText(player.avatar_kind);
  if (avatarKind !== null && avatarKind !== "character" && avatarKind !== "boss") avatarKind = null;
  let avatarId = jsonText(player.avatar_id);
  if (avatarId !== null && !/^[A-Z0-9_]{1,40}$/.test(avatarId)) avatarId = null;
  let paletteId = jsonText(player.palette_id);
  if (paletteId !== null && !/^[a-z0-9_-]{1,40}$/.test(paletteId)) paletteId = null;
  const swappedText = jsonText(player.palette_swapped);
  const swapped = swappedText === null ? false : pgBoolean(swappedText);
  return { nickname, avatar_id: avatarId, avatar_kind: avatarKind, palette_id: paletteId, palette_swapped: swapped && paletteId !== null };
}

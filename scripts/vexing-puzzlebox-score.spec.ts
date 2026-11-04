import assert from "node:assert/strict";
import cases from "./fixtures/puzzlebox-score-cases.json";
import {
  betaQuizMaxScore,
  betaQuizSpeedBonus,
  CONNECTIONS_MAX_SCORE,
  scoreBetaQuiz,
  scoreConnections,
  type BetaQuizRun,
  type ConnectionsRun,
} from "../src/lib/vexing-puzzlebox-score";

// The same cases run against submit_puzzlebox_run's scorer in Supabase, so the page and
// the server agree on every score. Error cases are runs only the server refuses.
type ScoreCase = {
  name: string;
  game: "connections" | "beta-quiz";
  run: ConnectionsRun | BetaQuizRun;
  score?: number;
  perfect?: boolean;
  error?: boolean;
};

let checked = 0;
for (const item of cases as ScoreCase[]) {
  if (item.error) continue;
  const result = item.game === "connections"
    ? scoreConnections(item.run as ConnectionsRun)
    : scoreBetaQuiz(item.run as BetaQuizRun);
  assert.equal(result.total, item.score, `${item.name}: score`);
  assert.equal(result.perfect, item.perfect, `${item.name}: perfect`);
  assert.equal(result.total, Math.max(0, result.parts.reduce((sum, part) => sum + part.points, 0)), `${item.name}: parts add up`);
  checked += 1;
}

assert.equal(Math.max(...(cases as ScoreCase[]).filter((item) => item.game === "connections").map((item) => item.score ?? 0)), CONNECTIONS_MAX_SCORE);
// Five fast right answers with only one name shown, a streak of three, no life lost.
assert.equal(betaQuizMaxScore(5), 5 * (10 + 10 + 7) + 3 * 2 + 3 * 5);
assert.equal(CONNECTIONS_MAX_SCORE, 145);
assert.equal(betaQuizSpeedBonus(0), 10);
assert.equal(betaQuizSpeedBonus(10000), 0);
assert.equal(betaQuizSpeedBonus(Number.POSITIVE_INFINITY), 0);
for (let ms = 0; ms < 11000; ms += 37) {
  assert.ok(betaQuizSpeedBonus(ms) >= betaQuizSpeedBonus(ms + 37), `speed bonus never rises with time (${ms} ms)`);
}

console.log(`vexing-puzzlebox-score: ${checked} scored cases`);

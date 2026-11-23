import assert from "node:assert/strict";
import { clampSts2ScoreInput, STS2_SCORE_DEFAULTS, sts2Score, sts2ScoreLimits } from "../src/lib/sts2/score";

const run = (patch: Partial<typeof STS2_SCORE_DEFAULTS>) => ({ ...STS2_SCORE_DEFAULTS, ...patch });

// A death on the first floor (Neow): 1 floor in act 1 -> 10 points.
assert.equal(sts2Score(run({})).total, 10);

// Normal win, A0, solo: floors 17*10 + 16*20 + 15*30 = 940, gold 1234/100 = 12, 6 elites 300, 3 bosses 300 -> 1552.
const win = run({ won: true, floors: [17, 16, 15], goldGained: 1234, elitesKilled: 6, bossesSlain: 3 });
assert.equal(sts2Score(win).total, 1552);
assert.deepEqual(sts2Score(win).lines.map((line) => line.key), ["floorsClimbed", "goldGained", "elitesKilled", "bossesSlain"]);
// A5 -> (int)(1552 * 1.5) = 2328; A3 -> (int)(1552 * 1.3) = (int)2017.6 = 2017.
assert.equal(sts2Score({ ...win, ascension: 5 }).total, 2328);
assert.equal(sts2Score({ ...win, ascension: 3 }).total, 2017);
assert.deepEqual(sts2Score({ ...win, ascension: 3 }).lines.at(-1), { key: "ascension", count: 3, points: 465, multiplier: 1.3 });

// Dread win: locked to A10, so act 3 has a second boss (16 floors). 170 + 320 + 480 = 970, gold 2000 -> 20,
// 4 elites 200, 4 bosses 400 -> 1590 * 3 = 4770; no ascension line.
const dread = sts2Score(run({ won: true, mode: "dread", floors: [17, 16, 16], goldGained: 2000, elitesKilled: 4, bossesSlain: 4 }));
assert.equal(dread.total, 4770);
assert.deepEqual(dread.lines.at(-1), { key: "dread", count: 0, points: 3180, multiplier: 3 });
assert.equal(clampSts2ScoreInput(run({ mode: "dread", ascension: 0 })).ascension, 10);

// Four players: one room fewer per act (16, 15, 14 floors) and gold split 3999 / 400 = 9.
// 160 + 300 + 420 = 880, + 9, + 3 bosses 300 -> 1189.
assert.equal(sts2Score(run({ won: true, players: 4, floors: [16, 15, 14], goldGained: 3999, bossesSlain: 3 })).total, 1189);

// Loss at act 2's boss: the boss you died to is not counted, so 1 boss however many are asked.
// 170 + 320 = 490, 3 elites 150, 1 boss 100 -> 740.
const loss = run({ floors: [17, 16, 0], elitesKilled: 3, bossesSlain: 9 });
assert.equal(clampSts2ScoreInput(loss).bossesSlain, 1);
assert.equal(sts2Score(loss).total, 740);

// Floors: a win fills every act; a loss can't open an act before finishing the one before it.
assert.deepEqual(clampSts2ScoreInput(run({ won: true, floors: [1, 0, 0] })).floors, [17, 16, 15]);
assert.deepEqual(clampSts2ScoreInput(run({ floors: [17, 0, 5] })).floors, [17, 0, 0]);
assert.deepEqual(clampSts2ScoreInput(run({ floors: [99, 99, 99] })).floors, [18, 18, 18]); // Golden Path ceiling
assert.equal(clampSts2ScoreInput(run({ players: 9 })).players, 4);
assert.equal(clampSts2ScoreInput(run({ ascension: 20 })).ascension, 10);

// Bosses follow progress: 3 on a win, 4 at A10, 3 again when act 3 was a Golden Path (no second boss point).
assert.equal(clampSts2ScoreInput(run({ won: true, bossesSlain: 0 })).bossesSlain, 3);
assert.equal(clampSts2ScoreInput(run({ won: true, ascension: 10, bossesSlain: 0 })).bossesSlain, 4);
assert.equal(clampSts2ScoreInput(run({ won: true, ascension: 10, floors: [17, 16, 18] })).bossesSlain, 3);
// Dying at act 3's second boss (A10, 16 floors) may follow a first-boss kill.
assert.deepEqual(sts2ScoreLimits(run({ ascension: 10, floors: [17, 16, 16] })).bossesSlain, [2, 3]);

// Elites: rows 6+ minus the treasure row, never two in a row -> 5 + 4 + 4 = 13 on a full solo run.
assert.equal(clampSts2ScoreInput(run({ won: true, elitesKilled: 100 })).elitesKilled, 13);
// None before row 6; a loss can't count the floor it died on as an elite.
assert.equal(clampSts2ScoreInput(run({ floors: [7, 0, 0], elitesKilled: 3 })).elitesKilled, 0);
assert.equal(clampSts2ScoreInput(run({ floors: [8, 0, 0], elitesKilled: 3 })).elitesKilled, 1);

console.log("sts2-score.spec.ts: ok");

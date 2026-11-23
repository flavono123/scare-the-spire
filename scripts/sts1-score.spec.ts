import assert from "node:assert/strict";
import { clampSts1ScoreInput, STS1_SCORE_DEFAULTS, sts1HiddenTierIds, sts1Score } from "../src/lib/sts1/score";

const run = (patch: Partial<typeof STS1_SCORE_DEFAULTS>) => ({ ...STS1_SCORE_DEFAULTS, ...patch });

// A death on floor 1: five points for the floor, nothing else.
assert.equal(sts1Score(run({})).total, 5);

// Nobody kills 100 elites in act 1, or any before floor 6.
assert.deepEqual(clampSts1ScoreInput(run({ floor: 16, elites: [100, 5, 5] })).elites, [8, 0, 0]);
assert.deepEqual(clampSts1ScoreInput(run({ floor: 5, elites: [3, 0, 0] })).elites, [0, 0, 0]);

// Bosses follow the floor: past act 2's boss means two kills; a victory means all three (four at A20).
assert.equal(clampSts1ScoreInput(run({ floor: 40, bosses: 0 })).bosses, 2);
assert.equal(clampSts1ScoreInput(run({ floor: 40, bosses: 9 })).bosses, 2);
assert.equal(clampSts1ScoreInput(run({ outcome: "victory", floor: 20, bosses: 0 })).floor, 50);
assert.equal(clampSts1ScoreInput(run({ outcome: "victory", bosses: 0 })).bosses, 3);
assert.equal(clampSts1ScoreInput(run({ outcome: "heart", ascension: 20 })).bosses, 5);

// Victory-only lines drop on a death; Perfect can't outnumber bosses.
const death = clampSts1ScoreInput(run({ floor: 20, highlander: true, pauper: true, speed: "lightSpeed", perfect: 3 }));
assert.equal(death.highlander || death.pauper || death.speed !== "none", false);
assert.equal(death.perfect, 1);

// A Heart win, worked by hand from calcScore:
// floors 56*5=280, monsters 60*2=120, elites 3*10+4*20+4*30=230, bosses 4 -> 50+100+150+200=500,
// champion 5*25=125, Beyond Perfect 200, overkill 25 -> base 1480; A10 -> round(1480*0.5)=740;
// shiny 50, gold 75, collector 2*25=50, Heartbreaker 250 -> 425. Total 2645.
const heart = sts1Score(run({
  outcome: "heart", floor: 56, monsters: 60, elites: [3, 4, 4], bosses: 4, champion: 5, perfect: 3,
  ascension: 10, overkill: true, shiny: true, gold: 3000, collector: 2,
}));
assert.equal(heart.total, 2645);

// The table shows one tier per tiered bonus: the reached one, else the first.
const shownGold = (gold: 0 | 1000 | 2000 | 3000) => ["Money Money", "Raining Money", "I Like Gold"].filter((id) => !sts1HiddenTierIds(run({ gold })).has(id));
assert.deepEqual(shownGold(0), ["Money Money"]);
assert.deepEqual(shownGold(2000), ["Raining Money"]);
assert.deepEqual(shownGold(3000), ["I Like Gold"]);
assert.equal(sts1HiddenTierIds(run({ floor: 50, bosses: 3, perfect: 3 })).has("Perfect"), true);

console.log("sts1-score.spec.ts: ok");

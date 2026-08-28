import assert from "node:assert/strict";
import {
  byeCountForSize,
  buildOpeningRound,
  championshipRate,
  formatRoundLabel,
  matchWinRate,
  nextPowerOfTwo,
  openingAutoAdvances,
  openingPlayablePairs,
  pairNextRound,
  playRoundOptions,
  samplePool,
} from "../src/lib/favorite-tournament";

assert.equal(nextPowerOfTwo(20), 32);
assert.equal(nextPowerOfTwo(16), 16);
assert.equal(nextPowerOfTwo(24), 32);
assert.equal(byeCountForSize(20), 12);
assert.equal(byeCountForSize(16), 0);
assert.equal(byeCountForSize(24), 8);

assert.deepEqual(playRoundOptions(20), [20, 16, 8, 4]);
assert.deepEqual(playRoundOptions(24), [24, 16, 8, 4]);
assert.deepEqual(playRoundOptions(64), [64, 32, 16, 8, 4]);
assert.deepEqual(playRoundOptions(16), [16, 8, 4]);
assert.deepEqual(playRoundOptions(3), [3]);
assert.deepEqual(playRoundOptions(1), []);

assert.equal(formatRoundLabel(20, "ko"), "20강");
assert.equal(formatRoundLabel(20, "en"), "Round of 20");

const pool = Array.from({ length: 20 }, (_, i) => ({
  type: "card" as const,
  id: `c${i}`,
}));
let seq = 0;
const random = () => {
  seq += 1;
  return (seq % 10) / 10;
};
const sampled = samplePool(pool, 16, random);
assert.equal(sampled.length, 16);

const opening = buildOpeningRound(pool);
assert.equal(opening.pairs.length, 16);
assert.equal(openingPlayablePairs(opening).length, 4);
assert.equal(openingAutoAdvances(opening).length, 12);

const winners = [
  ...openingAutoAdvances(opening),
  ...openingPlayablePairs(opening).map((pair) => pair.left),
];
assert.equal(winners.length, 16);
assert.equal(pairNextRound(winners).length, 8);

assert.equal(championshipRate(3, 10), 0.3);
assert.equal(matchWinRate(8, 10), 0.8);
assert.equal(championshipRate(1, 0), 0);

console.log("Favorite tournament bracket tests passed.");

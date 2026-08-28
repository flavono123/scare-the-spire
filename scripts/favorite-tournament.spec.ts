import assert from "node:assert/strict";
import {
  byeCountForSize,
  buildOpeningRound,
  championshipRate,
  FAVORITE_TOURNAMENT_BUILTIN_CATALOG,
  favoriteTournamentBuiltinKey,
  formatBracketRoundLabel,
  formatRoundLabel,
  isFavoriteTournamentBuiltinKey,
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

assert.equal(formatRoundLabel(16, "ko"), "16강");
assert.equal(formatRoundLabel(16, "en"), "Round of 16");

const roundCopy = {
  roundLabel: "{size}강",
  roundLabelWithCount: "{size}강({count}개)",
};
const roundCopyEn = {
  roundLabel: "Round of {size}",
  roundLabelWithCount: "Round of {size} ({count})",
};
assert.equal(formatBracketRoundLabel(10, roundCopy), "16강(10개)");
assert.equal(formatBracketRoundLabel(16, roundCopy), "16강");
assert.equal(formatBracketRoundLabel(20, roundCopy), "32강(20개)");
assert.equal(formatBracketRoundLabel(10, roundCopyEn), "Round of 16 (10)");
assert.equal(isFavoriteTournamentBuiltinKey("builtin:ironclad-cards"), true);
assert.equal(isFavoriteTournamentBuiltinKey("custom"), false);
assert.equal(isFavoriteTournamentBuiltinKey("cards-ironclad"), false);
assert.equal(favoriteTournamentBuiltinKey("ironclad-cards"), "builtin:ironclad-cards");
assert.equal(FAVORITE_TOURNAMENT_BUILTIN_CATALOG.length, 0);

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

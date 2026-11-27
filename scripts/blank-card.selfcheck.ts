import assert from "node:assert/strict";
import { getCodexCards } from "../src/lib/codex-data";
import {
  SCORE,
  cardText,
  conflicts,
  isBlankCardAnswer,
  hintPoints,
  isRefusedProposal,
  matchProposal,
  scoreLines,
  totalScore,
} from "../src/lib/blank-card";

async function main() {
  const cards = await getCodexCards({ gameLocale: "kor" });
  const byId = new Map(cards.map((card) => [card.id, card]));
  const pool = cards.filter(isBlankCardAnswer);
  assert.ok(pool.some((card) => card.color === "curse"), "curses are answers");
  assert.ok(pool.some((card) => card.color === "token"), "tokens are answers");
  assert.ok(!pool.some((card) => card.rarity === "고대의 존재"), "ancient cards are left out");

  const bludgeon = cardText(byId.get("BLUDGEON")!);
  assert.equal(bludgeon.plain, "피해를 32 줍니다.");
  assert.deepEqual(matchProposal(bludgeon, "피해"), [0, 1]);
  assert.deepEqual(matchProposal(bludgeon, "방어도"), []);

  // Keyword lines and energy icons are part of the text, with their own slots.
  const adrenaline = cardText(byId.get("ADRENALINE")!);
  assert.ok(adrenaline.slots.some((slot) => slot.slot === "k:소멸"));
  assert.equal(matchProposal(adrenaline, "에너지").length, 1);
  assert.ok(matchProposal(adrenaline, "소멸").length > 0);
  // A space in a proposal also matches a written line break.
  const abundance = cardText(byId.get("ABUNDANCE") ?? pool.find((card) => card.description.includes("\n"))!);
  const [first, second] = abundance.plain.split("\n");
  const across = `${first.split(" ").at(-1)} ${second.split(" ")[0]}`;
  assert.ok(matchProposal(abundance, across).length > 0, across);

  const strike = byId.get("BLUDGEON")!;
  assert.deepEqual(conflicts(strike, bludgeon, { hints: { cost: "9" }, present: [], absent: [], wrongGuesses: [] }), ["cost"]);
  assert.deepEqual(conflicts(strike, bludgeon, { hints: {}, present: ["피해"], absent: ["방어도"], wrongGuesses: [] }), []);
  assert.deepEqual(conflicts(strike, bludgeon, { hints: {}, present: [], absent: ["피해"], wrongGuesses: ["BLUDGEON"] }), ["text", "guessed"]);

  // Unused hints are worth more the more they would have told: the character splits the pool most.
  const points = hintPoints(pool);
  assert.ok(points.color > points.cost && points.color > points.type, JSON.stringify(points));
  const best = scoreLines({ solved: true, hintsUsed: [], attempts: 0, submissions: 1, livesLeft: 3 }, points);
  assert.ok(best.some((line) => line.key === "hole-in-one"));
  assert.equal(totalScore(best), SCORE.solved + SCORE.hints + 3 * SCORE.life + SCORE.holeInOne + (Object.values(points).reduce((a, b) => a + b, 0) - SCORE.hints));
  const hinted = scoreLines({ solved: true, hintsUsed: ["color"], attempts: 2, submissions: 2, livesLeft: 2 }, points);
  assert.ok(!hinted.some((line) => line.hint === "color") && !hinted.some((line) => line.key === "hole-in-one"));
  assert.equal(totalScore(scoreLines({ solved: false, hintsUsed: [], attempts: 9, submissions: 3, livesLeft: 0 }, points)), 0);

  // One syllable and near-universal endings are refused; content words are not.
  const texts = pool.map(cardText);
  assert.ok(isRefusedProposal("다", texts));
  assert.ok(isRefusedProposal("니다", texts));
  assert.ok(!isRefusedProposal("습니다", texts));
  assert.ok(!isRefusedProposal("피해", texts));
  console.log(`blank-card selfcheck ok (${pool.length} answers)`);
}

main();

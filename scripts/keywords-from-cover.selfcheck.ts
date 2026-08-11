import assert from "node:assert/strict";
import { keywordsFromCoverSpec } from "../src/lib/history-run-reference";
import type { CoverSpec } from "../src/lib/run-cover-types";

const phraseCover: CoverSpec = {
  background: { kind: "character" },
  phrase: "검성 쳐내기 역사 강의서",
  elements: [],
  auto: false,
  suggestSeed: "t",
};

assert.deepEqual(
  keywordsFromCoverSpec(phraseCover),
  ["검성", "쳐내기", "역사", "강의서"],
);

const cardCover: CoverSpec = {
  ...phraseCover,
  background: { kind: "card-beta", cardId: "STRIKE_IRONCLAD" },
};
const withCard = keywordsFromCoverSpec(cardCover);
assert.equal(withCard[0], "검성");
assert.ok(withCard.includes("검성"));
assert.ok(withCard.length >= 5); // phrase tokens + card name

assert.deepEqual(keywordsFromCoverSpec(null), []);

console.log("keywords-from-cover.selfcheck: ok");

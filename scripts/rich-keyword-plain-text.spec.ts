import assert from "node:assert/strict";
import {
  buildExactKeywordIndex,
  buildExactKeywordLabels,
  findExactKeywordRanges,
  inProgressKeywordRange,
  matchOpenBraceKeyword,
} from "../src/lib/rich-keyword-plain-text";

assert.equal(matchOpenBraceKeyword("타격"), null);
assert.equal(matchOpenBraceKeyword("취약 부여"), null);
assert.deepEqual(matchOpenBraceKeyword("{타"), { full: "{타", query: "타" });
assert.deepEqual(matchOpenBraceKeyword("{"), { full: "{", query: "" });
assert.deepEqual(matchOpenBraceKeyword("크크루빙봉{빙"), {
  full: "크크루빙봉{빙",
  query: "빙",
});
assert.deepEqual(matchOpenBraceKeyword("문구 {빙봉"), {
  full: "{빙봉",
  query: "빙봉",
});

const labels = buildExactKeywordLabels([
  "악의",
  "하수인 타격",
  "하수인",
  "소멸",
  "취약",
  "힘",
  "타격",
  "Null",
  "Bing Bong",
]);
const index = buildExactKeywordIndex(labels);

assert.deepEqual(
  findExactKeywordRanges("타격 좋다", index).map((range) => range.label),
  ["타격"],
);
assert.deepEqual(
  findExactKeywordRanges("추가타격", index),
  [],
);
assert.deepEqual(
  findExactKeywordRanges("핫픽스, 강화하지 않으면 소멸", index).map((range) => range.label),
  ["소멸"],
);
assert.deepEqual(
  findExactKeywordRanges("하수인 타격 대신 하수인", index).map((range) => range.label),
  ["하수인 타격", "하수인"],
);
assert.deepEqual(
  findExactKeywordRanges("annulled", index),
  [],
);
assert.deepEqual(
  findExactKeywordRanges("Null, 약화", index).map((range) => range.label),
  ["Null"],
);
assert.deepEqual(
  findExactKeywordRanges("취약{카드", index),
  [],
);
assert.deepEqual(
  findExactKeywordRanges("{빙봉", index),
  [],
);
assert.deepEqual(
  findExactKeywordRanges("Bing Bong relic", index).map((range) => range.label),
  ["Bing Bong"],
);
assert.deepEqual(
  findExactKeywordRanges("힘으로", index),
  [],
);

assert.deepEqual(
  inProgressKeywordRange("취약", 2, false),
  { start: 0, end: 2 },
);
assert.equal(inProgressKeywordRange("취약 ", 3, false), null);
assert.equal(inProgressKeywordRange("취약", 2, true), null);

assert.deepEqual(
  findExactKeywordRanges(
    "취약 부여",
    index,
    inProgressKeywordRange("취약 부여", 1, false),
  ),
  [],
);
assert.deepEqual(
  findExactKeywordRanges(
    "취약 부여",
    index,
    inProgressKeywordRange("취약 부여", 5, false),
  ).map((range) => range.label),
  ["취약"],
);
assert.deepEqual(
  findExactKeywordRanges(
    "취약 부여",
    index,
    inProgressKeywordRange("취약 부여", 3, false),
  ).map((range) => range.label),
  ["취약"],
);

console.log("rich-keyword-plain-text.spec.ts: ok");

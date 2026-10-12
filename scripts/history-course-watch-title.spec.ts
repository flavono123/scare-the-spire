import assert from "node:assert/strict";
import {
  historyCourseLockupTitle,
  lockupTitleForSave,
  resolveCoverCaptionTitle,
} from "../src/lib/run-cover-phrase";
import type { CoverSpec } from "../src/lib/run-cover-types";
import korTables from "../src/lib/sts2-game-i18n/kor.json";
import type { GameI18nTables } from "../src/lib/sts2-game-i18n";

const tables = korTables as GameI18nTables;
const meta = { win: true, totalFloors: 52, ascension: 20 };

function cover(auto: boolean, titlePhrase: string): CoverSpec {
  return {
    background: { kind: "character" },
    phrase: "썸네일",
    titlePhrase,
    elements: [],
    auto,
    suggestSeed: "watch-title",
  };
}

const authored = cover(false, "A20 클리어");
assert.equal(
  resolveCoverCaptionTitle(authored, meta, "en", tables, "A20 클리어"),
  "A20 클리어",
);
assert.equal(
  historyCourseLockupTitle(authored, meta, "en", tables),
  "A20 클리어",
);

const generated = cover(true, "A20 클리어");
assert.equal(
  resolveCoverCaptionTitle(generated, meta, "en", tables, "A20 클리어"),
  "A20 clear",
);

assert.equal(lockupTitleForSave("  직접 쓴 제목  ", "자동 제목"), "직접 쓴 제목");
assert.equal(lockupTitleForSave("   ", "자동 제목"), "자동 제목");
assert.equal(lockupTitleForSave(undefined, "자동 제목"), "자동 제목");

console.log("history-course-watch-title.spec.ts: ok");

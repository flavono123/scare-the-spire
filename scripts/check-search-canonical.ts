import assert from "node:assert/strict";
import {
  absoluteKoreanCanonicalUrl,
  koreanSearchPath,
} from "../src/lib/search-canonical";

assert.equal(koreanSearchPath("/compendium/cards/strike"), "/compendium/cards/strike");
assert.equal(koreanSearchPath("/en/compendium/cards/strike"), "/compendium/cards/strike");
assert.equal(koreanSearchPath("/zh/patches/0.107.1"), "/patches/0.107.1");
assert.equal(koreanSearchPath("/codex/relics/anchor"), "/compendium/relics/anchor");
assert.equal(koreanSearchPath("/en"), "/");
assert.match(
  absoluteKoreanCanonicalUrl("/ja/compendium/powers/painful_stabs"),
  /\/compendium\/powers\/painful_stabs$/,
);

console.log("search-canonical ok");

import assert from "node:assert/strict";
import {
  blocksToPlainText,
  blocksToStorageText,
  blocksToTiptapDocument,
  tiptapToBlocks,
} from "../src/lib/chemical-utils";
import type { CardConBlock } from "../src/lib/chemical-types";
import {
  CARD_CON_COMMENT_WIDTH_CLASS,
  CARD_CON_PICKER_TILE_CLASS,
} from "../src/lib/card-con";
import { applyCardConLocale } from "../src/lib/card-con-locale";
import type { CodexCard } from "../src/lib/codex-types";

const cardConBlock: CardConBlock = {
  type: "card-con",
  cardId: "STRIKE_IRONCLAD",
  displayText: "Strike",
  gameLocale: "eng",
};

const doc = blocksToTiptapDocument([cardConBlock]);
assert.equal(doc.content?.[0]?.content?.[0]?.type, "card-con");
assert.equal(doc.content?.[0]?.content?.[0]?.attrs?.cardId, "STRIKE_IRONCLAD");
assert.equal(doc.content?.[0]?.content?.[0]?.attrs?.displayText, "Strike");
assert.equal(doc.content?.[0]?.content?.[0]?.attrs?.gameLocale, "eng");

const recovered = tiptapToBlocks(doc);
assert.deepEqual(recovered, [cardConBlock]);

assert.equal(blocksToPlainText([cardConBlock]), "Strike");
assert.equal(blocksToStorageText([cardConBlock]), "[카드콘:Strike]");

const legacy = tiptapToBlocks({
  type: "doc",
  content: [{
    type: "paragraph",
    content: [{
      type: "card-con",
      attrs: { cardId: "STRIKE_IRONCLAD", displayText: "타격" },
    }],
  }],
});
assert.equal(legacy[0]?.type, "card-con");
if (legacy[0]?.type === "card-con") assert.equal(legacy[0].gameLocale, "kor");

assert.match(CARD_CON_COMMENT_WIDTH_CLASS, /w-\[5\.25rem\]/);
assert.match(CARD_CON_COMMENT_WIDTH_CLASS, /sm:w-24/);
assert.match(CARD_CON_COMMENT_WIDTH_CLASS, /lg:w-28/);
assert.match(CARD_CON_PICKER_TILE_CLASS, /max-w-\[7\.5rem\]/);

const baseCard = {
  id: "STRIKE_IRONCLAD",
  name: "타격",
  description: "피해를 줍니다.",
  descriptionRaw: "피해를 줍니다.",
  typeLabel: "공격",
  rarityLabel: "기본",
  keywordLabels: { 공격: "공격" },
} as CodexCard;

const localized = applyCardConLocale(baseCard, {
  name: "Strike",
  description: "Deal damage.",
  descriptionRaw: "Deal damage.",
  typeLabel: "Attack",
  rarityLabel: "Starter",
  keywordLabels: { 공격: "Attack" },
});
assert.equal(localized.name, "Strike");
assert.equal(localized.typeLabel, "Attack");
assert.equal(applyCardConLocale(baseCard, undefined).name, "타격");

console.log("card-con serialization: ok");

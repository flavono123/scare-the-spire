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

const cardConBlock: CardConBlock = {
  type: "card-con",
  cardId: "STRIKE_IRONCLAD",
  displayText: "타격",
};

const doc = blocksToTiptapDocument([cardConBlock]);
assert.equal(doc.content?.[0]?.content?.[0]?.type, "card-con");
assert.equal(doc.content?.[0]?.content?.[0]?.attrs?.cardId, "STRIKE_IRONCLAD");
assert.equal(doc.content?.[0]?.content?.[0]?.attrs?.displayText, "타격");

const recovered = tiptapToBlocks(doc);
assert.deepEqual(recovered, [cardConBlock]);

assert.equal(blocksToPlainText([cardConBlock]), "타격");
assert.equal(blocksToStorageText([cardConBlock]), "[카드콘:타격]");

assert.match(CARD_CON_COMMENT_WIDTH_CLASS, /w-\[5\.25rem\]/);
assert.match(CARD_CON_COMMENT_WIDTH_CLASS, /sm:w-24/);
assert.match(CARD_CON_COMMENT_WIDTH_CLASS, /lg:w-28/);
assert.match(CARD_CON_PICKER_TILE_CLASS, /max-w-\[7\.5rem\]/);

console.log("card-con serialization: ok");

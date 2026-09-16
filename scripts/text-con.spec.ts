import assert from "node:assert/strict";
import {
  blocksToPlainText,
  blocksToStorageText,
  blocksToTiptapDocument,
  tiptapToBlocks,
} from "../src/lib/chemical-utils";
import type { PostBlock, TextConBlock } from "../src/lib/chemical-types";
import {
  resolveTextConBg,
  resolveTextConText,
  TEXTCON_BG_COLORS,
  TEXTCON_TEXT_COLORS,
} from "../src/lib/text-con";

// 1. Check colors
assert.ok(TEXTCON_BG_COLORS.length >= 10, "Should have spire & character background colors");
assert.equal(TEXTCON_TEXT_COLORS.length, 2, "Should have exactly 2 restricted text colors");

const goldBg = resolveTextConBg("gold");
assert.equal(goldBg.id, "gold");
assert.equal(goldBg.hex, "#EFC851");

const darkText = resolveTextConText("dark");
assert.equal(darkText.id, "dark");

const whiteText = resolveTextConText("white");
assert.equal(whiteText.id, "white");

// 2. Tiptap to blocks and roundtrip
const textConBlock: TextConBlock = {
  type: "text-con",
  text: "슬서운\n이야기",
  bgColor: "gold",
  textColor: "dark",
};

const doc = blocksToTiptapDocument([textConBlock]);
assert.equal(doc.type, "doc");
const paragraph = doc.content?.[0];
assert.ok(paragraph);
assert.equal(paragraph.content?.[0]?.type, "text-con");
assert.equal(paragraph.content?.[0]?.attrs?.text, "슬서운\n이야기");
assert.equal(paragraph.content?.[0]?.attrs?.bgColor, "gold");
assert.equal(paragraph.content?.[0]?.attrs?.textColor, "dark");

const recoveredBlocks = tiptapToBlocks(doc);
assert.equal(recoveredBlocks.length, 1);
assert.equal(recoveredBlocks[0]?.type, "text-con");
assert.deepEqual(recoveredBlocks[0], textConBlock);

// 3. Plain text and storage text
const plainText = blocksToPlainText([textConBlock]);
assert.equal(plainText, "슬서운\n이야기");

const storageText = blocksToStorageText([textConBlock]);
assert.equal(storageText, "[글자콘:슬서운\n이야기]");

console.log("text-con serialization: ok");

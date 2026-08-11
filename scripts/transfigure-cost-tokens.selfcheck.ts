import assert from "node:assert/strict";
import {
  blocksToPlainText,
  blocksToTiptapDocument,
  tiptapToBlocks,
} from "../src/lib/chemical-utils";
import {
  decodeTransfigureCostTokens,
  encodeTransfigureCostTokens,
  getTransfigureBlocksFromDescription,
  transfigureBlocksToGameDescription,
} from "../src/lib/transfigure-types";

// Round-trip author shorthand ↔ BBCode
assert.equal(encodeTransfigureCostTokens("에너지를 @@ 얻습니다."), "에너지를 [energy:2] 얻습니다.");
assert.equal(encodeTransfigureCostTokens("별 *** 소모."), "별 [star:3] 소모.");
assert.equal(encodeTransfigureCostTokens("@와 *"), "[energy:1]와 [star:1]");
assert.equal(decodeTransfigureCostTokens("[energy:2]와 [star:3]"), "@@와 ***");
assert.equal(
  decodeTransfigureCostTokens(encodeTransfigureCostTokens("@@ **")),
  "@@ **",
);

// Seed path promotes cost tokens to dedicated blocks
const seeded = getTransfigureBlocksFromDescription(
  "에너지를 [energy:2] 얻습니다. [gold]보존[/gold] [star:1]",
  [],
);
assert.deepEqual(seeded, [
  { type: "text", text: "에너지를 " },
  { type: "cost-token", kind: "energy", count: 2 },
  { type: "text", text: " 얻습니다. " },
  {
    type: "keyword",
    text: "보존",
    keyword: "보존",
    description: "보존",
    entityId: undefined,
    entityType: undefined,
  },
  { type: "text", text: " " },
  { type: "cost-token", kind: "star", count: 1 },
]);

// Serialize path encodes token blocks and keeps gold
assert.equal(
  transfigureBlocksToGameDescription([
    { type: "text", text: "에너지를 " },
    { type: "cost-token", kind: "energy", count: 2 },
    { type: "text", text: " 얻습니다. " },
    {
      type: "keyword",
      text: "보존",
      keyword: "보존",
      description: "보존",
    },
    { type: "text", text: " " },
    { type: "cost-token", kind: "star", count: 1 },
  ]),
  "에너지를 [energy:2] 얻습니다. [gold]보존[/gold] [star:1]",
);

// Green tags still strip on seed; cost tokens become blocks
const fromUpgradeBake = getTransfigureBlocksFromDescription(
  "피해를 [green]5[/green] 줍니다. [energy:1]",
  [],
);
assert.deepEqual(fromUpgradeBake, [
  { type: "text", text: "피해를 5 줍니다. " },
  { type: "cost-token", kind: "energy", count: 1 },
]);

// TipTap document round-trip keeps cost-token nodes for WYSIWYG load
const doc = blocksToTiptapDocument(seeded);
const paragraph = doc.content?.[0];
assert.ok(paragraph?.content?.some((node) => node.type === "cost-token"));
const roundTrip = tiptapToBlocks(doc);
assert.equal(blocksToPlainText(roundTrip), "에너지를 @@ 얻습니다. 보존 *");
assert.equal(
  transfigureBlocksToGameDescription(roundTrip),
  "에너지를 [energy:2] 얻습니다. [gold]보존[/gold] [star:1]",
);

// Plain @@ text in blocks expands to cost-token nodes on editor load
const fromPlainAt = blocksToTiptapDocument([
  { type: "text", text: "에너지 @@" },
]);
assert.deepEqual(
  fromPlainAt.content?.[0]?.content?.map((node) => node.type),
  ["text", "cost-token"],
);

console.log("transfigure-cost-tokens.selfcheck: ok");

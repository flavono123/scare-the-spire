import assert from "node:assert/strict";
import {
  blocksToPlainText,
  blocksToTiptapDocument,
  tiptapToBlocks,
} from "../src/lib/chemical-utils";
import type { HistoryRunFloorBlock } from "../src/lib/chemical-types";
import {
  historyFloorCatalogFromActs,
  historyMapCommentMarksForAct,
  historyRunFloorPlainText,
  isHistoryRunFloorBlock,
  matchHistoryFloorMentions,
  materializeHistoryFloorMentions,
} from "../src/lib/history-run-floor";

const floor: HistoryRunFloorBlock = {
  type: "history-run-floor",
  floor: 10,
  actIndex: 0,
  step: 10,
  mapPointType: "elite",
  spriteSrc: "/images/sts2/run-history/elite.png",
};

assert.equal(isHistoryRunFloorBlock(floor), true);
assert.equal(historyRunFloorPlainText(floor, "ko"), "10층");
assert.equal(historyRunFloorPlainText(floor, "en"), "Floor 10");

const roundTrip = tiptapToBlocks(blocksToTiptapDocument([floor]));
assert.deepEqual(roundTrip, [floor]);
assert.equal(blocksToPlainText(roundTrip), "10층");

assert.deepEqual(
  historyMapCommentMarksForAct(
    [
      { content_blocks: [floor] },
      { content_blocks: [floor, { type: "text", text: "again" }] },
      { content_blocks: [{ type: "text", text: "no floor" }] },
    ],
    0,
    10,
  ),
  [{ step: 10, count: 2, current: true }],
);

const catalogActs = [
  {
    baseFloor: 1,
    history: [
      { map_point_type: "monster", rooms: [] },
      { map_point_type: "elite", rooms: [] },
    ],
  },
  {
    baseFloor: 17,
    history: [{ map_point_type: "shop", rooms: [] }],
  },
];

const catalog = historyFloorCatalogFromActs(catalogActs);
assert.equal(catalog.length, 3);
assert.equal(catalog[0]?.floor, 1);
assert.equal(catalog[0]?.actIndex, 0);
assert.equal(catalog[0]?.step, 1);
assert.equal(catalog[1]?.floor, 2);
assert.equal(catalog[1]?.actIndex, 0);
assert.equal(catalog[2]?.floor, 17);
assert.equal(catalog[2]?.actIndex, 1);
assert.equal(catalog[2]?.step, 1);

const nearby = matchHistoryFloorMentions("", catalog, 17);
assert.equal(nearby[0]?.floor, 17);
assert.deepEqual(
  matchHistoryFloorMentions("17", catalog).map((block) => block.floor),
  [17],
);
assert.deepEqual(
  matchHistoryFloorMentions("2", catalog).map((block) => block.floor),
  [2],
);

assert.deepEqual(
  materializeHistoryFloorMentions(
    [{ type: "text", text: "this #17 was spicy, #99 skipped, #2 elite" }],
    catalog,
  ),
  [
    { type: "text", text: "this " },
    catalog[2],
    { type: "text", text: " was spicy, #99 skipped, " },
    catalog[1],
    { type: "text", text: " elite" },
  ],
);

console.log("history-run-floor.spec.ts ok");

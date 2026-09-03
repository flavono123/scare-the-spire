import assert from "node:assert/strict";
import {
  blocksToPlainText,
  blocksToTiptapDocument,
  tiptapToBlocks,
} from "../src/lib/chemical-utils";
import type { HistoryRunFloorBlock } from "../src/lib/chemical-types";
import {
  historyMapCommentMarksForAct,
  historyRunFloorPlainText,
  isHistoryRunFloorBlock,
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

console.log("history-run-floor.spec.ts ok");

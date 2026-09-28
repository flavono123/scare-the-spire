import assert from "node:assert/strict";
import {
  blocksToPlainText,
  blocksToStorageText,
  blocksToTiptapDocument,
  tiptapToBlocks,
} from "../src/lib/chemical-utils";
import type { EmoteConBlock } from "../src/lib/chemical-types";
import { COMMENT_MIN_CHARS } from "../src/lib/content-limits";
import {
  EMOTE_CONS,
  EMOTE_MIN_HIT_PX,
  emoteHitBox,
  emoteHitBoxesOverlap,
  emoteIndexFromDelta,
  emotePlainText,
  emoteStorageText,
  isEmoteId,
} from "../src/lib/emote-con";

const heart: EmoteConBlock = { type: "emote-con", emoteId: "heart" };

const doc = blocksToTiptapDocument([heart]);
assert.equal(doc.content?.[0]?.content?.[0]?.type, "emote-con");
assert.equal(doc.content?.[0]?.content?.[0]?.attrs?.emoteId, "heart");
assert.deepEqual(tiptapToBlocks(doc), [heart]);

assert.equal(blocksToPlainText([heart]), "하트");
assert.equal(blocksToStorageText([heart]), emoteStorageText("heart"));
assert.ok(blocksToPlainText([heart]).length >= COMMENT_MIN_CHARS);

const dropped = tiptapToBlocks({
  type: "doc",
  content: [{
    type: "paragraph",
    content: [{ type: "emote-con", attrs: { emoteId: "not-a-real-emote" } }],
  }],
});
assert.deepEqual(dropped, []);

assert.equal(EMOTE_CONS.length, 8);
assert.equal(isEmoteId("thumb_up"), true);
assert.equal(isEmoteId("좋아요"), false);

for (const emote of EMOTE_CONS) {
  assert.ok(emotePlainText(emote.id).length >= COMMENT_MIN_CHARS, emote.id);
}

for (const wheelSize of [220, 260, 288, 320, 336]) {
  assert.equal(emoteHitBoxesOverlap(wheelSize), false, `overlap at ${wheelSize}`);
  for (let index = 0; index < EMOTE_CONS.length; index += 1) {
    const box = emoteHitBox(index, wheelSize);
    assert.ok(box.size >= EMOTE_MIN_HIT_PX);
    assert.ok(box.left >= -0.5, `${wheelSize} ${box.id} left`);
    assert.ok(box.top >= -0.5, `${wheelSize} ${box.id} top`);
    assert.ok(box.left + box.size <= wheelSize + 0.5, `${wheelSize} ${box.id} right`);
    assert.ok(box.top + box.size <= wheelSize + 0.5, `${wheelSize} ${box.id} bottom`);
    const dx = box.left + box.size / 2 - wheelSize / 2;
    const dy = box.top + box.size / 2 - wheelSize / 2;
    assert.equal(emoteIndexFromDelta(dx, dy), index, `${box.id} sector`);
  }
}

assert.equal(EMOTE_CONS[0]?.id, "exclaim");
assert.equal(EMOTE_CONS[2]?.id, "thumb_down");
assert.equal(EMOTE_CONS[6]?.id, "thumb_up");
assert.equal(emoteIndexFromDelta(10, 0), 0);
assert.equal(emoteIndexFromDelta(0, 10), 2);
assert.equal(emoteIndexFromDelta(-10, 0), 4);
assert.equal(emoteIndexFromDelta(0, -10), 6);

console.log("emote-con serialization: ok");

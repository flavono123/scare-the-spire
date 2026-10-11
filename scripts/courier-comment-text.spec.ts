import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { courierCommentText } from "../src/lib/courier-comment-text";
import { isHistoryCourseDetailPath } from "../src/lib/courier-playback";

const latest = "[카드콘:잿빛 혼령][카드콘:끌어내리기][카드콘:서류 폭풍]";
assert.equal(courierCommentText(latest), "잿빛 혼령끌어내리기서류 폭풍");

assert.equal(
  courierCommentText("다음화 : 네크로바인더{네크로바인더} 너프"),
  "다음화 : 네크로바인더 너프",
);

assert.equal(courierCommentText("[감정콘:heart]"), "하트");
assert.equal(courierCommentText("유물[감정콘:heart]"), "유물 하트");
assert.equal(courierCommentText("[글자콘:한 줄]"), "한 줄");
assert.equal(courierCommentText("[감정콘:missing]"), "");

const patchClient = readFileSync(
  "src/components/patches/patch-comments-client.js",
  "utf8",
);
assert.equal(
  patchClient.includes(".replace(/\\[카드콘:([^\\]]*)\\]/g, \"$1\")"),
  true,
);
assert.equal(patchClient.includes("function courierCommentText"), true);

assert.equal(isHistoryCourseDetailPath("/history-course/174nxe7x9zfpgm1t"), true);
assert.equal(isHistoryCourseDetailPath("/en/history-course/174nxe7x9zfpgm1t"), true);
assert.equal(isHistoryCourseDetailPath("/es-419/history-course/run"), true);
assert.equal(isHistoryCourseDetailPath("/history-course"), false);
assert.equal(isHistoryCourseDetailPath("/history-course/run/extra"), false);
assert.equal(isHistoryCourseDetailPath("/defragment/history-course/run"), false);

console.log("courier-comment-text.spec.ts: ok");

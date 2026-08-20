import assert from "node:assert/strict";
import {
  cursorFromDefragmentItem,
  isMissingDefragmentFeedRpc,
  parseDefragmentFeedRow,
} from "../src/lib/defragment-feed";
import { TOYBOX_FEED_PAGE_SIZE, TOYBOX_FEED_SORT_OPTIONS } from "../src/lib/toybox-feed";
import { serviceMessages } from "../src/messages/service";

assert.equal(TOYBOX_FEED_PAGE_SIZE, 20);
assert.deepEqual(
  [...TOYBOX_FEED_SORT_OPTIONS],
  ["latest", "recommended", "comments"],
);

const parsed = parseDefragmentFeedRow({
  id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  created_at: "2026-08-20T01:02:03.456Z",
  like_count: 2,
  comment_count: 3,
  recommend_score: "26",
  service: "combo",
  title: "Strike / Bash",
});

assert.ok(parsed);
assert.equal(parsed.service, "combo");
assert.equal(parsed.title, "Strike / Bash");
assert.equal(parsed.likeCount, 2);
assert.equal(parsed.commentCount, 3);
assert.equal(parsed.recommendScore, 26);
assert.equal(
  cursorFromDefragmentItem(parsed, "comments").score,
  3,
);
assert.equal(cursorFromDefragmentItem(parsed, "recommended").score, 26);

assert.equal(parseDefragmentFeedRow({ service: "history_course" }), null);
assert.equal(isMissingDefragmentFeedRpc({ code: "PGRST202" }), true);
assert.equal(
  isMissingDefragmentFeedRpc({ message: "Could not find the function public.get_defragment_feed" }),
  true,
);

assert.equal(serviceMessages.ko.defragment.defaultNickname.length <= 20, true);
assert.equal(serviceMessages.en.defragment.defaultNickname.length <= 20, true);

console.log("defragment-feed.spec.ts: ok");

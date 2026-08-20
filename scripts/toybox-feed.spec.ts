import assert from "node:assert/strict";
import {
  asNonNegativeInt,
  buildLatestFeedKeysetFilter,
  cursorFromFeedItem,
  isMissingToyboxFeedRpc,
  isToyboxFeedSort,
  parseToyboxFeedRow,
  TOYBOX_FEED_PAGE_SIZE,
  TOYBOX_FEED_SORT_OPTIONS,
  toyboxRecommendScore,
} from "../src/lib/toybox-feed";

assert.equal(TOYBOX_FEED_PAGE_SIZE, 20);
assert.deepEqual([...TOYBOX_FEED_SORT_OPTIONS], ["latest", "recommended", "comments"]);
assert.equal(toyboxRecommendScore(1, 2), 16);
assert.equal(isToyboxFeedSort("recommended"), true);
assert.equal(isToyboxFeedSort("hot"), false);

assert.equal(asNonNegativeInt("12"), 12);
assert.equal(asNonNegativeInt(-1), null);

assert.equal(
  buildLatestFeedKeysetFilter({
    createdAt: '2026-08-10T01:02:03.456Z',
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  }),
  'created_at.lt."2026-08-10T01:02:03.456Z",and(created_at.eq."2026-08-10T01:02:03.456Z",id.lt."aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")',
);

const parsed = parseToyboxFeedRow({
  id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  created_at: "2026-08-10T01:02:03.456Z",
  like_count: 2,
  comment_count: 3,
  recommend_score: "26",
  post: {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    created_at: "2026-08-10T01:02:03.456Z",
    nickname: "닉",
  },
}, (raw) => raw as { id: string; created_at: string; nickname: string });

assert.ok(parsed);
assert.equal(parsed.likeCount, 2);
assert.equal(parsed.commentCount, 3);
assert.equal(parsed.recommendScore, 26);
assert.equal(parsed.post.nickname, "닉");

assert.deepEqual(
  cursorFromFeedItem(parsed, "comments"),
  {
    score: 3,
    createdAt: "2026-08-10T01:02:03.456Z",
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  },
);
assert.equal(cursorFromFeedItem(parsed, "recommended").score, 26);

assert.equal(isMissingToyboxFeedRpc({ code: "PGRST202" }), true);
assert.equal(
  isMissingToyboxFeedRpc({ message: "Could not find the function public.get_toybox_feed" }),
  true,
);
assert.equal(isMissingToyboxFeedRpc({ code: "42501" }), false);

console.log("toybox-feed.spec.ts: ok");

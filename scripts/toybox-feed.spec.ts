import assert from "node:assert/strict";
import {
  asNonNegativeInt,
  buildLatestFeedKeysetFilter,
  cursorFromFeedItem,
  isMissingToyboxFeedRpc,
  isToyboxFeedCoreSort,
  isToyboxFeedSort,
  parseToyboxFeedRow,
  resolveToyboxFeedSort,
  TOYBOX_FEED_CORE_SORTS,
  TOYBOX_FEED_PAGE_SIZE,
  TOYBOX_FEED_SORT_OPTIONS,
  TOYBOX_FEED_VOTE_RATE_BPS_MAX,
  toyboxFeedCursorScore,
  toyboxFeedSortOptionsFor,
  toyboxRecommendScore,
  toyboxWinnerShareBps,
} from "../src/lib/toybox-feed";
import { serviceMessages } from "../src/messages/service";

assert.equal(TOYBOX_FEED_PAGE_SIZE, 20);
assert.deepEqual([...TOYBOX_FEED_SORT_OPTIONS], ["latest", "recommended", "comments"]);
assert.deepEqual([...TOYBOX_FEED_CORE_SORTS], ["latest", "recommended", "comments"]);
assert.equal(toyboxRecommendScore(1, 2), 16);
assert.equal(isToyboxFeedSort("recommended"), true);
assert.equal(isToyboxFeedCoreSort("recommended"), true);
assert.equal(isToyboxFeedSort("vote_rate_high"), true);
assert.equal(isToyboxFeedCoreSort("vote_rate_high"), false);
assert.equal(isToyboxFeedSort("hot"), false);

assert.deepEqual(
  [...toyboxFeedSortOptionsFor("combo")],
  ["latest", "recommended", "comments"],
);
assert.deepEqual(
  [...toyboxFeedSortOptionsFor("this_or_that")],
  ["latest", "recommended", "comments", "vote_rate_high", "vote_rate_low"],
);
assert.equal(resolveToyboxFeedSort("combo", "vote_rate_high"), "latest");
assert.equal(resolveToyboxFeedSort("this_or_that", "vote_rate_low"), "vote_rate_low");

assert.equal(toyboxWinnerShareBps(0, 0), 0);
assert.equal(toyboxWinnerShareBps(1, 1), 5000);
assert.equal(toyboxWinnerShareBps(9, 1), 9000);
assert.equal(toyboxWinnerShareBps(1, 0), TOYBOX_FEED_VOTE_RATE_BPS_MAX);

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
    left_vote_count: 9,
    right_vote_count: 1,
  },
}, (raw) => raw as {
  id: string;
  created_at: string;
  nickname: string;
  left_vote_count?: number;
  right_vote_count?: number;
});

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
assert.equal(toyboxFeedCursorScore(parsed, "vote_rate_high"), 9000);
assert.equal(toyboxFeedCursorScore(parsed, "vote_rate_low"), 1000);

assert.equal(isMissingToyboxFeedRpc({ code: "PGRST202" }), true);
assert.equal(
  isMissingToyboxFeedRpc({ message: "Could not find the function public.get_toybox_feed" }),
  true,
);
assert.equal(isMissingToyboxFeedRpc({ code: "42501" }), false);

assert.equal(serviceMessages.ko.feedSort.vote_rate_high, "투표율 높은 순");
assert.equal(serviceMessages.ko.feedSort.vote_rate_low, "투표율 낮은 순");
assert.equal(serviceMessages.en.feedSort.vote_rate_high, "High vote rate");
assert.equal(serviceMessages.en.feedSort.vote_rate_low, "Low vote rate");

console.log("toybox-feed.spec.ts: ok");

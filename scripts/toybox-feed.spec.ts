import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ApiUnavailableError } from "../src/lib/api-client";
import {
  asNonNegativeInt,
  buildLatestFeedKeysetFilter,
  cursorFromFeedItem,
  fetchToyboxFeedPage,
  isToyboxFeedCoreSort,
  isToyboxFeedSort,
  parseToyboxFeedRow,
  resolveToyboxFeedSort,
  TOYBOX_FEED_CORE_SORTS,
  TOYBOX_FEED_PAGE_SIZE,
  TOYBOX_FEED_SORT_OPTIONS,
  TOYBOX_FEED_VOTE_RATE_BPS_MAX,
  TOYBOX_FEED_VOTE_TOTAL_SCORE_CEILING,
  toyboxFeedCursorScore,
  toyboxFeedSortOptionsFor,
  toyboxRecommendScore,
  toyboxVoteTotal,
  toyboxWinnerShareBps,
} from "../src/lib/toybox-feed";
import { serviceMessages } from "../src/messages/service";

assert.equal(TOYBOX_FEED_PAGE_SIZE, 20);
assert.deepEqual([...TOYBOX_FEED_SORT_OPTIONS], ["latest", "recommended", "comments"]);
assert.deepEqual([...TOYBOX_FEED_CORE_SORTS], ["latest", "recommended", "comments"]);
assert.equal(toyboxRecommendScore(1), 1);
assert.equal(isToyboxFeedSort("recommended"), true);
assert.equal(isToyboxFeedCoreSort("recommended"), true);
assert.equal(isToyboxFeedSort("vote_rate_high"), true);
assert.equal(isToyboxFeedSort("play_count"), true);
assert.equal(isToyboxFeedCoreSort("vote_rate_high"), false);
assert.equal(isToyboxFeedCoreSort("play_count"), false);
assert.equal(isToyboxFeedSort("hot"), false);

assert.deepEqual(
  [...toyboxFeedSortOptionsFor("combo")],
  ["latest", "recommended", "comments"],
);
assert.deepEqual(
  [...toyboxFeedSortOptionsFor("this_or_that")],
  ["latest", "recommended", "comments", "vote_rate_high", "vote_rate_low"],
);
assert.deepEqual(
  [...toyboxFeedSortOptionsFor("favorite_tournament")],
  ["latest", "recommended", "comments", "play_count"],
);
assert.deepEqual(
  [...toyboxFeedSortOptionsFor("pagestorm")],
  ["latest", "recommended", "comments"],
);
assert.equal(resolveToyboxFeedSort("combo", "vote_rate_high"), "latest");
assert.equal(resolveToyboxFeedSort("this_or_that", "vote_rate_low"), "vote_rate_low");
assert.equal(resolveToyboxFeedSort("favorite_tournament", "play_count"), "play_count");
assert.equal(resolveToyboxFeedSort("favorite_tournament", "vote_rate_high"), "latest");

assert.equal(toyboxWinnerShareBps(0, 0), 0);
assert.equal(toyboxWinnerShareBps(1, 1), 5000);
assert.equal(toyboxWinnerShareBps(9, 1), 9000);
assert.equal(toyboxWinnerShareBps(1, 0), TOYBOX_FEED_VOTE_RATE_BPS_MAX);
assert.equal(toyboxVoteTotal(9, 1), 10);
assert.equal(toyboxVoteTotal(0, 0), 0);

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
assert.equal(cursorFromFeedItem(parsed, "recommended").score, 2);
assert.equal(toyboxFeedCursorScore(parsed, "vote_rate_high"), 10);
assert.equal(
  toyboxFeedCursorScore(parsed, "vote_rate_low"),
  TOYBOX_FEED_VOTE_TOTAL_SCORE_CEILING - 10,
);

assert.equal(serviceMessages.ko.feedSort.vote_rate_high, "투표율 높은 순");
assert.equal(serviceMessages.ko.feedSort.vote_rate_low, "투표율 낮은 순");
assert.equal(serviceMessages.ko.feedSort.play_count, "인기");
assert.equal(serviceMessages.en.feedSort.vote_rate_high, "High vote rate");
assert.equal(serviceMessages.en.feedSort.vote_rate_low, "Low vote rate");
assert.equal(serviceMessages.en.feedSort.play_count, "Popular");

// --- Step 6 (docs/supabase-exit/STEP6_PLAN.md WP-T1): the Worker is the only path -----------

/** The WP-T1 browser modules: no supabase-js, no legacy helper, no Realtime channel. */
const API_ONLY_SOURCES = [
  "src/lib/toybox-feed.ts",
  "src/lib/toybox-api.ts",
  "src/lib/defragment-feed.ts",
  "src/hooks/use-toybox-feed.ts",
  "src/hooks/use-defragment-feed.ts",
  "src/hooks/use-chemical-posts.ts",
  "src/hooks/use-combo-posts.ts",
  "src/hooks/use-transfigure-posts.ts",
  "src/hooks/use-decisions-decisions-posts.ts",
  "src/components/chemicalx/post-view.tsx",
  "src/app/c-c-c-combo/[id]/page-content.tsx",
  "src/app/chemical-x/[id]/page-content.tsx",
  "src/app/this-or-that/[id]/page-content.tsx",
  "src/app/transfigure/[id]/page-content.tsx",
  "src/app/pagestorm/[id]/page-content.tsx",
  "src/app/defragment/[id]/page-content.tsx",
  "src/app/defragment/[id]/[postId]/page-content.tsx",
];
for (const file of API_ONLY_SOURCES) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  for (const banned of [
    /from "@\/lib\/supabase(?:-timeout)?"/,
    /@supabase\//,
    /toybox-post-og-fields/,
    /\bshouldUseLegacy\b/,
    /\bwriteMayGoLegacy\b/,
    /\.channel\(/,
    /\bsupabaseEnabled\b/,
    /\bviaApi\s*=\s*false\b/,
  ]) {
    assert.equal(banned.test(source), false, `${file} has no ${banned}`);
  }
  assert.equal(/\btoyboxViaApi\b/.test(source), false, `${file} has no toyboxViaApi`);
}

type Seen = { url: string; method: string };
const seen: Seen[] = [];
const marked = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json", "x-slseoun-api": "1" },
});
const stubFetch = (respond: () => Response) => {
  seen.length = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push({ url: String(input), method: init?.method ?? "GET" });
    return respond();
  }) as typeof fetch;
};
const normalizePost = (raw: unknown) => raw as { id: string; created_at: string };
const feedRow = (id: string) => ({ id, created_at: "2026-08-10T01:02:03.456+00:00", like_count: 1, comment_count: 0 });

async function main() {
  // A page is the Worker's get_toybox_feed rows, with the service, the resolved sort and the cursor.
  stubFetch(() => marked(Array.from({ length: TOYBOX_FEED_PAGE_SIZE }, (_, index) => feedRow(`row-${index}`))));
  const page = await fetchToyboxFeedPage({
    service: "combo",
    sort: "vote_rate_high",
    cursor: { score: 3.7, createdAt: "2026-08-10T01:02:03.456+00:00", id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" },
    normalizePost,
  });
  assert.equal(page.items.length, TOYBOX_FEED_PAGE_SIZE);
  assert.equal(page.hasMore, true);
  assert.equal(seen.length, 1);
  const url = new URL(seen[0].url, "https://example.test");
  assert.equal(url.pathname, "/api/read/toybox-feed");
  assert.equal(url.searchParams.get("service"), "combo");
  assert.equal(url.searchParams.get("sort"), "latest", "a sort the service does not offer resolves to latest");
  assert.equal(url.searchParams.get("score"), "3");
  assert.equal(url.searchParams.get("created_at"), "2026-08-10T01:02:03.456+00:00");
  assert.equal(url.searchParams.get("cursor_id"), "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");

  stubFetch(() => marked([feedRow("only"), { id: "", created_at: "" }]));
  const short = await fetchToyboxFeedPage({ service: "pagestorm", sort: "latest", cursor: null, normalizePost });
  assert.deepEqual(short.items.map((item) => item.post.id), ["only"], "unparsable rows are dropped");
  assert.equal(short.hasMore, false);
  assert.deepEqual([...new URL(seen[0].url, "https://example.test").searchParams.keys()], ["service", "sort"]);

  // What used to send the feed to get_toybox_feed on Supabase is an outage now: one request, no other.
  for (const [label, respond, code] of [
    ["409 surface_legacy", () => marked({ error: "surface_legacy", reason: "flag" }, 409), "surface_legacy"],
    ["an unmarked platform error page", () => new Response("<html>1102</html>", { status: 503 }), "no_marker"],
    ["an unknown answer version", () => marked({ v: 2, rows: [] }), "bad_version"],
    ["a v1 answer without rows", () => marked({ v: 1 }), "no_upstream"],
    ["a 5xx", () => marked({ error: "unavailable" }, 503), "unavailable"],
  ] as const) {
    stubFetch(respond);
    await assert.rejects(
      () => fetchToyboxFeedPage({ service: "combo", sort: "latest", cursor: null, normalizePost }),
      (error: unknown) => error instanceof ApiUnavailableError && error.code === code,
      label,
    );
    assert.equal(seen.length, 1, `${label}: nothing else is requested`);
  }

  console.log("toybox-feed.spec.ts: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

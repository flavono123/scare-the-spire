import assert from "node:assert/strict";
import { ApiUnavailableError } from "../src/lib/api-client";
import {
  cursorFromDefragmentItem,
  fetchDefragmentFeedPage,
  parseDefragmentFeedRow,
} from "../src/lib/defragment-feed";
import {
  defragmentBoardPath,
  defragmentOriginalHref,
  feedItemFromPost,
} from "../src/lib/defragment";
import {
  DEFRAGMENT_AUTHOR_COL_CLASS,
  DEFRAGMENT_BOARD_CONTAINER_CLASS,
  DEFRAGMENT_DATE_COL_CLASS,
  DEFRAGMENT_TITLE_CLASS,
} from "../src/lib/defragment-board";
import { TOYBOX_FEED_PAGE_SIZE, TOYBOX_FEED_SORT_OPTIONS } from "../src/lib/toybox-feed";
import { DEFAULT_USER_PROFILE } from "../src/lib/user-profile";
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
assert.equal(parsed.nickname, "");
assert.equal(parsed.userId, "");
assert.equal(
  cursorFromDefragmentItem(parsed, "comments").score,
  3,
);
assert.equal(cursorFromDefragmentItem(parsed, "recommended").score, 2);

assert.equal(parseDefragmentFeedRow({ service: "history_course" }), null);
assert.equal(parseDefragmentFeedRow({
  id: "12jr8pfwzycbewd9",
  created_at: "2026-09-01T00:00:00.000Z",
  service: "history_course",
  title: "SEED",
  history_meta: {
    cover_spec: null,
    win: true,
    ascension: 10,
    total_floors: 49,
  },
})?.service, "history_course");
assert.equal(parseDefragmentFeedRow({
  id: "12jr8pfwzycbewd9",
  created_at: "2026-09-01T00:00:00.000Z",
  service: "history_course",
  title: "SEED",
  history_meta: {
    cover_spec: null,
    win: true,
    ascension: 10,
    total_floors: 49,
  },
})?.historyMeta?.totalFloors, 49);
assert.equal(parseDefragmentFeedRow({
  id: parsed.id,
  created_at: parsed.created_at,
  service: "defragment",
  title: "native body",
}), null);

assert.equal(serviceMessages.ko.defragment.defaultNickname, "밀집");
assert.equal(serviceMessages.en.defragment.defaultNickname, "Focus");
assert.equal(serviceMessages.ko.defragment.create, "밀집을 얻습니다");
assert.equal(serviceMessages.en.defragment.create, "Gain Focus.");
assert.equal(serviceMessages.ko.defragment.defaultNickname.length <= 20, true);
assert.equal(serviceMessages.en.defragment.defaultNickname.length <= 20, true);

assert.equal(
  defragmentBoardPath({ id: parsed.id, service: "combo" }),
  `/defragment/combo/${parsed.id}`,
);
assert.equal(
  defragmentOriginalHref({ id: parsed.id, service: "combo" }, "ko", "kor"),
  `/c-c-c-combo/${parsed.id}`,
);
assert.equal(
  defragmentOriginalHref({ id: parsed.id, service: "favorite_tournament" }, "ko", "kor"),
  `/this-or-that/tournament/${parsed.id}`,
);
assert.equal(
  defragmentBoardPath({ id: parsed.id, service: "favorite_tournament" }),
  `/defragment/favorite_tournament/${parsed.id}`,
);
assert.equal(
  defragmentOriginalHref({ id: parsed.id, service: "pagestorm" }, "ko", "kor"),
  `/pagestorm/${parsed.id}`,
);
assert.equal(
  defragmentBoardPath({ id: parsed.id, service: "pagestorm" }),
  `/defragment/pagestorm/${parsed.id}`,
);

const fromCombo = feedItemFromPost("combo", {
  id: parsed.id,
  created_at: parsed.created_at,
  content_text: "Strike / Bash extra words",
  like_count: 1,
  comment_count: 0,
});
assert.equal(fromCombo.service, "combo");
assert.equal(fromCombo.title, "Strike / Bash extra words");
assert.equal(fromCombo.nickname, "");

const fromComboNamed = feedItemFromPost("combo", {
  id: parsed.id,
  created_at: parsed.created_at,
  content_text: "Strike / Bash extra words",
  nickname: "밀집",
  user_id: "bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee",
});
assert.equal(fromComboNamed.nickname, "밀집");
assert.equal(fromComboNamed.userId, "bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee");

const fromTournament = feedItemFromPost("favorite_tournament", {
  id: parsed.id,
  created_at: parsed.created_at,
  title: "네크공주님을석방하라",
  note: "note",
  like_count: 0,
  comment_count: 1,
});
assert.equal(fromTournament.service, "favorite_tournament");
assert.equal(fromTournament.title, "네크공주님을석방하라");

const parsedTournament = parseDefragmentFeedRow({
  id: parsed.id,
  created_at: parsed.created_at,
  like_count: 0,
  comment_count: 0,
  service: "favorite_tournament",
  title: "네크공주님을석방하라",
});
assert.ok(parsedTournament);
assert.equal(parsedTournament.service, "favorite_tournament");

const fromPagestorm = feedItemFromPost("pagestorm", {
  id: parsed.id,
  created_at: parsed.created_at,
  title: "사일런트는 강하다",
  content_text: "본문",
  like_count: 0,
  comment_count: 1,
});
assert.equal(fromPagestorm.service, "pagestorm");
assert.equal(fromPagestorm.title, "사일런트는 강하다");

const parsedPagestorm = parseDefragmentFeedRow({
  id: parsed.id,
  created_at: parsed.created_at,
  like_count: 0,
  comment_count: 0,
  service: "pagestorm",
  title: "사일런트는 강하다",
});
assert.ok(parsedPagestorm);
assert.equal(parsedPagestorm.service, "pagestorm");

const parsedDecisions = parseDefragmentFeedRow({
  id: parsed.id,
  created_at: parsed.created_at,
  service: "decisions_decisions",
  title: "티어",
});
assert.ok(parsedDecisions);
assert.equal(parsedDecisions.service, "decisions_decisions");

const parsedAuthor = parseDefragmentFeedRow({
  id: parsed.id,
  created_at: parsed.created_at,
  service: "chemical_x",
  title: "투입",
  nickname: "익명의 투입터리안",
  user_id: "cccccccc-bbbb-cccc-dddd-eeeeeeeeeeee",
});
assert.ok(parsedAuthor);
assert.equal(parsedAuthor.nickname, "익명의 투입터리안");
assert.equal(parsedAuthor.userId, "cccccccc-bbbb-cccc-dddd-eeeeeeeeeeee");

assert.equal(DEFRAGMENT_BOARD_CONTAINER_CLASS.includes("@container"), true);
assert.equal(DEFRAGMENT_TITLE_CLASS.includes("line-clamp-2"), true);
assert.equal(DEFRAGMENT_TITLE_CLASS.includes("@xl:truncate"), true);
assert.equal(DEFRAGMENT_AUTHOR_COL_CLASS.includes("hidden"), true);
assert.equal(DEFRAGMENT_AUTHOR_COL_CLASS.includes("@xl:block"), true);
assert.equal(DEFRAGMENT_DATE_COL_CLASS.includes("hidden"), true);
assert.equal(DEFRAGMENT_DATE_COL_CLASS.includes("@xl:block"), true);

// --- Step 6 (docs/supabase-exit/STEP6_PLAN.md WP-T1): the Worker is the only path -----------

const seen: string[] = [];
const marked = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json", "x-slseoun-api": "1" },
});
const stubFetch = (respond: () => Response) => {
  seen.length = 0;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    seen.push(String(input));
    return respond();
  }) as typeof fetch;
};
const requested = () => seen.map((url) => {
  const parsedUrl = new URL(url, "https://example.test");
  return { path: parsedUrl.pathname, query: Object.fromEntries(parsedUrl.searchParams) };
});
const runRow = {
  id: "12jr8pfwzycbewd9",
  created_at: "2026-09-01T00:00:00+00:00",
  like_count: 4,
  comment_count: 1,
  seed: "SEED",
  donor_user_id: null,
  donor_nickname: " ",
  cover_spec: null,
  win: true,
  ascension: 10,
  total_floors: 49,
};
const runCursor = { score: 4, createdAt: "2026-09-01T00:00:00+00:00", id: "12jr8pfwzycbewd9" };
const postRow = { id: parsed.id, created_at: parsed.created_at, title: parsed.title, like_count: 2, comment_count: 3 };

async function main() {
  // The federated feed: get_defragment_feed_v2 rows through the Worker, core sorts only.
  stubFetch(() => marked([{ ...postRow, service: "combo" }]));
  const feed = await fetchDefragmentFeedPage({ sort: "play_count", cursor: null });
  assert.equal(feed.items.length, 1);
  assert.equal(feed.hasMore, false);
  assert.deepEqual(requested(), [{ path: "/api/read/defragment-feed", query: { sort: "latest" } }]);

  // The history-course filter: the runs feed through the Worker, mapped as the runs rows were.
  stubFetch(() => marked([runRow]));
  const runs = await fetchDefragmentFeedPage({ sort: "comments", cursor: runCursor, service: "history_course" });
  assert.deepEqual(requested(), [{
    path: "/api/read/defragment-runs",
    query: { sort: "comments", score: "4", created_at: runCursor.createdAt, cursor_id: runCursor.id },
  }]);
  assert.equal(runs.items[0]?.service, "history_course");
  assert.equal(runs.items[0]?.title, "SEED");
  assert.equal(runs.items[0]?.nickname, DEFAULT_USER_PROFILE.nickname, "a blank donor nickname is the default profile's");
  assert.equal(runs.items[0]?.recommendScore, 4);
  assert.equal(runs.items[0]?.historyMeta?.totalFloors, 49);

  // Another service filter is that service's toybox feed.
  stubFetch(() => marked([{ ...postRow, content_text: "Strike / Bash" }]));
  const combo = await fetchDefragmentFeedPage({ sort: "recommended", cursor: null, service: "combo" });
  assert.deepEqual(requested(), [{ path: "/api/read/toybox-feed", query: { service: "combo", sort: "recommended" } }]);
  assert.equal(combo.items[0]?.service, "combo");
  assert.equal(combo.items[0]?.likeCount, 2);

  // A cursor the Worker would refuse used to go to Supabase; it is an outage now and nothing is sent.
  for (const [label, cursor] of [
    ["a run id outside the row id rule", { ...runCursor, id: "run id with spaces" }],
    ["a created_at that is not an ISO time", { ...runCursor, createdAt: "yesterday" }],
  ] as const) {
    for (const service of ["history_course", null] as const) {
      stubFetch(() => marked([]));
      await assert.rejects(
        () => fetchDefragmentFeedPage({ sort: "latest", cursor, service }),
        (error: unknown) => error instanceof ApiUnavailableError && error.code === "bad_cursor",
        `${label} (${service ?? "all"})`,
      );
      assert.equal(seen.length, 0, `${label} (${service ?? "all"}): no request`);
    }
  }

  // Former legacy signals are outages too: one request, no other.
  for (const [label, respond, code] of [
    ["409 surface_legacy", () => marked({ error: "surface_legacy", reason: "flag" }, 409), "surface_legacy"],
    ["an unmarked platform error page", () => new Response("<html>1102</html>", { status: 502 }), "no_marker"],
  ] as const) {
    for (const service of ["history_course", null] as const) {
      stubFetch(respond);
      await assert.rejects(
        () => fetchDefragmentFeedPage({ sort: "latest", cursor: null, service }),
        (error: unknown) => error instanceof ApiUnavailableError && error.code === code,
        `${label} (${service ?? "all"})`,
      );
      assert.equal(seen.length, 1, `${label} (${service ?? "all"}): nothing else is requested`);
    }
  }

  console.log("defragment-feed.spec.ts: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

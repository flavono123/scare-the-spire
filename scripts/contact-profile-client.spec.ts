/**
 * Browser side of colorful philosophers, contact and profile after step 6
 * (docs/supabase-exit/STEP6_PLAN.md WP-D): every call goes to the same-origin
 * Worker; a post id that is not a uuid and a week of another env are unavailable
 * without a request (what the direct Supabase read gave them); a former legacy
 * signal (409 surface_legacy, an answer without the router marker, an unknown
 * answer version) gives each caller its outage result, with nothing resent.
 * Usage: tsx scripts/contact-profile-client.spec.ts
 */
import assert from "node:assert/strict";

const UID = "11111111-1111-4111-8111-111111111111";
const POST_ID = "44444444-4444-4444-8444-444444444444";

class MemoryStorage {
  private readonly items = new Map<string, string>();
  get length() {
    return this.items.size;
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, String(value));
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
}

// A browser that claimed its cookie identity: the Worker names the user, so no
// token and no Supabase session are needed.
const localStorage = new MemoryStorage();
localStorage.setItem("slseoun-identity", JSON.stringify({ uid: UID, at: "2026-11-09T00:00:00.000Z" }));
Object.assign(globalThis, {
  window: { localStorage },
  document: { cookie: "slseoun_idm=cookie" },
});

type Call = { url: string; method: string; body: unknown; authorization: string | null };
const calls: Call[] = [];

const marked = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json", "x-slseoun-api": "1" },
});
const legacySignal = () => marked({ error: "surface_legacy", reason: "flag" }, 409);
const unmarkedPage = () => new Response("<html>error 1102</html>", { status: 503, headers: { "content-type": "text/html" } });
const otherVersion = () => marked({ v: 2, rows: [], posts: [], post: null, unseen: true });

let respond: (call: Call) => Response = () => {
  throw new Error("no response set");
};

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const headers = new Headers(init?.headers);
  const call: Call = {
    url,
    method: init?.method ?? "GET",
    body: typeof init?.body === "string" ? JSON.parse(init.body) : init?.body ?? null,
    authorization: headers.get("authorization"),
  };
  calls.push(call);
  // A client that claims again (WP-A) gets the same uid back.
  if (url === "/api/auth/claim") return marked({ v: 1, uid: UID, created: false });
  return respond(call);
}) as typeof fetch;

/** The data calls since `from` (claims left out). */
function dataCalls(from: number): Call[] {
  return calls.slice(from).filter((call) => call.url !== "/api/auth/claim");
}

/** Runs `run` against `answer` and returns the data calls it made. */
async function withAnswer<T>(answer: (call: Call) => Response, run: () => Promise<T>): Promise<{ result: PromiseSettledResult<T>; made: Call[] }> {
  respond = answer;
  const from = calls.length;
  const [result] = await Promise.allSettled([run()]);
  return { result, made: dataCalls(from) };
}

const signals: ReadonlyArray<readonly [string, () => Response, string]> = [
  ["409 surface_legacy", legacySignal, "surface_legacy"],
  ["an answer without the router marker", unmarkedPage, "no_marker"],
  ["an unknown answer version", otherVersion, "bad_version"],
];

async function main() {
  const { ApiUnavailableError } = await import("../src/lib/api-client");
  const { dataEnv } = await import("../src/lib/data-env");
  const {
    fetchColorfulPhilosopherPost,
    fetchColorfulPhilosopherWeek,
    // Holds no state any more; renamed so the hook lint lets the spec call it.
    useColorfulPhilosopherCommentCounts: commentCountsFor,
  } = await import("../src/hooks/use-colorful-philosopher-posts");
  const {
    ContactInquiryRateLimitError,
    hasUnseenContactReply,
    listOwnContactInquiries,
    markOwnContactRepliesSeen,
    submitContactInquiry,
  } = await import("../src/lib/contact-inquiries");
  const { fetchProfileCharacterNicknamePools } = await import("../src/hooks/use-profile-character-nicknames");
  const { readActivityRows, readStatsRows } = await import("../src/hooks/use-profile-activity");

  const unavailable = (result: PromiseSettledResult<unknown>, code?: string) => (
    result.status === "rejected"
    && result.reason instanceof ApiUnavailableError
    && (code === undefined || result.reason.code === code)
  );

  const postRow = {
    id: POST_ID,
    week_start: "2026-11-09",
    slot: "card",
    resource_type: "card",
    resource_id: "bash",
    name_ko: "강타",
    name_en: "Bash",
    image_url: null,
    body: "Is it still good?",
    game_version: "0.104.0",
    buff_count: 3,
    nerf_count: 1,
    rework_count: 0,
  };

  // --- Colorful philosophers: a post -------------------------------------------
  // The id column is a uuid: before step 6 these went to Supabase, PostgREST failed on the cast
  // and the page said the database was not answering. Now the same, without a request.
  for (const id of ["not-a-uuid", "__id__", "1", `${POST_ID}x`, `${POST_ID.slice(0, -1)}g`]) {
    const { result, made } = await withAnswer(() => marked({ v: 1, post: postRow }), () => fetchColorfulPhilosopherPost(id));
    assert.ok(unavailable(result), `post id "${id}" is unavailable`);
    assert.equal(made.length, 0, `post id "${id}" makes no request`);
  }

  {
    const { result, made } = await withAnswer(() => marked({ v: 1, post: postRow }), () => fetchColorfulPhilosopherPost(POST_ID));
    assert.equal(result.status, "fulfilled");
    assert.equal(result.status === "fulfilled" ? result.value?.id : null, POST_ID);
    assert.deepEqual(made.map((call) => `${call.method} ${call.url}`), [`GET /api/read/colorful-philosophers/post?id=${POST_ID}`]);
  }
  {
    const upper = POST_ID.toUpperCase();
    const { result, made } = await withAnswer(() => marked({ v: 1, post: null }), () => fetchColorfulPhilosopherPost(upper));
    assert.equal(result.status, "fulfilled");
    assert.equal(result.status === "fulfilled" ? result.value : undefined, null, "no post: the page's not found");
    assert.equal(made.length, 1, "an upper-case uuid is still read");
  }
  for (const [label, answer, code] of signals) {
    const { result, made } = await withAnswer(answer, () => fetchColorfulPhilosopherPost(POST_ID));
    assert.ok(unavailable(result, code), `post: ${label} is unavailable`);
    assert.equal(made.length, 1, `post: ${label} is not redone`);
  }

  // --- Colorful philosophers: the week -----------------------------------------
  {
    const otherEnv = dataEnv === "production" ? "development" : "production";
    const { result, made } = await withAnswer(() => marked({ v: 1, posts: [postRow] }), () => fetchColorfulPhilosopherWeek(otherEnv));
    assert.ok(unavailable(result), "another env's week is unavailable");
    assert.equal(made.length, 0, "another env's week makes no request");
  }
  {
    const { result, made } = await withAnswer(
      () => marked({ v: 1, posts: [postRow, { id: "broken" }], commentCounts: { [POST_ID]: 2 } }),
      () => fetchColorfulPhilosopherWeek(),
    );
    assert.equal(result.status, "fulfilled");
    if (result.status === "fulfilled") {
      assert.deepEqual(result.value.posts.map((post) => post.id), [POST_ID], "rows that do not parse are left out");
      assert.deepEqual(result.value.commentCounts, { [POST_ID]: 2 });
    }
    assert.deepEqual(made.map((call) => `${call.method} ${call.url}`), ["GET /api/read/colorful-philosophers/week"]);
  }
  {
    const { result } = await withAnswer(() => marked({ v: 1, posts: [postRow] }), () => fetchColorfulPhilosopherWeek(dataEnv));
    assert.equal(result.status, "fulfilled");
    assert.deepEqual(result.status === "fulfilled" ? result.value.commentCounts : null, {}, "no counts in the answer: none shown");
  }
  for (const [label, answer, code] of signals) {
    const { result, made } = await withAnswer(answer, () => fetchColorfulPhilosopherWeek());
    assert.ok(unavailable(result, code), `week: ${label} is unavailable`);
    assert.equal(made.length, 1, `week: ${label} is not redone`);
  }

  // Reply counts come only with the week: nothing is counted in the browser.
  assert.deepEqual(commentCountsFor([POST_ID], null), {});
  assert.deepEqual(commentCountsFor([POST_ID], { [POST_ID]: 5 }), { [POST_ID]: 5 });

  // --- Contact: submit -----------------------------------------------------------
  const inquiry = {
    category: "bug" as const,
    message: "The page does not load.",
    replyEmail: null,
    pagePath: "/compendium/cards/bash",
    serviceLocale: "ko" as const,
    gameLocale: "kor" as const,
    viewportWidth: 390,
    viewportHeight: 844,
  };
  {
    const { result, made } = await withAnswer(() => marked({ v: 1, id: "x" }, 201), () => submitContactInquiry(inquiry));
    assert.equal(result.status, "fulfilled");
    assert.equal(made.length, 1);
    assert.equal(made[0].method, "POST");
    assert.equal(made[0].url, "/api/write/contact-inquiries");
    assert.deepEqual(made[0].body, inquiry, "the Worker fills the user and env");
    assert.equal(made[0].authorization, null, "no bearer token");
  }
  {
    const { result } = await withAnswer(() => marked({ error: "rate_limited" }, 429), () => submitContactInquiry(inquiry));
    assert.ok(result.status === "rejected" && result.reason instanceof ContactInquiryRateLimitError, "rate limited");
  }
  for (const [label, answer] of [["409 surface_legacy", legacySignal], ["an answer without the router marker", unmarkedPage]] as const) {
    const { result, made } = await withAnswer(answer, () => submitContactInquiry(inquiry));
    assert.ok(unavailable(result, "unavailable"), `submit: ${label} is the form's unavailable state`);
    assert.ok(!(result.status === "rejected" && result.reason instanceof ContactInquiryRateLimitError));
    assert.equal(made.length, 1, `submit: ${label} is not resent`);
  }

  // --- Profile: inquiries, mailbox, mark seen ----------------------------------------
  {
    const row = {
      id: "inq-1",
      category: "bug",
      message: "hello",
      env: "production",
      status: "done",
      admin_response: "fixed",
      reply_seen_at: null,
      created_at: "2026-11-01T00:00:00.000Z",
    };
    const { result, made } = await withAnswer(() => marked({ v: 1, rows: [row] }), () => listOwnContactInquiries());
    assert.equal(result.status, "fulfilled");
    assert.deepEqual(result.status === "fulfilled" ? result.value : null, [{
      id: "inq-1",
      category: "bug",
      message: "hello",
      env: "production",
      status: "done",
      adminResponse: "fixed",
      replySeenAt: null,
      createdAt: "2026-11-01T00:00:00.000Z",
    }]);
    assert.deepEqual(made.map((call) => `${call.method} ${call.url}`), ["GET /api/me/profile/inquiries"]);
  }
  for (const [label, answer, code] of signals) {
    const { result, made } = await withAnswer(answer, () => listOwnContactInquiries());
    assert.ok(unavailable(result, code), `inquiries: ${label} is the list's notice`);
    assert.equal(made.length, 1);
  }

  {
    const { result, made } = await withAnswer(() => marked({ v: 1, unseen: true }), () => hasUnseenContactReply());
    assert.deepEqual(result, { status: "fulfilled", value: true });
    assert.deepEqual(made.map((call) => `${call.method} ${call.url}`), ["GET /api/me/mailbox"]);
  }
  for (const [label, answer] of signals) {
    const { result, made } = await withAnswer(answer, () => hasUnseenContactReply());
    assert.deepEqual(result, { status: "fulfilled", value: null }, `mailbox: ${label} keeps the dot as it was`);
    assert.equal(made.length, 1);
  }

  const warn = console.warn;
  const warnings: unknown[][] = [];
  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };
  try {
    {
      const { result, made } = await withAnswer(() => new Response(null, { status: 204, headers: { "x-slseoun-api": "1" } }), () => markOwnContactRepliesSeen());
      assert.equal(result.status, "fulfilled");
      assert.deepEqual(made.map((call) => `${call.method} ${call.url}`), ["POST /api/write/profile/inquiries-seen"]);
    }
    for (const [label, answer] of [["409 surface_legacy", legacySignal], ["an answer without the router marker", unmarkedPage]] as const) {
      const before = warnings.length;
      const { result, made } = await withAnswer(answer, () => markOwnContactRepliesSeen());
      assert.equal(result.status, "fulfilled", `mark seen: ${label} only warns`);
      assert.equal(warnings.length, before + 1);
      assert.equal(made.length, 1, `mark seen: ${label} is not resent`);
    }
  } finally {
    console.warn = warn;
  }

  // --- Profile: nicknames, stats, activity -------------------------------------------
  {
    const { result, made } = await withAnswer(() => marked({ v: 1, rows: [] }), () => fetchProfileCharacterNicknamePools());
    assert.ok(result.status === "fulfilled" && result.value !== null, "v1 rows: the pools (the defaults when empty)");
    assert.deepEqual(made.map((call) => `${call.method} ${call.url}`), ["GET /api/read/profile/nicknames"]);
  }
  {
    const { result } = await withAnswer(() => marked({ v: 1, rows: null }), () => fetchProfileCharacterNicknamePools());
    assert.deepEqual(result, { status: "fulfilled", value: null }, "v1 without rows: the table is not deployed");
  }
  for (const [label, answer] of signals) {
    const { result, made } = await withAnswer(answer, () => fetchProfileCharacterNicknamePools());
    assert.deepEqual(result, { status: "fulfilled", value: null }, `nicknames: ${label} is null`);
    assert.equal(made.length, 1);
  }

  {
    const stats = [{ category: "comments", post_count: "2", like_count: 1 }];
    const { result, made } = await withAnswer(() => marked({ v: 1, rows: stats }), () => readStatsRows());
    assert.deepEqual(result, { status: "fulfilled", value: stats });
    assert.deepEqual(made.map((call) => `${call.method} ${call.url}`), ["GET /api/me/profile/stats"]);
  }
  {
    const { result, made } = await withAnswer(() => marked({ v: 1, rows: [] }), () => readActivityRows("comments", "likes", 20));
    assert.deepEqual(result, { status: "fulfilled", value: [] });
    assert.deepEqual(made.map((call) => `${call.method} ${call.url}`), ["GET /api/me/profile/activity?category=comments&sort=likes&offset=20"]);
  }
  for (const [label, answer, code] of signals) {
    const stats = await withAnswer(answer, () => readStatsRows());
    assert.ok(unavailable(stats.result, code), `stats: ${label} is the profile's notice`);
    assert.equal(stats.made.length, 1);
    const activity = await withAnswer(answer, () => readActivityRows("all", "latest", 0));
    assert.ok(unavailable(activity.result, code), `activity: ${label} is the profile's notice`);
    assert.equal(activity.made.length, 1);
  }

  // --- Nothing left the same origin ---------------------------------------------------
  assert.ok(calls.length > 0);
  for (const call of calls) {
    assert.ok(call.url.startsWith("/api/"), `same-origin api only: ${call.url}`);
    assert.ok(!/supabase|\/rest\/v1|\/auth\/v1/.test(call.url), `no Supabase: ${call.url}`);
    assert.equal(call.authorization, null, `no bearer token: ${call.url}`);
  }

  console.log(`contact-profile-client.spec: ok (${calls.length} requests)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

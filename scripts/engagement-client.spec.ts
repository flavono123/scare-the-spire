/**
 * Step 6 WP-C (docs/supabase-exit/STEP6_PLAN.md "WP-C"): the comments and stories groups in the
 * browser have no legacy path. A key the Worker refuses is an empty thread (nothing is sent), a
 * former legacy signal (409 surface_legacy, no marker header, another version) is "unavailable",
 * writes go to /api/write only, and the dev reel's two reaction helpers call the Worker.
 * The hooks run in react-dom with a minimal fake container (they render nothing).
 * Usage: tsx scripts/engagement-client.spec.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { useCommunityStories as UseCommunityStories } from "../src/hooks/use-community-stories";

// --- Type-level: `limit` is one of the Worker's page sizes (tsc -p . checks scripts/) ---------
type StoryOptions = NonNullable<Parameters<typeof UseCommunityStories>[1]>;
// @ts-expect-error 50 is not a page size the Worker takes (stories-api-rules.ts STORY_LIMITS)
const badLimit: StoryOptions["limit"] = 50;
const goodLimits: StoryOptions["limit"][] = [100, 200, 1000];
void badLimit;
void goodLimits;

// --- A page without a DOM ---------------------------------------------------------------------
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
  clear() {
    this.items.clear();
  }
}

const noop = () => undefined;
class FakeIframe {}
const fakeDocument: Record<string, unknown> = { cookie: "", activeElement: null, addEventListener: noop, removeEventListener: noop };
const storage = new MemoryStorage();
const fakeWindow: Record<string, unknown> = {
  document: fakeDocument,
  localStorage: storage,
  HTMLIFrameElement: FakeIframe,
  addEventListener: noop,
  removeEventListener: noop,
};
fakeDocument.defaultView = fakeWindow;

/** Enough of an element for react-dom to mount a component that renders nothing. */
function fakeContainer() {
  return {
    nodeType: 1,
    nodeName: "DIV",
    tagName: "DIV",
    namespaceURI: "http://www.w3.org/1999/xhtml",
    ownerDocument: fakeDocument,
    textContent: "",
    firstChild: null,
    childNodes: [],
    addEventListener: noop,
    removeEventListener: noop,
    appendChild: noop,
    removeChild: noop,
  };
}
fakeDocument.documentElement = fakeContainer();
fakeDocument.body = fakeDocument.documentElement;
Object.assign(globalThis, { window: fakeWindow, document: fakeDocument, IS_REACT_ACT_ENVIRONMENT: false });

// --- The Worker -------------------------------------------------------------------------------
type Call = { method: string; url: string; body: unknown };
const calls: Call[] = [];
const allCalls: Call[] = [];
let reply: (call: Call) => Response = () => marked({ error: "unexpected" }, 500);

function marked(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "x-slseoun-api": "1" } });
}

const LEGACY_SIGNALS: readonly [string, () => Response][] = [
  ["409 surface_legacy", () => marked({ error: "surface_legacy", reason: "flag" }, 409)],
  ["an unmarked answer", () => new Response("<html>error 1102</html>", { status: 503, headers: { "content-type": "text/html" } })],
  ["another version", () => marked({ v: 2 })],
];

globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
  const call: Call = {
    method: init?.method ?? "GET",
    url: String(input),
    body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
  };
  calls.push(call);
  allCalls.push(call);
  return reply(call);
}) as typeof fetch;

const pathOf = (call: Call) => call.url.split("?")[0];
const queryOf = (call: Call) => new URLSearchParams(call.url.split("?")[1] ?? "");

async function waitFor(check: () => boolean, label: string): Promise<void> {
  const until = Date.now() + 3000;
  while (!check()) {
    if (Date.now() > until) throw new Error(`timed out: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

/** Past the engagement batch window (8 ms quiet, 40 ms at most) and a render. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 80));

async function main() {
  const { createElement } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { ApiUnavailableError } = await import("../src/lib/api-client");
  const { engagementApiFor, loadEngagement, loadEngagementMine, prefetchEngagement } = await import("../src/lib/api-engagement");
  const { useComments } = await import("../src/hooks/use-comments");
  const { useCommentLikes } = await import("../src/hooks/use-comment-likes");
  const { useLikes } = await import("../src/hooks/use-likes");
  const { fetchResourceReactionCounts, saveResourceReaction, useResourceReactions } = await import("../src/hooks/use-resource-reactions");
  const { useEngagementCounts } = await import("../src/hooks/use-engagement-counts");
  const { useCommunityStories } = await import("../src/hooks/use-community-stories");
  const { IDENTITY_MARKER_STORAGE_KEY, IDENTITY_MODE_COOKIE_NAME, IDENTITY_MODE_COOKIE_VALUE } = await import("../src/lib/identity-cookies");

  // This browser claimed its identity (the Worker's signed cookie names the user).
  fakeDocument.cookie = `${IDENTITY_MODE_COOKIE_NAME}=${IDENTITY_MODE_COOKIE_VALUE}`;
  storage.setItem(IDENTITY_MARKER_STORAGE_KEY, JSON.stringify({ uid: "u1", at: "2026-11-09T00:00:00.000Z" }));

  const roots: { unmount(): void }[] = [];
  async function mount<T>(hook: () => T): Promise<{ readonly current: T }> {
    const box: { value?: T; rendered: boolean } = { rendered: false };
    function Probe() {
      box.value = hook();
      box.rendered = true;
      return null;
    }
    const root = createRoot(fakeContainer() as unknown as Element);
    roots.push(root);
    root.render(createElement(Probe));
    await waitFor(() => box.rendered, "first render");
    return {
      get current() {
        return box.value as T;
      },
    };
  }
  const unavailable = (code: string) => (error: unknown) => error instanceof ApiUnavailableError && error.code === code;

  // --- api-engagement: former legacy signals are an outage ------------------------------------
  assert.equal(engagementApiFor("threads", "sts2-codex:card:bash"), true);
  assert.equal(engagementApiFor("threads", "bad key"), false);
  assert.equal(engagementApiFor("reactions", "card:bad id:0.104.0"), false);
  for (const [label, respond, code] of [
    ["another version", () => marked({ v: 2 }), "bad_version"],
    ["409 surface_legacy", () => marked({ error: "surface_legacy" }, 409), "surface_legacy"],
    ["an unmarked answer", () => new Response("<html></html>", { status: 503 }), "no_marker"],
  ] as const) {
    reply = respond;
    await assert.rejects(() => loadEngagement("threads", `wpc:signal:${code}`), unavailable(code), `read: ${label}`);
    await assert.rejects(() => loadEngagementMine("likes", `wpc:signal:${code}`), unavailable(code), `me: ${label}`);
  }
  // A refused key is never asked for, even in a prefetch.
  calls.length = 0;
  prefetchEngagement("threads", ["bad key", "also bad!"]);
  await settle();
  assert.equal(calls.length, 0, "prefetch skips refused keys");

  // --- Comments and comment likes: a refused key is an empty thread ---------------------------
  calls.length = 0;
  const refusedThread = await mount(() => {
    const thread = useComments("bad key", "u1");
    return { thread, likes: useCommentLikes("bad key", thread.comments, "u1") };
  });
  await waitFor(() => !refusedThread.current.thread.loading, "refused thread loads");
  assert.deepEqual(refusedThread.current.thread.comments, []);
  assert.equal(refusedThread.current.thread.unavailable, false, "an empty thread, not an outage");
  await refusedThread.current.thread.remove("c1");
  refusedThread.current.likes.toggle("c1", "u1");
  await assert.rejects(() => refusedThread.current.thread.add("nick", "hello there", undefined, "u1"));
  await waitFor(() => refusedThread.current.thread.unavailable, "a comment on a refused key is unavailable");
  await settle();
  assert.equal(calls.length, 0, "a refused key sends nothing");

  // Former legacy signals: the thread shows its unavailable state.
  for (const [index, [label, respond]] of LEGACY_SIGNALS.entries()) {
    calls.length = 0;
    reply = respond;
    const key = `wpc:legacy-thread-${index}`;
    const view = await mount(() => useComments(key, null));
    await waitFor(() => !view.current.loading, `thread settles after ${label}`);
    assert.equal(view.current.unavailable, true, `thread: ${label}`);
    assert.deepEqual(view.current.comments, []);
    assert.deepEqual(calls.map((call) => call.url), [`/api/read/engagement?threads=${key}`], `one api read, nothing else: ${label}`);
  }

  // The api path: rows with like_count, this user's likes, then writes.
  {
    calls.length = 0;
    const key = "wpc:thread-ok";
    const row = (id: string, likes: number) => ({
      id, story_id: key, user_id: "u2", nickname: "n", content: "hello there", content_blocks: null,
      created_at: "2026-11-09T00:00:00.000Z", avatar_id: null, avatar_kind: null, palette_id: null, palette_swapped: false, like_count: likes,
    });
    reply = (call) => {
      const pathname = pathOf(call);
      if (pathname === "/api/read/engagement") return marked({ v: 1, env: "production", threads: { [key]: [row("c1", 2)] } });
      if (pathname === "/api/me/engagement") return marked({ v: 1, commentLikes: { [key]: ["c1"] } });
      if (pathname === "/api/write/comments" && call.method === "POST") return marked({ comment: { ...row("c2", 0), user_id: "u1" } }, 201);
      if (pathname === "/api/write/comments" && call.method === "DELETE") return marked({ deleted: true });
      if (pathname === "/api/write/comment-likes") return marked({ liked: false, count: 1 });
      return marked({ error: "unexpected" }, 500);
    };
    const view = await mount(() => {
      const thread = useComments(key, "u1");
      return { thread, likes: useCommentLikes(key, thread.comments, "u1") };
    });
    await waitFor(() => !view.current.thread.loading && view.current.likes.liked.has("c1"), "thread and my likes load");
    assert.deepEqual(view.current.thread.comments.map((comment) => comment.id), ["c1"]);
    assert.equal(view.current.likes.counts.get("c1"), 2, "counts come with the rows");

    await view.current.thread.add("nick", "hello there", undefined, "u1");
    await waitFor(() => view.current.thread.comments.length === 2, "the new comment is listed");
    assert.equal(view.current.likes.counts.get("c2"), 0);
    const post = calls.find((call) => call.method === "POST");
    assert.equal(post?.url, "/api/write/comments");
    assert.deepEqual(
      { threadKey: (post?.body as Record<string, unknown>).threadKey, content: (post?.body as Record<string, unknown>).content },
      { threadKey: key, content: "hello there" },
    );

    view.current.likes.toggle("c1", "u1");
    await waitFor(() => !view.current.likes.liked.has("c1"), "unlike applies");
    assert.equal(view.current.likes.counts.get("c1"), 1, "the count the write answered");
    assert.ok(calls.some((call) => call.method === "DELETE" && call.url === "/api/write/comment-likes?id=c1"));

    await view.current.thread.remove("c2");
    await waitFor(() => view.current.thread.comments.length === 1, "the removed comment leaves");
    assert.ok(calls.some((call) => call.method === "DELETE" && call.url === "/api/write/comments?id=c2"));
    assert.equal(view.current.thread.unavailable, false);

    // A write the Worker cannot take shows the unavailable state.
    reply = (call) => (call.method === "POST" ? marked({ error: "surface_legacy" }, 409) : marked({ error: "unexpected" }, 500));
    await assert.rejects(() => view.current.thread.add("nick", "hello again", undefined, "u1"), /unavailable/);
    await waitFor(() => view.current.thread.unavailable, "a refused write is unavailable");
  }

  // --- Page likes -----------------------------------------------------------------------------
  {
    calls.length = 0;
    const refused = await mount(() => useLikes("bad key", "u1"));
    await waitFor(() => !refused.current.loading, "refused likes load");
    assert.equal(refused.current.count, 0);
    assert.equal(refused.current.liked, false);
    assert.equal(refused.current.unavailable, false);
    await refused.current.toggle("u1");
    await waitFor(() => refused.current.unavailable, "a like on a refused key is unavailable");
    assert.equal(refused.current.count, 0);
    assert.equal(calls.length, 0, "a refused key sends nothing");

    for (const [index, [label, respond]] of LEGACY_SIGNALS.entries()) {
      reply = respond;
      const view = await mount(() => useLikes(`wpc:legacy-likes-${index}`, null));
      await waitFor(() => !view.current.loading, `likes settle after ${label}`);
      assert.equal(view.current.unavailable, true, `likes: ${label}`);
    }

    calls.length = 0;
    const key = "wpc:likes-ok";
    reply = (call) => {
      const pathname = pathOf(call);
      if (pathname === "/api/read/engagement") return marked({ v: 1, env: "production", likes: { [key]: 3 } });
      if (pathname === "/api/me/engagement") return marked({ v: 1, likes: { [key]: true } });
      if (pathname === "/api/write/likes") return marked({ liked: false });
      return marked({ error: "unexpected" }, 500);
    };
    const view = await mount(() => useLikes(key, "u1"));
    await waitFor(() => !view.current.loading, "likes load");
    assert.deepEqual([view.current.count, view.current.liked], [3, true]);
    await view.current.toggle("u1");
    await waitFor(() => !view.current.liked, "unlike applies");
    assert.deepEqual([view.current.count, view.current.liked, view.current.unavailable], [2, false, false]);
    assert.ok(calls.some((call) => call.method === "DELETE" && call.url === `/api/write/likes?key=${encodeURIComponent(key)}`));
  }

  // --- Resource reactions ---------------------------------------------------------------------
  {
    calls.length = 0;
    const refused = await mount(() => useResourceReactions("card", "bad id", "0.104.0", "u1"));
    await waitFor(() => !refused.current.loading, "refused reactions load");
    assert.deepEqual(refused.current.counts, { buff: 0, nerf: 0, rework: 0 });
    assert.equal(refused.current.unavailable, false);
    assert.deepEqual(await refused.current.choose("buff", "u1"), { ok: false });
    await waitFor(() => refused.current.unavailable, "a reaction on a refused target is unavailable");
    assert.deepEqual(refused.current.counts, { buff: 0, nerf: 0, rework: 0 }, "the optimistic count is reverted");
    assert.equal(storage.getItem("sts-resource-reaction:card:bad id:0.104.0"), null);
    assert.equal(calls.length, 0, "a refused target sends nothing");

    for (const [index, [label, respond]] of LEGACY_SIGNALS.entries()) {
      reply = respond;
      const view = await mount(() => useResourceReactions("card", `legacy-${index}`, "0.104.0", null));
      await waitFor(() => !view.current.loading, `reactions settle after ${label}`);
      assert.equal(view.current.unavailable, true, `reactions: ${label}`);
    }

    calls.length = 0;
    reply = (call) => {
      const pathname = pathOf(call);
      if (pathname === "/api/read/engagement") return marked({ v: 1, env: "production", reactions: { "card:ok:0.104.0": { buff: 1, nerf: 2, rework: 0 } } });
      if (pathname === "/api/me/engagement") return marked({ v: 1, reactions: { "card:ok:0.104.0": "nerf" } });
      if (pathname === "/api/write/reactions") return marked({ kind: "buff", counts: { buff: 2, nerf: 1, rework: 0 } });
      return marked({ error: "unexpected" }, 500);
    };
    const view = await mount(() => useResourceReactions("card", "ok", "0.104.0", "u1"));
    await waitFor(() => !view.current.loading && view.current.kind === "nerf", "reactions and mine load");
    assert.deepEqual(view.current.counts, { buff: 1, nerf: 2, rework: 0 });
    assert.deepEqual(await view.current.choose("buff", "u1"), { ok: true });
    await waitFor(() => view.current.kind === "buff", "the written kind applies");
    assert.deepEqual(view.current.counts, { buff: 2, nerf: 1, rework: 0 });
    const write = calls.find((call) => call.method === "PUT");
    assert.equal(write?.url, "/api/write/reactions");
    assert.deepEqual(write?.body, { resourceType: "card", resourceId: "ok", gameVersion: "0.104.0", kind: "buff" });
  }

  // --- The dev reel's helpers call the Worker -------------------------------------------------
  {
    calls.length = 0;
    assert.equal(await fetchResourceReactionCounts([]), null, "nothing to ask");
    reply = () => marked({
      v: 1,
      env: "production",
      reactions: { "card:reel:0.104.0": { buff: 4, nerf: 0, rework: 1 }, "relic:reel:0.103.2": { buff: 0, nerf: 0, rework: 0 } },
    });
    const totals = await fetchResourceReactionCounts([
      { resourceType: "card", resourceId: "reel", gameVersion: "0.104.0" },
      { resourceType: "relic", resourceId: "reel", gameVersion: "0.103.2" },
      { resourceType: "card", resourceId: "bad id", gameVersion: "0.104.0" },
      { resourceType: "card", resourceId: "reel", gameVersion: "0.104.0" },
    ]);
    assert.deepEqual(Object.fromEntries(totals ?? []), {
      "card:reel:0.104.0": { buff: 4, nerf: 0, rework: 1 },
      "relic:reel:0.103.2": { buff: 0, nerf: 0, rework: 0 },
      "card:bad id:0.104.0": { buff: 0, nerf: 0, rework: 0 },
    });
    assert.deepEqual(calls.map((call) => [pathOf(call), queryOf(call).get("reactions")]), [
      ["/api/read/engagement", "card:reel:0.104.0,relic:reel:0.103.2"],
    ], "one request, refused targets left out");
    reply = () => marked({ error: "unavailable" }, 503);
    assert.equal(await fetchResourceReactionCounts([{ resourceType: "card", resourceId: "reel-down", gameVersion: "0.104.0" }]), null);

    calls.length = 0;
    const target = { resourceType: "card", resourceId: "reel", gameVersion: "0.104.0" };
    const cacheKey = "sts-resource-reaction:card:reel:0.104.0";
    reply = (call) => marked({ kind: (call.body as { kind: unknown }).kind, counts: null });
    assert.deepEqual(await saveResourceReaction({ ...target, userId: "u1", previous: null, next: "buff" }), { ok: true, kind: "buff" });
    assert.equal(storage.getItem(cacheKey), "buff");
    assert.deepEqual(await saveResourceReaction({ ...target, userId: "u1", previous: "buff", next: "buff" }), { ok: true, kind: null });
    assert.equal(storage.getItem(cacheKey), null);
    assert.deepEqual(calls.map((call) => [call.method, call.url, (call.body as { kind: unknown }).kind]), [
      ["PUT", "/api/write/reactions", "buff"],
      ["PUT", "/api/write/reactions", null],
    ]);
    reply = () => marked({ error: "unavailable" }, 503);
    assert.deepEqual(await saveResourceReaction({ ...target, userId: "u1", previous: "nerf", next: "buff" }), { ok: false });
    assert.equal(storage.getItem(cacheKey), "nerf", "a failed write puts the previous kind back");
    calls.length = 0;
    assert.deepEqual(
      await saveResourceReaction({ resourceType: "card", resourceId: "bad id", gameVersion: "0.104.0", userId: "u1", previous: null, next: "buff" }),
      { ok: false },
    );
    assert.equal(storage.getItem("sts-resource-reaction:card:bad id:0.104.0"), null);
    assert.equal(calls.length, 0, "a refused target sends nothing");
  }

  // --- Engagement counts ----------------------------------------------------------------------
  for (const [label, respond] of LEGACY_SIGNALS) {
    reply = respond;
    const view = await mount(() => useEngagementCounts());
    await waitFor(() => !view.current.loading, `counts settle after ${label}`);
    assert.equal(view.current.unavailable, true, `counts: ${label}`);
    assert.deepEqual([view.current.likes, view.current.comments], [{}, {}]);
  }
  {
    reply = () => marked({ v: 1, likes: { "sts2-codex:card:bash": 2 }, comments: { "sts2-codex:card:bash": 5 } });
    const view = await mount(() => useEngagementCounts());
    await waitFor(() => !view.current.loading, "counts load");
    assert.deepEqual(
      [view.current.unavailable, view.current.likes, view.current.comments],
      [false, { "sts2-codex:card:bash": 2 }, { "sts2-codex:card:bash": 5 }],
    );
    const idle = await mount(() => useEngagementCounts({ enabled: false }));
    await settle();
    assert.equal(idle.current.loading, false, "a disabled hook is not loading");
  }

  // --- Community stories ----------------------------------------------------------------------
  {
    calls.length = 0;
    const refused = await mount(() => useCommunityStories("u1", { source: "bad source", limit: 200 }));
    await waitFor(() => !refused.current.loading, "refused source loads");
    assert.deepEqual([refused.current.stories, refused.current.unavailable], [[], false], "a source the Worker refuses has no story");
    assert.equal(calls.length, 0, "a refused source sends nothing");

    for (const [label, respond] of LEGACY_SIGNALS.slice(0, 2)) {
      reply = respond;
      const view = await mount(() => useCommunityStories(null));
      await waitFor(() => !view.current.loading, `stories settle after ${label}`);
      assert.equal(view.current.unavailable, true, `stories: ${label}`);
    }

    calls.length = 0;
    const storyRow = (id: string) => ({
      id, user_id: "u1", static_story_id: null, nickname: "n", sentence: "a story", game: "sts2", entity_type: "card",
      entity_id: "BASH", change_id: null, patch_line_id: "v0.104.0:line-1-bash", source: "v0.104.0", tags: [],
      linked_entities: [], created_at: "2026-11-09T00:00:00.000Z", env: "production",
    });
    reply = (call) => {
      const pathname = pathOf(call);
      if (pathname === "/api/read/stories") return marked([storyRow("s1")]);
      if (pathname === "/api/write/stories" && call.method === "POST") return marked({ v: 1, row: storyRow("s2") }, 201);
      if (pathname === "/api/write/stories" && call.method === "DELETE") return marked({ deleted: true });
      return marked({ error: "unexpected" }, 500);
    };
    const view = await mount(() => useCommunityStories("u1", { source: "v0.104.0", limit: 200 }));
    await waitFor(() => !view.current.loading, "stories load");
    assert.deepEqual(view.current.stories.map((story) => story.id), ["community:s1"]);
    assert.equal(calls[0].url, "/api/read/stories?limit=200&source=v0.104.0");

    const patchLine = { id: "v0.104.0:line-1-bash", patch: "v0.104.0", entityRefs: [{ type: "card", id: "BASH", label: "Bash" }] };
    await view.current.add("a story", "n", patchLine as never, "u1");
    await waitFor(() => view.current.stories.length === 2, "the new story is listed first");
    assert.equal(view.current.stories[0].id, "community:s2");
    const post = calls.find((call) => call.method === "POST");
    assert.equal(post?.url, "/api/write/stories");
    assert.equal((post?.body as { source: unknown }).source, "v0.104.0");

    await view.current.remove("community:s2", "u1");
    await waitFor(() => view.current.stories.length === 1, "the removed story leaves");
    assert.ok(calls.some((call) => call.method === "DELETE" && call.url === "/api/write/stories?id=s2"));

    for (const [label, respond] of LEGACY_SIGNALS) {
      reply = respond;
      await assert.rejects(() => view.current.add("a story", "n", patchLine as never, "u1"), /unavailable|bad_version/, `story write: ${label}`);
    }
  }

  // --- Nothing leaves the same origin /api ----------------------------------------------------
  assert.ok(allCalls.length > 0);
  for (const call of allCalls) assert.ok(call.url.startsWith("/api/"), `same-origin api only: ${call.url}`);

  // --- The package's files keep no direct Supabase path ---------------------------------------
  const root = join(__dirname, "..");
  for (const file of [
    "src/hooks/use-comments.ts",
    "src/hooks/use-comment-likes.ts",
    "src/hooks/use-likes.ts",
    "src/hooks/use-resource-reactions.ts",
    "src/hooks/use-engagement-counts.ts",
    "src/hooks/use-community-stories.ts",
    "src/lib/api-engagement.ts",
    "src/components/colorful-philosophers/resource-thread.tsx",
    "src/components/story-composer-modal.tsx",
  ]) {
    const source = readFileSync(join(root, file), "utf8");
    assert.doesNotMatch(source, /from "@\/lib\/(supabase|supabase-timeout|runtime-flags)"/, `${file}: no Supabase client or path flags`);
    assert.doesNotMatch(source, /\.channel\(|supabaseEnabled|surfacePath\(|demoteSurface\(/, `${file}: no Realtime or legacy gate`);
  }

  for (const root of roots) root.unmount();
  console.log("engagement-client.spec: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * Browser side of the step 1 API (docs/supabase-exit/STEP1_DESIGN.md 7, 8.2):
 * the flag cookie reader, apiFetch's legacy signals, the nav snapshot and
 * parity of nav dots between the snapshot and the legacy queries.
 * Usage: tsx scripts/api-client.spec.ts
 */
import assert from "node:assert/strict";

type FakeDocument = { cookie: string };
const fakeWindow: Record<string, unknown> = {};
const fakeDocument: FakeDocument = { cookie: "" };
Object.assign(globalThis, { window: fakeWindow, document: fakeDocument });

async function main() {
  const { ApiError, ApiUnavailableError, apiFetch, requireApiVersion, SurfaceLegacyError, writeMayGoLegacy } = await import("../src/lib/api-client");
  const { demoteSurface, slseounRuntime, surfacePath } = await import("../src/lib/runtime-flags");
  const { loadNavSnapshot, validateNavSnapshot } = await import("../src/lib/nav-snapshot");
  const { fetchUnreadSurfaceIds, NAV_SEEN_SURFACES, unreadFromSnapshot } = await import("../src/lib/nav-seen");
  const { NAV_TABLE_SURFACES } = await import("../src/lib/nav-surfaces");
  const { colorfulPhilosophersWeekStart } = await import("../src/lib/colorful-philosophers");
  const { kstWeekStart } = await import("../src/lib/nav-surfaces");

  const resetPage = (cookie = "") => {
    fakeDocument.cookie = cookie;
    delete fakeWindow.__slseounRuntime;
  };

  // --- Flag cookie reader ----------------------------------------------------
  resetPage("");
  assert.equal(surfacePath("nav"), "legacy", "no cookie");
  resetPage("other=1; slseoun_rf=v1.comments.nav");
  assert.equal(surfacePath("nav"), "api");
  assert.equal(surfacePath("comments"), "api");
  assert.equal(surfacePath("profile"), "legacy");
  resetPage("slseoun_rf=v2.nav");
  assert.equal(surfacePath("nav"), "legacy", "unknown version");
  resetPage("slseoun_rf=v1.nav");
  demoteSurface("nav");
  assert.equal(surfacePath("nav"), "legacy", "demoted for the page");
  assert.equal((fakeWindow.__slseounRuntime as { demoted: Set<string> }).demoted.has("nav"), true, "shared on window");

  // --- apiFetch legacy signals ----------------------------------------------
  const marked = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-slseoun-api": "1" },
  });
  const stubFetch = (respond: () => Response) => {
    globalThis.fetch = (async () => respond()) as typeof fetch;
  };

  resetPage("slseoun_rf=v1.nav.comments");
  stubFetch(() => marked({ ok: 1 }));
  assert.deepEqual(await apiFetch("nav", "/api/read/nav"), { ok: 1 });
  await assert.rejects(() => apiFetch("nav", "api/read/nav"), /absolute/);

  // A Worker rolled back to before step 1 answers /api with its HTML 404 and no marker.
  stubFetch(() => new Response("<html>not found</html>", { status: 404, headers: { "content-type": "text/html" } }));
  await assert.rejects(() => apiFetch("nav", "/api/read/nav"), (error) => (
    error instanceof SurfaceLegacyError && error.processed === false
  ));
  assert.equal(surfacePath("nav"), "legacy", "demoted after an unmarked answer");

  // Unmarked 404/405 on a write: nothing ran, so it may be resent on legacy.
  stubFetch(() => new Response("<html></html>", { status: 405 }));
  await assert.rejects(() => apiFetch("comments", "/api/write/comments", { method: "POST", body: {} }), (error) => (
    error instanceof SurfaceLegacyError && error.processed === false
  ));
  // Unmarked 5xx on a write may have run: never resend.
  resetPage("slseoun_rf=v1.comments");
  stubFetch(() => new Response("error 1101", { status: 500 }));
  await assert.rejects(() => apiFetch("comments", "/api/write/comments", { method: "POST", body: {} }), (error) => (
    error instanceof SurfaceLegacyError && error.processed === true
  ));

  resetPage("slseoun_rf=v1.nav");
  stubFetch(() => marked({ error: "surface_legacy", reason: "flag" }, 409));
  await assert.rejects(() => apiFetch("nav", "/api/read/nav"), SurfaceLegacyError);
  assert.equal(surfacePath("nav"), "legacy");

  resetPage("slseoun_rf=v1.nav");
  stubFetch(() => marked({ error: "unavailable" }, 503));
  await assert.rejects(() => apiFetch("nav", "/api/read/nav"), ApiUnavailableError);
  assert.equal(surfacePath("nav"), "api", "an outage is not a legacy signal");

  // An unknown version on a read may be redone on legacy; on a write answer the write ran.
  assert.throws(() => requireApiVersion("toybox-feed", { v: 2 }), (error) => writeMayGoLegacy(error));
  assert.throws(() => requireApiVersion("toybox-feed", { v: 2 }, true), (error) => error instanceof SurfaceLegacyError && !writeMayGoLegacy(error));
  assert.equal(surfacePath("toybox-feed"), "legacy", "either way the group is demoted");

  stubFetch(() => marked({ error: "duplicate" }, 422));
  await assert.rejects(() => apiFetch("nav", "/api/read/nav"), (error) => (
    error instanceof ApiError && !(error instanceof SurfaceLegacyError) && error.code === "duplicate"
  ));

  // responseType "text" (the run raw file, R3r): the body as is; error answers stay JSON.
  resetPage("slseoun_rf=v1.history-runs");
  let accepted: string | null = null;
  globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
    accepted = new Headers(init?.headers).get("accept");
    return new Response("{\"players\": [ ]}", { headers: { "content-type": "text/plain; charset=utf-8", "x-slseoun-api": "1" } });
  }) as typeof fetch;
  assert.equal(await apiFetch("history-runs", "/api/read/history-run/raw?id=r1", { responseType: "text" }), "{\"players\": [ ]}");
  assert.equal(accepted, "text/plain");
  stubFetch(() => marked({ error: "rate_limited" }, 429));
  await assert.rejects(() => apiFetch("history-runs", "/api/read/history-run/raw?id=r1", { responseType: "text" }), (error) => (
    error instanceof ApiError && error.code === "rate_limited"
  ));
  stubFetch(() => marked({ error: "surface_legacy", reason: "flag" }, 409));
  await assert.rejects(() => apiFetch("history-runs", "/api/read/history-run/raw?id=r1", { responseType: "text" }), SurfaceLegacyError);

  globalThis.fetch = (async () => {
    throw new TypeError("network");
  }) as typeof fetch;
  await assert.rejects(() => apiFetch("nav", "/api/read/nav"), ApiUnavailableError);

  // The timeout covers a body that stalls after the headers arrived.
  globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("{\"v\":"));
        init?.signal?.addEventListener("abort", () => controller.error(new DOMException("aborted", "AbortError")));
      },
    });
    return new Response(stream, { headers: { "content-type": "application/json", "x-slseoun-api": "1" } });
  }) as typeof fetch;
  const stalledAt = Date.now();
  await assert.rejects(() => apiFetch("nav", "/api/read/nav", { timeoutMs: 100 }), (error) => (
    error instanceof ApiUnavailableError && error.code === "timeout"
  ));
  assert.ok(Date.now() - stalledAt < 1000, "stalled body cut by the timeout");

  // --- Nav snapshot ------------------------------------------------------------
  const snapshot = {
    v: 1 as const,
    env: "production",
    fetchedAt: "2026-11-05T12:00:00.000Z",
    latest: Object.fromEntries(NAV_TABLE_SURFACES.map((surface) => [surface.id, null])) as Record<string, string | null>,
    weekly: { "colorful-philosophers": "2026-11-02" },
    courier: [],
  };
  snapshot.latest.combo = "2026-11-04T09:12:33.120Z";
  snapshot.latest.transfigure = "2026-10-01T00:00:00.000Z";
  assert.equal(validateNavSnapshot(snapshot, "production"), snapshot);
  assert.throws(() => validateNavSnapshot({ ...snapshot, v: 2 }, "production"), SurfaceLegacyError);
  assert.throws(() => validateNavSnapshot({ ...snapshot, env: "development" }, "production"), SurfaceLegacyError);

  // One request for every caller on the page within 30 s.
  resetPage("slseoun_rf=v1.nav");
  let navCalls = 0;
  globalThis.fetch = (async () => {
    navCalls += 1;
    return marked(snapshot);
  }) as typeof fetch;
  await Promise.all([loadNavSnapshot(), loadNavSnapshot(), loadNavSnapshot()]);
  assert.equal(navCalls, 1);
  assert.ok(slseounRuntime().nav, "shared through window for other bundles");

  // --- Dots: snapshot vs legacy semantics -------------------------------------
  // Legacy lights a table surface when a row with created_at > since exists;
  // the snapshot has the max created_at, so the answers match.
  const seen = Object.fromEntries(NAV_SEEN_SURFACES.map((surface) => [surface.id, "2026-11-01T00:00:00.000Z"]));
  seen["colorful-philosophers"] = "2026-11-01T14:59:59.999Z"; // just before Monday 11-02 00:00 KST
  const ids = await unreadFromSnapshot(seen, snapshot);
  assert.ok(ids.includes("combo"), "newer post lights");
  assert.ok(!ids.includes("transfigure"), "older post stays dark");
  assert.ok(!ids.includes("history-course"), "no rows stays dark");
  assert.ok(ids.includes("colorful-philosophers"), "weekly post published Monday 00:00 KST lights");
  const sameMoment = await unreadFromSnapshot({ ...seen, combo: "2026-11-04T09:12:33.120Z" }, snapshot);
  assert.ok(!sameMoment.includes("combo"), "equal time is not newer, like created_at > since");
  const afterWeek = await unreadFromSnapshot({ ...seen, "colorful-philosophers": "2026-11-01T15:00:00.000Z" }, snapshot);
  assert.ok(!afterWeek.includes("colorful-philosophers"));

  // Catalog surfaces light from bundled JSON whatever the snapshot does.
  const neverSeen = Object.fromEntries(NAV_SEEN_SURFACES.map((surface) => [surface.id, "1970-01-01T00:00:00.000Z"]));
  const offline = await unreadFromSnapshot(neverSeen, null);
  assert.ok(offline.includes("patch-notes") && offline.includes("neowsletters"), "catalog dots survive an outage");
  assert.ok(!offline.includes("combo"), "table dots need the snapshot");
  // A future-dated patch shell (2026-11-12 Gambit) does not keep the dot lit after a read (main df30437c).
  const readNow = await unreadFromSnapshot({ ...neverSeen, "patch-notes": new Date().toISOString() }, snapshot);
  assert.ok(!readNow.includes("patch-notes"), "only catalog entries whose time has come count");

  // fetchUnreadSurfaceIds never rejects: an outage keeps the catalog dots.
  resetPage("slseoun_rf=v1.nav");
  stubFetch(() => marked({ error: "unavailable" }, 503));
  const duringOutage = await fetchUnreadSurfaceIds(neverSeen);
  assert.ok(duringOutage.includes("patch-notes"));

  // Every table surface the client knows is in the Worker's list, and the week formula is shared.
  const clientTables = NAV_SEEN_SURFACES.filter((surface) => surface.table).map((surface) => [surface.id, surface.table]);
  assert.deepEqual(clientTables, NAV_TABLE_SURFACES.map((surface) => [surface.id, surface.table]));
  for (const instant of ["2026-11-01T14:59:59Z", "2026-11-01T15:00:00Z", "2026-11-05T12:00:00Z", "2026-12-31T23:00:00Z"]) {
    assert.equal(colorfulPhilosophersWeekStart(new Date(instant)), kstWeekStart(new Date(instant)));
  }
  assert.equal(kstWeekStart(new Date("2026-11-01T14:59:59Z")), "2026-10-26");
  assert.equal(kstWeekStart(new Date("2026-11-01T15:00:00Z")), "2026-11-02");

  // --- Comments group: coalesced engagement reads (STEP1_DESIGN 9.1) ----------
  const { engagementApiFor, loadEngagement, loadEngagementMine } = await import("../src/lib/api-engagement");
  const { ENGAGEMENT_QUERY_MAX_CHARS } = await import("../src/lib/engagement-keys");

  resetPage("slseoun_rf=v1.nav");
  assert.equal(engagementApiFor("threads", "sts2-codex:card:bash"), false, "comments not on the api path");
  resetPage("slseoun_rf=v1.comments");
  assert.equal(engagementApiFor("threads", "sts2-codex:card:bash"), true);
  assert.equal(engagementApiFor("threads", "bad key"), false, "a key the Worker refuses stays legacy");
  assert.equal(engagementApiFor("reactions", "card:bash"), false);

  const engagementUrls: string[] = [];
  let engagementReply: (url: URL) => Response = () => marked({});
  globalThis.fetch = (async (input: unknown) => {
    const url = new URL(String(input), "https://example.test");
    engagementUrls.push(`${url.pathname}${url.search}`);
    return engagementReply(url);
  }) as typeof fetch;

  // Asks from one render share one request; derived reply threads are held for later widgets.
  const replyKey = "colorful-philosophers:44444444-4444-4444-8444-444444444444";
  engagementReply = () => marked({
    v: 1,
    env: "production",
    threads: { "sts2-codex:card:bash": [{ id: "c1", like_count: 2 }], [replyKey]: [{ id: "r1", like_count: 0 }] },
    likes: { "sts2-codex:card:bash": 3 },
    reactions: { "card:bash:0.104.0": { buff: 1, nerf: 0, rework: 0 }, "card:bash:0.103.2": { buff: 0, nerf: 4, rework: 0 } },
    philosophers: { "card:bash": [{ id: "44444444-4444-4444-8444-444444444444" }] },
  });
  const [thread, likeCount, reaction, posts] = await Promise.all([
    loadEngagement("threads", "sts2-codex:card:bash"),
    loadEngagement("likes", "sts2-codex:card:bash"),
    loadEngagement("reactions", "card:bash:0.104.0"),
    loadEngagement("philosophers", "card:bash"),
  ]);
  assert.equal(engagementUrls.length, 1, "one request for the whole render");
  assert.equal(
    engagementUrls[0],
    "/api/read/engagement?threads=sts2-codex:card:bash&likes=sts2-codex:card:bash&reactions=card:bash:0.104.0&philosophers=card:bash",
  );
  assert.equal(thread[0].like_count, 2);
  assert.equal(likeCount, 3);
  assert.deepEqual(reaction, { buff: 1, nerf: 0, rework: 0 });
  assert.equal(posts.length, 1);
  assert.deepEqual((await loadEngagement("threads", replyKey)).map((row) => row.id), ["r1"], "reply thread came with the posts");
  assert.deepEqual(await loadEngagement("reactions", "card:bash:0.103.2"), { buff: 0, nerf: 4, rework: 0 });
  // A read-only bar under a post of the current version asks for the header's own target again.
  assert.deepEqual(await loadEngagement("reactions", "card:bash:0.104.0"), { buff: 1, nerf: 0, rework: 0 });
  assert.equal(engagementUrls.length, 1, "held values need no request");
  // Held values are taken once.
  engagementReply = () => marked({ v: 1, env: "production", reactions: { "card:bash:0.104.0": { buff: 9, nerf: 0, rework: 0 } } });
  assert.deepEqual(await loadEngagement("reactions", "card:bash:0.104.0"), { buff: 9, nerf: 0, rework: 0 });
  assert.equal(engagementUrls.length, 2);

  // A failed part rejects only its asks.
  engagementUrls.length = 0;
  engagementReply = () => marked({ v: 1, env: "production", threads: { "byrdispatch": [] }, unavailable: ["reactions"] });
  const [okThread, failedReaction] = await Promise.allSettled([
    loadEngagement("threads", "byrdispatch"),
    loadEngagement("reactions", "relic:orrery:0.104.0"),
  ]);
  assert.equal(okThread.status, "fulfilled");
  assert.ok(failedReaction.status === "rejected" && failedReaction.reason instanceof ApiUnavailableError);

  // A legacy signal rejects the whole batch with SurfaceLegacyError and demotes the group.
  engagementReply = () => marked({ error: "surface_legacy", reason: "flag" }, 409);
  const legacyAsks = await Promise.allSettled([loadEngagement("threads", "byrdispatch"), loadEngagement("likes", "byrdispatch")]);
  assert.ok(legacyAsks.every((result) => result.status === "rejected" && result.reason instanceof SurfaceLegacyError));
  assert.equal(engagementApiFor("threads", "byrdispatch"), false, "demoted for the page");

  // An unknown response version is a legacy signal too.
  resetPage("slseoun_rf=v1.comments");
  engagementReply = () => marked({ v: 2 });
  await assert.rejects(() => loadEngagement("threads", "byrdispatch"), SurfaceLegacyError);
  assert.equal(engagementApiFor("threads", "byrdispatch"), false);

  // Batches stay under the per-part cap and the query length.
  resetPage("slseoun_rf=v1.comments");
  engagementUrls.length = 0;
  engagementReply = (url) => {
    const keys = (url.searchParams.get("threads") ?? "").split(",");
    return marked({ v: 1, env: "production", threads: Object.fromEntries(keys.map((key) => [key, []])) });
  };
  const manyKeys = Array.from({ length: 70 }, (_, index) => `neowsletter:2026-10:claim-${index}`);
  await Promise.all(manyKeys.map((key) => loadEngagement("threads", key)));
  assert.equal(engagementUrls.length, 2, "70 thread keys need two requests (cap 64)");
  const longKeys = Array.from({ length: 40 }, (_, index) => `sts2-codex:card:${"X".repeat(180)}${index}`);
  engagementUrls.length = 0;
  await Promise.all(longKeys.map((key) => loadEngagement("threads", key)));
  assert.ok(engagementUrls.length >= 2 && engagementUrls.every((url) => url.length - "/api/read/engagement?".length <= ENGAGEMENT_QUERY_MAX_CHARS));

  // Prefetch: roots that mount over several tasks share one request, in flight or held.
  const { prefetchEngagement } = await import("../src/lib/api-engagement");
  resetPage("slseoun_rf=v1.comments");
  engagementUrls.length = 0;
  let releaseReply: () => void = () => undefined;
  engagementReply = (url) => {
    const keys = (url.searchParams.get("threads") ?? "").split(",");
    return marked({ v: 1, env: "production", threads: Object.fromEntries(keys.map((key) => [key, [{ id: key }]])) });
  };
  const gate = new Promise<void>((resolve) => {
    releaseReply = resolve;
  });
  const gatedFetch = globalThis.fetch;
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    await gate;
    return gatedFetch(input as string, init);
  }) as typeof fetch;
  const claimKeys = Array.from({ length: 27 }, (_, index) => `neowsletter:2026-08:c${index}`);
  prefetchEngagement("threads", claimKeys);
  await new Promise((resolve) => setTimeout(resolve, 60));
  // Widgets mount while the request is in flight, one task apart.
  const mounted: Promise<unknown>[] = [];
  for (const key of claimKeys.slice(0, 20)) {
    mounted.push(loadEngagement("threads", key));
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  releaseReply();
  await Promise.all(mounted);
  globalThis.fetch = gatedFetch;
  assert.equal(engagementUrls.length, 1, "one request for 27 roots mounted over 300 ms");
  // The rest mount after it settled: each takes the held answer once.
  for (const key of claimKeys.slice(20)) assert.deepEqual(await loadEngagement("threads", key), [{ id: key }]);
  assert.equal(engagementUrls.length, 1);
  await loadEngagement("threads", claimKeys[0]);
  assert.equal(engagementUrls.length, 2, "a joined answer is not held for later");

  // Personal reads need a session; without one they fail without calling the Worker.
  engagementUrls.length = 0;
  await assert.rejects(() => loadEngagementMine("likes", "byrdispatch"), (error) => error instanceof ApiError && error.code === "token_invalid");
  assert.equal(engagementUrls.length, 0);

  // An answer of an unknown version is a legacy signal for its group.
  resetPage("slseoun_rf=v1.profile");
  assert.doesNotThrow(() => requireApiVersion("profile", { v: 1 }));
  assert.throws(() => requireApiVersion("profile", { v: 2 }), SurfaceLegacyError);
  assert.equal(surfacePath("profile"), "legacy", "demoted for the page");

  console.log("api-client spec passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * Browser side of the step 1 API (docs/supabase-exit/STEP1_DESIGN.md 7, 8.2):
 * the path of each group, apiFetch's answers to what used to be legacy signals
 * (step 6 WP0: unavailable, never a demotion), the nav snapshot and parity of nav
 * dots between the snapshot and the legacy queries.
 * Usage: tsx scripts/api-client.spec.ts
 */
import assert from "node:assert/strict";

type FakeDocument = { cookie: string };
const fakeWindow: Record<string, unknown> = {};
const fakeDocument: FakeDocument = { cookie: "" };
Object.assign(globalThis, { window: fakeWindow, document: fakeDocument });

async function main() {
  const { ApiError, ApiUnavailableError, apiFetch, requireApiVersion, shouldUseLegacy, SurfaceLegacyError, writeMayGoLegacy } = await import("../src/lib/api-client");
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

  // --- Every group is on the api path ----------------------------------------
  // Step 6 has no legacy path: the `slseoun_rf` cookie (still sent for an older client after a
  // rollback), the build default and a demotion no longer move a group.
  const groups = ["nav", "comments", "profile", "toybox-feed", "history-runs"] as const;
  const buildDefault = process.env.NEXT_PUBLIC_API_PATH_DEFAULT;
  for (const value of [undefined, "", "legacy", "api"]) {
    if (value === undefined) delete process.env.NEXT_PUBLIC_API_PATH_DEFAULT;
    else process.env.NEXT_PUBLIC_API_PATH_DEFAULT = value;
    for (const cookie of ["", "other=1", "other=1; slseoun_rf=v1.comments.nav", "slseoun_rf=v1.nav", "slseoun_rf=v2.nav", "slseoun_rf=v1.nav.bogus"]) {
      resetPage(cookie);
      for (const group of groups) assert.equal(surfacePath(group), "api", `${group}: cookie "${cookie}", default ${value}`);
      demoteSurface("comments");
      assert.equal(surfacePath("comments"), "api", `a demotion does nothing: cookie "${cookie}", default ${value}`);
    }
  }
  if (buildDefault === undefined) delete process.env.NEXT_PUBLIC_API_PATH_DEFAULT;
  else process.env.NEXT_PUBLIC_API_PATH_DEFAULT = buildDefault;
  resetPage("slseoun_rf=v1.nav");
  demoteSurface("nav");
  assert.equal(slseounRuntime().demoted.size, 0, "nothing is added to the set the patch static client shares");
  assert.equal(fakeWindow.__slseounRuntime, slseounRuntime(), "shared on window");

  // --- apiFetch: former legacy signals are an outage ---------------------------
  const marked = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-slseoun-api": "1" },
  });
  const stubFetch = (respond: () => Response) => {
    globalThis.fetch = (async () => respond()) as typeof fetch;
  };
  /** Unavailable with `code`, and nothing redoes or resends it on a legacy path. */
  const outage = (code: string) => (error: unknown) => (
    error instanceof ApiUnavailableError
    && !(error instanceof SurfaceLegacyError)
    && error.code === code
    && !shouldUseLegacy(error)
    && !writeMayGoLegacy(error)
  );

  resetPage("slseoun_rf=v1.nav.comments");
  stubFetch(() => marked({ ok: 1 }));
  assert.deepEqual(await apiFetch("nav", "/api/read/nav"), { ok: 1 });
  await assert.rejects(() => apiFetch("nav", "api/read/nav"), /absolute/);

  const platformError = () => new Response("<html>error 1102</html>", { status: 503, headers: { "content-type": "text/html" } });
  const legacySignal = () => marked({ error: "surface_legacy", reason: "flag" }, 409);
  for (const cookie of ["", "slseoun_rf=v1.toybox-feed", "slseoun_rf=v1.nav"]) {
    // A read: no router answered (a platform error page, or a Worker from before step 1 with its
    // HTML 404), or the router's legacy signal.
    for (const [label, respond, code] of [
      ["an unmarked platform error page", platformError, "no_marker"],
      ["an unmarked 404", () => new Response("<html>not found</html>", { status: 404, headers: { "content-type": "text/html" } }), "no_marker"],
      ["the router's legacy signal", legacySignal, "surface_legacy"],
    ] as const) {
      resetPage(cookie);
      stubFetch(respond);
      await assert.rejects(() => apiFetch("toybox-feed", "/api/read/toybox-feed?service=combo"), outage(code), `${label} on a read (cookie "${cookie}")`);
      assert.equal(surfacePath("toybox-feed"), "api", `${label} on a read does not demote (cookie "${cookie}")`);
    }
    // A write keeps the code the production build (direct writes closed) answered: unavailable.
    for (const [label, respond] of [
      ["an unmarked platform error page", platformError],
      ["an unmarked 404", () => new Response("<html>not found</html>", { status: 404 })],
      ["an unmarked 405", () => new Response("<html></html>", { status: 405 })],
      ["an unmarked 500", () => new Response("error 1101", { status: 500 })],
      ["the router's legacy signal", legacySignal],
    ] as const) {
      for (const method of ["POST", "PATCH", "DELETE"] as const) {
        resetPage(cookie);
        stubFetch(respond);
        await assert.rejects(() => apiFetch("toybox-feed", "/api/write/toybox-post?service=combo", { method, body: {} }), outage("unavailable"), `${label} on a ${method} (cookie "${cookie}")`);
        assert.equal(surfacePath("toybox-feed"), "api", `${label} on a write does not demote (cookie "${cookie}")`);
      }
    }
  }

  resetPage("slseoun_rf=v1.nav");
  stubFetch(() => marked({ error: "unavailable" }, 503));
  await assert.rejects(() => apiFetch("nav", "/api/read/nav"), outage("unavailable"));
  assert.equal(surfacePath("nav"), "api", "an outage is not a legacy signal");

  // An unknown version is an outage too, for a read and for the answer to a write (which ran).
  assert.throws(() => requireApiVersion("toybox-feed", { v: 2 }), outage("bad_version"));
  assert.throws(() => requireApiVersion("toybox-feed", { v: 2 }, true), outage("bad_version"));
  assert.throws(() => requireApiVersion("toybox-feed", null), outage("bad_version"));
  assert.doesNotThrow(() => requireApiVersion("toybox-feed", { v: 1 }, true));
  assert.equal(surfacePath("toybox-feed"), "api", "either way the group is not demoted");

  // The deprecated helpers answer no for every error, the old legacy class included.
  for (const error of [new SurfaceLegacyError(404, false), new SurfaceLegacyError(500, true), new ApiUnavailableError(409, "surface_legacy"), new ApiError(422, "invalid"), new Error("x")]) {
    assert.equal(shouldUseLegacy(error), false);
    assert.equal(writeMayGoLegacy(error), false);
  }

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
  await assert.rejects(() => apiFetch("history-runs", "/api/read/history-run/raw?id=r1", { responseType: "text" }), outage("surface_legacy"));

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
  // Refused (WP-N decides what the dots and the courier then show); nothing goes to a legacy path.
  assert.throws(() => validateNavSnapshot({ ...snapshot, v: 2 }, "production"), (error) => error instanceof ApiError && !shouldUseLegacy(error));
  assert.throws(() => validateNavSnapshot({ ...snapshot, env: "development" }, "production"), (error) => error instanceof ApiError && !shouldUseLegacy(error));

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

  for (const cookie of ["", "slseoun_rf=v1.nav", "slseoun_rf=v1.comments"]) {
    resetPage(cookie);
    assert.equal(engagementApiFor("threads", "sts2-codex:card:bash"), true, `on the api path whatever the cookie: "${cookie}"`);
  }
  resetPage("slseoun_rf=v1.comments");
  assert.equal(engagementApiFor("threads", "bad key"), false, "a key the Worker refuses is still refused (WP-C: empty thread)");
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

  // The router's legacy signal rejects the whole batch as an outage; the group stays on the api path.
  engagementReply = () => marked({ error: "surface_legacy", reason: "flag" }, 409);
  const legacyAsks = await Promise.allSettled([loadEngagement("threads", "byrdispatch"), loadEngagement("likes", "byrdispatch")]);
  assert.ok(legacyAsks.every((result) => result.status === "rejected" && outage("surface_legacy")(result.reason)));
  assert.equal(engagementApiFor("threads", "byrdispatch"), true, "not demoted");

  // An unknown response version is refused too (WP-C makes it unavailable); nothing goes to a legacy path.
  resetPage("slseoun_rf=v1.comments");
  engagementReply = () => marked({ v: 2 });
  await assert.rejects(() => loadEngagement("threads", "byrdispatch"), (error) => error instanceof ApiError && !shouldUseLegacy(error));
  assert.equal(engagementApiFor("threads", "byrdispatch"), true, "not demoted");

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

  // An answer of an unknown version is an outage for its group, without a demotion.
  resetPage("slseoun_rf=v1.profile");
  assert.doesNotThrow(() => requireApiVersion("profile", { v: 1 }));
  assert.throws(() => requireApiVersion("profile", { v: 2 }), outage("bad_version"));
  assert.equal(surfacePath("profile"), "api", "not demoted");

  console.log("api-client spec passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

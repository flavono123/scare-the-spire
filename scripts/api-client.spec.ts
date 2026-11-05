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
  const { ApiError, ApiUnavailableError, apiFetch, SurfaceLegacyError } = await import("../src/lib/api-client");
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

  stubFetch(() => marked({ error: "duplicate" }, 422));
  await assert.rejects(() => apiFetch("nav", "/api/read/nav"), (error) => (
    error instanceof ApiError && !(error instanceof SurfaceLegacyError) && error.code === "duplicate"
  ));

  globalThis.fetch = (async () => {
    throw new TypeError("network");
  }) as typeof fetch;
  await assert.rejects(() => apiFetch("nav", "/api/read/nav"), ApiUnavailableError);

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

  console.log("api-client spec passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

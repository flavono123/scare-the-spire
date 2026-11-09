/**
 * Nav "new post" dots, their localStorage keys, and (step 6 WP-N) the nav
 * snapshot as their only source: a failed or refused snapshot leaves only the
 * catalog dots and an empty courier, and nothing is asked anywhere else.
 * Usage: tsx scripts/nav-seen.spec.ts
 */
import assert from "node:assert/strict";

// The keys below are checked by their exact names; the build default data env is production.
delete process.env.NEXT_PUBLIC_SUPABASE_ENV;

type FakeWindow = {
  __slseounRuntime?: unknown;
  sessionStorage: { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void };
  dispatchEvent: (event: Event) => boolean;
};
const sessionMemory = new Map<string, string>();
const dispatched: Event[] = [];
const fakeWindow: FakeWindow = {
  sessionStorage: {
    getItem: (key) => sessionMemory.get(key) ?? null,
    setItem: (key, value) => {
      sessionMemory.set(key, value);
    },
  },
  dispatchEvent: (event) => {
    dispatched.push(event);
    return true;
  },
};
Object.assign(globalThis, { window: fakeWindow });

async function main() {
  const {
    catalogHasNewer,
    contentIsNewerThanSeen,
    displayedUnreadIds,
    effectiveUnreadIds,
    fetchUnreadSurfaceIds,
    markNavVisit,
    menuUnreadSince,
    NAV_SEEN_SURFACES,
    navForceStorageKey,
    navMenuSeenStorageKey,
    navSeenIdForHref,
    navSeenStorageKey,
    readMenuUnreadSince,
    readNavMenuSeen,
    readNavSeen,
    surfaceIdForPath,
    toyBoxHasUnread,
    writeUnreadCache,
  } = await import("../src/lib/nav-seen");
  const { ApiUnavailableError } = await import("../src/lib/api-client");
  const { loadNavSnapshot } = await import("../src/lib/nav-snapshot");
  const { NAV_TABLE_SURFACES } = await import("../src/lib/nav-surfaces");
  const { publishMailboxReply } = await import("../src/hooks/use-mailbox-reply");

  const memory = new Map<string, string>();
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
  };

  const seen = readNavSeen(storage, "2026-09-24T00:00:00.000Z");
  assert.equal(seen["patch-notes"], "2026-09-24T00:00:00.000Z");
  assert.equal(seen.combo, "2026-09-24T00:00:00.000Z");
  // A browser that never opened Colorful Philosophers sees this week's posts as new.
  assert.equal(seen["colorful-philosophers"], "1970-01-01T00:00:00.000Z");
  memory.clear();
  storage.setItem(navSeenStorageKey(), JSON.stringify({ "patch-notes": "2026-09-01T00:00:00.000Z" }));
  const filled = readNavSeen(storage, "2026-09-24T00:00:00.000Z");
  assert.equal(filled["patch-notes"], "2026-09-01T00:00:00.000Z");
  assert.equal(filled.combo, "2026-09-24T00:00:00.000Z");

  assert.equal(surfaceIdForPath("/patches/0.111.0"), "patch-notes");
  assert.equal(surfaceIdForPath("/en/patches"), "patch-notes");
  assert.equal(surfaceIdForPath("/patches/neowsletters/2026-08"), "neowsletters");
  assert.equal(surfaceIdForPath("/patches/changes"), null);
  assert.equal(surfaceIdForPath("/this-or-that/tournament/abc"), "favorite-tournament");
  assert.equal(surfaceIdForPath("/en/c-c-c-combo/abc"), "combo");
  assert.equal(surfaceIdForPath("/dev/nav-indicators"), null);
  assert.equal(surfaceIdForPath("/colorful-philosophers/abc"), "colorful-philosophers");
  assert.equal(surfaceIdForPath("/dev/colorful-philosophers"), null);
  assert.equal(navSeenIdForHref("/colorful-philosophers"), "colorful-philosophers");

  assert.equal(navSeenIdForHref("/c-c-c-combo"), "combo");
  assert.equal(navSeenIdForHref("/this-or-that/tournament"), null);
  assert.deepEqual(displayedUnreadIds(["favorite-tournament"]), ["favorite-tournament", "this-or-that"]);
  assert.equal(toyBoxHasUnread(["patch-notes"]), false);
  assert.equal(toyBoxHasUnread(["neowsletters"]), false);
  assert.equal(toyBoxHasUnread(["combo"]), true);
  assert.equal(toyBoxHasUnread(effectiveUnreadIds([], { combo: true })), true);
  assert.equal(toyBoxHasUnread(effectiveUnreadIds(["combo", "transfigure"], { combo: false, transfigure: false })), false);
  assert.equal(contentIsNewerThanSeen("2026-01-01T00:00:00.000Z", "2026-09-24T00:00:00.000Z"), false);
  assert.equal(contentIsNewerThanSeen("2026-09-25T00:00:00.000Z", "2026-09-24T00:00:00.000Z"), true);

  memory.clear();
  readNavSeen(storage, "2026-09-01T00:00:00.000Z");
  // A Toy Box index clears the menu dot (and rows it lights) but keeps index read tint.
  assert.equal(markNavVisit(storage, "/this-or-that", "2026-09-30T00:00:00.000Z"), "this-or-that");
  assert.equal(readNavSeen(storage)["this-or-that"], "2026-09-01T00:00:00.000Z");
  assert.equal(readNavMenuSeen(storage)["this-or-that"], "2026-09-30T00:00:00.000Z");
  assert.equal(readNavMenuSeen(storage)["favorite-tournament"], "2026-09-30T00:00:00.000Z");
  assert.equal(readMenuUnreadSince(storage)["this-or-that"], "2026-09-30T00:00:00.000Z");
  assert.equal(readMenuUnreadSince(storage).combo, "2026-09-01T00:00:00.000Z");
  // A post marks the surface read.
  markNavVisit(storage, "/en/c-c-c-combo/abc", "2026-10-01T00:00:00.000Z");
  assert.equal(readNavSeen(storage).combo, "2026-10-01T00:00:00.000Z");
  // Patch notes still clear only from a note, not the index.
  markNavVisit(storage, "/patches", "2026-10-02T00:00:00.000Z");
  assert.equal(readNavMenuSeen(storage)["patch-notes"], undefined);
  assert.equal(readMenuUnreadSince(storage)["patch-notes"], "2026-09-01T00:00:00.000Z");
  markNavVisit(storage, "/patches/neowsletters", "2026-10-02T00:00:00.000Z");
  assert.equal(readNavMenuSeen(storage).neowsletters, undefined);
  markNavVisit(storage, "/patches/0.111.0", "2026-10-03T00:00:00.000Z");
  assert.equal(readNavSeen(storage)["patch-notes"], "2026-10-03T00:00:00.000Z");
  assert.deepEqual(
    menuUnreadSince({ combo: "2026-10-05T00:00:00.000Z" }, { combo: "2026-10-01T00:00:00.000Z" }),
    { combo: "2026-10-05T00:00:00.000Z" },
  );

  // A future-dated patch shell must not keep the patch-notes dot lit after a read.
  assert.equal(
    catalogHasNewer(["2026-11-12T12:00:00.000Z"], "2026-11-06T00:00:00.000Z", "2026-11-06T04:00:00.000Z"),
    false,
  );
  assert.equal(
    catalogHasNewer(["2026-11-12T12:00:00.000Z"], "2026-11-06T00:00:00.000Z", "2026-11-12T12:00:00.000Z"),
    true,
  );
  assert.equal(
    catalogHasNewer(["2026-11-05T12:00:00.000Z"], "2026-11-06T00:00:00.000Z", "2026-11-06T04:00:00.000Z"),
    false,
  );

  // --- Storage keys keep their names (step 6 WP-N: dataEnv, the same value as supabaseEnv) ---
  assert.equal(navSeenStorageKey(), "sts-nav-seen:production");
  assert.equal(navMenuSeenStorageKey(), "sts-nav-menu-seen:production");
  assert.equal(navForceStorageKey(), "sts-nav-force-v3:production");
  assert.equal(navSeenStorageKey("development"), "sts-nav-seen:development");
  assert.equal(navMenuSeenStorageKey("development"), "sts-nav-menu-seen:development");
  assert.equal(navForceStorageKey("development"), "sts-nav-force-v3:development");
  const unreadCache = new Map<string, string>();
  writeUnreadCache({ setItem: (key, value) => unreadCache.set(key, value) }, "stamp", ["combo"], 1);
  assert.deepEqual([...unreadCache.keys()], ["sts-nav-unread:production"]);
  publishMailboxReply("user-1", true);
  assert.deepEqual([...sessionMemory.keys()], ["sts-mailbox-reply:production:user-1"]);
  assert.equal(dispatched.length, 1);

  // --- Dots come from the nav snapshot only -------------------------------------
  const requested: string[] = [];
  const stubFetch = (respond: () => Response | Promise<Response>) => {
    requested.length = 0;
    delete fakeWindow.__slseounRuntime;
    globalThis.fetch = (async (input: string | URL | Request) => {
      requested.push(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      return respond();
    }) as typeof fetch;
  };
  const answer = (body: unknown, status = 200, marked = true) => new Response(JSON.stringify(body), {
    status,
    headers: marked
      ? { "content-type": "application/json", "x-slseoun-api": "1" }
      : { "content-type": "application/json" },
  });
  const snapshot = {
    v: 1,
    env: "production",
    fetchedAt: "2026-11-05T12:00:00.000Z",
    latest: Object.fromEntries(NAV_TABLE_SURFACES.map((surface) => [surface.id, null])) as Record<string, string | null>,
    weekly: { "colorful-philosophers": "2026-11-02" },
    courier: [{ id: "c1", storyId: "sts2-codex:card:bash", text: "hi", createdAt: "2026-11-05T11:00:00.000Z" }],
  };
  snapshot.latest.combo = "2026-11-04T09:12:33.120Z";
  snapshot.latest.transfigure = "2026-10-01T00:00:00.000Z";
  const since = Object.fromEntries(NAV_SEEN_SURFACES.map((surface) => [surface.id, "2026-11-01T00:00:00.000Z"]));
  since["colorful-philosophers"] = "2026-11-01T14:59:59.999Z";

  stubFetch(() => answer(snapshot));
  const lit = await fetchUnreadSurfaceIds(since);
  assert.ok(lit.includes("combo"), "newer post lights");
  assert.ok(!lit.includes("transfigure"), "older post stays dark");
  assert.ok(!lit.includes("history-course"), "no rows stays dark");
  assert.ok(lit.includes("colorful-philosophers"), "weekly post lights");
  assert.deepEqual(requested, ["/api/read/nav"], "one snapshot request and nothing else");

  // A table surface the snapshot does not list stays dark; nothing else is asked.
  const partial = { ...snapshot, latest: { transfigure: "2026-11-04T00:00:00.000Z" } };
  stubFetch(() => answer(partial));
  const partialIds = await fetchUnreadSurfaceIds(since);
  assert.ok(partialIds.includes("transfigure"));
  assert.ok(!partialIds.includes("combo"), "an unlisted surface stays dark");
  assert.deepEqual(requested, ["/api/read/nav"]);

  // --- A failed or refused snapshot: catalog dots only, empty courier ----------
  const neverSeen = Object.fromEntries(NAV_SEEN_SURFACES.map((surface) => [surface.id, "1970-01-01T00:00:00.000Z"]));
  const catalogOnly = ["patch-notes", "neowsletters"];
  const failures: [string, () => Response | Promise<Response>, string][] = [
    ["outage", () => answer({ error: "unavailable" }, 503), "unavailable"],
    ["surface_legacy", () => answer({ error: "surface_legacy" }, 409), "surface_legacy"],
    ["no marker", () => answer(snapshot, 200, false), "no_marker"],
    ["unknown shape", () => answer({ ...snapshot, v: 2 }), "bad_version"],
    ["no courier", () => answer({ ...snapshot, courier: null }), "bad_version"],
    ["another data env", () => answer({ ...snapshot, env: "development" }), "env_mismatch"],
    ["network", () => Promise.reject(new TypeError("fetch failed")), "unavailable"],
  ];
  const warn = console.warn;
  console.warn = () => undefined;
  for (const [label, respond, code] of failures) {
    stubFetch(respond);
    assert.deepEqual(await fetchUnreadSurfaceIds(neverSeen), catalogOnly, `${label}: catalog dots only`);
    assert.deepEqual(requested, ["/api/read/nav"], `${label}: nothing asked after the snapshot`);
    // The courier's only source rejects the same way, so it stays empty.
    stubFetch(respond);
    await assert.rejects(() => loadNavSnapshot(), (error) => error instanceof ApiUnavailableError && error.code === code, label);
  }
  console.warn = warn;

  // The patch static client may own the shared promise and reject with its own error.
  stubFetch(() => answer(snapshot));
  fakeWindow.__slseounRuntime = { demoted: new Set(["nav"]), nav: { promise: Promise.reject(new Error("demoted")), at: Date.now() } };
  assert.deepEqual(await fetchUnreadSurfaceIds(neverSeen), catalogOnly);
  assert.deepEqual(requested, [], "the shared rejection is reused, nothing is asked");

  console.log("nav-seen.spec.ts: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * Browser side of the step 6 identity (docs/supabase-exit/STEP6_PLAN.md WP-A):
 * src/lib/api-identity.ts, src/lib/api-session.ts and src/hooks/use-auth.ts with no
 * supabase-js. The signed cookie is the only identity: claim once with the stored
 * session (access and refresh token), store the session a claim answers (at the
 * key its `iss` names when there is none), `{}` once after a refused token, re-claim
 * on identity_required, legacy and token answers as outages, never a bearer token,
 * never a removed `sb-` key. Fake localStorage, window events and fetch.
 * Usage: tsx scripts/api-identity-client.spec.ts
 */
import assert from "node:assert/strict";

class FakeStorage {
  map = new Map<string, string>();
  removed: string[] = [];
  get length() {
    return this.map.size;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
  removeItem(key: string) {
    this.removed.push(key);
    this.map.delete(key);
  }
  clear() {
    this.map.clear();
  }
}

const storage = new FakeStorage();
const fakeDocument = { cookie: "" };
const fakeWindow = Object.assign(new EventTarget(), { localStorage: storage });
Object.assign(globalThis, { window: fakeWindow, document: fakeDocument });

const ISSUER = "https://abcdefghijklmnopqrst.supabase.co/auth/v1";
const AUTH_KEY = "sb-abcdefghijklmnopqrst-auth-token";
const MARKER_KEY = "slseoun-identity";
const USER = "4f1c2a7e-9b3d-4c5e-8f60-1a2b3c4d5e6f";
const OTHER = "0a0b0c0d-1111-4222-8333-444455556666";
const NEW_USER = "9d8c7b6a-5f4e-4d3c-8b2a-112233445566";

function base64Url(text: string): string {
  return Buffer.from(text).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** An unsigned JWT: the browser only reads `sub` and `iss`; the Worker checks signatures. */
function jwt(sub: string, iss = ISSUER, tag = "t"): string {
  return `${base64Url(JSON.stringify({ alg: "ES256", kid: "k" }))}.${base64Url(JSON.stringify({ iss, sub, tag, exp: 1 }))}.sig`;
}

function session(uid: string, accessToken = jwt(uid), refreshToken = `refresh-${uid.slice(0, 4)}`) {
  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: 1_900_000_000,
    refresh_token: refreshToken,
    user: { id: uid, aud: "authenticated", role: "authenticated", is_anonymous: true },
  };
}

type Sent = { url: string; method: string; headers: Record<string, string>; body: unknown; credentials?: string };

type HookState = { userId: string | null; ready: boolean; unavailable: boolean; ensureUser: () => Promise<string | null> };

/**
 * Just enough of a React host to run useAuth outside a renderer: useState,
 * useCallback and useEffect on React's own hook dispatcher, effects after each
 * render, and a re-render while state changed.
 */
async function mountHook(hook: () => HookState) {
  const React = await import("react");
  const internals = (React as unknown as { __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown } })
    .__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const states: unknown[] = [];
  const callbacks: { deps: unknown[] | undefined; value: unknown }[] = [];
  const effects: { deps: unknown[] | undefined; cleanup: unknown }[] = [];
  let pending: (() => void)[] = [];
  let cursor = 0;
  let dirty = false;
  let result: HookState | null = null;
  const sameDeps = (a: unknown[] | undefined, b: unknown[] | undefined) =>
    a !== undefined && b !== undefined && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const dispatcher = {
    useState(initial: unknown) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === "function" ? (initial as () => unknown)() : initial;
      const set = (next: unknown) => {
        const value = typeof next === "function" ? (next as (current: unknown) => unknown)(states[index]) : next;
        if (!Object.is(value, states[index])) {
          states[index] = value;
          dirty = true;
        }
      };
      return [states[index], set];
    },
    useCallback(callback: unknown, deps: unknown[] | undefined) {
      const index = cursor++;
      const previous = callbacks[index];
      if (previous && sameDeps(previous.deps, deps)) return previous.value;
      callbacks[index] = { deps, value: callback };
      return callback;
    },
    useEffect(effect: () => unknown, deps: unknown[] | undefined) {
      const index = cursor++;
      const previous = effects[index];
      if (previous && sameDeps(previous.deps, deps)) return;
      pending.push(() => {
        if (typeof previous?.cleanup === "function") (previous.cleanup as () => void)();
        effects[index] = { deps, cleanup: effect() };
      });
    },
  };
  const renderOnce = () => {
    cursor = 0;
    dirty = false;
    const outer = internals.H;
    internals.H = dispatcher;
    try {
      result = hook();
    } finally {
      internals.H = outer;
    }
    return result as HookState;
  };
  const flush = () => {
    for (let pass = 0; pass < 10; pass += 1) {
      const run = pending;
      pending = [];
      for (const effect of run) effect();
      if (!dirty) return result as HookState;
      renderOnce();
    }
    throw new Error("render loop");
  };
  const first = { ...renderOnce() };
  flush();
  return {
    first,
    current: () => result as HookState,
    flush,
    unmount: () => {
      for (const effect of effects) if (typeof effect?.cleanup === "function") (effect.cleanup as () => void)();
    },
  };
}

async function main() {
  const { ApiError, ApiUnavailableError } = await import("../src/lib/api-client");
  const { apiFetchAsUser } = await import("../src/lib/api-session");
  const identity = await import("../src/lib/api-identity");
  const { useAuth } = await import("../src/hooks/use-auth");

  const sent: Sent[] = [];
  /** Every request of the whole spec (`sent` is reset per case). */
  const allSent: Sent[] = [];
  let respond: (request: Sent) => Response | Promise<Response> = () => new Response("unset", { status: 599 });
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const request: Sent = {
      url: String(input),
      method: init.method ?? "GET",
      headers: { ...(init.headers as Record<string, string>) },
      body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
      credentials: init.credentials,
    };
    sent.push(request);
    allSent.push(request);
    return respond(request);
  }) as typeof fetch;
  const marked = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-slseoun-api": "1" },
  });
  let changes = 0;
  fakeWindow.addEventListener(identity.IDENTITY_CHANGE_EVENT, () => {
    changes += 1;
  });
  const reset = (cookie = "") => {
    fakeDocument.cookie = cookie;
    storage.clear();
    sent.length = 0;
    changes = 0;
  };
  const storeSession = (uid = USER, accessToken = jwt(uid), refreshToken: string | null = "stored-refresh", key = AUTH_KEY) => {
    const value: Record<string, unknown> = { ...session(uid, accessToken), refresh_token: refreshToken ?? undefined };
    if (refreshToken === null) delete value.refresh_token;
    storage.setItem(key, JSON.stringify(value));
  };
  const stored = (key = AUTH_KEY) => JSON.parse(storage.getItem(key) ?? "null") as Record<string, unknown> | null;
  const claims = () => sent.filter((request) => request.url === "/api/auth/claim").map((request) => request.body);

  // --- Stored session: claim once with both tokens, then no claim, never a bearer --------
  reset();
  const tokenA = jwt(USER, ISSUER, "a");
  storeSession(USER, tokenA);
  assert.deepEqual(identity.storedSupabaseIdentity(), { accessToken: tokenA, refreshToken: "stored-refresh", uid: USER });
  assert.equal(identity.currentIdentityUid(), USER);
  respond = (request) => request.url === "/api/auth/claim"
    ? marked({ v: 1, uid: USER, created: false, session: null })
    : marked({ ok: true });
  assert.deepEqual(await apiFetchAsUser("comments", "/api/write/comments", { method: "POST", body: { x: 1 } }), { ok: true });
  assert.deepEqual(sent[0], {
    url: "/api/auth/claim",
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: { access_token: tokenA, refresh_token: "stored-refresh" },
    credentials: "same-origin",
  }, "the stored session's tokens are posted once (WP0 claim contract)");
  assert.equal(sent[1].url, "/api/write/comments");
  assert.equal(sent[1].credentials, "same-origin", "the HttpOnly cookie rides along");
  assert.equal(identity.claimedUid(), USER);
  assert.equal(changes, 1, "a remembered claim tells this tab's hooks");
  assert.deepEqual(stored()?.access_token, tokenA, "a token claim leaves the stored session as it is");

  sent.length = 0;
  await apiFetchAsUser("comments", "/api/me/engagement");
  assert.deepEqual(sent.map((request) => request.url), ["/api/me/engagement"], "claimed: no second claim");

  // The slseoun_idm signal is not read any more: no cookie and a token signal behave the same.
  for (const cookie of ["", "slseoun_idm=token", "slseoun_idm=cookie"]) {
    reset(cookie);
    storeSession(USER, jwt(USER, ISSUER, `idm-${cookie}`));
    sent.length = 0;
    await apiFetchAsUser("comments", "/api/me/engagement");
    assert.deepEqual(sent.map((request) => request.url), ["/api/auth/claim", "/api/me/engagement"], `cookie "${cookie}"`);
  }

  // Concurrent first calls share one claim.
  reset();
  storeSession(USER, jwt(USER, ISSUER, "concurrent"));
  await Promise.all([apiFetchAsUser("comments", "/api/me/a"), apiFetchAsUser("comments", "/api/me/b")]);
  assert.equal(claims().length, 1);

  // Another uid in localStorage is claimed again; a session without a refresh token sends the access token alone.
  const otherToken = jwt(OTHER, ISSUER, "other");
  storeSession(OTHER, otherToken, null);
  sent.length = 0;
  respond = (request) => request.url === "/api/auth/claim"
    ? marked({ v: 1, uid: OTHER, created: false, session: null })
    : marked({ ok: true });
  await apiFetchAsUser("comments", "/api/me/engagement");
  assert.deepEqual(claims(), [{ access_token: otherToken }]);

  // supabase-js's older `currentSession` wrapper is read too.
  reset();
  const wrapped = jwt(USER, ISSUER, "wrapped");
  storage.setItem(AUTH_KEY, JSON.stringify({ currentSession: { access_token: wrapped, refresh_token: "w", user: { id: USER.toUpperCase() } }, expiresAt: 1 }));
  assert.deepEqual(identity.storedSupabaseIdentity(), { accessToken: wrapped, refreshToken: "w", uid: USER });

  // --- A refreshed session is stored under the same key, same uid -------------------------
  reset();
  const pastWindow = jwt(USER, ISSUER, "past-window");
  storeSession(USER, pastWindow, "old-refresh");
  const refreshedSession = session(USER, jwt(USER, ISSUER, "refreshed"), "rotated-refresh");
  respond = (request) => request.url === "/api/auth/claim"
    ? marked({ v: 1, uid: USER, created: false, session: refreshedSession })
    : marked({ ok: true });
  await apiFetchAsUser("comments", "/api/write/comments", { method: "POST", body: {} });
  assert.deepEqual(claims(), [{ access_token: pastWindow, refresh_token: "old-refresh" }]);
  assert.deepEqual(stored(), refreshedSession, "supabase-js v2 shape, under the existing key");
  assert.equal([...storage.map.keys()].filter((key) => key.startsWith("sb-")).length, 1, "no second session key");
  assert.equal(identity.claimedUid(), USER, "the same uid");
  assert.equal(changes, 1, "one change event for the session and the marker");
  assert.deepEqual(identity.storedSupabaseIdentity(), { accessToken: refreshedSession.access_token, refreshToken: "rotated-refresh", uid: USER });

  // --- A refused token (and refresh): {} once -------------------------------------------------
  // With a valid cookie the Worker keeps its uid.
  reset();
  const refusedKept = jwt(USER, ISSUER, "refused-kept");
  storeSession(USER, refusedKept);
  respond = (request) => {
    if (request.url !== "/api/auth/claim") return marked({ ok: "kept" });
    return (request.body as { access_token?: string }).access_token
      ? marked({ error: "token_invalid" }, 401)
      : marked({ v: 1, uid: USER, created: false, session: null });
  };
  assert.deepEqual(await apiFetchAsUser("comments", "/api/write/comments", { method: "POST", body: {} }), { ok: "kept" });
  assert.deepEqual(claims(), [{ access_token: refusedKept, refresh_token: "stored-refresh" }, {}], "the token, then {} once");
  assert.equal(identity.claimedUid(), USER);
  assert.equal(stored()?.access_token, refusedKept, "kept: the stored session stays");

  // Without a cookie the Worker signs up a new user, whose session replaces the one that cannot be refreshed.
  reset();
  const refusedNew = jwt(USER, ISSUER, "refused-new");
  storeSession(USER, refusedNew);
  const signedUp = session(NEW_USER);
  respond = (request) => {
    if (request.url !== "/api/auth/claim") return marked({ ok: "new" });
    return (request.body as { access_token?: string }).access_token
      ? marked({ error: "token_invalid" }, 401)
      : marked({ v: 1, uid: NEW_USER, created: true, session: signedUp });
  };
  assert.deepEqual(await apiFetchAsUser("comments", "/api/write/comments", { method: "POST", body: {} }), { ok: "new" });
  assert.deepEqual(claims(), [{ access_token: refusedNew, refresh_token: "stored-refresh" }, {}]);
  assert.deepEqual(stored(), signedUp, "as supabase-js dropped a dead session and signed in again");
  assert.equal(identity.claimedUid(), NEW_USER);
  assert.equal(identity.currentIdentityUid(), NEW_USER);

  // A kept cookie of another uid next to a refused session: no claim on every call afterwards.
  reset();
  const refusedOther = jwt(USER, ISSUER, "refused-other");
  storeSession(USER, refusedOther);
  respond = (request) => {
    if (request.url !== "/api/auth/claim") return marked({ ok: true });
    return (request.body as { access_token?: string }).access_token
      ? marked({ error: "token_invalid" }, 401)
      : marked({ v: 1, uid: OTHER, created: false, session: null });
  };
  await apiFetchAsUser("comments", "/api/me/engagement");
  assert.equal(identity.claimedUid(), OTHER);
  sent.length = 0;
  await apiFetchAsUser("comments", "/api/me/engagement");
  assert.deepEqual(sent.map((request) => request.url), ["/api/me/engagement"], "the refused token is not posted again");

  // The {} claim failing is a failed sign-in: an outage, nothing remembered.
  reset();
  storeSession(USER, jwt(USER, ISSUER, "refused-down"));
  respond = (request) => (request.body as { access_token?: string }).access_token
    ? marked({ error: "token_invalid" }, 401)
    : marked({ error: "auth_unavailable" }, 503);
  await assert.rejects(() => apiFetchAsUser("comments", "/api/write/comments", { method: "POST", body: {} }), (error) => error instanceof ApiUnavailableError && error.code === "auth_unavailable");
  assert.equal(claims().length, 2);
  assert.equal(sent.length, 2, "no write without an identity");
  assert.equal(identity.claimedUid(), null);

  // A refresh outage (503) is not a refusal: no {} and no new user.
  reset();
  storeSession(USER, jwt(USER, ISSUER, "refresh-down"));
  respond = () => marked({ error: "auth_unavailable" }, 503);
  await assert.rejects(() => identity.ensureClaimedIdentity(), (error) => error instanceof ApiUnavailableError);
  assert.equal(claims().length, 1);

  // --- A main Worker from before WP-A (the patch Worker deploys first) ------------------------
  // It answers refresh_token 400 invalid: the access token alone, once.
  const olderWorker = (claim: (body: { access_token?: string; refresh_token?: string }) => Response) => (request: Sent) => {
    if (request.url !== "/api/auth/claim") return marked({ ok: "older" });
    const body = request.body as { access_token?: string; refresh_token?: string };
    return body.refresh_token !== undefined ? marked({ error: "invalid" }, 400) : claim(body);
  };
  reset();
  const olderToken = jwt(USER, ISSUER, "older");
  storeSession(USER, olderToken, "older-refresh");
  respond = olderWorker(() => marked({ v: 1, uid: USER, created: false }));
  assert.deepEqual(await apiFetchAsUser("comments", "/api/write/comments", { method: "POST", body: {} }), { ok: "older" });
  assert.deepEqual(claims(), [{ access_token: olderToken, refresh_token: "older-refresh" }, { access_token: olderToken }]);
  assert.equal(identity.claimedUid(), USER);
  assert.equal(stored()?.access_token, olderToken);

  // It cannot refresh: a token it refuses is an outage, never {} and a new user over a session the newer Worker can refresh.
  reset();
  const olderRefused = jwt(USER, ISSUER, "older-refused");
  storeSession(USER, olderRefused, "older-refresh");
  respond = olderWorker(() => marked({ error: "token_invalid" }, 401));
  await assert.rejects(() => apiFetchAsUser("comments", "/api/write/comments", { method: "POST", body: {} }), (error) => error instanceof ApiUnavailableError && error.code === "unavailable");
  assert.deepEqual(claims(), [{ access_token: olderRefused, refresh_token: "older-refresh" }, { access_token: olderRefused }], "no {}");
  assert.deepEqual(sent.map((request) => request.url), ["/api/auth/claim", "/api/auth/claim"], "no write");
  assert.deepEqual([identity.claimedUid(), stored()?.access_token, stored()?.refresh_token], [null, olderRefused, "older-refresh"]);
  // The next call asks again (the main Worker may be new by then).
  respond = (request) => request.url === "/api/auth/claim"
    ? marked({ v: 1, uid: USER, created: false, session: session(USER, jwt(USER, ISSUER, "newer"), "rotated") })
    : marked({ ok: "newer" });
  sent.length = 0;
  assert.deepEqual(await apiFetchAsUser("comments", "/api/write/comments", { method: "POST", body: {} }), { ok: "newer" });
  assert.deepEqual(claims(), [{ access_token: olderRefused, refresh_token: "older-refresh" }]);
  assert.equal(stored()?.refresh_token, "rotated");

  // --- identity_required: claim again and retry once ----------------------------------------
  reset();
  const requiredToken = jwt(USER, ISSUER, "required");
  storeSession(USER, requiredToken);
  storage.setItem(MARKER_KEY, JSON.stringify({ uid: USER }));
  let refusals = 1;
  respond = (request) => {
    if (request.url === "/api/auth/claim") return marked({ v: 1, uid: USER, created: false, session: null });
    if (refusals > 0) {
      refusals -= 1;
      return marked({ error: "identity_required" }, 401);
    }
    return marked({ ok: 2 });
  };
  assert.deepEqual(await apiFetchAsUser("comments", "/api/write/comments", { method: "POST", body: {} }), { ok: 2 });
  assert.deepEqual(sent.map((request) => request.url), ["/api/write/comments", "/api/auth/claim", "/api/write/comments"]);
  assert.deepEqual(claims(), [{ access_token: requiredToken, refresh_token: "stored-refresh" }]);

  // The cookie is gone and there is nothing to claim with: forget the uid so ensureUser asks the Worker.
  reset();
  storage.setItem(MARKER_KEY, JSON.stringify({ uid: USER }));
  respond = () => marked({ error: "identity_required" }, 401);
  await assert.rejects(() => apiFetchAsUser("comments", "/api/write/comments", { method: "POST", body: {} }), (error) => error instanceof ApiError && error.code === "identity_required");
  assert.equal(identity.claimedUid(), null);
  assert.equal(sent.length, 1, "a write is never resent without an identity");

  // --- Token and legacy answers are outages ---------------------------------------------------
  reset();
  storeSession(USER, jwt(USER, ISSUER, "token-path"));
  storage.setItem(MARKER_KEY, JSON.stringify({ uid: USER }));
  for (const code of ["token_invalid", "token_expired"]) {
    sent.length = 0;
    respond = () => marked({ error: code }, 401);
    await assert.rejects(() => apiFetchAsUser("comments", "/api/write/comments", { method: "POST", body: {} }), (error) => error instanceof ApiUnavailableError && error.code === "unavailable", code);
    assert.equal(sent.length, 1, `${code}: not resent on a token path`);
  }

  reset();
  storeSession(USER, jwt(USER, ISSUER, "legacy-claim"));
  respond = (request) => request.url === "/api/auth/claim" ? marked({ error: "surface_legacy", reason: "flag" }, 409) : marked({ ok: "never" });
  await assert.rejects(() => apiFetchAsUser("comments", "/api/write/comments", { method: "POST", body: {} }), (error) => error instanceof ApiUnavailableError && error.code === "unavailable", "a legacy claim answer");
  assert.deepEqual(sent.map((request) => request.url), ["/api/auth/claim"]);
  respond = () => new Response("<html>old worker</html>", { status: 404 });
  await assert.rejects(() => identity.claimNewIdentity(), (error) => error instanceof ApiUnavailableError && error.code === "unavailable", "no router marker");
  respond = () => {
    throw new TypeError("offline");
  };
  await assert.rejects(() => identity.claimNewIdentity(), (error) => error instanceof ApiUnavailableError);
  respond = () => marked({ v: 2, uid: USER });
  await assert.rejects(() => identity.claimNewIdentity(), (error) => error instanceof ApiUnavailableError && error.code === "bad_response");
  assert.equal(identity.claimedUid(), null, "nothing remembered after a failed claim");

  // Other claim refusals surface as they are.
  for (const [status, code] of [[429, "rate_limited"], [403, "forbidden"], [400, "invalid"]] as const) {
    reset();
    storeSession(USER, jwt(USER, ISSUER, `refusal-${code}`));
    respond = (request) => request.url === "/api/auth/claim" ? marked({ error: code }, status) : marked({ ok: "never" });
    await assert.rejects(() => apiFetchAsUser("comments", "/api/write/comments", { method: "POST", body: {} }), (error) => error instanceof ApiError && !(error instanceof ApiUnavailableError) && error.code === code, code);
    // 400 invalid is also an older Worker's answer to refresh_token: the access token alone once more.
    const tokenClaims = code === "invalid" ? 2 : 1;
    assert.deepEqual(sent.map((request) => request.url), Array(tokenClaims).fill("/api/auth/claim"), `${code}: no {} and no write`);
  }
  reset();
  storeSession(USER, jwt(USER, ISSUER, "refusal-no-refresh"), null);
  respond = (request) => request.url === "/api/auth/claim" ? marked({ error: "invalid" }, 400) : marked({ ok: "never" });
  await assert.rejects(() => identity.ensureClaimedIdentity(), (error) => error instanceof ApiError && error.code === "invalid");
  assert.equal(claims().length, 1, "without a refresh token there is nothing to drop");

  // --- New users -----------------------------------------------------------------------------
  reset();
  await assert.rejects(() => apiFetchAsUser("comments", "/api/write/comments", { method: "POST", body: {} }), (error) => error instanceof ApiError && error.code === "token_invalid");
  assert.equal(sent.length, 0, "apiFetchAsUser never signs up (ensureUser does)");

  const newSession = session(NEW_USER, jwt(NEW_USER, "https://ZYXWVUTSRQPONMLKJIHG.supabase.co/auth/v1"));
  respond = () => marked({ v: 1, uid: NEW_USER, created: true, session: newSession });
  assert.deepEqual(await identity.claimNewIdentity(), { v: 1, uid: NEW_USER, created: true, session: newSession });
  assert.deepEqual(sent[0].body, {}, "a new user posts no token");
  assert.deepEqual(stored("sb-zyxwvutsrqponmlkjihg-auth-token"), newSession, "stored at the key the token's iss names");
  assert.equal(identity.claimedUid(), NEW_USER);
  assert.deepEqual(identity.storedSupabaseIdentity()?.uid, NEW_USER);

  // A key already in storage wins over the issuer.
  reset();
  storage.setItem("sb-existingref-auth-token", "{}");
  respond = () => marked({ v: 1, uid: NEW_USER, created: true, session: session(NEW_USER) });
  await identity.claimNewIdentity();
  assert.equal(stored("sb-existingref-auth-token")?.refresh_token, session(NEW_USER).refresh_token);
  assert.equal(storage.getItem(AUTH_KEY), null);

  // A session that does not name the claimed uid, or an issuer that makes no key, is not stored.
  for (const bad of [session(OTHER), session(NEW_USER, jwt(NEW_USER, "not a url")), session(NEW_USER, jwt(NEW_USER, "https://bad_host.example/auth/v1"))]) {
    reset();
    respond = () => marked({ v: 1, uid: NEW_USER, created: true, session: bad });
    await identity.claimNewIdentity();
    assert.equal([...storage.map.keys()].some((key) => key.startsWith("sb-")), false);
    assert.equal(identity.claimedUid(), NEW_USER, "the claim is still remembered");
  }

  assert.equal(identity.isIdentityStorageKey(AUTH_KEY), true);
  assert.equal(identity.isIdentityStorageKey(MARKER_KEY), true);
  assert.equal(identity.isIdentityStorageKey("sts-nav-seen"), false);

  // --- useAuth -------------------------------------------------------------------------------
  const storageEvent = (key: string | null) => {
    const event = new Event("storage");
    Object.defineProperty(event, "key", { value: key });
    fakeWindow.dispatchEvent(event);
  };

  reset();
  storeSession(USER, jwt(USER, ISSUER, "hook"));
  let host = await mountHook(useAuth);
  assert.deepEqual([host.first.userId, host.first.ready, host.first.unavailable], [null, false, false], "the pre-rendered state, as with supabaseEnabled true");
  assert.deepEqual([host.current().userId, host.current().ready, host.current().unavailable], [USER, true, false], "mount reads the stored session's uid");
  assert.equal(sent.length, 0, "mount sends nothing");
  assert.equal(await host.current().ensureUser(), USER);
  assert.equal(sent.length, 0, "a stored session needs no claim to be the user");

  // Another tab stores a session (storage event), or clears storage.
  storeSession(OTHER, jwt(OTHER, ISSUER, "other-tab"));
  storageEvent(AUTH_KEY);
  assert.equal(host.flush().userId, OTHER, "another tab's session");
  storage.setItem("unrelated", "x");
  storeSession(USER, jwt(USER, ISSUER, "quiet"));
  storageEvent("unrelated");
  assert.equal(host.flush().userId, OTHER, "unrelated keys are ignored");
  storage.clear();
  storageEvent(null);
  assert.equal(host.flush().userId, null, "cleared storage");
  storage.setItem(MARKER_KEY, JSON.stringify({ uid: NEW_USER }));
  storageEvent(MARKER_KEY);
  assert.equal(host.flush().userId, NEW_USER, "another tab's claim");
  host.unmount();
  storeSession(USER, jwt(USER, ISSUER, "after-unmount"));
  storageEvent(AUTH_KEY);
  assert.equal(host.flush().userId, NEW_USER, "no listener after unmount");

  // A claimed uid without a stored session is "me" too; the session wins when both exist.
  reset();
  storage.setItem(MARKER_KEY, JSON.stringify({ uid: NEW_USER }));
  host = await mountHook(useAuth);
  assert.equal(host.current().userId, NEW_USER);
  host.unmount();
  storeSession(USER, jwt(USER, ISSUER, "both"));
  host = await mountHook(useAuth);
  assert.equal(host.current().userId, USER, "the stored session first, as getSession came first");
  host.unmount();

  // ensureUser with nothing stored claims {}; another hook in this tab follows.
  reset();
  host = await mountHook(useAuth);
  const sibling = await mountHook(useAuth);
  assert.equal(host.current().userId, null);
  const hookSession = session(NEW_USER, jwt(NEW_USER, ISSUER, "hook-new"));
  respond = () => marked({ v: 1, uid: NEW_USER, created: true, session: hookSession });
  assert.equal(await host.current().ensureUser(), NEW_USER);
  assert.deepEqual(claims(), [{}]);
  assert.deepEqual([host.flush().userId, host.current().unavailable], [NEW_USER, false]);
  assert.equal(sibling.flush().userId, NEW_USER, "this tab's other hooks follow, as onAuthStateChange did");
  assert.deepEqual(stored(), hookSession, "the new user's session is stored for a rollback");
  assert.equal(await host.current().ensureUser(), NEW_USER);
  assert.equal(claims().length, 1, "no second claim");
  host.unmount();
  sibling.unmount();

  // A failed claim is a failed sign-in: unavailable.
  reset();
  host = await mountHook(useAuth);
  respond = () => marked({ error: "auth_unavailable" }, 503);
  assert.equal(await host.current().ensureUser(), null);
  assert.deepEqual([host.flush().userId, host.current().unavailable], [null, true]);
  respond = () => marked({ error: "surface_legacy", reason: "flag" }, 409);
  assert.equal(await host.current().ensureUser(), null, "identity.mode token is an outage, not a direct sign-up");
  assert.equal(host.flush().unavailable, true);
  respond = () => marked({ v: 1, uid: USER, created: false, session: null });
  assert.equal(await host.current().ensureUser(), USER, "a kept cookie");
  assert.deepEqual([host.flush().userId, host.current().unavailable], [USER, false]);
  host.unmount();

  // --- No usable localStorage: the page keeps a claimed session in memory, as supabase-js did ---
  // Runs last: the page's memory session outlives reset().
  const browserWindow = fakeWindow as unknown as { localStorage: FakeStorage | null };
  reset();
  browserWindow.localStorage = null;
  // A kept cookie answers no session: nothing to keep, and the write fails as on a later
  // page before step 6, where supabase-js held no session (tasks/010 #74).
  respond = (request) => request.url === "/api/auth/claim"
    ? marked({ v: 1, uid: USER, created: false, session: null })
    : marked({ ok: "never" });
  assert.equal((await identity.claimNewIdentity()).uid, USER);
  assert.deepEqual([identity.claimedUid(), identity.storedSupabaseIdentity(), changes], [null, null, 0]);
  await assert.rejects(() => apiFetchAsUser("comments", "/api/write/comments", { method: "POST", body: {} }), (error) => error instanceof ApiError && !(error instanceof ApiUnavailableError) && error.code === "token_invalid");
  assert.deepEqual(sent.map((request) => request.url), ["/api/auth/claim"], "no write without an identity");

  // A new user's session: kept for this page, so writes go out with the cookie, as on the first page before step 6.
  reset();
  host = await mountHook(useAuth);
  const memorySibling = await mountHook(useAuth);
  assert.equal(host.current().userId, null);
  const memorySession = session(NEW_USER, jwt(NEW_USER, ISSUER, "memory"), "memory-refresh");
  respond = (request) => request.url === "/api/auth/claim"
    ? marked({ v: 1, uid: NEW_USER, created: true, session: memorySession })
    : marked({ ok: "memory" });
  assert.equal(await host.current().ensureUser(), NEW_USER);
  assert.equal(changes, 1, "this tab's hooks hear of it, as onAuthStateChange fired for a memory session");
  assert.equal(memorySibling.flush().userId, NEW_USER);
  assert.deepEqual(identity.storedSupabaseIdentity(), { accessToken: memorySession.access_token, refreshToken: "memory-refresh", uid: NEW_USER });
  assert.equal(identity.claimedUid(), NEW_USER);
  assert.deepEqual(await apiFetchAsUser("comments", "/api/write/comments", { method: "POST", body: {} }), { ok: "memory" });
  assert.deepEqual(await apiFetchAsUser("comments", "/api/me/engagement"), { ok: "memory" });
  assert.deepEqual(sent.map((request) => request.url), ["/api/auth/claim", "/api/write/comments", "/api/me/engagement"], "one claim for the page");
  assert.equal(await host.current().ensureUser(), NEW_USER);
  host.unmount();
  memorySibling.unmount();

  // The cookie is gone: the memory session is claimed again and the call retried once.
  sent.length = 0;
  let memoryRefusals = 1;
  respond = (request) => {
    if (request.url === "/api/auth/claim") return marked({ v: 1, uid: NEW_USER, created: false, session: null });
    if (memoryRefusals > 0) {
      memoryRefusals -= 1;
      return marked({ error: "identity_required" }, 401);
    }
    return marked({ ok: "again" });
  };
  assert.deepEqual(await apiFetchAsUser("comments", "/api/write/comments", { method: "POST", body: {} }), { ok: "again" });
  assert.deepEqual(claims(), [{ access_token: memorySession.access_token, refresh_token: "memory-refresh" }]);
  assert.equal(identity.claimedUid(), NEW_USER);

  // localStorage that refuses writes is the same.
  reset();
  browserWindow.localStorage = Object.assign(new FakeStorage(), { setItem() {
    throw new Error("quota");
  } });
  const quotaSession = session(OTHER, jwt(OTHER, ISSUER, "quota"));
  respond = () => marked({ v: 1, uid: OTHER, created: true, session: quotaSession });
  assert.equal((await identity.claimNewIdentity()).uid, OTHER);
  assert.deepEqual([identity.storedSupabaseIdentity()?.uid, identity.claimedUid(), changes], [OTHER, OTHER, 1]);

  // Writable again: the next session goes to localStorage and the memory one is dropped.
  reset();
  browserWindow.localStorage = storage;
  const backSession = session(USER, jwt(USER, ISSUER, "back"));
  respond = () => marked({ v: 1, uid: USER, created: true, session: backSession });
  await identity.claimNewIdentity();
  assert.deepEqual(stored(), backSession);
  assert.deepEqual([identity.storedSupabaseIdentity()?.accessToken, identity.claimedUid()], [backSession.access_token, USER]);

  // --- Never a bearer token, never a removed session ---------------------------------------
  assert.equal(allSent.some((request) => Object.keys(request.headers).some((name) => name.toLowerCase() === "authorization")), false, "no Authorization header in any request");
  assert.equal(storage.removed.some((key) => key.startsWith("sb-")), false, "no sb- key is ever removed");
  assert.ok(allSent.length > 30, `the checks above sent requests (${allSent.length})`);

  console.log("api-identity-client spec passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * Browser side of the step 4 identity (src/lib/api-identity.ts, api-session.ts):
 * claim once, no bearer token while the Worker signals cookie mode, re-claim on
 * identity_required, back to tokens on a rollback, and nothing new with the
 * signal off. Usage: tsx scripts/api-identity-client.spec.ts
 */
import assert from "node:assert/strict";

class FakeStorage {
  map = new Map<string, string>();
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
    this.map.delete(key);
  }
  clear() {
    this.map.clear();
  }
}

const storage = new FakeStorage();
const fakeDocument = { cookie: "" };
const fakeWindow: Record<string, unknown> = { localStorage: storage };
Object.assign(globalThis, { window: fakeWindow, document: fakeDocument });
// A real supabase-js on the same storage, so the token path (getSession) is observable.
Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true, writable: true });
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcdefghijklmnopqrst.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_spec";

const USER = "4f1c2a7e-9b3d-4c5e-8f60-1a2b3c4d5e6f";
const NEW_USER = "9d8c7b6a-5f4e-4d3c-8b2a-112233445566";
const AUTH_KEY = "sb-abcdefghijklmnopqrst-auth-token";

type Sent = { url: string; method: string; headers: Record<string, string>; body: unknown; credentials?: string };

async function main() {
  const { ApiError, ApiUnavailableError } = await import("../src/lib/api-client");
  const { apiFetchAsUser } = await import("../src/lib/api-session");
  const identity = await import("../src/lib/api-identity");

  const sent: Sent[] = [];
  let respond: (request: Sent) => Response = () => new Response("unset", { status: 599 });
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const request: Sent = {
      url: String(input),
      method: init.method ?? "GET",
      headers: { ...(init.headers as Record<string, string>) },
      body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
      credentials: init.credentials,
    };
    sent.push(request);
    return respond(request);
  }) as typeof fetch;
  const marked = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-slseoun-api": "1" },
  });
  const reset = (cookie: string) => {
    fakeDocument.cookie = cookie;
    storage.clear();
    sent.length = 0;
    delete fakeWindow.__slseounRuntime;
  };
  const storeSession = (uid = USER, accessToken = "stored.access.token") => {
    // Live, so supabase-js returns it without a refresh call.
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    storage.setItem(AUTH_KEY, JSON.stringify({ access_token: accessToken, refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: expiresAt, user: { id: uid } }));
  };

  // --- Signal off: today's path, no claim -------------------------------------------
  reset("slseoun_rf=v1.comments");
  storeSession();
  assert.equal(identity.identityCookieMode(), false);
  assert.equal(identity.cookieModeFallbackUid(), null, "no fallback uid without the signal");
  respond = () => marked({ ok: "today" });
  assert.deepEqual(await apiFetchAsUser("comments", "/api/me/engagement"), { ok: "today" });
  assert.deepEqual(sent.map((request) => [request.url, request.headers.Authorization]), [["/api/me/engagement", "Bearer stored.access.token"]], "signal off: no claim, the bearer token as today");
  reset("slseoun_idm=token");
  assert.equal(identity.identityCookieMode(), false, "only the value cookie turns it on");

  // --- Cookie mode: claim once, then no bearer token ------------------------------------
  reset("slseoun_rf=v1.comments; slseoun_idm=cookie");
  storeSession();
  assert.deepEqual(identity.storedSupabaseIdentity(), { accessToken: "stored.access.token", uid: USER });
  respond = (request) => request.url === "/api/auth/claim"
    ? marked({ v: 1, uid: USER, created: false, session: null })
    : marked({ ok: true });
  assert.deepEqual(await apiFetchAsUser("comments", "/api/write/comments", { method: "POST", body: { x: 1 } }), { ok: true });
  assert.equal(sent.length, 2);
  assert.deepEqual(sent[0], {
    url: "/api/auth/claim",
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: { access_token: "stored.access.token" },
    credentials: "same-origin",
  }, "the stored Supabase token is posted once");
  assert.equal(sent[1].url, "/api/write/comments");
  assert.equal(sent[1].headers.Authorization, undefined, "no bearer token in cookie mode");
  assert.equal(sent[1].credentials, "same-origin", "the HttpOnly cookie rides along");
  assert.equal(identity.claimedUid(), USER);
  assert.equal(storage.getItem(AUTH_KEY) !== null, true, "the Supabase token stays in localStorage");

  sent.length = 0;
  await apiFetchAsUser("comments", "/api/me/engagement");
  assert.deepEqual(sent.map((request) => request.url), ["/api/me/engagement"], "claimed: no second claim");

  // Concurrent first calls share one claim.
  storage.removeItem("slseoun-identity");
  sent.length = 0;
  await Promise.all([apiFetchAsUser("comments", "/api/me/a"), apiFetchAsUser("comments", "/api/me/b")]);
  assert.equal(sent.filter((request) => request.url === "/api/auth/claim").length, 1);

  // Another Supabase uid in localStorage (a new sign-in) is claimed again.
  storeSession("0a0b0c0d-1111-4222-8333-444455556666", "other.token");
  sent.length = 0;
  respond = (request) => request.url === "/api/auth/claim"
    ? marked({ v: 1, uid: "0a0b0c0d-1111-4222-8333-444455556666", created: false, session: null })
    : marked({ ok: true });
  await apiFetchAsUser("comments", "/api/me/engagement");
  assert.deepEqual(sent.map((request) => request.url), ["/api/auth/claim", "/api/me/engagement"]);
  assert.deepEqual(sent[0].body, { access_token: "other.token" });

  // --- identity_required: claim again and retry once -----------------------------------
  reset("slseoun_idm=cookie");
  storeSession();
  storage.setItem("slseoun-identity", JSON.stringify({ uid: USER }));
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

  // The cookie is gone and there is nothing to claim with: forget the uid so ensureUser asks the Worker.
  reset("slseoun_idm=cookie");
  storage.setItem("slseoun-identity", JSON.stringify({ uid: USER }));
  respond = () => marked({ error: "identity_required" }, 401);
  await assert.rejects(() => apiFetchAsUser("comments", "/api/write/comments", { method: "POST", body: {} }), (error) => error instanceof ApiError && error.code === "identity_required");
  assert.equal(identity.claimedUid(), null);
  assert.equal(sent.length, 1, "a write is never resent without an identity");

  // --- Rollback: the Worker is on tokens again --------------------------------------------
  const sentWith = () => sent.map((request) => [request.url, request.headers.Authorization ?? null]);
  reset("slseoun_idm=cookie");
  storeSession();
  respond = (request) => request.url === "/api/auth/claim"
    ? marked({ error: "surface_legacy", reason: "flag" }, 409)
    : marked({ ok: "token" });
  assert.deepEqual(await apiFetchAsUser("comments", "/api/write/comments", { method: "POST", body: {} }), { ok: "token" });
  assert.deepEqual(sentWith(), [["/api/auth/claim", null], ["/api/write/comments", "Bearer stored.access.token"]], "a legacy claim answer goes to the token path");

  reset("slseoun_idm=cookie");
  storeSession();
  storage.setItem("slseoun-identity", JSON.stringify({ uid: USER }));
  respond = (request) => request.headers.Authorization ? marked({ ok: "token" }) : marked({ error: "token_invalid" }, 401);
  assert.deepEqual(await apiFetchAsUser("comments", "/api/write/comments", { method: "POST", body: {} }), { ok: "token" });
  assert.deepEqual(sentWith(), [["/api/write/comments", null], ["/api/write/comments", "Bearer stored.access.token"]], "token_invalid in cookie mode is redone on the token path");

  // A refused claim (stored token past the deadline, or HS256 without the secret) takes the
  // token path too, where supabase-js refreshes as today; the next call claims again.
  reset("slseoun_idm=cookie");
  storeSession();
  respond = (request) => request.url === "/api/auth/claim"
    ? marked({ error: "token_invalid" }, 401)
    : request.headers.Authorization ? marked({ ok: "token" }) : marked({ error: "identity_required" }, 401);
  assert.deepEqual(await apiFetchAsUser("comments", "/api/write/comments", { method: "POST", body: {} }), { ok: "token" });
  assert.deepEqual(sentWith(), [["/api/auth/claim", null], ["/api/write/comments", "Bearer stored.access.token"]], "refused claim: one write, with the bearer");
  assert.equal(identity.claimedUid(), null);

  reset("slseoun_idm=cookie");
  storeSession();
  storage.setItem("slseoun-identity", JSON.stringify({ uid: USER }));
  respond = (request) => request.url === "/api/auth/claim"
    ? marked({ error: "token_invalid" }, 401)
    : request.headers.Authorization ? marked({ ok: "token" }) : marked({ error: "identity_required" }, 401);
  assert.deepEqual(await apiFetchAsUser("comments", "/api/write/comments", { method: "POST", body: {} }), { ok: "token" });
  assert.deepEqual(sentWith(), [["/api/write/comments", null], ["/api/auth/claim", null], ["/api/write/comments", "Bearer stored.access.token"]], "cookie gone and the re-claim refused: the token path");

  // Other claim refusals still surface.
  reset("slseoun_idm=cookie");
  storeSession();
  respond = (request) => request.url === "/api/auth/claim" ? marked({ error: "rate_limited" }, 429) : marked({ ok: "never" });
  await assert.rejects(() => apiFetchAsUser("comments", "/api/write/comments", { method: "POST", body: {} }), (error) => error instanceof ApiError && error.code === "rate_limited");
  assert.deepEqual(sent.map((request) => request.url), ["/api/auth/claim"]);

  reset("slseoun_idm=cookie");
  respond = () => new Response("<html>old worker</html>", { status: 404 });
  await assert.rejects(() => identity.claimNewIdentity(), (error) => error instanceof identity.IdentityLegacyError, "no router marker is a legacy answer");

  // Refused claims surface as ApiError.
  reset("slseoun_idm=cookie");
  storeSession();
  respond = () => marked({ error: "token_invalid" }, 401);
  await assert.rejects(() => identity.ensureClaimedIdentity(), (error) => error instanceof ApiError && error.code === "token_invalid");
  respond = () => marked({ error: "unavailable" }, 503);
  await assert.rejects(() => identity.ensureClaimedIdentity(), (error) => error instanceof ApiError && error.status === 503);
  assert.equal(identity.claimedUid(), null, "nothing remembered after a failed claim");

  // --- New users and the fallback uid -------------------------------------------------------
  reset("slseoun_idm=cookie");
  await assert.rejects(() => apiFetchAsUser("comments", "/api/write/comments", { method: "POST", body: {} }), (error) => error instanceof ApiError && error.code === "token_invalid");
  assert.equal(sent.length, 0, "apiFetchAsUser never signs up (ensureUser does)");
  // The Worker's sign-up failed: a failed sign-in as today, nothing remembered.
  respond = () => marked({ error: "auth_unavailable" }, 503);
  await assert.rejects(() => identity.claimNewIdentity(), (error) => error instanceof ApiUnavailableError && error.code === "auth_unavailable");
  assert.equal(identity.claimedUid(), null);
  sent.length = 0;
  const session = { access_token: "a", refresh_token: "r", expires_in: 3600, expires_at: 2, token_type: "bearer", user: { id: NEW_USER } };
  respond = () => marked({ v: 1, uid: NEW_USER, created: true, session });
  const created = await identity.claimNewIdentity();
  assert.deepEqual(created, { v: 1, uid: NEW_USER, created: true, session });
  assert.deepEqual(sent[0].body, {}, "a new user posts no token");
  assert.equal(identity.cookieModeFallbackUid(), NEW_USER, "the claimed uid shows as me without a Supabase session");
  fakeDocument.cookie = "";
  assert.equal(identity.cookieModeFallbackUid(), null);

  console.log("api-identity-client spec passed");
  // supabase-js keeps timers alive.
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * The static patch comments client (src/components/patches/patch-comments-client.js)
 * after step 6 (docs/supabase-exit/STEP6_PLAN.md WP-P): every call is a same-origin
 * /api call with the cookie identity, never a bearer token, and the claim follows
 * the WP0 contract (src/lib/identity-cookies.ts ClaimRequest / ClaimResponse).
 * The IIFE runs in a VM with a hook that exposes the functions under test; its
 * start-up never fires.
 * Usage: tsx scripts/api-identity-patch-client.spec.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const USER = "4f1c2a7e-9b3d-4c5e-8f60-1a2b3c4d5e6f";
const NEW_USER = "9d8c7b6a-5f4e-4d3c-8b2a-112233445566";
const REF = "abcdefghijklmnopqrst";
const AUTH_KEY = `sb-${REF}-auth-token`;
const MARKER_KEY = "slseoun-identity";
const START = '  if (document.readyState === "loading") {';

type Sent = { url: string; method: string; authorization: string | null; body: unknown };
type Session = { access_token?: string; refresh_token?: string; user?: { id?: string } };
type Client = {
  readConfig(): Record<string, unknown>;
  configEnv(config: unknown): string;
  ensureClaimed(options?: { force?: boolean; signUp?: boolean }): Promise<string>;
  apiWriteAsUser(path: string, init: Record<string, unknown>): Promise<{ result: unknown; session: Session }>;
  loadState(threadKey: string): Promise<{ userId: string | null; liked: Set<string>; comments: unknown[] }>;
  courierItems(config: unknown): Promise<Array<{ id: string; storyId: string; text: string }>>;
  slseounRuntime(): { demoted: Set<string> };
};

/** A Map-backed Storage with key(i) and length, which the auth key scan needs. */
function fakeStorage() {
  const store = new Map<string, string>();
  const localStorage = {
    get length() {
      return store.size;
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
  };
  return { store, localStorage };
}

function load(configText: string | null = JSON.stringify({ dataEnv: "development" })) {
  const source = readFileSync("src/components/patches/patch-comments-client.js", "utf8");
  assert.equal(source.split(START).length, 2, "one start-up block to swap");
  // The page never finishes loading in the VM, so main() stays queued and never runs.
  const hooked = source.replace(
    START,
    `  window.__spec = { readConfig, configEnv, ensureClaimed, apiWriteAsUser, loadState, courierItems, slseounRuntime };\n${START}`,
  );

  const { store, localStorage } = fakeStorage();
  const configElement = configText === null ? null : { textContent: configText };
  const document = {
    cookie: "",
    readyState: "loading",
    addEventListener: () => undefined,
    documentElement: { dataset: {} },
    getElementById: (id: string) => (id === "sts-patch-comments-config" ? configElement : null),
  };
  const sent: Sent[] = [];
  const state: { respond: (request: Sent) => Response } = { respond: () => new Response("unset", { status: 599 }) };
  const fetch = async (input: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) => {
    const headers = init.headers ?? {};
    const request: Sent = {
      url: String(input),
      method: init.method ?? "GET",
      authorization: Object.entries(headers).find(([name]) => name.toLowerCase() === "authorization")?.[1] ?? null,
      body: init.body ? JSON.parse(init.body) : undefined,
    };
    sent.push(request);
    return state.respond(request);
  };
  const window: Record<string, unknown> = { localStorage, setTimeout, clearTimeout, atob, fetch };
  runInNewContext(hooked, {
    window, document, localStorage, fetch, setTimeout, clearTimeout, atob, btoa, AbortController, URL, URLSearchParams, Response, Map, Set, JSON, Promise, Error, Object, Math, Date, Number, String, Array,
  });
  return { client: window.__spec as Client, window, store, sent, state };
}

const marked = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json", "x-slseoun-api": "1" },
});

const unmarked = () => new Response("<html>error 1102</html>", { status: 503 });

function jwt(uid: string, ref = REF) {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "ES256" })}.${part({ sub: uid, iss: `https://${ref}.supabase.co/auth/v1`, is_anonymous: true })}.sig`;
}

function storedSession(uid = USER, { expired = false, refresh = "refresh-1" } = {}) {
  return JSON.stringify({
    access_token: jwt(uid),
    refresh_token: refresh,
    expires_at: Math.floor(Date.now() / 1000) + (expired ? -3600 : 3600),
    user: { id: uid },
  });
}

function newSession(uid: string, ref = REF) {
  return {
    access_token: jwt(uid, ref),
    refresh_token: `refresh-${uid.slice(0, 4)}`,
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: { id: uid },
  };
}

function noBearer(sent: Sent[], label: string) {
  assert.deepEqual(sent.filter((request) => request.authorization !== null).map((request) => request.url), [], `${label}: no Authorization header`);
  assert.ok(sent.every((request) => request.url.startsWith("/api/")), `${label}: only same-origin /api calls`);
}

const urls = (sent: Sent[]) => sent.map((request) => request.url);

/** Objects made inside the VM have its own prototypes: compare them as JSON. */
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

async function main() {
  // Stored Supabase session, not claimed yet: one claim with both tokens, then writes with the cookie only.
  {
    const { client, store, sent, state } = load();
    store.set(AUTH_KEY, storedSession(USER, { expired: true }));
    state.respond = (request) => request.url === "/api/auth/claim" ? marked({ v: 1, uid: USER, created: false, session: null }) : marked({ ok: true });
    const write = await client.apiWriteAsUser("/api/write/comments", { method: "POST", body: {} });
    assert.deepEqual(urls(sent), ["/api/auth/claim", "/api/write/comments"]);
    assert.deepEqual(sent[0].body, { access_token: jwt(USER), refresh_token: "refresh-1" }, "WP0 claim body: access and refresh token");
    assert.equal(write.session.user?.id, USER, "the writer is the claimed uid");
    sent.length = 0;
    await client.apiWriteAsUser("/api/write/comment-likes?id=1", { method: "PUT" });
    assert.deepEqual(urls(sent), ["/api/write/comment-likes?id=1"], "claimed once");
    assert.equal(JSON.parse(store.get(AUTH_KEY) ?? "{}").user?.id, USER, "the Supabase session stays");
    assert.equal(JSON.parse(store.get(MARKER_KEY) ?? "{}").uid, USER);
    noBearer(sent, "stored session");
  }

  // A stored session without a refresh token sends the access token alone.
  {
    const { client, store, sent, state } = load();
    store.set(AUTH_KEY, JSON.stringify({ access_token: jwt(USER), user: { id: USER } }));
    state.respond = (request) => request.url === "/api/auth/claim" ? marked({ v: 1, uid: USER, created: false }) : marked({ ok: true });
    await client.apiWriteAsUser("/api/write/comments", { method: "POST", body: {} });
    assert.deepEqual(sent[0].body, { access_token: jwt(USER) });
  }

  // No Supabase session: claim {}; the Worker signs up and the session is stored under the key made from iss.
  {
    const { client, store, sent, state } = load();
    const session = newSession(NEW_USER);
    state.respond = (request) => request.url === "/api/auth/claim" ? marked({ v: 1, uid: NEW_USER, created: true, session }) : marked({ ok: true });
    const write = await client.apiWriteAsUser("/api/write/comments", { method: "POST", body: {} });
    assert.deepEqual(sent[0].body, {}, "a new user posts no token");
    assert.deepEqual(JSON.parse(store.get(AUTH_KEY) ?? "{}"), session, "supabase-js v2 shape under sb-<ref from iss>-auth-token");
    assert.equal(write.session.user?.id, NEW_USER);
    noBearer(sent, "new user");
  }

  // An existing auth key wins over the iss host (supabase-js keeps one key per origin).
  {
    const { client, store, state } = load();
    const existingKey = "sb-zzzzzzzzzzzzzzzzzzzz-auth-token";
    store.set(existingKey, storedSession(USER));
    store.set(`${existingKey}-code-verifier`, "x");
    const refreshed = newSession(USER);
    state.respond = () => marked({ v: 1, uid: USER, created: false, session: refreshed });
    assert.equal(await client.ensureClaimed(), USER);
    assert.deepEqual(JSON.parse(store.get(existingKey) ?? "{}"), refreshed, "a refreshed session replaces the stored one in place");
    assert.equal(store.has(AUTH_KEY), false, "no second key from iss");
    assert.equal(store.get(`${existingKey}-code-verifier`), "x", "only sb-<ref>-auth-token is the auth key");
  }

  // An answered session whose token has no usable iss and no stored key is not stored (the cookie still works).
  {
    const { client, store, state } = load();
    state.respond = () => marked({ v: 1, uid: NEW_USER, created: true, session: { ...newSession(NEW_USER), access_token: "a.b.c" } });
    assert.equal(await client.ensureClaimed(), NEW_USER);
    assert.deepEqual(Array.from(store.keys()), [MARKER_KEY]);
  }

  // No Supabase session and the Worker's sign-up failed: a failed sign-in as today.
  {
    const { client, store, sent, state } = load();
    state.respond = (request) => request.url === "/api/auth/claim" ? marked({ error: "auth_unavailable" }, 503) : marked({ ok: true });
    await assert.rejects(() => client.apiWriteAsUser("/api/write/comments", { method: "POST", body: {} }), (error: { code?: string }) => error.code === "auth_unavailable");
    assert.deepEqual(urls(sent), ["/api/auth/claim"], "no write and no sign-up from the browser");
    assert.equal(store.size, 0);
  }

  // A token claim refused as token_invalid (past the deadline, refresh refused) claims {} once.
  {
    const { client, store, sent, state } = load();
    store.set(AUTH_KEY, storedSession(USER, { expired: true }));
    state.respond = (request) => {
      if (request.url !== "/api/auth/claim") return marked({ ok: 1 });
      return (request.body as Record<string, unknown>).access_token
        ? marked({ error: "token_invalid" }, 401)
        : marked({ v: 1, uid: USER, created: false, session: null });
    };
    const kept = await client.apiWriteAsUser("/api/write/comments", { method: "POST", body: {} });
    assert.deepEqual(kept.result, { ok: 1 });
    assert.deepEqual(sent.map((request) => [request.url, request.body]), [
      ["/api/auth/claim", { access_token: jwt(USER), refresh_token: "refresh-1" }],
      ["/api/auth/claim", {}],
      ["/api/write/comments", {}],
    ], "a valid cookie keeps the same uid");
    assert.equal(JSON.parse(store.get(AUTH_KEY) ?? "{}").user?.id, USER, "kept: the stored session is not touched");
    noBearer(sent, "refused token, kept");
  }
  {
    const { client, store, sent, state } = load();
    store.set(AUTH_KEY, storedSession(USER, { expired: true }));
    const session = newSession(NEW_USER);
    state.respond = (request) => {
      if (request.url !== "/api/auth/claim") return marked({ ok: 2 });
      return (request.body as Record<string, unknown>).access_token
        ? marked({ error: "token_invalid" }, 401)
        : marked({ v: 1, uid: NEW_USER, created: true, session });
    };
    const signedUp = await client.apiWriteAsUser("/api/write/comments", { method: "POST", body: {} });
    assert.equal(signedUp.session.user?.id, NEW_USER, "no cookie: a new user, as supabase-js signing in anew");
    assert.deepEqual(JSON.parse(store.get(AUTH_KEY) ?? "{}"), session, "the new session takes the existing key");
    assert.equal(urls(sent).filter((url) => url === "/api/auth/claim").length, 2, "{} is sent once");
  }
  // Another refusal (or an outage) is not retried with {}; invalid resends the access token alone once.
  for (const [answer, bodies] of [
    [() => marked({ error: "invalid" }, 400), [{ access_token: jwt(USER), refresh_token: "refresh-1" }, { access_token: jwt(USER) }]],
    [() => marked({ error: "auth_unavailable" }, 503), [{ access_token: jwt(USER), refresh_token: "refresh-1" }]],
  ] as const) {
    const { client, store, sent, state } = load();
    store.set(AUTH_KEY, storedSession(USER));
    state.respond = answer;
    await assert.rejects(() => client.apiWriteAsUser("/api/write/comments", { method: "POST", body: {} }));
    assert.deepEqual(urls(sent), bodies.map(() => "/api/auth/claim"));
    assert.deepEqual(sent.map((request) => request.body), bodies);
  }

  // A main Worker before WP-A (CI deploys the patch Worker first) refuses refresh_token as 400 invalid:
  // the access token alone is resent once, and its token_invalid still claims {} once.
  for (const [label, accessAlone, expected] of [
    ["claimed", () => marked({ v: 1, uid: USER, created: false, session: null }), [{ access_token: jwt(USER), refresh_token: "refresh-1" }, { access_token: jwt(USER) }]],
    ["refused", () => marked({ error: "token_invalid" }, 401), [{ access_token: jwt(USER), refresh_token: "refresh-1" }, { access_token: jwt(USER) }, {}]],
  ] as const) {
    const { client, store, sent, state } = load();
    store.set(AUTH_KEY, storedSession(USER, { expired: true }));
    state.respond = (request) => {
      if (request.url !== "/api/auth/claim") return marked({ ok: 4 });
      const keys = Object.keys(request.body as Record<string, unknown>);
      if (keys.some((key) => key !== "access_token")) return marked({ error: "invalid" }, 400);
      return keys.length ? accessAlone() : marked({ v: 1, uid: USER, created: false, session: null });
    };
    const write = await client.apiWriteAsUser("/api/write/comments", { method: "POST", body: {} });
    assert.deepEqual(write.result, { ok: 4 }, `${label}: the write goes through`);
    assert.deepEqual(sent.filter((request) => request.url === "/api/auth/claim").map((request) => request.body), expected, label);
    assert.equal(write.session.user?.id, USER, `${label}: the same uid`);
    noBearer(sent, `old main Worker, ${label}`);
  }

  // identity_required claims again and sends once more.
  {
    const { client, store, sent, state } = load();
    store.set(AUTH_KEY, storedSession());
    store.set(MARKER_KEY, JSON.stringify({ uid: USER }));
    let refusals = 1;
    state.respond = (request) => {
      if (request.url === "/api/auth/claim") return marked({ v: 1, uid: USER, created: false, session: null });
      if (refusals-- > 0) return marked({ error: "identity_required" }, 401);
      return marked({ ok: 2 });
    };
    const write = await client.apiWriteAsUser("/api/write/comments", { method: "POST", body: {} });
    assert.deepEqual(write.result, { ok: 2 });
    assert.deepEqual(urls(sent), ["/api/write/comments", "/api/auth/claim", "/api/write/comments"]);
    noBearer(sent, "identity_required");
  }
  // identity_required with no stored session claims {} (the static client signs up right away, as today).
  {
    const { client, store, sent, state } = load();
    store.set(MARKER_KEY, JSON.stringify({ uid: USER }));
    let refusals = 1;
    state.respond = (request) => {
      if (request.url === "/api/auth/claim") return marked({ v: 1, uid: NEW_USER, created: true, session: newSession(NEW_USER) });
      if (refusals-- > 0) return marked({ error: "identity_required" }, 401);
      return marked({ ok: 3 });
    };
    const write = await client.apiWriteAsUser("/api/write/comments", { method: "POST", body: {} });
    assert.equal(write.session.user?.id, NEW_USER);
    assert.deepEqual(sent[1].body, {});
  }

  // Legacy signals and token errors are outages: no token path, no resend, no demotion.
  for (const [label, respond] of [
    ["an unmarked claim answer", (request: Sent) => request.url === "/api/auth/claim" ? unmarked() : marked({ ok: true })],
    ["a legacy claim answer", (request: Sent) => request.url === "/api/auth/claim" ? marked({ error: "surface_legacy", reason: "flag" }, 409) : marked({ ok: true })],
  ] as const) {
    const { client, store, sent, state } = load();
    store.set(AUTH_KEY, storedSession());
    state.respond = respond;
    await assert.rejects(() => client.apiWriteAsUser("/api/write/comments", { method: "POST", body: {} }), (error: { code?: string }) => error.code === "unavailable", label);
    assert.deepEqual(urls(sent), ["/api/auth/claim"], `${label}: no write`);
    assert.equal(client.slseounRuntime().demoted.size, 0, `${label}: nothing demoted`);
  }
  for (const [label, respond, code] of [
    ["an unmarked platform error page", unmarked, "unavailable"],
    ["the router's legacy signal", () => marked({ error: "surface_legacy", reason: "flag" }, 409), "unavailable"],
    ["token_invalid from a route", () => marked({ error: "token_invalid" }, 401), "token_invalid"],
    ["token_expired from a route", () => marked({ error: "token_expired" }, 401), "token_expired"],
  ] as const) {
    const { client, store, sent, state } = load();
    store.set(AUTH_KEY, storedSession());
    store.set(MARKER_KEY, JSON.stringify({ uid: USER }));
    state.respond = respond;
    await assert.rejects(() => client.apiWriteAsUser("/api/write/comments", { method: "POST", body: {} }), (error: { code?: string; legacy?: unknown }) => (
      error.code === code && error.legacy === undefined
    ), label);
    assert.deepEqual(urls(sent), ["/api/write/comments"], `${label}: sent once`);
    assert.equal(client.slseounRuntime().demoted.size, 0, `${label}: nothing demoted`);
    noBearer(sent, label);
  }

  // The thread read: the personal overlay with the cookie, never a bearer, never a sign-up.
  {
    const { client, store, sent, state } = load();
    store.set(AUTH_KEY, storedSession());
    state.respond = (request) => {
      if (request.url.startsWith("/api/read/engagement")) return marked({ v: 1, threads: { "sts2-patch:0.1": [{ id: "c1", like_count: 1 }] } });
      if (request.url === "/api/auth/claim") return marked({ v: 1, uid: USER, created: false, session: null });
      return marked({ v: 1, commentLikes: { "sts2-patch:0.1": ["c1"] } });
    };
    const loaded = await client.loadState("sts2-patch:0.1");
    assert.equal(loaded.userId, USER);
    assert.deepEqual([...loaded.liked], ["c1"]);
    assert.deepEqual(urls(sent), ["/api/read/engagement?threads=sts2-patch:0.1", "/api/auth/claim", "/api/me/engagement?threads=sts2-patch:0.1"]);
    noBearer(sent, "thread read");
  }
  {
    const { client, store, sent, state } = load();
    store.set(MARKER_KEY, JSON.stringify({ uid: USER }));
    state.respond = (request) => request.url.startsWith("/api/read/")
      ? marked({ v: 1, threads: { "sts2-patch:0.1": [{ id: "c1", like_count: 0 }] } })
      : marked({ v: 1, commentLikes: { "sts2-patch:0.1": [] } });
    const loaded = await client.loadState("sts2-patch:0.1");
    assert.equal(loaded.userId, USER, "a claimed uid without a Supabase session is me");
    assert.equal(urls(sent).includes("/api/auth/claim"), false, "already claimed");
  }
  {
    const { client, store, sent, state } = load();
    store.set(AUTH_KEY, storedSession(USER, { expired: true }));
    state.respond = (request) => {
      if (request.url.startsWith("/api/read/")) return marked({ v: 1, threads: { "sts2-patch:0.1": [{ id: "c1", like_count: 0 }] } });
      if (request.url === "/api/auth/claim") return marked({ error: "token_invalid" }, 401);
      return marked({ v: 1, commentLikes: {} });
    };
    const loaded = await client.loadState("sts2-patch:0.1");
    assert.equal(loaded.comments.length, 1, "the comments still show");
    assert.deepEqual([...loaded.liked], [], "hearts stay empty");
    assert.deepEqual(sent.filter((request) => request.url === "/api/auth/claim").map((request) => request.body), [
      { access_token: jwt(USER), refresh_token: "refresh-1" },
    ], "a read never claims {}: viewing never makes a user");
  }
  {
    const { client, sent, state } = load();
    state.respond = () => marked({ v: 1, threads: { "sts2-patch:0.1": [] } });
    const loaded = await client.loadState("sts2-patch:0.1");
    assert.equal(loaded.userId, null);
    assert.deepEqual(urls(sent), ["/api/read/engagement?threads=sts2-patch:0.1"], "no user: no claim, no me read");
  }
  // A thread read the api cannot answer is an outage (renderUnavailable), never another path.
  for (const [label, respond] of [
    ["no marker", unmarked],
    ["legacy signal", () => marked({ error: "surface_legacy", reason: "flag" }, 409)],
    ["another version", () => marked({ v: 2, threads: {} })],
    ["no thread in the answer", () => marked({ v: 1, threads: {} })],
  ] as const) {
    const { client, sent, state } = load();
    state.respond = respond;
    await assert.rejects(() => client.loadState("sts2-patch:0.1"), label);
    assert.equal(sent.length, 1, `${label}: one read`);
    assert.equal(client.slseounRuntime().demoted.size, 0, `${label}: nothing demoted`);
  }
  {
    const { client, sent } = load();
    await assert.rejects(() => client.loadState("bad key with spaces"), "a key outside the api rule is unavailable");
    assert.equal(sent.length, 0);
  }

  // The page config: only the data env; nothing disables the client.
  {
    assert.deepEqual(plain(load().client.readConfig()), { dataEnv: "development" });
    assert.equal(load().client.configEnv(load().client.readConfig()), "development");
    for (const [label, text] of [["no config", null], ["broken config", "{"], ["null config", "null"]] as const) {
      const { client } = load(text);
      assert.deepEqual(plain(client.readConfig()), {}, label);
      assert.equal(client.configEnv(client.readConfig()), "production", `${label}: the production data env`);
    }
    assert.equal(load().client.configEnv({ supabaseEnv: "development" }), "production", "the old key is not read");
  }

  // The courier: the shared nav snapshot of this data env, or nothing.
  {
    const snapshot = { v: 1, env: "development", fetchedAt: "", latest: {}, weekly: {}, courier: [{ id: "m1", storyId: "sts2-patch:0.1", text: "hi", createdAt: "" }] };
    {
      const { client, sent, state } = load();
      state.respond = () => marked(snapshot);
      assert.deepEqual(plain(await client.courierItems(client.readConfig())), [{ id: "m1", storyId: "sts2-patch:0.1", text: "hi" }]);
      assert.deepEqual(urls(sent), ["/api/read/nav"]);
      noBearer(sent, "courier");
    }
    for (const [label, respond] of [
      ["another data env", () => marked({ ...snapshot, env: "production" })],
      ["no marker", unmarked],
      ["legacy signal", () => marked({ error: "surface_legacy", reason: "flag" }, 409)],
      ["another shape", () => marked({ v: 1, env: "development" })],
    ] as const) {
      const { client, sent, state } = load();
      state.respond = respond;
      assert.deepEqual(plain(await client.courierItems(client.readConfig())), [], `${label}: an empty courier`);
      assert.deepEqual(urls(sent), ["/api/read/nav"], `${label}: no other request`);
      assert.equal(client.slseounRuntime().demoted.size, 0, `${label}: nothing demoted`);
    }
    {
      const { client, window, state } = load();
      state.respond = () => marked(snapshot);
      await client.courierItems(client.readConfig());
      const runtime = window.__slseounRuntime as { nav?: { promise: Promise<unknown> }; demoted: Set<string> };
      assert.ok(runtime.nav?.promise, "the snapshot promise is shared on window for the bundles");
      assert.ok(runtime.demoted instanceof Set, "the shared object keeps the shape src/lib/runtime-flags.ts declares");
    }
  }

  // The build bakes only the data env into the page config.
  {
    const source = readFileSync("scripts/build-patch-worker.tsx", "utf8");
    const config = source.match(/id="sts-patch-comments-config" type="application\/json">\$\{escapeInlineJson\(\{([\s\S]*?)\}\)\}<\/script>/)?.[1];
    assert.ok(config, "the config script is found");
    assert.equal(config.trim(), 'dataEnv: process.env.NEXT_PUBLIC_SUPABASE_ENV ?? "production",', "only dataEnv");
  }

  console.log("api-identity-patch-client spec passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

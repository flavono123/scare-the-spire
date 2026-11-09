/**
 * The static patch comments client (src/components/patches/patch-comments-client.js)
 * follows the step 4 identity mode like src/lib/api-session.ts. The IIFE runs in
 * a VM with a hook that exposes the functions under test; its start-up never fires.
 * Usage: tsx scripts/api-identity-patch-client.spec.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const USER = "4f1c2a7e-9b3d-4c5e-8f60-1a2b3c4d5e6f";
const NEW_USER = "9d8c7b6a-5f4e-4d3c-8b2a-112233445566";
const CONFIG = { supabaseUrl: "https://abcdefghijklmnopqrst.supabase.co", supabaseAnonKey: "sb_publishable_test", supabaseEnv: "development" };
const AUTH_KEY = "sb-abcdefghijklmnopqrst-auth-token";
const START = '  if (document.readyState === "loading") {';

type Sent = { url: string; method: string; authorization: string | null; body: unknown };
type Client = {
  identityCookieMode(): boolean;
  apiWriteAsUser(config: unknown, path: string, init: Record<string, unknown>): Promise<{ result: unknown; session: { user?: { id?: string }; access_token?: string } }>;
  loadApiState(config: unknown, threadKey: string): Promise<{ userId: string | null; liked: Set<string> } | null>;
  surfacePath(group: string): "legacy" | "api";
};

function load(pageConfig: unknown = null) {
  const source = readFileSync("src/components/patches/patch-comments-client.js", "utf8");
  assert.equal(source.split(START).length, 2, "one start-up block to swap");
  // The page never finishes loading in the VM, so main() stays queued and never runs.
  const hooked = source.replace(START, `  window.__spec = { identityCookieMode, apiWriteAsUser, loadApiState, surfacePath };\n${START}`);

  const store = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
  };
  const configElement = pageConfig === null ? null : { textContent: JSON.stringify(pageConfig) };
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
    const request: Sent = {
      url: String(input),
      method: init.method ?? "GET",
      authorization: init.headers?.Authorization ?? null,
      body: init.body ? JSON.parse(init.body) : undefined,
    };
    sent.push(request);
    return state.respond(request);
  };
  const window: Record<string, unknown> = { localStorage, setTimeout, clearTimeout, atob, fetch };
  runInNewContext(hooked, {
    window, document, localStorage, fetch, setTimeout, clearTimeout, atob, btoa, AbortController, URL, URLSearchParams, Response, Map, Set, JSON, Promise, Error, Object, Math, Date, Number, String, Array,
  });
  return { client: window.__spec as Client, document, store, sent, state };
}

const marked = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json", "x-slseoun-api": "1" },
});

function liveSession(uid = USER) {
  return JSON.stringify({ access_token: `token-${uid}`, refresh_token: "r", expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: uid } });
}

async function main() {
  // Signal off: today's bearer token write.
  {
    const { client, document, store, sent, state } = load();
    document.cookie = "slseoun_rf=v1.comments";
    store.set(AUTH_KEY, liveSession());
    state.respond = () => marked({ ok: true });
    assert.equal(client.identityCookieMode(), false);
    const write = await client.apiWriteAsUser(CONFIG, "/api/write/comments", { method: "POST", body: {} });
    assert.deepEqual(sent.map((request) => [request.url, request.authorization]), [["/api/write/comments", `Bearer token-${USER}`]], "no claim, bearer as today");
    assert.equal(write.session.user?.id, USER);
  }

  // Cookie mode: claim once with the stored token, then writes without a bearer.
  {
    const { client, document, store, sent, state } = load();
    document.cookie = "slseoun_idm=cookie";
    store.set(AUTH_KEY, liveSession());
    state.respond = (request) => request.url === "/api/auth/claim" ? marked({ v: 1, uid: USER, created: false, session: null }) : marked({ ok: true });
    const write = await client.apiWriteAsUser(CONFIG, "/api/write/comments", { method: "POST", body: {} });
    assert.deepEqual(sent.map((request) => [request.url, request.authorization]), [["/api/auth/claim", null], ["/api/write/comments", null]]);
    assert.deepEqual(sent[0].body, { access_token: `token-${USER}` });
    assert.equal(write.session.user?.id, USER, "the writer is the claimed uid");
    sent.length = 0;
    await client.apiWriteAsUser(CONFIG, "/api/write/comment-likes?id=1", { method: "PUT" });
    assert.deepEqual(sent.map((request) => request.url), ["/api/write/comment-likes?id=1"], "claimed once");
    assert.ok(store.get(AUTH_KEY), "the Supabase session stays");
  }

  // Cookie mode, no Supabase session: the Worker signs up and the session is stored for supabase-js.
  {
    const { client, document, store, sent, state } = load();
    document.cookie = "slseoun_idm=cookie";
    const session = { access_token: "a.b.c", refresh_token: "r2", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user: { id: NEW_USER } };
    state.respond = (request) => request.url === "/api/auth/claim" ? marked({ v: 1, uid: NEW_USER, created: true, session }) : marked({ ok: true });
    const write = await client.apiWriteAsUser(CONFIG, "/api/write/comments", { method: "POST", body: {} });
    assert.deepEqual(sent[0].body, {}, "a new user posts no token");
    assert.equal(sent[1].authorization, null);
    assert.equal(JSON.parse(store.get(AUTH_KEY) ?? "{}").user?.id, NEW_USER, "same uid in localStorage as in the cookie");
    assert.equal(write.session.user?.id, NEW_USER);
  }

  // Cookie mode, no Supabase session, the Worker's sign-up failed: a failed sign-in as today.
  {
    const { client, document, store, sent, state } = load();
    document.cookie = "slseoun_idm=cookie";
    state.respond = (request) => request.url === "/api/auth/claim" ? marked({ error: "auth_unavailable" }, 503) : marked({ ok: true });
    await assert.rejects(() => client.apiWriteAsUser(CONFIG, "/api/write/comments", { method: "POST", body: {} }), (error: { code?: string }) => error.code === "auth_unavailable");
    assert.deepEqual(sent.map((request) => request.url), ["/api/auth/claim"], "no write and no sign-up from the browser");
    assert.equal(store.get(AUTH_KEY), undefined);
    assert.equal(store.get("slseoun-identity"), undefined);
  }

  // identity_required claims again and resends once; a legacy claim answer goes back to tokens.
  {
    const { client, document, store, sent, state } = load();
    document.cookie = "slseoun_idm=cookie";
    store.set(AUTH_KEY, liveSession());
    store.set("slseoun-identity", JSON.stringify({ uid: USER }));
    let refusals = 1;
    state.respond = (request) => {
      if (request.url === "/api/auth/claim") return marked({ v: 1, uid: USER, created: false, session: null });
      if (refusals-- > 0) return marked({ error: "identity_required" }, 401);
      return marked({ ok: 2 });
    };
    const write = await client.apiWriteAsUser(CONFIG, "/api/write/comments", { method: "POST", body: {} });
    assert.deepEqual(write.result, { ok: 2 });
    assert.deepEqual(sent.map((request) => request.url), ["/api/write/comments", "/api/auth/claim", "/api/write/comments"]);

    store.delete("slseoun-identity");
    sent.length = 0;
    state.respond = (request) => request.url === "/api/auth/claim" ? marked({ error: "surface_legacy", reason: "flag" }, 409) : marked({ ok: 3 });
    const rolledBack = await client.apiWriteAsUser(CONFIG, "/api/write/comments", { method: "POST", body: {} });
    assert.deepEqual(rolledBack.result, { ok: 3 });
    assert.deepEqual(sent.map((request) => [request.url, request.authorization]), [["/api/auth/claim", null], ["/api/write/comments", `Bearer token-${USER}`]], "token path after a legacy claim answer");

    store.set("slseoun-identity", JSON.stringify({ uid: USER }));
    sent.length = 0;
    state.respond = (request) => request.authorization ? marked({ ok: 4 }) : marked({ error: "token_invalid" }, 401);
    const tokenRoute = await client.apiWriteAsUser(CONFIG, "/api/write/comments", { method: "POST", body: {} });
    assert.deepEqual(tokenRoute.result, { ok: 4 }, "token_invalid in cookie mode is redone with the token");
    assert.equal(sent.length, 2);

    // A refused claim (stored token past the deadline, HS256 without the secret) writes on the token path.
    store.delete("slseoun-identity");
    sent.length = 0;
    state.respond = (request) => {
      if (request.url === "/api/auth/claim") return marked({ error: "token_invalid" }, 401);
      return request.authorization ? marked({ ok: 5 }) : marked({ error: "identity_required" }, 401);
    };
    const refused = await client.apiWriteAsUser(CONFIG, "/api/write/comments", { method: "POST", body: {} });
    assert.deepEqual(refused.result, { ok: 5 });
    assert.deepEqual(sent.map((request) => [request.url, request.authorization]), [["/api/auth/claim", null], ["/api/write/comments", `Bearer token-${USER}`]], "refused claim: one write, with the bearer");

    store.set("slseoun-identity", JSON.stringify({ uid: USER }));
    sent.length = 0;
    const reclaimRefused = await client.apiWriteAsUser(CONFIG, "/api/write/comments", { method: "POST", body: {} });
    assert.deepEqual(reclaimRefused.result, { ok: 5 });
    assert.deepEqual(sent.map((request) => [request.url, request.authorization]), [["/api/write/comments", null], ["/api/auth/claim", null], ["/api/write/comments", `Bearer token-${USER}`]], "cookie gone and the re-claim refused");
  }

  // The personal overlay reads with the cookie in cookie mode, with the token otherwise.
  for (const cookieMode of [false, true]) {
    const { client, document, store, sent, state } = load();
    document.cookie = cookieMode ? "slseoun_rf=v1.comments; slseoun_idm=cookie" : "slseoun_rf=v1.comments";
    store.set(AUTH_KEY, liveSession());
    state.respond = (request) => {
      if (request.url.startsWith("/api/read/engagement")) return marked({ v: 1, threads: { "sts2-patch:0.1": [{ id: "c1", like_count: 1 }] } });
      if (request.url === "/api/auth/claim") return marked({ v: 1, uid: USER, created: false, session: null });
      return marked({ v: 1, commentLikes: { "sts2-patch:0.1": ["c1"] } });
    };
    const loaded = await client.loadApiState(CONFIG, "sts2-patch:0.1");
    assert.equal(loaded?.userId, USER);
    assert.deepEqual([...(loaded?.liked ?? [])], ["c1"]);
    const me = sent.find((request) => request.url.startsWith("/api/me/"));
    assert.equal(me?.authorization ?? null, cookieMode ? null : `Bearer token-${USER}`, cookieMode ? "cookie mode: no bearer" : "signal off: bearer as today");
    assert.equal(sent.some((request) => request.url === "/api/auth/claim"), cookieMode);
  }

  // No slseoun_rf cookie: the build-time default in the page config (NEXT_PUBLIC_API_PATH_DEFAULT,
  // same rule as src/lib/runtime-flags.ts); a cookie or a demotion decides as before.
  for (const [label, pageConfig, expected] of [
    ["no config", null, "legacy"],
    ["unset", { ...CONFIG, apiPathDefault: "" }, "legacy"],
    ["legacy", { ...CONFIG, apiPathDefault: "legacy" }, "legacy"],
    ["not exact", { ...CONFIG, apiPathDefault: "API" }, "legacy"],
    ["api", { ...CONFIG, apiPathDefault: "api" }, "api"],
  ] as const) {
    const { client, document } = load(pageConfig);
    assert.equal(client.surfacePath("comments"), expected, `no cookie, ${label}`);
    document.cookie = "slseoun_rf=v1.nav";
    assert.equal(client.surfacePath("comments"), "legacy", `a cookie without the group, ${label}`);
    document.cookie = "slseoun_rf=v1.comments";
    assert.equal(client.surfacePath("comments"), "api", `a cookie with the group, ${label}`);
  }
  {
    const { client, document } = load({ ...CONFIG, apiPathDefault: "api" });
    document.cookie = "other=1";
    assert.equal(client.surfacePath("stories"), "api", "another cookie is not slseoun_rf");
    document.cookie = "slseoun_rf=v2.stories";
    assert.equal(client.surfacePath("stories"), "legacy", "an unknown cookie version is legacy, not the default");
  }
  // Built with apiPathDefault api (direct writes closed): a write no router answered, or one that got the
  // legacy signal, is an outage that keeps the group on the api path and is never redone on legacy.
  for (const [label, respond] of [
    ["an unmarked platform error page", () => new Response("<html>error 1102</html>", { status: 503 })],
    ["the router's legacy signal", () => marked({ error: "surface_legacy", reason: "flag" }, 409)],
  ] as const) {
    for (const apiPathDefault of ["api", ""]) {
      const { client, document, store, state } = load({ ...CONFIG, apiPathDefault });
      document.cookie = "slseoun_rf=v1.comments";
      store.set(AUTH_KEY, liveSession());
      state.respond = respond;
      const error = await client.apiWriteAsUser(CONFIG, "/api/write/comments", { method: "POST", body: {} }).then(() => null, (failure) => failure);
      if (apiPathDefault === "api") {
        assert.equal(error?.legacy, undefined, `${label}: not a legacy signal`);
        assert.equal(error?.code, "unavailable", `${label}: unavailable`);
        assert.equal(client.surfacePath("comments"), "api", `${label}: the group stays on api`);
      } else {
        assert.equal(error?.legacy, true, `${label}: a legacy signal today`);
        assert.equal(client.surfacePath("comments"), "legacy", `${label}: demoted today`);
      }
    }
  }
  {
    const source = readFileSync("scripts/build-patch-worker.tsx", "utf8");
    assert.match(source, /apiPathDefault: process\.env\.NEXT_PUBLIC_API_PATH_DEFAULT \?\? ""/, "page config carries the build default");
    assert.match(source, /"process\.env\.NEXT_PUBLIC_API_PATH_DEFAULT": JSON\.stringify\(process\.env\.NEXT_PUBLIC_API_PATH_DEFAULT \?\? ""\)/, "bundles get the build default");
  }

  console.log("api-identity-patch-client spec passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

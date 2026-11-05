/**
 * The Worker's PostgREST adapter (workers/api/supabase-rest.ts) and the /api
 * response helpers (workers/api/http.ts).
 * Usage: tsx scripts/api-supabase-rest.spec.ts
 */
import assert from "node:assert/strict";

import { apiError, jsonResponse, withoutBody } from "../workers/api/http";
import {
  isUpstreamFailure,
  postgrest,
  supabaseApiConfig,
  supabaseIssuer,
  type Fetcher,
} from "../workers/api/supabase-rest";

const config = { url: "https://project.supabase.co", key: "sb_publishable_test", dataEnv: "development" as const };

type Seen = { url: string; method: string; headers: Headers; body: string | undefined };

function recording(respond: (seen: Seen) => Response | Promise<Response>) {
  const calls: Seen[] = [];
  const fetcher: Fetcher = async (input, init) => {
    const seen = {
      url: String(input),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: typeof init?.body === "string" ? init.body : undefined,
    };
    calls.push(seen);
    return respond(seen);
  };
  return { calls, fetcher };
}

async function main() {
  // Config validation.
  assert.deepEqual(
    supabaseApiConfig({ API_SUPABASE_URL: "https://project.supabase.co/", API_SUPABASE_KEY: "k", API_DATA_ENV: "production" }),
    { url: "https://project.supabase.co", key: "k", dataEnv: "production" },
  );
  assert.equal(supabaseApiConfig({}), null);
  assert.equal(supabaseApiConfig({ API_SUPABASE_URL: "https://evil.example", API_SUPABASE_KEY: "k", API_DATA_ENV: "production" }), null);
  assert.equal(supabaseApiConfig({ API_SUPABASE_URL: "https://project.supabase.co", API_SUPABASE_KEY: "k", API_DATA_ENV: "staging" }), null);
  assert.equal(supabaseApiConfig({ API_SUPABASE_URL: "https://project.supabase.co", API_SUPABASE_KEY: "", API_DATA_ENV: "production" }), null);
  assert.equal(supabaseIssuer(config), "https://project.supabase.co/auth/v1");

  // Public read: apikey only, no Authorization.
  {
    const { calls, fetcher } = recording(() => new Response(JSON.stringify([{ created_at: "2026-11-05T00:00:00+00:00" }]), {
      headers: { "content-range": "0-0/*" },
    }));
    const query = new URLSearchParams({ select: "created_at", env: "eq.development", order: "created_at.desc", limit: "1" });
    const result = await postgrest<{ created_at: string }[]>(config, { path: "combo_posts", query, fetcher });
    assert.deepEqual(result, { ok: true, status: 200, data: [{ created_at: "2026-11-05T00:00:00+00:00" }], contentRange: "0-0/*" });
    assert.equal(calls[0].url, "https://project.supabase.co/rest/v1/combo_posts?select=created_at&env=eq.development&order=created_at.desc&limit=1");
    assert.equal(calls[0].headers.get("apikey"), "sb_publishable_test");
    assert.equal(calls[0].headers.get("authorization"), null);
    assert.equal(calls[0].method, "GET");
  }

  // User write: token forwarded, Prefer and JSON body set.
  {
    const { calls, fetcher } = recording(() => new Response(JSON.stringify([{ id: "c1" }]), { status: 201 }));
    const result = await postgrest(config, {
      method: "POST",
      path: "comments",
      body: { content: "hi" },
      token: "user.jwt.token",
      prefer: ["return=representation"],
      fetcher,
    });
    assert.equal(result.ok, true);
    assert.equal(calls[0].headers.get("authorization"), "Bearer user.jwt.token");
    assert.equal(calls[0].headers.get("prefer"), "return=representation");
    assert.equal(calls[0].headers.get("content-type"), "application/json");
    assert.equal(calls[0].body, JSON.stringify({ content: "hi" }));
  }

  // RPC path and an empty 204 body.
  {
    const { calls, fetcher } = recording(() => new Response(null, { status: 204 }));
    const result = await postgrest(config, { method: "POST", path: "rpc/get_engagement_counts", body: { p_env: "development" }, fetcher });
    assert.deepEqual(result, { ok: true, status: 204, data: null, contentRange: null });
    assert.ok(calls[0].url.endsWith("/rest/v1/rpc/get_engagement_counts"));
  }

  // PostgREST errors keep their code.
  {
    const { fetcher } = recording(() => new Response(JSON.stringify({ code: "42501", message: "denied" }), { status: 403 }));
    const result = await postgrest(config, { method: "DELETE", path: "comments", fetcher });
    assert.deepEqual(result, { ok: false, status: 403, code: "42501", message: "denied" });
    assert.equal(result.ok === false && isUpstreamFailure(result), false);
  }
  {
    const { fetcher } = recording(() => new Response("<html>bad gateway</html>", { status: 502 }));
    const result = await postgrest(config, { path: "comments", fetcher });
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.code, "bad_response");
    assert.equal(result.ok === false && isUpstreamFailure(result), true);
  }
  {
    const { fetcher } = recording(() => new Response("", { status: 503 }));
    const result = await postgrest(config, { path: "comments", fetcher });
    assert.equal(result.ok === false && result.code, "http_503");
  }

  // Timeouts abort the request.
  {
    const fetcher: Fetcher = (_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    });
    const result = await postgrest(config, { path: "comments", fetcher, timeoutMs: 20 });
    assert.equal(result.ok === false && result.code, "timeout");
    assert.equal(result.ok === false && isUpstreamFailure(result), true);
  }

  // Network errors.
  {
    const fetcher: Fetcher = async () => {
      throw new Error("connection refused");
    };
    const result = await postgrest(config, { path: "comments", fetcher });
    assert.equal(result.ok === false && result.code, "network");
  }

  // Paths are restricted to tables and rpc names.
  await assert.rejects(() => postgrest(config, { path: "../auth/v1/admin" }));
  await assert.rejects(() => postgrest(config, { path: "comments?select=*" }));

  // Response helpers.
  {
    const response = jsonResponse({ ok: 1 }, { cacheControl: "public, max-age=60" });
    assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
    assert.equal(response.headers.get("cache-control"), "public, max-age=60");
    assert.equal(response.headers.get("x-robots-tag"), "noindex");
    assert.deepEqual(await response.json(), { ok: 1 });

    const legacy = apiError("surface_legacy");
    assert.equal(legacy.status, 409);
    assert.equal(legacy.headers.get("cache-control"), "no-store");
    assert.deepEqual(await legacy.json(), { error: "surface_legacy" });

    const unavailable = apiError("unavailable");
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.headers.get("retry-after"), "30");

    const head = withoutBody(jsonResponse({ a: 1 }));
    assert.equal(head.body, null);
    assert.equal(head.headers.get("content-type"), "application/json; charset=utf-8");
  }

  console.log("api-supabase-rest spec passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

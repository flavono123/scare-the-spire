/**
 * The Worker's PostgREST adapter (workers/api/supabase-rest.ts) and the /api
 * response helpers (workers/api/http.ts).
 * Usage: tsx scripts/api-supabase-rest.spec.ts
 */
import assert from "node:assert/strict";

import { API_MARKER_HEADER, apiError, jsonResponse, legacyResponse, withoutBody } from "../workers/api/http";
import {
  inWaves,
  isUpstreamFailure,
  postgrest,
  supabaseApiConfig,
  supabaseIssuer,
  type Fetcher,
} from "../workers/api/supabase-rest";

const PROJECT = "https://abcdefghijklmnopqrst.supabase.co";
const config = { url: PROJECT, key: "sb_publishable_test", dataEnv: "development" as const };

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
  const key = "sb_publishable_AbC-123_x";
  assert.deepEqual(
    supabaseApiConfig({ API_SUPABASE_URL: `${PROJECT}//`, API_SUPABASE_KEY: key, API_DATA_ENV: "production" }),
    { url: PROJECT, key, dataEnv: "production" },
    "trailing slashes are stripped",
  );
  assert.deepEqual(
    supabaseApiConfig({ API_SUPABASE_URL: "http://127.0.0.1:54321", API_SUPABASE_KEY: key, API_DATA_ENV: "development" }),
    { url: "http://127.0.0.1:54321", key, dataEnv: "development" },
  );
  assert.equal(supabaseApiConfig({}), null);
  for (const [label, env] of [
    ["other host", { API_SUPABASE_URL: "https://evil.example", API_SUPABASE_KEY: key, API_DATA_ENV: "production" }],
    ["short ref", { API_SUPABASE_URL: "https://project.supabase.co", API_SUPABASE_KEY: key, API_DATA_ENV: "production" }],
    ["http project", { API_SUPABASE_URL: "http://abcdefghijklmnopqrst.supabase.co", API_SUPABASE_KEY: key, API_DATA_ENV: "production" }],
    ["env", { API_SUPABASE_URL: PROJECT, API_SUPABASE_KEY: key, API_DATA_ENV: "staging" }],
    ["empty key", { API_SUPABASE_URL: PROJECT, API_SUPABASE_KEY: "", API_DATA_ENV: "production" }],
    ["secret key", { API_SUPABASE_URL: PROJECT, API_SUPABASE_KEY: "sb_secret_abc", API_DATA_ENV: "production" }],
    ["legacy jwt key", { API_SUPABASE_URL: PROJECT, API_SUPABASE_KEY: "eyJhbGciOiJIUzI1NiJ9.e30.x", API_DATA_ENV: "production" }],
  ] as const) {
    assert.equal(supabaseApiConfig(env), null, label);
  }
  assert.equal(supabaseIssuer(config), `${PROJECT}/auth/v1`);

  // Public read: apikey only, no Authorization.
  {
    const { calls, fetcher } = recording(() => new Response(JSON.stringify([{ created_at: "2026-11-05T00:00:00+00:00" }]), {
      headers: { "content-range": "0-0/*" },
    }));
    const query = new URLSearchParams({ select: "created_at", env: "eq.development", order: "created_at.desc", limit: "1" });
    const result = await postgrest<{ created_at: string }[]>(config, { path: "combo_posts", query, fetcher });
    assert.deepEqual(result, { ok: true, status: 200, data: [{ created_at: "2026-11-05T00:00:00+00:00" }], contentRange: "0-0/*" });
    assert.equal(calls[0].url, `${PROJECT}/rest/v1/combo_posts?select=created_at&env=eq.development&order=created_at.desc&limit=1`);
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
    const { fetcher } = recording(() => new Response(JSON.stringify({
      code: "23514",
      message: "violates check",
      details: "Failing row contains (nick, secret comment, 4f1c2a7e-...)",
    }), { status: 400 }));
    const result = await postgrest(config, { method: "POST", path: "comments", fetcher });
    assert.deepEqual(result, { ok: false, status: 400, code: "23514" }, "row content is not kept");
  }
  {
    const { fetcher } = recording(() => new Response(JSON.stringify({ code: "42501", message: "denied" }), { status: 403 }));
    const result = await postgrest(config, { method: "DELETE", path: "comments", fetcher });
    assert.deepEqual(result, { ok: false, status: 403, code: "42501" });
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

  // inWaves keeps at most `limit` tasks in flight and preserves order.
  {
    let inFlight = 0;
    let peak = 0;
    const tasks = Array.from({ length: 10 }, (_, index) => async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5 + (index % 3)));
      inFlight -= 1;
      return index;
    });
    assert.deepEqual(await inWaves(tasks, 5), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.equal(peak, 5);
    assert.deepEqual(await inWaves([], 5), []);
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

    assert.equal(response.headers.get(API_MARKER_HEADER), "1");
    assert.equal(jsonResponse({}).headers.get("cache-control"), "private, no-store", "private by default");

    const legacy = legacyResponse("no_route");
    assert.equal(legacy.status, 409);
    assert.equal(legacy.headers.get("cache-control"), "private, no-store");
    assert.equal(legacy.headers.get(API_MARKER_HEADER), "1");
    assert.deepEqual(await legacy.json(), { error: "surface_legacy", reason: "no_route" });

    const duplicate = apiError("duplicate");
    assert.equal(duplicate.status, 422, "duplicates never reuse 409");

    const unavailable = apiError("unavailable");
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.headers.get("retry-after"), "30");

    const head = withoutBody(jsonResponse({ a: 1 }));
    assert.equal(head.body, null);
    assert.equal(head.headers.get("content-type"), "application/json; charset=utf-8");
  }

  // Deadline: no call when the endpoint's time is up; otherwise at most the time left.
  {
    const { calls, fetcher } = recording(() => Response.json([]));
    const late = await postgrest(config, { path: "comments", fetcher, deadline: Date.now() + 50 });
    assert.deepEqual(late, { ok: false, status: 0, code: "timeout" });
    assert.equal(calls.length, 0, "a call with under MIN_CALL_MS left is not sent");

    const slow: Fetcher = (_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    });
    const startedAt = Date.now();
    const cut = await postgrest(config, { path: "comments", fetcher: slow, deadline: Date.now() + 300 });
    assert.equal(cut.ok ? "ok" : cut.code, "timeout");
    assert.ok(Date.now() - startedAt < 1000, "the deadline beats the 4 s read timeout");
  }

  // Body cap: counted on the stream, so a missing or lying Content-Length cannot pass.
  {
    const big = "[" + Array.from({ length: 200 }, () => JSON.stringify({ content: "x".repeat(1000) })).join(",") + "]";
    const streamed = () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(big));
        controller.close();
      },
    }));
    const { fetcher } = recording(streamed);
    const capped = await postgrest(config, { path: "comments", fetcher, maxBytes: 50_000 });
    assert.equal(capped.ok ? "ok" : capped.code, "too_large");
    const fits = await postgrest<unknown[]>(config, { path: "comments", fetcher, maxBytes: 1_000_000 });
    assert.ok(fits.ok && Array.isArray(fits.data) && fits.data.length === 200);
    const declared = recording(() => new Response("[]", { headers: { "content-length": "9999999" } }));
    const refused = await postgrest(config, { path: "comments", fetcher: declared.fetcher, maxBytes: 1000 });
    assert.equal(refused.ok ? "ok" : refused.code, "too_large");
  }

  console.log("api-supabase-rest spec passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * The browser client's step 5 behaviour (docs/SUPABASE_EXIT_PLAN.md 7.3 step 5): a write answered
 * 503 write_paused is sent again after Retry-After (the cutover pause), for at most
 * WRITE_PAUSE_MAX_WAIT_MS in all; every other answer behaves as before.
 * Usage: tsx scripts/api-write-retry.spec.ts
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const fakeWindow: Record<string, unknown> = {};
Object.assign(globalThis, { window: fakeWindow, document: { cookie: "slseoun_rf=v1.comments" } });

const marked = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "x-slseoun-api": "1", ...headers } });

async function main() {
  const { ApiUnavailableError, apiFetch, WritePausedError, WRITE_PAUSE_MAX_WAIT_MS } = await import("../src/lib/api-client");
  const realFetch = globalThis.fetch;
  let calls: Array<{ method: string; body: string | null }> = [];
  const answer = (responses: Array<() => Response>) => {
    calls = [];
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ method: init?.method ?? "GET", body: (init?.body as string | undefined) ?? null });
      return (responses.shift() ?? (() => marked({ ok: true }, 200)))();
    }) as typeof fetch;
  };
  const paused = (seconds = "1") => () => marked({ error: "write_paused" }, 503, { "retry-after": seconds });

  answer([paused(), paused()]);
  const started = Date.now();
  assert.deepEqual(await apiFetch("comments", "/api/write/comments", { method: "POST", body: { a: 1 } }), { ok: true });
  assert.equal(calls.length, 3, "sent again after each pause");
  assert.ok(calls.every((entry) => entry.body === "{\"a\":1}"), "the same body every time");
  assert.ok(Date.now() - started >= 1900, "Retry-After is honoured");

  answer([() => marked({ error: "unavailable" }, 503, { "retry-after": "30" })]);
  await assert.rejects(apiFetch("comments", "/api/write/comments", { method: "POST", body: {} }), (error) => (
    error instanceof ApiUnavailableError && !(error instanceof WritePausedError) && error.code === "unavailable"
  ));
  assert.equal(calls.length, 1, "an outage is not resent (unchanged behaviour)");

  answer([paused()]);
  await assert.rejects(apiFetch("comments", "/api/read/engagement-counts"), (error) => error instanceof ApiUnavailableError && !(error instanceof WritePausedError));
  assert.equal(calls.length, 1, "reads are never paused or resent");

  answer([() => marked({ v: 1 }, 200)]);
  await apiFetch("history-runs", "/api/write/history-runs/share", { method: "POST", rawBody: "[{\"id\":\"r\"},{}]", headers: { "X-Slseoun-Row-Length": "10" } });
  assert.equal(calls[0].body, "[{\"id\":\"r\"},{}]", "a raw body goes as is");

  // Exhaustion, with timers fast-forwarded: 10 s each, so the tenth pause passes the 90 s budget.
  const realSetTimeout = globalThis.setTimeout;
  let slept = 0;
  globalThis.setTimeout = ((fn: () => void, ms?: number) => {
    // 10 s timers are the pauses; the 8 s request timeout keeps its real length (never reached).
    if (ms === 10_000) {
      slept += ms;
      return realSetTimeout(fn, 0);
    }
    return realSetTimeout(fn, ms);
  }) as typeof setTimeout;
  try {
    answer(Array.from({ length: 20 }, () => paused("10")));
    await assert.rejects(apiFetch("comments", "/api/write/likes?key=a", { method: "PUT" }), (error) => error instanceof WritePausedError);
    assert.equal(calls.length, WRITE_PAUSE_MAX_WAIT_MS / 10_000 + 1);
    assert.equal(slept, WRITE_PAUSE_MAX_WAIT_MS);
  } finally {
    globalThis.setTimeout = realSetTimeout;
    globalThis.fetch = realFetch;
  }

  // The patch pages' client keeps the same rule; it must still parse.
  execFileSync(process.execPath, ["--check", "src/components/patches/patch-comments-client.js"]);
  console.log("api-write-retry: passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import assert from "node:assert/strict";
import { isDatabaseRejection, submitDefragmentPost } from "../src/lib/defragment-submit";
import { fetchDefragmentBody, overlayBodyForSave, upsertDefragmentBody } from "../src/hooks/use-defragment-bodies";
import { fetchDefragmentPost } from "../src/hooks/use-defragment-posts";
import { ApiUnavailableError } from "../src/lib/api-client";
import type { PostBlock } from "../src/lib/chemical-types";
import { dataEnv } from "../src/lib/data-env";

const post = { id: "post-1" };

function deps(overrides: Partial<Parameters<typeof submitDefragmentPost<typeof post>>[0]> = {}) {
  const calls = { insert: 0, overlay: 0 };
  return {
    calls,
    input: {
      overlayInvalid: false,
      resolveUserId: async () => "user-1",
      insertPost: async () => {
        calls.insert += 1;
        return post;
      },
      saveOverlay: async () => {
        calls.overlay += 1;
      },
      ...overrides,
    },
  };
}

async function run() {
  // A bad overlay stops before anything is written.
  {
    const { calls, input } = deps({ overlayInvalid: true });
    assert.deepEqual(await submitDefragmentPost(input), { kind: "overlay-invalid" });
    assert.deepEqual(calls, { insert: 0, overlay: 0 });
  }

  // Saved post and overlay.
  {
    const { calls, input } = deps();
    assert.deepEqual(await submitDefragmentPost(input), { kind: "saved", post });
    assert.deepEqual(calls, { insert: 1, overlay: 1 });
  }

  // No user, a thrown 5xx, a check violation, and a refused insert all leave no post.
  {
    const { calls, input } = deps({ resolveUserId: async () => null });
    assert.deepEqual(await submitDefragmentPost(input), { kind: "post-failed", rejected: false });
    assert.equal(calls.insert, 0);
  }
  {
    const { calls, input } = deps({
      insertPost: async () => {
        throw { code: "PGRST000", message: "upstream" };
      },
    });
    assert.deepEqual(await submitDefragmentPost(input), { kind: "post-failed", rejected: false });
    assert.equal(calls.overlay, 0);
  }
  {
    const { input } = deps({
      insertPost: async () => {
        throw { code: "23514", message: "violates check" };
      },
    });
    assert.deepEqual(await submitDefragmentPost(input), { kind: "post-failed", rejected: true });
  }
  {
    const { input } = deps({ insertPost: async () => null });
    assert.deepEqual(await submitDefragmentPost(input), { kind: "post-failed", rejected: true });
  }

  // An overlay failure keeps the post, so the panel retries only the overlay.
  {
    const { calls, input } = deps({
      saveOverlay: async () => {
        throw { code: "23514", message: "defragment_bodies_content_text_check" };
      },
    });
    assert.deepEqual(await submitDefragmentPost(input), {
      kind: "overlay-failed",
      post,
      activeUserId: "user-1",
      rejected: true,
    });
    assert.equal(calls.insert, 1);
  }
  {
    const { input } = deps({
      saveOverlay: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    assert.deepEqual(await submitDefragmentPost(input), {
      kind: "overlay-failed",
      post,
      activeUserId: "user-1",
      rejected: false,
    });
  }

  assert.equal(isDatabaseRejection({ code: "23514" }), true);
  assert.equal(isDatabaseRejection({ code: "23505" }), true);
  assert.equal(isDatabaseRejection({ code: "42501" }), true);
  assert.equal(isDatabaseRejection({ code: "PGRST000" }), false);
  assert.equal(isDatabaseRejection(new Error("timed out")), false);
  assert.equal(isDatabaseRejection(null), false);

  // Empty, one character, and valid overlays.
  const text = (value: string) => [{ type: "text", text: value }] as never;
  assert.equal(overlayBodyForSave([]), null);
  assert.equal(overlayBodyForSave(text("x")), "invalid");
  assert.notEqual(overlayBodyForSave(text("xy")), "invalid");

  await apiOnly(text("본문 두 글자 이상"));

  console.log("defragment-submit spec passed");
}

/**
 * Step 6 (docs/supabase-exit/STEP6_PLAN.md WP-T2): the detail and the overlay body
 * read and write only through the Worker. A former legacy signal is the screen's
 * failure, with one request and nothing redone on a direct Supabase path.
 */
async function apiOnly(blocks: PostBlock[]) {
  const fakeStorage = new Map<string, string>();
  Object.assign(globalThis, {
    window: {
      localStorage: {
        getItem: (key: string) => fakeStorage.get(key) ?? null,
        setItem: (key: string, value: string) => void fakeStorage.set(key, value),
        removeItem: (key: string) => void fakeStorage.delete(key),
        key: (index: number) => [...fakeStorage.keys()][index] ?? null,
        get length() {
          return fakeStorage.size;
        },
      },
    },
    // A claimed browser in cookie mode: writes go out without a claim request.
    document: { cookie: "slseoun_idm=cookie" },
  });
  fakeStorage.set("slseoun-identity", JSON.stringify({ uid: "user-1", at: "2026-11-09T00:00:00.000Z" }));

  const requests: { url: string; method: string; body: unknown }[] = [];
  const marked = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-slseoun-api": "1" },
  });
  const stub = (respond: () => Response) => {
    requests.length = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({
        url: String(input),
        method: init?.method ?? "GET",
        body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
      });
      return respond();
    }) as typeof fetch;
  };
  const once = () => {
    assert.equal(requests.length, 1);
    assert.ok(requests[0].url.startsWith("/api/"), `same-origin /api only: ${requests[0].url}`);
  };
  const legacySignal = () => marked({ error: "surface_legacy" }, 409);
  const outages = [legacySignal, () => new Response("<html>", { status: 200 }), () => marked({ error: "upstream" }, 503)];

  // Overlay body: the row of this env, or none.
  stub(() => marked([{ source_service: "combo", source_id: "post-1", user_id: "user-1", nickname: "n", content: [], content_text: "x" }]));
  const body = await fetchDefragmentBody("combo", "post-1");
  assert.equal(body?.source_id, "post-1");
  assert.equal(body?.env, dataEnv, "a row without env takes the data env");
  assert.deepEqual(requests.map((request) => request.url), ["/api/read/defragment-body?service=combo&id=post-1"]);
  stub(() => marked([]));
  assert.equal(await fetchDefragmentBody("combo", "post-1"), null);
  for (const respond of outages) {
    stub(respond);
    await assert.rejects(fetchDefragmentBody("combo", "post-1"), ApiUnavailableError);
    once();
  }

  // A source id outside the row id rule (it went to the legacy read) has no body, without a call.
  stub(() => marked([{ source_service: "history_course", source_id: "run 1", user_id: "user-1" }]));
  for (const id of ["run 1", "run/1", "", "a".repeat(65)]) {
    assert.equal(await fetchDefragmentBody("history_course", id), null, JSON.stringify(id));
  }
  assert.equal(requests.length, 0);

  // Overlay upsert: the row with the data env; a refusal keeps its database code.
  stub(() => marked([{ source_service: "combo", source_id: "post-1", user_id: "user-1" }]));
  assert.equal((await upsertDefragmentBody({ service: "combo", sourceId: "post-1", blocks, nickname: " 닉 ", activeUserId: "user-1" }))?.source_id, "post-1");
  once();
  assert.equal(requests[0].url, "/api/write/defragment-body");
  assert.equal(requests[0].method, "PUT");
  assert.deepEqual(
    (({ env, source_service, source_id, user_id, nickname }) => ({ env, source_service, source_id, user_id, nickname }))(requests[0].body as Record<string, unknown>),
    { env: dataEnv, source_service: "combo", source_id: "post-1", user_id: "user-1", nickname: "닉" },
  );
  stub(() => marked({ error: "check_violation" }, 400));
  const refused = await upsertDefragmentBody({ service: "combo", sourceId: "post-1", blocks, nickname: "닉", activeUserId: "user-1" }).catch((error: unknown) => error);
  assert.equal(isDatabaseRejection(refused), true);
  stub(legacySignal);
  const legacy = await upsertDefragmentBody({ service: "combo", sourceId: "post-1", blocks, nickname: "닉", activeUserId: "user-1" }).catch((error: unknown) => error);
  assert.equal((legacy as { code?: string }).code, "unavailable");
  assert.equal(isDatabaseRejection(legacy), false);
  once();

  // Detail: an outage or a rate limit shows "unavailable"; any other error is "no post".
  stub(() => marked([{ id: "post-1", created_at: "2026-11-09T00:00:00.000Z", title: "제목" }]));
  const post = await fetchDefragmentPost("post-1");
  assert.equal(post?.title, "제목");
  assert.equal(post?.env, dataEnv);
  assert.deepEqual(requests.map((request) => request.url), ["/api/read/toybox-post?service=defragment&id=post-1"]);
  stub(() => marked([]));
  assert.equal(await fetchDefragmentPost("post-1"), null);
  stub(() => marked({ error: "invalid" }, 400));
  assert.equal(await fetchDefragmentPost("not a uuid"), null);
  stub(() => marked({ error: "rate_limited" }, 429));
  await assert.rejects(fetchDefragmentPost("post-1"), (error: { code?: string }) => error.code === "rate_limited");
  for (const respond of outages) {
    stub(respond);
    await assert.rejects(fetchDefragmentPost("post-1"), ApiUnavailableError);
    once();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

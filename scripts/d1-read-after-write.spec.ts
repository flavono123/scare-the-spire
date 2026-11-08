/**
 * Read-after-write of the step-2 D1 shadow (workers/sync/read-after-write.ts, design 5.3): every
 * step-1 write route, through the main Worker, against an in-memory Supabase that also writes the
 * change log, and a node:sqlite D1 from d1/migrations. Then the 1-minute sync on the same log.
 *   pnpm exec tsx scripts/d1-read-after-write.spec.ts
 */
import assert from "node:assert/strict";

import { resetFlagsForTest } from "../workers/api/flags";
import { resetJwtCachesForTest } from "../workers/api/jwt";
import mainWorker from "../workers/main-worker";
import { insertOnly, readAfterWrite, readAfterWriteFromAnswer, RAW_MAX_STATEMENTS } from "../workers/sync/read-after-write";
import { runSync } from "../workers/sync/run-sync";
import { resetSyncFlagForTest } from "../workers/sync/sync-env";
import { mapRow, SUPABASE_TABLES } from "../src/lib/d1-sync/row-mapper";
import { API_SURFACE_GROUPS, pathFlagKey } from "../src/lib/api-surfaces";
import { FakeSupabase } from "./d1-sync/fake-supabase";
import type { Row } from "./d1-sync/fake-postgrest";
import { ENV, TS, U, combo, comment, run, thisOrThat, tournament } from "./d1-sync/fixtures";
import { SqliteD1 } from "./d1-sync/sqlite-d1";

const ORIGIN = "https://testbed.example.workers.dev";
const PROJECT = "https://abcdefghijklmnopqrst.supabase.co";
const ISSUER = `${PROJECT}/auth/v1`;
const USER = "4f1c2a7e-9b3d-4c5e-8f60-1a2b3c4d5e6f";
const OTHER = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";

let checks = 0;
async function check(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    checks += 1;
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const segment = (value: unknown) => base64Url(new TextEncoder().encode(JSON.stringify(value)));

async function makeSigner() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const jwks = { keys: [{ kty: "EC", crv: "P-256", alg: "ES256", use: "sig", kid: "spec-kid", x: publicJwk.x, y: publicJwk.y }] };
  async function token(sub = USER) {
    const now = Math.floor(Date.now() / 1000);
    const input = `${segment({ alg: "ES256", kid: "spec-kid", typ: "JWT" })}.${segment({
      iss: ISSUER, sub, aud: "authenticated", role: "authenticated", exp: now + 3600, iat: now, is_anonymous: true,
    })}`;
    const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, new TextEncoder().encode(input)));
    return `${input}.${base64Url(signature)}`;
  }
  return { jwks, token };
}

class Ctx {
  pending: Promise<unknown>[] = [];
  waitUntil(promise: Promise<unknown>) {
    this.pending.push(promise);
  }
}

type World = {
  d1: SqliteD1;
  rest: FakeSupabase;
  call(path: string, method: string, body?: unknown, user?: string): Promise<{ status: number; body: Record<string, unknown> | unknown[] | null }>;
  sync(): Promise<void>;
  count(sql: string): number;
  serviceCalls(): number;
};

async function world(options: { sync?: "on" | "off" } = {}): Promise<World> {
  resetFlagsForTest();
  resetJwtCachesForTest();
  resetSyncFlagForTest();
  const signer = await makeSigner();
  const rest = new FakeSupabase();
  rest.jwks = signer.jwks;
  globalThis.fetch = rest.handle as typeof fetch;
  const d1 = new SqliteD1();
  for (const group of API_SURFACE_GROUPS) {
    d1.sqlite.prepare("INSERT INTO runtime_flags (key, value, updated_at) VALUES (?1, 'api', '2026-11-08T00:00:00.000Z')").run(pathFlagKey(group));
  }
  d1.sqlite.prepare("INSERT INTO runtime_flags (key, value, updated_at) VALUES ('sync.enabled', ?1, '2026-11-08T00:00:00.000Z')").run(options.sync ?? "on");
  d1.sqlite.prepare("INSERT INTO sync_state (name, low_watermark, high_seen) VALUES ('supabase_in', 0, 0)").run();
  const env = {
    API_RUNTIME_FLAGS: "d1",
    API_SUPABASE_URL: PROJECT,
    API_SUPABASE_KEY: "sb_publishable_test",
    API_SUPABASE_SECRET_KEY: "sb_secret_test",
    API_DATA_ENV: ENV,
    DB: d1,
    ASSETS: { fetch: async () => new Response("asset") },
    PATCH_WORKER: { fetch: async () => new Response("patch") },
  };
  const tokens = new Map<string, string>();
  let lastRun = rest.clock;
  return {
    d1,
    rest,
    async call(path, method, body, user = USER) {
      if (!tokens.has(user)) tokens.set(user, await signer.token(user));
      const ctx = new Ctx();
      const text = body === undefined ? undefined : JSON.stringify(body);
      const init: RequestInit = {
        method,
        headers: {
          authorization: `Bearer ${tokens.get(user)}`,
          "sec-fetch-site": "same-origin",
          // Browsers send a Content-Length for a string body; streamed write routes require it.
          ...(text === undefined ? {} : { "content-type": "application/json", "content-length": String(Buffer.byteLength(text)) }),
        },
        body: text,
      };
      const response = await mainWorker.fetch(new Request(`${ORIGIN}${path}`, init), env as never, ctx);
      const answer = await response.text();
      await Promise.allSettled(ctx.pending);
      return { status: response.status, body: answer ? JSON.parse(answer) : null };
    },
    async sync() {
      lastRun = Math.max(lastRun + 60_000, rest.clock + 30_000);
      const now = lastRun;
      await runSync(env as never, { now: () => now, fetcher: rest.handle as never, log: () => undefined });
    },
    count(sql) {
      return Number(d1.one(sql)?.n ?? 0);
    },
    serviceCalls() {
      return rest.calls.filter((call) => call.apikey === "sb_secret_test").length;
    },
  };
}

async function main() {
  const realFetch = globalThis.fetch;
  const realLog = console.log;
  const lines: string[] = [];
  console.log = (...args: unknown[]) => {
    const line = args.join(" ");
    if (line.startsWith("raw ") || line.startsWith("api ")) lines.push(line);
    else realLog(...args);
  };

  await check("insertOnly turns every mapper upsert into DO NOTHING and keeps child rows", () => {
    for (const table of ["comments", "combo_posts", "favorite_tournament_posts", "runs", "defragment_bodies", "likes", "puzzlebox_best"]) {
      const images: Record<string, Row> = {
        comments: comment(1, "k"),
        combo_posts: combo(1),
        favorite_tournament_posts: tournament(1, 4),
        runs: (() => { const { raw: _raw, ...rest } = run(1); return rest; })(),
        defragment_bodies: { env: ENV, source_service: "combo", source_id: U(1), user_id: U(1), nickname: "닉", content: [], content_text: "x", created_at: TS, updated_at: TS },
        likes: { story_id: "k", user_id: U(2), created_at: TS, env: ENV },
        puzzlebox_best: { env: ENV, game: "connections", board: "7", user_id: U(1), score: 1, perfect: false, run_id: 1, achieved_at: TS, attempts: 1 },
      };
      const mapped = mapRow(table, images[table], { nowMs: 1 });
      assert.ok(mapped.ok, table);
      for (const statement of insertOnly(mapped.ok ? mapped.statements : [])) {
        assert.ok(!/DO UPDATE/.test(statement.sql), `${table}: ${statement.sql}`);
        assert.ok(!/^DELETE/.test(statement.sql), table);
      }
    }
  });

  await check("sync.enabled off: writes answer as before, D1 holds nothing, no service-key call", async () => {
    const w = await world({ sync: "off" });
    const created = await w.call("/api/write/comments", "POST", { threadKey: "sts2-codex:card:bash", nickname: "나", content: "좋은 카드" });
    assert.equal(created.status, 201);
    const post = await w.call("/api/write/toybox-post?service=combo", "POST", { ...combo(1), user_id: USER, env: ENV });
    assert.equal(post.status, 201);
    assert.equal(w.count("SELECT count(*) AS n FROM comments") + w.count("SELECT count(*) AS n FROM posts"), 0);
    assert.equal(w.serviceCalls(), 0);
  });

  await check("comments, likes, comment likes and reactions land in D1 before the answer, with recounts", async () => {
    const w = await world();
    const key = "sts2-codex:card:bash";
    const created = await w.call("/api/write/comments", "POST", { threadKey: key, nickname: "나", content: "좋은 카드" });
    assert.equal(created.status, 201);
    const id = (created.body as { comment: { id: string } }).comment.id;
    assert.equal(w.d1.one("SELECT comment_count FROM threads WHERE thread_key = ?1", key)?.comment_count, 1);
    assert.equal((await w.call(`/api/write/likes?key=${key}`, "PUT")).status, 200);
    assert.equal(w.d1.one("SELECT like_count FROM threads WHERE thread_key = ?1", key)?.like_count, 1);
    assert.equal((await w.call(`/api/write/comment-likes?id=${id}`, "PUT", undefined, OTHER)).status, 200);
    assert.equal(w.d1.one("SELECT like_count FROM comments WHERE id = ?1", id)?.like_count, 1);
    assert.equal((await w.call(`/api/write/comment-likes?id=${id}`, "DELETE", undefined, OTHER)).status, 200);
    assert.equal(w.d1.one("SELECT like_count FROM comments WHERE id = ?1", id)?.like_count, 0);
    assert.equal((await w.call(`/api/write/likes?key=${key}`, "DELETE")).status, 200);
    assert.equal(w.d1.one("SELECT like_count FROM threads WHERE thread_key = ?1", key)?.like_count, 0);

    const reaction = (kind: string | null) => w.call("/api/write/reactions", "PUT", { resourceType: "card", resourceId: "bash", gameVersion: "0.107.1", kind });
    assert.equal((await reaction("buff")).status, 200);
    assert.equal(w.d1.one("SELECT kind FROM resource_reactions")?.kind, "buff");
    assert.equal((await reaction("nerf")).status, 200);
    assert.equal(w.d1.one("SELECT kind FROM resource_reactions")?.kind, "nerf");
    assert.equal((await reaction(null)).status, 200);
    assert.equal(w.count("SELECT count(*) AS n FROM resource_reactions"), 0);

    assert.equal((await w.call(`/api/write/comments?id=${id}`, "DELETE")).status, 200);
    assert.equal(w.count("SELECT count(*) AS n FROM comments"), 0);
    assert.equal(w.d1.one("SELECT comment_count FROM threads WHERE thread_key = ?1", key)?.comment_count, 0, "recounted from D1's story_id");
  });

  await check("stories, inquiries and the mailbox seen mark", async () => {
    const w = await world();
    const story = await w.call("/api/write/stories", "POST", { nickname: "나", sentence: "이야기 한 줄", patchLineId: "0.107.1:1", source: "v0.107.1", linkedEntities: [] });
    assert.equal(story.status, 201, JSON.stringify(story.body));
    assert.equal(w.count("SELECT count(*) AS n FROM community_stories"), 1);
    const storyId = (story.body as { row: { id: string } }).row.id;
    assert.equal((await w.call(`/api/write/stories?id=${storyId}`, "DELETE")).status, 200);
    assert.equal(w.count("SELECT count(*) AS n FROM community_stories"), 0);

    const inquiry = await w.call("/api/write/contact-inquiries", "POST", {
      category: "bug", message: "버그가 있습니다 여기", pagePath: "/codex", serviceLocale: "ko", gameLocale: "kor",
    });
    assert.equal(inquiry.status, 201, JSON.stringify(inquiry.body));
    assert.equal(w.count("SELECT count(*) AS n FROM contact_inquiries"), 1, "re-read with the service key (the user cannot read it back)");
    // An operator answers in Supabase; the sync copies it; the user marks it seen.
    const row = w.rest.table("contact_inquiries")[0];
    w.rest.update("contact_inquiries", { id: row.id }, { admin_response: "고쳤습니다", responded_at: "2026-11-08T04:00:00+00:00" });
    await w.sync();
    assert.equal((await w.call("/api/write/profile/inquiries-seen", "POST")).status, 200);
    assert.match(String(w.d1.one("SELECT reply_seen_at FROM contact_inquiries")?.reply_seen_at), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}000Z$/);
  });

  await check("toybox posts: create with children, update without counters, delete with cascades", async () => {
    const w = await world();
    const input: Row = { ...combo(1), user_id: USER, env: ENV };
    delete (input as Row).like_count;
    delete (input as Row).comment_count;
    const created = await w.call("/api/write/toybox-post?service=combo", "POST", input);
    assert.equal(created.status, 201);
    assert.ok(Array.isArray(created.body), "the answer is still PostgREST's array, passed through");
    assert.equal(w.count("SELECT count(*) AS n FROM post_combo_resources"), 2);
    // Another user likes it: Supabase bumps like_count and the sync copies the U.
    w.rest.update("combo_posts", { id: input.id }, { like_count: 1 });
    await w.sync();
    assert.equal(w.d1.one("SELECT like_count FROM posts WHERE id = ?1", String(input.id))?.like_count, 1);
    // The author edits: read-after-write writes the user's columns, never the counter snapshot.
    w.rest.update("combo_posts", { id: input.id }, { like_count: 2 });
    const updated = await w.call(`/api/write/toybox-post?service=combo&id=${input.id}`, "PATCH", {
      content_text: "고친 콤보", resources: [{ type: "card", id: "strike" }],
    });
    assert.equal(updated.status, 200);
    assert.deepEqual(w.d1.one("SELECT p.like_count, p.summary, c.content_text FROM posts p JOIN post_combo c ON c.post_id = p.id"), {
      like_count: 1, summary: "고친 콤보", content_text: "고친 콤보",
    }, "the edit's answer carried like_count 2, but D1 keeps the synced 1 until the sync copies the U");
    assert.deepEqual(w.d1.rows("SELECT resource_id FROM post_combo_resources ORDER BY ord"), [{ resource_id: "strike" }]);
    await w.sync();
    assert.equal(w.d1.one("SELECT like_count FROM posts WHERE id = ?1", String(input.id))?.like_count, 2, "the later sync U brings the counter");
    const deleted = await w.call(`/api/write/toybox-post?service=combo&id=${input.id}`, "DELETE");
    assert.equal((deleted.body as { deleted: boolean }).deleted, true);
    assert.equal(w.count("SELECT count(*) AS n FROM posts") + w.count("SELECT count(*) AS n FROM post_combo_resources"), 0);
  });

  await check("a newer row the sync already applied wins over the insert", async () => {
    const w = await world();
    const key = "sts2-codex:card:race";
    const created = await w.call("/api/write/comments", "POST", { threadKey: key, nickname: "나", content: "먼저 쓴 댓글" });
    const id = (created.body as { comment: { id: string } }).comment.id;
    await w.sync();
    // The row changes in Supabase and the sync applies it; a replayed insert must not undo it.
    w.rest.update("comments", { id }, { content: "운영자가 고친 댓글" });
    await w.sync();
    // The same insert again (the answer row without the route's added like_count), as a late replay.
    const { like_count: _likes, ...answered } = (created.body as { comment: Row }).comment;
    const outcome = await readAfterWrite({ env: { API_RUNTIME_FLAGS: "d1", DB: w.d1 }, ctx: new Ctx() }, "spec", [
      { op: "insert", table: "comments", row: { ...answered, created_at: TS } },
    ]);
    assert.equal(outcome, "applied");
    assert.equal(w.d1.one("SELECT content FROM comments WHERE id = ?1", id)?.content, "운영자가 고친 댓글");
    assert.equal(w.d1.one("SELECT comment_count FROM threads WHERE thread_key = ?1", key)?.comment_count, 1, "no double count");
  });

  await check("this-or-that likes and votes; a parent D1 lacks fails quietly and the sync brings both", async () => {
    const w = await world();
    const post = thisOrThat(1);
    // Written by another browser straight to Supabase 30 s ago: not in D1 yet.
    w.rest.insert("this_or_that_posts", post);
    const liked = await w.call(`/api/write/this-or-that/like?id=${post.id}`, "PUT");
    assert.equal(liked.status, 200, "the answer follows Supabase");
    assert.equal(w.count("SELECT count(*) AS n FROM this_or_that_post_likes"), 0);
    assert.ok(lines.some((line) => line === "raw write.this-or-that.like failed fk"));
    assert.equal(w.count("SELECT count(*) AS n FROM sync_rejects"), 0, "read-after-write opens no reject");
    await w.sync();
    assert.equal(w.count("SELECT count(*) AS n FROM this_or_that_post_likes"), 1);
    assert.equal((await w.call(`/api/write/this-or-that/vote?id=${post.id}`, "PUT", { choice: "left", surface: "index" })).status, 201);
    assert.equal(w.d1.one("SELECT choice FROM this_or_that_post_votes")?.choice, "left");
    assert.equal((await w.call(`/api/write/this-or-that/vote?id=${post.id}`, "DELETE")).status, 200);
    assert.equal((await w.call(`/api/write/this-or-that/like?id=${post.id}`, "DELETE")).status, 200);
    assert.equal(w.count("SELECT count(*) AS n FROM this_or_that_post_votes") + w.count("SELECT count(*) AS n FROM this_or_that_post_likes"), 0);
  });

  await check("pagestorm drafts and 조각모음 bodies", async () => {
    const w = await world();
    // PostgREST answers select=* with every column; the fake answers what was sent, so send them all.
    const draft = { id: U(601), user_id: USER, nickname: "나", title: "초안", content: {}, content_text: "초안 본문", env: ENV, updated_at: TS, avatar_id: null, avatar_kind: null, palette_id: null, palette_swapped: null };
    assert.equal((await w.call("/api/write/pagestorm/drafts", "POST", draft)).status, 201);
    assert.equal(w.count("SELECT count(*) AS n FROM pagestorm_drafts"), 1);
    assert.equal((await w.call(`/api/write/pagestorm/drafts?id=${draft.id}`, "PATCH", { title: "고친 초안" })).status, 200);
    assert.equal(w.d1.one("SELECT title FROM pagestorm_drafts")?.title, "고친 초안");
    assert.equal((await w.call(`/api/write/pagestorm/drafts?id=${draft.id}`, "DELETE")).status, 200);
    assert.equal(w.count("SELECT count(*) AS n FROM pagestorm_drafts"), 0);

    const post: Row = { ...combo(2), user_id: USER, env: ENV };
    await w.call("/api/write/toybox-post?service=combo", "POST", post);
    const body = { env: ENV, source_service: "combo", source_id: post.id, user_id: USER, nickname: "나", content: [], content_text: "첫 본문", updated_at: TS };
    assert.equal((await w.call("/api/write/defragment-body", "PUT", body)).status, 200);
    assert.equal((await w.call("/api/write/defragment-body", "PUT", { ...body, content_text: "둘째 본문" })).status, 200);
    assert.equal(w.d1.one("SELECT content_text FROM defragment_bodies")?.content_text, "둘째 본문", "an upsert writes the user's columns");
  });

  await check("history-course runs: upload without raw (queued), batch, cover, nicknames, delete", async () => {
    const w = await world();
    const one: Row = { ...run(1), donor_user_id: USER };
    delete (one as Row).like_count;
    delete (one as Row).comment_count;
    assert.equal((await w.call("/api/write/history-runs", "POST", one)).status, 201);
    assert.equal(w.d1.one("SELECT summary_version FROM post_history_course WHERE post_id = ?1", String(one.id))?.summary_version, 0);
    assert.equal(w.count("SELECT count(*) AS n FROM sync_pending_raw"), 1, "the raw is queued for the sync");
    assert.equal(w.count("SELECT count(*) AS n FROM post_history_course_file"), 0);
    const batch = [2, 3, 4].map((n) => ({ ...run(n), donor_user_id: USER }));
    const uploaded = await w.call("/api/write/history-runs/batch", "POST", batch);
    assert.equal(uploaded.status, 201);
    assert.equal(w.count("SELECT count(*) AS n FROM posts WHERE service = 'history_course'"), 4);
    const cover = { auto: false, phrase: "표지", elements: [] };
    assert.equal((await w.call(`/api/write/history-runs/cover?id=${one.id}`, "PATCH", { coverSpec: cover })).status, 200);
    assert.deepEqual(JSON.parse(String(w.d1.one("SELECT cover_spec FROM post_history_course WHERE post_id = ?1", String(one.id))?.cover_spec)), cover);
    assert.equal((await w.call("/api/write/history-runs/nicknames", "POST", { nickname: "새이름" })).status, 200);
    assert.equal(w.count("SELECT count(*) AS n FROM posts WHERE service = 'history_course' AND nickname = '새이름'"), 4);
    assert.equal((await w.call(`/api/write/history-runs?id=${one.id}`, "DELETE")).status, 200);
    assert.equal(w.count("SELECT count(*) AS n FROM posts WHERE service = 'history_course'"), 3);
    // The sync later fetches the queued raws of the rest; the deleted run's queue row drops out.
    for (let i = 0; i < 4; i++) await w.sync();
    assert.equal(w.count("SELECT count(*) AS n FROM post_history_course_file"), 3);
    assert.equal(w.count("SELECT count(*) AS n FROM sync_pending_raw"), 0);
  });

  await check("world-cup plays and puzzlebox runs (RPC writes) re-read the rows the RPC wrote", async () => {
    const w = await world();
    const cup = tournament(1, 2);
    w.rest.insert("favorite_tournament_posts", cup);
    await w.sync();
    const played = await w.call("/api/write/favorite-tournament/play", "POST", {
      tournamentId: cup.id, startingSize: 2, championType: "card", championId: "card-0",
      matches: [{ left_type: "card", left_id: "card-0", right_type: "card", right_id: "card-1", winner: "left" }],
    });
    assert.equal(played.status, 200);
    assert.equal(w.count("SELECT count(*) AS n FROM favorite_tournament_plays"), 1);
    assert.equal(w.d1.one("SELECT play_count FROM post_favorite_tournament")?.play_count, 0, "the counter waits for the sync");
    await w.sync();
    assert.equal(w.d1.one("SELECT play_count FROM post_favorite_tournament")?.play_count, 1);

    const submit = () => w.call("/api/write/puzzlebox/runs", "POST", { game: "connections", board: "7", run: { guesses: [] }, player: { nickname: "나" } });
    assert.equal((await submit()).status, 200);
    assert.equal(w.count("SELECT count(*) AS n FROM puzzlebox_runs"), 1);
    assert.equal(w.d1.one("SELECT attempts FROM puzzlebox_best")?.attempts, 1);
    assert.equal((await submit()).status, 200);
    assert.equal(w.count("SELECT count(*) AS n FROM puzzlebox_runs"), 2);
    assert.deepEqual(w.d1.one("SELECT attempts, score FROM puzzlebox_best"), { attempts: 2, score: 52 });
  });

  await check("a D1 failure never changes the answer; the statement cap holds; uncopied tables are skipped", async () => {
    const w = await world();
    w.d1.failBatch = (sql) => (sql.some((text) => text.startsWith("INSERT INTO comments")) ? new Error("D1_ERROR: Network connection lost.") : null);
    const created = await w.call("/api/write/comments", "POST", { threadKey: "sts2-codex:card:x", nickname: "나", content: "좋은 카드" });
    assert.equal(created.status, 201);
    assert.ok(lines.includes("raw write.comments.create failed error"));
    w.d1.failBatch = null;
    const ctx = new Ctx();
    const many = Array.from({ length: 30 }, (_, i) => ({ op: "insert" as const, table: "likes", row: { story_id: `k${i}`, user_id: U(1), created_at: TS, env: ENV } }));
    const before = w.d1.statements;
    await readAfterWrite({ env: { API_RUNTIME_FLAGS: "d1", DB: w.d1 }, ctx }, "spec.cap", many);
    assert.ok(w.d1.statements - before <= RAW_MAX_STATEMENTS + 1);
    assert.ok(lines.some((line) => /^raw spec\.cap unmapped=0 skipped=\d+$/.test(line)));
    assert.equal(await readAfterWrite({ env: { API_RUNTIME_FLAGS: "d1", DB: w.d1 }, ctx }, "spec.skip", [
      { op: "insert", table: "defragment_posts", row: { id: U(9) } },
    ]), "skipped");
    assert.ok(!SUPABASE_TABLES.includes("defragment_posts"));
    const big = new Response(JSON.stringify([{ ...combo(9), content: [{ text: "x".repeat(300_000) }] }]));
    assert.equal(await readAfterWriteFromAnswer({ env: { API_RUNTIME_FLAGS: "d1", DB: w.d1 }, ctx }, "spec.big", big, (row) => [{ op: "insert", table: "combo_posts", row }]), "skipped");
    assert.equal((await big.json() as unknown[]).length, 1, "the original answer is still readable");
  });

  await check("CPU of a read-after-write for a 200 KB post answer", async () => {
    const w = await world();
    const ctx = new Ctx();
    const answer = JSON.stringify([{ ...combo(7), content: [{ type: "text", text: "가".repeat(65_000) }] }]);
    const samples: number[] = [];
    for (let i = 0; i < 9; i++) {
      w.d1.sqlite.exec("DELETE FROM posts");
      const stub = { prepare: () => ({ bind() { return this; }, all: async () => ({ results: [], success: true }), first: async () => ({ value: "on" }), run: async () => ({ results: [], success: true }) }), batch: async () => [] };
      const start = process.cpuUsage();
      await readAfterWriteFromAnswer({ env: { API_RUNTIME_FLAGS: "d1", DB: stub }, ctx }, "spec.cpu", new Response(answer), (row) => [{ op: "insert", table: "combo_posts", row }]);
      const used = process.cpuUsage(start);
      samples.push((used.user + used.system) / 1000);
    }
    samples.sort((a, b) => a - b);
    realLog(`  cpu read-after-write of a ${Math.round(Buffer.byteLength(answer) / 1024)} KB answer: cold ${samples.at(-1)!.toFixed(2)} ms, median ${samples[4].toFixed(2)} ms`);
    assert.ok(samples[4] < 5);
  });

  console.log = realLog;
  globalThis.fetch = realFetch;
  console.log(`d1-read-after-write spec passed (${checks} checks)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

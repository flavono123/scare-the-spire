/**
 * The comments group's Worker routes (docs/supabase-exit/STEP1_DESIGN.md 9.1)
 * against an in-memory PostgREST that keeps the table rules the routes rely on:
 * unique likes, the comment foreign key, RLS ownership and the reaction totals trigger.
 * Usage: tsx scripts/api-comments.spec.ts
 */
import assert from "node:assert/strict";

import type { D1Database, D1PreparedStatement, D1Result } from "../workers/api/d1";
import { FLAGS_SQL, resetFlagsForTest } from "../workers/api/flags";
import { resetJwtCachesForTest } from "../workers/api/jwt";
import { contentRangeTotal, parseCommentInput, restErrorCode } from "../workers/api/routes/comments";
import mainWorker from "../workers/main-worker";

const ORIGIN = "https://testbed.example.workers.dev";
const PROJECT = "https://abcdefghijklmnopqrst.supabase.co";
const ISSUER = `${PROJECT}/auth/v1`;
const USER = "4f1c2a7e-9b3d-4c5e-8f60-1a2b3c4d5e6f";
const OTHER = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";

// --- Token helpers ------------------------------------------------------------

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

// --- In-memory PostgREST ---------------------------------------------------------

type Row = Record<string, unknown>;

class FakeRest {
  comments: Row[] = [];
  commentLikes: Row[] = [];
  likes: Row[] = [];
  reactions: Row[] = [];
  philosophers: Row[] = [];
  calls: { method: string; url: URL; auth: string | null; body: unknown }[] = [];
  failTables = new Set<string>();
  /** Fail only the count reads (HEAD) and the totals read of these tables. */
  failReads = new Set<string>();
  jwks: unknown = { keys: [] };
  private seq = 0;

  id() {
    this.seq += 1;
    return `00000000-0000-4000-8000-${String(this.seq).padStart(12, "0")}`;
  }

  reactionCounts(): Row[] {
    const totals = new Map<string, Row>();
    for (const row of this.reactions) {
      const key = [row.env, row.resource_type, row.resource_id, row.game_version].join("|");
      const total = totals.get(key) ?? {
        env: row.env, resource_type: row.resource_type, resource_id: row.resource_id, game_version: row.game_version,
        buff_count: 0, nerf_count: 0, rework_count: 0,
      };
      total[`${row.kind}_count`] = Number(total[`${row.kind}_count`]) + 1;
      totals.set(key, total);
    }
    return [...totals.values()];
  }

  table(name: string): Row[] {
    if (name === "comments") return this.comments;
    if (name === "comment_likes") return this.commentLikes;
    if (name === "likes") return this.likes;
    if (name === "resource_reactions") return this.reactions;
    if (name === "resource_reaction_counts") return this.reactionCounts();
    if (name === "colorful_philosopher_posts") return this.philosophers;
    throw new Error(`unknown table ${name}`);
  }

  static parseIn(value: string): string[] {
    const inner = /^in\.\((.*)\)$/.exec(value)?.[1] ?? "";
    return inner ? inner.split(",").map((item) => item.replace(/^"|"$/g, "")) : [];
  }

  matches(row: Row, params: URLSearchParams, embedded?: Row): boolean {
    for (const [name, value] of params) {
      if (["select", "order", "limit", "on_conflict"].includes(name)) continue;
      const [owner, column] = name.includes(".") ? name.split(".") : [null, name];
      const source = owner ? embedded : row;
      if (!source) return false;
      const cell = String(source[column] ?? "");
      if (value.startsWith("eq.")) {
        if (cell !== value.slice(3)) return false;
      } else if (value.startsWith("in.")) {
        if (!FakeRest.parseIn(value).includes(cell)) return false;
      } else {
        throw new Error(`unsupported filter ${name}=${value}`);
      }
    }
    return true;
  }

  userOf(auth: string | null): string | null {
    if (!auth) return null;
    try {
      return JSON.parse(atob(auth.replace(/^Bearer /, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).sub;
    } catch {
      return null;
    }
  }

  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/auth/v1/.well-known/jwks.json") return Response.json(this.jwks);
    const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.text().then((text) => (text ? JSON.parse(text) : undefined));
    const auth = request.headers.get("authorization");
    this.calls.push({ method: request.method, url, auth, body });
    assert.equal(request.headers.get("apikey"), "sb_publishable_test");
    const name = url.pathname.replace("/rest/v1/", "");
    if (this.failTables.has(name)) return new Response("{\"code\":\"XX000\"}", { status: 500 });
    if (this.failReads.has(name) && (request.method === "HEAD" || request.method === "GET")) {
      return new Response("{\"code\":\"XX000\"}", { status: 503 });
    }
    const prefer = request.headers.get("prefer") ?? "";
    const params = url.searchParams;
    const user = this.userOf(auth);

    if (name === "rpc/get_engagement_counts") {
      const env = (body as { p_env: string }).p_env;
      const keys = new Set([...this.comments, ...this.likes].filter((row) => row.env === env).map((row) => String(row.story_id)));
      return Response.json([...keys].map((key) => ({
        story_id: key,
        like_count: this.likes.filter((row) => row.env === env && row.story_id === key).length,
        comment_count: this.comments.filter((row) => row.env === env && row.story_id === key).length,
      })));
    }

    if (request.method === "GET" || request.method === "HEAD") {
      let rows = this.table(name).filter((row) => {
        if (name === "comment_likes" && params.has("comments.story_id")) {
          const parent = this.comments.find((comment) => comment.id === row.comment_id);
          return Boolean(parent) && this.matches(row, params, parent);
        }
        return this.matches(row, params);
      });
      if (params.get("order") === "created_at.asc") rows = [...rows].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
      if (params.get("order") === "week_start.desc") rows = [...rows].sort((a, b) => String(b.week_start).localeCompare(String(a.week_start)));
      const limit = Number(params.get("limit") ?? "100000");
      rows = rows.slice(0, limit);
      if (request.method === "HEAD") {
        assert.ok(prefer.includes("count=exact"));
        return new Response(null, { status: 200, headers: { "content-range": rows.length ? `0-${rows.length - 1}/${rows.length}` : "*/0" } });
      }
      const select = params.get("select") ?? "*";
      return Response.json(rows.map((row) => this.project(row, select)));
    }

    if (!user) return Response.json({ code: "42501" }, { status: 401 });

    if (request.method === "POST") {
      const input = body as Row;
      if (input.user_id !== user) return Response.json({ code: "42501" }, { status: 403 });
      if (name === "comment_likes") {
        if (!this.comments.some((comment) => comment.id === input.comment_id)) return Response.json({ code: "23503" }, { status: 409 });
        if (this.commentLikes.some((row) => row.comment_id === input.comment_id && row.user_id === user)) return Response.json({ code: "23505" }, { status: 409 });
        this.commentLikes.push({ id: this.id(), ...input });
      } else if (name === "likes") {
        if (this.likes.some((row) => row.story_id === input.story_id && row.user_id === user && row.env === input.env)) return Response.json({ code: "23505" }, { status: 409 });
        this.likes.push({ id: this.id(), ...input });
      } else if (name === "resource_reactions") {
        const same = (row: Row) => ["env", "resource_type", "resource_id", "game_version", "user_id"].every((key) => row[key] === input[key]);
        if (this.reactions.some(same)) return Response.json({ code: "23505" }, { status: 409 });
        this.reactions.push({ ...input });
      } else if (name === "comments") {
        if (String(input.content).length > 2000) return Response.json({ code: "23514" }, { status: 400 });
        const row = { id: this.id(), created_at: new Date().toISOString(), parent_id: null, meta: null, avatar_id: null, avatar_kind: null, palette_id: null, palette_swapped: false, ...input };
        this.comments.push(row);
        return prefer.includes("return=representation")
          ? Response.json([this.project(row, params.get("select") ?? "*")], { status: 201 })
          : new Response(null, { status: 201 });
      }
      return new Response(null, { status: 201 });
    }

    const all = name === "comments" ? this.comments : name === "comment_likes" ? this.commentLikes : name === "likes" ? this.likes : this.reactions;
    // RLS: only the caller's rows are visible to update and delete.
    const targets = all.filter((row) => this.matches(row, params) && (row.user_id === user));
    if (request.method === "DELETE") {
      for (const row of targets) all.splice(all.indexOf(row), 1);
      if (name === "comments") {
        this.commentLikes = this.commentLikes.filter((like) => targets.every((row) => row.id !== like.comment_id));
      }
    } else if (request.method === "PATCH") {
      for (const row of targets) Object.assign(row, body as Row);
    }
    return prefer.includes("return=representation")
      ? Response.json(targets.map((row) => this.project(row, params.get("select") ?? "*")))
      : new Response(null, { status: 204 });
  }

  project(row: Row, select: string): Row {
    if (select === "*") return { ...row };
    const out: Row = {};
    for (const field of select.split(/,(?![^(]*\))/)) {
      if (field === "comment_likes(count)") {
        out.comment_likes = [{ count: this.commentLikes.filter((like) => like.comment_id === row.id).length }];
      } else if (field === "comments!inner(story_id)") {
        const parent = this.comments.find((comment) => comment.id === row.comment_id);
        out.comments = parent ? { story_id: parent.story_id } : null;
      } else {
        out[field] = row[field] ?? null;
      }
    }
    return out;
  }
}

class FakeD1 implements D1Database {
  flags = new Map<string, string>([["path.comments", "api"]]);
  prepare(query: string): D1PreparedStatement {
    const exec = async (): Promise<D1Result<Record<string, unknown>>> => {
      if (query !== FLAGS_SQL) throw new Error(`unexpected SQL ${query}`);
      return { success: true, results: [...this.flags].map(([key, value]) => ({ key, value })) };
    };
    const statement: D1PreparedStatement = {
      bind: () => statement,
      all: exec as D1PreparedStatement["all"],
      first: (async () => (await exec()).results[0] ?? null) as D1PreparedStatement["first"],
      run: exec as D1PreparedStatement["run"],
    };
    return statement;
  }
  async batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    return Promise.all(statements.map((statement) => statement.all<T>()));
  }
}

class Limiter {
  keys: string[] = [];
  allow = true;
  async limit({ key }: { key: string }) {
    this.keys.push(key);
    return { success: this.allow };
  }
}

const ctx = { waitUntil() {} };

async function main() {
  const realFetch = globalThis.fetch;
  const rest = new FakeRest();
  const signer = await makeSigner();
  rest.jwks = signer.jwks;
  globalThis.fetch = (async (input: Request | string | URL, init?: RequestInit) => rest.handle(new Request(input, init))) as typeof fetch;
  resetFlagsForTest();
  resetJwtCachesForTest();

  const db = new FakeD1();
  const readLimiter = new Limiter();
  const writeLimiter = new Limiter();
  const env = {
    API_RUNTIME_FLAGS: "d1",
    API_SUPABASE_URL: PROJECT,
    API_SUPABASE_KEY: "sb_publishable_test",
    API_DATA_ENV: "development",
    DB: db,
    API_READ_LIMITER: readLimiter,
    API_WRITE_LIMITER: writeLimiter,
    ASSETS: { fetch: async () => new Response("asset") },
    PATCH_WORKER: { fetch: async () => new Response("patch") },
  };
  const call = (path: string, init: RequestInit = {}) => mainWorker.fetch(new Request(`${ORIGIN}${path}`, init), env as never, ctx);
  const json = async (response: Response) => ({ status: response.status, body: await response.json() as Record<string, unknown>, headers: response.headers });
  const token = await signer.token();
  const otherToken = await signer.token(OTHER);
  const authed = (method: string, body?: unknown, bearer = token): RequestInit => ({
    method,
    headers: {
      authorization: `Bearer ${bearer}`,
      "sec-fetch-site": "same-origin",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // Seed: two threads in development, one row in production that must never leak.
  const codexKey = "sts2-codex:card:bash";
  const patchKey = "sts2-patch:0.107.1";
  rest.comments.push(
    { id: "11111111-1111-4111-8111-111111111111", story_id: codexKey, user_id: OTHER, nickname: "철학자", content: "첫 댓글", content_blocks: null, created_at: "2026-11-05T01:00:00.000Z", env: "development", parent_id: null, meta: { hidden: true }, avatar_id: null, avatar_kind: null, palette_id: null, palette_swapped: false },
    { id: "22222222-2222-4222-8222-222222222222", story_id: codexKey, user_id: USER, nickname: "나", content: "두 번째", content_blocks: [{ type: "text", text: "두 번째" }], created_at: "2026-11-05T02:00:00.000Z", env: "development", parent_id: null, meta: null, avatar_id: "ironclad", avatar_kind: "character", palette_id: "red", palette_swapped: true },
    { id: "33333333-3333-4333-8333-333333333333", story_id: codexKey, user_id: OTHER, nickname: "운영", content: "운영 행", content_blocks: null, created_at: "2026-11-05T00:00:00.000Z", env: "production", parent_id: null, meta: null, avatar_id: null, avatar_kind: null, palette_id: null, palette_swapped: false },
  );
  rest.commentLikes.push({ id: rest.id(), comment_id: "11111111-1111-4111-8111-111111111111", user_id: USER });
  rest.likes.push({ id: rest.id(), story_id: codexKey, user_id: OTHER, env: "development" });
  rest.philosophers.push({
    id: "44444444-4444-4444-8444-444444444444", week_start: "2026-11-02", slot: "card", resource_type: "card", resource_id: "bash",
    name_ko: "강타", name_en: "Bash", image_url: null, body: "강타는 너프돼야 한다", game_version: "0.103.2", buff_count: 0, nerf_count: 0, rework_count: 0, env: "development",
  });
  rest.comments.push({ id: "55555555-5555-4555-8555-555555555555", story_id: "colorful-philosophers:44444444-4444-4444-8444-444444444444", user_id: OTHER, nickname: "답글", content: "동의", content_blocks: null, created_at: "2026-11-05T03:00:00.000Z", env: "development", parent_id: null, meta: null, avatar_id: null, avatar_kind: null, palette_id: null, palette_swapped: false });
  rest.reactions.push({ env: "development", resource_type: "card", resource_id: "bash", game_version: "0.103.2", user_id: OTHER, kind: "nerf" });

  // --- Public read: threads, likes, reactions, philosophers -------------------
  const query = `/api/read/engagement?threads=${codexKey},${patchKey}&likes=${codexKey}&reactions=card:bash:0.104.0&philosophers=card:bash`;
  rest.calls.length = 0;
  const read = await json(await call(query, { headers: { "cf-connecting-ip": "203.0.113.9" } }));
  assert.equal(read.status, 200);
  assert.equal(read.headers.get("x-slseoun-api"), "1");
  assert.equal(read.headers.get("cache-control"), "private, no-store", "no cache: a writer must see their own comment");
  const threads = read.body.threads as Record<string, Record<string, unknown>[]>;
  assert.deepEqual(threads[codexKey].map((row) => row.id), ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"], "oldest first, development rows only");
  assert.deepEqual(threads[patchKey], [], "a thread with no comments is an empty list");
  assert.equal(threads[codexKey][0].like_count, 1);
  assert.equal(threads[codexKey][1].like_count, 0);
  assert.ok(!("meta" in threads[codexKey][0]) && !("parent_id" in threads[codexKey][0]) && !("comment_likes" in threads[codexKey][0]));
  assert.deepEqual(Object.keys(threads[codexKey][1]).sort(), ["avatar_id", "avatar_kind", "content", "content_blocks", "created_at", "id", "like_count", "nickname", "palette_id", "palette_swapped", "story_id", "user_id"]);
  assert.deepEqual(read.body.likes, { [codexKey]: 1 });
  const reactions = read.body.reactions as Record<string, unknown>;
  assert.deepEqual(reactions["card:bash:0.104.0"], { buff: 0, nerf: 0, rework: 0 }, "a target with no row reads zero");
  assert.deepEqual(reactions["card:bash:0.103.2"], { buff: 0, nerf: 1, rework: 0 }, "the post's own version rides along");
  assert.equal((read.body.philosophers as Record<string, unknown[]>)["card:bash"].length, 1);
  assert.equal(threads["colorful-philosophers:44444444-4444-4444-8444-444444444444"].length, 1, "reply threads ride along");
  assert.equal(rest.calls.filter((entry) => entry.url.pathname.startsWith("/rest/")).length, 4,
    "a codex detail costs four Supabase calls: posts, totals, like count, then all comment rows");
  assert.ok(rest.calls.every((entry) => entry.auth === null), "public reads never forward a user token");
  assert.ok(rest.calls.every((entry) => entry.url.searchParams.get("env") === "eq.development" || entry.url.searchParams.get("comments.env") === "eq.development" || !entry.url.pathname.startsWith("/rest")), "every query is scoped to the Worker env");
  assert.equal(readLimiter.keys.at(-1), "ip:203.0.113.9");

  // Same bytes with or without Authorization.
  const anonymousBytes = await (await call(query)).text();
  const authorizedBytes = await (await call(query, { headers: { authorization: `Bearer ${token}` } })).text();
  assert.equal(authorizedBytes, anonymousBytes);

  // Query checks.
  for (const bad of [
    "/api/read/engagement",
    "/api/read/engagement?threads=",
    `/api/read/engagement?threads=${codexKey},${codexKey}`,
    "/api/read/engagement?threads=bad%20key",
    "/api/read/engagement?threads=a&threads=b",
    "/api/read/engagement?select=*",
    `/api/read/engagement?likes=${Array.from({ length: 17 }, (_, index) => `k${index}`).join(",")}`,
    "/api/read/engagement?reactions=card:bash",
    `/api/read/engagement?threads=${Array.from({ length: 64 }, (_, index) => `x${"y".repeat(100)}${index}`).join(",")}`,
  ]) {
    assert.equal((await call(bad)).status, 400, bad);
  }

  // Partial failure keeps the other parts; all failing is 503.
  rest.failTables.add("resource_reaction_counts");
  const partial = await json(await call(`/api/read/engagement?threads=${codexKey}&reactions=card:bash:0.104.0`));
  assert.equal(partial.status, 200);
  assert.deepEqual(partial.body.unavailable, ["reactions"]);
  assert.ok(partial.body.threads && !partial.body.reactions);
  const allDown = await call("/api/read/engagement?reactions=card:bash:0.104.0");
  assert.equal(allDown.status, 503);
  rest.failTables.clear();

  // HEAD never calls Supabase.
  rest.calls.length = 0;
  const head = await call(query, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(rest.calls.length, 0);

  // --- Personal overlay --------------------------------------------------------
  const meQuery = `/api/me/engagement?threads=${codexKey}&likes=${codexKey}&reactions=card:bash:0.103.2`;
  assert.equal((await json(await call(meQuery))).body.error, "token_invalid");
  const me = await json(await call(meQuery, { headers: { authorization: `Bearer ${token}` } }));
  assert.equal(me.status, 200);
  assert.deepEqual(me.body.commentLikes, { [codexKey]: ["11111111-1111-4111-8111-111111111111"] });
  assert.deepEqual(me.body.likes, { [codexKey]: false });
  assert.deepEqual(me.body.reactions, { "card:bash:0.103.2": null });
  const otherMe = await json(await call(meQuery, { headers: { authorization: `Bearer ${otherToken}` } }));
  assert.deepEqual(otherMe.body.likes, { [codexKey]: true });
  assert.deepEqual(otherMe.body.reactions, { "card:bash:0.103.2": "nerf" });
  assert.equal((await call("/api/me/engagement?philosophers=card:bash", { headers: { authorization: `Bearer ${token}` } })).status, 400);

  // --- Comment writes -------------------------------------------------------------
  const created = await json(await call("/api/write/comments", authed("POST", {
    threadKey: patchKey,
    nickname: "  새 사람  ",
    content: "패치 좋네요",
    contentBlocks: [{ type: "text", text: "패치 좋네요" }],
    author: { avatarId: "silent", avatarKind: "character", paletteId: null, paletteSwapped: false },
    user_id: OTHER,
    env: "production",
  })));
  assert.equal(created.status, 201);
  const comment = created.body.comment as Record<string, unknown>;
  assert.equal(comment.user_id, USER, "the author is the verified sub, never the body");
  assert.equal(comment.nickname, "새 사람");
  assert.equal(comment.like_count, 0);
  assert.equal(rest.comments.at(-1)?.env, "development", "the env is the Worker's");
  assert.equal(rest.comments.at(-1)?.avatar_id, "silent");
  const plain = await json(await call("/api/write/comments", authed("POST", { threadKey: patchKey, nickname: "익명", content: "두 글자" })));
  assert.equal(plain.status, 201);
  assert.ok(!("avatar_id" in (rest.calls.at(-1)?.body as Row)), "no author: the token columns keep their defaults");

  for (const bad of [
    { threadKey: patchKey, nickname: "", content: "내용" },
    { threadKey: patchKey, nickname: "가".repeat(21), content: "내용" },
    { threadKey: patchKey, nickname: "이름", content: " a " },
    { threadKey: patchKey, nickname: "이름", content: "가".repeat(2001) },
    { threadKey: "bad key", nickname: "이름", content: "내용" },
    { threadKey: patchKey, nickname: "이름", content: "내용", contentBlocks: "text" },
    { threadKey: patchKey, nickname: "이름", content: "내용", author: { avatarId: 3 } },
    { threadKey: patchKey, nickname: "이름", content: "내용", author: { avatarId: "a".repeat(65) } },
    [],
  ]) {
    assert.equal((await call("/api/write/comments", authed("POST", bad))).status, 400, JSON.stringify(bad).slice(0, 60));
  }
  assert.equal((await call("/api/write/comments", { ...authed("POST", {}), headers: { authorization: `Bearer ${token}`, "content-type": "text/plain" }, body: "{}" })).status, 400);
  const huge = JSON.stringify({ threadKey: patchKey, nickname: "이름", content: "내용", contentBlocks: ["x".repeat(170 * 1024)] });
  assert.equal((await call("/api/write/comments", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: huge })).status, 413);
  assert.equal((await call("/api/write/comments", { ...authed("POST", { threadKey: patchKey, nickname: "이름", content: "내용" }), headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "sec-fetch-site": "cross-site" } })).status, 403);
  assert.equal((await json(await call("/api/write/comments", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }))).body.error, "token_invalid");

  // Delete: own comment once, then 404; someone else's is 404 and stays.
  const ownId = String(comment.id);
  assert.deepEqual((await json(await call(`/api/write/comments?id=${ownId}`, authed("DELETE")))).body, { deleted: true });
  assert.equal((await call(`/api/write/comments?id=${ownId}`, authed("DELETE"))).status, 404);
  assert.equal((await call("/api/write/comments?id=11111111-1111-4111-8111-111111111111", authed("DELETE"))).status, 404);
  assert.ok(rest.comments.some((row) => row.id === "11111111-1111-4111-8111-111111111111"));
  assert.equal((await call("/api/write/comments", authed("DELETE"))).status, 400, "id is required");
  assert.equal((await call("/api/write/comments?id=not-a-uuid", authed("DELETE"))).status, 400);

  // --- Comment likes and likes are idempotent and return the count ---------------
  const target = "22222222-2222-4222-8222-222222222222";
  assert.deepEqual((await json(await call(`/api/write/comment-likes?id=${target}`, authed("PUT")))).body, { liked: true, count: 1 });
  assert.deepEqual((await json(await call(`/api/write/comment-likes?id=${target}`, authed("PUT")))).body, { liked: true, count: 1 });
  assert.deepEqual((await json(await call(`/api/write/comment-likes?id=${target}`, authed("PUT", undefined, otherToken)))).body, { liked: true, count: 2 });
  assert.deepEqual((await json(await call(`/api/write/comment-likes?id=${target}`, authed("DELETE")))).body, { liked: false, count: 1 });
  assert.deepEqual((await json(await call(`/api/write/comment-likes?id=${target}`, authed("DELETE")))).body, { liked: false, count: 1 });
  assert.equal((await call("/api/write/comment-likes?id=99999999-9999-4999-8999-999999999999", authed("PUT"))).status, 404);

  assert.deepEqual((await json(await call(`/api/write/likes?key=${codexKey}`, authed("PUT")))).body, { liked: true, count: 2 });
  assert.deepEqual((await json(await call(`/api/write/likes?key=${codexKey}`, authed("PUT")))).body, { liked: true, count: 2 });
  assert.deepEqual((await json(await call(`/api/write/likes?key=${codexKey}`, authed("DELETE")))).body, { liked: false, count: 1 });

  // --- Reactions: the DB decides insert or update ---------------------------------
  const reaction = (kind: string | null, bearer = token) => call("/api/write/reactions", authed("PUT", {
    resourceType: "card", resourceId: "bash", gameVersion: "0.103.2", kind,
  }, bearer));
  assert.deepEqual((await json(await reaction("buff"))).body, { kind: "buff", counts: { buff: 1, nerf: 1, rework: 0 } });
  assert.deepEqual((await json(await reaction("rework"))).body, { kind: "rework", counts: { buff: 0, nerf: 1, rework: 1 } }, "a second tab's stale kind cannot conflict");
  assert.deepEqual((await json(await reaction("rework"))).body, { kind: "rework", counts: { buff: 0, nerf: 1, rework: 1 } });
  assert.deepEqual((await json(await reaction(null))).body, { kind: null, counts: { buff: 0, nerf: 1, rework: 0 } });
  assert.equal((await reaction("love")).status, 400);
  assert.equal((await call("/api/write/reactions", authed("PUT", { resourceType: "card", resourceId: "a:b", gameVersion: "1", kind: "buff" }))).status, 400);

  // A committed write whose count read fails answers 200 with an unknown count, never 503.
  rest.failReads.add("likes");
  const committedLike = await json(await call(`/api/write/likes?key=${patchKey}`, authed("PUT")));
  assert.deepEqual(committedLike, { ...committedLike, status: 200, body: { liked: true, count: null } });
  assert.ok(rest.likes.some((row) => row.story_id === patchKey && row.user_id === USER), "the like is stored");
  assert.deepEqual((await json(await call(`/api/write/likes?key=${patchKey}`, authed("DELETE")))).body, { liked: false, count: null });
  rest.failReads.delete("likes");
  rest.failReads.add("resource_reaction_counts");
  const committedReaction = await json(await reaction("nerf"));
  assert.equal(committedReaction.status, 200);
  assert.deepEqual(committedReaction.body, { kind: "nerf", counts: null });
  assert.equal(rest.reactions.find((row) => row.user_id === USER)?.kind, "nerf");
  await reaction(null);
  rest.failReads.delete("resource_reaction_counts");

  // Prototype names are unknown parameters, not crashes.
  for (const name of ["constructor", "__proto__", "hasOwnProperty", "valueOf", "toString"]) {
    assert.equal((await call(`/api/read/engagement-counts?${name}=1`)).status, 400, name);
    assert.equal((await call(`/api/read/engagement?threads=${codexKey}&${name}=1`)).status, 400, name);
  }

  // A batch of planted 128 KB rows is cut at the byte cap and reported unavailable.
  const plantedKey = "transfigure:planted";
  for (let index = 0; index < 9; index += 1) {
    rest.comments.push({ id: `66666666-6666-4666-8666-${String(index).padStart(12, "0")}`, story_id: plantedKey, user_id: OTHER, nickname: "심기", content: "큰 행", content_blocks: [{ type: "text", text: "가".repeat(43_000) }], created_at: `2026-11-05T04:00:0${index}.000Z`, env: "development", parent_id: null, meta: null, avatar_id: null, avatar_kind: null, palette_id: null, palette_swapped: false });
  }
  const planted = await json(await call(`/api/read/engagement?threads=${plantedKey}&likes=${plantedKey}`));
  assert.equal(planted.status, 200);
  assert.deepEqual(planted.body.unavailable, ["threads"]);
  assert.equal((await call(`/api/read/engagement?threads=${plantedKey}`)).status, 503);
  rest.comments = rest.comments.filter((row) => row.story_id !== plantedKey);

  // --- Engagement counts ------------------------------------------------------------
  const counts = await json(await call("/api/read/engagement-counts"));
  assert.equal(counts.status, 200);
  assert.equal((counts.body.comments as Record<string, number>)[codexKey], 2);
  assert.equal((counts.body.likes as Record<string, number>)[codexKey], 1);
  assert.equal((await call("/api/read/engagement-counts?p_env=production")).status, 400);

  // --- Rate limits ------------------------------------------------------------------
  writeLimiter.allow = false;
  const limited = await call(`/api/write/likes?key=${codexKey}`, authed("PUT"));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "30");
  assert.equal(writeLimiter.keys.at(-1), `user:${USER}`);
  writeLimiter.allow = true;
  readLimiter.allow = false;
  assert.equal((await call(query, { headers: { "cf-connecting-ip": "203.0.113.9" } })).status, 429);
  readLimiter.allow = true;
  // A missing binding does not block.
  const unlimited = await mainWorker.fetch(new Request(`${ORIGIN}${query}`), { ...env, API_READ_LIMITER: undefined } as never, ctx);
  assert.equal(unlimited.status, 200);

  // --- Flags -------------------------------------------------------------------------
  db.flags.set("path.comments", "legacy");
  resetFlagsForTest();
  const legacy = await json(await call(query));
  assert.equal(legacy.status, 409);
  assert.equal(legacy.body.reason, "flag");
  const pinned = await call(query, { headers: { cookie: "slseoun_qa_path=comments" } });
  assert.equal(pinned.status, 200, "development QA may pin the api path");
  assert.equal((await call(query, { headers: { cookie: "slseoun_qa=no-supabase" } })).status, 409);

  // --- Helpers ------------------------------------------------------------------------
  assert.equal(contentRangeTotal("0-4/5"), 5);
  assert.equal(contentRangeTotal("*/0"), 0);
  assert.equal(contentRangeTotal(null), null);
  assert.equal(restErrorCode({ ok: false, status: 401, code: "42501" }), "forbidden");
  assert.equal(restErrorCode({ ok: false, status: 401, code: "PGRST301" }), "token_expired");
  assert.equal(restErrorCode({ ok: false, status: 400, code: "23514" }), "check_violation");
  assert.equal(restErrorCode({ ok: false, status: 504, code: "http_504" }), "unavailable");
  assert.equal(restErrorCode({ ok: false, status: 0, code: "timeout" }), "unavailable");
  assert.ok(parseCommentInput({ threadKey: "byrdispatch", nickname: "😀".repeat(20), content: "ok" }), "20 emoji is 20 characters");
  assert.equal(parseCommentInput({ threadKey: "byrdispatch", nickname: "😀".repeat(21), content: "ok" }), null);

  globalThis.fetch = realFetch;
  console.log("api-comments spec passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

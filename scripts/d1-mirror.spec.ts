/**
 * The step 5 mirror (docs/supabase-exit/D1_SCHEMA_DESIGN.md 5.5): outbox rows to Supabase.
 *   A. Against a recording fake: seq order, env, owners in deletes, the per-(table_name, match_key)
 *      wait behind a permanent refusal, transient stops and backoff, reject retries, the env-less
 *      tables, the run text body and the tournament RPC body.
 *   B. Against Supabase on PGlite (the repo schema with its real triggers, FKs and the step 5
 *      migration): writes go through the D1 handlers, the mirror carries them over, and Supabase's
 *      own triggers recount what D1 recounted.
 * Usage: tsx scripts/d1-mirror.spec.ts
 */
import assert from "node:assert/strict";

import { WRITE_GROUPS, sourceFlagKey } from "../src/lib/write-source-flags";
import { canonicalKey, mirrorOutbox, outboxHealth, scheduledOutboxMirror } from "../workers/api/d1-write/mirror";
import { outboxStatement, readPayload } from "../workers/api/d1-write/outbox";
import { repoSupabase, PgliteRest } from "./d1-sync/pglite-supabase";
import { OTHER, setupHarness, USER, type Harness } from "./d1-sync/write-harness";

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

const U = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const TS = "2026-11-01T00:00:00.000000Z";

function insertOutbox(h: Harness, rows: Parameters<typeof outboxStatement>[0][]) {
  for (const row of rows) {
    const statement = outboxStatement(row, 1);
    h.db.run(statement.sql, ...statement.params);
  }
}

async function recorder() {
  const h = await setupHarness({ serviceKey: true });
  const env = h.env as never;
  h.db.run("INSERT INTO likes (story_id, user_id, created_at) VALUES ('sts2-codex:card:a', ?1, ?2)", USER, TS);
  h.db.run("INSERT INTO comments (id, story_id, user_id, nickname, content, created_at) VALUES (?1, 'k', ?2, '닉', '내용', ?3)", U(1), USER, TS);
  for (const [service, table] of [["combo", "post_combo"], ["chemical_x", "post_chemical_x"]] as const) {
    h.db.run("INSERT INTO posts (service, id, user_id, nickname, summary, created_at) VALUES (?1, ?2, ?3, '닉', 's', ?4)", service, U(2), USER, TS);
    h.db.run(`INSERT INTO ${table} (post_id, content, content_text) VALUES (?1, '[{"t":"x"}]', '본문입니다')`, U(2));
  }

  await check("seq order, env on env tables, owner in deletes, documents spliced as JSON", async () => {
    insertOutbox(h, [
      { table: "likes", op: "insert", match: { story_id: "sts2-codex:card:a", user_id: USER }, payload: readPayload("likes") },
      { table: "comments", op: "insert", match: { id: U(1) }, payload: readPayload("comments") },
      { table: "combo_posts", op: "insert", match: { id: U(2) }, payload: readPayload("posts") },
      { table: "comments", op: "delete", match: { id: U(9), user_id: USER }, payload: null },
      { table: "comment_likes", op: "delete", match: { comment_id: U(1), user_id: USER }, payload: null },
    ]);
    const report = await mirrorOutbox(env);
    assert.deepEqual([report.ran, report.sent, report.rejected], [true, 5, 0]);
    const calls = h.supabase.restCalls();
    assert.deepEqual(calls.map((entry) => `${entry.method} ${entry.url.pathname}`), [
      "POST /rest/v1/likes", "POST /rest/v1/comments", "POST /rest/v1/combo_posts", "DELETE /rest/v1/comments", "DELETE /rest/v1/comment_likes",
    ]);
    assert.equal(calls[0].url.searchParams.get("on_conflict"), "story_id,user_id,env");
    assert.match(calls[0].headers.get("prefer") ?? "", /resolution=ignore-duplicates/);
    assert.equal(calls[0].headers.get("apikey"), "sb_secret_test");
    assert.ok(calls.every((entry) => entry.headers.get("authorization") === null), "a new-format secret key is never sent as a bearer");
    assert.deepEqual(JSON.parse(calls[0].body), { story_id: "sts2-codex:card:a", user_id: USER, created_at: TS, env: "development" });
    const post = JSON.parse(calls[2].body) as Record<string, unknown>;
    assert.deepEqual(post.content, [{ t: "x" }]);
    assert.deepEqual(post.resources, []);
    assert.ok(!("like_count" in post) && !("comment_count" in post), "derived counts are never sent");
    assert.equal(calls[3].url.search, `?id=eq.${U(9)}&user_id=eq.${USER}&env=eq.development`);
    assert.equal(calls[4].url.search, `?comment_id=eq.${U(1)}&user_id=eq.${USER}`, "comment_likes has no env");
    assert.deepEqual(await outboxHealth(h.db), { outbox: 0, openOutRejects: 0 });
  });

  await check("a permanent refusal parks the row; later rows of the same key wait, other keys go on", async () => {
    h.supabase.calls = [];
    h.supabase.answers = [{ status: 409, code: "23503" }];
    insertOutbox(h, [
      { table: "combo_posts", op: "insert", match: { id: U(2) }, payload: readPayload("posts") },
      { table: "chemical_posts", op: "insert", match: { id: U(2) }, payload: readPayload("posts") },
      { table: "combo_posts", op: "insert", match: { id: U(2) }, payload: readPayload("posts") },
      { table: "likes", op: "delete", match: { story_id: "sts2-codex:card:a", user_id: USER }, payload: null },
    ]);
    const report = await mirrorOutbox(env);
    assert.deepEqual([report.sent, report.rejected], [2, 1]);
    assert.deepEqual(h.supabase.restCalls().map((entry) => entry.url.pathname), ["/rest/v1/combo_posts", "/rest/v1/chemical_posts", "/rest/v1/likes"],
      "the same id in another post table is not blocked");
    const left = h.outbox();
    assert.deepEqual(left.map((entry) => [entry.table_name, entry.match.id]), [["combo_posts", U(2)]], "the same key waits behind its reject");
    const reject = h.db.one("SELECT direction, table_name, d1_table, row_key, op, reason, error FROM sync_rejects WHERE resolved_at IS NULL")!;
    assert.deepEqual(reject, { direction: "out", table_name: "combo_posts", d1_table: "posts", row_key: canonicalKey(JSON.stringify({ id: U(2) })), op: "insert", reason: "supabase_4xx", error: "23503" });
    // Next run: the reject is retried first (the current D1 row), then the waiting row goes.
    h.supabase.calls = [];
    const next = await mirrorOutbox(env);
    assert.deepEqual([next.retriedRejects, next.resolvedRejects, next.sent], [1, 1, 1]);
    assert.deepEqual(await outboxHealth(h.db), { outbox: 0, openOutRejects: 0 });
  });

  await check("a transient failure stops in order and backs the head row off", async () => {
    h.supabase.calls = [];
    h.supabase.answers = [{ status: 503 }];
    insertOutbox(h, [
      { table: "comments", op: "insert", match: { id: U(1) }, payload: readPayload("comments") },
      { table: "likes", op: "insert", match: { story_id: "sts2-codex:card:a", user_id: USER }, payload: readPayload("likes") },
    ]);
    const report = await mirrorOutbox(env);
    assert.equal(report.sent, 0);
    assert.equal(h.supabase.restCalls().length, 1, "nothing after the failed row is sent");
    const head = h.db.one("SELECT attempts, next_attempt_at, last_error FROM outbox ORDER BY seq LIMIT 1")!;
    assert.equal(head.attempts, 1);
    assert.ok(Number(head.next_attempt_at) > Date.now());
    assert.equal(head.last_error, "http_503");
    assert.equal((await mirrorOutbox(env)).reason, "backoff");
    h.db.run("UPDATE outbox SET next_attempt_at = 0");
    assert.equal((await mirrorOutbox(env)).sent, 2);
    assert.equal(h.outbox().length, 0);
    // 401/403/429 are transient too: a bad key must not turn the outbox into rejects.
    insertOutbox(h, [{ table: "likes", op: "delete", match: { story_id: "x", user_id: USER }, payload: null }]);
    h.supabase.answers = [{ status: 401 }];
    assert.equal((await mirrorOutbox(env)).rejected, 0);
    h.db.run("UPDATE outbox SET next_attempt_at = 0");
    assert.equal((await mirrorOutbox(env)).sent, 1);
  });

  await check("a key gone from D1 is a no-op; one run at a time (lease)", async () => {
    insertOutbox(h, [{ table: "comments", op: "insert", match: { id: U(77) }, payload: readPayload("comments") }]);
    h.supabase.calls = [];
    assert.equal((await mirrorOutbox(env)).sent, 1);
    assert.equal(h.supabase.restCalls().length, 0);
    h.db.run("UPDATE sync_state SET lease_until = ?1 WHERE name = 'outbox_out'", Date.now() + 30_000);
    assert.equal((await mirrorOutbox(env)).reason, "leased");
    h.db.run("UPDATE sync_state SET lease_until = 0 WHERE name = 'outbox_out'");
    assert.equal((await mirrorOutbox({ ...(h.env as object), API_SUPABASE_SECRET_KEY: "sb_publishable_x" } as never)).reason, "no_config", "only a secret key");
    const fallback = { ...(h.env as object), API_SUPABASE_SECRET_KEY: undefined, API_SUPABASE_SERVICE_KEY: "sb_secret_test" };
    assert.notEqual((await mirrorOutbox(fallback as never)).reason, "no_config", "the step 4 name is read when the shared one is unset");
  });

  await check("env-less puzzlebox_players: skipped (dropped) by a development Worker, sent by production", async () => {
    h.db.run("INSERT INTO puzzlebox_players (user_id, nickname, updated_at) VALUES (?1, '닉', ?2)", USER, TS);
    insertOutbox(h, [{ table: "puzzlebox_players", op: "upsert", match: { user_id: USER }, payload: readPayload("puzzlebox_players") }]);
    h.supabase.calls = [];
    await mirrorOutbox(env);
    assert.equal(h.supabase.restCalls().length, 0);
    assert.equal(h.outbox().length, 0);
    insertOutbox(h, [{ table: "puzzlebox_players", op: "upsert", match: { user_id: USER }, payload: readPayload("puzzlebox_players") }]);
    await mirrorOutbox({ ...(h.env as object), API_DATA_ENV: "production" } as never);
    const [call] = h.supabase.restCalls();
    assert.equal(call.url.searchParams.get("on_conflict"), "user_id");
    const body = JSON.parse(call.body) as Record<string, unknown>;
    assert.ok(!("env" in body) && !("hidden" in body), "no env, and the operator's hidden switch is never mirrored");
  });

  await check("rows waiting behind a reject do not fill the run: later keys still go", async () => {
    h.supabase.calls = [];
    h.db.run("INSERT INTO sync_rejects (direction, ref, table_name, d1_table, row_key, op, reason, payload, error, first_at, last_at) VALUES ('out', 9001, 'likes', 'likes', ?1, 'delete', 'supabase_4xx', '{}', '23503', 1, 1)",
      canonicalKey(JSON.stringify({ story_id: "stuck", user_id: USER })));
    const stuck = Array.from({ length: 25 }, () => ({ table: "likes", op: "delete" as const, match: { story_id: "stuck", user_id: USER }, payload: null }));
    insertOutbox(h, [...stuck, { table: "likes", op: "delete", match: { story_id: "free", user_id: USER }, payload: null }]);
    h.supabase.answers = [{ status: 409, code: "23503" }];
    const report = await mirrorOutbox(env);
    assert.deepEqual([report.retriedRejects, report.resolvedRejects, report.sent], [1, 0, 1]);
    assert.deepEqual(h.supabase.restCalls().map((entry) => entry.url.searchParams.get("story_id")), ["eq.stuck", "eq.free"]);
    assert.equal(h.outbox().length, 25, "the stuck key's rows wait behind its reject");
    // After a write the run leaves rejects to the cron, but their keys still wait.
    h.supabase.calls = [];
    const after = await mirrorOutbox(env, { maxRows: 5, statementBudget: 20, retryRejects: false });
    assert.deepEqual([after.retriedRejects, after.sent, h.supabase.restCalls().length], [0, 0, 0]);
    h.db.run("UPDATE sync_rejects SET resolved_at = 1 WHERE ref = 9001");
    h.db.run("DELETE FROM outbox");
  });

  await check("a run stays inside its D1 statement budget", async () => {
    const db = { get statements() { return h.db.log.length; } };
    insertOutbox(h, Array.from({ length: 30 }, (_, i) => ({ table: "comments", op: "insert" as const, match: { id: U(500 + i) }, payload: readPayload("comments") })));
    for (const budget of [45, 20]) {
      const before = db.statements;
      const report = await mirrorOutbox(env, { statementBudget: budget });
      assert.ok(db.statements - before <= budget, `${db.statements - before} statements for a budget of ${budget}`);
      assert.ok(report.sent > 0 && report.remaining);
    }
    while (h.outbox().length) await mirrorOutbox(env);
  });

  await check("the cron call is inert unless API_RUNTIME_FLAGS is d1 and a source is d1", async () => {
    const db = { get statements() { return h.db.log.length; } };
    insertOutbox(h, [{ table: "likes", op: "delete", match: { story_id: "cron", user_id: USER }, payload: null }]);
    let before = db.statements;
    assert.equal(await scheduledOutboxMirror({ ...(h.env as object), API_RUNTIME_FLAGS: "off" } as never), null);
    assert.equal(db.statements, before, "production today: no D1 read at all");
    for (const group of WRITE_GROUPS) h.setFlag(sourceFlagKey(group), "supabase");
    before = db.statements;
    assert.equal(await scheduledOutboxMirror(env), null);
    assert.equal(db.statements - before, 1, "only the gate read");
    for (const group of WRITE_GROUPS) h.setFlag(sourceFlagKey(group), "d1");
    assert.equal((await scheduledOutboxMirror(env))?.sent, 1);
    assert.equal(h.outbox().length, 0);
  });
}

async function onPglite() {
  const pg = await repoSupabase({ contactWhen: true });
  await pg.query("insert into auth.users (id) values ($1), ($2)", [USER, OTHER]);
  const rest = new PgliteRest(pg);
  const h = await setupHarness({ serviceKey: true });
  const realHandle = h.supabase.handle.bind(h.supabase);
  globalThis.fetch = (async (input: Request | string | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    return new URL(request.url).pathname.startsWith("/rest/v1/") ? rest.handle(request) : realHandle(request);
  }) as typeof fetch;
  const write = async (path: string, init: Parameters<Harness["call"]>[1]) => {
    const res = await h.call(path, init);
    await h.ctx.drain();
    for (let i = 0; i < 5 && h.outbox().length; i += 1) await mirrorOutbox(h.env as never);
    return res;
  };
  const one = async (sql: string, params: unknown[] = []) => (await pg.query<Record<string, unknown>>(sql, params)).rows[0];

  let comboId = "";
  await check("posts, comments, likes and reactions: Supabase rows equal D1's, and Supabase's triggers recount", async () => {
    const created = await write("/api/write/toybox-post?service=combo", {
      method: "POST",
      body: { user_id: USER, nickname: "콤보왕", content: [{ type: "p", text: "본문" }], content_text: "콤보 본문입니다", resources: [{ type: "card", id: "bash" }, { type: "relic", id: "anchor" }], env: "development", palette_id: "red" },
    });
    comboId = String((created.json as unknown as Array<Record<string, unknown>>)[0].id);
    const sbPost = await one("select user_id::text, nickname, content, resources, palette_id, env, created_at = $2::timestamptz as same_time from public.combo_posts where id = $1", [comboId, h.db.one("SELECT created_at FROM posts WHERE id = ?1", comboId)!.created_at]);
    assert.deepEqual(sbPost, { user_id: USER, nickname: "콤보왕", content: [{ type: "p", text: "본문" }], resources: [{ type: "card", id: "bash" }, { type: "relic", id: "anchor" }], palette_id: "red", env: "development", same_time: true });
    const key = `c-c-c-combo:${comboId}`;
    const comment = await write("/api/write/comments", { method: "POST", body: { threadKey: key, nickname: "닉", content: "좋은 콤보" }, as: OTHER });
    const commentId = String((comment.json.comment as Record<string, unknown>).id);
    await write(`/api/write/likes?key=${encodeURIComponent(key)}`, { method: "PUT", as: OTHER });
    await write(`/api/write/comment-likes?id=${commentId}`, { method: "PUT" });
    await write("/api/write/reactions", { method: "PUT", body: { resourceType: "card", resourceId: "bash", gameVersion: "0.107.1", kind: "buff" } });
    await write("/api/write/reactions", { method: "PUT", body: { resourceType: "card", resourceId: "bash", gameVersion: "0.107.1", kind: "nerf" }, as: OTHER });
    assert.deepEqual(await one("select like_count, comment_count from public.combo_posts where id = $1", [comboId]), { like_count: 1, comment_count: 1 }, "Supabase triggers");
    assert.deepEqual(h.db.one("SELECT like_count, comment_count FROM posts WHERE id = ?1", comboId), { like_count: 1, comment_count: 1 }, "D1 recounts");
    assert.deepEqual(await one("select buff_count, nerf_count from public.resource_reaction_counts where resource_id = 'bash'"), { buff_count: 1, nerf_count: 1 });
    assert.equal((await one("select count(*)::int as n from public.comment_likes where comment_id = $1", [commentId])).n, 1);
    await write(`/api/write/comments?id=${commentId}`, { method: "DELETE", as: OTHER });
    assert.deepEqual(await one("select comment_count from public.combo_posts where id = $1", [comboId]), { comment_count: 0 });
    assert.equal((await one("select count(*)::int as n from public.comments")).n, 0);
  });

  await check("this-or-that, tournament play (RPC), drafts and bodies", async () => {
    const tot = await write("/api/write/toybox-post?service=this_or_that", {
      method: "POST",
      body: { user_id: USER, nickname: "닉", left_type: "card", left_id: "a", right_type: "card", right_id: "b", reason: "어느 쪽?", env: "development" },
    });
    const totId = String((tot.json as unknown as Array<Record<string, unknown>>)[0].id);
    await write(`/api/write/this-or-that/like?id=${totId}`, { method: "PUT", as: OTHER });
    await write(`/api/write/this-or-that/vote?id=${totId}`, { method: "PUT", body: { choice: "left", surface: "index" }, as: OTHER });
    assert.deepEqual(await one("select like_count, left_vote_count, right_vote_count from public.this_or_that_posts where id = $1", [totId]), { like_count: 1, left_vote_count: 1, right_vote_count: 0 });
    assert.equal((await one("select created_surface from public.this_or_that_post_votes where post_id = $1", [totId])).created_surface, "index");
    await write(`/api/write/this-or-that/vote?id=${totId}`, { method: "DELETE", as: OTHER });
    assert.equal((await one("select left_vote_count from public.this_or_that_posts where id = $1", [totId])).left_vote_count, 0);

    const pool = ["a", "b", "c", "d"].map((id) => ({ type: "relic", id }));
    const ft = await write("/api/write/toybox-post?service=favorite_tournament", { method: "POST", body: { user_id: USER, nickname: "닉", title: "월드컵", preset_key: "custom", game_version: "0.107", pool, env: "development" } });
    const ftId = String((ft.json as unknown as Array<Record<string, unknown>>)[0].id);
    assert.equal((await one("select game_version from public.favorite_tournament_posts where id = $1", [ftId])).game_version, "0.107", "write-only column from the outbox extra");
    const m = (l: string, r: string, winner: string) => ({ left_type: "relic", left_id: l, right_type: "relic", right_id: r, winner });
    await write("/api/write/favorite-tournament/play", { method: "POST", body: { tournamentId: ftId, startingSize: 4, championType: "relic", championId: "a", matches: [m("a", "b", "left"), m("c", "d", "right"), m("a", "d", "left")] }, as: OTHER });
    assert.equal((await one("select play_count from public.favorite_tournament_posts where id = $1", [ftId])).play_count, 1);
    const sbStats = (await pg.query<Record<string, unknown>>("select resource_id, match_appearances, match_wins, championships, current_rank, rank_history from public.favorite_tournament_candidate_stats where tournament_id = $1 order by resource_id", [ftId])).rows;
    const d1Stats = h.db.rows("SELECT resource_id, match_appearances, match_wins, championships, current_rank, rank_history FROM favorite_tournament_candidate_stats WHERE tournament_id = ?1 ORDER BY resource_id", ftId)
      .map((row) => ({ ...row, rank_history: JSON.parse(String(row.rank_history)) }));
    assert.deepEqual(sbStats, d1Stats, "the stats D1 computed, as state");
    // A replay of the same RPC (a retried send) changes nothing.
    const playId = String(h.db.one("SELECT id FROM favorite_tournament_plays")!.id);
    insertOutbox(h, [{ table: "favorite_tournament_plays", op: "rpc", match: { id: playId }, payload: { read: "favorite_tournament_plays", fn: "mirror_favorite_tournament_play" } }]);
    await mirrorOutbox(h.env as never);
    assert.equal((await one("select play_count from public.favorite_tournament_posts where id = $1", [ftId])).play_count, 1);

    const draft = await write("/api/write/pagestorm/drafts", { method: "POST", body: { user_id: USER, nickname: "닉", title: "초안", content: { type: "doc" }, content_text: "초안 본문", env: "development" } });
    const draftId = String((draft.json as unknown as Array<Record<string, unknown>>)[0].id);
    await write(`/api/write/pagestorm/drafts?id=${draftId}`, { method: "PATCH", body: { title: "고친 초안" } });
    assert.equal((await one("select title from public.pagestorm_drafts where id = $1", [draftId])).title, "고친 초안");
    await write("/api/write/defragment-body", { method: "PUT", body: { env: "development", source_service: "combo", source_id: comboId, user_id: USER, nickname: "닉", content: [], content_text: "조각 본문" } });
    assert.equal((await one("select content_text from public.defragment_bodies where source_id = $1", [comboId])).content_text, "조각 본문");
  });

  await check("runs (text RPC), puzzlebox, stories and contact", async () => {
    const run = { id: "r00000000000000c1", donor_user_id: USER, donor_nickname: "기증자", env: "development", seed: "SEED", build: "v", character: "CHARACTER.SILENT", ascension: 1, win: false, start_time: 1, run_time: 2, acts_count: 3, total_floors: 30, badges: [], cover_spec: { auto: true } };
    const raw = JSON.stringify({ seed: "SEED", text: "따옴표 \" 와 줄바꿈 \n 그리고 \\ 역슬래시" });
    const rowText = JSON.stringify(run);
    await write("/api/write/history-runs/share", { method: "POST", raw: `[${rowText},${raw}]`, headers: { "x-slseoun-row-length": String(rowText.length) } });
    assert.deepEqual(await one("select raw, donor_nickname, cover_spec, win from public.runs where id = $1", [run.id]), { raw, donor_nickname: "기증자", cover_spec: { auto: true }, win: false });
    await write(`/api/write/history-runs/cover?id=${run.id}`, { method: "PATCH", body: { coverSpec: { auto: false, kind: "relic" } } });
    await write("/api/write/history-runs/nicknames", { method: "POST", body: { nickname: "새닉" } });
    assert.deepEqual(await one("select cover_spec, donor_nickname from public.runs where id = $1", [run.id]), { cover_spec: { auto: false, kind: "relic" }, donor_nickname: "새닉" });

    const board = { game: "connections", board: "1", run: { guesses: [[0, 0, 0, 0], [1, 1, 1, 1], [2, 2, 2, 2], [3, 3, 3, 3]], rocks: 0, rocksLeft: 3, shown: { token: true, local: true, original: true } }, player: { nickname: "퍼즐러" } };
    await write("/api/write/puzzlebox/runs", { method: "POST", body: board });
    const sbRun = await one("select id, score, perfect from public.puzzlebox_runs");
    assert.ok(Number(sbRun.id) >= 2 ** 40, "the D1 run id went in (GENERATED BY DEFAULT)");
    assert.deepEqual([sbRun.score, sbRun.perfect], [h.db.one("SELECT score FROM puzzlebox_runs")!.score, true]);
    assert.deepEqual(await one("select players, level_solved from public.puzzlebox_board_stats where board = '1'"), { players: 1, level_solved: [1, 1, 1, 1] });
    assert.equal((await one("select count(*)::int as n from public.puzzlebox_players")).n, 0, "testbed keeps puzzlebox_players to itself");

    await write("/api/write/stories", { method: "POST", body: { sentence: "새 이야기입니다", nickname: "닉", patchLineId: "v0.1:1", source: "v0.1", linkedEntities: [] } });
    assert.equal((await one("select count(*)::int as n from public.community_stories where user_id = $1", [USER])).n, 1);
    await write("/api/write/contact-inquiries", { method: "POST", body: { category: "bug", message: "버그가 있습니다. 확인 부탁.", replyEmail: null, pagePath: "/", serviceLocale: "ko", gameLocale: "kor", viewportWidth: 390, viewportHeight: 844 } });
    assert.deepEqual(await one("select user_id::text, viewport_width, status from public.contact_inquiries"), { user_id: USER, viewport_width: 390, status: "new" },
      "needs the step 4 trigger WHEN (design 5.5) for service-role inserts");
  });

  await check("a refusal from a real FK is parked, then resolved once the parent exists", async () => {
    const orphan = U(500);
    h.db.run("INSERT INTO posts (service, id, user_id, nickname, summary, created_at) VALUES ('this_or_that', ?1, ?2, '닉', '이유', ?3)", orphan, OTHER, TS);
    h.db.run("INSERT INTO post_this_or_that (post_id, left_type, left_id, right_type, right_id, reason) VALUES (?1, 'card', 'a', 'card', 'b', '이유입니다')", orphan);
    await write(`/api/write/this-or-that/like?id=${orphan}`, { method: "PUT" });
    assert.deepEqual(await outboxHealth(h.db), { outbox: 0, openOutRejects: 1 });
    await pg.query("insert into public.this_or_that_posts (id, user_id, nickname, left_type, left_id, right_type, right_id, reason, env) values ($1, $2, '닉', 'card', 'a', 'card', 'b', '이유입니다', 'development')", [orphan, OTHER]);
    await mirrorOutbox(h.env as never);
    assert.deepEqual(await outboxHealth(h.db), { outbox: 0, openOutRejects: 0 });
    assert.equal((await one("select like_count from public.this_or_that_posts where id = $1", [orphan])).like_count, 1);
  });

  await check("deletes match the owner and cascade on both sides", async () => {
    await write(`/api/write/toybox-post?service=combo&id=${comboId}`, { method: "DELETE" });
    assert.equal((await one("select count(*)::int as n from public.combo_posts")).n, 0);
    assert.equal((await one("select count(*)::int as n from public.defragment_bodies")).n, 1, "Supabase keeps the orphan body, as today (design 4.3)");
    assert.deepEqual(await outboxHealth(h.db), { outbox: 0, openOutRejects: 0 });
  });
  await pg.close();
}

async function main() {
  const realFetch = globalThis.fetch;
  try {
    await recorder();
    await onPglite();
  } finally {
    globalThis.fetch = realFetch;
  }
  console.log(`d1-mirror: ${checks} checks passed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

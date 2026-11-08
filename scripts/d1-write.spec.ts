/**
 * Step 5 D1 write handlers (docs/SUPABASE_EXIT_PLAN.md 7.3 step 5, docs/supabase-exit/D1_SCHEMA_DESIGN.md
 * 2.3, 5.5) through the real main Worker and /api router, on a local SQLite copy of the D1 schema
 * (d1/migrations). Every write kind: accepted rows, refusals equal to today's PostgREST answers,
 * recounts, outbox rows; the write gate (paused 503, the Supabase source untouched).
 * Usage: tsx scripts/d1-write.spec.ts
 */
import assert from "node:assert/strict";

import { WRITE_PAUSED_KEY, WRITE_GROUPS, sourceFlagKey } from "../src/lib/write-source-flags";
import { D1_WRITE_HANDLERS } from "../workers/api/d1-write";
import { pgTimestampText } from "../workers/api/d1-write/db";
import { parseGateRows, readWriteGate, resetWriteGateForTest, supabaseInSyncAllowed } from "../workers/api/d1-write/gate";
import { API_ROUTES } from "../workers/api/routes";
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

function seedPost(h: Harness, service: string, id: string, owner: string | null, extra: Record<string, unknown> = {}) {
  h.db.run(
    "INSERT INTO posts (service, id, user_id, nickname, title, summary, like_count, comment_count, created_at) VALUES (?1, ?2, ?3, '닉', ?4, 's', ?5, ?6, ?7)",
    service, id, owner, (extra.title as string) ?? null, (extra.like_count as number) ?? 0, (extra.comment_count as number) ?? 0, TS,
  );
  if (service === "combo") h.db.run("INSERT INTO post_combo (post_id, content, content_text) VALUES (?1, '[]', '콤보 본문')", id);
  if (service === "this_or_that") {
    h.db.run("INSERT INTO post_this_or_that (post_id, left_type, left_id, right_type, right_id, reason) VALUES (?1, 'card', 'a', 'card', 'b', '이유입니다')", id);
  }
  if (service === "favorite_tournament") {
    h.db.run("INSERT INTO post_favorite_tournament (post_id, note, preset_key) VALUES (?1, '', 'custom')", id);
    (extra.pool as string[] ?? []).forEach((rid, ord) => {
      h.db.run("INSERT INTO post_favorite_tournament_pool (post_id, ord, resource_type, resource_id) VALUES (?1, ?2, 'relic', ?3)", id, ord, rid);
    });
  }
  if (service === "history_course") {
    h.db.run("INSERT INTO post_history_course (post_id, seed, build, \"character\", ascension, win, acts_count) VALUES (?1, 'SEED', 'v', 'C', 0, 1, 3)", id);
    h.db.run("INSERT INTO post_history_course_file (post_id, raw) VALUES (?1, '{}')", id);
  }
}

async function engagement() {
  const h = await setupHarness();
  const combo = U(1);
  seedPost(h, "combo", combo, OTHER);
  const key = `c-c-c-combo:${combo}`;

  await check("comment create: row, thread recount, owner post copy, outbox row", async () => {
    const res = await h.call("/api/write/comments", { method: "POST", body: { threadKey: key, nickname: " 아이언 ", content: "좋은 카드", author: { avatarId: "IRONCLAD", paletteSwapped: true } } });
    assert.equal(res.status, 201);
    const comment = res.json.comment as Record<string, unknown>;
    assert.equal(comment.nickname, "아이언");
    assert.equal(comment.user_id, USER);
    assert.equal(comment.avatar_id, "IRONCLAD");
    assert.equal(comment.palette_swapped, true);
    assert.equal(comment.like_count, 0);
    assert.match(String(comment.created_at), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?\+00:00$/, "PostgREST timestamp form");
    const row = h.db.one("SELECT * FROM comments WHERE id = ?1", String(comment.id))!;
    assert.equal(row.story_id, key);
    assert.equal(row.palette_swapped, 1);
    assert.deepEqual(h.db.one("SELECT comment_count FROM threads WHERE thread_key = ?1", key), { comment_count: 1 });
    assert.deepEqual(h.db.one("SELECT comment_count FROM posts WHERE service = 'combo' AND id = ?1", combo), { comment_count: 1 });
    const out = h.outbox().at(-1)!;
    assert.equal(out.table_name, "comments");
    assert.equal(out.op, "insert");
    assert.deepEqual(out.match, { id: comment.id });
    assert.deepEqual(out.payload, { read: "comments" });
  });

  await check("comment create refusals: bad body 400, no token 401", async () => {
    assert.equal((await h.call("/api/write/comments", { method: "POST", body: { threadKey: key, nickname: "", content: "좋은" } })).status, 400);
    assert.equal((await h.call("/api/write/comments", { method: "POST", body: { threadKey: key, nickname: "닉", content: "x" } })).status, 400);
    const anon = await h.call("/api/write/comments", { method: "POST", body: { threadKey: key, nickname: "닉", content: "좋은" }, as: null });
    assert.equal(anon.status, 401);
    assert.equal(anon.json.error, "token_invalid");
  });

  const commentId = String((h.db.one("SELECT id FROM comments") as { id: string }).id);

  await check("comment likes: put counts, repeat is a no-op success, missing comment 404, delete", async () => {
    const put = await h.call(`/api/write/comment-likes?id=${commentId}`, { method: "PUT" });
    assert.deepEqual([put.status, put.json], [200, { liked: true, count: 1 }]);
    const again = await h.call(`/api/write/comment-likes?id=${commentId}`, { method: "PUT", as: OTHER });
    assert.deepEqual(again.json, { liked: true, count: 2 });
    assert.deepEqual((await h.call(`/api/write/comment-likes?id=${commentId}`, { method: "PUT" })).json, { liked: true, count: 2 });
    assert.equal(h.db.one("SELECT like_count FROM comments WHERE id = ?1", commentId)!.like_count, 2);
    const missing = await h.call(`/api/write/comment-likes?id=${U(999)}`, { method: "PUT" });
    assert.deepEqual([missing.status, missing.json.error], [404, "not_found"]);
    const del = await h.call(`/api/write/comment-likes?id=${commentId}`, { method: "DELETE" });
    assert.deepEqual(del.json, { liked: false, count: 1 });
    const rows = h.outbox().filter((row) => row.table_name === "comment_likes");
    assert.deepEqual(rows.map((row) => row.op), ["insert", "insert", "insert", "delete"]);
    assert.deepEqual(rows.at(-1)!.match, { comment_id: commentId, user_id: USER });
  });

  await check("thread likes: recount, owner copy, count answer, other keys have no owner", async () => {
    const put = await h.call(`/api/write/likes?key=${encodeURIComponent(key)}`, { method: "PUT" });
    assert.deepEqual(put.json, { liked: true, count: 1 });
    assert.deepEqual((await h.call(`/api/write/likes?key=${encodeURIComponent(key)}`, { method: "PUT" })).json, { liked: true, count: 1 });
    assert.deepEqual(h.db.one("SELECT like_count, comment_count FROM posts WHERE service = 'combo' AND id = ?1", combo), { like_count: 1, comment_count: 1 });
    const codex = "sts2-codex:card:bash";
    assert.deepEqual((await h.call(`/api/write/likes?key=${codex}`, { method: "PUT", as: OTHER })).json, { liked: true, count: 1 });
    assert.deepEqual((await h.call(`/api/write/likes?key=${codex}`, { method: "DELETE", as: OTHER })).json, { liked: false, count: 0 });
    assert.deepEqual((await h.call(`/api/write/likes?key=${encodeURIComponent(key)}`, { method: "DELETE" })).json, { liked: false, count: 0 });
    assert.equal(h.db.one("SELECT like_count FROM posts WHERE service = 'combo' AND id = ?1", combo)!.like_count, 0);
    const likes = h.outbox().filter((row) => row.table_name === "likes");
    assert.deepEqual(likes.at(-1)!.match, { story_id: key, user_id: USER });
    assert.equal(likes.at(-1)!.op, "delete");
  });

  await check("reactions: kinds and totals; removing a reaction nobody made creates no totals row", async () => {
    const body = (kind: string | null) => ({ resourceType: "card", resourceId: "bash", gameVersion: "0.107.1", kind });
    assert.deepEqual((await h.call("/api/write/reactions", { method: "PUT", body: body("buff") })).json, { kind: "buff", counts: { buff: 1, nerf: 0, rework: 0 } });
    assert.deepEqual((await h.call("/api/write/reactions", { method: "PUT", body: body("nerf"), as: OTHER })).json, { kind: "nerf", counts: { buff: 1, nerf: 1, rework: 0 } });
    assert.deepEqual((await h.call("/api/write/reactions", { method: "PUT", body: body("rework") })).json, { kind: "rework", counts: { buff: 0, nerf: 1, rework: 1 } });
    assert.deepEqual((await h.call("/api/write/reactions", { method: "PUT", body: body(null) })).json, { kind: null, counts: { buff: 0, nerf: 1, rework: 0 } });
    const fresh = { resourceType: "relic", resourceId: "anchor", gameVersion: "0.107.1", kind: null };
    assert.deepEqual((await h.call("/api/write/reactions", { method: "PUT", body: fresh })).json, { kind: null, counts: { buff: 0, nerf: 0, rework: 0 } });
    assert.equal(h.db.rows("SELECT * FROM resource_reaction_counts WHERE resource_id = 'anchor'").length, 0);
    assert.equal((await h.call("/api/write/reactions", { method: "PUT", body: { ...fresh, kind: "boost" } })).status, 400);
    const rows = h.outbox().filter((row) => row.table_name === "resource_reactions");
    assert.deepEqual(rows.map((row) => row.op), ["upsert", "upsert", "upsert", "delete", "delete"]);
    assert.deepEqual(rows[0].match, { resource_id: "bash", resource_type: "card", game_version: "0.107.1", user_id: USER });
  });

  await check("comment delete: owner only, recount, outbox delete with the owner", async () => {
    const other = await h.call(`/api/write/comments?id=${commentId}`, { method: "DELETE", as: OTHER });
    assert.deepEqual([other.status, other.json.error], [404, "not_found"]);
    const own = await h.call(`/api/write/comments?id=${commentId}`, { method: "DELETE" });
    assert.deepEqual([own.status, own.json], [200, { deleted: true }]);
    assert.equal(h.db.rows("SELECT * FROM comment_likes WHERE comment_id = ?1", commentId).length, 0, "likes cascade");
    assert.deepEqual(h.db.one("SELECT comment_count FROM threads WHERE thread_key = ?1", key), { comment_count: 0 });
    assert.equal(h.db.one("SELECT comment_count FROM posts WHERE service = 'combo' AND id = ?1", combo)!.comment_count, 0);
    const out = h.outbox().at(-1)!;
    assert.deepEqual([out.table_name, out.op, out.match], ["comments", "delete", { id: commentId, user_id: USER }]);
  });
}

async function storiesAndContact() {
  const h = await setupHarness();
  await check("story create and delete", async () => {
    const created = await h.call("/api/write/stories", {
      method: "POST",
      body: { sentence: " 새 이야기입니다 ", nickname: "닉", entityType: "card", entityId: "bash", patchLineId: "v0.1:1", source: "v0.1", linkedEntities: [{ entityType: "card", entityId: "bash" }] },
    });
    assert.equal(created.status, 201);
    const row = created.json.row as Record<string, unknown>;
    assert.equal(row.sentence, "새 이야기입니다");
    assert.equal(row.env, "development");
    assert.equal(row.static_story_id, null);
    assert.deepEqual(row.tags, []);
    const stored = h.db.one("SELECT * FROM community_stories WHERE id = ?1", String(row.id))!;
    assert.equal(stored.linked_entities, "[{\"entityType\":\"card\",\"entityId\":\"bash\"}]");
    assert.deepEqual((await h.call(`/api/write/stories?id=${row.id}`, { method: "DELETE", as: OTHER })).json, { v: 1, env: "development", deleted: false });
    assert.deepEqual((await h.call(`/api/write/stories?id=${row.id}`, { method: "DELETE" })).json, { v: 1, env: "development", deleted: true });
    assert.deepEqual(h.outbox().map((entry) => [entry.table_name, entry.op]), [["community_stories", "insert"], ["community_stories", "delete"], ["community_stories", "delete"]]);
    assert.deepEqual(h.outbox().at(-1)!.match, { id: row.id, user_id: USER });
  });

  await check("contact inquiries: three an hour, viewport rides in the outbox", async () => {
    const body = { category: "bug", message: "  버그가 있습니다. 확인 부탁.  ", replyEmail: " Me@Example.COM ", pagePath: "/cards?x=1", serviceLocale: "ko", gameLocale: "kor", viewportWidth: 390, viewportHeight: 844 };
    for (let i = 0; i < 3; i += 1) assert.equal((await h.call("/api/write/contact-inquiries", { method: "POST", body })).status, 201);
    const limited = await h.call("/api/write/contact-inquiries", { method: "POST", body });
    assert.deepEqual([limited.status, limited.json.error], [429, "rate_limited"]);
    assert.equal(limited.headers.get("retry-after"), "30");
    assert.equal((await h.call("/api/write/contact-inquiries", { method: "POST", body, as: OTHER })).status, 201);
    const row = h.db.one("SELECT * FROM contact_inquiries WHERE user_id = ?1", USER)!;
    assert.deepEqual([row.message, row.reply_email, row.page_path, row.status], ["버그가 있습니다. 확인 부탁.", "me@example.com", "/cards", "new"]);
    const rows = h.outbox().filter((entry) => entry.table_name === "contact_inquiries");
    assert.equal(rows.length, 4, "no outbox row for the refused one");
    assert.deepEqual(rows[0].payload, { read: "contact_inquiries", extra: { viewport_width: 390, viewport_height: 844 } });
    assert.equal((await h.call("/api/write/contact-inquiries", { method: "POST", body: { ...body, category: "spam" } })).status, 400);
  });

  await check("replies seen: one outbox update per changed row, owner only", async () => {
    h.db.run("UPDATE contact_inquiries SET admin_response = '답장', responded_at = ?1 WHERE user_id IN (?2, ?3)", TS, USER, OTHER);
    const before = h.outbox().length;
    assert.deepEqual((await h.call("/api/write/profile/inquiries-seen", { method: "POST" })).json, {});
    const rows = h.outbox().slice(before);
    assert.equal(rows.length, 3);
    assert.ok(rows.every((entry) => entry.op === "update" && entry.match.user_id === USER));
    assert.deepEqual(rows[0].payload, { read: "contact_inquiries", columns: ["reply_seen_at"] });
    assert.equal(h.db.rows("SELECT * FROM contact_inquiries WHERE user_id = ?1 AND reply_seen_at IS NULL", USER).length, 0);
    assert.equal(h.db.rows("SELECT * FROM contact_inquiries WHERE user_id = ?1 AND reply_seen_at IS NULL", OTHER).length, 1);
    await h.call("/api/write/profile/inquiries-seen", { method: "POST" });
    assert.equal(h.outbox().length, before + 3, "nothing left to mark: no rows");
  });
}

function shareBody(row: Record<string, unknown>, raw: string): { raw: string; headers: Record<string, string> } {
  const rowText = JSON.stringify(row);
  return { raw: `[${rowText},${raw}]`, headers: { "x-slseoun-row-length": String(rowText.length) } };
}

const RUN_ROW = (id: string, donor = USER) => ({
  id, donor_user_id: donor, donor_nickname: "기증자", env: "development", seed: "SEEDX", build: "v0.107", character: "CHARACTER.SILENT",
  ascension: 3, win: true, start_time: 1762000000, run_time: 1800, acts_count: 3, total_floors: 49, badges: [{ id: "b", rarity: "gold" }],
  highlight_card: null, highlight_relic: null, note_blocks: null, cover_spec: { auto: true },
  characters: ["CHARACTER.SILENT"], game_mode: "standard", game_elements: [{ type: "card", id: "neutralize" }],
  list_facts: { cards: [], relics: [], potions: [], deck_size: 20, relic_count: 5, highlight_card: null, highlight_relic: null },
  summary_version: 1,
});

async function runs() {
  const h = await setupHarness();
  const runId = "r0000000000000a1";
  await check("run share: one run per request, raw bound unparsed, counts seeded from threads, outbox R14d", async () => {
    // A like on the run's thread before it is shared (a run shared, removed and shared again).
    h.db.run("INSERT INTO likes (story_id, user_id, created_at) VALUES (?1, ?2, ?3)", `history-course:${runId}`, OTHER, TS);
    h.db.run("INSERT INTO threads (thread_key, like_count) VALUES (?1, 1)", `history-course:${runId}`);
    const raw = "{\"seed\":\"SEEDX\",\"players\":[{\"character\":\"CHARACTER.SILENT\"}],\"note\":\"\\\"quoted\\\" , ]\"}";
    const body = shareBody(RUN_ROW(runId), raw);
    const res = await h.call("/api/write/history-runs/share", { method: "POST", raw: body.raw, headers: body.headers });
    assert.deepEqual([res.status, res.json], [201, { v: 1, env: "development", inserted: [runId] }]);
    assert.equal(h.db.one("SELECT raw FROM post_history_course_file WHERE post_id = ?1", runId)!.raw, raw);
    const post = h.db.one("SELECT user_id, nickname, summary, like_count, title FROM posts WHERE service = 'history_course' AND id = ?1", runId)!;
    assert.deepEqual(post, { user_id: USER, nickname: "기증자", summary: "SEEDX", like_count: 1, title: null });
    const run = h.db.one("SELECT win, summary_version, game_mode, characters, cover_spec, total_floors FROM post_history_course WHERE post_id = ?1", runId)!;
    assert.deepEqual(run, { win: 1, summary_version: 1, game_mode: "standard", characters: "[\"CHARACTER.SILENT\"]", cover_spec: "{\"auto\":true}", total_floors: 49 });
    const out = h.outbox().at(-1)!;
    assert.deepEqual([out.table_name, out.op, out.match, out.payload], ["runs", "upsert", { id: runId }, { read: "post_history_course" }]);
  });

  await check("run share refusals and repeats", async () => {
    const again = shareBody(RUN_ROW(runId), "{}");
    assert.deepEqual((await h.call("/api/write/history-runs/share", { method: "POST", raw: again.raw, headers: again.headers })).json.inserted, []);
    const before = h.outbox().length;
    const stolen = shareBody(RUN_ROW(runId, OTHER), "{}");
    const other = await h.call("/api/write/history-runs/share", { method: "POST", raw: stolen.raw, headers: stolen.headers, as: OTHER });
    assert.deepEqual(other.json.inserted, [], "already shared by someone else");
    assert.equal(h.outbox().length, before, "no outbox row for another donor's run");
    const forged = shareBody(RUN_ROW("r0000000000000b2", OTHER), "{}");
    assert.equal((await h.call("/api/write/history-runs/share", { method: "POST", raw: forged.raw, headers: forged.headers })).status, 403);
    assert.equal((await h.call("/api/write/history-runs/share", { method: "POST", raw: forged.raw, headers: { "x-slseoun-row-length": "5" } })).status, 400);
    const longName = shareBody({ ...RUN_ROW("r0000000000000c3"), donor_nickname: "x".repeat(21) }, "{}");
    assert.deepEqual((await h.call("/api/write/history-runs/share", { method: "POST", raw: longName.raw, headers: longName.headers })).json.error, "check_violation");
    const old = await h.call("/api/write/history-runs/batch", { method: "POST", body: [RUN_ROW("r0000000000000d4")] });
    assert.deepEqual([old.status, old.json.error], [409, "single_run_required"]);
    assert.equal((await h.call("/api/write/history-runs", { method: "POST", body: RUN_ROW("r0000000000000d4") })).json.error, "single_run_required");
  });

  await check("run cover, nicknames and delete: owner only, one outbox row per changed run", async () => {
    seedPost(h, "history_course", "r0000000000000e5", USER);
    seedPost(h, "history_course", "r0000000000000f6", OTHER);
    assert.deepEqual((await h.call(`/api/write/history-runs/cover?id=${runId}`, { method: "PATCH", body: { coverSpec: { auto: false, kind: "card" } } })).json, { v: 1, env: "development", updated: true });
    assert.equal(h.db.one("SELECT cover_spec FROM post_history_course WHERE post_id = ?1", runId)!.cover_spec, "{\"auto\":false,\"kind\":\"card\"}");
    const before = h.outbox().length;
    assert.deepEqual((await h.call("/api/write/history-runs/cover?id=r0000000000000f6", { method: "PATCH", body: { coverSpec: { auto: false } } })).json.updated, false);
    assert.equal(h.outbox().length, before, "another donor's run: no outbox row");
    assert.equal((await h.call(`/api/write/history-runs/cover?id=${runId}`, { method: "PATCH", body: { coverSpec: { pad: "x".repeat(17000) } } })).status, 400);
    const cover = h.outbox().at(-1)!;
    assert.deepEqual([cover.op, cover.match, cover.payload], ["update", { id: runId, donor_user_id: USER }, { read: "post_history_course", columns: ["cover_spec"] }]);

    const mark = h.outbox().length;
    assert.deepEqual((await h.call("/api/write/history-runs/nicknames", { method: "POST", body: { nickname: "기증자" } })).json, { v: 1, env: "development" });
    const renamed = h.outbox().slice(mark);
    assert.deepEqual(renamed.map((entry) => entry.match.id), ["r0000000000000e5"], "only the run whose nickname differs");
    assert.equal(h.db.one("SELECT nickname FROM posts WHERE id = 'r0000000000000e5'")!.nickname, "기증자");
    assert.equal(h.db.one("SELECT nickname FROM posts WHERE id = 'r0000000000000f6'")!.nickname, "닉");

    assert.deepEqual((await h.call("/api/write/history-runs?id=r0000000000000f6", { method: "DELETE" })).json.deleted, false);
    assert.deepEqual((await h.call(`/api/write/history-runs?id=${runId}`, { method: "DELETE" })).json.deleted, true);
    assert.equal(h.db.rows("SELECT * FROM post_history_course_file WHERE post_id = ?1", runId).length, 0, "the file cascades");
    assert.deepEqual(h.db.one("SELECT like_count FROM threads WHERE thread_key = ?1", `history-course:${runId}`), { like_count: 1 }, "threads stay");
    const deletes = h.outbox().filter((entry) => entry.op === "delete");
    assert.deepEqual(deletes.map((entry) => entry.match), [{ id: "r0000000000000f6", donor_user_id: USER }, { id: runId, donor_user_id: USER }]);
  });
}

const COMBO_ROW = (extra: Record<string, unknown> = {}) => ({
  user_id: USER, nickname: "콤보왕", content: [{ type: "paragraph", text: "본문" }], content_text: "  콤보 본문입니다  ",
  resources: [{ type: "card", id: "bash" }, { type: "relic", id: "anchor" }], env: "development",
  avatar_id: "IRONCLAD", avatar_kind: "character", palette_id: "red", palette_swapped: true, ...extra,
});

async function toybox() {
  const h = await setupHarness();
  let comboId = "";
  await check("post create (combo): posts + service row + children, server columns, select=* answer", async () => {
    const res = await h.call("/api/write/toybox-post?service=combo", { method: "POST", body: COMBO_ROW({ like_count: 99, created_at: "2000-01-01T00:00:00Z" }) });
    assert.equal(res.status, 201);
    const [row] = res.json as unknown as Array<Record<string, unknown>>;
    comboId = String(row.id);
    assert.deepEqual([row.like_count, row.comment_count, row.env, row.user_id, row.palette_swapped], [0, 0, "development", USER, true]);
    assert.deepEqual(row.resources, [{ type: "card", id: "bash" }, { type: "relic", id: "anchor" }]);
    assert.notEqual(String(row.created_at).slice(0, 4), "2000", "created_at is the server's");
    assert.deepEqual(h.db.one("SELECT summary, like_count FROM posts WHERE service = 'combo' AND id = ?1", comboId), { summary: "콤보 본문입니다", like_count: 0 });
    assert.equal(h.db.rows("SELECT * FROM post_combo_resources WHERE post_id = ?1 ORDER BY ord", comboId).length, 2);
    const out = h.outbox().at(-1)!;
    assert.deepEqual([out.table_name, out.op, out.match, out.payload], ["combo_posts", "insert", { id: comboId }, { read: "posts" }]);
  });

  await check("post create refusals: owner 403, unknown column 400, env 400, duplicate id 422, builtin 403, CHECK 422", async () => {
    assert.equal((await h.call("/api/write/toybox-post?service=combo", { method: "POST", body: COMBO_ROW({ user_id: OTHER }) })).json.error, "forbidden");
    assert.equal((await h.call("/api/write/toybox-post?service=combo", { method: "POST", body: COMBO_ROW({ bogus: 1 }) })).json.error, "invalid");
    assert.equal((await h.call("/api/write/toybox-post?service=combo", { method: "POST", body: COMBO_ROW({ env: "production" }) })).json.error, "invalid");
    assert.equal((await h.call("/api/write/toybox-post?service=combo", { method: "POST", body: COMBO_ROW({ id: comboId }) })).json.error, "duplicate");
    assert.equal((await h.call("/api/write/toybox-post?service=combo", { method: "POST", body: COMBO_ROW({ content_text: "x" }) })).json.error, "check_violation");
    assert.equal((await h.call("/api/write/toybox-post?service=this_or_that", { method: "POST", body: { user_id: USER, nickname: "닉", left_type: "card", left_id: "a", right_type: "card", right_id: "b", reason: "이유", vote_rate_bps: 1 } })).json.error, "invalid");
    const builtin = { user_id: USER, nickname: "닉", title: "월드컵", preset_key: "builtin:x", game_version: "0.1", pool: [] };
    assert.equal((await h.call("/api/write/toybox-post?service=favorite_tournament", { method: "POST", body: builtin })).json.error, "forbidden");
    assert.equal((await h.call("/api/write/toybox-post?service=defragment", { method: "POST", body: COMBO_ROW() })).status, 400);
    assert.equal(h.db.rows("SELECT * FROM posts").length, 1, "nothing written by a refusal");
  });

  await check("post create (transfigure, tournament): defaults, write-only columns in the outbox extra and the answer", async () => {
    const tf = await h.call("/api/write/toybox-post?service=transfigure", {
      method: "POST",
      body: { user_id: USER, nickname: "닉", resource_type: "card", resource_id: "bash", source_text: "원문", source_game_locale: "kor", content: [], content_text: "바뀐 효과", title: "  제목  ", card_top_keywords: ["exhaust"] },
    });
    assert.equal(tf.status, 201);
    const [row] = tf.json as unknown as Array<Record<string, unknown>>;
    assert.deepEqual([row.source_game_locale, row.show_upgrade, row.omit_energy_cost, row.card_top_keywords, row.extra_variants], ["kor", false, false, ["exhaust"], []]);
    assert.equal(h.db.one("SELECT summary FROM posts WHERE id = ?1", String(row.id))!.summary, "제목");
    assert.deepEqual(h.outbox().at(-1)!.payload, { read: "posts", extra: { source_game_locale: "kor" } });
    const ft = await h.call("/api/write/toybox-post?service=favorite_tournament", {
      method: "POST",
      body: { user_id: USER, nickname: "닉", title: "유물 월드컵", preset_key: "custom", game_version: "0.107", pool: [{ type: "relic", id: "a" }, { type: "relic", id: "b" }, { type: "relic", id: "c" }, { type: "relic", id: "d" }] },
    });
    const [tournament] = ft.json as unknown as Array<Record<string, unknown>>;
    assert.deepEqual([tournament.play_count, tournament.note, tournament.game_version], [0, "", "0.107"]);
    assert.equal(h.db.rows("SELECT * FROM post_favorite_tournament_pool WHERE post_id = ?1", String(tournament.id)).length, 4);
  });

  await check("post update: owner only, guard columns kept, summary and children redone, outbox update", async () => {
    const other = await h.call(`/api/write/toybox-post?service=combo&id=${comboId}`, { method: "PATCH", body: { content_text: "남의 글 고치기" }, as: OTHER });
    assert.deepEqual([other.status, other.json], [200, []]);
    const res = await h.call(`/api/write/toybox-post?service=combo&id=${comboId}`, {
      method: "PATCH",
      body: { content_text: "고친 본문입니다", resources: [{ type: "potion", id: "fire" }], like_count: 50, env: "production", created_at: "2000-01-01T00:00:00Z" },
    });
    const [row] = res.json as unknown as Array<Record<string, unknown>>;
    assert.deepEqual([row.content_text, row.like_count, row.env], ["고친 본문입니다", 0, "development"]);
    assert.deepEqual(row.resources, [{ type: "potion", id: "fire" }]);
    assert.equal(h.db.one("SELECT summary FROM posts WHERE id = ?1", comboId)!.summary, "고친 본문입니다");
    const out = h.outbox().at(-1)!;
    assert.deepEqual([out.op, out.match, out.payload], ["update", { id: comboId, user_id: USER }, { read: "posts", columns: ["content_text", "resources"] }]);
    assert.equal((await h.call(`/api/write/toybox-post?service=combo&id=${comboId}`, { method: "PATCH", body: { user_id: OTHER } })).json.error, "forbidden");
    assert.equal((await h.call(`/api/write/toybox-post?service=chemical_x&id=${comboId}`, { method: "PATCH", body: {} })).status, 400, "no update policy");
  });

  await check("this-or-that likes and votes: FK refusals as today, recounts, outbox", async () => {
    const tot = U(20);
    seedPost(h, "this_or_that", tot, OTHER);
    const missing = await h.call(`/api/write/this-or-that/like?id=${U(21)}`, { method: "PUT" });
    assert.deepEqual([missing.status, missing.json.error], [404, "not_found"]);
    assert.deepEqual((await h.call(`/api/write/this-or-that/like?id=${tot}`, { method: "PUT" })).json, { v: 1, env: "development", liked: true });
    assert.deepEqual((await h.call(`/api/write/this-or-that/like?id=${tot}`, { method: "PUT" })).json.liked, true, "repeat like succeeds");
    assert.equal(h.db.one("SELECT like_count FROM posts WHERE id = ?1", tot)!.like_count, 1);
    await h.call(`/api/write/this-or-that/like?id=${tot}`, { method: "DELETE" });
    assert.equal(h.db.one("SELECT like_count FROM posts WHERE id = ?1", tot)!.like_count, 0);
    const unlike = h.outbox().filter((entry) => entry.table_name === "this_or_that_post_likes").at(-1)!;
    assert.deepEqual([unlike.op, unlike.match], ["delete", { post_id: tot, user_id: USER }]);

    const vote = await h.call(`/api/write/this-or-that/vote?id=${tot}`, { method: "PUT", body: { choice: "left", surface: "detail" } });
    assert.deepEqual([vote.status, vote.json], [201, { v: 1, env: "development", choice: "left" }]);
    assert.equal((await h.call(`/api/write/this-or-that/vote?id=${tot}`, { method: "PUT", body: { choice: "right", surface: "detail" } })).json.error, "duplicate");
    assert.equal((await h.call(`/api/write/this-or-that/vote?id=${U(21)}`, { method: "PUT", body: { choice: "right", surface: "index" } })).json.error, "forbidden");
    await h.call(`/api/write/this-or-that/vote?id=${tot}`, { method: "PUT", body: { choice: "right", surface: "index" }, as: OTHER });
    assert.deepEqual(h.db.one("SELECT left_vote_count, right_vote_count FROM post_this_or_that WHERE post_id = ?1", tot), { left_vote_count: 1, right_vote_count: 1 });
    assert.deepEqual(h.outbox().filter((entry) => entry.table_name === "this_or_that_post_votes")[0].payload, { read: "this_or_that_post_votes", extra: { created_surface: "detail" } });
    assert.deepEqual((await h.call(`/api/write/this-or-that/vote?id=${tot}`, { method: "DELETE" })).json.choice, null);
    assert.deepEqual(h.db.one("SELECT left_vote_count, right_vote_count FROM post_this_or_that WHERE post_id = ?1", tot), { left_vote_count: 0, right_vote_count: 1 });
  });

  await check("tournament play: the RPC's checks, play_count and stats recount, ranks, rpc outbox row", async () => {
    const id = U(30);
    seedPost(h, "favorite_tournament", id, OTHER, { pool: ["a", "b", "c", "d"], title: "유물 월드컵" });
    const m = (l: string, r: string, winner: "left" | "right") => ({ left_type: "relic", left_id: l, right_type: "relic", right_id: r, winner });
    const play = { tournamentId: id, startingSize: 4, championType: "relic", championId: "a", matches: [m("a", "b", "left"), m("c", "d", "right"), m("a", "d", "left")] };
    assert.deepEqual((await h.call("/api/write/favorite-tournament/play", { method: "POST", body: play })).json, { v: 1, env: "development", result: { ok: true } });
    assert.equal(h.db.one("SELECT play_count FROM post_favorite_tournament WHERE post_id = ?1", id)!.play_count, 1);
    const stats = h.db.rows("SELECT resource_id, match_appearances, match_wins, championships, current_rank, rank_history FROM favorite_tournament_candidate_stats WHERE tournament_id = ?1 ORDER BY current_rank", id);
    assert.deepEqual(stats.map((row) => [row.resource_id, row.match_appearances, row.match_wins, row.championships, row.current_rank]), [
      ["a", 2, 2, 1, 1], ["d", 2, 1, 0, 2], ["b", 1, 0, 0, 3], ["c", 1, 0, 0, 4],
    ]);
    const history = JSON.parse(String(stats[0].rank_history)) as Array<{ at: string; rank: number }>;
    assert.equal(history.length, 1);
    assert.match(history[0].at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,3})?$/, "Postgres timestamp::text");
    assert.equal(pgTimestampText(Date.UTC(2026, 10, 8, 1, 2, 3, 450)), "2026-11-08 01:02:03.45");
    assert.equal(pgTimestampText(Date.UTC(2026, 10, 8, 1, 2, 3, 0)), "2026-11-08 01:02:03");
    const out = h.outbox().at(-1)!;
    assert.deepEqual([out.table_name, out.op, out.payload], ["favorite_tournament_plays", "rpc", { read: "favorite_tournament_plays", fn: "mirror_favorite_tournament_play" }]);
    // A second play: only rows whose rank changed get a history entry.
    await h.call("/api/write/favorite-tournament/play", { method: "POST", body: { ...play, championId: "d", matches: [m("a", "b", "right"), m("c", "d", "right"), m("b", "d", "right")] }, as: OTHER });
    const after = h.db.rows("SELECT resource_id, current_rank, rank_history FROM favorite_tournament_candidate_stats WHERE tournament_id = ?1 ORDER BY current_rank", id);
    assert.deepEqual(after.map((row) => [row.resource_id, row.current_rank, (JSON.parse(String(row.rank_history)) as unknown[]).length]), [
      ["d", 1, 2], ["a", 2, 2], ["b", 3, 1], ["c", 4, 1],
    ]);
    const bad = async (body: unknown) => (await h.call("/api/write/favorite-tournament/play", { method: "POST", body })).json.error;
    assert.equal(await bad({ ...play, championId: "b" }), "invalid", "champion must win the final");
    assert.equal(await bad({ ...play, matches: [m("a", "x", "left"), m("c", "d", "right"), m("a", "d", "left")] }), "invalid", "outside the pool");
    assert.equal(await bad({ ...play, startingSize: 8 }), "invalid", "match count");
    assert.equal(await bad({ ...play, tournamentId: U(31) }), "invalid", "no tournament");
    assert.equal(await bad({ ...play, matches: [m("a", "b", "left"), { ...m("c", "d", "right"), winner: "both" }, m("a", "d", "left")] }), "invalid", "winner");
    assert.equal(h.db.one("SELECT play_count FROM post_favorite_tournament WHERE post_id = ?1", id)!.play_count, 2);
  });

  await check("서류 폭풍 drafts: create, owner-only update and delete", async () => {
    const created = await h.call("/api/write/pagestorm/drafts", { method: "POST", body: { user_id: USER, nickname: "닉", title: "초안", content: { type: "doc" }, content_text: "초안 본문", env: "development", updated_at: "2026-11-07T00:00:00.000Z" } });
    assert.equal(created.status, 201);
    const [draft] = created.json as unknown as Array<Record<string, unknown>>;
    assert.equal(draft.updated_at, "2026-11-07T00:00:00+00:00", "the client's updated_at, as today (no guard)");
    const id = String(draft.id);
    assert.deepEqual((await h.call(`/api/write/pagestorm/drafts?id=${id}`, { method: "PATCH", body: { title: "남의 초안" }, as: OTHER })).json, []);
    const [updated] = (await h.call(`/api/write/pagestorm/drafts?id=${id}`, { method: "PATCH", body: { title: "고친 초안" } })).json as unknown as Array<Record<string, unknown>>;
    assert.equal(updated.title, "고친 초안");
    assert.deepEqual(h.outbox().at(-1)!.payload, { read: "pagestorm_drafts", columns: ["title"] });
    assert.equal((await h.call("/api/write/pagestorm/drafts", { method: "POST", body: { user_id: OTHER, nickname: "닉", title: "t", content: {}, content_text: "x" } })).json.error, "forbidden");
    assert.deepEqual((await h.call(`/api/write/pagestorm/drafts?id=${id}`, { method: "DELETE", as: OTHER })).json.deleted, false);
    assert.deepEqual((await h.call(`/api/write/pagestorm/drafts?id=${id}`, { method: "DELETE" })).json.deleted, true);
  });

  await check("조각모음 body: post owner only (defragment_source_owned), upsert keeps the owner", async () => {
    const body = { env: "development", source_service: "combo", source_id: comboId, user_id: USER, nickname: "닉", content: [{ type: "p" }], content_text: "조각 본문", updated_at: "2026-11-07T00:00:00.000Z" };
    const first = await h.call("/api/write/defragment-body", { method: "PUT", body });
    assert.equal(first.status, 200);
    const [row] = first.json as unknown as Array<Record<string, unknown>>;
    assert.deepEqual([row.source_service, row.source_id, row.content_text, row.env], ["combo", comboId, "조각 본문", "development"]);
    const second = await h.call("/api/write/defragment-body", { method: "PUT", body: { ...body, content_text: "고친 조각" } });
    assert.equal((second.json as unknown as Array<Record<string, unknown>>)[0].content_text, "고친 조각");
    assert.equal((await h.call("/api/write/defragment-body", { method: "PUT", body: { ...body, user_id: OTHER }, as: OTHER })).json.error, "forbidden");
    seedPost(h, "history_course", "r00000000000000aa", USER);
    assert.equal((await h.call("/api/write/defragment-body", { method: "PUT", body: { ...body, source_service: "history_course", source_id: U(40) } })).json.error, "forbidden", "defragment_source_owned has no run branch");
    assert.equal((await h.call("/api/write/defragment-body", { method: "PUT", body: { ...body, source_id: "r00000000000000aa" } })).json.error, "invalid", "source_id is a uuid column");
    assert.equal((await h.call("/api/write/defragment-body", { method: "PUT", body: { ...body, source_id: U(41) } })).json.error, "forbidden", "no such post");
    const rows = h.outbox().filter((entry) => entry.table_name === "defragment_bodies");
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0].match, { source_service: "combo", source_id: comboId });
  });

  await check("post delete: owner only, cascades, outbox delete with the owner", async () => {
    assert.deepEqual((await h.call(`/api/write/toybox-post?service=combo&id=${comboId}`, { method: "DELETE", as: OTHER })).json.deleted, false);
    assert.deepEqual((await h.call(`/api/write/toybox-post?service=combo&id=${comboId}`, { method: "DELETE" })).json.deleted, true);
    for (const table of ["post_combo", "post_combo_resources", "defragment_bodies"]) {
      assert.equal(h.db.rows(`SELECT * FROM ${table} WHERE post_id = ?1`, comboId).length, 0, table);
    }
    const out = h.outbox().at(-1)!;
    assert.deepEqual([out.table_name, out.op, out.match], ["combo_posts", "delete", { id: comboId, user_id: USER }]);
    assert.deepEqual((await h.call(`/api/write/toybox-post?service=defragment&id=${comboId}`, { method: "DELETE" })).json.deleted, false);
  });
}

async function puzzlebox() {
  const h = await setupHarness();
  const run = { guesses: [[3, 3, 3, 3], [2, 2, 2, 2], [0, 1, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0]], rocks: 1, rocksLeft: 1, shown: { token: true, local: false, original: true } };
  const player = { nickname: "  퍼즐러  ", avatar_id: "IRONCLAD", avatar_kind: "character", palette_id: "red", palette_swapped: true };
  await check("puzzlebox submit: scored like puzzlebox_score_run, best, stats, rank, outbox rows", async () => {
    const res = await h.call("/api/write/puzzlebox/runs", { method: "POST", body: { game: "connections", board: "2", run, player } });
    assert.equal(res.status, 200);
    // Solved 3,2,1,0 (a reverse rainbow): 70 levels, mistake bonus 10, local hidden 5, 1 rock left 10, rainbow 10.
    assert.deepEqual(res.json.result, { score: 105, perfect: false, attempt: 1, improved: true, best: 105, best_perfect: false, rank: 1, players: 1 });
    const stats = h.db.one("SELECT players, cleared, perfect, score_sum, mistakes_sum, rocks_sum, purple_first, level_solved FROM puzzlebox_board_stats WHERE game = 'connections' AND board = '2'")!;
    // The stats count purple first whenever the first solved group is level 3 (the RPC's rule).
    assert.deepEqual(stats, { players: 1, cleared: 1, perfect: 0, score_sum: 105, mistakes_sum: 1, rocks_sum: 1, purple_first: 1, level_solved: "[1,1,1,1]" });
    assert.deepEqual(h.db.one("SELECT nickname, palette_swapped FROM puzzlebox_players WHERE user_id = ?1", USER), { nickname: "퍼즐러", palette_swapped: 1 });
    const tables = h.outbox().map((entry) => entry.table_name);
    assert.deepEqual(tables, ["puzzlebox_runs", "puzzlebox_best", "puzzlebox_board_stats"], "no puzzlebox_players row outside production");
    const burst = await h.call("/api/write/puzzlebox/runs", { method: "POST", body: { game: "connections", board: "2", run, player } });
    assert.deepEqual([burst.status, burst.json.error], [429, "rate_limited"], "one run of a board every 3 s");
    assert.equal(h.db.rows("SELECT * FROM puzzlebox_runs").length, 1);
    assert.equal(h.outbox().length, 3, "a refused run leaves no outbox row");
  });

  await check("puzzlebox submit: second attempt keeps the best, quiz stats arrays, refusals", async () => {
    h.db.run("UPDATE puzzlebox_runs SET created_at = '2026-01-01T00:00:00.000000Z'");
    const worse = { ...run, guesses: [[0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3]], rocksLeft: 0 };
    const res = await h.call("/api/write/puzzlebox/runs", { method: "POST", body: { game: "connections", board: "2", run: worse, player } });
    assert.deepEqual(res.json.result, { score: 0, perfect: false, attempt: 2, improved: false, best: 105, best_perfect: false, rank: 1, players: 1 });
    assert.equal(h.db.one("SELECT players FROM puzzlebox_board_stats WHERE board = '2'")!.players, 1, "stats count first runs only");
    const shown = { token: true, local: true, original: true };
    const quiz = { questions: 3, answers: [{ pick: 1, correct: true, ms: 800, shown }, { pick: 2, correct: false, ms: 5000, shown }, { pick: 0, correct: true, ms: 5500, shown }] };
    const answer = await h.call("/api/write/puzzlebox/runs", { method: "POST", body: { game: "beta-quiz", board: "1", run: quiz, player }, as: OTHER });
    // 2 correct x10, speed 10 + round(10*4500/9000)=5, 2 wrong left x5.
    assert.equal((answer.json.result as Record<string, unknown>).score, 20 + 15 + 10);
    const quizStats = h.db.one("SELECT question_wrong, wrong_picks, speed_sum FROM puzzlebox_board_stats WHERE game = 'beta-quiz' AND board = '1'")!;
    assert.deepEqual(quizStats, { question_wrong: "[0,1,0]", wrong_picks: "[0,0,0,0,0,0,1,0,0,0,0,0]", speed_sum: 15 });
    const bad = async (body: unknown) => (await h.call("/api/write/puzzlebox/runs", { method: "POST", body })).json.error;
    assert.equal(await bad({ game: "connections", board: "0", run, player }), "invalid", "board pattern");
    assert.equal(await bad({ game: "connections", board: "3", run: { ...run, guesses: [[3, 3, 3, 3]] }, player }), "invalid", "not finished");
    assert.equal(await bad({ game: "connections", board: "3", run: { ...run, shown: { token: false, local: false, original: false } }, player }), "invalid", "something shown");
    assert.equal(await bad({ game: "connections", board: "3", run, player: { ...player, palette_swapped: "maybe" } }), "invalid", "::boolean");
  });

  const prod = await setupHarness({ dataEnv: "production" });
  await check("puzzlebox_players is mirrored from production only", async () => {
    await prod.call("/api/write/puzzlebox/runs", { method: "POST", body: { game: "connections", board: "2", run, player } });
    assert.deepEqual(prod.outbox().map((entry) => entry.table_name), ["puzzlebox_runs", "puzzlebox_players", "puzzlebox_best", "puzzlebox_board_stats"]);
  });
}

async function gate() {
  await check("every write route has a D1 handler", () => {
    const writes = API_ROUTES.filter((route) => route.access === "write").map((route) => route.id);
    assert.ok(writes.length >= 30);
    for (const id of writes) assert.ok(D1_WRITE_HANDLERS[id], `no D1 handler for ${id}`);
  });

  const h = await setupHarness({ source: "supabase" });
  await check("no source flag: today's Supabase handler runs, D1 untouched", async () => {
    h.setFlag(sourceFlagKey("comments"), null);
    const res = await h.call("/api/write/likes?key=sts2-codex:card:bash", { method: "PUT" });
    assert.equal(res.status, 200);
    assert.ok(h.supabase.restCalls().some((entry) => entry.url.pathname === "/rest/v1/likes" && entry.method === "POST"), "PostgREST got the insert");
    assert.equal(h.db.rows("SELECT * FROM likes").length, 0);
    assert.equal(h.outbox().length, 0);
  });

  await check("write.paused: every write answers 503 write_paused with Retry-After, reads go on", async () => {
    h.setFlag(WRITE_PAUSED_KEY, "on");
    const calls = h.supabase.restCalls().length;
    for (const [path, init] of [
      ["/api/write/likes?key=sts2-codex:card:bash", { method: "PUT" }],
      ["/api/write/comments", { method: "POST", body: { threadKey: "sts2-codex:card:bash", nickname: "닉", content: "좋은 카드" } }],
      ["/api/write/history-runs/share", { method: "POST", raw: "[{},{}]", headers: { "x-slseoun-row-length": "2" } }],
    ] as const) {
      const res = await h.call(path, init as never);
      assert.deepEqual([res.status, res.json.error, res.headers.get("retry-after")], [503, "write_paused", "3"], path);
    }
    assert.equal(h.supabase.restCalls().length, calls, "nothing reached Supabase");
    const read = await h.call("/api/read/engagement-counts");
    assert.notEqual(read.status, 503);
    h.setFlag(WRITE_PAUSED_KEY, "off");
    assert.equal((await h.call("/api/write/likes?key=sts2-codex:card:bash", { method: "PUT" })).status, 200);
  });

  await check("the share route answers single_run_unavailable on the Supabase source", async () => {
    const res = await h.call("/api/write/history-runs/share", { method: "POST", raw: "[{},{}]", headers: { "x-slseoun-row-length": "2" } });
    assert.deepEqual([res.status, res.json.error], [409, "single_run_unavailable"]);
  });

  await check("gate rows: unknown values keep today's behaviour; an unreadable gate is null (the env default applies)", async () => {
    const gate = parseGateRows([{ key: "source.comments", value: "d1" }, { key: "source.stories", value: "D1" }, { key: WRITE_PAUSED_KEY, value: "yes" }]);
    assert.equal(gate.sources.comments, "d1");
    assert.equal(gate.sources.stories, "supabase");
    assert.equal(gate.paused, false);
    assert.equal(supabaseInSyncAllowed(gate), false);
    assert.equal(supabaseInSyncAllowed(parseGateRows([])), true);
    resetWriteGateForTest();
    const broken = { prepare: () => { throw new Error("D1 down"); }, batch: async () => { throw new Error("D1 down"); } };
    assert.equal(await readWriteGate(broken as never), null);
    resetWriteGateForTest();
  });
}

async function main() {
  const realFetch = globalThis.fetch;
  try {
    await engagement();
    await storiesAndContact();
    await runs();
    await toybox();
    await puzzlebox();
    await gate();
  } finally {
    globalThis.fetch = realFetch;
  }
  console.log(`d1-write: ${checks} checks passed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

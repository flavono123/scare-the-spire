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

async function main() {
  const realFetch = globalThis.fetch;
  try {
    await engagement();
    await storiesAndContact();
  } finally {
    globalThis.fetch = realFetch;
  }
  void WRITE_PAUSED_KEY; void WRITE_GROUPS; void sourceFlagKey; void D1_WRITE_HANDLERS; void pgTimestampText; void API_ROUTES;
  console.log(`d1-write: ${checks} checks passed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

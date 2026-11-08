import { contactInquiryRow } from "../../../../src/lib/contact-rules";
import { postgrestTs } from "../../../../src/lib/d1-time";
import { isUuid } from "../../../../src/lib/engagement-keys";
import { storyInsertRow } from "../../../../src/lib/stories-api-rules";
import { apiError } from "../../http";
import { json, type D1WriteContext } from "../context";
import { boolOrNull, changesOf, rowsOf, runBatch, stmt, tsFromMs, writeFailureCode } from "../db";
import { outboxStatement, readPayload } from "../outbox";

/**
 * Stories (E16i, E16j), contact inquiries (C1) and the profile's "replies seen" (C4) on D1.
 */

const HOUR_MS = 60 * 60 * 1000;

export async function createStory(write: D1WriteContext): Promise<Response> {
  const body = write.context.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return apiError("invalid");
  const row = storyInsertRow(body as Record<string, unknown>);
  if (!row) return apiError("invalid");
  const id = crypto.randomUUID();
  const linked = JSON.stringify(row.linked_entities);
  try {
    await runBatch(write.db, [
      // E16i with every column the step 1 insert sends; static_story_id is never the client's.
      stmt(
        "INSERT INTO community_stories (id, user_id, static_story_id, nickname, avatar_id, avatar_kind, palette_id, palette_swapped, " +
          "sentence, game, entity_type, entity_id, change_id, patch_line_id, source, tags, linked_entities, created_at) " +
          "VALUES (?1, ?2, NULL, ?3, ?4, ?5, ?6, ?7, ?8, 'sts2', ?9, ?10, NULL, ?11, ?12, '[]', ?13, ?14) ON CONFLICT (id) DO NOTHING",
        id,
        write.uid,
        row.nickname,
        row.avatar_id ?? null,
        row.avatar_kind ?? null,
        row.palette_id ?? null,
        boolOrNull(row.palette_swapped, 0),
        row.sentence,
        row.entity_type,
        row.entity_id,
        row.patch_line_id,
        row.source,
        linked,
        write.now,
      ),
      outboxStatement(
        { table: "community_stories", op: "insert", match: { id }, payload: readPayload("community_stories") },
        write.nowMs,
        { sql: "EXISTS (SELECT 1 FROM community_stories WHERE id = ?6)", params: [id] },
      ),
    ]);
  } catch (error) {
    return apiError(writeFailureCode(error));
  }
  // STORY_COLUMNS, as the step 1 insert's return=representation gives them.
  const inserted = {
    id,
    user_id: write.uid,
    static_story_id: null,
    nickname: row.nickname,
    sentence: row.sentence,
    game: "sts2",
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    change_id: null,
    patch_line_id: row.patch_line_id,
    source: row.source,
    tags: [],
    linked_entities: row.linked_entities,
    created_at: postgrestTs(write.now),
    env: write.dataEnv,
    avatar_id: row.avatar_id ?? null,
    avatar_kind: row.avatar_kind ?? null,
    palette_id: row.palette_id ?? null,
    palette_swapped: row.palette_swapped === undefined ? false : row.palette_swapped,
  };
  return json({ v: 1, env: write.dataEnv, row: inserted }, 201);
}

export async function deleteStory(write: D1WriteContext): Promise<Response> {
  const id = (write.context.url.searchParams.get("id") ?? "").toLowerCase();
  if (!isUuid(id)) return apiError("invalid");
  let results;
  try {
    results = await runBatch(write.db, [
      // E16j; the story's comments and likes stay, as today.
      stmt("DELETE FROM community_stories WHERE id = ?1 AND user_id = ?2 RETURNING id", id, write.uid),
      outboxStatement({ table: "community_stories", op: "delete", match: { id, user_id: write.uid }, payload: null }, write.nowMs),
    ]);
  } catch (error) {
    return apiError(writeFailureCode(error));
  }
  return json({ v: 1, env: write.dataEnv, deleted: rowsOf(results[0]).length > 0 });
}

export async function submitInquiry(write: D1WriteContext): Promise<Response> {
  const body = write.context.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return apiError("invalid");
  const row = contactInquiryRow(body as Parameters<typeof contactInquiryRow>[0]);
  if (!row) return apiError("invalid");
  const id = crypto.randomUUID();
  let results;
  try {
    results = await runBatch(write.db, [
      // C1: three an hour per user (the trigger's rule); 0 rows -> 429. Trim and lower-case are done.
      stmt(
        "INSERT INTO contact_inquiries (id, user_id, category, message, reply_email, page_path, service_locale, game_locale, " +
          "status, created_at) SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'new', ?9 " +
          "WHERE (SELECT count(*) FROM contact_inquiries WHERE user_id = ?2 AND created_at > ?10) < 3",
        id,
        write.uid,
        row.category,
        row.message,
        row.reply_email,
        row.page_path,
        row.service_locale,
        row.game_locale,
        write.now,
        tsFromMs(write.nowMs - HOUR_MS),
      ),
      outboxStatement(
        {
          table: "contact_inquiries",
          op: "insert",
          match: { id },
          // The viewport is write-only (design 7): not in D1, sent with the mirrored row.
          payload: readPayload("contact_inquiries", { viewport_width: row.viewport_width, viewport_height: row.viewport_height }),
        },
        write.nowMs,
        { sql: "EXISTS (SELECT 1 FROM contact_inquiries WHERE id = ?6)", params: [id] },
      ),
    ]);
  } catch (error) {
    return apiError(writeFailureCode(error));
  }
  if (changesOf(results[0]) === 0) return apiError("rate_limited");
  return json({}, 201);
}

export async function markRepliesSeen(write: D1WriteContext): Promise<Response> {
  try {
    await runBatch(write.db, [
      // One outbox update per row C4 is about to change (read before the UPDATE in the same batch).
      stmt(
        "INSERT INTO outbox (table_name, op, match_key, payload, created_at) " +
          "SELECT 'contact_inquiries', 'update', json_object('id', id, 'user_id', user_id), " +
          "json_object('read', 'contact_inquiries', 'columns', json_array('reply_seen_at')), ?2 " +
          "FROM contact_inquiries WHERE user_id = ?1 AND admin_response IS NOT NULL AND reply_seen_at IS NULL",
        write.uid,
        write.nowMs,
      ),
      // C4; the time is the Worker's.
      stmt(
        "UPDATE contact_inquiries SET reply_seen_at = ?2 WHERE user_id = ?1 AND admin_response IS NOT NULL AND reply_seen_at IS NULL",
        write.uid,
        write.now,
      ),
    ]);
  } catch (error) {
    return apiError(writeFailureCode(error));
  }
  return json({});
}

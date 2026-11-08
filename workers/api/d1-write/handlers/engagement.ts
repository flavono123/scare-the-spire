import { isThreadKey, isUuid } from "../../../../src/lib/engagement-keys";
import { postgrestTs } from "../../../../src/lib/d1-time";
import { apiError } from "../../http";
import { parseCommentInput, parseReactionInput } from "../../routes/comments";
import {
  commentRecountStatement,
  json,
  likeRecountStatement,
  ownerCopyStatement,
  type D1WriteContext,
} from "../context";
import { boolOrNull, queryAll, rowsOf, runBatch, stmt, writeFailureCode, type D1Statement } from "../db";
import { outboxStatement, readPayload } from "../outbox";

/**
 * The comments group's writes on D1 (queries.sql E13-E16): comments, comment likes, thread likes and
 * reactions. Each is one batch: the source row, the recounts of design 2.3 (threads, the owner post's
 * counts, comments.like_count, reaction totals) and the outbox row. Owner checks are today's RLS
 * (auth.uid() = user_id): rows are written with the caller's uid, deletes match it.
 */

const TOKEN_FIELDS = ["avatar_id", "avatar_kind", "palette_id"] as const;

function withOwner(statements: Array<D1Statement | null>): D1Statement[] {
  return statements.filter((statement): statement is D1Statement => statement !== null);
}

export async function createComment(write: D1WriteContext): Promise<Response> {
  const input = parseCommentInput(write.context.body);
  if (!input) return apiError("invalid");
  const id = crypto.randomUUID();
  const blocks = input.content_blocks === null ? null : JSON.stringify(input.content_blocks);
  const insert = stmt(
    // E16a with the author snapshot and blocks bound.
    "INSERT INTO comments (id, story_id, user_id, nickname, avatar_id, avatar_kind, palette_id, palette_swapped, " +
      "content, content_blocks, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11) ON CONFLICT (id) DO NOTHING",
    id,
    input.story_id,
    write.uid,
    input.nickname,
    input.avatar_id ?? null,
    input.avatar_kind ?? null,
    input.palette_id ?? null,
    boolOrNull(input.palette_swapped, 0),
    input.content,
    blocks,
    write.now,
  );
  try {
    await runBatch(write.db, withOwner([
      insert,
      commentRecountStatement(input.story_id, write.nowMs),
      ownerCopyStatement(input.story_id),
      outboxStatement(
        { table: "comments", op: "insert", match: { id }, payload: readPayload("comments") },
        write.nowMs,
        { sql: "EXISTS (SELECT 1 FROM comments WHERE id = ?6)", params: [id] },
      ),
    ]));
  } catch (error) {
    return apiError(writeFailureCode(error));
  }
  const comment: Record<string, unknown> = {
    id,
    story_id: input.story_id,
    user_id: write.uid,
    nickname: input.nickname,
    content: input.content,
    content_blocks: input.content_blocks,
    created_at: postgrestTs(write.now),
  };
  for (const field of TOKEN_FIELDS) comment[field] = input[field] ?? null;
  comment.palette_swapped = input.palette_swapped === undefined ? false : input.palette_swapped;
  comment.like_count = 0;
  return json({ comment }, 201);
}

export async function deleteComment(write: D1WriteContext): Promise<Response> {
  const id = (write.context.url.searchParams.get("id") ?? "").toLowerCase();
  if (!isUuid(id)) return apiError("invalid");
  // The thread key is needed for the recount, and is gone once the row is: read it first.
  const own = await queryAll<{ story_id: string }>(write.db, stmt("SELECT story_id FROM comments WHERE id = ?1 AND user_id = ?2", id, write.uid))
    .catch(() => null);
  if (own === null) return apiError("unavailable");
  if (own.length === 0) return apiError("not_found");
  const key = own[0].story_id;
  let results;
  try {
    results = await runBatch(write.db, withOwner([
      // E16b; comment_likes go with it (FK cascade, as in Supabase).
      stmt("DELETE FROM comments WHERE id = ?1 AND user_id = ?2 RETURNING id, story_id", id, write.uid),
      commentRecountStatement(key, write.nowMs),
      ownerCopyStatement(key),
      outboxStatement({ table: "comments", op: "delete", match: { id, user_id: write.uid }, payload: null }, write.nowMs),
    ]));
  } catch (error) {
    return apiError(writeFailureCode(error));
  }
  if (rowsOf(results[0]).length === 0) return apiError("not_found");
  return json({ deleted: true });
}

export async function commentLike(write: D1WriteContext, like: boolean): Promise<Response> {
  const id = (write.context.url.searchParams.get("id") ?? "").toLowerCase();
  if (!isUuid(id)) return apiError("invalid");
  const statements = like
    ? [
        // E16e: a missing comment fails the FK (today 23503 -> not_found).
        stmt("INSERT INTO comment_likes (comment_id, user_id, created_at) VALUES (?1, ?2, ?3) ON CONFLICT DO NOTHING", id, write.uid, write.now),
        stmt("UPDATE comments SET like_count = (SELECT count(*) FROM comment_likes WHERE comment_id = ?1) WHERE id = ?1 RETURNING like_count", id),
        outboxStatement(
          { table: "comment_likes", op: "insert", match: { comment_id: id, user_id: write.uid }, payload: readPayload("comment_likes") },
          write.nowMs,
        ),
      ]
    : [
        stmt("DELETE FROM comment_likes WHERE comment_id = ?1 AND user_id = ?2", id, write.uid),
        stmt("UPDATE comments SET like_count = (SELECT count(*) FROM comment_likes WHERE comment_id = ?1) WHERE id = ?1 RETURNING like_count", id),
        outboxStatement({ table: "comment_likes", op: "delete", match: { comment_id: id, user_id: write.uid }, payload: null }, write.nowMs),
      ];
  let results;
  try {
    results = await runBatch(write.db, statements);
  } catch (error) {
    return apiError(writeFailureCode(error));
  }
  const counted = rowsOf<{ like_count: number }>(results[1])[0];
  return json({ liked: like, count: counted ? Number(counted.like_count) : 0 });
}

export async function threadLike(write: D1WriteContext, like: boolean): Promise<Response> {
  const key = write.context.url.searchParams.get("key") ?? "";
  if (!isThreadKey(key)) return apiError("invalid");
  const change = like
    ? stmt("INSERT INTO likes (story_id, user_id, created_at) VALUES (?1, ?2, ?3) ON CONFLICT DO NOTHING", key, write.uid, write.now)
    : stmt("DELETE FROM likes WHERE story_id = ?1 AND user_id = ?2", key, write.uid);
  const outbox = like
    ? outboxStatement({ table: "likes", op: "insert", match: { story_id: key, user_id: write.uid }, payload: readPayload("likes") }, write.nowMs)
    : outboxStatement({ table: "likes", op: "delete", match: { story_id: key, user_id: write.uid }, payload: null }, write.nowMs);
  const statements = withOwner([
    change,
    likeRecountStatement(key, write.nowMs),
    ownerCopyStatement(key),
    outbox,
    stmt("SELECT like_count FROM threads WHERE thread_key = ?1", key),
  ]);
  let results;
  try {
    results = await runBatch(write.db, statements);
  } catch (error) {
    return apiError(writeFailureCode(error));
  }
  const counted = rowsOf<{ like_count: number }>(results[results.length - 1])[0];
  return json({ liked: like, count: counted ? Number(counted.like_count) : 0 });
}

/**
 * E15 with a guard: Supabase's trigger creates a totals row on the first reaction of a resource
 * version and only touches it when a reaction row changes, so removing a reaction nobody made creates
 * no totals row here either.
 */
function reactionTotalsStatement(resourceId: string, resourceType: string, gameVersion: string): D1Statement {
  return stmt(
    "INSERT INTO resource_reaction_counts (resource_id, resource_type, game_version, buff_count, nerf_count, rework_count) " +
      "SELECT ?1, ?2, ?3, coalesce(sum(kind = 'buff'), 0), coalesce(sum(kind = 'nerf'), 0), coalesce(sum(kind = 'rework'), 0) " +
      "FROM resource_reactions WHERE resource_id = ?1 AND resource_type = ?2 AND game_version = ?3 " +
      "HAVING count(*) > 0 OR EXISTS (SELECT 1 FROM resource_reaction_counts " +
      "WHERE resource_id = ?1 AND resource_type = ?2 AND game_version = ?3) " +
      "ON CONFLICT (resource_id, resource_type, game_version) DO UPDATE SET buff_count = excluded.buff_count, " +
      "nerf_count = excluded.nerf_count, rework_count = excluded.rework_count " +
      "RETURNING buff_count, nerf_count, rework_count",
    resourceId,
    resourceType,
    gameVersion,
  );
}

export async function reaction(write: D1WriteContext): Promise<Response> {
  const input = parseReactionInput(write.context.body);
  if (!input) return apiError("invalid");
  const { resourceId, resourceType, gameVersion, kind } = input;
  const match = { resource_id: resourceId, resource_type: resourceType, game_version: gameVersion, user_id: write.uid };
  const statements = kind === null
    ? [
        stmt(
          "DELETE FROM resource_reactions WHERE resource_id = ?1 AND resource_type = ?2 AND game_version = ?3 AND user_id = ?4",
          resourceId, resourceType, gameVersion, write.uid,
        ),
        reactionTotalsStatement(resourceId, resourceType, gameVersion),
        outboxStatement({ table: "resource_reactions", op: "delete", match, payload: null }, write.nowMs),
      ]
    : [
        // E16g: only kind changes on conflict.
        stmt(
          "INSERT INTO resource_reactions (resource_id, resource_type, game_version, user_id, kind) VALUES (?1, ?2, ?3, ?4, ?5) " +
            "ON CONFLICT (resource_id, resource_type, game_version, user_id) DO UPDATE SET kind = excluded.kind " +
            "WHERE resource_reactions.kind IS NOT excluded.kind",
          resourceId, resourceType, gameVersion, write.uid, kind,
        ),
        reactionTotalsStatement(resourceId, resourceType, gameVersion),
        outboxStatement({ table: "resource_reactions", op: "upsert", match, payload: readPayload("resource_reactions") }, write.nowMs),
      ];
  let results;
  try {
    results = await runBatch(write.db, statements);
  } catch (error) {
    return apiError(writeFailureCode(error));
  }
  const totals = rowsOf<{ buff_count: number; nerf_count: number; rework_count: number }>(results[1])[0];
  return json({
    kind,
    counts: {
      buff: Number(totals?.buff_count ?? 0),
      nerf: Number(totals?.nerf_count ?? 0),
      rework: Number(totals?.rework_count ?? 0),
    },
  });
}

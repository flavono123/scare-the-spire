import { isUuid, philosopherReplyThreadKey } from "../../../src/lib/engagement-keys";
import { kstWeekStart } from "../../../src/lib/nav-surfaces";
import {
  CONTACT_INQUIRY_HISTORY_COLUMNS,
  isProfileActivityFilter,
  isProfileActivityOffset,
  isProfileActivitySort,
  PROFILE_ACTIVITY_PAGE_SIZE,
} from "../../../src/lib/profile-activity-rules";
import { isStoryLimit, isStorySource, STORY_COLUMNS } from "../../../src/lib/stories-api-rules";
import { REEL_COLUMNS } from "../routes/colorful-philosophers";
import { philosopherRow } from "./engagement";
import { Q_C2, Q_C3, Q_E10, Q_E10b, Q_E3, Q_F1, Q_F2, Q_F3, Q_P1, Q_P2, Q_P3 } from "./queries";
import {
  AdapterInputError,
  bool,
  columnsOf,
  json,
  jsonList,
  pick,
  query,
  readAll,
  ts,
  type AdapterContext,
  type Row,
} from "./rows";

/**
 * D1 adapters of the stories (E10), colorful-philosophers (F1-F3, E3), contact (C2) and profile
 * (P1-P3, C3) groups, answering the bodies of the step-1 routes of the same names.
 */

// --- Stories ------------------------------------------------------------------------------------

/** read.stories: the community story feed (STORY_COLUMNS, newest first). */
export async function storiesAdapter(context: AdapterContext): Promise<Row[]> {
  const limit = context.url.searchParams.get("limit") ?? "100";
  const source = context.url.searchParams.get("source");
  if (!isStoryLimit(limit) || (source !== null && !isStorySource(source))) throw new AdapterInputError("limit or source");
  const [rows] = await readAll(context.db, [
    source === null ? query(Q_E10, Number(limit)) : query(Q_E10b, Number(limit), source),
  ]);
  const columns = columnsOf(STORY_COLUMNS);
  return rows.map((row) => pick({
    ...row,
    tags: json(row.tags),
    linked_entities: json(row.linked_entities),
    created_at: ts(row.created_at),
    env: context.dataEnv,
    palette_swapped: bool(row.palette_swapped),
  }, columns));
}

// --- Colorful philosophers ------------------------------------------------------------------

/** read.colorful-philosophers.week: the 100 latest posts and their reply counts. */
export async function philosophersWeekAdapter(context: AdapterContext): Promise<Row> {
  const [rows] = await readAll(context.db, [query(Q_F1)]);
  const posts = rows.map(philosopherRow);
  const ids = posts.filter((row) => typeof row.id === "string" && isUuid(row.id)).map((row) => String(row.id));
  const commentCounts: Record<string, number> = {};
  if (ids.length) {
    const [threads] = await readAll(context.db, [query(Q_E3, jsonList(ids.map(philosopherReplyThreadKey)))]);
    const prefix = philosopherReplyThreadKey("");
    for (const row of threads) {
      const count = Number(row.comment_count);
      if (count > 0) commentCounts[String(row.thread_key).slice(prefix.length)] = count;
    }
  }
  return { v: 1, env: context.dataEnv, posts, commentCounts };
}

/** read.colorful-philosophers.post: one post or null. */
export async function philosophersPostAdapter(context: AdapterContext): Promise<Row> {
  const id = context.url.searchParams.get("id") ?? "";
  if (!isUuid(id)) throw new AdapterInputError("id");
  const [rows] = await readAll(context.db, [query(Q_F2, id.toLowerCase())]);
  return { v: 1, env: context.dataEnv, post: rows[0] ? philosopherRow(rows[0]) : null };
}

/** read.colorful-philosophers.reel: the 12 latest posts up to this KST week. */
export async function philosophersReelAdapter(context: AdapterContext): Promise<Row> {
  const [rows] = await readAll(context.db, [query(Q_F3, kstWeekStart(new Date(context.now)))]);
  const columns = columnsOf(REEL_COLUMNS);
  return { v: 1, env: context.dataEnv, posts: rows.map((row) => pick(row, columns)) };
}

// --- Contact --------------------------------------------------------------------------------------

/** me.mailbox: whether the caller has an unseen reply. */
export async function mailboxAdapter(context: AdapterContext): Promise<Row> {
  if (!context.userId) throw new AdapterInputError("user");
  const [rows] = await readAll(context.db, [query(Q_C2, context.userId)]);
  return { v: 1, env: context.dataEnv, unseen: rows.length > 0 };
}

// --- Profile ---------------------------------------------------------------------------------------

/** read.profile.nicknames: every nickname pool (one shared set, no env). */
export async function profileNicknamesAdapter(context: AdapterContext): Promise<Row> {
  const [rows] = await readAll(context.db, [query(Q_P1)]);
  return {
    v: 1,
    env: context.dataEnv,
    rows: rows.map((row) => ({ character_id: row.character_id, locale: row.locale, nicknames: json(row.nicknames) })),
  };
}

/** me.profile.stats: get_my_profile_activity_stats rows. */
export async function profileStatsAdapter(context: AdapterContext): Promise<Row> {
  if (!context.userId) throw new AdapterInputError("user");
  const [rows] = await readAll(context.db, [query(Q_P3, context.userId)]);
  return {
    v: 1,
    env: context.dataEnv,
    rows: rows.map((row) => ({ category: row.category, post_count: row.post_count, like_count: row.like_count })),
  };
}

/** me.profile.activity: get_my_profile_activity rows of one page. */
export async function profileActivityAdapter(context: AdapterContext): Promise<Row> {
  if (!context.userId) throw new AdapterInputError("user");
  const { url } = context;
  const category = url.searchParams.get("category") ?? "all";
  const sort = url.searchParams.get("sort") ?? "latest";
  const offset = url.searchParams.get("offset") ?? "0";
  if (!isProfileActivityFilter(category) || !isProfileActivitySort(sort) || !isProfileActivityOffset(offset)) {
    throw new AdapterInputError("category, sort or offset");
  }
  const [rows] = await readAll(context.db, [
    query(Q_P2, context.userId, category, sort, PROFILE_ACTIVITY_PAGE_SIZE, Number(offset)),
  ]);
  return {
    v: 1,
    env: context.dataEnv,
    rows: rows.map((row) => ({
      activity_id: row.activity_id,
      category: row.category,
      content: row.content ?? null,
      content_blocks: json(row.content_blocks),
      target_key: row.target_key,
      created_at: ts(row.created_at),
      like_count: row.like_count,
      total_count: row.total_count,
    })),
  };
}

/** me.profile.inquiries: the caller's 50 latest inquiries (CONTACT_INQUIRY_HISTORY_COLUMNS). */
export async function profileInquiriesAdapter(context: AdapterContext): Promise<Row> {
  if (!context.userId) throw new AdapterInputError("user");
  const [rows] = await readAll(context.db, [query(Q_C3, context.userId)]);
  const columns = columnsOf(CONTACT_INQUIRY_HISTORY_COLUMNS);
  return {
    v: 1,
    env: context.dataEnv,
    rows: rows.map((row) => pick({
      ...row,
      env: context.dataEnv,
      reply_seen_at: ts(row.reply_seen_at),
      created_at: ts(row.created_at),
    }, columns)),
  };
}

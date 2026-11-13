import { ApiUnavailableError } from "@/lib/api-client";
import {
  feedItemFromPost,
  isDefragmentFederatedService,
  type DefragmentFederatedService,
  type DefragmentFeedItem,
  type HistoryCourseFeedMeta,
} from "@/lib/defragment";
import { DEFAULT_USER_PROFILE } from "@/lib/user-profile";
import { isCoverSpec } from "@/lib/run-cover-types";
import { apiDefragmentFeed, apiDefragmentRuns } from "@/lib/toybox-api";
import { isCursorCreatedAt, isRowId } from "@/lib/toybox-api-rules";
import {
  asNonNegativeInt,
  fetchToyboxFeedPage,
  isToyboxFeedCoreSort,
  TOYBOX_FEED_PAGE_SIZE,
  toyboxRecommendScore,
  type ToyboxFeedCursor,
  type ToyboxFeedSort,
} from "@/lib/toybox-feed";

export interface DefragmentFeedPage {
  items: DefragmentFeedItem[];
  hasMore: boolean;
}

function asIsoTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  return value;
}

function asUuid(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  return value;
}

function asOptionalText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseHistoryMeta(value: unknown): HistoryCourseFeedMeta | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return {
    coverSpec: isCoverSpec(record.cover_spec) ? record.cover_spec : null,
    win: record.win === true,
    ascension: asNonNegativeInt(record.ascension) ?? 0,
    totalFloors: asNonNegativeInt(record.total_floors) ?? 0,
  };
}

export function parseDefragmentFeedRow(row: unknown): DefragmentFeedItem | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const id = asUuid(record.id);
  const createdAt = asIsoTimestamp(record.created_at);
  const service = typeof record.service === "string" ? record.service.trim() : "";
  if (!id || !createdAt || !isDefragmentFederatedService(service)) return null;

  const likeCount = asNonNegativeInt(record.like_count) ?? 0;
  const commentCount = asNonNegativeInt(record.comment_count) ?? 0;
  const recommendScore = asNonNegativeInt(record.recommend_score)
    ?? toyboxRecommendScore(likeCount);
  const title = typeof record.title === "string" ? record.title : "";
  const avatarId = asOptionalText(record.avatar_id).trim() || null;
  const avatarKind = asOptionalText(record.avatar_kind).trim() || null;
  const paletteId = asOptionalText(record.palette_id).trim() || null;
  const paletteSwapped = typeof record.palette_swapped === "boolean" ? record.palette_swapped : null;

  return {
    id,
    created_at: createdAt,
    service,
    title,
    nickname: asOptionalText(record.nickname).trim(),
    userId: asUuid(record.user_id) ?? asOptionalText(record.user_id),
    likeCount,
    commentCount,
    recommendScore,
    avatarId,
    avatarKind,
    paletteId,
    paletteSwapped,
    historyMeta: parseHistoryMeta(record.history_meta),
  };
}

export function normalizeDefragmentSourcePost(raw: unknown): {
  id: string;
  created_at: string;
  nickname: string;
  user_id: string;
  title?: string | null;
  content_text?: string;
  transformed_name?: string | null;
  reason?: string;
  note?: string;
  like_count?: number;
  comment_count?: number;
} {
  const record = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return {
    id: asUuid(record.id) ?? "",
    created_at: asIsoTimestamp(record.created_at) ?? "",
    nickname: asOptionalText(record.nickname),
    user_id: asUuid(record.user_id) ?? asOptionalText(record.user_id),
    title: typeof record.title === "string" ? record.title : null,
    content_text: typeof record.content_text === "string" ? record.content_text : undefined,
    transformed_name: typeof record.transformed_name === "string"
      ? record.transformed_name
      : null,
    reason: typeof record.reason === "string" ? record.reason : undefined,
    note: typeof record.note === "string" ? record.note : undefined,
    like_count: asNonNegativeInt(record.like_count) ?? undefined,
    comment_count: asNonNegativeInt(record.comment_count) ?? undefined,
  };
}

export function cursorFromDefragmentItem(
  item: DefragmentFeedItem,
  sort: ToyboxFeedSort,
): ToyboxFeedCursor {
  return {
    score: sort === "comments"
      ? item.commentCount
      : sort === "recommended"
        ? item.likeCount
        : item.recommendScore,
    createdAt: item.created_at,
    id: item.id,
  };
}

/**
 * The cursor is the last row the Worker sent (its ISO created_at and row id), so
 * one the Worker would refuse is an outage, not a query to send
 * (docs/supabase-exit/STEP6_PLAN.md WP-T1; run ids are checked by P14).
 */
function requireApiCursor(cursor: ToyboxFeedCursor | null): void {
  if (!cursor || (isRowId(cursor.id) && isCursorCreatedAt(cursor.createdAt))) return;
  throw new ApiUnavailableError(0, "bad_cursor");
}

function feedPage(rows: unknown[]): DefragmentFeedPage {
  const items = rows
    .map(parseDefragmentFeedRow)
    .filter((item): item is DefragmentFeedItem => item != null);
  return { items, hasMore: items.length >= TOYBOX_FEED_PAGE_SIZE };
}

async function fetchFilteredDefragmentFeedPage(options: {
  service: Exclude<DefragmentFederatedService, "history_course">;
  sort: ToyboxFeedSort;
  cursor: ToyboxFeedCursor | null;
}): Promise<DefragmentFeedPage> {
  const page = await fetchToyboxFeedPage({
    service: options.service,
    sort: options.sort,
    cursor: options.cursor,
    normalizePost: normalizeDefragmentSourcePost,
  });
  return {
    items: page.items.map((item) => feedItemFromPost(options.service, {
      ...item.post,
      like_count: item.likeCount,
      comment_count: item.commentCount,
    })),
    hasMore: page.hasMore,
  };
}

async function fetchHistoryCourseDefragmentPage(options: {
  sort: ToyboxFeedSort;
  cursor: ToyboxFeedCursor | null;
}): Promise<DefragmentFeedPage> {
  const sort = options.sort === "comments" || options.sort === "recommended"
    ? options.sort
    : "latest";
  requireApiCursor(options.cursor);
  // docs/supabase-exit/STEP1_DESIGN.md 9.8: the runs columns, order and keyset; the Worker builds the filter.
  return historyCoursePage(await apiDefragmentRuns(sort, options.cursor));
}

function historyCoursePage(rows: unknown[]): DefragmentFeedPage {
  const items = rows
    .map((row) => {
      const record = row as Record<string, unknown>;
      return parseDefragmentFeedRow({
        id: record.id,
        created_at: record.created_at,
        like_count: record.like_count,
        comment_count: record.comment_count,
        recommend_score: record.like_count,
        service: "history_course",
        title: typeof record.seed === "string" && record.seed.trim()
          ? record.seed
          : record.id,
        nickname: typeof record.donor_nickname === "string" && record.donor_nickname.trim()
          ? record.donor_nickname.trim()
          : DEFAULT_USER_PROFILE.nickname,
        user_id: record.donor_user_id,
        history_meta: {
          cover_spec: record.cover_spec,
          win: record.win,
          ascension: record.ascension,
          total_floors: record.total_floors,
        },
      });
    })
    .filter((item): item is DefragmentFeedItem => item != null);

  return { items, hasMore: items.length >= TOYBOX_FEED_PAGE_SIZE };
}

export async function fetchDefragmentFeedPage(options: {
  sort: ToyboxFeedSort;
  cursor: ToyboxFeedCursor | null;
  service?: DefragmentFederatedService | null;
}): Promise<DefragmentFeedPage> {
  const sort: ToyboxFeedSort = isToyboxFeedCoreSort(options.sort) ? options.sort : "latest";
  if (options.service === "history_course") {
    return fetchHistoryCourseDefragmentPage({ sort, cursor: options.cursor });
  }
  if (options.service) {
    return fetchFilteredDefragmentFeedPage({
      service: options.service,
      sort,
      cursor: options.cursor,
    });
  }

  requireApiCursor(options.cursor);
  // docs/supabase-exit/STEP1_DESIGN.md 9.8: the get_defragment_feed_v2 rows, through the Worker.
  return feedPage(await apiDefragmentFeed(sort, options.cursor));
}

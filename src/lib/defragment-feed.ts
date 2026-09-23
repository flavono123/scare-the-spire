import {
  feedItemFromPost,
  isDefragmentFederatedService,
  type DefragmentFederatedService,
  type DefragmentFeedItem,
  type HistoryCourseFeedMeta,
} from "@/lib/defragment";
import { isCoverSpec } from "@/lib/run-cover-types";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import {
  asNonNegativeInt,
  buildLatestFeedKeysetFilter,
  fetchToyboxFeedPage,
  isToyboxFeedCoreSort,
  TOYBOX_FEED_PAGE_SIZE,
  TOYBOX_FEED_TABLES,
  toyboxRecommendScore,
  type ToyboxFeedCursor,
  type ToyboxFeedSort,
} from "@/lib/toybox-feed";

export interface DefragmentFeedPage {
  items: DefragmentFeedItem[];
  hasMore: boolean;
}

export function isMissingDefragmentFeedRpc(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === "PGRST202") return true;
  return /get_defragment_feed/i.test(error.message ?? "");
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

async function fetchFilteredDefragmentFeedPage(options: {
  service: DefragmentFederatedService;
  sort: ToyboxFeedSort;
  cursor: ToyboxFeedCursor | null;
}): Promise<DefragmentFeedPage> {
  const page = await fetchToyboxFeedPage({
    service: options.service,
    table: TOYBOX_FEED_TABLES[options.service],
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
  const scoreColumn = sort === "comments" ? "comment_count" : "like_count";
  let query = supabase
    .from("runs")
    .select("id, created_at, like_count, comment_count, seed, donor_user_id, cover_spec, win, ascension, total_floors")
    .eq("env", supabaseEnv)
    .order(sort === "latest" ? "created_at" : scoreColumn, { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(TOYBOX_FEED_PAGE_SIZE);

  if (options.cursor && sort === "latest") {
    query = query.or(buildLatestFeedKeysetFilter(options.cursor));
  } else if (options.cursor) {
    const score = String(Math.trunc(options.cursor.score));
    const createdAt = options.cursor.createdAt.replaceAll('"', "");
    const id = options.cursor.id.replaceAll('"', "");
    query = query.or(
      `${scoreColumn}.lt.${score},and(${scoreColumn}.eq.${score},created_at.lt."${createdAt}"),and(${scoreColumn}.eq.${score},created_at.eq."${createdAt}",id.lt."${id}")`,
    );
  }

  const { data, error } = await withSupabaseTimeout(
    "runs.feed.history_course",
    query,
  );
  if (error) {
    if (error.code === "42703") return { items: [], hasMore: false };
    throw error;
  }

  const items = (data ?? [])
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
        nickname: "",
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
  if (!supabaseEnabled) return { items: [], hasMore: false };

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

  const v2 = await withSupabaseTimeout(
    "get_defragment_feed_v2",
    supabase.rpc("get_defragment_feed_v2", {
      p_env: supabaseEnv,
      p_sort: sort,
      p_limit: TOYBOX_FEED_PAGE_SIZE,
      p_cursor_score: options.cursor?.score ?? null,
      p_cursor_created_at: options.cursor?.createdAt ?? null,
      p_cursor_id: options.cursor?.id ?? null,
    }),
  );

  const result = !v2.error || !isMissingDefragmentFeedRpc(v2.error)
    ? v2
    : await withSupabaseTimeout(
      "get_defragment_feed",
      supabase.rpc("get_defragment_feed", {
        p_env: supabaseEnv,
        p_sort: sort,
        p_limit: TOYBOX_FEED_PAGE_SIZE,
        p_cursor_score: options.cursor?.score ?? null,
        p_cursor_created_at: options.cursor?.createdAt ?? null,
        p_cursor_id: options.cursor?.id ?? null,
      }),
    );

  if (!result.error) {
    const items = ((result.data ?? []) as unknown[])
      .map(parseDefragmentFeedRow)
      .filter((item): item is DefragmentFeedItem => item != null);
    return { items, hasMore: items.length >= TOYBOX_FEED_PAGE_SIZE };
  }

  if (!isMissingDefragmentFeedRpc(result.error)) throw result.error;
  return { items: [], hasMore: false };
}

import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

export const TOYBOX_FEED_PAGE_SIZE = 20;

export const TOYBOX_FEED_SERVICES = [
  "combo",
  "transfigure",
  "this_or_that",
  "chemical_x",
] as const;

export const TOYBOX_FEED_SORTS = ["latest", "recommended", "comments"] as const;

/** Button order for Toy Box indexes: 최신 / 추천 / 댓글. */
export const TOYBOX_FEED_SORT_OPTIONS = [
  "latest",
  "recommended",
  "comments",
] as const satisfies readonly ToyboxFeedSort[];

export const DEFAULT_TOYBOX_FEED_SORT: ToyboxFeedSort = "latest";

export const TOYBOX_FEED_TABLES = {
  combo: "combo_posts",
  transfigure: "transfigure_posts",
  this_or_that: "this_or_that_posts",
  chemical_x: "chemical_posts",
} as const;

export type ToyboxFeedService = (typeof TOYBOX_FEED_SERVICES)[number];
export type ToyboxFeedSort = (typeof TOYBOX_FEED_SORTS)[number];
export type ToyboxFeedTable = (typeof TOYBOX_FEED_TABLES)[ToyboxFeedService];

export interface ToyboxFeedCursor {
  score: number;
  createdAt: string;
  id: string;
}

export interface ToyboxFeedItem<T> {
  post: T;
  likeCount: number;
  commentCount: number;
  recommendScore: number;
}

export interface ToyboxFeedPage<T> {
  items: ToyboxFeedItem<T>[];
  hasMore: boolean;
}

type PostIdentity = {
  id: string;
  created_at: string;
};

export function isToyboxFeedSort(value: unknown): value is ToyboxFeedSort {
  return value === "latest" || value === "recommended" || value === "comments";
}

export function toyboxRecommendScore(likeCount: number, commentCount: number): number {
  return likeCount * 4 + commentCount * 6;
}

export function buildLatestFeedKeysetFilter(cursor: {
  createdAt: string;
  id: string;
}): string {
  const createdAt = cursor.createdAt.replaceAll('"', "");
  const id = cursor.id.replaceAll('"', "");
  return `created_at.lt."${createdAt}",and(created_at.eq."${createdAt}",id.lt."${id}")`;
}

export function isMissingToyboxFeedRpc(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === "PGRST202") return true;
  return /get_toybox_feed/i.test(error.message ?? "");
}

export function asNonNegativeInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return Math.trunc(parsed);
  }
  return null;
}

export function itemFromPostRecord<T extends PostIdentity>(
  post: T,
  raw: unknown = post,
): ToyboxFeedItem<T> {
  const record = raw && typeof raw === "object"
    ? raw as Record<string, unknown>
    : {};
  const likeCount = asNonNegativeInt(record.like_count) ?? 0;
  const commentCount = asNonNegativeInt(record.comment_count) ?? 0;
  return {
    post,
    likeCount,
    commentCount,
    recommendScore: toyboxRecommendScore(likeCount, commentCount),
  };
}

export function parseToyboxFeedRow<T extends PostIdentity>(
  row: unknown,
  normalizePost: (raw: unknown) => T,
): ToyboxFeedItem<T> | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const nested = record.post && typeof record.post === "object"
    ? record.post
    : row;
  const post = normalizePost(nested);
  if (!post?.id || !post.created_at) return null;

  const likeCount = asNonNegativeInt(record.like_count)
    ?? asNonNegativeInt((nested as Record<string, unknown>).like_count)
    ?? 0;
  const commentCount = asNonNegativeInt(record.comment_count)
    ?? asNonNegativeInt((nested as Record<string, unknown>).comment_count)
    ?? 0;
  const recommendScore = asNonNegativeInt(record.recommend_score)
    ?? toyboxRecommendScore(likeCount, commentCount);

  return {
    post,
    likeCount,
    commentCount,
    recommendScore,
  };
}

export function cursorFromFeedItem<T extends PostIdentity>(
  item: ToyboxFeedItem<T>,
  sort: ToyboxFeedSort,
): ToyboxFeedCursor {
  return {
    score: sort === "comments" ? item.commentCount : item.recommendScore,
    createdAt: item.post.created_at,
    id: item.post.id,
  };
}

export function mergeToyboxFeedItem<T extends PostIdentity>(
  current: ToyboxFeedItem<T>,
  nextPost: T,
  raw: unknown = nextPost,
): ToyboxFeedItem<T> {
  const record = raw && typeof raw === "object"
    ? raw as Record<string, unknown>
    : {};
  const likeCount = asNonNegativeInt(record.like_count) ?? current.likeCount;
  const commentCount = asNonNegativeInt(record.comment_count) ?? current.commentCount;
  return {
    post: nextPost,
    likeCount,
    commentCount,
    recommendScore: toyboxRecommendScore(likeCount, commentCount),
  };
}

export function countsFromFeedItems<T extends PostIdentity>(
  items: ToyboxFeedItem<T>[],
): { likeCounts: Record<string, number>; commentCounts: Record<string, number> } {
  const likeCounts: Record<string, number> = {};
  const commentCounts: Record<string, number> = {};
  for (const item of items) {
    likeCounts[item.post.id] = item.likeCount;
    commentCounts[item.post.id] = item.commentCount;
  }
  return { likeCounts, commentCounts };
}

async function fetchLatestTablePage<T extends PostIdentity>(
  table: string,
  cursor: ToyboxFeedCursor | null,
  normalizePost: (raw: unknown) => T,
): Promise<ToyboxFeedPage<T>> {
  let query = supabase
    .from(table)
    .select("*")
    .eq("env", supabaseEnv)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(TOYBOX_FEED_PAGE_SIZE);

  if (cursor) {
    query = query.or(buildLatestFeedKeysetFilter(cursor));
  }

  const { data, error } = await withSupabaseTimeout(
    `${table}.feed.latest`,
    query,
  );
  if (error) throw error;

  const items = (data ?? [])
    .map((row) => {
      const post = normalizePost(row);
      if (!post?.id || !post.created_at) return null;
      return itemFromPostRecord(post, row);
    })
    .filter((item): item is ToyboxFeedItem<T> => item != null);

  return { items, hasMore: items.length >= TOYBOX_FEED_PAGE_SIZE };
}

export async function fetchToyboxFeedPage<T extends PostIdentity>(options: {
  service: ToyboxFeedService;
  table: string;
  sort: ToyboxFeedSort;
  cursor: ToyboxFeedCursor | null;
  normalizePost: (raw: unknown) => T;
}): Promise<ToyboxFeedPage<T>> {
  if (!supabaseEnabled) return { items: [], hasMore: false };

  const { data, error } = await withSupabaseTimeout(
    `get_toybox_feed.${options.service}`,
    supabase.rpc("get_toybox_feed", {
      p_env: supabaseEnv,
      p_service: options.service,
      p_sort: options.sort,
      p_limit: TOYBOX_FEED_PAGE_SIZE,
      p_cursor_score: options.cursor?.score ?? null,
      p_cursor_created_at: options.cursor?.createdAt ?? null,
      p_cursor_id: options.cursor?.id ?? null,
    }),
  );

  if (!error) {
    const rows = (data ?? []) as unknown[];
    const items = rows
      .map((row) => parseToyboxFeedRow(row, options.normalizePost))
      .filter((item): item is ToyboxFeedItem<T> => item != null);
    return { items, hasMore: items.length >= TOYBOX_FEED_PAGE_SIZE };
  }

  if (!isMissingToyboxFeedRpc(error)) throw error;

  return fetchLatestTablePage(options.table, options.cursor, options.normalizePost);
}

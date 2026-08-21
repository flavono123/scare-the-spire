import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

export const TOYBOX_FEED_PAGE_SIZE = 20;

export const TOYBOX_FEED_SERVICES = [
  "combo",
  "transfigure",
  "this_or_that",
  "chemical_x",
] as const;

export const TOYBOX_FEED_TABLES = {
  combo: "combo_posts",
  transfigure: "transfigure_posts",
  this_or_that: "this_or_that_posts",
  chemical_x: "chemical_posts",
} as const;

export type ToyboxFeedService = (typeof TOYBOX_FEED_SERVICES)[number];
export type ToyboxFeedTable = (typeof TOYBOX_FEED_TABLES)[ToyboxFeedService];

/** Shared button order: 최신 / 추천 / 댓글. Extra sorts append after these. */
export const TOYBOX_FEED_CORE_SORTS = ["latest", "recommended", "comments"] as const;
export type ToyboxFeedCoreSort = (typeof TOYBOX_FEED_CORE_SORTS)[number];

/** Registered extra sorts. Append via `TOYBOX_FEED_EXTRA_SORTS_BY_SERVICE`. */
export const TOYBOX_FEED_EXTRA_SORTS = ["vote_rate_high", "vote_rate_low"] as const;
export type ToyboxFeedExtraSort = (typeof TOYBOX_FEED_EXTRA_SORTS)[number];

export const TOYBOX_FEED_SORTS = [
  ...TOYBOX_FEED_CORE_SORTS,
  ...TOYBOX_FEED_EXTRA_SORTS,
] as const;
export type ToyboxFeedSort = (typeof TOYBOX_FEED_SORTS)[number];

/** Default toggle options for indexes that do not opt into extras. */
export const TOYBOX_FEED_SORT_OPTIONS = TOYBOX_FEED_CORE_SORTS;

export const DEFAULT_TOYBOX_FEED_SORT: ToyboxFeedCoreSort = "latest";

export const TOYBOX_FEED_VOTE_RATE_BPS_MAX = 10000;

export const TOYBOX_FEED_EXTRA_SORTS_BY_SERVICE: {
  readonly [K in ToyboxFeedService]?: readonly ToyboxFeedExtraSort[];
} = {
  this_or_that: ["vote_rate_high", "vote_rate_low"],
};

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

const TOYBOX_FEED_CORE_SORT_SET = new Set<string>(TOYBOX_FEED_CORE_SORTS);
const TOYBOX_FEED_SORT_SET = new Set<string>(TOYBOX_FEED_SORTS);

export function isToyboxFeedCoreSort(value: unknown): value is ToyboxFeedCoreSort {
  return typeof value === "string" && TOYBOX_FEED_CORE_SORT_SET.has(value);
}

export function isToyboxFeedSort(value: unknown): value is ToyboxFeedSort {
  return typeof value === "string" && TOYBOX_FEED_SORT_SET.has(value);
}

export function toyboxFeedSortOptionsFor(
  service: ToyboxFeedService,
): readonly ToyboxFeedSort[] {
  const extras = TOYBOX_FEED_EXTRA_SORTS_BY_SERVICE[service];
  if (!extras || extras.length === 0) return TOYBOX_FEED_CORE_SORTS;
  return [...TOYBOX_FEED_CORE_SORTS, ...extras];
}

export function resolveToyboxFeedSort(
  service: ToyboxFeedService,
  sort: ToyboxFeedSort,
): ToyboxFeedSort {
  return toyboxFeedSortOptionsFor(service).includes(sort)
    ? sort
    : DEFAULT_TOYBOX_FEED_SORT;
}

/** Winner share in basis points (50%–100% for two-option votes; 0 when empty). */
export function toyboxWinnerShareBps(leftCount: number, rightCount: number): number {
  const total = leftCount + rightCount;
  if (total <= 0) return 0;
  return Math.trunc((Math.max(leftCount, rightCount) * TOYBOX_FEED_VOTE_RATE_BPS_MAX) / total);
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

function voteRateBpsFromPost(post: PostIdentity): number {
  const record = post as PostIdentity & Record<string, unknown>;
  const left = asNonNegativeInt(record.left_vote_count) ?? 0;
  const right = asNonNegativeInt(record.right_vote_count) ?? 0;
  return toyboxWinnerShareBps(left, right);
}

const EXTRA_SORT_CURSOR_SCORE: Record<
  ToyboxFeedExtraSort,
  (item: ToyboxFeedItem<PostIdentity>) => number
> = {
  vote_rate_high: (item) => voteRateBpsFromPost(item.post),
  vote_rate_low: (item) => TOYBOX_FEED_VOTE_RATE_BPS_MAX - voteRateBpsFromPost(item.post),
};

export function toyboxFeedCursorScore<T extends PostIdentity>(
  item: ToyboxFeedItem<T>,
  sort: ToyboxFeedSort,
): number {
  if (sort === "comments") return item.commentCount;
  const extraScore = EXTRA_SORT_CURSOR_SCORE[sort as ToyboxFeedExtraSort];
  if (extraScore) return extraScore(item);
  return item.recommendScore;
}

export function cursorFromFeedItem<T extends PostIdentity>(
  item: ToyboxFeedItem<T>,
  sort: ToyboxFeedSort,
): ToyboxFeedCursor {
  return {
    score: toyboxFeedCursorScore(item, sort),
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

  const sort = resolveToyboxFeedSort(options.service, options.sort);
  const { data, error } = await withSupabaseTimeout(
    `get_toybox_feed.${options.service}`,
    supabase.rpc("get_toybox_feed", {
      p_env: supabaseEnv,
      p_service: options.service,
      p_sort: sort,
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

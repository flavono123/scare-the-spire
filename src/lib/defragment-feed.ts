import {
  isDefragmentFeedService,
  type DefragmentFeedItem,
  type DefragmentFeedService,
} from "@/lib/defragment";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import {
  asNonNegativeInt,
  buildLatestFeedKeysetFilter,
  isToyboxFeedSort,
  TOYBOX_FEED_PAGE_SIZE,
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

export function parseDefragmentFeedRow(row: unknown): DefragmentFeedItem | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const id = asUuid(record.id);
  const createdAt = asIsoTimestamp(record.created_at);
  if (!id || !createdAt || !isDefragmentFeedService(record.service)) return null;

  const likeCount = asNonNegativeInt(record.like_count) ?? 0;
  const commentCount = asNonNegativeInt(record.comment_count) ?? 0;
  const recommendScore = asNonNegativeInt(record.recommend_score)
    ?? toyboxRecommendScore(likeCount, commentCount);
  const title = typeof record.title === "string" ? record.title : "";

  return {
    id,
    created_at: createdAt,
    service: record.service as DefragmentFeedService,
    title,
    likeCount,
    commentCount,
    recommendScore,
  };
}

export function cursorFromDefragmentItem(
  item: DefragmentFeedItem,
  sort: ToyboxFeedSort,
): ToyboxFeedCursor {
  return {
    score: sort === "comments" ? item.commentCount : item.recommendScore,
    createdAt: item.created_at,
    id: item.id,
  };
}

async function fetchLatestNativePage(
  cursor: ToyboxFeedCursor | null,
): Promise<DefragmentFeedPage> {
  let query = supabase
    .from("defragment_posts")
    .select("id, created_at, title, like_count, comment_count")
    .eq("env", supabaseEnv)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(TOYBOX_FEED_PAGE_SIZE);

  if (cursor) {
    query = query.or(buildLatestFeedKeysetFilter(cursor));
  }

  const { data, error } = await withSupabaseTimeout(
    "defragment_posts.feed.latest",
    query,
  );
  if (error) throw error;

  const items = (data ?? [])
    .map((row) => parseDefragmentFeedRow({ ...row, service: "defragment" }))
    .filter((item): item is DefragmentFeedItem => item != null);

  return { items, hasMore: items.length >= TOYBOX_FEED_PAGE_SIZE };
}

export async function fetchDefragmentFeedPage(options: {
  sort: ToyboxFeedSort;
  cursor: ToyboxFeedCursor | null;
}): Promise<DefragmentFeedPage> {
  if (!supabaseEnabled) return { items: [], hasMore: false };

  const sort: ToyboxFeedSort = isToyboxFeedSort(options.sort) ? options.sort : "latest";
  const { data, error } = await withSupabaseTimeout(
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

  if (!error) {
    const items = ((data ?? []) as unknown[])
      .map(parseDefragmentFeedRow)
      .filter((item): item is DefragmentFeedItem => item != null);
    return { items, hasMore: items.length >= TOYBOX_FEED_PAGE_SIZE };
  }

  if (!isMissingDefragmentFeedRpc(error)) throw error;

  return fetchLatestNativePage(options.cursor);
}

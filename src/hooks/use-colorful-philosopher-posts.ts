"use client";

import { useCallback, useEffect, useState } from "react";
import {
  COLORFUL_PHILOSOPHERS_POSTS_TABLE,
  colorfulPhilosopherPostFromRow,
  colorfulPhilosophersNextWeekStart,
  COLORFUL_PHILOSOPHER_SLOTS,
  type ColorfulPhilosopherPost,
} from "@/lib/colorful-philosophers";
import { apiFetch, ApiUnavailableError, requireApiVersion } from "@/lib/api-client";
import { dataEnv } from "@/lib/data-env";
import { isUuid } from "@/lib/engagement-keys";
// Only useColorfulPhilosophersNextWeekOpen still reads Supabase; WP-Z removes it with them.
import { supabase, supabaseEnabled } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

/**
 * Colorful philosophers posts, from the Worker only (docs/supabase-exit/STEP1_DESIGN.md 9.2).
 * Step 6 (docs/supabase-exit/STEP6_PLAN.md WP-D): there is no direct Supabase read, so a
 * former legacy signal (src/lib/api-client.ts) and a read the Worker cannot serve show the
 * "database is not answering" state, as those reads did when they failed.
 */

type PostRow = Parameters<typeof colorfulPhilosopherPostFromRow>[0];

function postsFromRows(rows: readonly PostRow[]): ColorfulPhilosopherPost[] {
  return rows.flatMap((row) => {
    const post = colorfulPhilosopherPostFromRow(row);
    return post ? [post] : [];
  });
}

export type ColorfulPhilosopherWeek = {
  posts: ColorfulPhilosopherPost[];
  /** Reply counts by post id, read with the posts. */
  commentCounts: Record<string, number>;
};

/**
 * The env's latest 100 posts and their reply counts. The Worker reads only its own env, so
 * another env is unavailable without a request. Throws ApiError or ApiUnavailableError.
 */
export async function fetchColorfulPhilosopherWeek(env: string = dataEnv): Promise<ColorfulPhilosopherWeek> {
  if (env !== dataEnv) throw new ApiUnavailableError(0, "other_env");
  const body = await apiFetch<{ v?: number; posts?: PostRow[]; commentCounts?: Record<string, number> }>(
    "colorful-philosophers",
    "/api/read/colorful-philosophers/week",
  );
  requireApiVersion("colorful-philosophers", body);
  return {
    posts: postsFromRows(body.posts ?? []),
    // No counts in a v1 answer means the Worker could not read them: show none.
    commentCounts: body.commentCounts ?? {},
  };
}

const HEX_PAIR = /^[0-9a-fA-F]{2}$/;

/**
 * The canonical uuid for an id written in another form Postgres's uuid input accepts (braces,
 * hyphens left out or after any group of four digits; string_to_uuid in Postgres's uuid.c),
 * or null when Postgres rejects it.
 */
function postgresUuid(value: string): string | null {
  let rest = value;
  const braces = rest.startsWith("{");
  if (braces) rest = rest.slice(1);
  let hex = "";
  for (let byte = 0; byte < 16; byte += 1) {
    const pair = rest.slice(0, 2);
    if (!HEX_PAIR.test(pair)) return null;
    hex += pair.toLowerCase();
    rest = rest.slice(2);
    if (rest.startsWith("-") && byte % 2 === 1 && byte < 15) rest = rest.slice(1);
  }
  if (braces) {
    if (!rest.startsWith("}")) return null;
    rest = rest.slice(1);
  }
  if (rest !== "") return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * One post, or null when there is none. An id in another form of uuid is read as its canonical
 * form, as the direct Supabase read matched it against the uuid id column. Any other id is
 * unavailable without a request: that read failed on the cast and the page said the database
 * was not answering (STEP6_PLAN WP-D 2). Throws ApiError or ApiUnavailableError.
 */
export async function fetchColorfulPhilosopherPost(postId: string): Promise<ColorfulPhilosopherPost | null> {
  const id = isUuid(postId) ? postId : postgresUuid(postId);
  if (!id) throw new ApiUnavailableError(0, "not_uuid");
  const body = await apiFetch<{ v?: number; post?: PostRow | null }>(
    "colorful-philosophers",
    `/api/read/colorful-philosophers/post?id=${encodeURIComponent(id)}`,
  );
  requireApiVersion("colorful-philosophers", body);
  return body.post ? colorfulPhilosopherPostFromRow(body.post) : null;
}

export function useColorfulPhilosopherWeek(env = dataEnv) {
  const [posts, setPosts] = useState<ColorfulPhilosopherPost[]>([]);
  // Reply counts that came with the posts; null until the first answer.
  const [commentCounts, setCommentCounts] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the loading line while the week is read
    setLoading(true);
    fetchColorfulPhilosopherWeek(env).then((week) => {
      if (cancelled) return;
      setPosts(week.posts);
      setCommentCounts(week.commentCounts);
      setUnavailable(false);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setUnavailable(true);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [env, reloadKey]);

  // `missing` (the posts table not deployed) only ever came from the direct Supabase read.
  return { posts, loading, unavailable, missing: false, reload, commentCounts };
}

/** True when next week's production reservation is missing any slot; rechecked per `refreshKey`. */
export function useColorfulPhilosophersNextWeekOpen(enabled: boolean, refreshKey: string): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled || !supabaseEnabled) return;
    let cancelled = false;
    withSupabaseTimeout(
      "colorful_philosopher_posts.next_week",
      supabase.from(COLORFUL_PHILOSOPHERS_POSTS_TABLE).select("slot")
        .eq("env", "production")
        .eq("week_start", colorfulPhilosophersNextWeekStart()),
    ).then(({ data, error }) => {
      if (cancelled || error) return;
      const filled = new Set((data ?? []).map((row) => row.slot));
      setOpen(COLORFUL_PHILOSOPHER_SLOTS.some((slot) => !filled.has(slot)));
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled, refreshKey]);

  return enabled && open;
}

export function useColorfulPhilosopherPost(postId: string) {
  const [post, setPost] = useState<ColorfulPhilosopherPost | null>(null);
  const [loading, setLoading] = useState(Boolean(postId));
  const [unavailable, setUnavailable] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  useEffect(() => {
    if (!postId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- there is no post to query
      setPost(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchColorfulPhilosopherPost(postId).then((next) => {
      if (cancelled) return;
      setPost(next);
      setUnavailable(false);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setUnavailable(true);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [postId, reloadKey]);

  return { post, loading, unavailable, reload };
}

const EMPTY_COMMENT_COUNTS: Record<string, number> = {};

/** `known`: the counts that came with the week's posts; none until they come. */
export function useColorfulPhilosopherCommentCounts(postIds: string[], known: Record<string, number> | null = null) {
  void postIds;
  return known ?? EMPTY_COMMENT_COUNTS;
}

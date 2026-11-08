"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  COLORFUL_PHILOSOPHERS_POSTS_TABLE,
  colorfulPhilosopherPostFromRow,
  colorfulPhilosophersCommentThreadKey,
  colorfulPhilosophersNextWeekStart,
  COLORFUL_PHILOSOPHER_SLOTS,
  isMissingColorfulPhilosopherPosts,
  type ColorfulPhilosopherPost,
} from "@/lib/colorful-philosophers";
import { apiFetch, SurfaceLegacyError } from "@/lib/api-client";
import { isUuid } from "@/lib/engagement-keys";
import { demoteSurface, surfacePath } from "@/lib/runtime-flags";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

const POST_COLUMNS = "id, week_start, slot, resource_type, resource_id, name_ko, name_en, image_url, body, game_version, buff_count, nerf_count, rework_count";

type PostRow = Parameters<typeof colorfulPhilosopherPostFromRow>[0];

function postsFromRows(rows: readonly PostRow[]): ColorfulPhilosopherPost[] {
  return rows.flatMap((row) => {
    const post = colorfulPhilosopherPostFromRow(row);
    return post ? [post] : [];
  });
}

/** A body this client does not know is a legacy signal (docs/supabase-exit/STEP1_DESIGN.md 9.2). */
function checkVersion(body: { v?: unknown } | null): void {
  if (body?.v === 1) return;
  demoteSurface("colorful-philosophers");
  throw new SurfaceLegacyError(200, false);
}

export function useColorfulPhilosopherWeek(env = supabaseEnv) {
  const [posts, setPosts] = useState<ColorfulPhilosopherPost[]>([]);
  // Reply counts that came with the posts on the api path; null means "count them here".
  const [commentCounts, setCommentCounts] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [unavailable, setUnavailable] = useState(false);
  const [missing, setMissing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  useEffect(() => {
    // The Worker reads its own env, so only the page's own env goes through it (the dev page picks others).
    const viaApi = env === supabaseEnv && surfacePath("colorful-philosophers") === "api";
    if (!supabaseEnabled && !viaApi) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- there is no post store to query
      setPosts([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    if (viaApi) {
      apiFetch<{ v?: number; posts?: PostRow[]; commentCounts?: Record<string, number> }>(
        "colorful-philosophers",
        "/api/read/colorful-philosophers/week",
      ).then((body) => {
        if (cancelled) return;
        checkVersion(body);
        setPosts(postsFromRows(body.posts ?? []));
        // No counts in a v1 answer means the Worker could not read them: show none rather
        // than have the browser ask Supabase again (STEP1_DESIGN 7, 9.2).
        setCommentCounts(body.commentCounts ?? {});
        setMissing(false);
        setUnavailable(false);
        setLoading(false);
      }).catch((error) => {
        if (cancelled) return;
        if (error instanceof SurfaceLegacyError && supabaseEnabled) {
          setReloadKey((value) => value + 1);
          return;
        }
        setUnavailable(true);
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }
    setCommentCounts(null);
    withSupabaseTimeout(
      "colorful_philosopher_posts.week",
      supabase.from(COLORFUL_PHILOSOPHERS_POSTS_TABLE).select(POST_COLUMNS)
        .eq("env", env)
        .order("week_start", { ascending: false })
        .limit(100),
    ).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setMissing(isMissingColorfulPhilosopherPosts(error));
        setUnavailable(!isMissingColorfulPhilosopherPosts(error));
        setPosts([]);
      } else {
        setPosts((data ?? []).flatMap((row) => {
          const post = colorfulPhilosopherPostFromRow(row);
          return post ? [post] : [];
        }));
        setMissing(false);
        setUnavailable(false);
      }
      setLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setUnavailable(true);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [env, reloadKey]);

  return { posts, loading, unavailable, missing, reload, commentCounts };
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
  const [loading, setLoading] = useState(Boolean(postId) && supabaseEnabled);
  const [unavailable, setUnavailable] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  useEffect(() => {
    const viaApi = isUuid(postId) && surfacePath("colorful-philosophers") === "api";
    if (!postId || (!supabaseEnabled && !viaApi)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- there is no post to query
      setPost(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    if (viaApi) {
      apiFetch<{ v?: number; post?: PostRow | null }>(
        "colorful-philosophers",
        `/api/read/colorful-philosophers/post?id=${encodeURIComponent(postId)}`,
      ).then((body) => {
        if (cancelled) return;
        checkVersion(body);
        setPost(body.post ? colorfulPhilosopherPostFromRow(body.post) : null);
        setUnavailable(false);
        setLoading(false);
      }).catch((error) => {
        if (cancelled) return;
        if (error instanceof SurfaceLegacyError && supabaseEnabled) {
          setReloadKey((value) => value + 1);
          return;
        }
        setUnavailable(true);
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }
    withSupabaseTimeout(
      "colorful_philosopher_posts.detail",
      supabase.from(COLORFUL_PHILOSOPHERS_POSTS_TABLE).select(POST_COLUMNS)
        .eq("id", postId)
        .eq("env", supabaseEnv)
        .maybeSingle(),
    ).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setUnavailable(true);
        setPost(null);
      } else {
        setPost(data ? colorfulPhilosopherPostFromRow(data) : null);
        setUnavailable(false);
      }
      setLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setUnavailable(true);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [postId, reloadKey]);

  return { post, loading, unavailable, reload };
}

const EMPTY_COMMENT_COUNTS: Record<string, number> = {};

/** `known`: counts that came with the week's posts (api path); then nothing is queried. */
export function useColorfulPhilosopherCommentCounts(postIds: string[], known: Record<string, number> | null = null) {
  const [counts, setCounts] = useState<Record<string, number>>(EMPTY_COMMENT_COUNTS);
  const [loadedKey, setLoadedKey] = useState("");
  const key = useMemo(() => [...postIds].sort().join(":"), [postIds]);

  useEffect(() => {
    if (known || !supabaseEnabled || postIds.length === 0) return;
    let cancelled = false;
    const threadKeys = postIds.map(colorfulPhilosophersCommentThreadKey);
    withSupabaseTimeout(
      "colorful_philosopher_comment_counts.select",
      supabase.from("comments").select("story_id").eq("env", supabaseEnv).in("story_id", threadKeys).limit(1000),
    ).then(({ data, error }) => {
      if (cancelled) return;
      if (error) throw error;
      const next: Record<string, number> = {};
      for (const row of data ?? []) {
        const storyId = String((row as { story_id: unknown }).story_id ?? "");
        const prefix = "colorful-philosophers:";
        if (!storyId.startsWith(prefix)) continue;
        const postId = storyId.slice(prefix.length);
        next[postId] = (next[postId] ?? 0) + 1;
      }
      setCounts(next);
      setLoadedKey(key);
    }).catch(() => {
      if (!cancelled) setLoadedKey(key);
    });
    return () => {
      cancelled = true;
    };
  }, [key, known]); // eslint-disable-line react-hooks/exhaustive-deps

  if (known) return known;
  return postIds.length > 0 && loadedKey === key ? counts : EMPTY_COMMENT_COUNTS;
}

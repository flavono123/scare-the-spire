"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  COLORFUL_PHILOSOPHERS_POSTS_TABLE,
  COLORFUL_PHILOSOPHERS_REACTIONS_TABLE,
  colorfulPhilosopherPostFromRow,
  colorfulPhilosopherReactionStorageKey,
  colorfulPhilosophersCommentThreadKey,
  isColorfulPhilosopherReaction,
  isMissingColorfulPhilosopherPosts,
  type ColorfulPhilosopherPost,
  type ColorfulPhilosopherReaction,
} from "@/lib/colorful-philosophers";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

const POST_COLUMNS = "id, week_start, slot, resource_id, name_ko, name_en, image_url, body, game_version, buff_count, nerf_count, rework_count";

export function useColorfulPhilosopherWeek(env = supabaseEnv) {
  const [posts, setPosts] = useState<ColorfulPhilosopherPost[]>([]);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [unavailable, setUnavailable] = useState(false);
  const [missing, setMissing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  useEffect(() => {
    if (!supabaseEnabled) {
      setPosts([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
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

  return { posts, loading, unavailable, missing, reload };
}

export function useColorfulPhilosopherPost(postId: string) {
  const [post, setPost] = useState<ColorfulPhilosopherPost | null>(null);
  const [loading, setLoading] = useState(Boolean(postId) && supabaseEnabled);
  const [unavailable, setUnavailable] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  useEffect(() => {
    if (!postId || !supabaseEnabled) {
      setPost(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
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

export function readColorfulPhilosopherReaction(postId: string): ColorfulPhilosopherReaction | null {
  if (!postId || typeof window === "undefined") return null;
  const cached = window.localStorage.getItem(colorfulPhilosopherReactionStorageKey(postId));
  return cached && isColorfulPhilosopherReaction(cached) ? cached : null;
}

function writeColorfulPhilosopherReaction(postId: string, kind: ColorfulPhilosopherReaction | null) {
  const key = colorfulPhilosopherReactionStorageKey(postId);
  if (kind) window.localStorage.setItem(key, kind);
  else window.localStorage.removeItem(key);
}

export async function saveColorfulPhilosopherReaction(input: {
  postId: string;
  userId: string;
  previous: ColorfulPhilosopherReaction | null;
  next: ColorfulPhilosopherReaction;
}): Promise<{ ok: true; kind: ColorfulPhilosopherReaction | null } | { ok: false; error: string }> {
  const nextKind = input.next === input.previous ? null : input.next;
  writeColorfulPhilosopherReaction(input.postId, nextKind);
  const query = nextKind === null
    ? supabase.from(COLORFUL_PHILOSOPHERS_REACTIONS_TABLE).delete()
      .eq("post_id", input.postId).eq("user_id", input.userId).eq("env", supabaseEnv)
    : input.previous
      ? supabase.from(COLORFUL_PHILOSOPHERS_REACTIONS_TABLE).update({ kind: nextKind })
        .eq("post_id", input.postId).eq("user_id", input.userId).eq("env", supabaseEnv)
      : supabase.from(COLORFUL_PHILOSOPHERS_REACTIONS_TABLE).insert({
        post_id: input.postId,
        user_id: input.userId,
        env: supabaseEnv,
        kind: nextKind,
      });
  const { error } = await query;
  if (error) {
    writeColorfulPhilosopherReaction(input.postId, input.previous);
    return { ok: false, error: error.message };
  }
  return { ok: true, kind: nextKind };
}

export function useColorfulPhilosopherReaction(postId: string, userId: string | null) {
  const [kind, setKind] = useState<ColorfulPhilosopherReaction | null>(null);

  useEffect(() => {
    setKind(readColorfulPhilosopherReaction(postId));
  }, [postId]);

  useEffect(() => {
    if (!postId || !userId || !supabaseEnabled) return;
    let cancelled = false;
    supabase.from(COLORFUL_PHILOSOPHERS_REACTIONS_TABLE)
      .select("kind")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .eq("env", supabaseEnv)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const next = data && isColorfulPhilosopherReaction(data.kind) ? data.kind : null;
        setKind(next);
        writeColorfulPhilosopherReaction(postId, next);
      });
    return () => {
      cancelled = true;
    };
  }, [postId, userId]);

  const choose = useCallback(async (next: ColorfulPhilosopherReaction) => {
    if (!userId || !supabaseEnabled) return { ok: false as const, error: "로그인이 필요합니다." };
    const previous = kind;
    const optimistic = next === previous ? null : next;
    setKind(optimistic);
    const result = await saveColorfulPhilosopherReaction({ postId, userId, previous, next });
    if (!result.ok) setKind(previous);
    return result.ok ? { ok: true as const } : result;
  }, [kind, postId, userId]);

  return { kind, choose };
}

const EMPTY_COMMENT_COUNTS: Record<string, number> = {};

export function useColorfulPhilosopherCommentCounts(postIds: string[]) {
  const [counts, setCounts] = useState<Record<string, number>>(EMPTY_COMMENT_COUNTS);
  const [loadedKey, setLoadedKey] = useState("");
  const key = useMemo(() => [...postIds].sort().join(":"), [postIds]);

  useEffect(() => {
    if (!supabaseEnabled || postIds.length === 0) return;
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
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return postIds.length > 0 && loadedKey === key ? counts : EMPTY_COMMENT_COUNTS;
}

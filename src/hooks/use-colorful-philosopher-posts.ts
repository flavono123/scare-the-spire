"use client";

import { useCallback, useEffect, useState } from "react";
import {
  COLORFUL_PHILOSOPHERS_POSTS_TABLE,
  COLORFUL_PHILOSOPHERS_REACTIONS_TABLE,
  colorfulPhilosopherPostFromRow,
  isColorfulPhilosopherReaction,
  isMissingColorfulPhilosopherPosts,
  type ColorfulPhilosopherPost,
  type ColorfulPhilosopherReaction,
} from "@/lib/colorful-philosophers";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

const POST_COLUMNS = "id, week_start, slot, resource_id, name_ko, name_en, image_url, body, game_version, buff_count, nerf_count, rework_count";

export function useColorfulPhilosopherWeek() {
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
        .eq("env", supabaseEnv)
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
  }, [reloadKey]);

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

export function useColorfulPhilosopherReaction(postId: string, userId: string | null) {
  const [kind, setKind] = useState<ColorfulPhilosopherReaction | null>(null);

  useEffect(() => {
    if (!postId || typeof window === "undefined") return;
    const cached = window.localStorage.getItem(`sts-cp-reaction:${postId}`);
    if (cached && isColorfulPhilosopherReaction(cached)) setKind(cached);
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
        setKind(data && isColorfulPhilosopherReaction(data.kind) ? data.kind : null);
      });
    return () => {
      cancelled = true;
    };
  }, [postId, userId]);

  const choose = useCallback(async (next: ColorfulPhilosopherReaction) => {
    if (!userId || !supabaseEnabled) return { ok: false as const, error: "로그인이 필요합니다." };
    const previous = kind;
    const nextKind = next === previous ? null : next;
    setKind(nextKind);
    if (typeof window !== "undefined") {
      const key = `sts-cp-reaction:${postId}`;
      if (nextKind) window.localStorage.setItem(key, nextKind);
      else window.localStorage.removeItem(key);
    }
    const query = next === previous
      ? supabase.from(COLORFUL_PHILOSOPHERS_REACTIONS_TABLE).delete()
        .eq("post_id", postId).eq("user_id", userId).eq("env", supabaseEnv)
      : previous
        ? supabase.from(COLORFUL_PHILOSOPHERS_REACTIONS_TABLE).update({ kind: next })
          .eq("post_id", postId).eq("user_id", userId).eq("env", supabaseEnv)
        : supabase.from(COLORFUL_PHILOSOPHERS_REACTIONS_TABLE).insert({
          post_id: postId,
          user_id: userId,
          env: supabaseEnv,
          kind: next,
        });
    const { error } = await query;
    if (error) {
      setKind(previous);
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const };
  }, [kind, postId, userId]);

  return { kind, choose };
}

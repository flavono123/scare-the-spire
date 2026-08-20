"use client";

import { useCallback, useEffect, useState } from "react";
import { useToyboxFeed } from "@/hooks/use-toybox-feed";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import {
  isSameThisOrThatResource,
  type ThisOrThatPost,
  type ThisOrThatResourceRef,
} from "@/lib/this-or-that";
import type { ToyboxFeedSort } from "@/lib/toybox-feed";

export type AddThisOrThatPostInput = {
  left: ThisOrThatResourceRef;
  right: ThisOrThatResourceRef;
  reason: string;
  nickname: string;
  activeUserId?: string;
};

interface UseThisOrThatPostsReturn {
  posts: ThisOrThatPost[];
  likeCounts: Record<string, number>;
  commentCounts: Record<string, number>;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  unavailable: boolean;
  loadMore: () => Promise<void>;
  add: (input: AddThisOrThatPostInput) => Promise<ThisOrThatPost | null>;
  remove: (postId: string) => Promise<void>;
}

interface UseThisOrThatPostReturn {
  post: ThisOrThatPost | null;
  loading: boolean;
  unavailable: boolean;
  remove: () => Promise<boolean>;
}

function normalizePost(row: unknown): ThisOrThatPost {
  return row as ThisOrThatPost;
}

export async function insertThisOrThatPost(
  input: AddThisOrThatPostInput,
): Promise<ThisOrThatPost | null> {
  const trimmedReason = input.reason.trim();
  const trimmedNickname = input.nickname.trim();
  if (
    !input.activeUserId
    || !supabaseEnabled
    || trimmedReason.length < 2
    || trimmedReason.length > 500
    || trimmedNickname.length < 1
    || trimmedNickname.length > 20
    || isSameThisOrThatResource(input.left, input.right)
  ) {
    return null;
  }

  const { data, error } = await withSupabaseTimeout(
    "this_or_that_posts.insert",
    supabase
      .from("this_or_that_posts")
      .insert({
        user_id: input.activeUserId,
        nickname: trimmedNickname,
        left_type: input.left.type,
        left_id: input.left.id,
        right_type: input.right.type,
        right_id: input.right.id,
        reason: trimmedReason,
        env: supabaseEnv,
      })
      .select()
      .single(),
  );
  if (error) throw error;
  if (!data) return null;
  return normalizePost(data);
}

export function useThisOrThatPosts(
  userId: string | null,
  sort: ToyboxFeedSort = "latest",
): UseThisOrThatPostsReturn {
  const {
    posts,
    likeCounts,
    commentCounts,
    loading,
    loadingMore,
    hasMore,
    unavailable,
    loadMore,
    prependPost,
    removePost,
    setUnavailable,
  } = useToyboxFeed({
    service: "this_or_that",
    table: "this_or_that_posts",
    sort,
    normalizePost,
  });

  const add = useCallback(
    async (input: AddThisOrThatPostInput): Promise<ThisOrThatPost | null> => {
      try {
        const post = await insertThisOrThatPost({
          ...input,
          activeUserId: input.activeUserId ?? userId ?? undefined,
        });
        if (!post) return null;
        prependPost(post);
        return post;
      } catch (error) {
        setUnavailable(true);
        throw error;
      }
    },
    [prependPost, setUnavailable, userId],
  );

  const remove = useCallback(
    async (postId: string) => {
      if (!userId || !supabaseEnabled) return;
      const { error } = await withSupabaseTimeout(
        "this_or_that_posts.delete",
        supabase.from("this_or_that_posts").delete().eq("id", postId),
      ).catch(() => ({ error: new Error("timeout") }));
      if (error) {
        setUnavailable(true);
        return;
      }
      removePost(postId);
    },
    [removePost, setUnavailable, userId],
  );

  return {
    posts,
    likeCounts,
    commentCounts,
    loading,
    loadingMore,
    hasMore,
    unavailable,
    loadMore,
    add,
    remove,
  };
}

export function useThisOrThatPost(
  postId: string,
  userId: string | null = null,
): UseThisOrThatPostReturn {
  const [post, setPost] = useState<ThisOrThatPost | null>(null);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [unavailable, setUnavailable] = useState(!supabaseEnabled);

  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancelled = false;

    withSupabaseTimeout(
      "this_or_that_posts.detail",
      supabase
        .from("this_or_that_posts")
        .select("*")
        .eq("id", postId)
        .eq("env", supabaseEnv)
        .maybeSingle(),
    )
      .then(({ data, error }) => {
        if (error) throw error;
        if (cancelled) return;
        setPost(data ? normalizePost(data) : null);
        setUnavailable(false);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setUnavailable(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [postId]);

  const remove = useCallback(async () => {
    if (!userId || !supabaseEnabled) return false;
    const { error } = await withSupabaseTimeout(
      "this_or_that_posts.detail.delete",
      supabase
        .from("this_or_that_posts")
        .delete()
        .eq("id", postId)
        .eq("user_id", userId)
        .eq("env", supabaseEnv),
    ).catch(() => ({ error: new Error("timeout") }));
    if (error) {
      setUnavailable(true);
      return false;
    }
    setPost(null);
    return true;
  }, [postId, userId]);

  return { post, loading, unavailable, remove };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useToyboxFeed } from "@/hooks/use-toybox-feed";
import { shouldUseLegacy, writeMayGoLegacy } from "@/lib/api-client";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import {
  isSameThisOrThatResource,
  type ThisOrThatPost,
  type ThisOrThatResourceRef,
} from "@/lib/this-or-that";
import {
  apiCreateToyboxPost,
  apiDeleteToyboxPost,
  apiToyboxPost,
  toyboxViaApi,
  toyboxWriteError,
} from "@/lib/toybox-api";
import type { ToyboxFeedSort } from "@/lib/toybox-feed";
import { currentAuthorProfileToken } from "@/lib/user-profile";

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

  const token = currentAuthorProfileToken();
  const row = {
    user_id: input.activeUserId,
    nickname: trimmedNickname,
    left_type: input.left.type,
    left_id: input.left.id,
    right_type: input.right.type,
    right_id: input.right.id,
    reason: trimmedReason,
    env: supabaseEnv,
    ...(token ? {
      avatar_id: token.avatar_id,
      avatar_kind: token.avatar_kind,
      palette_id: token.palette_id,
      palette_swapped: token.palette_swapped,
    } : {}),
  };
  if (toyboxViaApi()) {
    try {
      // docs/supabase-exit/STEP1_DESIGN.md 9.8: the same row, through the Worker.
      return normalizePost(await apiCreateToyboxPost("this_or_that", row));
    } catch (error) {
      // Only a write that certainly did nothing is sent again on the legacy path.
      if (!writeMayGoLegacy(error)) throw toyboxWriteError(error);
    }
  }
  const { data, error } = await withSupabaseTimeout(
    "this_or_that_posts.insert",
    supabase
      .from("this_or_that_posts")
      .insert(row)
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

    const load = async () => {
      if (toyboxViaApi()) {
        try {
          return await apiToyboxPost("this_or_that", postId);
        } catch (error) {
          if (!shouldUseLegacy(error) || !supabaseEnabled) throw error;
        }
      }
      const { data, error } = await withSupabaseTimeout(
        "this_or_that_posts.detail",
        supabase
          .from("this_or_that_posts")
          .select("*")
          .eq("id", postId)
          .eq("env", supabaseEnv)
          .maybeSingle(),
      );
      if (error) throw error;
      return data;
    };

    load()
      .then((data) => {
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
    let apiResult: { error: unknown } | null = null;
    if (toyboxViaApi()) {
      try {
        // Not ours or already gone counts as removed, as the legacy delete does.
        await apiDeleteToyboxPost("this_or_that", postId);
        apiResult = { error: null };
      } catch (error) {
        if (!writeMayGoLegacy(error)) apiResult = { error };
      }
    }
    const { error } = apiResult ?? await withSupabaseTimeout(
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

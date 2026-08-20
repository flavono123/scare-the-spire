"use client";

import { useCallback, useEffect, useState } from "react";
import type { PostBlock } from "@/lib/chemical-types";
import {
  countComboYouTubeReferences,
  extractComboResourceRefs,
  type ComboPost,
} from "@/lib/combo-types";
import { blocksToPlainText } from "@/lib/chemical-utils";
import { useToyboxFeed } from "@/hooks/use-toybox-feed";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import type { ToyboxFeedSort } from "@/lib/toybox-feed";

export interface SaveComboPostInput {
  blocks: PostBlock[];
  nickname: string;
  activeUserId?: string;
}

interface UseComboPostsReturn {
  posts: ComboPost[];
  likeCounts: Record<string, number>;
  commentCounts: Record<string, number>;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  unavailable: boolean;
  loadMore: () => Promise<void>;
  add: (input: SaveComboPostInput) => Promise<ComboPost | null>;
  update: (
    postId: string,
    input: SaveComboPostInput,
  ) => Promise<ComboPost | null>;
  remove: (postId: string) => Promise<void>;
}

interface UseComboPostReturn {
  post: ComboPost | null;
  loading: boolean;
  unavailable: boolean;
  update: (input: SaveComboPostInput) => Promise<ComboPost | null>;
  remove: () => Promise<boolean>;
}

function normalizePost(row: unknown): ComboPost {
  return row as ComboPost;
}

function validateSaveInput(input: SaveComboPostInput) {
  const contentText = blocksToPlainText(input.blocks).trim();
  const nickname = input.nickname.trim();
  const resources = extractComboResourceRefs(input.blocks);
  if (
    !input.activeUserId
    || !supabaseEnabled
    || contentText.length < 2
    || nickname.length < 1
    || nickname.length > 20
    || resources.length < 2
    || countComboYouTubeReferences(input.blocks) > 1
  ) {
    return null;
  }

  return { contentText, nickname, resources };
}

export async function insertComboPost(
  input: SaveComboPostInput,
): Promise<ComboPost | null> {
  const normalized = validateSaveInput(input);
  if (!normalized || !input.activeUserId) return null;

  const { data, error } = await withSupabaseTimeout(
    "combo_posts.insert",
    supabase
      .from("combo_posts")
      .insert({
        user_id: input.activeUserId,
        nickname: normalized.nickname,
        content: input.blocks,
        content_text: normalized.contentText,
        resources: normalized.resources,
        env: supabaseEnv,
      })
      .select()
      .single(),
  );
  if (error) throw error;
  if (!data) return null;
  return normalizePost(data);
}

async function persistComboPostUpdate(
  postId: string,
  input: SaveComboPostInput,
) {
  const normalized = validateSaveInput(input);
  if (!normalized || !input.activeUserId) {
    return { data: null, error: null };
  }

  return withSupabaseTimeout(
    "combo_posts.update",
    supabase
      .from("combo_posts")
      .update({
        nickname: normalized.nickname,
        content: input.blocks,
        content_text: normalized.contentText,
        resources: normalized.resources,
      })
      .eq("id", postId)
      .eq("user_id", input.activeUserId)
      .eq("env", supabaseEnv)
      .select()
      .single(),
  ).catch(() => ({ data: null, error: new Error("timeout") }));
}

export function useComboPosts(
  userId: string | null,
  sort: ToyboxFeedSort = "latest",
): UseComboPostsReturn {
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
    replacePost,
    removePost,
    setUnavailable,
  } = useToyboxFeed({
    service: "combo",
    table: "combo_posts",
    sort,
    normalizePost,
  });

  const add = useCallback(
    async ({
      blocks,
      nickname,
      activeUserId = userId ?? undefined,
    }: SaveComboPostInput): Promise<ComboPost | null> => {
      try {
        const post = await insertComboPost({ blocks, nickname, activeUserId });
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

  const update = useCallback(
    async (postId: string, input: SaveComboPostInput) => {
      const { data, error } = await persistComboPostUpdate(postId, {
        ...input,
        activeUserId: input.activeUserId ?? userId ?? undefined,
      });
      if (error) {
        setUnavailable(true);
        throw new Error(error.message);
      }
      if (!data) return null;

      const post = normalizePost(data);
      replacePost(post, data);
      return post;
    },
    [replacePost, setUnavailable, userId],
  );

  const remove = useCallback(
    async (postId: string) => {
      if (!userId || !supabaseEnabled) return;
      const { error } = await withSupabaseTimeout(
        "combo_posts.delete",
        supabase.from("combo_posts").delete().eq("id", postId),
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
    update,
    remove,
  };
}

export function useComboPost(
  postId: string,
  userId: string | null = null,
): UseComboPostReturn {
  const [post, setPost] = useState<ComboPost | null>(null);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [unavailable, setUnavailable] = useState(!supabaseEnabled);

  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancelled = false;

    withSupabaseTimeout(
      "combo_posts.detail",
      supabase
        .from("combo_posts")
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

  const update = useCallback(
    async (input: SaveComboPostInput) => {
      const { data, error } = await persistComboPostUpdate(postId, {
        ...input,
        activeUserId: input.activeUserId ?? userId ?? undefined,
      });
      if (error) {
        setUnavailable(true);
        throw new Error(error.message);
      }
      if (!data) return null;

      const updatedPost = normalizePost(data);
      setPost(updatedPost);
      return updatedPost;
    },
    [postId, userId],
  );

  const remove = useCallback(async () => {
    if (!userId || !supabaseEnabled) return false;
    const { error } = await withSupabaseTimeout(
      "combo_posts.detail.delete",
      supabase
        .from("combo_posts")
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

  return { post, loading, unavailable, update, remove };
}

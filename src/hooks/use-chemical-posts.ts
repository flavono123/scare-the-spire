"use client";

import { useCallback } from "react";
import { useToyboxFeed } from "@/hooks/use-toybox-feed";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import type { ChemicalPost, PostBlock } from "@/lib/chemical-types";
import { blocksToPlainText } from "@/lib/chemical-utils";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import {
  CHEMICAL_POST_MAX_CHARS,
  CHEMICAL_POST_MIN_CHARS,
} from "@/lib/content-limits";
import type { ToyboxFeedSort } from "@/lib/toybox-feed";

interface UseChemicalPostsReturn {
  posts: ChemicalPost[];
  likeCounts: Record<string, number>;
  commentCounts: Record<string, number>;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  unavailable: boolean;
  loadMore: () => Promise<void>;
  add: (blocks: PostBlock[], nickname: string, activeUserId?: string) => Promise<void>;
  remove: (postId: string) => Promise<void>;
}

function normalizePost(row: unknown): ChemicalPost {
  return row as ChemicalPost;
}

export function useChemicalPosts(
  userId: string | null,
  sort: ToyboxFeedSort = "latest",
): UseChemicalPostsReturn {
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
    service: "chemical_x",
    table: "chemical_posts",
    sort,
    normalizePost,
  });

  const add = useCallback(
    async (blocks: PostBlock[], nickname: string, activeUserId = userId) => {
      if (!activeUserId || !supabaseEnabled) return;
      const contentText = blocksToPlainText(blocks).trim();
      const trimmedNickname = nickname.trim();
      if (
        contentText.length < CHEMICAL_POST_MIN_CHARS
        || contentText.length > CHEMICAL_POST_MAX_CHARS
        || trimmedNickname.length < 1
        || trimmedNickname.length > 20
      ) {
        return;
      }

      const { data, error } = await withSupabaseTimeout(
        "chemical_posts.insert",
        supabase
          .from("chemical_posts")
          .insert({
            user_id: activeUserId,
            nickname: trimmedNickname,
            content: blocks,
            content_text: contentText,
            env: supabaseEnv,
          })
          .select()
          .single(),
      ).catch(() => ({ data: null, error: new Error("timeout") }));

      if (error) {
        setUnavailable(true);
        throw new Error(error.message);
      }

      if (data) {
        prependPost(normalizePost(data), data);
      }
    },
    [prependPost, setUnavailable, userId],
  );

  const remove = useCallback(
    async (postId: string) => {
      if (!userId || !supabaseEnabled) return;
      const { error } = await withSupabaseTimeout(
        "chemical_posts.delete",
        supabase.from("chemical_posts").delete().eq("id", postId),
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

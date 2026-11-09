"use client";

import { useCallback } from "react";
import { useToyboxFeed } from "@/hooks/use-toybox-feed";
import type { ChemicalPost, PostBlock } from "@/lib/chemical-types";
import { blocksToPlainText } from "@/lib/chemical-utils";
import { dataEnv } from "@/lib/data-env";
import { currentAuthorProfileToken } from "@/lib/user-profile";
import {
  CHEMICAL_POST_MAX_CHARS,
  CHEMICAL_POST_MIN_CHARS,
} from "@/lib/content-limits";
import { apiCreateToyboxPost, toyboxWriteError } from "@/lib/toybox-api";
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
}

function normalizePost(row: unknown): ChemicalPost {
  return row as ChemicalPost;
}

export async function insertChemicalPost(
  blocks: PostBlock[],
  nickname: string,
  activeUserId: string,
): Promise<ChemicalPost | null> {
  if (!activeUserId) return null;
  const contentText = blocksToPlainText(blocks).trim();
  const trimmedNickname = nickname.trim();
  if (
    contentText.length < CHEMICAL_POST_MIN_CHARS
    || contentText.length > CHEMICAL_POST_MAX_CHARS
    || trimmedNickname.length < 1
    || trimmedNickname.length > 20
  ) {
    return null;
  }

  const token = currentAuthorProfileToken();
  const row = {
    user_id: activeUserId,
    nickname: trimmedNickname,
    content: blocks,
    content_text: contentText,
    env: dataEnv,
    ...(token ? {
      avatar_id: token.avatar_id,
      avatar_kind: token.avatar_kind,
      palette_id: token.palette_id,
      palette_swapped: token.palette_swapped,
    } : {}),
  };
  try {
    // docs/supabase-exit/STEP1_DESIGN.md 9.8: the row, sent through the Worker.
    return normalizePost(await apiCreateToyboxPost("chemical_x", row));
  } catch (error) {
    throw toyboxWriteError(error);
  }
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
    setUnavailable,
  } = useToyboxFeed({
    service: "chemical_x",
    sort,
    normalizePost,
  });

  const add = useCallback(
    async (blocks: PostBlock[], nickname: string, activeUserId = userId) => {
      if (!activeUserId) return;
      try {
        const post = await insertChemicalPost(blocks, nickname, activeUserId);
        if (post) prependPost(post);
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

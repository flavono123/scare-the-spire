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
import { dataEnv } from "@/lib/data-env";
import { isCheckViolation } from "@/lib/db-errors";
import {
  apiCreateToyboxPost,
  apiDeleteToyboxPost,
  apiToyboxPost,
  apiUpdateToyboxPost,
  toyboxWriteError,
} from "@/lib/toybox-api";
import type { ToyboxFeedSort } from "@/lib/toybox-feed";
import { currentAuthorProfileToken } from "@/lib/user-profile";

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

  const token = currentAuthorProfileToken();
  const row = {
    user_id: input.activeUserId,
    nickname: normalized.nickname,
    content: input.blocks,
    content_text: normalized.contentText,
    resources: normalized.resources,
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
    return normalizePost(await apiCreateToyboxPost("combo", row));
  } catch (error) {
    throw toyboxWriteError(error);
  }
}

/** Only the detail page edits (SURFACE_MAP 13). */
async function persistComboPostUpdate(
  postId: string,
  input: SaveComboPostInput,
) {
  const normalized = validateSaveInput(input);
  if (!normalized || !input.activeUserId) {
    return { data: null, error: null };
  }

  const token = currentAuthorProfileToken();
  const patch = {
    nickname: normalized.nickname,
    content: input.blocks,
    content_text: normalized.contentText,
    resources: normalized.resources,
    ...(token ? {
      avatar_id: token.avatar_id,
      avatar_kind: token.avatar_kind,
      palette_id: token.palette_id,
      palette_swapped: token.palette_swapped,
    } : {}),
  };
  try {
    const data = await apiUpdateToyboxPost("combo", postId, patch);
    // No matched row (not ours or gone) is an error, as PostgREST .single() reported it (PGRST116).
    return data ? { data, error: null } : { data: null, error: { code: "PGRST116", message: "no row" } };
  } catch (error) {
    return { data: null, error: toyboxWriteError(error) };
  }
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
    setUnavailable,
  } = useToyboxFeed({
    service: "combo",
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
        if (!isCheckViolation(error)) setUnavailable(true);
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

export function useComboPost(
  postId: string,
  userId: string | null = null,
): UseComboPostReturn {
  const [post, setPost] = useState<ComboPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    apiToyboxPost("combo", postId)
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

  const update = useCallback(
    async (input: SaveComboPostInput) => {
      const { data, error } = await persistComboPostUpdate(postId, {
        ...input,
        activeUserId: input.activeUserId ?? userId ?? undefined,
      });
      if (error) {
        if (!isCheckViolation(error)) setUnavailable(true);
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
    if (!userId) return false;
    try {
      // Not ours or already gone still clears the post.
      await apiDeleteToyboxPost("combo", postId);
    } catch {
      setUnavailable(true);
      return false;
    }
    setPost(null);
    return true;
  }, [postId, userId]);

  return { post, loading, unavailable, update, remove };
}

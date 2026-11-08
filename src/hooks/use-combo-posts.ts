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
import { shouldUseLegacy, writeMayGoLegacy } from "@/lib/api-client";
import { isCheckViolation, supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import {
  apiCreateToyboxPost,
  apiDeleteToyboxPost,
  apiToyboxPost,
  apiUpdateToyboxPost,
  toyboxViaApi,
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

  const token = currentAuthorProfileToken();
  const row = {
    user_id: input.activeUserId,
    nickname: normalized.nickname,
    content: input.blocks,
    content_text: normalized.contentText,
    resources: normalized.resources,
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
      // docs/supabase-exit/STEP1_DESIGN.md 9.8: the same row, sent through the Worker.
      return normalizePost(await apiCreateToyboxPost("combo", row));
    } catch (error) {
      if (!writeMayGoLegacy(error)) throw toyboxWriteError(error);
    }
  }
  const { data, error } = await withSupabaseTimeout(
    "combo_posts.insert",
    supabase
      .from("combo_posts")
      .insert(row)
      .select()
      .single(),
  );
  if (error) throw error;
  if (!data) return null;
  return normalizePost(data);
}

/** `viaApi`: only the detail page edits; the list update is unreachable (SURFACE_MAP 13). */
async function persistComboPostUpdate(
  postId: string,
  input: SaveComboPostInput,
  viaApi = false,
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
  if (viaApi && toyboxViaApi()) {
    try {
      const data = await apiUpdateToyboxPost("combo", postId, patch);
      // Legacy .single() reports no matched row as an error (PGRST116).
      return data ? { data, error: null } : { data: null, error: { code: "PGRST116", message: "no row" } };
    } catch (error) {
      if (!writeMayGoLegacy(error)) return { data: null, error: toyboxWriteError(error) };
    }
  }
  return withSupabaseTimeout(
    "combo_posts.update",
    supabase
      .from("combo_posts")
      .update(patch)
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
  const [loading, setLoading] = useState(supabaseEnabled);
  const [unavailable, setUnavailable] = useState(!supabaseEnabled);

  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancelled = false;

    const load = async () => {
      if (toyboxViaApi()) {
        try {
          return { data: await apiToyboxPost("combo", postId), error: null };
        } catch (error) {
          if (!shouldUseLegacy(error)) throw error;
        }
      }
      return withSupabaseTimeout(
        "combo_posts.detail",
        supabase
          .from("combo_posts")
          .select("*")
          .eq("id", postId)
          .eq("env", supabaseEnv)
          .maybeSingle(),
      );
    };

    load()
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
      }, true);
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
    if (!userId || !supabaseEnabled) return false;
    if (toyboxViaApi()) {
      try {
        // Not ours or already gone still clears the post, as the legacy delete does.
        await apiDeleteToyboxPost("combo", postId);
        setPost(null);
        return true;
      } catch (error) {
        if (!writeMayGoLegacy(error)) {
          setUnavailable(true);
          return false;
        }
      }
    }
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

"use client";

import { useCallback, useEffect, useState } from "react";
import type { PostBlock } from "@/lib/chemical-types";
import {
  countComboYouTubeReferences,
  extractComboResourceRefs,
  type ComboPost,
} from "@/lib/combo-types";
import { blocksToPlainText } from "@/lib/chemical-utils";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

export interface SaveComboPostInput {
  blocks: PostBlock[];
  nickname: string;
  activeUserId?: string;
}

interface UseComboPostsReturn {
  posts: ComboPost[];
  loading: boolean;
  unavailable: boolean;
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

export function useComboPosts(userId: string | null): UseComboPostsReturn {
  const [posts, setPosts] = useState<ComboPost[]>([]);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [unavailable, setUnavailable] = useState(!supabaseEnabled);

  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancelled = false;

    withSupabaseTimeout(
      "combo_posts.select",
      supabase
        .from("combo_posts")
        .select("*")
        .eq("env", supabaseEnv)
        .order("created_at", { ascending: false })
        .limit(50),
    )
      .then(({ data, error }) => {
        if (error) throw error;
        if (cancelled) return;
        setPosts((data ?? []).map(normalizePost));
        setUnavailable(false);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setUnavailable(true);
        setLoading(false);
      });

    const channel = supabase
      .channel("combo_posts")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "combo_posts",
        },
        (payload) => {
          const updatedPost = normalizePost(payload.new);
          if (updatedPost.env !== supabaseEnv) return;
          setPosts((current) => current.map((post) => (
            post.id === updatedPost.id ? updatedPost : post
          )));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "combo_posts",
        },
        (payload) => {
          const newPost = normalizePost(payload.new);
          if (newPost.env !== supabaseEnv) return;
          setPosts((current) => {
            if (current.some((post) => post.id === newPost.id)) return current;
            return [newPost, ...current].slice(0, 50);
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "combo_posts",
        },
        (payload) => {
          setPosts((current) => current.filter((post) => post.id !== payload.old.id));
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setUnavailable(true);
        }
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const add = useCallback(
    async ({
      blocks,
      nickname,
      activeUserId = userId ?? undefined,
    }: SaveComboPostInput): Promise<ComboPost | null> => {
      const normalized = validateSaveInput({ blocks, nickname, activeUserId });
      if (!normalized || !activeUserId) return null;

      const { data, error } = await withSupabaseTimeout(
        "combo_posts.insert",
        supabase
          .from("combo_posts")
          .insert({
            user_id: activeUserId,
            nickname: normalized.nickname,
            content: blocks,
            content_text: normalized.contentText,
            resources: normalized.resources,
            env: supabaseEnv,
          })
          .select()
          .single(),
      ).catch(() => ({ data: null, error: new Error("timeout") }));

      if (error) {
        setUnavailable(true);
        throw new Error(error.message);
      }
      if (!data) return null;

      const post = normalizePost(data);
      setPosts((current) => {
        if (current.some((item) => item.id === post.id)) return current;
        return [post, ...current].slice(0, 50);
      });
      return post;
    },
    [userId],
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
      setPosts((current) => current.map((item) => (
        item.id === post.id ? post : item
      )));
      return post;
    },
    [userId],
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
      setPosts((current) => current.filter((post) => post.id !== postId));
    },
    [userId],
  );

  return { posts, loading, unavailable, add, update, remove };
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

  return { post, loading, unavailable, update };
}

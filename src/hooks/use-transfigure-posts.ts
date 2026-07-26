"use client";

import { useCallback, useEffect, useState } from "react";
import type { PostBlock } from "@/lib/chemical-types";
import { blocksToPlainText } from "@/lib/chemical-utils";
import type { GameLocale } from "@/lib/i18n";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import {
  isTransfigureChanged,
  normalizeTransfigureCost,
  normalizeTransfigureName,
  type TransfigurePost,
  type TransfigureResourceRef,
} from "@/lib/transfigure-types";

export interface SaveTransfigurePostInput {
  blocks: PostBlock[];
  nickname: string;
  title: string;
  resource: TransfigureResourceRef;
  sourceText: string;
  sourceBlocks: PostBlock[];
  sourceGameLocale: GameLocale;
  sourceName: string;
  sourceCost: string | null;
  transformedName: string;
  transformedCost: string;
  activeUserId?: string;
}

interface UseTransfigurePostsReturn {
  posts: TransfigurePost[];
  loading: boolean;
  unavailable: boolean;
  add: (input: SaveTransfigurePostInput) => Promise<TransfigurePost | null>;
  update: (
    postId: string,
    input: SaveTransfigurePostInput,
  ) => Promise<TransfigurePost | null>;
  remove: (postId: string) => Promise<boolean>;
}

interface UseTransfigurePostReturn {
  post: TransfigurePost | null;
  loading: boolean;
  unavailable: boolean;
  update: (
    input: SaveTransfigurePostInput,
  ) => Promise<TransfigurePost | null>;
  remove: () => Promise<boolean>;
}

function normalizePost(row: unknown): TransfigurePost {
  return row as TransfigurePost;
}

function validateSaveInput(input: SaveTransfigurePostInput) {
  const contentText = blocksToPlainText(input.blocks).trim();
  const nickname = input.nickname.trim();
  const title = input.title.trim();
  const sourceText = input.sourceText.trim();
  const transformedName = normalizeTransfigureName(
    input.transformedName,
    input.sourceName,
  );
  const transformedCost = normalizeTransfigureCost(
    input.transformedCost,
    input.sourceCost,
  );
  const validCost = transformedCost == null || /^(X|[0-9]{1,2})$/.test(transformedCost);

  if (
    !input.activeUserId
    || !supabaseEnabled
    || contentText.length < 2
    || nickname.length < 1
    || nickname.length > 20
    || title.length < 1
    || title.length > 80
    || !input.resource.id
    || !sourceText
    || !validCost
    || (transformedName?.length ?? 0) > 80
    || !isTransfigureChanged({
      blocks: input.blocks,
      sourceText,
      sourceBlocks: input.sourceBlocks,
      transformedName: input.transformedName,
      sourceName: input.sourceName,
      transformedCost: input.transformedCost,
      sourceCost: input.sourceCost,
    })
  ) {
    return null;
  }

  return {
    contentText,
    nickname,
    title,
    sourceText,
    transformedName,
    transformedCost,
  };
}

async function persistTransfigurePostUpdate(
  postId: string,
  input: SaveTransfigurePostInput,
) {
  const normalized = validateSaveInput(input);
  if (!normalized || !input.activeUserId) {
    return { data: null, error: null };
  }

  return withSupabaseTimeout(
    "transfigure_posts.update",
    supabase
      .from("transfigure_posts")
      .update({
        nickname: normalized.nickname,
        title: normalized.title,
        content: input.blocks,
        content_text: normalized.contentText,
        transformed_name: normalized.transformedName,
        transformed_cost: normalized.transformedCost,
      })
      .eq("id", postId)
      .eq("user_id", input.activeUserId)
      .eq("env", supabaseEnv)
      .select()
      .single(),
  ).catch(() => ({ data: null, error: new Error("timeout") }));
}

export function useTransfigurePosts(
  userId: string | null,
): UseTransfigurePostsReturn {
  const [posts, setPosts] = useState<TransfigurePost[]>([]);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [unavailable, setUnavailable] = useState(!supabaseEnabled);

  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancelled = false;

    withSupabaseTimeout(
      "transfigure_posts.select",
      supabase
        .from("transfigure_posts")
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
      .channel("transfigure_posts")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "transfigure_posts",
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
          table: "transfigure_posts",
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
          table: "transfigure_posts",
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
      title,
      resource,
      sourceText,
      sourceBlocks,
      sourceGameLocale,
      activeUserId = userId ?? undefined,
      sourceName,
      sourceCost,
      transformedName,
      transformedCost,
    }: SaveTransfigurePostInput): Promise<TransfigurePost | null> => {
      const normalized = validateSaveInput({
        blocks,
        nickname,
        title,
        resource,
        sourceText,
        sourceBlocks,
        sourceGameLocale,
        sourceName,
        sourceCost,
        transformedName,
        transformedCost,
        activeUserId,
      });
      if (!normalized || !activeUserId) return null;

      const { data, error } = await withSupabaseTimeout(
        "transfigure_posts.insert",
        supabase
          .from("transfigure_posts")
          .insert({
            user_id: activeUserId,
            nickname: normalized.nickname,
            title: normalized.title,
            resource_type: resource.type,
            resource_id: resource.id,
            source_text: normalized.sourceText,
            source_game_locale: sourceGameLocale,
            content: blocks,
            content_text: normalized.contentText,
            transformed_name: normalized.transformedName,
            transformed_cost: normalized.transformedCost,
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
    async (postId: string, input: SaveTransfigurePostInput) => {
      const { data, error } = await persistTransfigurePostUpdate(postId, {
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
      if (!userId || !supabaseEnabled) return false;
      const { error } = await withSupabaseTimeout(
        "transfigure_posts.delete",
        supabase
          .from("transfigure_posts")
          .delete()
          .eq("id", postId)
          .eq("user_id", userId)
          .eq("env", supabaseEnv),
      ).catch(() => ({ error: new Error("timeout") }));
      if (error) {
        setUnavailable(true);
        return false;
      }
      setPosts((current) => current.filter((post) => post.id !== postId));
      return true;
    },
    [userId],
  );

  return { posts, loading, unavailable, add, update, remove };
}

export function useTransfigurePost(
  postId: string,
  userId: string | null = null,
): UseTransfigurePostReturn {
  const [post, setPost] = useState<TransfigurePost | null>(null);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [unavailable, setUnavailable] = useState(!supabaseEnabled);

  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancelled = false;

    withSupabaseTimeout(
      "transfigure_posts.detail",
      supabase
        .from("transfigure_posts")
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
    async (input: SaveTransfigurePostInput) => {
      const { data, error } = await persistTransfigurePostUpdate(postId, {
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
      "transfigure_posts.detail.delete",
      supabase
        .from("transfigure_posts")
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

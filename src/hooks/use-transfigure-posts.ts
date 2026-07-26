"use client";

import { useCallback, useEffect, useState } from "react";
import type { PostBlock } from "@/lib/chemical-types";
import { blocksToPlainText } from "@/lib/chemical-utils";
import type { GameLocale } from "@/lib/i18n";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import {
  isTransfiguredContent,
  type TransfigurePost,
  type TransfigureResourceRef,
} from "@/lib/transfigure-types";

interface AddTransfigurePostInput {
  blocks: PostBlock[];
  nickname: string;
  title: string;
  resource: TransfigureResourceRef;
  sourceText: string;
  sourceBlocks: PostBlock[];
  sourceGameLocale: GameLocale;
  activeUserId?: string;
}

interface UseTransfigurePostsReturn {
  posts: TransfigurePost[];
  loading: boolean;
  unavailable: boolean;
  add: (input: AddTransfigurePostInput) => Promise<TransfigurePost | null>;
  remove: (postId: string) => Promise<void>;
}

interface UseTransfigurePostReturn {
  post: TransfigurePost | null;
  loading: boolean;
  unavailable: boolean;
}

function normalizePost(row: unknown): TransfigurePost {
  return row as TransfigurePost;
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
    }: AddTransfigurePostInput): Promise<TransfigurePost | null> => {
      const contentText = blocksToPlainText(blocks).trim();
      const trimmedNickname = nickname.trim();
      const trimmedTitle = title.trim();
      const trimmedSourceText = sourceText.trim();
      if (
        !activeUserId
        || !supabaseEnabled
        || contentText.length < 2
        || trimmedNickname.length < 1
        || trimmedNickname.length > 20
        || trimmedTitle.length < 1
        || trimmedTitle.length > 80
        || !resource.id
        || !trimmedSourceText
        || !isTransfiguredContent(blocks, trimmedSourceText, sourceBlocks)
      ) {
        return null;
      }

      const { data, error } = await withSupabaseTimeout(
        "transfigure_posts.insert",
        supabase
          .from("transfigure_posts")
          .insert({
            user_id: activeUserId,
            nickname: trimmedNickname,
            title: trimmedTitle,
            resource_type: resource.type,
            resource_id: resource.id,
            source_text: trimmedSourceText,
            source_game_locale: sourceGameLocale,
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

  const remove = useCallback(
    async (postId: string) => {
      if (!userId || !supabaseEnabled) return;
      const { error } = await withSupabaseTimeout(
        "transfigure_posts.delete",
        supabase.from("transfigure_posts").delete().eq("id", postId),
      ).catch(() => ({ error: new Error("timeout") }));
      if (error) {
        setUnavailable(true);
        return;
      }
      setPosts((current) => current.filter((post) => post.id !== postId));
    },
    [userId],
  );

  return { posts, loading, unavailable, add, remove };
}

export function useTransfigurePost(postId: string): UseTransfigurePostReturn {
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

  return { post, loading, unavailable };
}

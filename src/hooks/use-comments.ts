"use client";

import { useCallback, useEffect, useState } from "react";
import type { PostBlock } from "@/lib/chemical-types";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

let richCommentColumnSupported: boolean | null = null;

export interface Comment {
  id: string;
  story_id: string;
  user_id: string;
  nickname: string;
  content: string;
  content_blocks?: PostBlock[] | null;
  created_at: string;
}

interface UseCommentsReturn {
  comments: Comment[];
  loading: boolean;
  unavailable: boolean;
  add: (nickname: string, content: string, contentBlocks?: PostBlock[]) => Promise<void>;
  remove: (commentId: string) => Promise<void>;
}

export function useComments(storyId: string, userId: string | null): UseCommentsReturn {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancelled = false;

    withSupabaseTimeout(
      "comments.select",
      supabase
        .from("comments")
        .select("*")
        .eq("story_id", storyId)
        .eq("env", supabaseEnv)
        .order("created_at", { ascending: true }),
    )
      .then(({ data, error }) => {
        if (error) throw error;
        if (cancelled) return;
        setComments(data ?? []);
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
  }, [storyId]);

  const add = useCallback(
    async (nickname: string, content: string, contentBlocks?: PostBlock[]) => {
      if (!userId || !supabaseEnabled) return;

      const basePayload = {
        story_id: storyId,
        user_id: userId,
        nickname,
        content,
        env: supabaseEnv,
      };

      const tryInsert = async (includeRichBlocks: boolean) => {
        const payload = includeRichBlocks
          ? { ...basePayload, content_blocks: contentBlocks ?? null }
          : basePayload;
        return withSupabaseTimeout(
          "comments.insert",
          supabase.from("comments").insert(payload).select().single(),
        );
      };

      let result;
      try {
        result = richCommentColumnSupported === false
          ? await tryInsert(false)
          : await tryInsert(true);
      } catch {
        setUnavailable(true);
        throw new Error("Comment storage unavailable");
      }

      const shouldRetryWithoutRichColumn = !!result.error
        && richCommentColumnSupported !== false
        && result.error.message.toLowerCase().includes("content_blocks");

      if (shouldRetryWithoutRichColumn) {
        richCommentColumnSupported = false;
        try {
          result = await tryInsert(false);
        } catch {
          setUnavailable(true);
          throw new Error("Comment storage unavailable");
        }
      } else if (!result.error && richCommentColumnSupported === null) {
        richCommentColumnSupported = true;
      }

      if (result.error) {
        setUnavailable(true);
        throw new Error(result.error.message);
      }

      if (result.data) {
        const inserted = {
          ...(result.data as Comment),
          content_blocks: richCommentColumnSupported === false ? null : (contentBlocks ?? null),
        } satisfies Comment;
        setComments((prev) => [...prev, inserted]);
      }
    },
    [storyId, userId],
  );

  const remove = useCallback(
    async (commentId: string) => {
      if (!userId || !supabaseEnabled) return;
      const { error } = await withSupabaseTimeout(
        "comments.delete",
        supabase.from("comments").delete().eq("id", commentId),
      ).catch(() => ({ error: new Error("timeout") }));
      if (error) {
        setUnavailable(true);
        return;
      }
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    },
    [userId],
  );

  return { comments, loading, unavailable, add, remove };
}

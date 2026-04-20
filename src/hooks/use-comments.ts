"use client";

import { useCallback, useEffect, useState } from "react";
import type { PostBlock } from "@/lib/chemical-types";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";

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
  add: (nickname: string, content: string, contentBlocks?: PostBlock[]) => Promise<void>;
  remove: (commentId: string) => Promise<void>;
}

export function useComments(storyId: string, userId: string | null): UseCommentsReturn {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(supabaseEnabled);

  useEffect(() => {
    if (!supabaseEnabled) return;

    supabase
      .from("comments")
      .select("*")
      .eq("story_id", storyId)
      .eq("env", supabaseEnv)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setComments(data ?? []);
        setLoading(false);
      });
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
        return supabase.from("comments").insert(payload).select().single();
      };

      let result = richCommentColumnSupported === false
        ? await tryInsert(false)
        : await tryInsert(true);

      const shouldRetryWithoutRichColumn = !!result.error
        && richCommentColumnSupported !== false
        && result.error.message.toLowerCase().includes("content_blocks");

      if (shouldRetryWithoutRichColumn) {
        richCommentColumnSupported = false;
        result = await tryInsert(false);
      } else if (!result.error && richCommentColumnSupported === null) {
        richCommentColumnSupported = true;
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
      await supabase.from("comments").delete().eq("id", commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    },
    [userId],
  );

  return { comments, loading, add, remove };
}

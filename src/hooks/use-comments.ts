"use client";

import { useCallback, useEffect, useState } from "react";
import type { PostBlock } from "@/lib/chemical-types";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";

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
      const { data } = await supabase
        .from("comments")
        .insert({
          story_id: storyId,
          user_id: userId,
          nickname,
          content,
          content_blocks: contentBlocks ?? null,
          env: supabaseEnv,
        })
        .select()
        .single();
      if (data) {
        setComments((prev) => [...prev, data as Comment]);
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

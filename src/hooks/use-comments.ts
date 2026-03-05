"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";

export interface Comment {
  id: string;
  story_id: string;
  user_id: string;
  nickname: string;
  content: string;
  created_at: string;
}

interface UseCommentsReturn {
  comments: Comment[];
  loading: boolean;
  add: (nickname: string, content: string) => Promise<void>;
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

    const channel = supabase
      .channel(`comments:${storyId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "comments",
          filter: `story_id=eq.${storyId}`,
        },
        (payload) => {
          setComments((prev) => [...prev, payload.new as Comment]);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "comments",
        },
        (payload) => {
          setComments((prev) => prev.filter((c) => c.id !== payload.old.id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storyId]);

  const add = useCallback(
    async (nickname: string, content: string) => {
      if (!userId || !supabaseEnabled) return;
      const { data } = await supabase
        .from("comments")
        .insert({ story_id: storyId, user_id: userId, nickname, content, env: supabaseEnv })
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

"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import type { ChemicalPost, PostBlock } from "@/lib/chemical-types";
import { blocksToPlainText } from "@/lib/chemical-utils";

interface UseChemicalPostsReturn {
  posts: ChemicalPost[];
  loading: boolean;
  add: (blocks: PostBlock[], nickname: string) => Promise<void>;
  remove: (postId: string) => Promise<void>;
}

export function useChemicalPosts(userId: string | null): UseChemicalPostsReturn {
  const [posts, setPosts] = useState<ChemicalPost[]>([]);
  const [loading, setLoading] = useState(supabaseEnabled);

  useEffect(() => {
    if (!supabaseEnabled) return;

    supabase
      .from("chemical_posts")
      .select("*")
      .eq("env", supabaseEnv)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setPosts(data ?? []);
        setLoading(false);
      });

    const channel = supabase
      .channel("chemical_posts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chemical_posts",
        },
        (payload) => {
          const newPost = payload.new as ChemicalPost;
          if (newPost.env === supabaseEnv) {
            setPosts((prev) => {
              if (prev.some((p) => p.id === newPost.id)) return prev;
              return [newPost, ...prev];
            });
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "chemical_posts",
        },
        (payload) => {
          setPosts((prev) => prev.filter((p) => p.id !== payload.old.id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const add = useCallback(
    async (blocks: PostBlock[], nickname: string) => {
      if (!userId || !supabaseEnabled) return;
      const contentText = blocksToPlainText(blocks);

      const { data } = await supabase
        .from("chemical_posts")
        .insert({
          user_id: userId,
          nickname,
          content: blocks,
          content_text: contentText,
          env: supabaseEnv,
        })
        .select()
        .single();

      if (data) {
        setPosts((prev) => [data as ChemicalPost, ...prev]);
      }
    },
    [userId],
  );

  const remove = useCallback(
    async (postId: string) => {
      if (!userId || !supabaseEnabled) return;
      await supabase.from("chemical_posts").delete().eq("id", postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    },
    [userId],
  );

  return { posts, loading, add, remove };
}

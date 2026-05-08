"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import type { ChemicalPost, PostBlock } from "@/lib/chemical-types";
import { blocksToPlainText } from "@/lib/chemical-utils";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

interface UseChemicalPostsReturn {
  posts: ChemicalPost[];
  loading: boolean;
  unavailable: boolean;
  add: (blocks: PostBlock[], nickname: string) => Promise<void>;
  remove: (postId: string) => Promise<void>;
}

export function useChemicalPosts(userId: string | null): UseChemicalPostsReturn {
  const [posts, setPosts] = useState<ChemicalPost[]>([]);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancelled = false;

    withSupabaseTimeout(
      "chemical_posts.select",
      supabase
        .from("chemical_posts")
        .select("*")
        .eq("env", supabaseEnv)
        .order("created_at", { ascending: false })
        .limit(50),
    )
      .then(({ data, error }) => {
        if (error) throw error;
        if (cancelled) return;
        setPosts(data ?? []);
        setUnavailable(false);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setUnavailable(true);
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
    async (blocks: PostBlock[], nickname: string) => {
      if (!userId || !supabaseEnabled) return;
      const contentText = blocksToPlainText(blocks);

      const { data, error } = await withSupabaseTimeout(
        "chemical_posts.insert",
        supabase
          .from("chemical_posts")
          .insert({
            user_id: userId,
            nickname,
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

      if (data) {
        setPosts((prev) => [data as ChemicalPost, ...prev]);
      }
    },
    [userId],
  );

  const remove = useCallback(
    async (postId: string) => {
      if (!userId || !supabaseEnabled) return;
      const { error } = await withSupabaseTimeout(
        "chemical_posts.delete",
        supabase.from("chemical_posts").delete().eq("id", postId),
      ).catch(() => ({ error: new Error("timeout") }));
      if (error) {
        setUnavailable(true);
        return;
      }
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    },
    [userId],
  );

  return { posts, loading, unavailable, add, remove };
}

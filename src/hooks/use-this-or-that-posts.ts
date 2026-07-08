"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import {
  isSameThisOrThatResource,
  type ThisOrThatPost,
  type ThisOrThatResourceRef,
} from "@/lib/this-or-that";

type AddThisOrThatPostInput = {
  left: ThisOrThatResourceRef;
  right: ThisOrThatResourceRef;
  reason: string;
  nickname: string;
  activeUserId?: string;
};

interface UseThisOrThatPostsReturn {
  posts: ThisOrThatPost[];
  loading: boolean;
  unavailable: boolean;
  add: (input: AddThisOrThatPostInput) => Promise<ThisOrThatPost | null>;
  remove: (postId: string) => Promise<void>;
}

interface UseThisOrThatPostReturn {
  post: ThisOrThatPost | null;
  loading: boolean;
  unavailable: boolean;
}

function normalizePost(row: unknown): ThisOrThatPost {
  return row as ThisOrThatPost;
}

export function useThisOrThatPosts(userId: string | null): UseThisOrThatPostsReturn {
  const [posts, setPosts] = useState<ThisOrThatPost[]>([]);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [unavailable, setUnavailable] = useState(!supabaseEnabled);

  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancelled = false;

    withSupabaseTimeout(
      "this_or_that_posts.select",
      supabase
        .from("this_or_that_posts")
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
      .channel("this_or_that_posts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "this_or_that_posts",
        },
        (payload) => {
          const newPost = normalizePost(payload.new);
          if (newPost.env === supabaseEnv) {
            setPosts((prev) => {
              if (prev.some((post) => post.id === newPost.id)) return prev;
              return [newPost, ...prev].slice(0, 50);
            });
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "this_or_that_posts",
        },
        (payload) => {
          setPosts((prev) => prev.filter((post) => post.id !== payload.old.id));
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
      left,
      right,
      reason,
      nickname,
      activeUserId = userId ?? undefined,
    }: AddThisOrThatPostInput): Promise<ThisOrThatPost | null> => {
      const trimmedReason = reason.trim();
      const trimmedNickname = nickname.trim();
      if (
        !activeUserId
        || !supabaseEnabled
        || trimmedReason.length < 2
        || trimmedReason.length > 500
        || trimmedNickname.length < 1
        || trimmedNickname.length > 20
        || isSameThisOrThatResource(left, right)
      ) {
        return null;
      }

      const { data, error } = await withSupabaseTimeout(
        "this_or_that_posts.insert",
        supabase
          .from("this_or_that_posts")
          .insert({
            user_id: activeUserId,
            nickname: trimmedNickname,
            left_type: left.type,
            left_id: left.id,
            right_type: right.type,
            right_id: right.id,
            reason: trimmedReason,
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
      setPosts((prev) => {
        if (prev.some((item) => item.id === post.id)) return prev;
        return [post, ...prev].slice(0, 50);
      });
      return post;
    },
    [userId],
  );

  const remove = useCallback(
    async (postId: string) => {
      if (!userId || !supabaseEnabled) return;
      const { error } = await withSupabaseTimeout(
        "this_or_that_posts.delete",
        supabase.from("this_or_that_posts").delete().eq("id", postId),
      ).catch(() => ({ error: new Error("timeout") }));
      if (error) {
        setUnavailable(true);
        return;
      }
      setPosts((prev) => prev.filter((post) => post.id !== postId));
    },
    [userId],
  );

  return { posts, loading, unavailable, add, remove };
}

export function useThisOrThatPost(postId: string): UseThisOrThatPostReturn {
  const [post, setPost] = useState<ThisOrThatPost | null>(null);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [unavailable, setUnavailable] = useState(!supabaseEnabled);

  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancelled = false;

    withSupabaseTimeout(
      "this_or_that_posts.detail",
      supabase
        .from("this_or_that_posts")
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

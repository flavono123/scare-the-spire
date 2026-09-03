"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PAGESTORM_BODY_MAX_CHARS,
  PAGESTORM_BODY_MIN_CHARS,
  PAGESTORM_TABLE,
  PAGESTORM_TITLE_MAX_CHARS,
  PAGESTORM_TITLE_MIN_CHARS,
  isPagestormDoc,
  normalizePagestormPost,
  normalizePagestormPostCard,
  type PagestormDoc,
  type PagestormPost,
  type PagestormPostCard,
} from "@/lib/pagestorm";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

export type SavePagestormPostInput = {
  nickname: string;
  title: string;
  content: PagestormDoc;
  contentText: string;
  activeUserId: string;
};

function isValidSave(input: SavePagestormPostInput): boolean {
  const nickname = input.nickname.trim();
  const title = input.title.trim();
  const contentText = input.contentText.trim();
  return (
    Boolean(input.activeUserId)
    && supabaseEnabled
    && isPagestormDoc(input.content)
    && nickname.length >= 1
    && nickname.length <= 20
    && title.length >= PAGESTORM_TITLE_MIN_CHARS
    && title.length <= PAGESTORM_TITLE_MAX_CHARS
    && contentText.length >= PAGESTORM_BODY_MIN_CHARS
    && contentText.length <= PAGESTORM_BODY_MAX_CHARS
  );
}

export async function insertPagestormPost(
  input: SavePagestormPostInput,
): Promise<PagestormPost | null> {
  if (!isValidSave(input)) return null;

  const { data, error } = await withSupabaseTimeout(
    "pagestorm_posts.insert",
    supabase
      .from(PAGESTORM_TABLE)
      .insert({
        user_id: input.activeUserId,
        nickname: input.nickname.trim(),
        title: input.title.trim(),
        content: input.content,
        content_text: input.contentText.trim(),
        env: supabaseEnv,
      })
      .select()
      .single(),
  );
  if (error) throw error;
  if (!data) return null;
  return normalizePagestormPost(data);
}

export async function updatePagestormPost(
  postId: string,
  input: SavePagestormPostInput,
): Promise<PagestormPost | null> {
  if (!isValidSave(input)) return null;

  const { data, error } = await withSupabaseTimeout(
    "pagestorm_posts.update",
    supabase
      .from(PAGESTORM_TABLE)
      .update({
        nickname: input.nickname.trim(),
        title: input.title.trim(),
        content: input.content,
        content_text: input.contentText.trim(),
      })
      .eq("id", postId)
      .eq("user_id", input.activeUserId)
      .eq("env", supabaseEnv)
      .select()
      .single(),
  );
  if (error) throw error;
  if (!data) return null;
  return normalizePagestormPost(data);
}

export function usePagestormPosts() {
  const [posts, setPosts] = useState<PagestormPostCard[]>([]);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [unavailable, setUnavailable] = useState(!supabaseEnabled);

  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancelled = false;

    withSupabaseTimeout(
      "pagestorm_posts.list",
      supabase
        .from(PAGESTORM_TABLE)
        .select("id, user_id, nickname, title, content_text, env, created_at")
        .eq("env", supabaseEnv)
        .order("created_at", { ascending: false })
        .limit(50),
    )
      .then(({ data, error }) => {
        if (error) throw error;
        if (cancelled) return;
        setPosts((data ?? []).map((row) => normalizePagestormPostCard(row)));
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
  }, []);

  return { posts, loading, unavailable };
}

export function usePagestormPost(postId: string, userId: string | null = null) {
  const [post, setPost] = useState<PagestormPost | null>(null);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [unavailable, setUnavailable] = useState(!supabaseEnabled);

  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancelled = false;

    withSupabaseTimeout(
      "pagestorm_posts.detail",
      supabase
        .from(PAGESTORM_TABLE)
        .select("*")
        .eq("id", postId)
        .eq("env", supabaseEnv)
        .maybeSingle(),
    )
      .then(({ data, error }) => {
        if (error) throw error;
        if (cancelled) return;
        setPost(data ? normalizePagestormPost(data) : null);
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

  const update = useCallback(async (input: SavePagestormPostInput) => {
    const next = await updatePagestormPost(postId, input);
    if (next) setPost(next);
    return next;
  }, [postId]);

  const remove = useCallback(async () => {
    if (!userId || !supabaseEnabled) return false;
    const { error } = await withSupabaseTimeout(
      "pagestorm_posts.detail.delete",
      supabase
        .from(PAGESTORM_TABLE)
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

  return { post, loading, unavailable, update, remove, setUnavailable };
}

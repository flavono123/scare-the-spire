"use client";

import { useCallback } from "react";
import type { PostBlock } from "@/lib/chemical-types";
import { blocksToPlainText } from "@/lib/chemical-utils";
import {
  DEFRAGMENT_BODY_MAX_CHARS,
  DEFRAGMENT_BODY_MIN_CHARS,
  DEFRAGMENT_BODY_STORAGE_MAX_CHARS,
  DEFRAGMENT_TITLE_MAX_CHARS,
  DEFRAGMENT_TITLE_MIN_CHARS,
} from "@/lib/content-limits";
import type { DefragmentPost } from "@/lib/defragment";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

export interface SaveDefragmentPostInput {
  title: string;
  blocks: PostBlock[];
  nickname: string;
  activeUserId: string;
}

function normalizePost(row: unknown): DefragmentPost | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.created_at !== "string") {
    return null;
  }
  return {
    id: record.id,
    user_id: typeof record.user_id === "string" ? record.user_id : "",
    nickname: typeof record.nickname === "string" ? record.nickname : "",
    title: typeof record.title === "string" ? record.title : "",
    content: Array.isArray(record.content) ? record.content as PostBlock[] : [],
    content_text: typeof record.content_text === "string" ? record.content_text : "",
    env: typeof record.env === "string" ? record.env : supabaseEnv,
    created_at: record.created_at,
    like_count: typeof record.like_count === "number" ? record.like_count : 0,
    comment_count: typeof record.comment_count === "number" ? record.comment_count : 0,
  };
}

function validateSaveInput(input: SaveDefragmentPostInput): {
  title: string;
  nickname: string;
  contentText: string;
} | null {
  const title = input.title.replace(/\s+/g, " ").trim();
  const nickname = input.nickname.trim();
  const contentText = blocksToPlainText(input.blocks).trim();
  if (
    title.length < DEFRAGMENT_TITLE_MIN_CHARS
    || title.length > DEFRAGMENT_TITLE_MAX_CHARS
    || nickname.length < 1
    || nickname.length > 20
    || contentText.length < DEFRAGMENT_BODY_MIN_CHARS
    || contentText.length > DEFRAGMENT_BODY_MAX_CHARS
  ) {
    return null;
  }
  const storageText = contentText.length > DEFRAGMENT_BODY_STORAGE_MAX_CHARS
    ? contentText.slice(0, DEFRAGMENT_BODY_STORAGE_MAX_CHARS)
    : contentText;
  return { title, nickname, contentText: storageText };
}

export async function insertDefragmentPost(
  input: SaveDefragmentPostInput,
): Promise<DefragmentPost | null> {
  if (!supabaseEnabled) return null;
  const parsed = validateSaveInput(input);
  if (!parsed) return null;

  const { data, error } = await withSupabaseTimeout(
    "defragment_posts.insert",
    supabase
      .from("defragment_posts")
      .insert({
        user_id: input.activeUserId,
        nickname: parsed.nickname,
        title: parsed.title,
        content: input.blocks,
        content_text: parsed.contentText,
        env: supabaseEnv,
      })
      .select()
      .single(),
  );
  if (error) throw error;
  return normalizePost(data);
}

export async function updateDefragmentPost(
  postId: string,
  input: SaveDefragmentPostInput,
): Promise<DefragmentPost | null> {
  if (!supabaseEnabled) return null;
  const parsed = validateSaveInput(input);
  if (!parsed) return null;

  const { data, error } = await withSupabaseTimeout(
    "defragment_posts.update",
    supabase
      .from("defragment_posts")
      .update({
        nickname: parsed.nickname,
        title: parsed.title,
        content: input.blocks,
        content_text: parsed.contentText,
      })
      .eq("id", postId)
      .eq("user_id", input.activeUserId)
      .eq("env", supabaseEnv)
      .select()
      .single(),
  );
  if (error) throw error;
  return normalizePost(data);
}

export async function deleteDefragmentPost(
  postId: string,
  activeUserId: string,
): Promise<boolean> {
  if (!supabaseEnabled) return false;
  const { error } = await withSupabaseTimeout(
    "defragment_posts.delete",
    supabase
      .from("defragment_posts")
      .delete()
      .eq("id", postId)
      .eq("user_id", activeUserId)
      .eq("env", supabaseEnv),
  );
  if (error) throw error;
  return true;
}

export async function fetchDefragmentPost(
  postId: string,
): Promise<DefragmentPost | null> {
  if (!supabaseEnabled) return null;
  const { data, error } = await withSupabaseTimeout(
    "defragment_posts.detail",
    supabase
      .from("defragment_posts")
      .select("*")
      .eq("id", postId)
      .eq("env", supabaseEnv)
      .single(),
  );
  if (error) return null;
  return normalizePost(data);
}

export function useDefragmentPostMutations() {
  const add = useCallback(async (input: SaveDefragmentPostInput) => {
    return insertDefragmentPost(input);
  }, []);
  const update = useCallback(async (
    postId: string,
    input: SaveDefragmentPostInput,
  ) => {
    return updateDefragmentPost(postId, input);
  }, []);
  const remove = useCallback(async (postId: string, activeUserId: string) => {
    return deleteDefragmentPost(postId, activeUserId);
  }, []);
  return { add, update, remove };
}

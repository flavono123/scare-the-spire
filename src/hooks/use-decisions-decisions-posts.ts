"use client";

import { useCallback, useEffect, useState } from "react";
import { useToyboxFeed } from "@/hooks/use-toybox-feed";
import {
  DECISIONS_DECISIONS_FEED_SERVICE,
  DECISIONS_DECISIONS_GAME_VERSION,
  DECISIONS_DECISIONS_NOTE_MAX_CHARS,
  DECISIONS_DECISIONS_TABLE,
  DECISIONS_DECISIONS_TITLE_MAX_CHARS,
  DECISIONS_DECISIONS_TITLE_MIN_CHARS,
  normalizeDecisionsDecisionsPost,
  type DecisionsDecisionsPost,
  type DecisionsDecisionsResourceRef,
  type TierPlacement,
  type TierRow,
} from "@/lib/decisions-decisions";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import type { ToyboxFeedSort } from "@/lib/toybox-feed";

export type SaveDecisionsDecisionsPostInput = {
  nickname: string;
  title: string;
  note: string;
  presetKey: string;
  rows: TierRow[];
  placements: TierPlacement[];
  extraIds: DecisionsDecisionsResourceRef[];
  activeUserId: string;
};

function isValidSave(input: SaveDecisionsDecisionsPostInput): boolean {
  const nickname = input.nickname.trim();
  const title = input.title.trim();
  const note = input.note.trim();
  return (
    Boolean(input.activeUserId)
    && supabaseEnabled
    && nickname.length >= 1
    && nickname.length <= 20
    && title.length >= DECISIONS_DECISIONS_TITLE_MIN_CHARS
    && title.length <= DECISIONS_DECISIONS_TITLE_MAX_CHARS
    && note.length <= DECISIONS_DECISIONS_NOTE_MAX_CHARS
  );
}

export async function insertDecisionsDecisionsPost(
  input: SaveDecisionsDecisionsPostInput,
): Promise<DecisionsDecisionsPost | null> {
  if (!isValidSave(input)) return null;

  const { data, error } = await withSupabaseTimeout(
    "decisions_decisions_posts.insert",
    supabase
      .from(DECISIONS_DECISIONS_TABLE)
      .insert({
        user_id: input.activeUserId,
        nickname: input.nickname.trim(),
        title: input.title.trim(),
        note: input.note.trim(),
        preset_key: input.presetKey,
        game_version: DECISIONS_DECISIONS_GAME_VERSION,
        rows: input.rows,
        placements: input.placements,
        extra_ids: input.extraIds,
        env: supabaseEnv,
      })
      .select()
      .single(),
  );
  if (error) throw error;
  if (!data) return null;
  return normalizeDecisionsDecisionsPost(data);
}

export async function updateDecisionsDecisionsPost(
  postId: string,
  input: SaveDecisionsDecisionsPostInput,
): Promise<DecisionsDecisionsPost | null> {
  if (!isValidSave(input)) return null;

  const { data, error } = await withSupabaseTimeout(
    "decisions_decisions_posts.update",
    supabase
      .from(DECISIONS_DECISIONS_TABLE)
      .update({
        nickname: input.nickname.trim(),
        title: input.title.trim(),
        note: input.note.trim(),
        preset_key: input.presetKey,
        game_version: DECISIONS_DECISIONS_GAME_VERSION,
        rows: input.rows,
        placements: input.placements,
        extra_ids: input.extraIds,
      })
      .eq("id", postId)
      .eq("user_id", input.activeUserId)
      .eq("env", supabaseEnv)
      .select()
      .single(),
  );
  if (error) throw error;
  if (!data) return null;
  return normalizeDecisionsDecisionsPost(data);
}

export function useDecisionsDecisionsPosts(
  userId: string | null,
  sort: ToyboxFeedSort = "latest",
) {
  const feed = useToyboxFeed({
    service: DECISIONS_DECISIONS_FEED_SERVICE,
    table: DECISIONS_DECISIONS_TABLE,
    sort,
    normalizePost: normalizeDecisionsDecisionsPost,
  });

  const add = useCallback(async (input: SaveDecisionsDecisionsPostInput) => {
    try {
      const post = await insertDecisionsDecisionsPost(input);
      if (post) feed.prependPost(post);
      return post;
    } catch (error) {
      feed.setUnavailable(true);
      throw error;
    }
  }, [feed]);

  const remove = useCallback(async (postId: string) => {
    if (!userId || !supabaseEnabled) return;
    const { error } = await withSupabaseTimeout(
      "decisions_decisions_posts.delete",
      supabase.from(DECISIONS_DECISIONS_TABLE).delete().eq("id", postId),
    ).catch(() => ({ error: new Error("timeout") }));
    if (error) {
      feed.setUnavailable(true);
      return;
    }
    feed.removePost(postId);
  }, [feed, userId]);

  return { ...feed, add, remove };
}

export function useDecisionsDecisionsPost(
  postId: string,
  userId: string | null = null,
) {
  const [post, setPost] = useState<DecisionsDecisionsPost | null>(null);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [unavailable, setUnavailable] = useState(!supabaseEnabled);

  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancelled = false;

    withSupabaseTimeout(
      "decisions_decisions_posts.detail",
      supabase
        .from(DECISIONS_DECISIONS_TABLE)
        .select("*")
        .eq("id", postId)
        .eq("env", supabaseEnv)
        .maybeSingle(),
    )
      .then(({ data, error }) => {
        if (error) throw error;
        if (cancelled) return;
        setPost(data ? normalizeDecisionsDecisionsPost(data) : null);
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

  const update = useCallback(async (input: SaveDecisionsDecisionsPostInput) => {
    const next = await updateDecisionsDecisionsPost(postId, input);
    if (next) setPost(next);
    return next;
  }, [postId]);

  const remove = useCallback(async () => {
    if (!userId || !supabaseEnabled) return false;
    const { error } = await withSupabaseTimeout(
      "decisions_decisions_posts.detail.delete",
      supabase
        .from(DECISIONS_DECISIONS_TABLE)
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

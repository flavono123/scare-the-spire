"use client";

import { useCallback, useEffect, useState } from "react";
import { useToyboxFeed } from "@/hooks/use-toybox-feed";
import { shouldUseLegacy, writeMayGoLegacy } from "@/lib/api-client";
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
import {
  apiCreateToyboxPost,
  apiDeleteToyboxPost,
  apiToyboxPost,
  apiUpdateToyboxPost,
  toyboxViaApi,
  toyboxWriteError,
} from "@/lib/toybox-api";
import type { ToyboxFeedSort } from "@/lib/toybox-feed";
import { currentAuthorProfileToken } from "@/lib/user-profile";

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

  const authorToken = currentAuthorProfileToken();
  const row = {
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
    avatar_id: authorToken.avatar_id,
    avatar_kind: authorToken.avatar_kind,
    palette_id: authorToken.palette_id,
    palette_swapped: authorToken.palette_swapped,
  };
  if (toyboxViaApi()) {
    try {
      // docs/supabase-exit/STEP1_DESIGN.md 9.8: the same row, sent through the Worker.
      return normalizeDecisionsDecisionsPost(await apiCreateToyboxPost("decisions_decisions", row));
    } catch (error) {
      if (!writeMayGoLegacy(error)) throw toyboxWriteError(error);
    }
  }
  const { data, error } = await withSupabaseTimeout(
    "decisions_decisions_posts.insert",
    supabase
      .from(DECISIONS_DECISIONS_TABLE)
      .insert(row)
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

  const authorToken = currentAuthorProfileToken();
  const patch = {
    nickname: input.nickname.trim(),
    title: input.title.trim(),
    note: input.note.trim(),
    preset_key: input.presetKey,
    game_version: DECISIONS_DECISIONS_GAME_VERSION,
    rows: input.rows,
    placements: input.placements,
    extra_ids: input.extraIds,
    avatar_id: authorToken.avatar_id,
    avatar_kind: authorToken.avatar_kind,
    palette_id: authorToken.palette_id,
    palette_swapped: authorToken.palette_swapped,
  };
  if (toyboxViaApi()) {
    try {
      const data = await apiUpdateToyboxPost("decisions_decisions", postId, patch);
      // Legacy .single() throws when no row matched (PGRST116).
      if (!data) throw new Error("no row");
      return normalizeDecisionsDecisionsPost(data);
    } catch (error) {
      if (!writeMayGoLegacy(error)) throw toyboxWriteError(error);
    }
  }
  const { data, error } = await withSupabaseTimeout(
    "decisions_decisions_posts.update",
    supabase
      .from(DECISIONS_DECISIONS_TABLE)
      .update(patch)
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

    const load = async () => {
      if (toyboxViaApi()) {
        try {
          return { data: await apiToyboxPost("decisions_decisions", postId), error: null };
        } catch (error) {
          if (!shouldUseLegacy(error)) throw error;
        }
      }
      return withSupabaseTimeout(
        "decisions_decisions_posts.detail",
        supabase
          .from(DECISIONS_DECISIONS_TABLE)
          .select("*")
          .eq("id", postId)
          .eq("env", supabaseEnv)
          .maybeSingle(),
      );
    };

    load()
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
    if (toyboxViaApi()) {
      try {
        // Not ours or already gone still clears the post, as the legacy delete does.
        await apiDeleteToyboxPost("decisions_decisions", postId);
        setPost(null);
        return true;
      } catch (error) {
        if (!writeMayGoLegacy(error)) {
          setUnavailable(true);
          return false;
        }
      }
    }
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

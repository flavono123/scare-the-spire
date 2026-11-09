"use client";

import { useCallback, useEffect, useState } from "react";
import { useToyboxFeed } from "@/hooks/use-toybox-feed";
import { dataEnv } from "@/lib/data-env";
import {
  DECISIONS_DECISIONS_FEED_SERVICE,
  DECISIONS_DECISIONS_GAME_VERSION,
  DECISIONS_DECISIONS_NOTE_MAX_CHARS,
  DECISIONS_DECISIONS_TITLE_MAX_CHARS,
  DECISIONS_DECISIONS_TITLE_MIN_CHARS,
  normalizeDecisionsDecisionsPost,
  type DecisionsDecisionsPost,
  type DecisionsDecisionsResourceRef,
  type TierPlacement,
  type TierRow,
} from "@/lib/decisions-decisions";
import {
  apiCreateToyboxPost,
  apiDeleteToyboxPost,
  apiToyboxPost,
  apiUpdateToyboxPost,
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
    env: dataEnv,
    avatar_id: authorToken.avatar_id,
    avatar_kind: authorToken.avatar_kind,
    palette_id: authorToken.palette_id,
    palette_swapped: authorToken.palette_swapped,
  };
  try {
    // docs/supabase-exit/STEP1_DESIGN.md 9.8: the row, sent through the Worker.
    return normalizeDecisionsDecisionsPost(await apiCreateToyboxPost("decisions_decisions", row));
  } catch (error) {
    throw toyboxWriteError(error);
  }
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
  try {
    const data = await apiUpdateToyboxPost("decisions_decisions", postId, patch);
    // No matched row (not ours or gone) throws, as PostgREST .single() did (PGRST116).
    if (!data) throw new Error("no row");
    return normalizeDecisionsDecisionsPost(data);
  } catch (error) {
    throw toyboxWriteError(error);
  }
}

export function useDecisionsDecisionsPosts(sort: ToyboxFeedSort = "latest") {
  const feed = useToyboxFeed({
    service: DECISIONS_DECISIONS_FEED_SERVICE,
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

  return { ...feed, add };
}

export function useDecisionsDecisionsPost(
  postId: string,
  userId: string | null = null,
) {
  const [post, setPost] = useState<DecisionsDecisionsPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    apiToyboxPost("decisions_decisions", postId)
      .then((data) => {
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
    if (!userId) return false;
    try {
      // Not ours or already gone still clears the post.
      await apiDeleteToyboxPost("decisions_decisions", postId);
    } catch {
      setUnavailable(true);
      return false;
    }
    setPost(null);
    return true;
  }, [postId, userId]);

  return { post, loading, unavailable, update, remove, setUnavailable };
}

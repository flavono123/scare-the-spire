"use client";

import { useCallback, useEffect, useState } from "react";
import { useToyboxFeed } from "@/hooks/use-toybox-feed";
import {
  FAVORITE_TOURNAMENT_FEED_SERVICE,
  FAVORITE_TOURNAMENT_GAME_VERSION,
  FAVORITE_TOURNAMENT_MIN_POOL,
  FAVORITE_TOURNAMENT_NOTE_MAX_CHARS,
  FAVORITE_TOURNAMENT_STATS_TABLE,
  FAVORITE_TOURNAMENT_TABLE,
  FAVORITE_TOURNAMENT_TITLE_MAX_CHARS,
  FAVORITE_TOURNAMENT_TITLE_MIN_CHARS,
  normalizeCandidateStats,
  normalizeFavoriteTournamentPost,
  type FavoriteTournamentCandidateStats,
  type FavoriteTournamentMatchRecord,
  type FavoriteTournamentPost,
  type FavoriteTournamentResourceRef,
} from "@/lib/favorite-tournament";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import type { ToyboxFeedSort } from "@/lib/toybox-feed";

export type SaveFavoriteTournamentInput = {
  nickname: string;
  title: string;
  note: string;
  presetKey: string;
  pool: FavoriteTournamentResourceRef[];
  activeUserId: string;
};

function isValidSave(input: SaveFavoriteTournamentInput): boolean {
  const nickname = input.nickname.trim();
  const title = input.title.trim();
  const note = input.note.trim();
  return (
    Boolean(input.activeUserId)
    && supabaseEnabled
    && nickname.length >= 1
    && nickname.length <= 20
    && title.length >= FAVORITE_TOURNAMENT_TITLE_MIN_CHARS
    && title.length <= FAVORITE_TOURNAMENT_TITLE_MAX_CHARS
    && note.length <= FAVORITE_TOURNAMENT_NOTE_MAX_CHARS
    && input.pool.length >= FAVORITE_TOURNAMENT_MIN_POOL
  );
}

export async function insertFavoriteTournamentPost(
  input: SaveFavoriteTournamentInput,
): Promise<FavoriteTournamentPost | null> {
  if (!isValidSave(input)) return null;

  const { data, error } = await withSupabaseTimeout(
    "favorite_tournament_posts.insert",
    supabase
      .from(FAVORITE_TOURNAMENT_TABLE)
      .insert({
        user_id: input.activeUserId,
        nickname: input.nickname.trim(),
        title: input.title.trim(),
        note: input.note.trim(),
        preset_key: input.presetKey,
        game_version: FAVORITE_TOURNAMENT_GAME_VERSION,
        pool: input.pool,
        env: supabaseEnv,
      })
      .select()
      .single(),
  );
  if (error) throw error;
  if (!data) return null;
  return normalizeFavoriteTournamentPost(data);
}

export function useFavoriteTournamentPosts(
  userId: string | null,
  sort: ToyboxFeedSort = "latest",
) {
  const feed = useToyboxFeed({
    service: FAVORITE_TOURNAMENT_FEED_SERVICE,
    table: FAVORITE_TOURNAMENT_TABLE,
    sort,
    normalizePost: normalizeFavoriteTournamentPost,
  });

  const add = useCallback(async (input: SaveFavoriteTournamentInput) => {
    try {
      const post = await insertFavoriteTournamentPost(input);
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
      "favorite_tournament_posts.delete",
      supabase.from(FAVORITE_TOURNAMENT_TABLE).delete().eq("id", postId),
    ).catch(() => ({ error: new Error("timeout") }));
    if (error) {
      feed.setUnavailable(true);
      return;
    }
    feed.removePost(postId);
  }, [feed, userId]);

  return { ...feed, add, remove };
}

export function useFavoriteTournamentPost(
  postId: string,
  userId: string | null = null,
) {
  const [post, setPost] = useState<FavoriteTournamentPost | null>(null);
  const [stats, setStats] = useState<FavoriteTournamentCandidateStats[]>([]);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [unavailable, setUnavailable] = useState(!supabaseEnabled);

  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancelled = false;

    Promise.all([
      withSupabaseTimeout(
        "favorite_tournament_posts.detail",
        supabase
          .from(FAVORITE_TOURNAMENT_TABLE)
          .select("*")
          .eq("id", postId)
          .eq("env", supabaseEnv)
          .maybeSingle(),
      ),
      withSupabaseTimeout(
        "favorite_tournament_candidate_stats.detail",
        supabase
          .from(FAVORITE_TOURNAMENT_STATS_TABLE)
          .select("*")
          .eq("tournament_id", postId)
          .eq("env", supabaseEnv),
      ),
    ])
      .then(([postResult, statsResult]) => {
        if (postResult.error) throw postResult.error;
        if (statsResult.error) throw statsResult.error;
        if (cancelled) return;
        setPost(postResult.data ? normalizeFavoriteTournamentPost(postResult.data) : null);
        setStats(
          (statsResult.data ?? [])
            .map(normalizeCandidateStats)
            .filter((row): row is FavoriteTournamentCandidateStats => row != null),
        );
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

  const remove = useCallback(async () => {
    if (!userId || !supabaseEnabled) return false;
    const { error } = await withSupabaseTimeout(
      "favorite_tournament_posts.detail.delete",
      supabase
        .from(FAVORITE_TOURNAMENT_TABLE)
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

  const completePlay = useCallback(async (input: {
    startingSize: number;
    champion: FavoriteTournamentResourceRef;
    matches: FavoriteTournamentMatchRecord[];
  }) => {
    if (!supabaseEnabled) return false;
    const { error } = await withSupabaseTimeout(
      "complete_favorite_tournament_play",
      supabase.rpc("complete_favorite_tournament_play", {
        p_tournament_id: postId,
        p_env: supabaseEnv,
        p_starting_size: input.startingSize,
        p_champion_type: input.champion.type,
        p_champion_id: input.champion.id,
        p_matches: input.matches.map((match) => ({
          left_type: match.left.type,
          left_id: match.left.id,
          right_type: match.right.type,
          right_id: match.right.id,
          winner: match.winner,
        })),
      }),
    );
    if (error) {
      setUnavailable(true);
      return false;
    }
    setPost((current) => current
      ? { ...current, play_count: (current.play_count ?? 0) + 1 }
      : current);
    const { data } = await withSupabaseTimeout(
      "favorite_tournament_candidate_stats.reload",
      supabase
        .from(FAVORITE_TOURNAMENT_STATS_TABLE)
        .select("*")
        .eq("tournament_id", postId)
        .eq("env", supabaseEnv),
    ).catch(() => ({ data: null }));
    if (data) {
      setStats(
        data
          .map(normalizeCandidateStats)
          .filter((row): row is FavoriteTournamentCandidateStats => row != null),
      );
    }
    return true;
  }, [postId]);

  return { post, stats, loading, unavailable, remove, completePlay, setUnavailable };
}

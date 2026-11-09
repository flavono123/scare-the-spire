"use client";

import { useCallback, useEffect, useState } from "react";
import { useToyboxFeed } from "@/hooks/use-toybox-feed";
import { dataEnv } from "@/lib/data-env";
import {
  FAVORITE_TOURNAMENT_CUSTOM_PRESET_KEY,
  FAVORITE_TOURNAMENT_FEED_SERVICE,
  FAVORITE_TOURNAMENT_GAME_VERSION,
  FAVORITE_TOURNAMENT_MIN_POOL,
  FAVORITE_TOURNAMENT_NOTE_MAX_CHARS,
  FAVORITE_TOURNAMENT_NOTE_MIN_CHARS,
  FAVORITE_TOURNAMENT_TITLE_MAX_CHARS,
  FAVORITE_TOURNAMENT_TITLE_MIN_CHARS,
  isFavoriteTournamentBuiltinKey,
  normalizeCandidateStats,
  normalizeFavoriteTournamentPost,
  type FavoriteTournamentCandidateStats,
  type FavoriteTournamentMatchRecord,
  type FavoriteTournamentPost,
  type FavoriteTournamentResourceRef,
} from "@/lib/favorite-tournament";
import {
  apiCreateToyboxPost,
  apiDeleteToyboxPost,
  apiTournamentPlay,
  apiTournamentPresets,
  apiTournamentStats,
  apiToyboxPost,
  toyboxWriteError,
} from "@/lib/toybox-api";
import { currentAuthorProfileToken } from "@/lib/user-profile";
import type { ToyboxFeedSort } from "@/lib/toybox-feed";

export type SaveFavoriteTournamentInput = {
  nickname: string;
  title: string;
  note: string;
  pool: FavoriteTournamentResourceRef[];
  activeUserId: string;
};

function isValidSave(input: SaveFavoriteTournamentInput): boolean {
  const nickname = input.nickname.trim();
  const title = input.title.trim();
  const note = input.note.trim();
  return (
    Boolean(input.activeUserId)
    && nickname.length >= 1
    && nickname.length <= 20
    && title.length >= FAVORITE_TOURNAMENT_TITLE_MIN_CHARS
    && title.length <= FAVORITE_TOURNAMENT_TITLE_MAX_CHARS
    && note.length >= FAVORITE_TOURNAMENT_NOTE_MIN_CHARS
    && note.length <= FAVORITE_TOURNAMENT_NOTE_MAX_CHARS
    && input.pool.length >= FAVORITE_TOURNAMENT_MIN_POOL
  );
}

export async function insertFavoriteTournamentPost(
  input: SaveFavoriteTournamentInput,
): Promise<FavoriteTournamentPost | null> {
  if (!isValidSave(input)) return null;

  const authorToken = currentAuthorProfileToken();
  const row = {
    user_id: input.activeUserId,
    nickname: input.nickname.trim(),
    title: input.title.trim(),
    note: input.note.trim(),
    preset_key: FAVORITE_TOURNAMENT_CUSTOM_PRESET_KEY,
    game_version: FAVORITE_TOURNAMENT_GAME_VERSION,
    pool: input.pool,
    env: dataEnv,
    avatar_id: authorToken.avatar_id,
    avatar_kind: authorToken.avatar_kind,
    palette_id: authorToken.palette_id,
    palette_swapped: authorToken.palette_swapped,
  };
  try {
    // docs/supabase-exit/STEP1_DESIGN.md 9.8: the same row, through the Worker.
    return normalizeFavoriteTournamentPost(await apiCreateToyboxPost("favorite_tournament", row));
  } catch (error) {
    throw toyboxWriteError(error);
  }
}

export function useFavoriteTournamentPosts(sort: ToyboxFeedSort = "latest") {
  const feed = useToyboxFeed({
    service: FAVORITE_TOURNAMENT_FEED_SERVICE,
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

  return { ...feed, add };
}

export function useFavoriteTournamentBuiltins() {
  const [posts, setPosts] = useState<FavoriteTournamentPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiTournamentPresets()
      .then((rows) => {
        if (cancelled) return;
        setPosts(
          rows
            .map(normalizeFavoriteTournamentPost)
            .filter((post) => isFavoriteTournamentBuiltinKey(post.preset_key)),
        );
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setPosts([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { posts, loading };
}

export function useFavoriteTournamentPost(
  postId: string,
  userId: string | null = null,
) {
  const [post, setPost] = useState<FavoriteTournamentPost | null>(null);
  const [stats, setStats] = useState<FavoriteTournamentCandidateStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      apiToyboxPost("favorite_tournament", postId),
      apiTournamentStats(postId),
    ])
      .then(([postRow, statsRows]) => {
        if (cancelled) return;
        setPost(postRow ? normalizeFavoriteTournamentPost(postRow) : null);
        setStats(
          statsRows
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
    if (!userId) return false;
    try {
      // Not ours or already gone counts as removed, as the legacy delete does.
      await apiDeleteToyboxPost("favorite_tournament", postId);
    } catch {
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
    const matches = input.matches.map((match) => ({
      left_type: match.left.type,
      left_id: match.left.id,
      right_type: match.right.type,
      right_id: match.right.id,
      winner: match.winner,
    }));
    try {
      await apiTournamentPlay({
        tournamentId: postId,
        startingSize: input.startingSize,
        championType: input.champion.type,
        championId: input.champion.id,
        matches,
      });
    } catch {
      setUnavailable(true);
      return false;
    }
    setPost((current) => current
      ? { ...current, play_count: (current.play_count ?? 0) + 1 }
      : current);
    const data = await apiTournamentStats(postId).catch(() => null);
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

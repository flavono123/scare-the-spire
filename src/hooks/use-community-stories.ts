"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import type { Story, StoryGame } from "@/lib/types";

const COMMUNITY_STORY_ID_PREFIX = "community:";
const COMMUNITY_STORY_LIMIT = 100;

interface CommunityStoryRow {
  id: string;
  user_id: string;
  nickname: string;
  sentence: string;
  game: StoryGame;
  created_at: string;
  env: string;
}

interface UseCommunityStoriesReturn {
  stories: Story[];
  loading: boolean;
  unavailable: boolean;
  add: (sentence: string, nickname: string, activeUserId?: string) => Promise<void>;
}

function communityStoryId(id: string): string {
  return `${COMMUNITY_STORY_ID_PREFIX}${id}`;
}

function rowToStory(row: CommunityStoryRow): Story {
  return {
    id: communityStoryId(row.id),
    game: row.game,
    publishedAt: row.created_at,
    sentence: row.sentence,
    authorName: row.nickname,
    community: true,
  };
}

function uniqueRows(rows: CommunityStoryRow[]): CommunityStoryRow[] {
  const seen = new Set<string>();
  const unique: CommunityStoryRow[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    unique.push(row);
  }
  return unique;
}

export function useCommunityStories(userId: string | null): UseCommunityStoriesReturn {
  const [rows, setRows] = useState<CommunityStoryRow[]>([]);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancelled = false;

    withSupabaseTimeout(
      "community_stories.select",
      supabase
        .from("community_stories")
        .select("id,user_id,nickname,sentence,game,created_at,env")
        .eq("env", supabaseEnv)
        .order("created_at", { ascending: false })
        .limit(COMMUNITY_STORY_LIMIT),
    )
      .then(({ data, error }) => {
        if (error) throw error;
        if (cancelled) return;
        setRows((data ?? []) as CommunityStoryRow[]);
        setUnavailable(false);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setUnavailable(true);
        setLoading(false);
      });

    const channel = supabase
      .channel("community_stories")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "community_stories",
        },
        (payload) => {
          const nextRow = payload.new as CommunityStoryRow;
          if (nextRow.env !== supabaseEnv) return;
          setRows((prev) => uniqueRows([nextRow, ...prev]).slice(0, COMMUNITY_STORY_LIMIT));
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
    async (sentence: string, nickname: string, activeUserId = userId) => {
      const trimmedSentence = sentence.trim();
      const trimmedNickname = nickname.trim();
      if (!activeUserId || !supabaseEnabled || !trimmedSentence || !trimmedNickname) return;

      const { data, error } = await withSupabaseTimeout(
        "community_stories.insert",
        supabase
          .from("community_stories")
          .insert({
            user_id: activeUserId,
            nickname: trimmedNickname,
            sentence: trimmedSentence,
            game: "sts2",
            env: supabaseEnv,
          })
          .select("id,user_id,nickname,sentence,game,created_at,env")
          .single(),
      ).catch(() => ({ data: null, error: new Error("timeout") }));

      if (error) {
        setUnavailable(true);
        throw new Error(error.message);
      }

      if (data) {
        setRows((prev) => uniqueRows([data as CommunityStoryRow, ...prev]).slice(0, COMMUNITY_STORY_LIMIT));
      }
    },
    [userId],
  );

  return {
    stories: rows.map(rowToStory),
    loading,
    unavailable,
    add,
  };
}

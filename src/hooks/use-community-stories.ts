"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import type { LinkedEntity, STS2PatchLine, Story, StoryEntityType, StoryGame } from "@/lib/types";

const COMMUNITY_STORY_ID_PREFIX = "community:";
const COMMUNITY_STORY_LIMIT = 100;

interface CommunityStoryRow {
  id: string;
  user_id: string | null;
  static_story_id: string | null;
  nickname: string;
  sentence: string;
  game: StoryGame;
  entity_type: string | null;
  entity_id: string | null;
  change_id: string | null;
  patch_line_id: string | null;
  source: string | null;
  tags: unknown;
  linked_entities: unknown;
  created_at: string;
  env: string;
}

interface UseCommunityStoriesReturn {
  stories: Story[];
  loading: boolean;
  unavailable: boolean;
  add: (sentence: string, nickname: string, patchLine: STS2PatchLine, activeUserId?: string) => Promise<void>;
}

function communityStoryId(id: string): string {
  return `${COMMUNITY_STORY_ID_PREFIX}${id}`;
}

function parseTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const tags = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return tags.length > 0 ? tags : undefined;
}

function parseLinkedEntities(value: unknown): LinkedEntity[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const linked = value.flatMap((item): LinkedEntity[] => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.entityType !== "string" || typeof candidate.entityId !== "string") return [];
    return [{
      game: typeof candidate.game === "string" ? candidate.game as StoryGame : undefined,
      entityType: candidate.entityType as StoryEntityType,
      entityId: candidate.entityId,
      changeId: typeof candidate.changeId === "string" ? candidate.changeId : undefined,
      label: typeof candidate.label === "string" ? candidate.label : undefined,
    }];
  });
  return linked.length > 0 ? linked : undefined;
}

function rowToStory(row: CommunityStoryRow): Story {
  return {
    id: row.static_story_id ?? communityStoryId(row.id),
    game: row.game,
    publishedAt: row.created_at,
    sentence: row.sentence,
    authorName: row.nickname,
    community: !row.static_story_id,
    entityType: row.entity_type ? row.entity_type as StoryEntityType : undefined,
    entityId: row.entity_id ?? undefined,
    changeId: row.change_id ?? undefined,
    patchLineId: row.patch_line_id ?? undefined,
    source: row.source ?? undefined,
    tags: parseTags(row.tags),
    linkedEntities: parseLinkedEntities(row.linked_entities),
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
        .select("id,user_id,static_story_id,nickname,sentence,game,entity_type,entity_id,change_id,patch_line_id,source,tags,linked_entities,created_at,env")
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
    async (sentence: string, nickname: string, patchLine: STS2PatchLine, activeUserId = userId) => {
      const trimmedSentence = sentence.trim();
      const trimmedNickname = nickname.trim();
      if (!activeUserId || !supabaseEnabled || !trimmedSentence || !trimmedNickname || !patchLine.id) return;

      const primaryRef = patchLine.entityRefs[0];
      const linkedEntities = patchLine.entityRefs.slice(1).map((ref) => ({
        entityType: ref.type,
        entityId: ref.id,
        label: ref.label,
      }));

      const { data, error } = await withSupabaseTimeout(
        "community_stories.insert",
        supabase
          .from("community_stories")
          .insert({
            user_id: activeUserId,
            nickname: trimmedNickname,
            sentence: trimmedSentence,
            game: "sts2",
            entity_type: primaryRef?.type ?? null,
            entity_id: primaryRef?.id ?? null,
            patch_line_id: patchLine.id,
            source: patchLine.patch,
            tags: [],
            linked_entities: linkedEntities,
            env: supabaseEnv,
          })
          .select("id,user_id,static_story_id,nickname,sentence,game,entity_type,entity_id,change_id,patch_line_id,source,tags,linked_entities,created_at,env")
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

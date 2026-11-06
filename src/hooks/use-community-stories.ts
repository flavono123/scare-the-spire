"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiFetch, requireApiVersion, shouldUseLegacy, writeMayGoLegacy } from "@/lib/api-client";
import { apiFetchAsUser } from "@/lib/api-session";
import { isStoryLimit, isStorySource, STORY_COLUMNS } from "@/lib/stories-api-rules";
import { surfacePath } from "@/lib/runtime-flags";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import { resolveCanonicalPatchLineId } from "@/lib/resolve-story-patch-line";
import type { LinkedEntity, STS2PatchLine, Story, StoryEntityType, StoryGame } from "@/lib/types";

const COMMUNITY_STORY_ID_PREFIX = "community:";
import {
  currentAuthorProfileToken,
  type AuthorProfileTokenPayload,
} from "@/lib/user-profile";

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
  avatar_id?: string | null;
  avatar_kind?: string | null;
  palette_id?: string | null;
  palette_swapped?: boolean | null;
}

interface UseCommunityStoriesReturn {
  stories: Story[];
  loading: boolean;
  unavailable: boolean;
  add: (
    sentence: string,
    nickname: string,
    patchLine: STS2PatchLine,
    activeUserId?: string,
    authorToken?: AuthorProfileTokenPayload | null,
  ) => Promise<void>;
  remove: (storyId: string, activeUserId?: string) => Promise<void>;
}

interface UseCommunityStoriesOptions {
  source?: string;
  limit?: number;
}

function communityStoryId(id: string): string {
  return `${COMMUNITY_STORY_ID_PREFIX}${id}`;
}

function communityRowIdFromStoryId(storyId: string): string | null {
  return storyId.startsWith(COMMUNITY_STORY_ID_PREFIX)
    ? storyId.slice(COMMUNITY_STORY_ID_PREFIX.length)
    : null;
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
    authorUserId: row.user_id ?? undefined,
    community: !row.static_story_id,
    entityType: row.entity_type ? row.entity_type as StoryEntityType : undefined,
    entityId: row.entity_id ?? undefined,
    changeId: row.change_id ?? undefined,
    patchLineId: row.patch_line_id ?? undefined,
    source: row.source ?? undefined,
    tags: parseTags(row.tags),
    linkedEntities: parseLinkedEntities(row.linked_entities),
    avatarId: row.avatar_id ?? undefined,
    avatarKind: row.avatar_kind ?? undefined,
    paletteId: row.palette_id ?? undefined,
    paletteSwapped: row.palette_swapped ?? undefined,
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

export function useCommunityStories(
  userId: string | null,
  options: UseCommunityStoriesOptions = {},
): UseCommunityStoriesReturn {
  const [rows, setRows] = useState<CommunityStoryRow[]>([]);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [unavailable, setUnavailable] = useState(false);
  const source = options.source;
  const limit = options.limit ?? COMMUNITY_STORY_LIMIT;

  useEffect(() => {
    // docs/supabase-exit/STEP1_DESIGN.md 9.7. The api path opens no Realtime channel:
    // the table is not in the publication, so it never delivered an event (section 14).
    const viaApi = surfacePath("stories") === "api"
      && isStoryLimit(String(limit))
      && (!source || isStorySource(source));
    if (!supabaseEnabled && !viaApi) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const showRows = (next: CommunityStoryRow[]) => {
      if (cancelled) return;
      setRows(next);
      setUnavailable(false);
      setLoading(false);
    };
    const fail = () => {
      if (cancelled) return;
      setUnavailable(true);
      setLoading(false);
    };

    const loadLegacy = () => {
      let query = supabase
        .from("community_stories")
        .select(STORY_COLUMNS)
        .eq("env", supabaseEnv)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (source) query = query.eq("source", source);

      withSupabaseTimeout("community_stories.select", query)
        .then(({ data, error }) => {
          if (error) throw error;
          showRows((data ?? []) as CommunityStoryRow[]);
        })
        .catch(fail);

      channel = supabase
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
            if (source && nextRow.source !== source) return;
            setRows((prev) => uniqueRows([nextRow, ...prev]).slice(0, limit));
          },
        )
        .subscribe();
    };

    if (viaApi) {
      const query = new URLSearchParams({ limit: String(limit), ...(source ? { source } : {}) });
      apiFetch<CommunityStoryRow[]>("stories", `/api/read/stories?${query}`, { timeoutMs: 20_000 })
        .then((data) => {
          if (!Array.isArray(data)) throw new Error("bad stories answer");
          showRows(data);
        })
        .catch((error) => {
          if (cancelled) return;
          if (shouldUseLegacy(error) && supabaseEnabled) loadLegacy();
          else fail();
        });
    } else {
      loadLegacy();
    }
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [limit, source]);

  const add = useCallback(
    async (
      sentence: string,
      nickname: string,
      patchLine: STS2PatchLine,
      activeUserId = userId,
      authorToken?: AuthorProfileTokenPayload | null,
    ) => {
      const trimmedSentence = sentence.trim();
      const trimmedNickname = nickname.trim();
      if (!activeUserId || !supabaseEnabled || !trimmedSentence || !trimmedNickname || !patchLine.id) return;

      const primaryRef = patchLine.entityRefs[0];
      const linkedEntities = patchLine.entityRefs.slice(1).map((ref) => ({
        entityType: ref.type,
        entityId: ref.id,
        label: ref.label,
      }));

      const token = authorToken !== undefined ? authorToken : currentAuthorProfileToken();
      const patchLineId = resolveCanonicalPatchLineId(patchLine.id) ?? patchLine.id;
      if (surfacePath("stories") === "api") {
        try {
          const body = await apiFetchAsUser<{ v?: number; row?: CommunityStoryRow }>("stories", "/api/write/stories", {
            method: "POST",
            body: {
              nickname: trimmedNickname,
              sentence: trimmedSentence,
              entityType: primaryRef?.type ?? null,
              entityId: primaryRef?.id ?? null,
              patchLineId,
              source: patchLine.patch,
              linkedEntities,
              ...(token ? {
                author: {
                  avatarId: token.avatar_id,
                  avatarKind: token.avatar_kind,
                  paletteId: token.palette_id,
                  paletteSwapped: token.palette_swapped,
                },
              } : {}),
            },
          });
          requireApiVersion("stories", body);
          const inserted = body.row;
          if (inserted) setRows((prev) => uniqueRows([inserted, ...prev]).slice(0, COMMUNITY_STORY_LIMIT));
          return;
        } catch (error) {
          // Only a write that certainly did nothing is sent again on the legacy path.
          if (!writeMayGoLegacy(error)) throw new Error(error instanceof ApiError ? error.code : "Story storage unavailable");
        }
      }
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
            patch_line_id: patchLineId,
            source: patchLine.patch,
            tags: [],
            linked_entities: linkedEntities,
            env: supabaseEnv,
            ...(token ? {
              avatar_id: token.avatar_id,
              avatar_kind: token.avatar_kind,
              palette_id: token.palette_id,
              palette_swapped: token.palette_swapped,
            } : {}),
          })
          .select(STORY_COLUMNS)
          .single(),
      ).catch(() => ({ data: null, error: new Error("timeout") }));

      if (error) throw new Error(error.message);

      if (data) {
        setRows((prev) => uniqueRows([data as CommunityStoryRow, ...prev]).slice(0, COMMUNITY_STORY_LIMIT));
      }
    },
    [userId],
  );

  const remove = useCallback(
    async (storyId: string, activeUserId = userId) => {
      const rowId = communityRowIdFromStoryId(storyId);
      if (!activeUserId || !supabaseEnabled || !rowId) return;

      if (surfacePath("stories") === "api") {
        let resendOnLegacy = false;
        try {
          // Not ours or already gone leaves the list too, as the legacy delete does.
          await apiFetchAsUser("stories", `/api/write/stories?id=${encodeURIComponent(rowId)}`, { method: "DELETE" });
        } catch (error) {
          if (!writeMayGoLegacy(error)) throw new Error(error instanceof ApiError ? error.code : "Story storage unavailable");
          resendOnLegacy = true;
        }
        if (!resendOnLegacy) {
          setRows((prev) => prev.filter((row) => row.id !== rowId));
          return;
        }
      }

      const { error } = await withSupabaseTimeout(
        "community_stories.delete",
        supabase
          .from("community_stories")
          .delete()
          .eq("id", rowId)
          .eq("user_id", activeUserId)
          .eq("env", supabaseEnv),
      ).catch(() => ({ error: new Error("timeout") }));

      if (error) throw new Error(error.message);

      setRows((prev) => prev.filter((row) => row.id !== rowId));
    },
    [userId],
  );

  return {
    stories: rows.map(rowToStory),
    loading,
    unavailable,
    add,
    remove,
  };
}

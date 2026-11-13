"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiFetch, requireApiVersion } from "@/lib/api-client";
import { apiFetchAsUser } from "@/lib/api-session";
import { isStorySource, type STORY_LIMITS } from "@/lib/stories-api-rules";
import { resolveCanonicalPatchLineId } from "@/lib/resolve-story-patch-line";
import type { LinkedEntity, STS2PatchLine, Story, StoryEntityType, StoryGame } from "@/lib/types";

const COMMUNITY_STORY_ID_PREFIX = "community:";
import {
  currentAuthorProfileToken,
  type AuthorProfileTokenPayload,
} from "@/lib/user-profile";

/** A page size the Worker takes (/api/read/stories). */
type StoryLimit = (typeof STORY_LIMITS)[number];

const COMMUNITY_STORY_LIMIT: StoryLimit = 100;

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
  limit?: StoryLimit;
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
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const source = options.source;
  const limit = options.limit ?? COMMUNITY_STORY_LIMIT;

  useEffect(() => {
    // docs/supabase-exit/STEP1_DESIGN.md 9.7. No Realtime channel: the table is not in the
    // publication, so it never delivered an event (section 14, STEP6_PLAN.md 1.1).
    let cancelled = false;
    // A source the Worker refuses has no story: the Worker never writes one with it.
    const read: Promise<CommunityStoryRow[]> = source && !isStorySource(source)
      ? Promise.resolve([])
      : apiFetch<CommunityStoryRow[]>(
        "stories",
        `/api/read/stories?${new URLSearchParams({ limit: String(limit), ...(source ? { source } : {}) })}`,
        { timeoutMs: 20_000 },
      );
    read
      .then((data) => {
        if (!Array.isArray(data)) throw new Error("bad stories answer");
        if (cancelled) return;
        setRows(data);
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
      if (!activeUserId || !trimmedSentence || !trimmedNickname || !patchLine.id) return;

      const primaryRef = patchLine.entityRefs[0];
      const linkedEntities = patchLine.entityRefs.slice(1).map((ref) => ({
        entityType: ref.type,
        entityId: ref.id,
        label: ref.label,
      }));

      const token = authorToken !== undefined ? authorToken : currentAuthorProfileToken();
      const patchLineId = resolveCanonicalPatchLineId(patchLine.id) ?? patchLine.id;
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
        requireApiVersion("stories", body, true);
        const inserted = body.row;
        if (inserted) setRows((prev) => uniqueRows([inserted, ...prev]).slice(0, COMMUNITY_STORY_LIMIT));
      } catch (error) {
        throw new Error(error instanceof ApiError ? error.code : "Story storage unavailable");
      }
    },
    [userId],
  );

  const remove = useCallback(
    async (storyId: string, activeUserId = userId) => {
      const rowId = communityRowIdFromStoryId(storyId);
      if (!activeUserId || !rowId) return;

      try {
        // Not ours or already gone leaves the list too.
        await apiFetchAsUser("stories", `/api/write/stories?id=${encodeURIComponent(rowId)}`, { method: "DELETE" });
      } catch (error) {
        throw new Error(error instanceof ApiError ? error.code : "Story storage unavailable");
      }
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

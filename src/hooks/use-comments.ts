"use client";

import { useCallback, useEffect, useState } from "react";
import type { PostBlock } from "@/lib/chemical-types";
import { ApiError } from "@/lib/api-client";
import {
  engagementApiFor,
  forgetEngagement,
  loadEngagement,
  shouldUseLegacy,
  writeMayGoLegacy,
} from "@/lib/api-engagement";
import { apiFetchAsUser } from "@/lib/api-session";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import {
  COMMENT_MAX_CHARS,
  COMMENT_MIN_CHARS,
  COMMENT_STORAGE_MAX_CHARS,
} from "@/lib/content-limits";
import { blocksToPlainText } from "@/lib/chemical-utils";
import {
  currentAuthorProfileToken,
  type AuthorProfileTokenPayload,
  type ProfileAvatarKind,
} from "@/lib/user-profile";

export interface Comment {
  id: string;
  story_id: string;
  user_id: string;
  nickname: string;
  content: string;
  content_blocks?: PostBlock[] | null;
  created_at: string;
  avatar_id?: string | null;
  avatar_kind?: ProfileAvatarKind | string | null;
  palette_id?: string | null;
  palette_swapped?: boolean | null;
  /** Present when the thread came from the Worker (/api/read/engagement). */
  like_count?: number;
}

interface UseCommentsReturn {
  comments: Comment[];
  loading: boolean;
  unavailable: boolean;
  add: (
    nickname: string,
    content: string,
    contentBlocks?: PostBlock[],
    activeUserId?: string,
    authorToken?: AuthorProfileTokenPayload | null,
  ) => Promise<void>;
  remove: (commentId: string) => Promise<void>;
}

export function useComments(storyId: string, userId: string | null): UseCommentsReturn {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadLegacy = () => {
      withSupabaseTimeout(
        "comments.select",
        supabase
          .from("comments")
          .select("*")
          .eq("story_id", storyId)
          .eq("env", supabaseEnv)
          .order("created_at", { ascending: true }),
      )
        .then(({ data, error }) => {
          if (error) throw error;
          if (cancelled) return;
          setComments(data ?? []);
          setUnavailable(false);
          setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setUnavailable(true);
          setLoading(false);
        });
    };

    if (engagementApiFor("threads", storyId)) {
      loadEngagement("threads", storyId)
        .then((rows) => {
          if (cancelled) return;
          setComments(rows as Comment[]);
          setUnavailable(false);
          setLoading(false);
        })
        .catch((error) => {
          if (cancelled) return;
          if (shouldUseLegacy(error) && supabaseEnabled) {
            loadLegacy();
            return;
          }
          setUnavailable(true);
          setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }

    if (!supabaseEnabled) return;
    loadLegacy();
    return () => {
      cancelled = true;
    };
  }, [storyId]);

  const add = useCallback(
    async (
      nickname: string,
      content: string,
      contentBlocks?: PostBlock[],
      activeUserId = userId,
      authorToken?: AuthorProfileTokenPayload | null,
    ) => {
      if (!activeUserId || !supabaseEnabled) return;

      const plainText = (contentBlocks ? blocksToPlainText(contentBlocks) : content).trim();
      if (
        plainText.length < COMMENT_MIN_CHARS
        || plainText.length > COMMENT_MAX_CHARS
        || content.length < COMMENT_MIN_CHARS
        || content.length > COMMENT_STORAGE_MAX_CHARS
      ) {
        return;
      }

      const token = authorToken !== undefined ? authorToken : currentAuthorProfileToken();
      if (engagementApiFor("threads", storyId)) {
        try {
          const { comment } = await apiFetchAsUser<{ comment: Comment }>("comments", "/api/write/comments", {
            method: "POST",
            body: {
              threadKey: storyId,
              nickname,
              content,
              contentBlocks: contentBlocks ?? null,
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
          forgetEngagement("threads", storyId);
          setComments((prev) => [...prev, { ...comment, content_blocks: contentBlocks ?? null }]);
          return;
        } catch (error) {
          // Only a write that certainly did nothing may be sent again on the legacy path.
          if (!writeMayGoLegacy(error)) {
            setUnavailable(true);
            throw new Error(error instanceof ApiError ? error.code : "Comment storage unavailable");
          }
        }
      }

      const basePayload = {
        story_id: storyId,
        user_id: activeUserId,
        nickname,
        content,
        content_blocks: contentBlocks ?? null,
        env: supabaseEnv,
        ...(token ? {
          avatar_id: token.avatar_id,
          avatar_kind: token.avatar_kind,
          palette_id: token.palette_id,
          palette_swapped: token.palette_swapped,
        } : {}),
      };

      const result = await withSupabaseTimeout(
        "comments.insert",
        supabase.from("comments").insert(basePayload).select().single(),
      ).catch(() => {
        setUnavailable(true);
        return { data: null, error: new Error("Comment storage unavailable") };
      });

      if (result.error) {
        setUnavailable(true);
        throw new Error(result.error.message);
      }

      if (result.data) {
        const inserted = {
          ...(result.data as Comment),
          content_blocks: contentBlocks ?? null,
        } satisfies Comment;
        setComments((prev) => [...prev, inserted]);
      }
    },
    [storyId, userId],
  );

  const remove = useCallback(
    async (commentId: string) => {
      if (!userId || !supabaseEnabled) return;
      if (engagementApiFor("threads", storyId)) {
        let resendOnLegacy = false;
        try {
          await apiFetchAsUser("comments", `/api/write/comments?id=${encodeURIComponent(commentId)}`, { method: "DELETE" });
        } catch (error) {
          // not_found: already gone or never ours. It leaves the list either way, as on the legacy path.
          if (writeMayGoLegacy(error)) {
            resendOnLegacy = true;
          } else if (!(error instanceof ApiError && error.code === "not_found")) {
            setUnavailable(true);
            return;
          }
        }
        if (!resendOnLegacy) {
          forgetEngagement("threads", storyId);
          setComments((prev) => prev.filter((c) => c.id !== commentId));
          return;
        }
      }
      const { error } = await withSupabaseTimeout(
        "comments.delete",
        supabase.from("comments").delete().eq("id", commentId),
      ).catch(() => ({ error: new Error("timeout") }));
      if (error) {
        setUnavailable(true);
        return;
      }
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    },
    [storyId, userId],
  );

  return { comments, loading, unavailable, add, remove };
}

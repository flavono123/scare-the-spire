"use client";

import { useCallback, useEffect, useState } from "react";
import type { PostBlock } from "@/lib/chemical-types";
import { ApiError } from "@/lib/api-client";
import { engagementApiFor, forgetEngagement, loadEngagement } from "@/lib/api-engagement";
import { apiFetchAsUser } from "@/lib/api-session";
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
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // A key the Worker refuses is an empty thread (engagementApiFor).
    const rows: Promise<Comment[]> = engagementApiFor("threads", storyId)
      ? loadEngagement("threads", storyId) as Promise<Comment[]>
      : Promise.resolve([]);
    rows
      .then((next) => {
        if (cancelled) return;
        setComments(next);
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
  }, [storyId]);

  const add = useCallback(
    async (
      nickname: string,
      content: string,
      contentBlocks?: PostBlock[],
      activeUserId = userId,
      authorToken?: AuthorProfileTokenPayload | null,
    ) => {
      if (!activeUserId) return;

      const plainText = (contentBlocks ? blocksToPlainText(contentBlocks) : content).trim();
      if (
        plainText.length < COMMENT_MIN_CHARS
        || plainText.length > COMMENT_MAX_CHARS
        || content.length < COMMENT_MIN_CHARS
        || content.length > COMMENT_STORAGE_MAX_CHARS
      ) {
        return;
      }

      // A key the Worker refuses takes no comment, as the closed direct insert refused it.
      if (!engagementApiFor("threads", storyId)) {
        setUnavailable(true);
        throw new Error("Comment storage unavailable");
      }
      const token = authorToken !== undefined ? authorToken : currentAuthorProfileToken();
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
      } catch (error) {
        setUnavailable(true);
        throw new Error(error instanceof ApiError ? error.code : "Comment storage unavailable");
      }
    },
    [storyId, userId],
  );

  const remove = useCallback(
    async (commentId: string) => {
      // A refused key has no comment to remove.
      if (!userId || !engagementApiFor("threads", storyId)) return;
      try {
        await apiFetchAsUser("comments", `/api/write/comments?id=${encodeURIComponent(commentId)}`, { method: "DELETE" });
      } catch (error) {
        // not_found: already gone or never ours. It leaves the list either way.
        if (!(error instanceof ApiError && error.code === "not_found")) {
          setUnavailable(true);
          return;
        }
      }
      forgetEngagement("threads", storyId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    },
    [storyId, userId],
  );

  return { comments, loading, unavailable, add, remove };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { dataEnv } from "@/lib/data-env";
import {
  PAGESTORM_BODY_MAX_CHARS,
  PAGESTORM_BODY_MIN_CHARS,
  PAGESTORM_TITLE_MAX_CHARS,
  PAGESTORM_TITLE_MIN_CHARS,
  isPagestormDoc,
  normalizePagestormPost,
  normalizePagestormPostCard,
  type PagestormDoc,
  type PagestormPost,
  type PagestormPostCard,
} from "@/lib/pagestorm";
import {
  apiCreatePagestormDraft,
  apiCreateToyboxPost,
  apiDeletePagestormDraft,
  apiDeleteToyboxPost,
  apiMyPagestormDraft,
  apiMyPagestormDrafts,
  apiPagestormPosts,
  apiToyboxPost,
  apiUpdatePagestormDraft,
  apiUpdateToyboxPost,
  toyboxWriteError,
} from "@/lib/toybox-api";
import { currentAuthorProfileToken } from "@/lib/user-profile";

export type SavePagestormPostInput = {
  nickname: string;
  title: string;
  content: PagestormDoc;
  contentText: string;
  activeUserId: string;
};

function isValidSave(input: SavePagestormPostInput): boolean {
  const nickname = input.nickname.trim();
  const title = input.title.trim();
  const contentText = input.contentText.trim();
  return (
    Boolean(input.activeUserId)
    && isPagestormDoc(input.content)
    && nickname.length >= 1
    && nickname.length <= 20
    && title.length >= PAGESTORM_TITLE_MIN_CHARS
    && title.length <= PAGESTORM_TITLE_MAX_CHARS
    && contentText.length >= PAGESTORM_BODY_MIN_CHARS
    && contentText.length <= PAGESTORM_BODY_MAX_CHARS
  );
}

export async function insertPagestormPost(
  input: SavePagestormPostInput,
): Promise<PagestormPost | null> {
  if (!isValidSave(input)) return null;

  const authorToken = currentAuthorProfileToken();
  try {
    // docs/supabase-exit/STEP1_DESIGN.md 9.8: the same row, through the Worker.
    return normalizePagestormPost(await apiCreateToyboxPost("pagestorm", {
      user_id: input.activeUserId,
      nickname: input.nickname.trim(),
      title: input.title.trim(),
      content: input.content,
      content_text: input.contentText.trim(),
      env: dataEnv,
      avatar_id: authorToken.avatar_id,
      avatar_kind: authorToken.avatar_kind,
      palette_id: authorToken.palette_id,
      palette_swapped: authorToken.palette_swapped,
    }));
  } catch (error) {
    throw toyboxWriteError(error);
  }
}

export async function updatePagestormPost(
  postId: string,
  input: SavePagestormPostInput,
): Promise<PagestormPost | null> {
  if (!isValidSave(input)) return null;

  const authorToken = currentAuthorProfileToken();
  try {
    const row = await apiUpdateToyboxPost("pagestorm", postId, {
      nickname: input.nickname.trim(),
      title: input.title.trim(),
      content: input.content,
      content_text: input.contentText.trim(),
      avatar_id: authorToken.avatar_id,
      avatar_kind: authorToken.avatar_kind,
      palette_id: authorToken.palette_id,
      palette_swapped: authorToken.palette_swapped,
    });
    // No row matched (not ours or gone): a failure, as the legacy `.single()` was.
    if (!row) throw new Error("pagestorm post not updated");
    return normalizePagestormPost(row);
  } catch (error) {
    throw toyboxWriteError(error);
  }
}

function draftRow(input: SavePagestormPostInput) {
  const authorToken = currentAuthorProfileToken();
  return {
    user_id: input.activeUserId,
    nickname: input.nickname.trim(),
    title: input.title.trim(),
    content: input.content,
    content_text: input.contentText.trim(),
    env: dataEnv,
    updated_at: new Date().toISOString(),
    avatar_id: authorToken.avatar_id,
    avatar_kind: authorToken.avatar_kind,
    palette_id: authorToken.palette_id,
    palette_swapped: authorToken.palette_swapped,
  };
}

export async function insertPagestormDraft(
  input: SavePagestormPostInput,
): Promise<PagestormPost | null> {
  if (!isValidSave(input)) return null;
  try {
    return normalizePagestormPost(await apiCreatePagestormDraft(draftRow(input)));
  } catch (error) {
    throw toyboxWriteError(error);
  }
}

export async function updatePagestormDraft(
  draftId: string,
  input: SavePagestormPostInput,
): Promise<PagestormPost | null> {
  if (!isValidSave(input)) return null;
  try {
    const row = await apiUpdatePagestormDraft(draftId, draftRow(input));
    if (!row) throw new Error("pagestorm draft not updated");
    return normalizePagestormPost(row);
  } catch (error) {
    throw toyboxWriteError(error);
  }
}

export async function deletePagestormDraft(draftId: string, userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    // True whether or not a row matched, like the legacy delete.
    await apiDeletePagestormDraft(draftId);
    return true;
  } catch (error) {
    throw toyboxWriteError(error);
  }
}

export function usePagestormDraft(draftId: string | null) {
  const [draft, setDraft] = useState<PagestormPost | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  useEffect(() => {
    if (!draftId) return;
    let cancelled = false;
    const show = (data: unknown) => {
      if (cancelled) return;
      setDraft(data ? normalizePagestormPost(data) : null);
      setLoadedId(draftId);
    };
    const fail = () => {
      if (cancelled) return;
      setDraft(null);
      setLoadedId(draftId);
    };
    apiMyPagestormDraft(draftId).then(show).catch(fail);
    return () => {
      cancelled = true;
    };
  }, [draftId]);

  return {
    draft: draftId && loadedId === draftId ? draft : null,
    loading: Boolean(draftId) && loadedId !== draftId,
  };
}

export function usePagestormDrafts(userId: string | null) {
  const [drafts, setDrafts] = useState<{ userId: string; posts: PagestormPostCard[] } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const show = (rows: unknown[]) => {
      if (cancelled) return;
      setDrafts({
        userId,
        posts: rows.map((row) => normalizePagestormPostCard(row)),
      });
    };
    const fail = () => {
      if (!cancelled) setDrafts({ userId, posts: [] });
    };
    apiMyPagestormDrafts().then(show).catch(fail);
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return drafts?.userId === userId ? drafts.posts : [];
}

export function usePagestormPosts() {
  const [posts, setPosts] = useState<PagestormPostCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const show = (rows: unknown[]) => {
      if (cancelled) return;
      setPosts(rows.map((row) => normalizePagestormPostCard(row)));
      setUnavailable(false);
      setLoading(false);
    };
    const fail = () => {
      if (cancelled) return;
      setUnavailable(true);
      setLoading(false);
    };
    apiPagestormPosts().then(show).catch(fail);

    return () => {
      cancelled = true;
    };
  }, []);

  return { posts, loading, unavailable };
}

export function usePagestormPost(postId: string, userId: string | null = null) {
  const [post, setPost] = useState<PagestormPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const show = (data: unknown) => {
      if (cancelled) return;
      setPost(data ? normalizePagestormPost(data) : null);
      setUnavailable(false);
      setLoading(false);
    };
    const fail = () => {
      if (cancelled) return;
      setUnavailable(true);
      setLoading(false);
    };
    apiToyboxPost("pagestorm", postId).then(show).catch(fail);

    return () => {
      cancelled = true;
    };
  }, [postId]);

  const update = useCallback(async (input: SavePagestormPostInput) => {
    const next = await updatePagestormPost(postId, input);
    if (next) setPost(next);
    return next;
  }, [postId]);

  const remove = useCallback(async () => {
    if (!userId) return false;
    try {
      // True whether or not a row matched, like the legacy delete.
      await apiDeleteToyboxPost("pagestorm", postId);
    } catch {
      setUnavailable(true);
      return false;
    }
    setPost(null);
    return true;
  }, [postId, userId]);

  return { post, loading, unavailable, update, remove, setUnavailable };
}

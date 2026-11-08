"use client";

import { useCallback, useEffect, useState } from "react";
import { shouldUseLegacy, writeMayGoLegacy } from "@/lib/api-client";
import {
  PAGESTORM_BODY_MAX_CHARS,
  PAGESTORM_BODY_MIN_CHARS,
  PAGESTORM_DRAFT_TABLE,
  PAGESTORM_TABLE,
  PAGESTORM_TITLE_MAX_CHARS,
  PAGESTORM_TITLE_MIN_CHARS,
  isPagestormDoc,
  normalizePagestormPost,
  normalizePagestormPostCard,
  type PagestormDoc,
  type PagestormPost,
  type PagestormPostCard,
} from "@/lib/pagestorm";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
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
  toyboxViaApi,
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
    && supabaseEnabled
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
  if (toyboxViaApi()) {
    try {
      // docs/supabase-exit/STEP1_DESIGN.md 9.8: the same row, passed through to PostgREST.
      return normalizePagestormPost(await apiCreateToyboxPost("pagestorm", {
        user_id: input.activeUserId,
        nickname: input.nickname.trim(),
        title: input.title.trim(),
        content: input.content,
        content_text: input.contentText.trim(),
        env: supabaseEnv,
        avatar_id: authorToken.avatar_id,
        avatar_kind: authorToken.avatar_kind,
        palette_id: authorToken.palette_id,
        palette_swapped: authorToken.palette_swapped,
      }));
    } catch (error) {
      // Only a write that certainly did nothing is sent again on the legacy path.
      if (!writeMayGoLegacy(error)) throw toyboxWriteError(error);
    }
  }
  const { data, error } = await withSupabaseTimeout(
    "pagestorm_posts.insert",
    supabase
      .from(PAGESTORM_TABLE)
      .insert({
        user_id: input.activeUserId,
        nickname: input.nickname.trim(),
        title: input.title.trim(),
        content: input.content,
        content_text: input.contentText.trim(),
        env: supabaseEnv,
        avatar_id: authorToken.avatar_id,
        avatar_kind: authorToken.avatar_kind,
        palette_id: authorToken.palette_id,
        palette_swapped: authorToken.palette_swapped,
      })
      .select()
      .single(),
  );
  if (error) throw error;
  if (!data) return null;
  return normalizePagestormPost(data);
}

export async function updatePagestormPost(
  postId: string,
  input: SavePagestormPostInput,
): Promise<PagestormPost | null> {
  if (!isValidSave(input)) return null;

  const authorToken = currentAuthorProfileToken();
  if (toyboxViaApi()) {
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
      // `.single()` fails when no row matched.
      if (!row) throw new Error("pagestorm post not updated");
      return normalizePagestormPost(row);
    } catch (error) {
      if (!writeMayGoLegacy(error)) throw toyboxWriteError(error);
    }
  }
  const { data, error } = await withSupabaseTimeout(
    "pagestorm_posts.update",
    supabase
      .from(PAGESTORM_TABLE)
      .update({
        nickname: input.nickname.trim(),
        title: input.title.trim(),
        content: input.content,
        content_text: input.contentText.trim(),
        avatar_id: authorToken.avatar_id,
        avatar_kind: authorToken.avatar_kind,
        palette_id: authorToken.palette_id,
        palette_swapped: authorToken.palette_swapped,
      })
      .eq("id", postId)
      .eq("user_id", input.activeUserId)
      .eq("env", supabaseEnv)
      .select()
      .single(),
  );
  if (error) throw error;
  if (!data) return null;
  return normalizePagestormPost(data);
}

function draftRow(input: SavePagestormPostInput) {
  const authorToken = currentAuthorProfileToken();
  return {
    user_id: input.activeUserId,
    nickname: input.nickname.trim(),
    title: input.title.trim(),
    content: input.content,
    content_text: input.contentText.trim(),
    env: supabaseEnv,
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
  if (toyboxViaApi()) {
    try {
      return normalizePagestormPost(await apiCreatePagestormDraft(draftRow(input)));
    } catch (error) {
      if (!writeMayGoLegacy(error)) throw toyboxWriteError(error);
    }
  }
  const { data, error } = await withSupabaseTimeout(
    "pagestorm_drafts.insert",
    supabase
      .from(PAGESTORM_DRAFT_TABLE)
      .insert(draftRow(input))
      .select()
      .single(),
  );
  if (error) throw error;
  if (!data) return null;
  return normalizePagestormPost(data);
}

export async function updatePagestormDraft(
  draftId: string,
  input: SavePagestormPostInput,
): Promise<PagestormPost | null> {
  if (!isValidSave(input)) return null;
  if (toyboxViaApi()) {
    try {
      const row = await apiUpdatePagestormDraft(draftId, draftRow(input));
      if (!row) throw new Error("pagestorm draft not updated");
      return normalizePagestormPost(row);
    } catch (error) {
      if (!writeMayGoLegacy(error)) throw toyboxWriteError(error);
    }
  }
  const { data, error } = await withSupabaseTimeout(
    "pagestorm_drafts.update",
    supabase
      .from(PAGESTORM_DRAFT_TABLE)
      .update(draftRow(input))
      .eq("id", draftId)
      .eq("user_id", input.activeUserId)
      .eq("env", supabaseEnv)
      .select()
      .single(),
  );
  if (error) throw error;
  if (!data) return null;
  return normalizePagestormPost(data);
}

export async function deletePagestormDraft(draftId: string, userId: string): Promise<boolean> {
  if (!supabaseEnabled || !userId) return false;
  if (toyboxViaApi()) {
    try {
      // True whether or not a row matched, like the legacy delete.
      await apiDeletePagestormDraft(draftId);
      return true;
    } catch (error) {
      if (!writeMayGoLegacy(error)) throw toyboxWriteError(error);
    }
  }
  const { error } = await withSupabaseTimeout(
    "pagestorm_drafts.delete",
    supabase
      .from(PAGESTORM_DRAFT_TABLE)
      .delete()
      .eq("id", draftId)
      .eq("user_id", userId)
      .eq("env", supabaseEnv),
  );
  if (error) throw error;
  return true;
}

export function usePagestormDraft(draftId: string | null) {
  const [draft, setDraft] = useState<PagestormPost | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  useEffect(() => {
    if (!draftId || !supabaseEnabled) return;
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
    const loadLegacy = () => {
      withSupabaseTimeout(
        "pagestorm_drafts.detail",
        supabase
          .from(PAGESTORM_DRAFT_TABLE)
          .select("*")
          .eq("id", draftId)
          .eq("env", supabaseEnv)
          .maybeSingle(),
      )
        .then(({ data, error }) => {
          if (error) throw error;
          show(data);
        })
        .catch(fail);
    };
    if (toyboxViaApi()) {
      apiMyPagestormDraft(draftId)
        .then(show)
        .catch((error) => {
          if (cancelled) return;
          if (shouldUseLegacy(error)) loadLegacy();
          else fail();
        });
    } else {
      loadLegacy();
    }
    return () => {
      cancelled = true;
    };
  }, [draftId]);

  return {
    draft: draftId && loadedId === draftId ? draft : null,
    loading: Boolean(draftId) && loadedId !== draftId && supabaseEnabled,
  };
}

export function usePagestormDrafts(userId: string | null) {
  const [drafts, setDrafts] = useState<{ userId: string; posts: PagestormPostCard[] } | null>(null);

  useEffect(() => {
    if (!userId || !supabaseEnabled) return;
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
    const loadLegacy = () => {
      withSupabaseTimeout(
        "pagestorm_drafts.list",
        supabase
          .from(PAGESTORM_DRAFT_TABLE)
          .select("id, user_id, nickname, title, content, content_text, env, created_at, avatar_id, avatar_kind, palette_id, palette_swapped")
          .eq("env", supabaseEnv)
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(20),
      )
        .then(({ data, error }) => {
          if (error) throw error;
          show(data ?? []);
        })
        .catch(fail);
    };
    if (toyboxViaApi()) {
      apiMyPagestormDrafts()
        .then(show)
        .catch((error) => {
          if (cancelled) return;
          if (shouldUseLegacy(error)) loadLegacy();
          else fail();
        });
    } else {
      loadLegacy();
    }
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return drafts?.userId === userId ? drafts.posts : [];
}

export function usePagestormPosts() {
  const [posts, setPosts] = useState<PagestormPostCard[]>([]);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [unavailable, setUnavailable] = useState(!supabaseEnabled);

  useEffect(() => {
    if (!supabaseEnabled) return;
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
    const loadLegacy = () => {
      withSupabaseTimeout(
        "pagestorm_posts.list",
        supabase
          .from(PAGESTORM_TABLE)
          .select("id, user_id, nickname, title, content, content_text, env, created_at, avatar_id, avatar_kind, palette_id, palette_swapped")
          .eq("env", supabaseEnv)
          .order("created_at", { ascending: false })
          .limit(50),
      )
        .then(({ data, error }) => {
          if (error) throw error;
          show(data ?? []);
        })
        .catch(fail);
    };

    if (toyboxViaApi()) {
      apiPagestormPosts()
        .then(show)
        .catch((error) => {
          if (cancelled) return;
          if (shouldUseLegacy(error)) loadLegacy();
          else fail();
        });
    } else {
      loadLegacy();
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return { posts, loading, unavailable };
}

export function usePagestormPost(postId: string, userId: string | null = null) {
  const [post, setPost] = useState<PagestormPost | null>(null);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [unavailable, setUnavailable] = useState(!supabaseEnabled);

  useEffect(() => {
    if (!supabaseEnabled) return;
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
    const loadLegacy = () => {
      withSupabaseTimeout(
        "pagestorm_posts.detail",
        supabase
          .from(PAGESTORM_TABLE)
          .select("*")
          .eq("id", postId)
          .eq("env", supabaseEnv)
          .maybeSingle(),
      )
        .then(({ data, error }) => {
          if (error) throw error;
          show(data);
        })
        .catch(fail);
    };

    if (toyboxViaApi()) {
      apiToyboxPost("pagestorm", postId)
        .then(show)
        .catch((error) => {
          if (cancelled) return;
          if (shouldUseLegacy(error)) loadLegacy();
          else fail();
        });
    } else {
      loadLegacy();
    }

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
    if (!userId || !supabaseEnabled) return false;
    if (toyboxViaApi()) {
      try {
        // True whether or not a row matched, like the legacy delete.
        await apiDeleteToyboxPost("pagestorm", postId);
        setPost(null);
        return true;
      } catch (error) {
        if (!writeMayGoLegacy(error)) {
          setUnavailable(true);
          return false;
        }
      }
    }
    const { error } = await withSupabaseTimeout(
      "pagestorm_posts.detail.delete",
      supabase
        .from(PAGESTORM_TABLE)
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

  return { post, loading, unavailable, update, remove, setUnavailable };
}

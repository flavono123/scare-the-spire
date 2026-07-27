"use client";

import { useCallback, useEffect, useState } from "react";
import type { PostBlock } from "@/lib/chemical-types";
import { blocksToPlainText } from "@/lib/chemical-utils";
import type { GameLocale } from "@/lib/i18n";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import {
  isTransfigureChanged,
  normalizeTransfigureCardKeywords,
  normalizeTransfigureCost,
  normalizeTransfigureName,
  type TransfigureCardKeywords,
  type TransfigurePost,
  type TransfigureResourceRef,
} from "@/lib/transfigure-types";

export interface SaveTransfigurePostInput {
  blocks: PostBlock[];
  nickname: string;
  title: string;
  resource: TransfigureResourceRef;
  sourceText: string;
  sourceBlocks: PostBlock[];
  sourceGameLocale: GameLocale;
  sourceName: string;
  sourceCost: string | null;
  sourceUpgradeText: string | null;
  sourceUpgradeBlocks: PostBlock[] | null;
  sourceUpgradeCost: string | null;
  sourceCardKeywords: TransfigureCardKeywords | null;
  sourceUpgradedCardKeywords: TransfigureCardKeywords | null;
  transformedName: string;
  transformedCost: string;
  cardKeywords: TransfigureCardKeywords | null;
  upgradedBlocks: PostBlock[] | null;
  transformedUpgradeCost: string;
  upgradedCardKeywords: TransfigureCardKeywords | null;
  showUpgrade: boolean;
  activeUserId?: string;
}

interface UseTransfigurePostsReturn {
  posts: TransfigurePost[];
  loading: boolean;
  unavailable: boolean;
  add: (input: SaveTransfigurePostInput) => Promise<TransfigurePost | null>;
  update: (
    postId: string,
    input: SaveTransfigurePostInput,
  ) => Promise<TransfigurePost | null>;
  remove: (postId: string) => Promise<boolean>;
}

interface UseTransfigurePostReturn {
  post: TransfigurePost | null;
  loading: boolean;
  unavailable: boolean;
  update: (
    input: SaveTransfigurePostInput,
  ) => Promise<TransfigurePost | null>;
  remove: () => Promise<boolean>;
}

function normalizePost(row: unknown): TransfigurePost {
  const post = row as TransfigurePost;
  return {
    ...post,
    card_top_keywords: post.card_top_keywords ?? [],
    card_bottom_keywords: post.card_bottom_keywords ?? [],
    upgraded_content: post.upgraded_content ?? null,
    upgraded_content_text: post.upgraded_content_text ?? null,
    transformed_upgrade_cost: post.transformed_upgrade_cost ?? null,
    upgraded_card_top_keywords: post.upgraded_card_top_keywords ?? [],
    upgraded_card_bottom_keywords: post.upgraded_card_bottom_keywords ?? [],
    show_upgrade: post.show_upgrade ?? false,
  };
}

function validateSaveInput(input: SaveTransfigurePostInput) {
  const contentText = blocksToPlainText(input.blocks).trim();
  const nickname = input.nickname.trim();
  const title = input.title.trim();
  const sourceText = input.sourceText.trim();
  const transformedName = normalizeTransfigureName(
    input.transformedName,
    input.sourceName,
  );
  const transformedCost = normalizeTransfigureCost(
    input.transformedCost,
    input.sourceCost,
  );
  const upgradedContentText = input.upgradedBlocks
    ? blocksToPlainText(input.upgradedBlocks).trim()
    : null;
  const transformedUpgradeCost = normalizeTransfigureCost(
    input.transformedUpgradeCost,
    input.sourceUpgradeCost,
  );
  const cardKeywords = normalizeTransfigureCardKeywords(input.cardKeywords);
  const upgradedCardKeywords = normalizeTransfigureCardKeywords(
    input.upgradedCardKeywords,
  );
  const cardKeywordInputValid = input.resource.type === "card"
    ? (
      input.cardKeywords != null
      && (
        input.upgradedBlocks == null
        || input.upgradedCardKeywords != null
      )
    )
    : (
      cardKeywords.top.length === 0
      && cardKeywords.bottom.length === 0
      && upgradedCardKeywords.top.length === 0
      && upgradedCardKeywords.bottom.length === 0
    );
  const validCost = transformedCost == null || /^(X|[0-9]{1,2})$/.test(transformedCost);
  const validUpgradeCost = transformedUpgradeCost == null
    || /^(X|[0-9]{1,2})$/.test(transformedUpgradeCost);
  const validUpgradeContent = input.upgradedBlocks == null
    ? (
      input.sourceUpgradeText == null
      && input.sourceUpgradeBlocks == null
      && transformedUpgradeCost == null
    )
    : (
      input.sourceUpgradeText != null
      && input.sourceUpgradeBlocks != null
      && (upgradedContentText?.length ?? 0) >= 2
    );
  const validShowUpgrade = !input.showUpgrade || (
    input.resource.type === "card"
    && input.upgradedBlocks != null
    && input.sourceUpgradeText != null
    && input.sourceUpgradeBlocks != null
  );

  if (
    !input.activeUserId
    || !supabaseEnabled
    || contentText.length < 2
    || nickname.length < 1
    || nickname.length > 20
    || title.length < 1
    || title.length > 80
    || !input.resource.id
    || !sourceText
    || !validCost
    || !validUpgradeCost
    || !validUpgradeContent
    || !validShowUpgrade
    || !cardKeywordInputValid
    || (transformedName?.length ?? 0) > 80
    || !isTransfigureChanged({
      blocks: input.blocks,
      sourceText,
      sourceBlocks: input.sourceBlocks,
      transformedName: input.transformedName,
      sourceName: input.sourceName,
      transformedCost: input.transformedCost,
      sourceCost: input.sourceCost,
      upgradedBlocks: input.upgradedBlocks,
      sourceUpgradeText: input.sourceUpgradeText,
      sourceUpgradeBlocks: input.sourceUpgradeBlocks,
      transformedUpgradeCost: input.transformedUpgradeCost,
      sourceUpgradeCost: input.sourceUpgradeCost,
      cardKeywords,
      sourceCardKeywords: input.sourceCardKeywords,
      upgradedCardKeywords,
      sourceUpgradedCardKeywords: input.sourceUpgradedCardKeywords,
      showUpgrade: input.showUpgrade,
    })
  ) {
    return null;
  }

  return {
    contentText,
    nickname,
    title,
    sourceText,
    transformedName,
    transformedCost,
    upgradedContentText,
    transformedUpgradeCost,
    cardKeywords,
    upgradedCardKeywords,
  };
}

async function persistTransfigurePostUpdate(
  postId: string,
  input: SaveTransfigurePostInput,
) {
  const normalized = validateSaveInput(input);
  if (!normalized || !input.activeUserId) {
    return { data: null, error: null };
  }

  return withSupabaseTimeout(
    "transfigure_posts.update",
    supabase
      .from("transfigure_posts")
      .update({
        nickname: normalized.nickname,
        title: normalized.title,
        content: input.blocks,
        content_text: normalized.contentText,
        transformed_name: normalized.transformedName,
        transformed_cost: normalized.transformedCost,
        card_top_keywords: normalized.cardKeywords.top,
        card_bottom_keywords: normalized.cardKeywords.bottom,
        upgraded_content: input.upgradedBlocks,
        upgraded_content_text: normalized.upgradedContentText,
        transformed_upgrade_cost: normalized.transformedUpgradeCost,
        upgraded_card_top_keywords: normalized.upgradedCardKeywords.top,
        upgraded_card_bottom_keywords: normalized.upgradedCardKeywords.bottom,
        show_upgrade: input.showUpgrade,
      })
      .eq("id", postId)
      .eq("user_id", input.activeUserId)
      .eq("env", supabaseEnv)
      .select()
      .single(),
  ).catch(() => ({ data: null, error: new Error("timeout") }));
}

export function useTransfigurePosts(
  userId: string | null,
): UseTransfigurePostsReturn {
  const [posts, setPosts] = useState<TransfigurePost[]>([]);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [unavailable, setUnavailable] = useState(!supabaseEnabled);

  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancelled = false;

    withSupabaseTimeout(
      "transfigure_posts.select",
      supabase
        .from("transfigure_posts")
        .select("*")
        .eq("env", supabaseEnv)
        .order("created_at", { ascending: false })
        .limit(50),
    )
      .then(({ data, error }) => {
        if (error) throw error;
        if (cancelled) return;
        setPosts((data ?? []).map(normalizePost));
        setUnavailable(false);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setUnavailable(true);
        setLoading(false);
      });

    const channel = supabase
      .channel("transfigure_posts")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "transfigure_posts",
        },
        (payload) => {
          const updatedPost = normalizePost(payload.new);
          if (updatedPost.env !== supabaseEnv) return;
          setPosts((current) => current.map((post) => (
            post.id === updatedPost.id ? updatedPost : post
          )));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "transfigure_posts",
        },
        (payload) => {
          const newPost = normalizePost(payload.new);
          if (newPost.env !== supabaseEnv) return;
          setPosts((current) => {
            if (current.some((post) => post.id === newPost.id)) return current;
            return [newPost, ...current].slice(0, 50);
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "transfigure_posts",
        },
        (payload) => {
          setPosts((current) => current.filter((post) => post.id !== payload.old.id));
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
    async ({
      blocks,
      nickname,
      title,
      resource,
      sourceText,
      sourceBlocks,
      sourceGameLocale,
      activeUserId = userId ?? undefined,
      sourceName,
      sourceCost,
      sourceUpgradeText,
      sourceUpgradeBlocks,
      sourceUpgradeCost,
      sourceCardKeywords,
      sourceUpgradedCardKeywords,
      transformedName,
      transformedCost,
      cardKeywords,
      upgradedBlocks,
      transformedUpgradeCost,
      upgradedCardKeywords,
      showUpgrade,
    }: SaveTransfigurePostInput): Promise<TransfigurePost | null> => {
      const normalized = validateSaveInput({
        blocks,
        nickname,
        title,
        resource,
        sourceText,
        sourceBlocks,
        sourceGameLocale,
        sourceName,
        sourceCost,
        sourceUpgradeText,
        sourceUpgradeBlocks,
        sourceUpgradeCost,
        sourceCardKeywords,
        sourceUpgradedCardKeywords,
        transformedName,
        transformedCost,
        cardKeywords,
        upgradedBlocks,
        transformedUpgradeCost,
        upgradedCardKeywords,
        showUpgrade,
        activeUserId,
      });
      if (!normalized || !activeUserId) return null;

      const { data, error } = await withSupabaseTimeout(
        "transfigure_posts.insert",
        supabase
          .from("transfigure_posts")
          .insert({
            user_id: activeUserId,
            nickname: normalized.nickname,
            title: normalized.title,
            resource_type: resource.type,
            resource_id: resource.id,
            source_text: normalized.sourceText,
            source_game_locale: sourceGameLocale,
            content: blocks,
            content_text: normalized.contentText,
            transformed_name: normalized.transformedName,
            transformed_cost: normalized.transformedCost,
            card_top_keywords: normalized.cardKeywords.top,
            card_bottom_keywords: normalized.cardKeywords.bottom,
            upgraded_content: upgradedBlocks,
            upgraded_content_text: normalized.upgradedContentText,
            transformed_upgrade_cost: normalized.transformedUpgradeCost,
            upgraded_card_top_keywords: normalized.upgradedCardKeywords.top,
            upgraded_card_bottom_keywords: normalized.upgradedCardKeywords.bottom,
            show_upgrade: showUpgrade,
            env: supabaseEnv,
          })
          .select()
          .single(),
      ).catch(() => ({ data: null, error: new Error("timeout") }));

      if (error) {
        setUnavailable(true);
        throw new Error(error.message);
      }
      if (!data) return null;

      const post = normalizePost(data);
      setPosts((current) => {
        if (current.some((item) => item.id === post.id)) return current;
        return [post, ...current].slice(0, 50);
      });
      return post;
    },
    [userId],
  );

  const update = useCallback(
    async (postId: string, input: SaveTransfigurePostInput) => {
      const { data, error } = await persistTransfigurePostUpdate(postId, {
        ...input,
        activeUserId: input.activeUserId ?? userId ?? undefined,
      });
      if (error) {
        setUnavailable(true);
        throw new Error(error.message);
      }
      if (!data) return null;

      const post = normalizePost(data);
      setPosts((current) => current.map((item) => (
        item.id === post.id ? post : item
      )));
      return post;
    },
    [userId],
  );

  const remove = useCallback(
    async (postId: string) => {
      if (!userId || !supabaseEnabled) return false;
      const { error } = await withSupabaseTimeout(
        "transfigure_posts.delete",
        supabase
          .from("transfigure_posts")
          .delete()
          .eq("id", postId)
          .eq("user_id", userId)
          .eq("env", supabaseEnv),
      ).catch(() => ({ error: new Error("timeout") }));
      if (error) {
        setUnavailable(true);
        return false;
      }
      setPosts((current) => current.filter((post) => post.id !== postId));
      return true;
    },
    [userId],
  );

  return { posts, loading, unavailable, add, update, remove };
}

export function useTransfigurePost(
  postId: string,
  userId: string | null = null,
): UseTransfigurePostReturn {
  const [post, setPost] = useState<TransfigurePost | null>(null);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [unavailable, setUnavailable] = useState(!supabaseEnabled);

  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancelled = false;

    withSupabaseTimeout(
      "transfigure_posts.detail",
      supabase
        .from("transfigure_posts")
        .select("*")
        .eq("id", postId)
        .eq("env", supabaseEnv)
        .maybeSingle(),
    )
      .then(({ data, error }) => {
        if (error) throw error;
        if (cancelled) return;
        setPost(data ? normalizePost(data) : null);
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

  const update = useCallback(
    async (input: SaveTransfigurePostInput) => {
      const { data, error } = await persistTransfigurePostUpdate(postId, {
        ...input,
        activeUserId: input.activeUserId ?? userId ?? undefined,
      });
      if (error) {
        setUnavailable(true);
        throw new Error(error.message);
      }
      if (!data) return null;
      const updatedPost = normalizePost(data);
      setPost(updatedPost);
      return updatedPost;
    },
    [postId, userId],
  );

  const remove = useCallback(async () => {
    if (!userId || !supabaseEnabled) return false;
    const { error } = await withSupabaseTimeout(
      "transfigure_posts.detail.delete",
      supabase
        .from("transfigure_posts")
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

  return { post, loading, unavailable, update, remove };
}

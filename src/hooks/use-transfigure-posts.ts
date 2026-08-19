"use client";

import { useCallback, useEffect, useState } from "react";
import type { PostBlock } from "@/lib/chemical-types";
import { blocksToPlainText } from "@/lib/chemical-utils";
import type { CardRarityKo, CardTypeKo } from "@/lib/codex-types";
import { useToyboxFeed } from "@/hooks/use-toybox-feed";
import type { GameLocale } from "@/lib/i18n";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import type { ToyboxFeedSort } from "@/lib/toybox-feed";
import {
  canTransfigureCardMetadata,
  isTransfigureCardRarity,
  isTransfigureCardType,
  isTransfigureChanged,
  isTransfigureTokenColor,
  isTransfigureTokenWax,
  normalizeTransfigureCardRarity,
  normalizeTransfigureCardType,
  normalizeTransfigureCardKeywords,
  normalizeTransfigureCost,
  normalizeTransfigureName,
  normalizeTransfigureTokenColor,
  normalizeTransfigureTokenWax,
  type TransfigureCardKeywords,
  type TransfigureCardRarity,
  type TransfigureCardType,
  type TransfigurePost,
  type TransfigureResourceRef,
  type TransfigureTokenColor,
  type TransfigureTokenWax,
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
  sourceCardType?: CardTypeKo | null;
  sourceCardRarity?: CardRarityKo | null;
  sourceUpgradeText: string | null;
  sourceUpgradeBlocks: PostBlock[] | null;
  sourceUpgradeCost: string | null;
  sourceCardKeywords: TransfigureCardKeywords | null;
  sourceUpgradedCardKeywords: TransfigureCardKeywords | null;
  transformedName: string;
  transformedCost: string;
  transformedStarCost?: string;
  transformedCardType?: TransfigureCardType | "";
  transformedCardRarity?: TransfigureCardRarity | "";
  cardKeywords: TransfigureCardKeywords | null;
  upgradedBlocks: PostBlock[] | null;
  transformedUpgradeCost: string;
  transformedUpgradeStarCost?: string;
  upgradedCardKeywords: TransfigureCardKeywords | null;
  showUpgrade: boolean;
  tokenColor?: TransfigureTokenColor | "";
  tokenWax?: TransfigureTokenWax | "";
  activeUserId?: string;
  sourceStarCost?: string | null;
  sourceUpgradeStarCost?: string | null;
}

interface UseTransfigurePostsReturn {
  posts: TransfigurePost[];
  likeCounts: Record<string, number>;
  commentCounts: Record<string, number>;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  unavailable: boolean;
  loadMore: () => Promise<void>;
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
    transformed_card_type: isTransfigureCardType(post.transformed_card_type)
      ? post.transformed_card_type
      : null,
    transformed_card_rarity: isTransfigureCardRarity(post.transformed_card_rarity)
      ? post.transformed_card_rarity
      : null,
    card_top_keywords: post.card_top_keywords ?? [],
    card_bottom_keywords: post.card_bottom_keywords ?? [],
    upgraded_content: post.upgraded_content ?? null,
    upgraded_content_text: post.upgraded_content_text ?? null,
    transformed_upgrade_cost: post.transformed_upgrade_cost ?? null,
    transformed_star_cost: post.transformed_star_cost ?? null,
    transformed_upgrade_star_cost: post.transformed_upgrade_star_cost ?? null,
    upgraded_card_top_keywords: post.upgraded_card_top_keywords ?? [],
    upgraded_card_bottom_keywords: post.upgraded_card_bottom_keywords ?? [],
    show_upgrade: post.show_upgrade ?? false,
    token_color: isTransfigureTokenColor(post.token_color) ? post.token_color : null,
    token_wax: isTransfigureTokenWax(post.token_wax) ? post.token_wax : null,
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
  const transformedStarCost = normalizeTransfigureCost(
    input.transformedStarCost ?? "",
    input.sourceStarCost ?? null,
  );
  const transformedCardType = normalizeTransfigureCardType(
    input.transformedCardType,
    input.sourceCardType ?? null,
  );
  const transformedCardRarity = normalizeTransfigureCardRarity(
    input.transformedCardRarity,
    input.sourceCardRarity ?? null,
  );
  const upgradedContentText = input.upgradedBlocks
    ? blocksToPlainText(input.upgradedBlocks).trim()
    : null;
  const transformedUpgradeCost = normalizeTransfigureCost(
    input.transformedUpgradeCost,
    input.sourceUpgradeCost,
  );
  const transformedUpgradeStarCost = normalizeTransfigureCost(
    input.transformedUpgradeStarCost ?? "",
    input.sourceUpgradeStarCost ?? null,
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
  const cardMetadataInputValid = input.resource.type === "card"
    ? (
      (!input.transformedCardType && !input.transformedCardRarity)
      || (
        canTransfigureCardMetadata(
          input.sourceCardType,
          input.sourceCardRarity,
        )
        && (
          !input.transformedCardType
          || isTransfigureCardType(input.transformedCardType)
        )
        && (
          !input.transformedCardRarity
          || isTransfigureCardRarity(input.transformedCardRarity)
        )
      )
    )
    : !input.transformedCardType && !input.transformedCardRarity;
  const validCost = transformedCost == null || /^(X|[0-9]{1,2})$/.test(transformedCost);
  const validStarCost = transformedStarCost == null
    || /^(X|[0-9]{1,2})$/.test(transformedStarCost);
  const validUpgradeCost = transformedUpgradeCost == null
    || /^(X|[0-9]{1,2})$/.test(transformedUpgradeCost);
  const validUpgradeStarCost = transformedUpgradeStarCost == null
    || /^(X|[0-9]{1,2})$/.test(transformedUpgradeStarCost);
  const validUpgradeContent = input.upgradedBlocks == null
    ? (
      input.sourceUpgradeText == null
      && input.sourceUpgradeBlocks == null
      && transformedUpgradeCost == null
      && transformedUpgradeStarCost == null
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
  const tokenColor = normalizeTransfigureTokenColor(
    input.tokenColor,
    input.resource.type,
  );
  const tokenWax = normalizeTransfigureTokenWax(
    input.tokenWax,
    input.resource.type,
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
    || !validStarCost
    || !validUpgradeCost
    || !validUpgradeStarCost
    || !validUpgradeContent
    || !validShowUpgrade
    || !cardKeywordInputValid
    || !cardMetadataInputValid
    || (transformedName?.length ?? 0) > 80
    || !isTransfigureChanged({
      blocks: input.blocks,
      sourceText,
      sourceBlocks: input.sourceBlocks,
      transformedName: input.transformedName,
      sourceName: input.sourceName,
      transformedCost: input.transformedCost,
      sourceCost: input.sourceCost,
      transformedStarCost: input.transformedStarCost ?? "",
      sourceStarCost: input.sourceStarCost ?? null,
      transformedCardType: input.transformedCardType,
      sourceCardType: input.sourceCardType,
      transformedCardRarity: input.transformedCardRarity,
      sourceCardRarity: input.sourceCardRarity,
      upgradedBlocks: input.upgradedBlocks,
      sourceUpgradeText: input.sourceUpgradeText,
      sourceUpgradeBlocks: input.sourceUpgradeBlocks,
      transformedUpgradeCost: input.transformedUpgradeCost,
      sourceUpgradeCost: input.sourceUpgradeCost,
      transformedUpgradeStarCost: input.transformedUpgradeStarCost ?? "",
      sourceUpgradeStarCost: input.sourceUpgradeStarCost ?? null,
      cardKeywords,
      sourceCardKeywords: input.sourceCardKeywords,
      upgradedCardKeywords,
      sourceUpgradedCardKeywords: input.sourceUpgradedCardKeywords,
      showUpgrade: input.showUpgrade,
      resourceType: input.resource.type,
      tokenColor: input.tokenColor,
      tokenWax: input.tokenWax,
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
    transformedStarCost,
    transformedCardType,
    transformedCardRarity,
    upgradedContentText,
    transformedUpgradeCost,
    transformedUpgradeStarCost,
    cardKeywords,
    upgradedCardKeywords,
    tokenColor,
    tokenWax,
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
        transformed_star_cost: normalized.transformedStarCost,
        transformed_card_type: normalized.transformedCardType,
        transformed_card_rarity: normalized.transformedCardRarity,
        card_top_keywords: normalized.cardKeywords.top,
        card_bottom_keywords: normalized.cardKeywords.bottom,
        upgraded_content: input.upgradedBlocks,
        upgraded_content_text: normalized.upgradedContentText,
        transformed_upgrade_cost: normalized.transformedUpgradeCost,
        transformed_upgrade_star_cost: normalized.transformedUpgradeStarCost,
        upgraded_card_top_keywords: normalized.upgradedCardKeywords.top,
        upgraded_card_bottom_keywords: normalized.upgradedCardKeywords.bottom,
        show_upgrade: input.showUpgrade,
        token_color: normalized.tokenColor,
        token_wax: normalized.tokenWax,
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
  sort: ToyboxFeedSort = "latest",
): UseTransfigurePostsReturn {
  const {
    posts,
    likeCounts,
    commentCounts,
    loading,
    loadingMore,
    hasMore,
    unavailable,
    loadMore,
    prependPost,
    replacePost,
    removePost,
    setUnavailable,
  } = useToyboxFeed({
    service: "transfigure",
    table: "transfigure_posts",
    sort,
    normalizePost,
  });

  const add = useCallback(
    async (input: SaveTransfigurePostInput): Promise<TransfigurePost | null> => {
      const activeUserId = input.activeUserId ?? userId ?? undefined;
      const normalized = validateSaveInput({
        ...input,
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
            resource_type: input.resource.type,
            resource_id: input.resource.id,
            source_text: normalized.sourceText,
            source_game_locale: input.sourceGameLocale,
            content: input.blocks,
            content_text: normalized.contentText,
            transformed_name: normalized.transformedName,
            transformed_cost: normalized.transformedCost,
            transformed_star_cost: normalized.transformedStarCost,
            transformed_card_type: normalized.transformedCardType,
            transformed_card_rarity: normalized.transformedCardRarity,
            card_top_keywords: normalized.cardKeywords.top,
            card_bottom_keywords: normalized.cardKeywords.bottom,
            upgraded_content: input.upgradedBlocks,
            upgraded_content_text: normalized.upgradedContentText,
            transformed_upgrade_cost: normalized.transformedUpgradeCost,
            transformed_upgrade_star_cost: normalized.transformedUpgradeStarCost,
            upgraded_card_top_keywords: normalized.upgradedCardKeywords.top,
            upgraded_card_bottom_keywords: normalized.upgradedCardKeywords.bottom,
            show_upgrade: input.showUpgrade,
            token_color: normalized.tokenColor,
            token_wax: normalized.tokenWax,
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
      prependPost(post, data);
      return post;
    },
    [prependPost, setUnavailable, userId],
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
      replacePost(post, data);
      return post;
    },
    [replacePost, setUnavailable, userId],
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
      removePost(postId);
      return true;
    },
    [removePost, setUnavailable, userId],
  );

  return {
    posts,
    likeCounts,
    commentCounts,
    loading,
    loadingMore,
    hasMore,
    unavailable,
    loadMore,
    add,
    update,
    remove,
  };
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

"use client";

import { useCallback, useEffect, useState } from "react";
import type { PostBlock } from "@/lib/chemical-types";
import { blocksToPlainText } from "@/lib/chemical-utils";
import type { CardColor, CardRarityKo, CardTypeKo } from "@/lib/codex-types";
import { useToyboxFeed } from "@/hooks/use-toybox-feed";
import type { GameLocale } from "@/lib/i18n";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import type { ToyboxFeedSort } from "@/lib/toybox-feed";
import { currentAuthorProfileToken } from "@/lib/user-profile";
import {
  canTransfigureCardMetadata,
  isTransfigureCardColor,
  isTransfigureCardRarity,
  isTransfigureCardType,
  canSubmitTransfigure,
  normalizeTransfigureCardColor,
  normalizeTransfigureCardRarity,
  normalizeTransfigureCardType,
  normalizeTransfigureCardKeywords,
  normalizeTransfigureCost,
  normalizeTransfigureName,
  normalizeTransfigureOmitEnergyCost,
  normalizeTransfigureTokenColor,
  normalizeTransfigureTokenWax,
  normalizeTransfigurePost,
  TRANSFIGURE_MAX_VARIANTS,
  type TransfigureCardColor,
  type TransfigureCardKeywords,
  type TransfigureCardRarity,
  type TransfigureCardType,
  type TransfigurePost,
  type TransfigureResourceRef,
  type TransfigureTokenColor,
  type TransfigureTokenWax,
  type TransfigureVariant,
} from "@/lib/transfigure-types";

export interface SaveTransfigurePostInput {
  nickname: string;
  title: string;
  sourceGameLocale: GameLocale;
  /** Representative first. At most `TRANSFIGURE_MAX_VARIANTS`. */
  variants: SaveTransfigureVariantInput[];
  /** Rewrite `extra_variants` even when only one variant remains. */
  hadExtraVariants?: boolean;
  activeUserId?: string;
}

export interface SaveTransfigureVariantInput {
  blocks: PostBlock[];
  resource: TransfigureResourceRef;
  sourceText: string;
  sourceBlocks: PostBlock[];
  sourceName: string;
  sourceCost: string | null;
  sourceCardType?: CardTypeKo | null;
  sourceCardRarity?: CardRarityKo | null;
  sourceCardColor?: CardColor | null;
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
  transformedCardColor?: TransfigureCardColor | "";
  omitEnergyCost?: boolean;
  cardKeywords: TransfigureCardKeywords | null;
  upgradedBlocks: PostBlock[] | null;
  transformedUpgradeCost: string;
  transformedUpgradeStarCost?: string;
  upgradedCardKeywords: TransfigureCardKeywords | null;
  showUpgrade: boolean;
  tokenColor?: TransfigureTokenColor | "";
  tokenWax?: TransfigureTokenWax | "";
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

const normalizePost = normalizeTransfigurePost;

function validateVariantInput(
  input: SaveTransfigureVariantInput,
): TransfigureVariant | null {
  const contentText = blocksToPlainText(input.blocks).trim();
  const sourceText = input.sourceText.trim();
  const transformedName = normalizeTransfigureName(
    input.transformedName,
    input.sourceName,
  );
  const omitEnergyCost = normalizeTransfigureOmitEnergyCost(
    input.omitEnergyCost,
    input.sourceCost,
  );
  const transformedCost = omitEnergyCost
    ? null
    : normalizeTransfigureCost(
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
  const transformedCardColor = normalizeTransfigureCardColor(
    input.transformedCardColor,
    input.sourceCardColor ?? null,
  );
  const upgradedContentText = input.upgradedBlocks
    ? blocksToPlainText(input.upgradedBlocks).trim()
    : null;
  const transformedUpgradeCost = omitEnergyCost
    ? null
    : normalizeTransfigureCost(
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
      (
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
      && (
        !input.transformedCardColor
        || isTransfigureCardColor(input.transformedCardColor)
      )
    )
    : !input.transformedCardType
      && !input.transformedCardRarity
      && !input.transformedCardColor;
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
    contentText.length < 2
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
    || !canSubmitTransfigure({
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
      transformedCardColor: input.transformedCardColor,
      sourceCardColor: input.sourceCardColor,
      omitEnergyCost: input.omitEnergyCost,
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
    resource_type: input.resource.type,
    resource_id: input.resource.id,
    source_text: sourceText,
    content: input.blocks,
    content_text: contentText,
    transformed_name: transformedName,
    transformed_cost: transformedCost,
    transformed_star_cost: transformedStarCost,
    transformed_card_type: transformedCardType,
    transformed_card_rarity: transformedCardRarity,
    transformed_card_color: transformedCardColor,
    omit_energy_cost: omitEnergyCost,
    card_top_keywords: cardKeywords.top,
    card_bottom_keywords: cardKeywords.bottom,
    upgraded_content: input.upgradedBlocks,
    upgraded_content_text: upgradedContentText,
    transformed_upgrade_cost: transformedUpgradeCost,
    transformed_upgrade_star_cost: transformedUpgradeStarCost,
    upgraded_card_top_keywords: upgradedCardKeywords.top,
    upgraded_card_bottom_keywords: upgradedCardKeywords.bottom,
    show_upgrade: input.showUpgrade,
    token_color: tokenColor,
    token_wax: tokenWax,
  };
}

function validateSaveInput(input: SaveTransfigurePostInput) {
  const nickname = input.nickname.trim();
  const title = input.title.trim();
  if (
    !input.activeUserId
    || !supabaseEnabled
    || nickname.length < 1
    || nickname.length > 20
    || title.length < 1
    || title.length > 80
    || input.variants.length < 1
    || input.variants.length > TRANSFIGURE_MAX_VARIANTS
  ) {
    return null;
  }
  const variants = input.variants.map(validateVariantInput);
  if (variants.some((variant) => variant == null)) return null;
  const [representative, ...extraVariants] = variants as TransfigureVariant[];
  return {
    nickname,
    title,
    representative: representative!,
    // Old databases lack the column; only send it when it carries data.
    extraVariantsPatch: extraVariants.length > 0 || input.hadExtraVariants
      ? { extra_variants: extraVariants }
      : {},
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
        ...normalized.representative,
        ...normalized.extraVariantsPatch,
        ...(currentAuthorProfileToken() ? {
          avatar_id: currentAuthorProfileToken().avatar_id,
          avatar_kind: currentAuthorProfileToken().avatar_kind,
          palette_id: currentAuthorProfileToken().palette_id,
          palette_swapped: currentAuthorProfileToken().palette_swapped,
        } : {}),
      })
      .eq("id", postId)
      .eq("user_id", input.activeUserId)
      .eq("env", supabaseEnv)
      .select()
      .single(),
  ).catch(() => ({ data: null, error: new Error("timeout") }));
}

export async function insertTransfigurePost(
  input: SaveTransfigurePostInput,
): Promise<TransfigurePost | null> {
  const normalized = validateSaveInput(input);
  if (!normalized || !input.activeUserId) return null;

  const token = currentAuthorProfileToken();
  const { data, error } = await withSupabaseTimeout(
    "transfigure_posts.insert",
    supabase
      .from("transfigure_posts")
      .insert({
        user_id: input.activeUserId,
        nickname: normalized.nickname,
        title: normalized.title,
        source_game_locale: input.sourceGameLocale,
        ...normalized.representative,
        ...normalized.extraVariantsPatch,
        env: supabaseEnv,
        ...(token ? {
          avatar_id: token.avatar_id,
          avatar_kind: token.avatar_kind,
          palette_id: token.palette_id,
          palette_swapped: token.palette_swapped,
        } : {}),
      })
      .select()
      .single(),
  );
  if (error) throw error;
  if (!data) return null;
  return normalizePost(data);
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
      try {
        const post = await insertTransfigurePost({
          ...input,
          activeUserId,
        });
        if (!post) return null;
        prependPost(post);
        return post;
      } catch (error) {
        setUnavailable(true);
        throw error;
      }
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

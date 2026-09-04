"use client";

import { useMemo } from "react";
import { useDefragmentFeed } from "@/hooks/use-defragment-feed";
import {
  DEFRAGMENT_FEED_SERVICE_META,
  feedItemFromPost,
  type DefragmentFederatedService,
} from "@/lib/defragment";
import { normalizeDefragmentSourcePost } from "@/lib/defragment-feed";
import { normalizeDecisionsDecisionsPost } from "@/lib/decisions-decisions";
import { normalizeFavoriteTournamentPost } from "@/lib/favorite-tournament";
import {
  isPagestormToyboxEmbedService,
  pagestormToyboxFederatedFromHref,
  pagestormToyboxPickFromFeedItem,
  pagestormToyboxPickerMode,
  type PagestormToyboxPick,
  type PagestormToyboxSnapshot,
} from "@/lib/pagestorm-toybox";
import type { TransfigurePost } from "@/lib/transfigure-types";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import type { ThisOrThatPost } from "@/lib/this-or-that";
import { TOYBOX_FEED_TABLES } from "@/lib/toybox-feed";

export function usePagestormToyboxPicker(serviceHref: string | null): {
  picks: PagestormToyboxPick[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  unavailable: boolean;
  loadMore: () => Promise<void>;
} {
  const mode = pagestormToyboxPickerMode(serviceHref);
  const enabled = mode !== "unsupported";
  const service = mode === "all" || mode === "unsupported" ? null : mode;
  const feed = useDefragmentFeed("latest", service, enabled);
  const picks = useMemo(
    () => feed.items
      .filter((item) => isPagestormToyboxEmbedService(item.service))
      .map(pagestormToyboxPickFromFeedItem),
    [feed.items],
  );
  return {
    picks,
    loading: feed.loading,
    loadingMore: feed.loadingMore,
    hasMore: feed.hasMore,
    unavailable: feed.unavailable,
    loadMore: feed.loadMore,
  };
}

async function fetchToyboxRow(
  service: DefragmentFederatedService,
  postId: string,
): Promise<unknown | null> {
  if (!supabaseEnabled) return null;
  const { data, error } = await withSupabaseTimeout(
    `pagestorm.toybox.${service}.detail`,
    supabase
      .from(TOYBOX_FEED_TABLES[service])
      .select("*")
      .eq("id", postId)
      .eq("env", supabaseEnv)
      .maybeSingle(),
  );
  if (error) throw error;
  return data ?? null;
}

export async function loadPagestormToyboxSnapshot(
  pick: PagestormToyboxPick,
): Promise<PagestormToyboxSnapshot> {
  const base: PagestormToyboxSnapshot = {
    ...pick,
    leftType: "",
    leftId: "",
    rightType: "",
    rightId: "",
    rows: [],
    placements: [],
    pool: [],
    tokenSrc: "",
  };
  const federated = pagestormToyboxFederatedFromHref(pick.service);
  if (!federated) return base;
  base.tokenSrc = DEFRAGMENT_FEED_SERVICE_META[federated].tokenSrc;
  const row = await fetchToyboxRow(federated, pick.id);
  if (!row) return base;
  if (federated === "this_or_that") {
    const post = row as ThisOrThatPost;
    return {
      ...base,
      title: post.reason || pick.title,
      nickname: post.nickname || pick.nickname,
      leftType: post.left_type,
      leftId: post.left_id,
      rightType: post.right_type,
      rightId: post.right_id,
    };
  }
  if (federated === "decisions_decisions") {
    const post = normalizeDecisionsDecisionsPost(row);
    return {
      ...base,
      title: post.title || pick.title,
      nickname: post.nickname || pick.nickname,
      rows: post.rows,
      placements: post.placements,
      pool: post.extra_ids,
    };
  }
  if (federated === "transfigure") {
    const post = row as TransfigurePost;
    return {
      ...base,
      title: post.title?.trim() || pick.title,
      nickname: post.nickname || pick.nickname,
      leftType: post.resource_type,
      leftId: post.resource_id,
    };
  }
  const source = federated === "favorite_tournament"
    ? normalizeFavoriteTournamentPost(row)
    : normalizeDefragmentSourcePost(row);
  const item = feedItemFromPost(federated, source);
  return {
    ...base,
    title: item.title || pick.title,
    nickname: item.nickname || pick.nickname,
  };
}

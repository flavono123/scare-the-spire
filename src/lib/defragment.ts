import type { PostBlock } from "@/lib/chemical-types";
import {
  buildChemicalXCommentThreadKey,
  buildComboCommentThreadKey,
  buildDecisionsDecisionsCommentThreadKey,
  buildFavoriteTournamentCommentThreadKey,
  buildThisOrThatCommentThreadKey,
  buildTransfigureCommentThreadKey,
} from "@/lib/comment-threads";
import { DECISIONS_DECISIONS_HREF, DECISIONS_DECISIONS_TOKEN_SRC } from "@/lib/decisions-decisions";
import {
  FAVORITE_TOURNAMENT_HREF,
  FAVORITE_TOURNAMENT_TOKEN_SRC,
} from "@/lib/favorite-tournament";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { toyboxRecommendScore, type ToyboxFeedSort } from "@/lib/toybox-feed";

export const DEFRAGMENT_HREF = "/defragment";
export const DEFRAGMENT_TOKEN_SRC = "/images/sts2/powers/focus_power.webp";
export const DEFRAGMENT_BACKGROUND_SRC = "/images/sts2/cards/defragment.webp";

export const DEFRAGMENT_FEDERATED_SERVICES = [
  "combo",
  "transfigure",
  "this_or_that",
  "favorite_tournament",
  "chemical_x",
  "decisions_decisions",
] as const;

export const DEFRAGMENT_FEED_SERVICES = DEFRAGMENT_FEDERATED_SERVICES;

export type DefragmentFederatedService =
  (typeof DEFRAGMENT_FEDERATED_SERVICES)[number];
export type DefragmentFeedService = string;

export interface DefragmentPost {
  id: string;
  user_id: string;
  nickname: string;
  title: string;
  content: PostBlock[];
  content_text: string;
  env: string;
  created_at: string;
  like_count?: number;
  comment_count?: number;
}

export interface DefragmentFeedItem {
  id: string;
  created_at: string;
  service: DefragmentFeedService;
  title: string;
  nickname: string;
  userId: string;
  likeCount: number;
  commentCount: number;
  recommendScore: number;
}

export const DEFRAGMENT_FEED_SERVICE_META: Record<
  DefragmentFederatedService,
  { hrefBase: string; tokenSrc: string }
> = {
  combo: {
    hrefBase: "/c-c-c-combo",
    tokenSrc: "/images/sts2/badges/ccccombo.webp",
  },
  transfigure: {
    hrefBase: "/transfigure",
    tokenSrc: "/images/sts2/relics/astrolabe.webp",
  },
  this_or_that: {
    hrefBase: "/this-or-that",
    tokenSrc: "/images/sts2/relics/choices_paradox.webp",
  },
  chemical_x: {
    hrefBase: "/chemical-x",
    tokenSrc: "/images/sts2/relics/chemical_x.webp",
  },
  decisions_decisions: {
    hrefBase: DECISIONS_DECISIONS_HREF,
    tokenSrc: DECISIONS_DECISIONS_TOKEN_SRC,
  },
  favorite_tournament: {
    hrefBase: FAVORITE_TOURNAMENT_HREF,
    tokenSrc: FAVORITE_TOURNAMENT_TOKEN_SRC,
  },
};

const UNKNOWN_SERVICE_META = {
  hrefBase: DEFRAGMENT_HREF,
  tokenSrc: DEFRAGMENT_TOKEN_SRC,
};

export function isDefragmentFederatedService(
  value: unknown,
): value is DefragmentFederatedService {
  return DEFRAGMENT_FEDERATED_SERVICES.includes(value as DefragmentFederatedService);
}

export function isDefragmentFeedService(
  value: unknown,
): value is DefragmentFederatedService {
  return isDefragmentFederatedService(value);
}

export function defragmentServiceMeta(service: string): {
  hrefBase: string;
  tokenSrc: string;
} {
  if (isDefragmentFederatedService(service)) {
    return DEFRAGMENT_FEED_SERVICE_META[service];
  }
  return UNKNOWN_SERVICE_META;
}

export function feedItemFromPost(
  service: DefragmentFeedService,
  post: {
    id: string;
    created_at: string;
    nickname?: string | null;
    user_id?: string | null;
    like_count?: number;
    comment_count?: number;
    title?: string | null;
    content_text?: string;
    transformed_name?: string | null;
    reason?: string;
    note?: string;
  },
): DefragmentFeedItem {
  const likeCount = post.like_count ?? 0;
  const commentCount = post.comment_count ?? 0;
  let title = "";
  if (service === "this_or_that") title = post.reason ?? "";
  else if (service === "transfigure") {
    title = post.title?.trim() || post.transformed_name?.trim() || post.content_text || "";
  } else if (service === "decisions_decisions" || service === "favorite_tournament") {
    title = post.title?.trim() || post.note?.trim() || "";
  } else title = post.content_text ?? "";

  return {
    id: post.id,
    created_at: post.created_at,
    service,
    title: title.replace(/\s+/g, " ").trim().slice(0, 120),
    nickname: (post.nickname ?? "").trim(),
    userId: post.user_id ?? "",
    likeCount,
    commentCount,
    recommendScore: toyboxRecommendScore(likeCount),
  };
}

export function defragmentBoardPath(
  item: Pick<DefragmentFeedItem, "id" | "service">,
): string {
  // App Router folder is [id]/[postId] so the first dynamic segment stays `id`.
  return `${DEFRAGMENT_HREF}/${item.service}/${item.id}`;
}

export function defragmentItemHref(
  item: Pick<DefragmentFeedItem, "id" | "service">,
  serviceLocale: ServiceLocale,
  gameLocale: GameLocale,
): string {
  return localizeHrefWithGameLocale(defragmentBoardPath(item), serviceLocale, gameLocale);
}

export function defragmentOriginalHref(
  item: Pick<DefragmentFeedItem, "id" | "service">,
  serviceLocale: ServiceLocale,
  gameLocale: GameLocale,
): string {
  const { hrefBase } = defragmentServiceMeta(item.service);
  if (!isDefragmentFederatedService(item.service)) {
    return localizeHrefWithGameLocale(DEFRAGMENT_HREF, serviceLocale, gameLocale);
  }
  return localizeHrefWithGameLocale(`${hrefBase}/${item.id}`, serviceLocale, gameLocale);
}

export function defragmentItemCommentsHref(
  item: Pick<DefragmentFeedItem, "id" | "service">,
  serviceLocale: ServiceLocale,
  gameLocale: GameLocale,
): string {
  return `${defragmentItemHref(item, serviceLocale, gameLocale)}#comments`;
}

export function defragmentItemThreadKey(
  item: Pick<DefragmentFeedItem, "id" | "service">,
): string | null {
  switch (item.service) {
    case "combo":
      return buildComboCommentThreadKey(item.id);
    case "transfigure":
      return buildTransfigureCommentThreadKey(item.id);
    case "this_or_that":
      return buildThisOrThatCommentThreadKey(item.id);
    case "chemical_x":
      return buildChemicalXCommentThreadKey(item.id);
    case "decisions_decisions":
      return buildDecisionsDecisionsCommentThreadKey(item.id);
    case "favorite_tournament":
      return buildFavoriteTournamentCommentThreadKey(item.id);
    default:
      return null;
  }
}

export function defragmentFeedScore(
  item: DefragmentFeedItem,
  sort: ToyboxFeedSort,
): number {
  if (sort === "comments") return item.commentCount;
  if (sort === "recommended") return item.likeCount;
  return item.recommendScore;
}

export const DEFRAGMENT_BOARD_COLUMN_SORTS = {
  created_at: "latest",
  likes: "recommended",
  comments: "comments",
} as const;

export type DefragmentBoardColumnSort = keyof typeof DEFRAGMENT_BOARD_COLUMN_SORTS;

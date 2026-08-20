import type { PostBlock } from "@/lib/chemical-types";
import {
  buildChemicalXCommentThreadKey,
  buildComboCommentThreadKey,
  buildDefragmentCommentThreadKey,
  buildThisOrThatCommentThreadKey,
  buildTransfigureCommentThreadKey,
} from "@/lib/comment-threads";
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
  "chemical_x",
] as const;

export const DEFRAGMENT_FEED_SERVICES = [
  "defragment",
  ...DEFRAGMENT_FEDERATED_SERVICES,
] as const;

export type DefragmentFederatedService =
  (typeof DEFRAGMENT_FEDERATED_SERVICES)[number];
export type DefragmentFeedService = (typeof DEFRAGMENT_FEED_SERVICES)[number];

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
  likeCount: number;
  commentCount: number;
  recommendScore: number;
}

export const DEFRAGMENT_FEED_SERVICE_META: Record<
  DefragmentFeedService,
  { hrefBase: string; tokenSrc: string }
> = {
  defragment: {
    hrefBase: DEFRAGMENT_HREF,
    tokenSrc: DEFRAGMENT_TOKEN_SRC,
  },
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
};

export function isDefragmentFederatedService(
  value: unknown,
): value is DefragmentFederatedService {
  return DEFRAGMENT_FEDERATED_SERVICES.includes(value as DefragmentFederatedService);
}

export function isDefragmentFeedService(
  value: unknown,
): value is DefragmentFeedService {
  return DEFRAGMENT_FEED_SERVICES.includes(value as DefragmentFeedService);
}

export function feedItemFromPost(
  service: DefragmentFeedService,
  post: {
    id: string;
    created_at: string;
    like_count?: number;
    comment_count?: number;
    title?: string | null;
    content_text?: string;
    transformed_name?: string | null;
    reason?: string;
  },
): DefragmentFeedItem {
  const likeCount = post.like_count ?? 0;
  const commentCount = post.comment_count ?? 0;
  let title = "";
  if (service === "this_or_that") title = post.reason ?? "";
  else if (service === "transfigure") {
    title = post.title?.trim() || post.transformed_name?.trim() || post.content_text || "";
  } else if (service === "defragment") title = post.title ?? "";
  else title = post.content_text ?? "";

  return {
    id: post.id,
    created_at: post.created_at,
    service,
    title: title.replace(/\s+/g, " ").trim().slice(0, 120),
    likeCount,
    commentCount,
    recommendScore: toyboxRecommendScore(likeCount, commentCount),
  };
}

export function defragmentBoardPath(
  item: Pick<DefragmentFeedItem, "id" | "service">,
): string {
  if (item.service === "defragment") return `${DEFRAGMENT_HREF}/${item.id}`;
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
  const { hrefBase } = DEFRAGMENT_FEED_SERVICE_META[item.service];
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
): string {
  switch (item.service) {
    case "combo":
      return buildComboCommentThreadKey(item.id);
    case "transfigure":
      return buildTransfigureCommentThreadKey(item.id);
    case "this_or_that":
      return buildThisOrThatCommentThreadKey(item.id);
    case "chemical_x":
      return buildChemicalXCommentThreadKey(item.id);
    default:
      return buildDefragmentCommentThreadKey(item.id);
  }
}

export function defragmentFeedScore(
  item: DefragmentFeedItem,
  sort: ToyboxFeedSort,
): number {
  return sort === "comments" ? item.commentCount : item.recommendScore;
}

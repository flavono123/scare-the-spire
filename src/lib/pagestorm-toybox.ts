import type { PostBlock } from "@/lib/chemical-types";
import {
  DEFRAGMENT_FEED_SERVICE_META,
  DEFRAGMENT_HREF,
  defragmentOriginalHref,
  isDefragmentFederatedService,
  type DefragmentFederatedService,
  type DefragmentFeedItem,
} from "@/lib/defragment";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { PAGESTORM_HREF } from "@/lib/pagestorm";
import type { TransfigurePost } from "@/lib/transfigure-types";

export const PAGESTORM_TOYBOX_EMBED_SERVICES = [
  "transfigure",
  "this_or_that",
  "decisions_decisions",
] as const;

export type PagestormToyboxEmbedService =
  (typeof PAGESTORM_TOYBOX_EMBED_SERVICES)[number];

export function isPagestormToyboxEmbedService(
  service: string,
): service is PagestormToyboxEmbedService {
  return (PAGESTORM_TOYBOX_EMBED_SERVICES as readonly string[]).includes(service);
}

export type PagestormToyboxPick = {
  id: string;
  service: string;
  userId: string;
  title: string;
  nickname: string;
};

export type PagestormTransfigurePreview = {
  blocks: PostBlock[];
  upgradedBlocks: PostBlock[] | null;
  transformedName: string;
  transformedCost: string;
  transformedStarCost: string;
  transformedCardType: string;
  transformedCardRarity: string;
  transformedUpgradeCost: string;
  transformedUpgradeStarCost: string;
  cardTopKeywords: string[];
  cardBottomKeywords: string[];
  upgradedCardTopKeywords: string[];
  upgradedCardBottomKeywords: string[];
  showUpgrade: boolean;
  tokenColor: string;
  tokenWax: string;
};

export type PagestormToyboxSnapshot = PagestormToyboxPick & {
  leftType: string;
  leftId: string;
  rightType: string;
  rightId: string;
  rows: unknown[];
  placements: unknown[];
  pool: unknown[];
  tokenSrc: string;
  transfigure: PagestormTransfigurePreview | null;
};

export type PagestormToyboxPickerMode =
  | "all"
  | "unsupported"
  | DefragmentFederatedService;

const HREF_TO_SERVICE = Object.fromEntries(
  (Object.entries(DEFRAGMENT_FEED_SERVICE_META) as [
    DefragmentFederatedService,
    { hrefBase: string },
  ][]).map(([service, meta]) => [meta.hrefBase, service]),
) as Record<string, DefragmentFederatedService>;

export function stripPagestormToyboxHref(href: string): string {
  return href.replace(/^\/(?:en)(?=\/)/, "");
}

export function pagestormToyboxFederatedFromHref(
  href: string,
): DefragmentFederatedService | null {
  const path = stripPagestormToyboxHref(href);
  if (isDefragmentFederatedService(path)) return path;
  return HREF_TO_SERVICE[path] ?? null;
}

export function pagestormToyboxServiceHref(service: string): string {
  if (isDefragmentFederatedService(service)) {
    return DEFRAGMENT_FEED_SERVICE_META[service].hrefBase;
  }
  return stripPagestormToyboxHref(service);
}

export function pagestormToyboxPickerMode(
  href: string | null,
): PagestormToyboxPickerMode {
  if (!href) return "all";
  const path = stripPagestormToyboxHref(href);
  const federated = pagestormToyboxFederatedFromHref(path);
  if (federated && isPagestormToyboxEmbedService(federated)) return federated;
  return "unsupported";
}

export function isPagestormToyboxPickerHref(href: string): boolean {
  const path = stripPagestormToyboxHref(href);
  if (path === PAGESTORM_HREF || path.startsWith("/dev") || path === DEFRAGMENT_HREF) {
    return false;
  }
  const federated = pagestormToyboxFederatedFromHref(path);
  return federated != null && isPagestormToyboxEmbedService(federated);
}

export function pagestormToyboxDefaultPickerHref(): string {
  return DEFRAGMENT_FEED_SERVICE_META.this_or_that.hrefBase;
}

export function pagestormToyboxEmbedHeight(
  service: string,
  resourceType = "",
): number {
  const href = pagestormToyboxServiceHref(service);
  if (href === "/this-or-that") return 248;
  if (href === "/decisions-decisions") return 260;
  if (href === "/transfigure") {
    if (resourceType === "card") return 420;
    if (resourceType === "relic") return 448;
    return 340;
  }
  return 148;
}

export function pagestormToyboxPickFromFeedItem(
  item: DefragmentFeedItem,
): PagestormToyboxPick {
  return {
    id: item.id,
    service: pagestormToyboxServiceHref(item.service),
    userId: item.userId,
    title: item.title,
    nickname: item.nickname,
  };
}

export function pagestormToyboxJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function asPostBlocks(value: unknown): PostBlock[] {
  return Array.isArray(value) ? value as PostBlock[] : [];
}

export function pagestormTransfigurePreviewFromPost(
  post: TransfigurePost,
): PagestormTransfigurePreview {
  return {
    blocks: asPostBlocks(post.content),
    upgradedBlocks: Array.isArray(post.upgraded_content)
      ? post.upgraded_content
      : null,
    transformedName: post.transformed_name ?? "",
    transformedCost: post.transformed_cost ?? "",
    transformedStarCost: post.transformed_star_cost ?? "",
    transformedCardType: post.transformed_card_type ?? "",
    transformedCardRarity: post.transformed_card_rarity ?? "",
    transformedUpgradeCost: post.transformed_upgrade_cost ?? "",
    transformedUpgradeStarCost: post.transformed_upgrade_star_cost ?? "",
    cardTopKeywords: asStringList(post.card_top_keywords),
    cardBottomKeywords: asStringList(post.card_bottom_keywords),
    upgradedCardTopKeywords: asStringList(post.upgraded_card_top_keywords),
    upgradedCardBottomKeywords: asStringList(post.upgraded_card_bottom_keywords),
    showUpgrade: Boolean(post.show_upgrade),
    tokenColor: post.token_color ?? "",
    tokenWax: post.token_wax ?? "",
  };
}

export function parsePagestormTransfigurePreview(
  value: unknown,
): PagestormTransfigurePreview | null {
  const raw = typeof value === "string"
    ? (() => {
      if (!value || value === "null") return null;
      try {
        return JSON.parse(value) as unknown;
      } catch {
        return null;
      }
    })()
    : value;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  return {
    blocks: asPostBlocks(record.blocks),
    upgradedBlocks: Array.isArray(record.upgradedBlocks)
      ? record.upgradedBlocks as PostBlock[]
      : null,
    transformedName: typeof record.transformedName === "string"
      ? record.transformedName
      : "",
    transformedCost: typeof record.transformedCost === "string"
      ? record.transformedCost
      : "",
    transformedStarCost: typeof record.transformedStarCost === "string"
      ? record.transformedStarCost
      : "",
    transformedCardType: typeof record.transformedCardType === "string"
      ? record.transformedCardType
      : "",
    transformedCardRarity: typeof record.transformedCardRarity === "string"
      ? record.transformedCardRarity
      : "",
    transformedUpgradeCost: typeof record.transformedUpgradeCost === "string"
      ? record.transformedUpgradeCost
      : "",
    transformedUpgradeStarCost: typeof record.transformedUpgradeStarCost === "string"
      ? record.transformedUpgradeStarCost
      : "",
    cardTopKeywords: asStringList(record.cardTopKeywords),
    cardBottomKeywords: asStringList(record.cardBottomKeywords),
    upgradedCardTopKeywords: asStringList(record.upgradedCardTopKeywords),
    upgradedCardBottomKeywords: asStringList(record.upgradedCardBottomKeywords),
    showUpgrade: Boolean(record.showUpgrade),
    tokenColor: typeof record.tokenColor === "string" ? record.tokenColor : "",
    tokenWax: typeof record.tokenWax === "string" ? record.tokenWax : "",
  };
}

export function pagestormToyboxNodeAttrs(snapshot: PagestormToyboxSnapshot) {
  return {
    postId: snapshot.id,
    service: snapshot.service,
    title: snapshot.title,
    nickname: snapshot.nickname,
    leftType: snapshot.leftType,
    leftId: snapshot.leftId,
    rightType: snapshot.rightType,
    rightId: snapshot.rightId,
    rowsJson: JSON.stringify(snapshot.rows ?? []),
    placementsJson: JSON.stringify(snapshot.placements ?? []),
    poolJson: JSON.stringify(snapshot.pool ?? []),
    tokenSrc: snapshot.tokenSrc,
    transfigureJson: JSON.stringify(snapshot.transfigure ?? null),
    align: "center" as const,
    linked: true,
    width: 576,
    height: pagestormToyboxEmbedHeight(snapshot.service, snapshot.leftType),
  };
}

export function pagestormToyboxPostHref(
  service: string,
  postId: string,
  serviceLocale: ServiceLocale,
  gameLocale: GameLocale,
): string {
  const href = pagestormToyboxServiceHref(service);
  const federated = pagestormToyboxFederatedFromHref(href);
  if (!federated) {
    return href;
  }
  return defragmentOriginalHref(
    { id: postId, service: federated },
    serviceLocale,
    gameLocale,
  );
}

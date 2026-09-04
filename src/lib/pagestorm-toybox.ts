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

export type PagestormToyboxPick = {
  id: string;
  service: string;
  userId: string;
  title: string;
  nickname: string;
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
  if (path === DEFRAGMENT_HREF) return "all";
  return pagestormToyboxFederatedFromHref(path) ?? "unsupported";
}

export function isPagestormToyboxPickerHref(href: string): boolean {
  const path = stripPagestormToyboxHref(href);
  if (path === PAGESTORM_HREF || path.startsWith("/dev")) return false;
  if (path === DEFRAGMENT_HREF) return true;
  return pagestormToyboxFederatedFromHref(path) != null;
}

export function pagestormToyboxEmbedHeight(service: string): number {
  const href = pagestormToyboxServiceHref(service);
  if (href === "/this-or-that") return 320;
  if (href === "/decisions-decisions") return 280;
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
    align: "center" as const,
    linked: true,
    width: 576,
    height: pagestormToyboxEmbedHeight(snapshot.service),
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

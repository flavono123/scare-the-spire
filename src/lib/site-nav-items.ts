import { getCodexNavGameLabel } from "@/lib/codex-nav-game-labels";
import { getSts1NavLabel } from "@/lib/sts1/nav-labels";
import type { Sts1ResourceType } from "@/lib/sts1/types";
import { devToolsEnabled } from "@/lib/dev-tools";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";
import { DEBATE_TOKEN_SRC } from "@/lib/debate";
import { COLORFUL_PHILOSOPHERS_DEV_HREF } from "@/lib/colorful-philosophers";
import { PAGESTORM_TOKEN_SRC } from "@/lib/pagestorm";
import { isLatestByrdispatchNewSection } from "@/lib/toy-box-news";
import { navSeenIdForHref } from "@/lib/nav-seen";
import {
  PLACES,
  placeCodexKey,
  placeIsNew,
  placeLabel,
  placesInArea,
  type Place,
} from "@/lib/place-registry";

export type CodexLabelKey = {
  [Key in keyof typeof serviceMessages.ko.codex]:
    (typeof serviceMessages.ko.codex)[Key] extends string ? Key : never;
}[keyof typeof serviceMessages.ko.codex];

export type NavDropdownItem = {
  href: string;
  label: string;
  icon: string;
  iconClassName?: string;
  isNew?: boolean;
  attentionId?: string;
  attention?: boolean;
  /** Section heading rendered above the first item of each group. */
  group?: string;
  children?: NavDropdownItem[];
};

/** Whether the Toy Box icon should carry the new-service marker. */
export function toyBoxHasNewService(items: readonly NavDropdownItem[]): boolean {
  return items.some((item) => item.isNew);
}

export type Sts2NavItem = {
  href: string;
  labelKey: CodexLabelKey;
  icon: string;
  iconClassName?: string;
  byrdispatchSectionTitle?: string;
};

export const sts2NavItems: readonly Sts2NavItem[] = placesInArea("sts2").map((place) => {
  const labelKey = placeCodexKey(place);
  if (!labelKey) throw new Error(`place-registry.json: ${place.id} needs a codex label`);
  return {
    href: place.href,
    labelKey: labelKey as CodexLabelKey,
    icon: place.token,
    iconClassName: place.tokenClassName,
    byrdispatchSectionTitle: place.byrdispatchSectionTitle,
  };
});

export type Sts1NavItem = { href: string; type: Sts1ResourceType; icon: string };

// Cards, relics and potions keep their legacy /cards-style paths here; links rewrite them.
export const sts1NavItems: readonly Sts1NavItem[] = placesInArea("sts1").map((place) => {
  if (!("sts1" in place.label)) throw new Error(`place-registry.json: ${place.id} needs an sts1 label`);
  return { href: place.legacyHref ?? place.href, type: place.label.sts1, icon: place.token };
});

/**
 * Dev-only navbar menu grouped by purpose; within each group, ordered by
 * latest commit date touching each page (newest first). No local access-frequency data exists in `.next/dev/logs`.
 */
export const devNavItems = [
  {
    group: "서비스 개발",
    href: "/dev/editors",
    label: "에디터 모음",
    icon: PAGESTORM_TOKEN_SRC,
  },
  {
    group: "서비스 개발",
    href: COLORFUL_PHILOSOPHERS_DEV_HREF,
    label: "토론 주차 예약",
    icon: DEBATE_TOKEN_SRC,
    strictDevOnly: true,
  },
  {
    group: "서비스 개발",
    href: "/dev/vexing-puzzlebox",
    label: "짜퍼 후보",
    icon: "/images/sts2/relics/vexing_puzzlebox.webp",
  },
  {
    group: "서비스 개발",
    href: "/dev/decisions-board",
    label: "어려운 결정 보드",
    icon: "/images/sts2/powers/buffer_power.webp",
    strictDevOnly: true,
  },
  {
    group: "서비스 개발",
    href: "/dev/toybox-preview",
    label: "장난감 상자 미리보기",
    icon: "/images/sts2/powers/focus_power.webp",
    strictDevOnly: true,
  },
  {
    group: "서비스 개발",
    href: "/dev/profile",
    label: "프로필 저장 전환",
    icon: "/images/sts2/profile/unset.webp",
    strictDevOnly: true,
  },
  {
    group: "패치/운영",
    href: "/dev/combat-sim",
    label: "전투 시뮬레이터",
    icon: "/images/sts2/combat-ui/ui/draw_pile.webp",
    strictDevOnly: true,
  },
  {
    group: "패치/운영",
    href: "/dev/map-bar",
    label: "맵 진행 바 시뮬레이터",
    icon: "/images/sts2/map/icons-by-act/overgrowth/map_unknown.png",
    strictDevOnly: true,
  },
  {
    group: "패치/운영",
    href: "/dev/admin",
    label: "어드민",
    icon: "/images/sts2/nav/question_mark.png",
  },
  {
    group: "패치/운영",
    href: "/dev/patch-types",
    label: "패치노트 타입",
    icon: "/images/sts2/nav/patch_notes_icon.png",
  },
  {
    group: "패치/운영",
    href: "/dev/og-images",
    label: "OG 이미지 프리뷰",
    icon: "/images/sts2/nav/patch_notes_icon.png",
  },
  {
    group: "디자인 실험",
    href: "/dev/character-palette",
    label: "2색 배색",
    icon: "/images/sts2/characters/character_icon_ironclad.webp",
    strictDevOnly: true,
  },
  {
    group: "디자인 실험",
    href: "/dev/spire-icons",
    label: "첨탑식 아이콘 실험실",
    icon: "/images/sts2/powers/trash_to_treasure_power.webp",
    strictDevOnly: true,
  },
  {
    group: "디자인 실험",
    href: "/dev/nav-indicators",
    label: "상단바 인디케이터",
    icon: "/images/sts2/nav/patch_notes_icon.png",
    strictDevOnly: true,
  },
  {
    group: "디자인 실험",
    href: "/dev/courier-tokens",
    label: "배달원 토큰",
    icon: "/images/sts2/relics/the_courier.webp",
    strictDevOnly: true,
  },
  {
    group: "디자인 실험",
    href: "/dev/text-effects",
    label: "텍스트 효과",
    icon: "/images/sts2/nav/patch_notes_icon.png",
  },
  {
    group: "데이터 참고",
    href: "/dev/monsters",
    label: "몬스터 정리",
    icon: "/images/sts2/nav/happy_cultist.png",
  },
  {
    group: "데이터 참고",
    href: "/dev/reference",
    label: "레퍼런스",
    icon: "/images/sts2/nav/stats_cards.png",
  },
] as const;

export const serviceLanguageNavLocales = ["kor", "eng"] as const satisfies readonly GameLocale[];

export const gameOnlyLanguageNavLocales = [
  "zhs",
  "deu",
  "esp",
  "fra",
  "ita",
  "jpn",
  "pol",
  "ptb",
  "rus",
  "spa",
  "tha",
  "tur",
] as const satisfies readonly GameLocale[];

export function localizeCodexNavItems<
  T extends { href: string; labelKey: CodexLabelKey; icon: string; iconClassName?: string; byrdispatchSectionTitle?: string },
>(
  items: readonly T[],
  serviceLocale: ServiceLocale,
  gameLocale: GameLocale,
  options?: { useGameLabels?: boolean },
): NavDropdownItem[] {
  const messages = serviceMessages[serviceLocale];
  return items.map((item) => ({
    href: localizeHrefWithGameLocale(item.href, serviceLocale, gameLocale),
    label: options?.useGameLabels
      ? getCodexNavGameLabel(gameLocale, item.labelKey) ?? messages.codex[item.labelKey]
      : messages.codex[item.labelKey],
    icon: item.icon,
    iconClassName: item.iconClassName,
    // NEW until the next byrdispatch, like a new Toy Box service.
    isNew: item.byrdispatchSectionTitle ? isLatestByrdispatchNewSection(item.byrdispatchSectionTitle) : undefined,
  }));
}

export function localizePlainNavItems<
  T extends {
    href: string;
    label: string;
    icon: string;
    isNew?: boolean;
    attentionId?: string;
    group?: string;
    children?: readonly {
      href: string;
      label: string;
      icon: string;
      isNew?: boolean;
      attentionId?: string;
    }[];
  },
>(
  items: readonly T[],
  serviceLocale: ServiceLocale,
  gameLocale: GameLocale,
): NavDropdownItem[] {
  return items.map((item) => ({
    href: localizeHrefWithGameLocale(item.href, serviceLocale, gameLocale),
    label: item.label,
    icon: item.icon,
    isNew: item.isNew,
    attentionId: item.attentionId,
    group: item.group,
    children: item.children
      ? localizePlainNavItems(item.children, serviceLocale, gameLocale)
      : undefined,
  }));
}

export function sts1NavDropdownItems(gameLocale: GameLocale): NavDropdownItem[] {
  return sts1NavItems.map((item) => ({
    href: item.href,
    label: getSts1NavLabel(gameLocale, item.type),
    icon: item.icon,
  }));
}

/** Toy Box services and the Vexing Puzzlebox hub, newest first, children under their parent. */
export function getToyBoxNavItems({
  serviceLocale,
  gameLocale,
}: {
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}): NavDropdownItem[] {
  const visible = PLACES.filter((place) => place.area === "toybox" || (place.area === "zzapper" && place.kind === "hub"));
  const newestFirst = (left: Place, right: Place) => (right.createdAt ?? "").localeCompare(left.createdAt ?? "");
  const childrenByParent = new Map<string, Place[]>();
  for (const place of visible) {
    if (!place.parent) continue;
    const group = childrenByParent.get(place.parent) ?? [];
    group.push(place);
    childrenByParent.set(place.parent, group);
  }

  const serviceItems = visible
    .filter((place) => !place.parent)
    .toSorted(newestFirst)
    .flatMap((place) => {
      const children = (childrenByParent.get(place.id) ?? []).toSorted(newestFirst);
      const listedChildren = children.filter((child) => !child.menuHidden);
      return [
        {
          href: place.href,
          label: placeLabel(place, serviceLocale, gameLocale),
          icon: place.token,
          isNew: placeIsNew(place) || children.some((child) => child.menuHidden && placeIsNew(child)),
          attentionId: navSeenIdForHref(place.href) ?? undefined,
        },
        ...listedChildren.map((child) => ({
          href: child.href,
          label: placeLabel(child, serviceLocale, gameLocale),
          icon: child.token,
          isNew: placeIsNew(child),
          attentionId: navSeenIdForHref(child.href) ?? undefined,
        })),
      ];
    });

  return localizePlainNavItems(serviceItems, serviceLocale, gameLocale);
}

/** Items for the dev-only navbar menu; empty when dev tools are disabled. */
export function getDevNavItems({
  serviceLocale,
  gameLocale,
}: {
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}): NavDropdownItem[] {
  if (!devToolsEnabled()) return [];
  return localizePlainNavItems(
    devNavItems.filter(
      (item) => !("strictDevOnly" in item) || process.env.NODE_ENV === "development",
    ),
    serviceLocale,
    gameLocale,
  );
}

import { getCodexNavGameLabel } from "@/lib/codex-nav-game-labels";
import {
  getDecisionsDecisionsNavTitle,
  getDefragmentNavTitle,
  getPagestormNavTitle,
  getTransfigureNavTitle,
} from "@/lib/borrowed-game-copy";
import {
  ASCENSION_TOKEN_IMAGE_URL,
  CHARACTER_CARDS_MODIFIER_IMAGE_URL,
} from "@/lib/codex-types";
import { DECISIONS_DECISIONS_TOKEN_SRC } from "@/lib/decisions-decisions";
import {
  FAVORITE_TOURNAMENT_HREF,
  FAVORITE_TOURNAMENT_TOKEN_SRC,
} from "@/lib/favorite-tournament";
import { devToolsEnabled } from "@/lib/dev-tools";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";
import { PAGESTORM_HREF, PAGESTORM_TOKEN_SRC } from "@/lib/pagestorm";
import { isLatestByrdispatchNewSection } from "@/lib/toy-box-news";

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
  children?: NavDropdownItem[];
};

type ToyBoxServiceDefinition = {
  href: string;
  icon: string;
  createdAt: string;
  byrdispatchSectionTitle?: string;
  devOnly?: boolean;
  nestedUnder?: string;
  /** Tab of the parent service; omitted from the Toy Box dropdown. */
  dropdownHidden?: boolean;
  getLabel: (
    serviceLocale: ServiceLocale,
    gameLocale: GameLocale,
  ) => string;
};

function toyBoxServiceIsNew(service: ToyBoxServiceDefinition): boolean {
  return Boolean(
    service.byrdispatchSectionTitle
    && isLatestByrdispatchNewSection(service.byrdispatchSectionTitle),
  );
}

const TOY_BOX_SERVICE_DEFINITIONS: readonly ToyBoxServiceDefinition[] = [
  {
    href: "/defragment",
    icon: "/images/sts2/powers/focus_power.webp",
    createdAt: "2026-08-20",
    byrdispatchSectionTitle: "조각모음",
    getLabel: (_serviceLocale, gameLocale) => getDefragmentNavTitle(gameLocale),
  },
  {
    href: "/transfigure",
    icon: "/images/sts2/relics/astrolabe.webp",
    createdAt: "2026-07-26",
    getLabel: (_serviceLocale, gameLocale) => getTransfigureNavTitle(gameLocale),
  },
  {
    href: "/c-c-c-combo",
    icon: "/images/sts2/badges/ccccombo.webp",
    createdAt: "2026-07-24",
    byrdispatchSectionTitle: "코오오옴보",
    getLabel: (serviceLocale) => serviceMessages[serviceLocale].nav.combo,
  },
  {
    href: "/this-or-that",
    icon: "/images/sts2/relics/choices_paradox.webp",
    createdAt: "2026-07-09",
    byrdispatchSectionTitle: "이거 아님 저거?",
    getLabel: (serviceLocale) => serviceMessages[serviceLocale].nav.thisOrThat,
  },
  {
    href: FAVORITE_TOURNAMENT_HREF,
    icon: FAVORITE_TOURNAMENT_TOKEN_SRC,
    createdAt: "2026-08-29",
    nestedUnder: "/this-or-that",
    dropdownHidden: true,
    byrdispatchSectionTitle: "이아저? 월드컵",
    getLabel: (serviceLocale) => serviceMessages[serviceLocale].nav.favoriteTournament,
  },
  {
    href: "/history-course",
    icon: "/images/sts2/relics/history_course.webp",
    createdAt: "2026-06-18",
    byrdispatchSectionTitle: "역사 강의서",
    getLabel: (serviceLocale, gameLocale) => (
      getCodexNavGameLabel(gameLocale, "historyCourse")
      ?? serviceMessages[serviceLocale].nav.historyCourse
    ),
  },
  {
    href: "/chemical-x",
    icon: "/images/sts2/relics/chemical_x.webp",
    createdAt: "2026-04-15",
    getLabel: (serviceLocale) => serviceMessages[serviceLocale].nav.chemicalX,
  },
  {
    href: "/decisions-decisions",
    icon: DECISIONS_DECISIONS_TOKEN_SRC,
    createdAt: "2026-08-26",
    nestedUnder: "/defragment",
    byrdispatchSectionTitle: "어려운 결정",
    getLabel: (_serviceLocale, gameLocale) => getDecisionsDecisionsNavTitle(gameLocale),
  },
  {
    href: PAGESTORM_HREF,
    icon: PAGESTORM_TOKEN_SRC,
    createdAt: "2026-09-01",
    nestedUnder: "/defragment",
    getLabel: (_serviceLocale, gameLocale) => getPagestormNavTitle(gameLocale),
  },
] as const;

export const sts2NavItems = [
  { href: "/compendium/characters", labelKey: "characters", icon: "/images/sts2/characters/character_icon_ironclad.webp" },
  { href: "/compendium/cards", labelKey: "cards", icon: "/images/sts2/nav/stats_cards.png" },
  { href: "/compendium/relics", labelKey: "relics", icon: "/images/sts2/relics/bing_bong.webp" },
  { href: "/compendium/potions", labelKey: "potions", icon: "/images/sts2/potions/potion_shaped_rock.webp" },
  { href: "/compendium/powers", labelKey: "powers", icon: "/images/sts2/nav/unmovable_power_beta.webp" },
  { href: "/compendium/enchantments", labelKey: "enchantments", icon: "/images/sts2/enchantments/souls_power.webp" },
  { href: "/compendium/bestiary", labelKey: "monsters", icon: "/images/sts2/nav/happy_cultist.png" },
  { href: "/compendium/events", labelKey: "events", icon: "/images/sts2/nav/question_mark.png" },
  { href: "/compendium/ancients", labelKey: "ancients", icon: "/images/sts2/nav/stats_ancients.png" },
  { href: "/compendium/epochs", labelKey: "epochs", icon: "/images/sts2/relics/planisphere.webp" },
  { href: "/compendium/keywords", labelKey: "keywords", icon: "/images/sts2/ui/topbar/submenu_history_icon.png" },
  { href: "/compendium/badges", labelKey: "badges", icon: "/images/sts2/badges/double_snecko.webp" },
  { href: "/compendium/ascensions", labelKey: "ascensions", icon: ASCENSION_TOKEN_IMAGE_URL, iconClassName: "h-4 w-[14px]" },
  { href: "/compendium/modifiers", labelKey: "modifiers", icon: CHARACTER_CARDS_MODIFIER_IMAGE_URL },
] as const;

export const sts1NavItems = [
  { href: "/cards", labelKey: "cards", icon: "/images/sts2/nav/stats_cards.png" },
  { href: "/relics", labelKey: "relics", icon: "/images/sts2/relics/snecko_eye.webp" },
  { href: "/potions", labelKey: "potions", icon: "/images/sts2/nav/stats_potions.png" },
] as const;

export const devNavItems = [
  { href: "/dev/admin", label: "어드민", icon: "/images/sts2/nav/question_mark.png" },
  { href: "/dev/monsters", label: "몬스터 정리", icon: "/images/sts2/nav/happy_cultist.png" },
  { href: "/dev/og-images", label: "OG 이미지 프리뷰", icon: "/images/sts2/nav/patch_notes_icon.png" },
  {
    href: "/dev/spire-icons",
    label: "첨탑식 아이콘 실험실",
    icon: "/images/sts2/powers/trash_to_treasure_power.webp",
    strictDevOnly: true,
  },
  {
    href: "/dev/character-palette",
    label: "캐릭터 배색",
    icon: "/images/sts2/characters/character_icon_ironclad.webp",
    strictDevOnly: true,
  },
  { href: "/dev/text-effects", label: "텍스트 효과", icon: "/images/sts2/nav/patch_notes_icon.png" },
  { href: "/dev/reference", label: "레퍼런스", icon: "/images/sts2/nav/stats_cards.png" },
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

export function localizeCodexNavItems<T extends { href: string; labelKey: CodexLabelKey; icon: string; iconClassName?: string }>(
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
  }));
}

export function localizePlainNavItems<
  T extends {
    href: string;
    label: string;
    icon: string;
    isNew?: boolean;
    children?: readonly {
      href: string;
      label: string;
      icon: string;
      isNew?: boolean;
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
    children: item.children
      ? localizePlainNavItems(item.children, serviceLocale, gameLocale)
      : undefined,
  }));
}

export function legacySts1NavItems<T extends { href: string; labelKey: CodexLabelKey; icon: string }>(
  items: readonly T[],
  serviceLocale: ServiceLocale,
): NavDropdownItem[] {
  const messages = serviceMessages[serviceLocale];
  return items.map((item) => ({
    href: item.href,
    label: messages.codex[item.labelKey],
    icon: item.icon,
  }));
}

export function getToyBoxNavItems({
  serviceLocale,
  gameLocale,
}: {
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}): NavDropdownItem[] {
  const showDevMenu = devToolsEnabled();
  const visible = TOY_BOX_SERVICE_DEFINITIONS
    .filter((service) => showDevMenu || !service.devOnly);
  const nestedByParent = new Map<string, ToyBoxServiceDefinition[]>();
  for (const service of visible) {
    if (!service.nestedUnder) continue;
    const group = nestedByParent.get(service.nestedUnder) ?? [];
    group.push(service);
    nestedByParent.set(service.nestedUnder, group);
  }

  const serviceItems = visible
    .filter((service) => !service.nestedUnder)
    .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))
    .flatMap((service) => {
      const nested = (nestedByParent.get(service.href) ?? [])
        .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt));
      const dropdownChildren = nested.filter((child) => !child.dropdownHidden);
      return [
        {
          href: service.href,
          label: service.getLabel(serviceLocale, gameLocale),
          icon: service.icon,
          isNew: toyBoxServiceIsNew(service)
            || nested.some((child) => child.dropdownHidden && toyBoxServiceIsNew(child)),
        },
        ...dropdownChildren.map((child) => ({
          href: child.href,
          label: child.getLabel(serviceLocale, gameLocale),
          icon: child.icon,
          isNew: toyBoxServiceIsNew(child),
        })),
      ];
    });

  return localizePlainNavItems(
    [
      ...serviceItems,
      ...(showDevMenu
        ? devNavItems.filter(
            (item) => !("strictDevOnly" in item) || process.env.NODE_ENV === "development",
          )
        : []),
    ],
    serviceLocale,
    gameLocale,
  );
}

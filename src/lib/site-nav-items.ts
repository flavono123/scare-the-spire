import { getCodexNavGameLabel } from "@/lib/codex-nav-game-labels";
import { getTransfigureNavTitle } from "@/lib/borrowed-game-copy";
import { devToolsEnabled } from "@/lib/dev-tools";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";
import { isLatestByrdispatchNewSection } from "@/lib/toy-box-news";

export type CodexLabelKey = {
  [Key in keyof typeof serviceMessages.ko.codex]:
    (typeof serviceMessages.ko.codex)[Key] extends string ? Key : never;
}[keyof typeof serviceMessages.ko.codex];

export type NavDropdownItem = {
  href: string;
  label: string;
  icon: string;
  isNew?: boolean;
};

type ToyBoxServiceDefinition = {
  href: string;
  icon: string;
  createdAt: string;
  byrdispatchSectionTitle?: string;
  devOnly?: boolean;
  getLabel: (
    serviceLocale: ServiceLocale,
    gameLocale: GameLocale,
  ) => string;
};

const TOY_BOX_SERVICE_DEFINITIONS: readonly ToyBoxServiceDefinition[] = [
  {
    href: "/transfigure",
    icon: "/images/sts2/relics/astrolabe.webp",
    createdAt: "2026-07-26",
    byrdispatchSectionTitle: "변형",
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
  { href: "/compendium/badges", labelKey: "badges", icon: "/images/sts2/badges/ccccombo.webp" },
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

export function localizeCodexNavItems<T extends { href: string; labelKey: CodexLabelKey; icon: string }>(
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
  }));
}

export function localizePlainNavItems<
  T extends { href: string; label: string; icon: string; isNew?: boolean },
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
  const serviceItems = TOY_BOX_SERVICE_DEFINITIONS
    .filter((service) => showDevMenu || !service.devOnly)
    .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((service) => ({
      href: service.href,
      label: service.getLabel(serviceLocale, gameLocale),
      icon: service.icon,
      isNew: service.byrdispatchSectionTitle
        ? isLatestByrdispatchNewSection(service.byrdispatchSectionTitle)
        : false,
    }));

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

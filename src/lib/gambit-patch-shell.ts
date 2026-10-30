import type { ServiceLocale } from "@/lib/i18n";

/** Title-row token: the power that 포석 leaves on the player. */
export const GAMBIT_TITLE_TOKEN = {
  src: "/images/sts2/powers/the_gambit_power.webp",
  alt: { ko: "포석", en: "The Gambit" },
  localeKey: "THE_GAMBIT_POWER.title",
} as const;

/**
 * Hero borrows THE_GAMBIT.description: the two weeks bought before the
 * November 12 patch stand in for the Block, and a bad patch is the
 * unblocked hit.
 */
export const GAMBIT_PATCH_HERO: Record<ServiceLocale, string> = {
  ko: "시간을 2주 벌었습니다. 11월 12일 패치가 똥패치라면, 죽습니다.",
  en: "Bought 2 weeks of time. If the November 12 patch is a dud, die.",
};

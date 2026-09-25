import type { ServiceLocale } from "@/lib/i18n";

/** Title-row token: the power that puts 시듦 into hand. */
export const WITHER_TITLE_TOKEN = {
  src: "/images/sts2/powers/withering_presence_power.webp",
  alt: { ko: "시들어가는 존재", en: "Withering Presence" },
  localeKey: "WITHERING_PRESENCE_POWER.title",
} as const;

/**
 * Hero borrows WITHER.description: Friday's patch stands in for the card,
 * and the hand check is inverted. Damage stays 3 from the extracted card.
 */
export const WITHER_PATCH_HERO: Record<ServiceLocale, string> = {
  ko: "금요일에 패치가 [gold]손[/gold]에 없다면, 피해를 3 받습니다.",
  en: "On Friday, if the patch is not in your [gold]Hand[/gold], take 3 damage.",
};

export const WITHER_PATCH_CARD_CLASS =
  "block rounded-lg border border-zinc-700 bg-black p-4 shadow-[inset_0_0_48px_rgba(255,255,255,0.04)] transition-colors hover:border-zinc-500";

export const WITHER_PATCH_TITLE_CLASS =
  "font-game-title font-bold min-w-0 text-zinc-100";

export const WITHER_PATCH_HERO_CLASS = "text-sm font-medium text-zinc-400";

export const WITHER_PATCH_DATE_CLASS = "text-xs text-zinc-500";

export const WITHER_PATCH_RECOMMENDATIONS = [
  {
    role: "칩 뱃지",
    chosen: true,
    nameKo: "감쇠",
    nameEn: "Ebb",
    src: "/images/sts2/powers/ebb_power.webp",
    locale: "EBB — v0.107.0에서 제거된 디버프. 이번 턴에 힘 3, 민첩 3을 잃습니다.",
  },
  {
    role: "타이틀 토큰",
    chosen: true,
    nameKo: "시들어가는 존재",
    nameEn: "Withering Presence",
    src: "/images/sts2/powers/withering_presence_power.webp",
    locale: "WITHERING_PRESENCE_POWER — 카드를 6장 사용할 때마다 시듦을 1장 손으로 가져옵니다.",
  },
  {
    role: "히어로",
    chosen: true,
    nameKo: "시듦",
    nameEn: "Wither",
    src: "/images/sts2/cards/wither1.webp",
    locale: "WITHER.description 차용 — 금요일에 패치가 손에 없다면, 피해를 3 받습니다.",
  },
  {
    role: "후보 토큰",
    chosen: false,
    nameKo: "잿빛 혼령",
    nameEn: "Spirit of Ash",
    src: "/images/sts2/powers/spirit_of_ash_power.webp",
    locale: "SPIRIT_OF_ASH_POWER — 휘발성 카드를 사용할 때마다 방어도를 4 얻습니다.",
  },
] as const;

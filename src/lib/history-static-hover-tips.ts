import engTips from "../../data/sts2/localization/eng/static_hover_tips.json";
import korTips from "../../data/sts2/localization/kor/static_hover_tips.json";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";

const BY_LOCALE = {
  kor: korTips as Record<string, string>,
  eng: engTips as Record<string, string>,
} as const;

function catalogLocale(locale: GameLocale | ServiceLocale): "kor" | "eng" {
  return locale === "eng" || locale === "en" ? "eng" : "kor";
}

export function historyStaticHoverTip(
  id: string,
  locale: GameLocale | ServiceLocale = "kor",
): { title: string; description: string } {
  const table = BY_LOCALE[catalogLocale(locale)];
  const fallback = BY_LOCALE.eng;
  return {
    title: table[`${id}.title`] ?? fallback[`${id}.title`] ?? id,
    description: table[`${id}.description`] ?? fallback[`${id}.description`] ?? "",
  };
}

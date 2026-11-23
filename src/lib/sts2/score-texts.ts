import korGameOver from "../../../data/sts2/localization/kor/game_over_screen.json";
import engGameOver from "../../../data/sts2/localization/eng/game_over_screen.json";
import type { ServiceLocale } from "@/lib/i18n";
import type { Sts2ScoreLineKey } from "./score";

/** game_over_screen texts: SCORE_LINE templates ("오른 층: {FloorCount}") and the banners. */
export type Sts2ScoreTexts = {
  lines: Record<Sts2ScoreLineKey, string>;
  win: string;
  lose: string;
};

function texts(table: Record<string, string>): Sts2ScoreTexts {
  const text = (key: string) => table[key] ?? key;
  return {
    lines: {
      floorsClimbed: text("SCORE_LINE.floorsClimbed"),
      goldGained: text("SCORE_LINE.goldGained"),
      elitesKilled: text("SCORE_LINE.elitesKilled"),
      bossesSlain: text("SCORE_LINE.bossesSlain"),
      ascension: text("SCORE_LINE.ascension"),
      dread: text("SCORE_LINE.dread"),
    },
    win: text("BANNER.trueWin"),
    lose: text("BANNER.lose2"),
  };
}

const BY_LOCALE: Record<ServiceLocale, Sts2ScoreTexts> = {
  ko: texts(korGameOver as Record<string, string>),
  en: texts(engGameOver as Record<string, string>),
};

/** The game-over screen's score wording in the service language (the history course and score page share it). */
export function sts2ScoreTexts(serviceLocale: ServiceLocale): Sts2ScoreTexts {
  return BY_LOCALE[serviceLocale];
}

export const STS2_SCORE_ICONS: Record<Sts2ScoreLineKey, string> = {
  floorsClimbed: "/images/sts2/ui/game_over_screen/score_floor.webp",
  goldGained: "/images/sts2/ui/game_over_screen/score_gold.webp",
  elitesKilled: "/images/sts2/ui/game_over_screen/score_elite.webp",
  bossesSlain: "/images/sts2/ui/game_over_screen/score_boss.webp",
  ascension: "/images/sts2/ui/game_over_screen/score_ascension.webp",
  dread: "/images/sts2/ui/game_over_screen/score_dread.webp",
};

/** "오른 층: {FloorCount}" -> "오른 층" (a rule) or with the count filled (a result line). */
export function sts2ScoreLineLabel(template: string, count?: number): string {
  return count === undefined
    ? template.replace(/\s*[:：]?\s*\{[A-Za-z]+\}\s*/g, "").trim()
    : template.replace(/\{[A-Za-z]+\}/g, String(count));
}

import type { Metadata } from "next";
import { Sts2RunScoreLoader, Sts2ScoreCalculator, type Sts2ScoreTexts } from "@/components/codex/score-calculator";
import { getCodexMetadata } from "@/lib/codex-service";
import { readGameLocalizationTable } from "@/lib/game-localization";
import { getGameLocaleFromSearchRecord, getServiceLocaleFromSearchRecord, type GameLocale } from "@/lib/i18n";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const TITLE = { ko: "점수", en: "Score" } as const;

async function scoreTexts(gameLocale: GameLocale): Promise<Sts2ScoreTexts> {
  const table = await readGameLocalizationTable(gameLocale, "game_over_screen");
  const text = (key: string) => String(table[key] ?? key);
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

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const serviceLocale = getServiceLocaleFromSearchRecord(await searchParams);
  return getCodexMetadata(serviceLocale, TITLE[serviceLocale], "/compendium/score");
}

export default async function CodexScorePage({ searchParams }: PageProps) {
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const texts = await scoreTexts(getGameLocaleFromSearchRecord(resolved));
  return (
    <main className="px-4 py-6 sm:px-6">
      <h1 className="mx-auto mb-4 max-w-6xl font-game-title text-2xl font-bold text-primary">{TITLE[serviceLocale]}</h1>
      <Sts2RunScoreLoader texts={texts} serviceLocale={serviceLocale} />
      <Sts2ScoreCalculator texts={texts} serviceLocale={serviceLocale} />
    </main>
  );
}

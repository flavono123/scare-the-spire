"use client";

import { RichText } from "@/components/rich-text";
import { Sts2ScoreBreakdown } from "@/components/codex/score-calculator";
import { RunBadgeStrip } from "@/components/history-course/run-badge-strip";
import { gameOverFalseWinLabel, gameOverLoseBanner, gameOverQuote, gameOverVictoryDamage } from "@/lib/game-over-copy";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { sts2RunBadges, sts2RunFileFromReplay, sts2RunScore } from "@/lib/sts2/run-score";
import { sts2ScoreTexts } from "@/lib/sts2/score-texts";
import type { ReplayRun } from "@/lib/sts2-run-replay";
import { cn } from "@/lib/utils";

/** Beats of NGameOverScreen: banner + quote, then each score line, then the badges, then the total. */
// Six lines at most + badges + total fit GAME_OVER_SCREEN_MS (6s) with a beat to read them.
const GAME_OVER_BANNER_MS = 900;
const GAME_OVER_LINE_MS = 450;

/**
 * The game-over screen for one player: the banner (BANNER.falseWin on a win, a BANNER.lose roll otherwise), the
 * death quote or victory text, the score lines in AnimateScoreLines order, the badges GetBadges gives, and the total.
 * `localMs` drives the reveal like the game's tweens; the unlock bar is left out (it reads the progress file).
 */
export function HistoryGameOverScreen({
  run,
  playerId,
  localMs,
  cause,
  salt,
  gameLocale,
  serviceLocale,
}: {
  run: ReplayRun;
  playerId?: number;
  localMs: number;
  cause?: string;
  salt: number;
  gameLocale: GameLocale;
  serviceLocale: ServiceLocale;
}) {
  const file = sts2RunFileFromReplay(run);
  const score = sts2RunScore(file, playerId);
  const badges = playerId === undefined ? [] : sts2RunBadges(file, playerId);
  const texts = sts2ScoreTexts(serviceLocale);
  const shownLines = Math.max(0, Math.floor((localMs - GAME_OVER_BANNER_MS) / GAME_OVER_LINE_MS) + 1);
  const linesDone = shownLines > score.lines.length;
  const badgesShown = linesDone && shownLines > score.lines.length + 1;
  const totalShown = badgesShown && shownLines > score.lines.length + 2;
  return (
    <div className="flex w-full flex-col items-center gap-3" data-history-game-over={run.win ? "win" : "lose"} data-history-game-over-score={score.total}>
      <div className={cn("font-game-title text-3xl [text-shadow:0_2px_0_#000]", run.win ? "text-[#efc851]" : "rich-jitter text-red-100")}>
        {run.win ? gameOverFalseWinLabel(gameLocale) : gameOverLoseBanner(gameLocale, salt)}
      </div>
      {run.win ? (
        <div className="text-center font-game-text text-sm text-zinc-100">
          <RichText text={gameOverVictoryDamage(gameLocale, score.total)} />
        </div>
      ) : (
        <>
          {cause ? <div className="font-game-text text-sm text-zinc-100">{cause}</div> : null}
          <div className="font-game-text text-xs text-zinc-300">{gameOverQuote(gameLocale, salt + 3)}</div>
        </>
      )}
      <div className={cn("w-full transition-opacity duration-300", shownLines > 0 ? "opacity-100" : "opacity-0")}>
        <Sts2ScoreBreakdown
          lines={score.lines.slice(0, shownLines)}
          total={score.total}
          texts={texts}
          totalLabel={serviceLocale === "ko" ? "점수" : "Score"}
          hideTotal={!totalShown}
        />
      </div>
      {badgesShown && badges.length ? <RunBadgeStrip badges={badges} serviceLocale={serviceLocale} size="lg" className="justify-center" /> : null}
    </div>
  );
}

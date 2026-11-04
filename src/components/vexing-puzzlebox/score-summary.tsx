"use client";

import Link from "next/link";
import Image from "@/components/ui/static-image";
import { displayItemLabels, hasLocalNames } from "@/components/vexing-puzzlebox/display-toggles";
import type { PuzzleboxSubmitResult } from "@/hooks/use-puzzlebox-scores";
import { GAME_LOCALE_LABELS, localizeHrefWithGameLocale, type GameLocale, type ServiceLocale } from "@/lib/i18n";
import { RANKINGS_TOKEN_SRC, VEXING_PUZZLEBOX_RANKINGS_HREF } from "@/lib/vexing-puzzlebox";
import type { RunDisplay, ScoreBreakdown, ScorePart } from "@/lib/vexing-puzzlebox-score";
import type { LocalBestScore } from "@/lib/vexing-puzzlebox-storage";
import { serviceMessages } from "@/messages/service";

export type ScoreSubmission = {
  board: number;
  pending: boolean;
  result: PuzzleboxSubmitResult | null;
};

/** Parts worth a line: the base always, everything else when it moved the score. */
function visibleParts(parts: ScorePart[]): ScorePart[] {
  return parts.filter((part) => part.id === "groups" || part.id === "correct" || part.points !== 0);
}

/** What the display points were for, by the toggles' own names: 숨긴 그림/영어. */
function hiddenDisplayLabel(hidden: RunDisplay, gameLocale: GameLocale, serviceLocale: ServiceLocale): string {
  const copy = serviceMessages[serviceLocale].vexingPuzzlebox;
  const names = displayItemLabels(gameLocale, serviceLocale)
    .filter((item) => hidden[item.id])
    .map((item) => item.label);
  const labels = names.length > 0 ? [copy.scoreParts.display.replace("{items}", names.join("/"))] : [];
  // English has one name only, so its share for a hidden second name is always earned.
  if (!hasLocalNames(gameLocale) && hidden.local) {
    labels.push(copy.scoreOneName.replace("{name}", GAME_LOCALE_LABELS.eng[serviceLocale]));
  }
  return labels.join(" · ");
}

function partLabel(part: ScorePart, gameLocale: GameLocale, serviceLocale: ServiceLocale): string {
  if (part.id === "display" && part.hidden) return hiddenDisplayLabel(part.hidden, gameLocale, serviceLocale);
  return serviceMessages[serviceLocale].vexingPuzzlebox.scoreParts[part.id].replace("{count}", String(part.count));
}

/** A finished run's score, how it adds up, the best so far, and the server's rank once it answers. */
export function ScoreSummary({
  breakdown,
  best,
  submission,
  rankingsQuery,
  serviceLocale,
  gameLocale,
}: {
  breakdown: ScoreBreakdown;
  best: LocalBestScore | undefined;
  submission: ScoreSubmission | null;
  rankingsQuery: string;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  const copy = serviceMessages[serviceLocale].vexingPuzzlebox;
  const result = submission?.result ?? null;
  const bestScore = Math.max(best?.best ?? 0, result?.best ?? 0, breakdown.total);
  const newBest = result ? result.improved && result.attempt > 1 : false;
  return (
    <div className="mx-auto mt-3 w-full max-w-xs" data-puzzlebox-score={breakdown.total}>
      <p className="flex items-baseline justify-center gap-1">
        <span className="font-game-title text-4xl font-bold tabular-nums spire-gold">{breakdown.total}</span>
        <span className="text-sm text-muted-foreground">{copy.scoreUnit}</span>
      </p>
      <dl className="mt-2 space-y-0.5 text-xs">
        {visibleParts(breakdown.parts).map((part) => (
          <div key={part.id} className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-0.5">
            <dt className="text-muted-foreground">{partLabel(part, gameLocale, serviceLocale)}</dt>
            <dd className={`tabular-nums ${part.points < 0 ? "text-red-400" : part.id === "groups" || part.id === "correct" ? "" : "text-green-400"}`}>
              {part.points > 0 && part.id !== "groups" && part.id !== "correct" ? "+" : ""}
              {part.points}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs">
        {bestScore > breakdown.total && (
          <span className="text-muted-foreground">{copy.bestScore.replace("{score}", String(bestScore))}</span>
        )}
        {newBest && <span className="font-semibold text-green-400">{copy.newBest}</span>}
        {submission?.pending && <span className="text-muted-foreground">{copy.submitting}…</span>}
        {result && (
          <span className="font-semibold" data-puzzlebox-rank={result.rank}>
            {copy.rankLine.replace("{rank}", String(result.rank)).replace("{players}", String(result.players))}
          </span>
        )}
        <Link
          href={`${localizeHrefWithGameLocale(VEXING_PUZZLEBOX_RANKINGS_HREF, serviceLocale, gameLocale)}?${rankingsQuery}`}
          prefetch={false}
          className="inline-flex items-center gap-1 spire-blue transition-colors hover:text-blue-300"
        >
          <Image src={RANKINGS_TOKEN_SRC} alt="" width={16} height={16} className="h-4 w-4 object-contain" />
          {copy.viewRankings} &rarr;
        </Link>
      </p>
    </div>
  );
}

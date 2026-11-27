"use client";

import { useEffect, useState } from "react";
import StaticImage from "@/components/ui/static-image";
import { gameOverLoseBanner, gameOverQuote } from "@/lib/game-over-copy";
import type { ScoreLine } from "@/lib/blank-card";
import { cn } from "@/lib/utils";

/** Beats of HistoryGameOverScreen (NGameOverScreen): the banner, then one score line at a time, then the total. */
const BANNER_MS = 900;
const LINE_MS = 450;

export function BlankCardScoreBoard({
  solved,
  answerName,
  lines,
  total,
  iconFor,
  salt,
}: {
  solved: boolean;
  answerName: string;
  lines: ScoreLine[];
  total: number;
  iconFor: (line: ScoreLine) => string;
  salt: number;
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const timers = Array.from({ length: lines.length + 1 }, (_, i) =>
      window.setTimeout(() => setShown(i + 1), BANNER_MS + i * LINE_MS));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [lines.length]);

  return (
    <div className="flex w-full flex-col items-center gap-2 rounded-lg border border-zinc-700 bg-black/60 p-4" data-blank-card-score={total}>
      <div className={cn("font-game-title text-3xl [text-shadow:0_2px_0_#000]", solved ? "text-[#efc851]" : "rich-jitter text-red-100")}>
        {solved ? answerName : gameOverLoseBanner("kor", salt)}
      </div>
      {!solved && (
        <>
          <div className="font-game-text text-sm text-zinc-100">{answerName}</div>
          <div className="font-game-text text-xs text-zinc-300">{gameOverQuote("kor", salt + 3)}</div>
        </>
      )}
      <ul className="mt-1 w-full space-y-1">
        {lines.slice(0, shown).map((line) => (
          <li key={line.key} className="blank-card-score-line flex items-center gap-2 text-sm text-gray-200">
            <StaticImage src={iconFor(line)} alt="" width={48} height={48} className="h-6 w-6 object-contain" />
            <span className="min-w-0 flex-1 truncate">
              {line.label}{line.count !== undefined ? ` ×${line.count}` : ""}
            </span>
            <span className={cn("font-game-title", line.value < 0 ? "text-red-400" : "text-[#efc851]")}>
              {line.value > 0 ? "+" : ""}{line.value}
            </span>
          </li>
        ))}
      </ul>
      <div
        className={cn(
          "w-full border-t border-white/10 pt-2 text-right font-game-title text-2xl text-[#efc851]",
          shown > lines.length ? "" : "invisible",
        )}
      >
        점수: {total}
      </div>
    </div>
  );
}

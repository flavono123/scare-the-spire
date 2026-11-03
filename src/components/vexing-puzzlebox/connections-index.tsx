"use client";

import type { ServiceLocale } from "@/lib/i18n";
import type { ConnectionsProgress } from "@/lib/vexing-puzzlebox-storage";
import type { ConnectionsPuzzle } from "@/lib/vexing-puzzlebox-types";
import { serviceMessages } from "@/messages/service";

const MISTAKE_LIMIT = 4;
/** Solved group swatches in the level colors the board uses. */
const LEVEL_SWATCH = ["bg-amber-300", "bg-green-400", "bg-sky-400", "bg-violet-400"];

export type ConnectionsStatus = "new" | "playing" | "solved" | "failed";

export function connectionsStatus(progress: ConnectionsProgress | undefined, groups: number): ConnectionsStatus {
  if (!progress || (progress.guesses.length === 0 && progress.mistakes === 0)) return "new";
  if (progress.solvedLevels.length === groups) return "solved";
  if (progress.mistakes >= MISTAKE_LIMIT) return "failed";
  return "playing";
}

export function issueMonth(date: string | null, serviceLocale: ServiceLocale): string {
  if (!date) return "";
  return new Intl.DateTimeFormat(serviceLocale === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

/** Every puzzle, newest first, with its issue month, game, and how far the player got. */
export function ConnectionsIndex({
  puzzles,
  records,
  currentNumber,
  serviceLocale,
  onOpen,
}: {
  puzzles: ConnectionsPuzzle[];
  records: Record<string, ConnectionsProgress>;
  currentNumber: number;
  serviceLocale: ServiceLocale;
  onOpen: (number: number) => void;
}) {
  const copy = serviceMessages[serviceLocale].vexingPuzzlebox;
  const statusLabel: Record<ConnectionsStatus, string> = {
    new: copy.statusNew,
    playing: copy.statusPlaying,
    solved: copy.statusSolved,
    failed: copy.statusFailed,
  };
  const latest = puzzles[0]?.number;
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" data-connections-index={puzzles.length}>
      {puzzles.map((puzzle) => {
        const progress = records[puzzle.number];
        const status = connectionsStatus(progress, puzzle.categories.length);
        return (
          <li key={puzzle.number}>
            <button
              type="button"
              onClick={() => onOpen(puzzle.number)}
              data-connections-status={status}
              className={`flex w-full flex-col gap-1.5 rounded-lg border p-2.5 text-left transition-colors hover:border-primary/60 ${
                puzzle.number === currentNumber
                  ? "border-primary/70 bg-primary/10"
                  : status === "new"
                    ? "border-border bg-card/70"
                    : "border-border bg-card/90"
              }`}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-game-title text-lg font-bold tabular-nums">#{puzzle.number}</span>
                <span className="flex items-center gap-1 text-[10px]">
                  {puzzle.number === latest && (
                    <span className="rounded bg-primary/20 px-1 py-0.5 font-semibold text-primary">{copy.latestPuzzle}</span>
                  )}
                  <span
                    className={`rounded px-1 py-0.5 font-semibold ${
                      puzzle.era === "sts1" ? "bg-red-500/15 text-red-300" : "bg-sky-500/15 text-sky-300"
                    }`}
                  >
                    {puzzle.era.toUpperCase()}
                  </span>
                </span>
              </span>
              <span className="text-xs text-muted-foreground">{issueMonth(puzzle.issueDate, serviceLocale)}</span>
              <span className="flex items-center justify-between gap-2">
                <span className="flex gap-0.5" aria-hidden="true">
                  {puzzle.categories.map((category, index) => {
                    const solved = progress?.solvedLevels[index];
                    return (
                      <span
                        key={category.level}
                        className={`h-2.5 w-4 rounded-sm ${solved === undefined ? "bg-muted" : LEVEL_SWATCH[solved]}`}
                      />
                    );
                  })}
                </span>
                <span
                  className={`whitespace-nowrap text-[11px] ${
                    status === "solved" ? "text-green-400" : status === "failed" ? "text-red-400" : "text-muted-foreground"
                  }`}
                >
                  {statusLabel[status]}
                  {status === "solved" && progress ? ` · ${copy.mistakeCount} ${progress.mistakes}` : ""}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

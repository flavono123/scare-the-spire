"use client";

import Image from "@/components/ui/static-image";
import type { PuzzleboxStanding } from "@/hooks/use-puzzlebox-scores";
import type { ServiceLocale } from "@/lib/i18n";
import { CONNECTIONS_TOKEN_SRC } from "@/lib/vexing-puzzlebox";
import type { ConnectionsProgress, LocalBestScore } from "@/lib/vexing-puzzlebox-storage";
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

const ERA_TOKENS = {
  sts1: { src: "/images/sts1_app_icon.png", label: "Slay the Spire" },
  sts2: { src: "/images/sts2/icons/app_icon.png", label: "Slay the Spire 2" },
} as const;

/** The chains are gray metal, so lit means gilded and burnt means rusted red. */
const GILDED = "[filter:sepia(1)_saturate(3.2)_hue-rotate(2deg)_brightness(1.2)_drop-shadow(0_0_5px_rgba(250,204,21,0.6))]";
const RUSTED = "[filter:sepia(1)_saturate(6)_hue-rotate(-48deg)_brightness(0.8)]";

/**
 * The Connections token as a toggle: dark when untouched, half gilded while playing,
 * gilded when solved, and rusted red when the mistakes ran out.
 */
export function StatusToken({ status, label, size = 30 }: { status: ConnectionsStatus; label: string; size?: number }) {
  const style = { width: size, height: size };
  const image = (className: string) => (
    <Image src={CONNECTIONS_TOKEN_SRC} alt="" width={size * 2} height={size * 2} className={`absolute inset-0 h-full w-full object-contain ${className}`} />
  );
  return (
    <span role="img" aria-label={label} title={label} className="relative inline-block shrink-0" style={style} data-status-token={status}>
      {status === "new" && image("opacity-25 grayscale")}
      {status === "playing" && (
        <>
          {image("opacity-25 grayscale")}
          {image(`${GILDED} [clip-path:inset(0_50%_0_0)]`)}
        </>
      )}
      {status === "solved" && image(GILDED)}
      {status === "failed" && image(RUSTED)}
    </span>
  );
}

/** Mistakes as the energy they cost: a lit token for each left, an empty socket for each spent. */
export function EnergySockets({ left, total, icon, label }: { left: number; total: number; icon: string; label: string }) {
  return (
    <span className="flex items-center gap-0.5" role="img" aria-label={label} title={label} data-energy-left={left}>
      {Array.from({ length: total }, (_, index) => (
        <Image
          key={index}
          src={icon}
          alt=""
          width={37}
          height={35}
          className={`h-5 w-5 object-contain ${index < left ? "" : "opacity-25 brightness-0"}`}
        />
      ))}
    </span>
  );
}

/** Every puzzle, newest first, with its issue month, game, and how far the player got. */
export function ConnectionsIndex({
  puzzles,
  records,
  currentNumber,
  energyIcon,
  scores,
  standings,
  serviceLocale,
  onOpen,
}: {
  puzzles: ConnectionsPuzzle[];
  records: Record<string, ConnectionsProgress>;
  currentNumber: number;
  energyIcon: string;
  scores: Record<string, LocalBestScore>;
  standings: Record<string, PuzzleboxStanding>;
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
  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" data-connections-index={puzzles.length}>
      {puzzles.map((puzzle) => {
        const progress = records[puzzle.number];
        const status = connectionsStatus(progress, puzzle.categories.length);
        const best = scores[puzzle.number];
        const standing = standings[puzzle.number];
        const era = ERA_TOKENS[puzzle.era];
        const left = MISTAKE_LIMIT - (progress?.mistakes ?? 0);
        return (
          <li key={puzzle.number}>
            <button
              type="button"
              onClick={() => onOpen(puzzle.number)}
              data-connections-status={status}
              className={`flex w-full flex-col gap-2 rounded-lg border p-3 text-left transition-colors hover:border-primary/60 ${
                puzzle.number === currentNumber
                  ? "border-primary/70 bg-primary/10"
                  : status === "new"
                    ? "border-border bg-card/70"
                    : "border-border bg-card/90"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <StatusToken status={status} label={statusLabel[status]} />
                  <span className="font-game-title text-xl font-bold tabular-nums">#{puzzle.number}</span>
                </span>
                <Image src={era.src} alt={era.label} title={era.label} width={40} height={40} className="h-6 w-6 object-contain" />
              </span>
              <span className="text-xs text-muted-foreground">{issueMonth(puzzle.issueDate, serviceLocale)}</span>
              <span className="flex gap-0.5" aria-hidden="true">
                {puzzle.categories.map((category, index) => {
                  const solved = progress?.solvedLevels[index];
                  return (
                    <span
                      key={category.level}
                      className={`h-2.5 flex-1 rounded-sm ${solved === undefined ? "bg-muted" : LEVEL_SWATCH[solved]}`}
                    />
                  );
                })}
              </span>
              <span className="flex min-h-6 items-center justify-between gap-2">
                {status === "new" ? (
                  <span />
                ) : (
                  <EnergySockets
                    left={left}
                    total={MISTAKE_LIMIT}
                    icon={energyIcon}
                    label={`${copy.remainingMistakes} ${left}/${MISTAKE_LIMIT}`}
                  />
                )}
                {best && (
                  <span className="flex items-baseline gap-1.5 whitespace-nowrap">
                    <span className="font-game-title text-base font-bold tabular-nums spire-gold">{best.best}</span>
                    {standing && (
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {copy.rankLine.replace("{rank}", String(standing.rank)).replace("{players}", String(standing.players))}
                      </span>
                    )}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

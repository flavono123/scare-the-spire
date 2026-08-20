"use client";

import { Pencil, Share2, Trash2, Undo2 } from "lucide-react";
import { useCallback, type KeyboardEvent, type ReactNode } from "react";
import { HistoryCourseCover } from "@/components/history-course/history-course-cover";
import type { PostBlock } from "@/lib/chemical-types";
import { ensureCoverSpec } from "@/lib/run-cover-suggest";
import type { CoverSpec } from "@/lib/run-cover-types";
import { isBuildSupported } from "@/lib/sts2-build-version";
import type { ReplayBadge, ReplayRun } from "@/lib/sts2-run-replay";
import { mergePartyBadges, partyCharacters } from "@/lib/history-party";
import { cn } from "@/lib/utils";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";

function totalFloorsReached(run: ReplayRun): number {
  let total = 0;
  for (const act of run.map_point_history) total += act.length;
  return total;
}

export interface RunCardProps {
  runId: string;
  character: string;
  characters?: string[];
  ascension: number;
  build: string;
  seed: string;
  win: boolean;
  totalFloors: number;
  runTimeSeconds: number | null;
  startTimeUnix?: number | null;
  badges?: ReplayBadge[];
  coverSpec?: CoverSpec | null;
  noteBlocks?: PostBlock[] | null;
  onPick: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  onEditCover?: () => void;
  shareState?: "none" | "shared";
  variant: "mine" | "shared";
  pending?: boolean;
}

export function runCardPropsFromReplay(
  run: ReplayRun,
  runId: string,
  coverSpec?: CoverSpec | null,
): Omit<RunCardProps, "onPick" | "variant"> {
  return {
    runId,
    character: run.players[0]?.character ?? "",
    characters: partyCharacters(run),
    ascension: run.ascension,
    build: run.build_id,
    seed: run.seed,
    win: run.win,
    totalFloors: totalFloorsReached(run),
    runTimeSeconds: run.run_time ?? null,
    startTimeUnix: run.start_time ?? null,
    badges: mergePartyBadges(run),
    coverSpec: ensureCoverSpec(runId, run, coverSpec),
  };
}

export function RunCard({
  character,
  characters,
  ascension,
  build,
  seed,
  win,
  totalFloors,
  runTimeSeconds,
  badges = [],
  coverSpec,
  onPick,
  onDelete,
  onShare,
  onEditCover,
  shareState = "none",
  variant,
  pending,
}: RunCardProps) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].historyCourse.runCard;
  const supported = isBuildSupported(build);

  const onTrashClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete?.();
    },
    [onDelete],
  );

  const onShareClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onShare?.();
    },
    [onShare],
  );

  const onEditCoverClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onEditCover?.();
    },
    [onEditCover],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (pending) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onPick();
      }
    },
    [onPick, pending],
  );

  const topRightActions: ReactNode =
    onDelete || onShare || onEditCover ? (
      <>
        {onEditCover && (
          <button
            type="button"
            onClick={onEditCoverClick}
            title={copy.editCoverTitle}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-amber-100/85 backdrop-blur transition ring-1 ring-inset ring-amber-400/25",
              "hover:bg-amber-500/20 hover:text-amber-50",
            )}
          >
            <Pencil className="h-3 w-3" aria-hidden />
            {copy.editCover}
          </button>
        )}
        {onShare && (
          <button
            type="button"
            onClick={onShareClick}
            title={
              shareState === "shared" ? copy.unshareTitle : copy.shareTitle
            }
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-bold backdrop-blur transition ring-1 ring-inset",
              shareState === "shared"
                ? "text-emerald-200/80 ring-emerald-400/20 hover:bg-emerald-500/20 hover:text-emerald-100"
                : "text-amber-200/80 ring-amber-400/20 hover:bg-amber-500/20 hover:text-amber-100",
            )}
          >
            {shareState === "shared" ? (
              <>
                <Undo2 className="h-3 w-3" aria-hidden />
                {copy.unshare}
              </>
            ) : (
              <>
                <Share2 className="h-3 w-3" aria-hidden />
                {copy.share}
              </>
            )}
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={onTrashClick}
            title={
              variant === "shared"
                ? copy.unshareTitle
                : copy.deleteLocalTitle
            }
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-zinc-200 backdrop-blur transition ring-1 ring-inset ring-red-400/20",
              "hover:bg-red-500/20 hover:text-red-100",
            )}
          >
            <Trash2 size={12} />
            {copy.delete}
          </button>
        )}
      </>
    ) : undefined;

  return (
    <div className="group relative">
      <div
        role="button"
        tabIndex={pending ? -1 : 0}
        onClick={pending ? undefined : onPick}
        onKeyDown={onKeyDown}
        aria-disabled={pending || undefined}
        title={supported ? undefined : copy.unsupportedTitle}
        className={cn(
          "block w-full overflow-hidden rounded-xl text-left ring-1 ring-zinc-800 transition",
          pending && "cursor-wait opacity-60",
          !pending && supported && "cursor-pointer hover:-translate-y-0.5 hover:ring-amber-300/40",
          !pending && !supported && "cursor-pointer opacity-60 hover:opacity-100 hover:ring-red-300/40",
        )}
      >
        {coverSpec ? (
          <HistoryCourseCover
            cover={coverSpec}
            character={character}
            characters={characters}
            meta={{
              win,
              totalFloors,
              ascension,
              build,
              seed,
              runTimeSeconds,
              badges,
            }}
            topRightActions={topRightActions}
          />
        ) : (
          <div className="aspect-[16/9] bg-zinc-950" />
        )}
        {!supported && (
          <p className="bg-black/70 px-3 py-1 text-[10px] text-red-300/90">
            {copy.unsupportedRemove}
          </p>
        )}
      </div>
    </div>
  );
}

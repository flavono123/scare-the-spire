"use client";

import { Share2, Undo2 } from "lucide-react";
import { useCallback } from "react";
import { HistoryCourseCover } from "@/components/history-course/history-course-cover";
import { RunBadgeStrip } from "@/components/history-course/run-badge-strip";
import { SpireActionIcon } from "@/components/spire-icon";
import type { PostBlock } from "@/lib/chemical-types";
import { ensureCoverSpec } from "@/lib/run-cover-suggest";
import type { CoverSpec } from "@/lib/run-cover-types";
import { isBuildSupported } from "@/lib/sts2-build-version";
import type { ReplayBadge, ReplayRun } from "@/lib/sts2-run-replay";
import { cn } from "@/lib/utils";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";

function totalFloorsReached(run: ReplayRun): number {
  let total = 0;
  for (const act of run.map_point_history) total += act.length;
  return total;
}

function formatRunTime(seconds: number | null | undefined): string | null {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(unix: number | null | undefined): string | null {
  if (!unix) return null;
  const d = new Date(unix * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface RunCardProps {
  runId: string;
  character: string;
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
    ascension: run.ascension,
    build: run.build_id,
    seed: run.seed,
    win: run.win,
    totalFloors: totalFloorsReached(run),
    runTimeSeconds: run.run_time ?? null,
    startTimeUnix: run.start_time ?? null,
    badges: run.players[0]?.badges ?? [],
    coverSpec: ensureCoverSpec(runId, run, coverSpec),
  };
}

export function RunCard({
  character,
  ascension,
  build,
  seed,
  win,
  totalFloors,
  runTimeSeconds,
  startTimeUnix,
  badges = [],
  coverSpec,
  onPick,
  onDelete,
  onShare,
  shareState = "none",
  variant,
  pending,
}: RunCardProps) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].historyCourse.runCard;
  const supported = isBuildSupported(build);
  const showDate = variant === "mine" && startTimeUnix != null;
  const dateLabel = showDate ? formatDate(startTimeUnix) : null;
  const timeLabel = formatRunTime(runTimeSeconds);
  const outcome =
    serviceLocale === "ko"
      ? win
        ? `${totalFloors}층 · 클리어`
        : `${totalFloors}층 · 패배`
      : win
        ? `F${totalFloors} · Win`
        : `F${totalFloors} · Loss`;

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

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onPick}
        disabled={pending}
        title={supported ? undefined : copy.unsupportedTitle}
        className={cn(
          "block w-full overflow-hidden rounded-xl bg-zinc-900/60 text-left ring-1 ring-zinc-800 transition",
          pending && "cursor-wait opacity-60",
          !pending && supported && "hover:-translate-y-0.5 hover:ring-amber-300/40",
          !pending && !supported && "opacity-60 hover:opacity-100 hover:ring-red-300/40",
        )}
      >
        {coverSpec ? (
          <HistoryCourseCover cover={coverSpec} character={character} />
        ) : (
          <div className="aspect-video bg-zinc-950" />
        )}

        <div className="space-y-1.5 p-3">
          <div className="flex items-center gap-1.5">
            <BuildChip build={build} supported={supported} />
            <span className="rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-bold text-zinc-300 ring-1 ring-zinc-700">
              A{ascension}
            </span>
            <span className="truncate text-[10px] text-zinc-400">{outcome}</span>
          </div>
          <code className="block truncate rounded bg-black/30 px-1.5 py-0.5 font-mono text-[11px] text-zinc-200">
            {seed}
          </code>
          <div className="flex items-center gap-2 text-[10px] text-zinc-500">
            {dateLabel && <span>{dateLabel}</span>}
            {dateLabel && timeLabel && <span className="text-zinc-700">·</span>}
            {timeLabel && <span>{timeLabel}</span>}
          </div>
          <RunBadgeStrip
            badges={badges}
            serviceLocale={serviceLocale}
            size="sm"
            max={4}
          />
          {!supported && (
            <p className="text-[10px] text-red-300/80">{copy.unsupportedRemove}</p>
          )}
        </div>
      </button>

      {(onDelete || onShare) && (
        <div className="absolute right-2 top-2 flex items-center gap-1">
          {onShare && (
            <button
              type="button"
              onClick={onShareClick}
              title={
                shareState === "shared" ? copy.unshareTitle : copy.shareTitle
              }
              className={cn(
                "inline-flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-bold backdrop-blur transition ring-1 ring-inset",
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
                "inline-flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-zinc-200 backdrop-blur transition ring-1 ring-inset ring-red-400/20",
                "hover:bg-red-500/20 hover:text-red-100",
              )}
            >
              <SpireActionIcon action="delete" size={12} />
              {copy.delete}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function BuildChip({ build, supported }: { build: string; supported: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset",
        supported
          ? "bg-zinc-900 text-zinc-300 ring-zinc-700"
          : "bg-red-500/10 text-red-300 ring-red-400/30",
      )}
    >
      {build}
    </span>
  );
}

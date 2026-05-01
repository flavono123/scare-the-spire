"use client";

import { Trash2 } from "lucide-react";
import Image from "next/image";
import { useCallback } from "react";
import { isBuildSupported } from "@/lib/sts2-build-version";
import type { ReplayRun } from "@/lib/sts2-run-replay";
import { cn } from "@/lib/utils";

const CHAR_PORTRAIT: Record<string, string> = {
  "CHARACTER.IRONCLAD": "/images/sts2/characters/char_select_ironclad.webp",
  "CHARACTER.SILENT": "/images/sts2/characters/char_select_silent.webp",
  "CHARACTER.DEFECT": "/images/sts2/characters/char_select_defect.webp",
  "CHARACTER.NECROBINDER": "/images/sts2/characters/char_select_necrobinder.webp",
  "CHARACTER.REGENT": "/images/sts2/characters/char_select_regent.webp",
};

function characterPortraitSrc(character: string | undefined): string {
  if (!character) return "/images/sts2/characters/char_select_random.webp";
  return (
    CHAR_PORTRAIT[character] ?? "/images/sts2/characters/char_select_random.webp"
  );
}

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
  onPick: () => void;
  onDelete?: () => void;
  variant: "mine" | "shared";
  pending?: boolean;
}

export function runCardPropsFromReplay(
  run: ReplayRun,
  runId: string,
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
  };
}

export function RunCard({
  character,
  ascension,
  build,
  seed,
  totalFloors,
  runTimeSeconds,
  startTimeUnix,
  onPick,
  onDelete,
  variant,
  pending,
}: RunCardProps) {
  const supported = isBuildSupported(build);
  const portraitSrc = characterPortraitSrc(character);
  const showDate = variant === "mine" && startTimeUnix != null;
  const dateLabel = showDate ? formatDate(startTimeUnix) : null;
  const timeLabel = formatRunTime(runTimeSeconds);

  const onTrashClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete?.();
    },
    [onDelete],
  );

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onPick}
        disabled={pending}
        title={
          supported
            ? undefined
            : "재현 미지원 빌드 — 클릭하면 목록에서 제거"
        }
        className={cn(
          "block w-full rounded-xl bg-zinc-900/60 p-3 text-left ring-1 ring-zinc-800 transition",
          pending && "cursor-wait opacity-60",
          !pending && supported && "hover:-translate-y-0.5 hover:ring-amber-300/40",
          !pending && !supported && "opacity-60 hover:opacity-100 hover:ring-red-300/40",
        )}
      >
        <div className="flex items-start gap-3">
          {/* Character portrait — char_select_<char>.webp already
              bakes the flame frame; no outline overlay. Ascension flame
              badge sits at the bottom-right of the portrait, matching
              the in-game topbar's CharacterChip. */}
          <CharacterIcon src={portraitSrc} ascension={ascension} />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <BuildChip build={build} supported={supported} />
              <FloorChip floors={totalFloors} />
            </div>
            <code className="mt-1.5 block truncate rounded bg-black/30 px-1.5 py-0.5 font-mono text-[11px] text-zinc-200">
              {seed}
            </code>
            <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-500">
              {dateLabel && <span>{dateLabel}</span>}
              {dateLabel && timeLabel && <span className="text-zinc-700">·</span>}
              {timeLabel && <span>{timeLabel}</span>}
            </div>
            {!supported && (
              <p className="mt-1 text-[10px] text-red-300/80">
                재현 미지원 · 클릭하여 제거
              </p>
            )}
          </div>
        </div>
      </button>

      {onDelete && (
        <button
          type="button"
          onClick={onTrashClick}
          title={
            variant === "shared"
              ? "이 런의 익명 공유 취소"
              : "내 라이브러리에서 제거"
          }
          className={cn(
            "absolute right-2 top-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold transition",
            "text-red-400/35 ring-1 ring-red-400/0",
            "hover:bg-red-500/15 hover:text-red-200 hover:ring-red-400/30",
            "focus:bg-red-500/15 focus:text-red-200 focus:ring-red-400/30 focus:outline-none",
          )}
        >
          <Trash2 className="h-3 w-3" aria-hidden />
          삭제
        </button>
      )}
    </div>
  );
}

function CharacterIcon({
  src,
  ascension,
}: {
  src: string;
  ascension: number;
}) {
  return (
    <div className="relative h-14 w-14 shrink-0">
      <Image
        src={src}
        alt=""
        fill
        sizes="56px"
        className="object-contain"
      />
      {ascension > 0 && (
        <span
          className="pointer-events-none absolute -bottom-1 -right-1 flex h-6 w-6 items-end justify-center"
          aria-label={`승천 ${ascension}`}
        >
          <Image
            src="/images/sts2/ui/topbar/top_bar_ascension.png"
            alt=""
            fill
            sizes="24px"
            className="object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
            unoptimized
          />
          <span className="topbar-num relative z-10 mb-0 text-[11px] leading-none">
            {ascension}
          </span>
        </span>
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

function FloorChip({ floors }: { floors: number }) {
  return (
    <span className="inline-flex items-center rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-bold text-zinc-300 ring-1 ring-inset ring-zinc-700">
      F{floors}
    </span>
  );
}

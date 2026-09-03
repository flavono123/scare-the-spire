"use client";

import { Pencil, Share2, Trash2, Undo2 } from "lucide-react";
import {
  Children,
  useCallback,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  formatCoverRunTime,
  HistoryCourseCover,
} from "@/components/history-course/history-course-cover";
import { OwnPostMark } from "@/components/own-post-mark";
import { useGameI18n } from "@/hooks/use-game-i18n";
import type { PostBlock } from "@/lib/chemical-types";
import { resolveCoverCaptionTitle } from "@/lib/run-cover-phrase";
import { ensureCoverSpec, fallbackCoverTitlePhrase } from "@/lib/run-cover-suggest";
import type { CoverSpec } from "@/lib/run-cover-types";
import { formatBuildLabel, isBuildSupported } from "@/lib/sts2-build-version";
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
  isOwner?: boolean;
  ownedLocally?: boolean;
  pending?: boolean;
}

export function runCardPropsFromReplay(
  run: ReplayRun,
  runId: string,
  coverSpec?: CoverSpec | null,
): Omit<RunCardProps, "onPick"> {
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
  isOwner = false,
  ownedLocally = false,
  pending,
}: RunCardProps) {
  const serviceLocale = useServiceLocale();
  const tables = useGameI18n();
  const copy = serviceMessages[serviceLocale].historyCourse.runCard;
  const supported = isBuildSupported(build);
  const hasRunTime =
    typeof runTimeSeconds === "number" &&
    Number.isFinite(runTimeSeconds) &&
    runTimeSeconds >= 0;
  const title = coverSpec
    ? resolveCoverCaptionTitle(
        coverSpec,
        { win, totalFloors, ascension },
        serviceLocale,
        tables,
        fallbackCoverTitlePhrase(coverSpec, {
          win,
          totalFloors,
          ascension,
        }),
      )
    : seed;
  const versionLabel = formatBuildLabel(build);

  const onTrashClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      onDelete?.();
    },
    [onDelete],
  );

  const onShareClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      onShare?.();
    },
    [onShare],
  );

  const onEditCoverClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      onEditCover?.();
    },
    [onEditCover],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (pending) return;
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onPick();
      }
    },
    [onPick, pending],
  );

  const handleClick = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      if (pending) return;
      const target = e.target as HTMLElement;
      if (target.closest("a, button, [role='button']")) return;
      onPick();
    },
    [onPick, pending],
  );

  return (
    <article
      role="link"
      tabIndex={pending ? -1 : 0}
      onClick={handleClick}
      onKeyDown={onKeyDown}
      aria-disabled={pending || undefined}
      aria-label={title}
      title={supported ? undefined : copy.unsupportedTitle}
      className={cn(
        "toybox-video-lockup group cursor-pointer hover:z-10 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary/70",
        pending && "cursor-wait opacity-60",
        !pending && !supported && "opacity-60 hover:opacity-100",
      )}
    >
      <span className="toybox-video-lockup-plate" aria-hidden />
      <div className="relative z-[1]">
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
          />
        ) : (
          <div className="aspect-video rounded-xl bg-zinc-950" />
        )}
        <div className="mt-3 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <h2 className="min-w-0 truncate font-service text-[15px] font-semibold leading-snug text-foreground">
                {title}
              </h2>
              {isOwner && <OwnPostMark />}
            </div>
            <p className="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs leading-snug text-muted-foreground">
              <LockupCaptionParts>
                {hasRunTime ? (
                  <span className="shrink-0 tabular-nums">
                    {formatCoverRunTime(runTimeSeconds)}
                  </span>
                ) : null}
                {seed ? <SeedCaptionButton seed={seed} /> : null}
                {versionLabel ? (
                  <span className="shrink-0 tabular-nums">{versionLabel}</span>
                ) : null}
              </LockupCaptionParts>
            </p>
          </div>
          {(onDelete || onShare || onEditCover) && (
            <div className="flex shrink-0 items-center gap-0.5 pt-0.5">
              {onEditCover && (
                <button
                  type="button"
                  onClick={onEditCoverClick}
                  title={copy.editCoverTitle}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  <span className="sr-only">{copy.editCover}</span>
                </button>
              )}
              {onShare && (
                <button
                  type="button"
                  onClick={onShareClick}
                  title={
                    shareState === "shared" ? copy.unshareTitle : copy.shareTitle
                  }
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {shareState === "shared" ? (
                    <Undo2 className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Share2 className="h-3.5 w-3.5" aria-hidden />
                  )}
                  <span className="sr-only">
                    {shareState === "shared" ? copy.unshare : copy.share}
                  </span>
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={onTrashClick}
                  title={
                    ownedLocally ? copy.deleteLocalTitle : copy.unshareTitle
                  }
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  <span className="sr-only">{copy.delete}</span>
                </button>
              )}
            </div>
          )}
        </div>
        {!supported && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {copy.unsupportedRemove}
          </p>
        )}
      </div>
    </article>
  );
}

function LockupCaptionParts({ children }: { children: ReactNode }) {
  const parts = Children.toArray(children).filter(Boolean);
  return (
    <>
      {parts.map((part, index) => (
        <span key={index} className="contents">
          {index > 0 ? (
            <span aria-hidden className="shrink-0 text-muted-foreground/50">
              ·
            </span>
          ) : null}
          {part}
        </span>
      ))}
    </>
  );
}

function SeedCaptionButton({ seed }: { seed: string }) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].historyCourse.runCard;
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      try {
        await navigator.clipboard.writeText(seed);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      } catch {
        // Older browsers without clipboard API.
      }
    },
    [seed],
  );

  return (
    <button
      type="button"
      onClick={onCopy}
      title={copied ? copy.seedCopied : copy.copySeed}
      className="min-w-0 truncate font-mono text-xs text-muted-foreground hover:text-foreground"
    >
      {copied ? copy.seedCopied : seed}
    </button>
  );
}

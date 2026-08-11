"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { HistoryCourseCover } from "@/components/history-course/history-course-cover";
import Image from "@/components/ui/static-image";
import type { HistoryRunBlock } from "@/lib/chemical-types";
import {
  HISTORY_COURSE_RELIC_IMAGE,
  HISTORY_RUN_CHARACTER_PORTRAITS,
  historyRunPrimaryLabel,
  historyRunSecondaryLabel,
} from "@/lib/history-run-reference";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { getRunCoverSpec } from "@/lib/run-donation";
import { isCoverSpec, type CoverSpec } from "@/lib/run-cover-types";
import { cn } from "@/lib/utils";

interface ComboHistoryRunReferencesProps {
  references: HistoryRunBlock[];
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  variant: "compact" | "detail";
}

/** Index-card slot: same place/size language as ComboYouTubeThumbnail. */
export function ComboHistoryRunThumbnails({
  references,
  serviceLocale,
  gameLocale,
}: {
  references: HistoryRunBlock[];
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  if (references.length === 0) return null;
  return (
    <div className="flex shrink-0 items-start gap-1.5">
      {references.slice(0, 2).map((reference) => (
        <ComboHistoryRunThumbnail
          key={reference.runId}
          block={reference}
          serviceLocale={serviceLocale}
          gameLocale={gameLocale}
        />
      ))}
      {references.length > 2 && (
        <span className="self-center shrink-0 rounded-full border border-amber-300/10 bg-amber-100/5 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200/50">
          +{references.length - 2}
        </span>
      )}
    </div>
  );
}

export function ComboHistoryRunReferences({
  references,
  serviceLocale,
  gameLocale,
  variant,
}: ComboHistoryRunReferencesProps) {
  if (references.length === 0) return null;

  if (variant === "compact") {
    return (
      <ComboHistoryRunThumbnails
        references={references}
        serviceLocale={serviceLocale}
        gameLocale={gameLocale}
      />
    );
  }

  return (
    <section className="space-y-2" data-combo-history-runs>
      {references.map((reference) => (
        <HistoryRunDetailLink
          key={reference.runId}
          block={reference}
          serviceLocale={serviceLocale}
          gameLocale={gameLocale}
        />
      ))}
    </section>
  );
}

function useResolvedCoverSpec(block: HistoryRunBlock): CoverSpec | null {
  const embedded = isCoverSpec(block.snapshot.coverSpec)
    ? block.snapshot.coverSpec
    : null;
  const [cover, setCover] = useState<CoverSpec | null>(embedded);

  useEffect(() => {
    if (embedded) {
      setCover(embedded);
      return;
    }
    let cancelled = false;
    void getRunCoverSpec(block.runId).then((next) => {
      if (!cancelled) setCover(next);
    });
    return () => {
      cancelled = true;
    };
  }, [block.runId, embedded]);

  return cover;
}

function ComboHistoryRunThumbnail({
  block,
  serviceLocale,
  gameLocale,
}: {
  block: HistoryRunBlock;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  const href = localizeHrefWithGameLocale(
    `/history-course/${block.runId}`,
    serviceLocale,
    gameLocale,
  );
  const primary = historyRunPrimaryLabel(block, serviceLocale);
  const cover = useResolvedCoverSpec(block);

  return (
    <Link
      href={href}
      title={cover?.phrase || primary}
      className={cn(
        "group/run relative block w-24 shrink-0 overflow-hidden rounded-md outline-none ring-1 ring-amber-300/20",
        "transition-[transform,filter,box-shadow] duration-200",
        "hover:-translate-y-0.5 hover:brightness-110 hover:ring-amber-300/45",
        "focus-visible:ring-2 focus-visible:ring-amber-300 active:translate-y-0 motion-reduce:transform-none",
        "sm:w-32",
      )}
    >
      {cover ? (
        <HistoryCourseCover
          cover={cover}
          character={block.snapshot.character}
          size="compact"
          meta={{
            win: block.snapshot.win,
            totalFloors: block.snapshot.totalFloors,
            ascension: block.snapshot.ascension,
            build: block.snapshot.build,
            seed: block.snapshot.seed,
          }}
        />
      ) : (
        <span className="relative flex aspect-video items-center justify-center bg-zinc-950">
          <Image
            src={HISTORY_RUN_CHARACTER_PORTRAITS[block.snapshot.character]
              ?? "/images/sts2/characters/char_select_random.webp"}
            alt=""
            width={56}
            height={56}
            className="h-10 w-10 object-contain"
          />
          <Image
            src={HISTORY_COURSE_RELIC_IMAGE}
            alt=""
            width={16}
            height={16}
            className="absolute bottom-1 right-1 h-4 w-4 object-contain"
          />
        </span>
      )}
    </Link>
  );
}

function HistoryRunDetailLink({
  block,
  serviceLocale,
  gameLocale,
}: {
  block: HistoryRunBlock;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  const href = localizeHrefWithGameLocale(
    `/history-course/${block.runId}`,
    serviceLocale,
    gameLocale,
  );
  const primary = historyRunPrimaryLabel(block, serviceLocale);
  const cover = useResolvedCoverSpec(block);

  return (
    <Link
      href={href}
      className="group/run flex items-center gap-3 rounded-xl border border-amber-300/10 bg-black/25 p-3 transition-[transform,border-color,background-color] hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-amber-300/5 motion-reduce:transform-none"
    >
      {cover ? (
        <span className="w-36 shrink-0 sm:w-48">
          <HistoryCourseCover
            cover={cover}
            character={block.snapshot.character}
            size="compact"
            meta={{
              win: block.snapshot.win,
              totalFloors: block.snapshot.totalFloors,
              ascension: block.snapshot.ascension,
              build: block.snapshot.build,
              seed: block.snapshot.seed,
            }}
          />
        </span>
      ) : (
        <span className="relative flex h-14 w-14 shrink-0 items-center justify-center">
          <Image
            src={HISTORY_RUN_CHARACTER_PORTRAITS[block.snapshot.character]
              ?? "/images/sts2/characters/char_select_random.webp"}
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 object-contain"
          />
          <Image
            src={HISTORY_COURSE_RELIC_IMAGE}
            alt=""
            width={19}
            height={19}
            className="absolute -bottom-0.5 -right-0.5 h-5 w-5 object-contain drop-shadow"
          />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-amber-50">
          {cover?.phrase || primary}
        </span>
        <span className="mt-1 block truncate text-[11px] text-zinc-500">
          {historyRunSecondaryLabel(block, serviceLocale)}
        </span>
        <span className="mt-1 block truncate font-mono text-[10px] text-zinc-600">
          {block.snapshot.build} · {block.snapshot.seed}
        </span>
      </span>
      <ArrowUpRight
        className="h-4 w-4 shrink-0 text-amber-300/30 transition-[color,transform] group-hover/run:-translate-y-0.5 group-hover/run:translate-x-0.5 group-hover/run:text-amber-200"
        aria-hidden="true"
      />
    </Link>
  );
}

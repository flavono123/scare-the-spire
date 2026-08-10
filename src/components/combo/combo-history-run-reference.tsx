"use client";

import Link from "next/link";
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
import { isCoverSpec } from "@/lib/run-cover-types";

interface ComboHistoryRunReferencesProps {
  references: HistoryRunBlock[];
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  variant: "compact" | "detail";
}

export function ComboHistoryRunReferences({
  references,
  serviceLocale,
  gameLocale,
  variant,
}: ComboHistoryRunReferencesProps) {
  if (references.length === 0) return null;

  if (variant === "compact") {
    const first = references[0];
    if (!first) return null;
    return (
      <div className="mt-2 flex min-w-0 items-center gap-1.5">
        <HistoryRunLink
          block={first}
          serviceLocale={serviceLocale}
          gameLocale={gameLocale}
          compact
        />
        {references.length > 1 && (
          <span className="shrink-0 rounded-full border border-amber-300/10 bg-amber-100/5 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200/50">
            +{references.length - 1}
          </span>
        )}
      </div>
    );
  }

  return (
    <section className="space-y-2" data-combo-history-runs>
      {references.map((reference) => (
        <HistoryRunLink
          key={reference.runId}
          block={reference}
          serviceLocale={serviceLocale}
          gameLocale={gameLocale}
        />
      ))}
    </section>
  );
}

function HistoryRunLink({
  block,
  serviceLocale,
  gameLocale,
  compact = false,
}: {
  block: HistoryRunBlock;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  compact?: boolean;
}) {
  const href = localizeHrefWithGameLocale(
    `/history-course/${block.runId}`,
    serviceLocale,
    gameLocale,
  );
  const primary = historyRunPrimaryLabel(block, serviceLocale);

  if (compact) {
    return (
      <Link
        href={href}
        title={primary}
        className="group/run flex min-w-0 max-w-full items-center gap-1.5 rounded-md border border-amber-300/10 bg-amber-100/5 px-2 py-1 text-[10px] font-semibold text-amber-100/70 transition-colors hover:border-amber-300/30 hover:text-amber-100"
      >
        <Image
          src={HISTORY_COURSE_RELIC_IMAGE}
          alt=""
          width={15}
          height={15}
          className="h-4 w-4 shrink-0 object-contain"
        />
        <span className="truncate">{primary}</span>
        <ArrowUpRight
          className="h-3 w-3 shrink-0 opacity-40 transition-opacity group-hover/run:opacity-80"
          aria-hidden="true"
        />
      </Link>
    );
  }

  const cover = isCoverSpec(block.snapshot.coverSpec)
    ? block.snapshot.coverSpec
    : null;

  return (
    <Link
      href={href}
      className="group/run flex items-center gap-3 rounded-xl border border-amber-300/10 bg-black/25 p-3 transition-[transform,border-color,background-color] hover:-translate-y-0.5 hover:border-amber-300/30 hover:bg-amber-300/5 motion-reduce:transform-none"
    >
      {cover ? (
        <span className="w-28 shrink-0 sm:w-36">
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

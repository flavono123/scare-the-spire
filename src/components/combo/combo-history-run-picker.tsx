"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog } from "radix-ui";
import { BookOpen, LoaderCircle, Search, X } from "lucide-react";
import Image from "@/components/ui/static-image";
import { HistoryCourseCover } from "@/components/history-course/history-course-cover";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import { useAuth } from "@/hooks/use-auth";
import type { HistoryRunBlock } from "@/lib/chemical-types";
import {
  HISTORY_COURSE_RELIC_IMAGE,
  HISTORY_RUN_CHARACTER_PORTRAITS,
  historyRunBlockFromReplay,
  historyRunBlockFromSummary,
  historyRunPrimaryLabel,
  historyRunSearchText,
  historyRunSecondaryLabel,
} from "@/lib/history-run-reference";
import type { ServiceLocale } from "@/lib/i18n";
import {
  donateRun,
  listHistoryRunReferences,
  type DonatedRunSummary,
} from "@/lib/run-donation";
import { isCoverSpec } from "@/lib/run-cover-types";
import { listOwnRuns } from "@/lib/run-store";
import { parseReplayRun, type ReplayRun } from "@/lib/sts2-run-replay";
import { supabaseEnabled } from "@/lib/supabase";
import { serviceMessages } from "@/messages/service";

interface LocalRunEntry {
  runId: string;
  raw: string;
  run: ReplayRun;
  block: HistoryRunBlock;
}

interface ComboHistoryRunPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceLocale: ServiceLocale;
  onSelect: (block: HistoryRunBlock) => void;
}

export function ComboHistoryRunPicker({
  open,
  onOpenChange,
  serviceLocale,
  onSelect,
}: ComboHistoryRunPickerProps) {
  const copy = serviceMessages[serviceLocale].combo;
  const { userId, ensureUser } = useAuth();
  const [query, setQuery] = useState("");
  const [localRuns, setLocalRuns] = useState<LocalRunEntry[] | null>(null);
  const [sharedRuns, setSharedRuns] = useState<DonatedRunSummary[] | null>(null);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [pendingRunId, setPendingRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || localRuns !== null || sharedRuns !== null) return;

    let cancelled = false;
    const loadLocalRuns = listOwnRuns()
      .then((records) => records.flatMap((record): LocalRunEntry[] => {
        try {
          const run = parseReplayRun(record.raw);
          return [{
            runId: record.runId,
            raw: record.raw,
            run,
            block: historyRunBlockFromReplay(
              record.runId,
              run,
              record.coverSpec,
            ),
          }];
        } catch {
          return [];
        }
      }))
      .catch(() => [] as LocalRunEntry[]);
    const loadSharedRuns = listHistoryRunReferences()
      .catch(() => {
        if (!cancelled) setStorageUnavailable(true);
        return [] as DonatedRunSummary[];
      });

    Promise.all([loadLocalRuns, loadSharedRuns]).then(([local, shared]) => {
      if (cancelled) return;
      local.sort((left, right) => (
        (right.run.start_time ?? 0) - (left.run.start_time ?? 0)
      ));
      setLocalRuns(local);
      setSharedRuns(shared);
    });

    return () => {
      cancelled = true;
    };
  }, [localRuns, open, sharedRuns]);

  const sharedIds = useMemo(
    () => new Set((sharedRuns ?? []).map((run) => run.id)),
    [sharedRuns],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filteredLocalRuns = useMemo(
    () => (localRuns ?? []).filter((entry) => (
      !normalizedQuery
      || historyRunSearchText(entry.block, serviceLocale).includes(normalizedQuery)
    )),
    [localRuns, normalizedQuery, serviceLocale],
  );
  const filteredSharedRuns = useMemo(() => {
    const localIds = new Set((localRuns ?? []).map((entry) => entry.runId));
    return (sharedRuns ?? [])
      .filter((run) => !localIds.has(run.id))
      .map((run) => ({ run, block: historyRunBlockFromSummary(run) }))
      .filter(({ block }) => (
        !normalizedQuery
        || historyRunSearchText(block, serviceLocale).includes(normalizedQuery)
      ));
  }, [localRuns, normalizedQuery, serviceLocale, sharedRuns]);

  const finishSelection = (block: HistoryRunBlock) => {
    onSelect(block);
    setError(null);
    setQuery("");
    onOpenChange(false);
  };

  const selectLocalRun = async (entry: LocalRunEntry) => {
    if (pendingRunId) return;
    if (sharedIds.has(entry.runId)) {
      finishSelection(entry.block);
      return;
    }
    if (!supabaseEnabled) {
      setStorageUnavailable(true);
      return;
    }

    setPendingRunId(entry.runId);
    setError(null);
    const activeUserId = userId ?? await ensureUser();
    if (!activeUserId) {
      setStorageUnavailable(true);
      setPendingRunId(null);
      return;
    }

    const result = await donateRun({
      runId: entry.runId,
      raw: entry.raw,
      run: entry.run,
      donorUserId: activeUserId,
      coverSpec: entry.block.snapshot.coverSpec ?? null,
    });
    setPendingRunId(null);

    if (result.ok || (!result.ok && result.alreadyDonated)) {
      setSharedRuns((current) => current
        ? [
          {
            id: entry.runId,
            start_time: entry.block.snapshot.startTime,
            run_time: entry.block.snapshot.runTime,
            total_floors: entry.block.snapshot.totalFloors,
            acts_count: entry.run.acts.length,
            badges: entry.run.players[0]?.badges ?? [],
            characters: entry.block.snapshot.characters,
            highlight_card: null,
            highlight_relic: null,
            note_blocks: null,
            cover_spec: entry.block.snapshot.coverSpec ?? null,
            donor_user_id: activeUserId,
            created_at: new Date().toISOString(),
            build: entry.block.snapshot.build,
            seed: entry.block.snapshot.seed,
            character: entry.block.snapshot.character,
            ascension: entry.block.snapshot.ascension,
            win: entry.block.snapshot.win,
          },
          ...current,
        ]
        : current);
      finishSelection(entry.block);
      return;
    }

    setError(copy.historyRunShareFailed.replace("{message}", result.message));
  };

  const loading = localRuns === null || sharedRuns === null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-primary/25 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary transition-[transform,border-color,background-color] duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/15 active:translate-y-0 motion-reduce:transform-none"
        >
          <Image
            src={HISTORY_COURSE_RELIC_IMAGE}
            alt=""
            width={16}
            height={16}
            className="h-4 w-4 object-contain"
          />
          {copy.historyRunAdd}
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-3 bottom-3 top-auto z-[121] flex max-h-[min(82dvh,48rem)] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl sm:left-1/2 sm:top-1/2 sm:w-[min(46rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2"
        >
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Image
              src={HISTORY_COURSE_RELIC_IMAGE}
              alt=""
              width={30}
              height={30}
              className="h-8 w-8 shrink-0 object-contain"
            />
            <div className="min-w-0 flex-1">
              <Dialog.Title className="font-service text-sm font-bold text-foreground">
                {copy.historyRunPickerLabel}
              </Dialog.Title>
              <p className="text-[10px] text-muted-foreground">
                {copy.historyRunPickerDescription}
              </p>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label={serviceMessages[serviceLocale].codex.common.close}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <label className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-primary/70" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.historyRunSearchPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </label>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-xs text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                {copy.historyRunLoading}
              </div>
            ) : (
              <div className="space-y-5">
                <RunSection
                  title={copy.historyRunMine}
                  empty={copy.historyRunEmptyMine}
                  blocks={filteredLocalRuns.map((entry) => ({
                    block: entry.block,
                    action: sharedIds.has(entry.runId)
                      ? copy.historyRunReference
                      : copy.historyRunShareAndReference,
                    pending: pendingRunId === entry.runId,
                    onSelect: () => void selectLocalRun(entry),
                  }))}
                  serviceLocale={serviceLocale}
                />
                <RunSection
                  title={copy.historyRunShared}
                  empty={copy.historyRunEmptyShared}
                  blocks={filteredSharedRuns.map(({ block }) => ({
                    block,
                    action: copy.historyRunReference,
                    pending: false,
                    onSelect: () => finishSelection(block),
                  }))}
                  serviceLocale={serviceLocale}
                />
                {storageUnavailable && (
                  <StorageUnavailableNotice
                    title={copy.unavailableTitle}
                    compact
                    className="rounded-lg border border-white/5 bg-black/20"
                  />
                )}
              </div>
            )}
          </div>

          {error && (
            <p
              className="border-t border-red-700/20 px-4 py-2 text-xs text-red-800 dark:border-red-300/10 dark:text-red-300"
              role="alert"
            >
              {error}
            </p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function RunSection({
  title,
  empty,
  blocks,
  serviceLocale,
}: {
  title: string;
  empty: string;
  blocks: Array<{
    block: HistoryRunBlock;
    action: string;
    pending: boolean;
    onSelect: () => void;
  }>;
  serviceLocale: ServiceLocale;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-foreground">
        <BookOpen className="h-3.5 w-3.5 text-primary/70" aria-hidden="true" />
        {title}
      </h3>
      {blocks.length === 0 ? (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-5 text-center text-xs text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {blocks.map(({ block, action, pending, onSelect }) => {
            const cover = isCoverSpec(block.snapshot.coverSpec)
              ? block.snapshot.coverSpec
              : null;
            return (
            <li key={block.runId}>
              <button
                type="button"
                disabled={pending}
                onClick={onSelect}
                className="group flex w-full items-center gap-2.5 rounded-xl border border-border bg-card/70 p-2.5 text-left transition-[transform,border-color,background-color] hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 disabled:cursor-wait disabled:opacity-60 motion-reduce:transform-none"
              >
                {cover ? (
                  <span className="w-28 shrink-0">
                    <HistoryCourseCover
                      cover={cover}
                      character={block.snapshot.character}
                      characters={block.snapshot.characters}
                      size="compact"
                      meta={{
                        win: block.snapshot.win,
                        totalFloors: block.snapshot.totalFloors,
                        ascension: block.snapshot.ascension,
                        build: block.snapshot.build,
                        seed: block.snapshot.seed,
                        runTimeSeconds: block.snapshot.runTime,
                      }}
                    />
                  </span>
                ) : (
                  <Image
                    src={HISTORY_RUN_CHARACTER_PORTRAITS[block.snapshot.character]
                      ?? "/images/sts2/characters/char_select_random.webp"}
                    alt=""
                    width={46}
                    height={46}
                    className="h-12 w-12 shrink-0 object-contain"
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-foreground">
                    {cover?.phrase || historyRunPrimaryLabel(block, serviceLocale)}
                  </span>
                  <span className="mt-1 block truncate text-[10px] text-muted-foreground">
                    {historyRunSecondaryLabel(block, serviceLocale)}
                  </span>
                  <span className="mt-1 block text-[10px] font-semibold text-primary group-hover:text-primary">
                    {pending ? (
                      <LoaderCircle className="mr-1 inline h-3 w-3 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    ) : null}
                    {action}
                  </span>
                </span>
              </button>
            </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  type DonatedRunSummary,
  deleteDonatedRun,
  listRecentDonatedRuns,
} from "@/lib/run-donation";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import { supabaseEnabled } from "@/lib/supabase";
import { RandomPickCard } from "./random-pick-card";
import { RunCard } from "./run-card";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";

interface Props {
  refreshKey?: number;
  query?: string;
}

export function DonatedRunsSection({ refreshKey = 0, query = "" }: Props) {
  const copy = serviceMessages[useServiceLocale()].historyCourse.lists;
  const router = useRouter();
  const { userId } = useAuth();
  const [runs, setRuns] = useState<DonatedRunSummary[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!supabaseEnabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRuns([]);
      return;
    }
    let cancelled = false;
    setUnavailable(false);
    listRecentDonatedRuns()
      .then((result) => {
        if (!cancelled) setRuns(result);
      })
      .catch(() => {
        if (cancelled) return;
        setUnavailable(true);
        setRuns([]);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const onUndo = async (runId: string) => {
    if (
      !window.confirm(copy.undoConfirm)
    ) {
      return;
    }
    const ok = await deleteDonatedRun(runId);
    if (ok) {
      setRuns((prev) => prev?.filter((r) => r.id !== runId) ?? null);
    }
  };

  if (!supabaseEnabled) {
    return null;
  }
  const storageUnavailable = unavailable;
  const loading = runs === null && !storageUnavailable;
  const hasQuery = query.trim().length > 0;
  const filteredRuns = filterSharedRuns(runs ?? [], query);

  return (
    <section>
      <header className="mb-3">
        <h2 className="text-sm font-bold text-zinc-200">
          {copy.sharedRuns}
          {runs !== null && !storageUnavailable && (
            <>
              {" "}
              <span className="font-medium text-zinc-500">
                ({filteredRuns.length > 99 ? "99+" : filteredRuns.length})
              </span>
            </>
          )}
        </h2>
      </header>
      {storageUnavailable ? (
        <StorageUnavailableNotice
          title={copy.unavailableTitle}
        />
      ) : loading ? (
        <ContentLoadingNotice label={copy.loadingSharedRuns} />
      ) : (
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          <li className="col-span-2 lg:col-span-1">
            <RandomPickCard runs={filteredRuns} userId={userId} />
          </li>
          {hasQuery && filteredRuns.length === 0 ? (
            <li className="col-span-2 rounded-xl bg-zinc-900/40 px-4 py-6 text-center text-xs text-zinc-500 ring-1 ring-zinc-800 lg:col-span-1">
              {copy.noResults}
            </li>
          ) : null}
          {filteredRuns.map((entry) => {
            const isOwn = !!userId && entry.donor_user_id === userId;
            return (
              <li key={entry.id}>
                <RunCard
                  runId={entry.id}
                  character={entry.character}
                  ascension={entry.ascension}
                  build={entry.build}
                  seed={entry.seed}
                  win={entry.win}
                  totalFloors={entry.total_floors}
                  runTimeSeconds={entry.run_time}
                  startTimeUnix={null}
                  badges={entry.badges ?? []}
                  coverSpec={entry.cover_spec}
                  noteBlocks={entry.note_blocks}
                  variant="shared"
                  onPick={() => router.push(`/history-course/${entry.id}`)}
                  onDelete={isOwn ? () => onUndo(entry.id) : undefined}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function filterSharedRuns(
  runs: DonatedRunSummary[],
  query: string,
): DonatedRunSummary[] {
  const text = query.trim().toLowerCase();
  if (!text) return runs;
  return runs.filter((entry) =>
    [
      entry.id,
      entry.seed,
      entry.character,
      entry.build,
      entry.cover_spec?.phrase,
      ...(entry.cover_spec?.elements.map((el) => el.id) ?? []),
      entry.highlight_card?.nameKo,
      entry.highlight_card?.nameEn,
      entry.highlight_relic?.nameKo,
      entry.highlight_relic?.nameEn,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(text)),
  );
}

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
}

export function DonatedRunsSection({ refreshKey = 0 }: Props) {
  const copy = serviceMessages[useServiceLocale()].historyCourse.lists;
  const router = useRouter();
  const { userId, unavailable: authUnavailable } = useAuth();
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
  const storageUnavailable = authUnavailable || unavailable;
  const loading = runs === null && !storageUnavailable;

  return (
    <section>
      <header className="mb-3">
        <h2 className="text-sm font-bold text-zinc-200">
          {copy.sharedRuns}
          {runs !== null && !storageUnavailable && (
            <>
              {" "}
              <span className="font-medium text-zinc-500">
                ({runs.length > 99 ? "99+" : runs.length})
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
        <ul className="grid gap-3 sm:grid-cols-2">
          <li>
            <RandomPickCard runs={runs ?? []} userId={userId} />
          </li>
          {(runs ?? []).map((entry) => {
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

"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CoverEditorSheet } from "@/components/history-course/cover-editor-sheet";
import { useAuth } from "@/hooks/use-auth";
import {
  type DonatedRunSummary,
  deleteDonatedRun,
  listRecentDonatedRuns,
  updateDonatedRunCoverSpec,
} from "@/lib/run-donation";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import { ensureCoverSpec } from "@/lib/run-cover-suggest";
import type { CoverSpec } from "@/lib/run-cover-types";
import { parseReplayRun } from "@/lib/sts2-run-replay";
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
  const { userId, ensureUser } = useAuth();
  const [runs, setRuns] = useState<DonatedRunSummary[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [editing, setEditing] = useState<DonatedRunSummary | null>(null);

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
    if (!window.confirm(copy.undoConfirm)) {
      return;
    }
    const ok = await deleteDonatedRun(runId);
    if (ok) {
      setRuns((prev) => prev?.filter((r) => r.id !== runId) ?? null);
    }
  };

  const handleSaveCover = useCallback(
    async (cover: CoverSpec) => {
      if (!editing) return;
      const activeUserId = userId ?? (await ensureUser());
      if (!activeUserId) return;
      const result = await updateDonatedRunCoverSpec({
        runId: editing.id,
        donorUserId: activeUserId,
        coverSpec: cover,
      });
      if (!result.ok) return;
      setRuns((prev) =>
        prev?.map((entry) =>
          entry.id === editing.id ? { ...entry, cover_spec: cover } : entry,
        ) ?? null,
      );
      setEditing((prev) => (prev ? { ...prev, cover_spec: cover } : null));
    },
    [editing, ensureUser, userId],
  );

  const editingParsed = useMemo(() => {
    if (!editing?.raw) return null;
    try {
      const run = parseReplayRun(editing.raw);
      return {
        run,
        cover: ensureCoverSpec(editing.id, run, editing.cover_spec),
      };
    } catch {
      return null;
    }
  }, [editing]);

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
        <ul className="grid grid-cols-1 gap-3">
          <li>
            <RandomPickCard runs={filteredRuns} userId={userId} />
          </li>
          {hasQuery && filteredRuns.length === 0 ? (
            <li className="rounded-xl bg-zinc-900/40 px-4 py-6 text-center text-xs text-zinc-500 ring-1 ring-zinc-800">
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
                  onEditCover={
                    isOwn && entry.raw
                      ? () => setEditing(entry)
                      : undefined
                  }
                />
              </li>
            );
          })}
        </ul>
      )}

      {editing && editingParsed && (
        <CoverEditorSheet
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          runId={editing.id}
          run={editingParsed.run}
          character={editing.character}
          meta={{
            win: editing.win,
            totalFloors: editing.total_floors,
            ascension: editing.ascension,
            build: editing.build,
            seed: editing.seed,
            runTimeSeconds: editing.run_time,
            badges: editing.badges ?? [],
          }}
          initialCover={editingParsed.cover}
          onSave={handleSaveCover}
        />
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

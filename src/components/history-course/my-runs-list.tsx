"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  deleteDonatedRun,
  donateRun,
  listMyDonatedRunIds,
} from "@/lib/run-donation";
import type { PostBlock } from "@/lib/chemical-types";
import { deleteRun, listOwnRuns } from "@/lib/run-store";
import { isBuildSupported, MIN_SUPPORTED_BUILD } from "@/lib/sts2-build-version";
import { parseReplayRun, type ReplayRun } from "@/lib/sts2-run-replay";
import { supabaseEnabled } from "@/lib/supabase";
import { RunCard, runCardPropsFromReplay } from "./run-card";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";

interface Props {
  // Bump from the parent whenever a fresh upload lands so this list
  // re-hydrates from IDB. Internal mutations (delete/share/unshare)
  // are reconciled in local state without waiting for the bump.
  refreshKey?: number;
  query?: string;
}

interface Entry {
  runId: string;
  raw: string;
  run: ReplayRun;
  noteBlocks?: PostBlock[] | null;
}

export function MyRunsList({ refreshKey = 0, query = "" }: Props) {
  const copy = serviceMessages[useServiceLocale()].historyCourse.lists;
  const router = useRouter();
  const { userId, ensureUser } = useAuth();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [donatedIds, setDonatedIds] = useState<Set<string>>(new Set());

  // Hydrate from IDB whenever refreshKey changes.
  useEffect(() => {
    let cancelled = false;
    listOwnRuns().then((records) => {
      if (cancelled) return;
      const out: Entry[] = [];
      for (const rec of records) {
        try {
          const run = parseReplayRun(rec.raw);
          out.push({
            runId: rec.runId,
            raw: rec.raw,
            run,
            noteBlocks: rec.noteBlocks ?? null,
          });
        } catch {
          // skip malformed
        }
      }
      out.sort(
        (a, b) => (b.run.start_time ?? 0) - (a.run.start_time ?? 0),
      );
      if (!cancelled) setEntries(out);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // Refresh which of my runs are already donated whenever userId
  // resolves or the list itself changes.
  useEffect(() => {
    if (!supabaseEnabled || !userId) return;
    let cancelled = false;
    listMyDonatedRunIds(userId).then((ids) => {
      if (!cancelled) setDonatedIds(ids);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey]);

  const handlePick = useCallback(
    (entry: Entry) => {
      if (!isBuildSupported(entry.run.build_id)) {
        // Unsupported = dismiss in place (parent's listOwnRuns won't
        // surface unsupported anyway; this branch is defensive).
        setEntries((prev) => prev?.filter((e) => e.runId !== entry.runId) ?? null);
        void deleteRun(entry.runId);
        return;
      }
      router.push(`/history-course/${entry.runId}`);
    },
    [router],
  );

  const handleDelete = useCallback(async (entry: Entry) => {
    setEntries((prev) => prev?.filter((e) => e.runId !== entry.runId) ?? null);
    await deleteRun(entry.runId);
    // If this run was also donated, fully unshare.
    if (donatedIds.has(entry.runId)) {
      const ok = await deleteDonatedRun(entry.runId);
      if (ok) {
        setDonatedIds((prev) => {
          const next = new Set(prev);
          next.delete(entry.runId);
          return next;
        });
      }
    }
  }, [donatedIds]);

  const handleShare = useCallback(
    async (entry: Entry) => {
      if (!supabaseEnabled) return;
      const activeUserId = userId ?? await ensureUser();
      if (!activeUserId) return;
      const wasDonated = donatedIds.has(entry.runId);
      if (wasDonated) {
        const ok = await deleteDonatedRun(entry.runId);
        if (ok) {
          setDonatedIds((prev) => {
            const next = new Set(prev);
            next.delete(entry.runId);
            return next;
          });
        }
        return;
      }
      const result = await donateRun({
        runId: entry.runId,
        raw: entry.raw,
        run: entry.run,
        donorUserId: activeUserId,
      });
      if (result.ok || (!result.ok && result.alreadyDonated)) {
        setDonatedIds((prev) => {
          const next = new Set(prev);
          next.add(entry.runId);
          return next;
        });
      }
    },
    [donatedIds, ensureUser, userId],
  );

  if (entries === null) return null;
  const filteredEntries = filterLocalEntries(entries, query);

  return (
    <section>
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-zinc-200">
          {copy.myRuns}{" "}
          <span className="font-medium text-zinc-500">
            ({filteredEntries.length > 99 ? "99+" : filteredEntries.length})
          </span>
        </h2>
        <p className="text-[11px] text-zinc-500">
          {copy.minBuild.replace("{version}", MIN_SUPPORTED_BUILD.replace(/^v/, ""))}
        </p>
      </header>
      {entries.length === 0 ? (
        <p className="rounded-xl bg-zinc-900/40 px-4 py-6 text-center text-xs text-zinc-500 ring-1 ring-zinc-800">
          {copy.emptyMine}
        </p>
      ) : filteredEntries.length === 0 ? (
        <p className="rounded-xl bg-zinc-900/40 px-4 py-6 text-center text-xs text-zinc-500 ring-1 ring-zinc-800">
          {copy.noResults}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {filteredEntries.map((entry) => {
            const shared = donatedIds.has(entry.runId);
            return (
              <li key={entry.runId}>
                <RunCard
                  {...runCardPropsFromReplay(entry.run, entry.runId)}
                  noteBlocks={entry.noteBlocks}
                  variant="mine"
                  onPick={() => handlePick(entry)}
                  onDelete={() => handleDelete(entry)}
                  onShare={
                    supabaseEnabled
                      ? () => handleShare(entry)
                      : undefined
                  }
                  shareState={shared ? "shared" : "none"}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function filterLocalEntries(entries: Entry[], query: string): Entry[] {
  const text = query.trim().toLowerCase();
  if (!text) return entries;
  return entries.filter((entry) => {
    const props = runCardPropsFromReplay(entry.run, entry.runId);
    return [
      entry.runId,
      props.seed,
      props.character,
      props.build,
      props.highlightCard?.nameKo,
      props.highlightCard?.nameEn,
      props.highlightRelic?.nameKo,
      props.highlightRelic?.nameEn,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(text));
  });
}

"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ComboGameElementFilter } from "@/components/combo/combo-game-element-filter";
import { CoverEditorSheet } from "@/components/history-course/cover-editor-sheet";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { useAuth } from "@/hooks/use-auth";
import { useServiceLocale } from "@/hooks/use-service-locale";
import type { PostBlock } from "@/lib/chemical-types";
import type { ComboResourceRef } from "@/lib/combo-types";
import { mergePartyBadges } from "@/lib/history-party";
import {
  buildHistoryCourseSearchDoc,
  historyCourseRunMatches,
} from "@/lib/history-course-search";
import {
  type DonatedRunSummary,
  deleteDonatedRun,
  donateRun,
  listMyDonatedRunIds,
  listRecentDonatedRuns,
  updateDonatedRunCoverSpec,
} from "@/lib/run-donation";
import { ensureCoverSpec } from "@/lib/run-cover-suggest";
import type { CoverSpec } from "@/lib/run-cover-types";
import { deleteRun, listOwnRuns, updateRunCoverSpec } from "@/lib/run-store";
import { isBuildSupported, MIN_SUPPORTED_BUILD } from "@/lib/sts2-build-version";
import { parseReplayRun, type ReplayRun } from "@/lib/sts2-run-replay";
import { supabaseEnabled } from "@/lib/supabase";
import { serviceMessages } from "@/messages/service";
import { RandomPickCard } from "./random-pick-card";
import { RunCard, runCardPropsFromReplay } from "./run-card";

interface Props {
  entities: EntityInfo[];
  refreshKey?: number;
  pendingEditRunId?: string | null;
  onPendingEditConsumed?: () => void;
}

interface LocalEntry {
  runId: string;
  raw: string;
  run: ReplayRun;
  noteBlocks?: PostBlock[] | null;
  coverSpec: CoverSpec;
}

interface MergedRun {
  runId: string;
  local?: LocalEntry;
  donated?: DonatedRunSummary;
  sortTime: number;
}

export function HistoryCourseRunIndex({
  entities,
  refreshKey = 0,
  pendingEditRunId = null,
  onPendingEditConsumed,
}: Props) {
  const serviceLocale = useServiceLocale();
  const copy = serviceMessages[serviceLocale].historyCourse.lists;
  const router = useRouter();
  const { userId, ensureUser } = useAuth();
  const [localEntries, setLocalEntries] = useState<LocalEntry[] | null>(null);
  const [donatedRuns, setDonatedRuns] = useState<DonatedRunSummary[] | null>(null);
  const [donatedIds, setDonatedIds] = useState<Set<string>>(new Set());
  const [unavailable, setUnavailable] = useState(false);
  const [editingLocal, setEditingLocal] = useState<LocalEntry | null>(null);
  const [editingDonated, setEditingDonated] = useState<DonatedRunSummary | null>(null);
  const [query, setQuery] = useState("");
  const [selectedGameElements, setSelectedGameElements] = useState<ComboResourceRef[]>([]);

  useEffect(() => {
    let cancelled = false;
    listOwnRuns().then((records) => {
      if (cancelled) return;
      const out: LocalEntry[] = [];
      for (const rec of records) {
        try {
          const run = parseReplayRun(rec.raw);
          const coverSpec = ensureCoverSpec(rec.runId, run, rec.coverSpec);
          if (rec.coverSpec?.auto !== false) {
            void updateRunCoverSpec(rec.runId, coverSpec);
          }
          out.push({
            runId: rec.runId,
            raw: rec.raw,
            run,
            noteBlocks: rec.noteBlocks ?? null,
            coverSpec,
          });
        } catch {
          // skip malformed
        }
      }
      if (!cancelled) setLocalEntries(out);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!supabaseEnabled) {
      setDonatedRuns([]);
      return;
    }
    let cancelled = false;
    setUnavailable(false);
    listRecentDonatedRuns()
      .then((result) => {
        if (!cancelled) setDonatedRuns(result);
      })
      .catch(() => {
        if (cancelled) return;
        setUnavailable(true);
        setDonatedRuns([]);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

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

  useEffect(() => {
    if (!pendingEditRunId || !localEntries) return;
    const hit = localEntries.find((entry) => entry.runId === pendingEditRunId);
    if (hit) {
      setEditingLocal(hit);
      onPendingEditConsumed?.();
    }
  }, [localEntries, onPendingEditConsumed, pendingEditRunId]);

  const merged = useMemo(
    () => mergeIndexRuns(localEntries ?? [], donatedRuns ?? []),
    [donatedRuns, localEntries],
  );
  const searchDocs = useMemo(() => {
    const docs = new Map<string, ReturnType<typeof buildHistoryCourseSearchDoc>>();
    for (const item of merged) {
      const run = item.local?.run ?? parseDonatedReplay(item.donated);
      docs.set(
        item.runId,
        buildHistoryCourseSearchDoc({
          runId: item.runId,
          run,
          donated: item.donated,
          cover: item.local?.coverSpec ?? item.donated?.cover_spec ?? null,
          noteBlocks: item.local?.noteBlocks ?? item.donated?.note_blocks ?? null,
          entities,
        }),
      );
    }
    return docs;
  }, [entities, merged]);
  const searchItems = useMemo(
    () => [...searchDocs.values()].map((doc) => ({ resources: doc.resources })),
    [searchDocs],
  );
  const filtered = useMemo(
    () => merged.filter((item) => {
      const doc = searchDocs.get(item.runId);
      if (!doc) return true;
      return historyCourseRunMatches(doc, query, selectedGameElements, entities);
    }),
    [entities, merged, query, searchDocs, selectedGameElements],
  );

  const handleSaveLocalCover = useCallback(
    async (cover: CoverSpec) => {
      if (!editingLocal) return;
      await updateRunCoverSpec(editingLocal.runId, cover);
      setLocalEntries((prev) =>
        prev?.map((entry) =>
          entry.runId === editingLocal.runId ? { ...entry, coverSpec: cover } : entry,
        ) ?? null,
      );
      setEditingLocal((prev) => (prev ? { ...prev, coverSpec: cover } : null));
      if (supabaseEnabled && donatedIds.has(editingLocal.runId)) {
        const activeUserId = userId ?? (await ensureUser());
        if (activeUserId) {
          await updateDonatedRunCoverSpec({
            runId: editingLocal.runId,
            donorUserId: activeUserId,
            coverSpec: cover,
          });
        }
      }
    },
    [donatedIds, editingLocal, ensureUser, userId],
  );

  const handleSaveDonatedCover = useCallback(
    async (cover: CoverSpec) => {
      if (!editingDonated) return;
      const activeUserId = userId ?? (await ensureUser());
      if (!activeUserId) return;
      const result = await updateDonatedRunCoverSpec({
        runId: editingDonated.id,
        donorUserId: activeUserId,
        coverSpec: cover,
      });
      if (!result.ok) return;
      setDonatedRuns((prev) =>
        prev?.map((entry) =>
          entry.id === editingDonated.id ? { ...entry, cover_spec: cover } : entry,
        ) ?? null,
      );
      setEditingDonated((prev) => (prev ? { ...prev, cover_spec: cover } : null));
    },
    [editingDonated, ensureUser, userId],
  );

  const handlePickLocal = useCallback(
    (entry: LocalEntry) => {
      if (!isBuildSupported(entry.run.build_id)) {
        setLocalEntries((prev) => prev?.filter((e) => e.runId !== entry.runId) ?? null);
        void deleteRun(entry.runId);
        return;
      }
      router.push(`/history-course/${entry.runId}`);
    },
    [router],
  );

  const handleDeleteLocal = useCallback(async (entry: LocalEntry) => {
    setLocalEntries((prev) => prev?.filter((e) => e.runId !== entry.runId) ?? null);
    await deleteRun(entry.runId);
    if (donatedIds.has(entry.runId)) {
      const ok = await deleteDonatedRun(entry.runId);
      if (ok) {
        setDonatedIds((prev) => {
          const next = new Set(prev);
          next.delete(entry.runId);
          return next;
        });
        setDonatedRuns((prev) => prev?.filter((run) => run.id !== entry.runId) ?? null);
      }
    }
  }, [donatedIds]);

  const handleUnshareDonated = useCallback(async (runId: string) => {
    if (!window.confirm(copy.undoConfirm)) return;
    const ok = await deleteDonatedRun(runId);
    if (!ok) return;
    setDonatedRuns((prev) => prev?.filter((run) => run.id !== runId) ?? null);
    setDonatedIds((prev) => {
      const next = new Set(prev);
      next.delete(runId);
      return next;
    });
  }, [copy.undoConfirm]);

  const handleShare = useCallback(
    async (entry: LocalEntry) => {
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
          setDonatedRuns((prev) => prev?.filter((run) => run.id !== entry.runId) ?? null);
        }
        return;
      }
      const result = await donateRun({
        runId: entry.runId,
        raw: entry.raw,
        run: entry.run,
        donorUserId: activeUserId,
        coverSpec: entry.coverSpec,
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

  const editingDonatedParsed = useMemo(() => {
    if (!editingDonated?.raw) return null;
    try {
      const run = parseReplayRun(editingDonated.raw);
      return {
        run,
        cover: ensureCoverSpec(editingDonated.id, run, editingDonated.cover_spec),
      };
    } catch {
      return null;
    }
  }, [editingDonated]);

  const localReady = localEntries !== null;
  const sharedReady = donatedRuns !== null;
  const loading = !localReady || !sharedReady;
  const hasQuery = query.trim().length > 0 || selectedGameElements.length > 0;
  const donatedForRandom = donatedRuns ?? [];

  return (
    <section>
      <div className="mb-4 max-w-2xl">
        <ComboGameElementFilter
          entities={entities}
          items={searchItems}
          selected={selectedGameElements}
          serviceLocale={serviceLocale}
          onSelectedChange={setSelectedGameElements}
          onQueryChange={setQuery}
          labels={{
            filterSearchPlaceholder: copy.searchPlaceholder,
            gameElementsInPosts: copy.gameElementsInRuns,
            noGameElementsInPosts: copy.noGameElementsInRuns,
            popularGameElements: copy.popularGameElements,
            applyPopularGameElement: copy.applyPopularGameElement,
            removePopularGameElement: copy.removePopularGameElement,
          }}
        />
      </div>
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">
          {copy.minBuild.replace("{version}", MIN_SUPPORTED_BUILD.replace(/^v/, ""))}
        </p>
        {!loading && !unavailable && (
          <span className="text-xs text-muted-foreground">
            {filtered.length > 99 ? "99+" : filtered.length}
          </span>
        )}
      </header>
      {unavailable ? (
        <StorageUnavailableNotice title={copy.unavailableTitle} />
      ) : null}
      {loading ? (
        <ContentLoadingNotice label={copy.loadingRuns} />
      ) : localEntries.length === 0 && donatedForRandom.length === 0 ? (
        <p className="rounded-xl bg-zinc-900/40 px-4 py-6 text-center text-xs text-zinc-500 ring-1 ring-zinc-800">
          {copy.empty}
        </p>
      ) : (
        <ul className="grid gap-x-4 gap-y-8 overflow-visible sm:grid-cols-2 lg:grid-cols-3">
          {supabaseEnabled && !unavailable ? (
            <li>
              <RandomPickCard runs={donatedForRandom} userId={userId} />
            </li>
          ) : null}
          {hasQuery && filtered.length === 0 ? (
            <li className="rounded-xl bg-zinc-900/40 px-4 py-6 text-center text-xs text-zinc-500 ring-1 ring-zinc-800 sm:col-span-2 lg:col-span-3">
              {copy.noResults}
            </li>
          ) : null}
          {filtered.map((item) => {
            const local = item.local;
            const donated = item.donated;
            const ownedLocally = Boolean(local);
            const isOwner =
              ownedLocally ||
              Boolean(userId && donated?.donor_user_id === userId);
            const shared = donatedIds.has(item.runId) || Boolean(donated);
            return (
              <li key={item.runId}>
                {local ? (
                  <RunCard
                    {...runCardPropsFromReplay(local.run, local.runId, local.coverSpec)}
                    noteBlocks={local.noteBlocks}
                    isOwner={isOwner}
                    ownedLocally
                    onPick={() => handlePickLocal(local)}
                    onDelete={() => handleDeleteLocal(local)}
                    onEditCover={() => setEditingLocal(local)}
                    onShare={
                      supabaseEnabled
                        ? () => handleShare(local)
                        : undefined
                    }
                    shareState={shared ? "shared" : "none"}
                  />
                ) : donated ? (
                  <RunCard
                    runId={donated.id}
                    character={donated.character}
                    characters={donated.characters}
                    ascension={donated.ascension}
                    build={donated.build}
                    seed={donated.seed}
                    win={donated.win}
                    totalFloors={donated.total_floors}
                    runTimeSeconds={donated.run_time}
                    startTimeUnix={donated.start_time}
                    badges={donated.badges ?? []}
                    coverSpec={donated.cover_spec}
                    noteBlocks={donated.note_blocks}
                    isOwner={isOwner}
                    ownedLocally={false}
                    onPick={() => router.push(`/history-course/${donated.id}`)}
                    onDelete={
                      isOwner ? () => handleUnshareDonated(donated.id) : undefined
                    }
                    onEditCover={
                      isOwner && donated.raw
                        ? () => setEditingDonated(donated)
                        : undefined
                    }
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {editingLocal && (
        <CoverEditorSheet
          open={!!editingLocal}
          onOpenChange={(open) => {
            if (!open) setEditingLocal(null);
          }}
          runId={editingLocal.runId}
          run={editingLocal.run}
          character={editingLocal.run.players[0]?.character ?? ""}
          meta={{
            win: editingLocal.run.win,
            totalFloors: editingLocal.run.map_point_history.reduce(
              (sum, act) => sum + act.length,
              0,
            ),
            ascension: editingLocal.run.ascension,
            build: editingLocal.run.build_id,
            seed: editingLocal.run.seed,
            runTimeSeconds: editingLocal.run.run_time ?? null,
            badges: mergePartyBadges(editingLocal.run),
          }}
          initialCover={editingLocal.coverSpec}
          onSave={handleSaveLocalCover}
        />
      )}

      {editingDonated && editingDonatedParsed && (
        <CoverEditorSheet
          open
          onOpenChange={(open) => {
            if (!open) setEditingDonated(null);
          }}
          runId={editingDonated.id}
          run={editingDonatedParsed.run}
          character={editingDonated.character}
          meta={{
            win: editingDonated.win,
            totalFloors: editingDonated.total_floors,
            ascension: editingDonated.ascension,
            build: editingDonated.build,
            seed: editingDonated.seed,
            runTimeSeconds: editingDonated.run_time,
            badges: editingDonated.badges ?? [],
          }}
          initialCover={editingDonatedParsed.cover}
          onSave={handleSaveDonatedCover}
        />
      )}
    </section>
  );
}

function mergeIndexRuns(
  localEntries: LocalEntry[],
  donatedRuns: DonatedRunSummary[],
): MergedRun[] {
  const byId = new Map<string, MergedRun>();
  for (const local of localEntries) {
    byId.set(local.runId, {
      runId: local.runId,
      local,
      sortTime: local.run.start_time ?? 0,
    });
  }
  for (const donated of donatedRuns) {
    const existing = byId.get(donated.id);
    const donatedTime = (donated.start_time ?? Date.parse(donated.created_at)) || 0;
    if (existing) {
      existing.donated = donated;
      existing.sortTime = Math.max(existing.sortTime, donatedTime);
    } else {
      byId.set(donated.id, {
        runId: donated.id,
        donated,
        sortTime: donatedTime,
      });
    }
  }
  return [...byId.values()].sort((a, b) => b.sortTime - a.sortTime);
}

function parseDonatedReplay(donated: DonatedRunSummary | undefined): ReplayRun | null {
  if (!donated?.raw) return null;
  try {
    return parseReplayRun(donated.raw);
  } catch {
    return null;
  }
}

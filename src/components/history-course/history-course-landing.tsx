"use client";

import { useCallback, useState } from "react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";
import { HistoryCourseRunIndex } from "./history-course-run-index";
import { ProdRunsDevSection } from "./prod-runs-dev-section";
import { RunUploadZone } from "./run-upload-zone";
import { UploadTutorial } from "./upload-tutorial";

interface HistoryCourseLandingProps {
  entities: EntityInfo[];
}

export function HistoryCourseLanding({ entities }: HistoryCourseLandingProps) {
  const serviceLocale = useServiceLocale();
  const coverCopy = serviceMessages[serviceLocale].historyCourse.coverEditor;
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingEditRunId, setPendingEditRunId] = useState<string | null>(null);
  const [polishRunId, setPolishRunId] = useState<string | null>(null);

  const onUploadComplete = useCallback((payload: { count: number; latestRunId?: string }) => {
    setRefreshKey((k) => k + 1);
    if (payload.latestRunId) setPolishRunId(payload.latestRunId);
  }, []);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <RunUploadZone onUploadComplete={onUploadComplete} />
        {polishRunId && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/5 px-3 py-2 text-xs text-amber-100/90">
            <span className="min-w-0 flex-1">{coverCopy.polishBanner}</span>
            <button
              type="button"
              onClick={() => {
                setPendingEditRunId(polishRunId);
                setPolishRunId(null);
              }}
              className="rounded-md bg-amber-300/90 px-2.5 py-1 font-bold text-zinc-950 hover:bg-amber-200"
            >
              {coverCopy.polishAction}
            </button>
            <button
              type="button"
              onClick={() => setPolishRunId(null)}
              className="rounded-md px-2 py-1 text-zinc-400 hover:text-zinc-200"
            >
              {coverCopy.polishDismiss}
            </button>
          </div>
        )}
        <UploadTutorial />
      </div>
      <HistoryCourseRunIndex
        entities={entities}
        refreshKey={refreshKey}
        pendingEditRunId={pendingEditRunId}
        onPendingEditConsumed={() => setPendingEditRunId(null)}
      />
      <ProdRunsDevSection />
    </div>
  );
}

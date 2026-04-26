"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MapBackdrop,
  SeededMapView,
} from "@/components/dev/run-replay-poc";
import { analyzeReplayRun, type ReplayRun } from "@/lib/sts2-run-replay";
import { cn } from "@/lib/utils";

const NAV_OFFSET_PX = 49;
const CONTAINER_WIDTH = `min(100vw, calc((100dvh - ${NAV_OFFSET_PX}px) * 16 / 9), 1600px)` as const;

export function HistoryCourseShell({ run }: { run: ReplayRun }) {
  const analysis = useMemo(() => analyzeReplayRun(run), [run]);
  const [actIndex, setActIndex] = useState(0);
  const [debugOpen, setDebugOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  const act = analysis.acts[actIndex] ?? null;
  if (!act) {
    return (
      <div className="flex h-[calc(100dvh-49px)] items-center justify-center text-sm text-zinc-400">
        분석 가능한 막이 없습니다.
      </div>
    );
  }

  return (
    <div className="relative isolate overflow-hidden bg-black">
      <ServiceBackdrop actId={act.actId} />

      <div className="relative z-10 flex h-[calc(100dvh-49px)] w-full items-center justify-center">
        <MapStage
          act={act}
          onToggleStats={() => setStatsOpen((value) => !value)}
        />
      </div>

      <DebugToggle open={debugOpen} onToggle={() => setDebugOpen((v) => !v)} />
      <DebugDrawer
        open={debugOpen}
        onClose={() => setDebugOpen(false)}
        analysis={analysis}
        actIndex={actIndex}
        onActIndexChange={setActIndex}
        run={run}
      />

      <StatsModal
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
        analysis={analysis}
        run={run}
      />
    </div>
  );
}

function ServiceBackdrop({ actId }: { actId: string }) {
  return (
    <div className="absolute inset-0 -z-0">
      <div className="absolute inset-0 scale-110 opacity-50 blur-2xl">
        <MapBackdrop actId={actId} />
      </div>
      <div className="absolute inset-0 bg-black/70" />
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.85) 100%)",
        }}
      />
    </div>
  );
}

function MapStage({
  act,
  onToggleStats,
}: {
  act: ReturnType<typeof analyzeReplayRun>["acts"][number];
  onToggleStats: () => void;
}) {
  const step = act.history.length;

  return (
    <div
      className="relative overflow-hidden rounded-xl ring-1 ring-white/10 shadow-[0_30px_120px_-30px_rgba(0,0,0,0.9)]"
      style={{
        width: CONTAINER_WIDTH,
        aspectRatio: "16 / 9",
      }}
    >
      <TopBarPlaceholder act={act} onToggleStats={onToggleStats} />

      <div className="absolute inset-0 overflow-auto pt-10">
        <div className="flex min-h-full justify-center">
          <SeededMapView act={act} step={step} />
        </div>
      </div>
    </div>
  );
}

function TopBarPlaceholder({
  act,
  onToggleStats,
}: {
  act: ReturnType<typeof analyzeReplayRun>["acts"][number];
  onToggleStats: () => void;
}) {
  return (
    <div className="absolute inset-x-0 top-0 z-20 flex h-10 items-center justify-between border-b border-white/10 bg-black/55 px-3 text-[11px] uppercase tracking-[0.18em] text-zinc-300 backdrop-blur-sm">
      <div>
        상단바 placeholder · <span className="text-zinc-100">{act.actLabel}</span>
      </div>
      <div className="flex items-center gap-2 normal-case tracking-normal">
        <button
          type="button"
          onClick={onToggleStats}
          className="rounded-md border border-white/15 px-2 py-0.5 text-[11px] text-zinc-200 transition hover:bg-white/10"
        >
          통계
        </button>
      </div>
    </div>
  );
}

function DebugToggle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label="디버그 패널 토글"
      aria-expanded={open}
      onClick={onToggle}
      className={cn(
        "fixed right-0 top-1/2 z-30 -translate-y-1/2 rounded-l-md border border-r-0 border-white/15 bg-zinc-950/85 px-2 py-3 text-[10px] uppercase tracking-[0.2em] text-zinc-300 backdrop-blur-sm transition hover:bg-zinc-900",
        "[writing-mode:vertical-rl]",
        open && "translate-x-[-340px] bg-zinc-900",
      )}
    >
      디버그
    </button>
  );
}

function DebugDrawer({
  open,
  onClose,
  analysis,
  actIndex,
  onActIndexChange,
  run,
}: {
  open: boolean;
  onClose: () => void;
  analysis: ReturnType<typeof analyzeReplayRun>;
  actIndex: number;
  onActIndexChange: (index: number) => void;
  run: ReplayRun;
}) {
  const exactActs = analysis.acts.filter((a) => a.exactReplay).length;
  const zeroActs = analysis.acts.filter((a) => a.matchedPathCount === 0).length;
  const replayLabel =
    zeroActs > 0
      ? `Zero Match ${zeroActs}/${analysis.acts.length}`
      : exactActs === analysis.acts.length
        ? `Exact ${exactActs}/${analysis.acts.length}`
        : `Mixed ${exactActs}/${analysis.acts.length}`;

  return (
    <aside
      aria-hidden={!open}
      className={cn(
        "fixed right-0 top-[49px] z-30 h-[calc(100dvh-49px)] w-[340px] overflow-y-auto border-l border-white/10 bg-zinc-950/95 p-4 backdrop-blur-md transition-transform duration-200",
        open ? "translate-x-0" : "translate-x-full",
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-400">
          디버그
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-white/10 px-2 py-0.5 text-xs text-zinc-300 hover:bg-white/10"
        >
          닫기
        </button>
      </div>

      <dl className="mt-4 space-y-2 text-xs text-zinc-300">
        <Row label="시드" value={run.seed} />
        <Row label="승천" value={`A${run.ascension}`} />
        <Row label="빌드" value={run.build_id} />
        <Row label="캐릭터" value={run.players[0]?.character ?? "?"} />
        <Row label="결과" value={run.win ? "Win" : "Loss"} />
        <Row label="Replay" value={replayLabel} />
      </dl>

      <div className="mt-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">막</p>
        <ul className="mt-2 space-y-1.5">
          {analysis.acts.map((act, idx) => {
            const tone =
              act.matchedPathCount === 0
                ? "border-red-400/40 text-red-200"
                : act.exactReplay
                  ? "border-emerald-400/40 text-emerald-200"
                  : "border-amber-400/40 text-amber-200";
            return (
              <li key={`${act.actId}-${act.actIndex}`}>
                <button
                  type="button"
                  onClick={() => onActIndexChange(idx)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition",
                    idx === actIndex
                      ? "border-amber-300/60 bg-amber-500/10 text-amber-100"
                      : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-600",
                  )}
                  aria-current={idx === actIndex ? "true" : undefined}
                >
                  <span className="truncate">{act.actLabel}</span>
                  <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px]", tone)}>
                    {act.matchedPathCount === 0
                      ? "Zero"
                      : act.exactReplay
                        ? "Exact"
                        : `${act.matchedPathCount}+`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {analysis.warnings.length > 0 && (
        <div className="mt-5 rounded-md border border-amber-500/20 bg-amber-500/5 p-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-amber-300">
            Warnings
          </p>
          <ul className="mt-2 space-y-1.5 text-xs text-zinc-300">
            {analysis.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </dt>
      <dd className="truncate text-zinc-200">{value}</dd>
    </div>
  );
}

function StatsModal({
  open,
  onClose,
  analysis,
  run,
}: {
  open: boolean;
  onClose: () => void;
  analysis: ReturnType<typeof analyzeReplayRun>;
  run: ReplayRun;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-6">
      <button
        type="button"
        aria-label="모달 닫기"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/65 backdrop-blur-[2px]"
      />
      <div className="relative z-10 w-full max-w-3xl rounded-xl border border-white/15 bg-zinc-950/95 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight text-zinc-50">
            도전 이력
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/10 px-2 py-0.5 text-xs text-zinc-300 hover:bg-white/10"
          >
            닫기
          </button>
        </div>
        <p className="mt-2 text-sm text-zinc-400">
          시드 {run.seed} · A{run.ascension} · {run.players[0]?.character}
        </p>
        <div className="mt-5 grid gap-3 text-xs text-zinc-400">
          <p>막 미니어처, 유물/카드 그리드는 작업 1c/3 에서 채웁니다.</p>
          <ul className="grid gap-1.5">
            {analysis.acts.map((act) => (
              <li key={`${act.actId}-${act.actIndex}`} className="flex justify-between">
                <span>{act.actLabel}</span>
                <span className="text-zinc-500">
                  {act.history.length} floor · {act.matchedPathCount} candidate
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

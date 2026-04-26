"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapBackdrop,
  SeededMapView,
} from "@/components/dev/run-replay-poc";
import { analyzeReplayRun, type ReplayRun } from "@/lib/sts2-run-replay";
import { cn } from "@/lib/utils";

type Analysis = ReturnType<typeof analyzeReplayRun>;
type Act = Analysis["acts"][number];

const NAV_OFFSET_PX = 49;
const STAGE_WIDTH = `min(100vw, calc((100dvh - ${NAV_OFFSET_PX}px) * 16 / 9), 1600px)` as const;
const PLAYBACK_RATES = [1, 2, 4, 8, 16] as const;
type Rate = (typeof PLAYBACK_RATES)[number];

const ACT_INTRO_FADE_IN_MS = 600;
const ACT_INTRO_HOLD_MS = 1500;
const ACT_INTRO_FADE_OUT_MS = 500;

function actIntroNumber(index: number) {
  return ["1막", "2막", "3막", "4막"][index] ?? `${index + 1}막`;
}

function stepActivitySeconds(entry: Act["history"][number]): number {
  const rooms = entry.rooms ?? [];
  let total = 0;
  for (const room of rooms) total += Math.max(0, room.turns_taken ?? 0) * 6;
  return Math.max(8, total);
}

export function HistoryCourseShell({ run }: { run: ReplayRun }) {
  const analysis = useMemo(() => analyzeReplayRun(run), [run]);
  const [actIndex, setActIndex] = useState(0);
  const [step, setStep] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [rate, setRate] = useState<Rate>(2);
  const [infoOpen, setInfoOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [introToken, setIntroToken] = useState(0);

  const act = analysis.acts[actIndex] ?? null;
  const stepCount = act ? act.history.length : 0;

  useEffect(() => {
    setIntroToken((t) => t + 1);
    setStep(1);
  }, [actIndex]);

  useEffect(() => {
    if (!playing || !act) return;
    const next = act.history[step];
    if (!next) {
      const hasNextAct = actIndex + 1 < analysis.acts.length;
      if (hasNextAct) {
        const t = window.setTimeout(() => setActIndex((i) => i + 1), 800);
        return () => window.clearTimeout(t);
      }
      return;
    }
    const seconds = stepActivitySeconds(next);
    const ms = Math.max(180, Math.round((seconds * 60) / rate));
    const timer = window.setTimeout(() => {
      setStep((prev) => Math.min(prev + 1, act.history.length));
    }, ms);
    return () => window.clearTimeout(timer);
  }, [playing, step, rate, act, actIndex, analysis.acts.length]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLElement) {
        const tag = event.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || event.target.isContentEditable) return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        setPlaying((v) => !v);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setPlaying(false);
        setStep((s) => (act ? Math.min(s + 1, act.history.length) : s));
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setPlaying(false);
        setStep((s) => Math.max(1, s - 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [act]);

  const onSelectAct = useCallback((idx: number) => {
    setActIndex(idx);
    setPlaying(true);
  }, []);

  const onRestart = useCallback(() => {
    setStep(1);
    setIntroToken((t) => t + 1);
    setPlaying(true);
  }, []);

  if (!act) {
    return (
      <div className="flex h-[calc(100dvh-49px)] items-center justify-center bg-black text-sm text-zinc-400">
        분석 가능한 막이 없습니다.
      </div>
    );
  }

  return (
    <div className="relative isolate overflow-hidden bg-black">
      <SceneBackdrop actId={act.actId} />

      <div className="relative z-10 flex h-[calc(100dvh-49px)] w-full items-center justify-center">
        <Stage
          act={act}
          actIndex={actIndex}
          step={step}
          totalActs={analysis.acts.length}
          introToken={introToken}
          playing={playing}
          rate={rate}
          onTogglePlay={() => setPlaying((v) => !v)}
          onRestart={onRestart}
          onChangeRate={setRate}
          onScrub={(value) => {
            setPlaying(false);
            setStep(value);
          }}
          onOpenStats={() => setStatsOpen(true)}
        />
      </div>

      <SideToggle open={infoOpen} onToggle={() => setInfoOpen((v) => !v)} />
      <InfoDrawer
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        analysis={analysis}
        actIndex={actIndex}
        onSelectAct={onSelectAct}
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

function SceneBackdrop({ actId }: { actId: string }) {
  return (
    <div className="absolute inset-0 -z-0">
      <div className="absolute inset-0 scale-110 opacity-50 blur-2xl">
        <MapBackdrop actId={actId} />
      </div>
      <div className="absolute inset-0 bg-black/70" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.85) 100%)",
        }}
      />
    </div>
  );
}

function Stage({
  act,
  actIndex,
  step,
  totalActs,
  introToken,
  playing,
  rate,
  onTogglePlay,
  onRestart,
  onChangeRate,
  onScrub,
  onOpenStats,
}: {
  act: Act;
  actIndex: number;
  step: number;
  totalActs: number;
  introToken: number;
  playing: boolean;
  rate: Rate;
  onTogglePlay: () => void;
  onRestart: () => void;
  onChangeRate: (rate: Rate) => void;
  onScrub: (step: number) => void;
  onOpenStats: () => void;
}) {
  const mapBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = mapBoxRef.current;
    if (!node) return;
    const inner = node.firstElementChild as HTMLElement | null;
    if (!inner) return;
    const total = inner.scrollHeight - node.clientHeight;
    if (total <= 0) {
      node.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const progress = act.history.length > 1 ? (step - 1) / (act.history.length - 1) : 1;
    const target = Math.round((1 - progress) * total);
    node.scrollTo({ top: target, behavior: "smooth" });
  }, [step, act]);

  return (
    <div
      className="relative overflow-hidden rounded-xl ring-1 ring-white/10 shadow-[0_30px_120px_-30px_rgba(0,0,0,0.9)]"
      style={{ width: STAGE_WIDTH, aspectRatio: "16 / 9" }}
    >
      <TopBar act={act} onOpenStats={onOpenStats} />

      <div ref={mapBoxRef} className="absolute inset-0 overflow-hidden pt-10">
        <div className="flex min-h-full justify-center">
          <SeededMapView act={act} step={step} />
        </div>
      </div>

      <ActIntro key={introToken} actIndex={actIndex} act={act} totalActs={totalActs} />

      <PlaybackBar
        step={step}
        stepCount={act.history.length}
        playing={playing}
        rate={rate}
        onTogglePlay={onTogglePlay}
        onRestart={onRestart}
        onChangeRate={onChangeRate}
        onScrub={onScrub}
      />
    </div>
  );
}

function TopBar({ act, onOpenStats }: { act: Act; onOpenStats: () => void }) {
  return (
    <div className="absolute inset-x-0 top-0 z-20 flex h-10 items-center justify-between bg-gradient-to-b from-black/70 to-black/0 px-4 text-sm text-zinc-100">
      <div className="font-bold tracking-tight">{act.actLabel}</div>
      <button
        type="button"
        onClick={onOpenStats}
        className="rounded-md border border-white/15 bg-black/30 px-2.5 py-1 text-xs text-zinc-200 transition hover:bg-white/10"
      >
        도전 이력
      </button>
    </div>
  );
}

function ActIntro({
  actIndex,
  act,
  totalActs,
}: {
  actIndex: number;
  act: Act;
  totalActs: number;
}) {
  const [phase, setPhase] = useState<"in" | "hold" | "out" | "done">("in");

  useEffect(() => {
    setPhase("in");
    const t1 = window.setTimeout(() => setPhase("hold"), ACT_INTRO_FADE_IN_MS);
    const t2 = window.setTimeout(
      () => setPhase("out"),
      ACT_INTRO_FADE_IN_MS + ACT_INTRO_HOLD_MS,
    );
    const t3 = window.setTimeout(
      () => setPhase("done"),
      ACT_INTRO_FADE_IN_MS + ACT_INTRO_HOLD_MS + ACT_INTRO_FADE_OUT_MS,
    );
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, []);

  if (phase === "done") return null;

  const opacity = phase === "in" ? 0.05 : phase === "hold" ? 1 : 0;
  const transition =
    phase === "in"
      ? `opacity ${ACT_INTRO_FADE_IN_MS}ms ease-out`
      : phase === "out"
        ? `opacity ${ACT_INTRO_FADE_OUT_MS}ms ease-in`
        : "opacity 0ms";

  return (
    <div
      className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60"
      style={{ opacity: phase === "in" ? 1 : phase === "out" ? 0 : 1, transition: `background-color ${ACT_INTRO_FADE_OUT_MS}ms ease-in` }}
    >
      <div
        className="text-center text-white"
        style={{ opacity, transition }}
      >
        <div className="text-xs uppercase tracking-[0.4em] text-zinc-300">
          {actIntroNumber(actIndex)} / {totalActs}막
        </div>
        <div className="mt-3 text-5xl font-black tracking-tight drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)]">
          {act.actLabel}
        </div>
      </div>
    </div>
  );
}

function PlaybackBar({
  step,
  stepCount,
  playing,
  rate,
  onTogglePlay,
  onRestart,
  onChangeRate,
  onScrub,
}: {
  step: number;
  stepCount: number;
  playing: boolean;
  rate: Rate;
  onTogglePlay: () => void;
  onRestart: () => void;
  onChangeRate: (rate: Rate) => void;
  onScrub: (step: number) => void;
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 bg-gradient-to-t from-black/85 to-black/0 px-4 pb-3 pt-8 text-zinc-100">
      <input
        type="range"
        min={1}
        max={stepCount}
        value={step}
        onChange={(event) => onScrub(Number(event.target.value))}
        className="w-full accent-amber-300"
      />
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePlay}
            className="flex h-7 w-12 items-center justify-center rounded-md border border-white/20 bg-black/40 hover:bg-white/10"
            aria-label={playing ? "일시정지" : "재생"}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="rounded-md border border-white/15 bg-black/30 px-2 py-1 text-xs hover:bg-white/10"
          >
            처음부터
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-400">{step}/{stepCount}</span>
          <div className="ml-2 inline-flex overflow-hidden rounded-md border border-white/15 bg-black/30">
            {PLAYBACK_RATES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onChangeRate(r)}
                className={cn(
                  "px-2 py-1 transition",
                  rate === r
                    ? "bg-amber-500/30 text-amber-100"
                    : "text-zinc-300 hover:bg-white/10",
                )}
                aria-pressed={rate === r}
              >
                {r}×
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M3 1.5 L12 7 L3 12.5 Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="2.5" y="1.5" width="3.2" height="11" />
      <rect x="8.3" y="1.5" width="3.2" height="11" />
    </svg>
  );
}

function SideToggle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label="런 정보 패널"
      aria-expanded={open}
      onClick={onToggle}
      className={cn(
        "fixed right-0 top-1/2 z-30 -translate-y-1/2 rounded-l-md border border-r-0 border-white/15 bg-zinc-950/85 px-2 py-3 text-zinc-300 backdrop-blur-sm transition hover:bg-zinc-900",
        open && "translate-x-[-340px] bg-zinc-900",
      )}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M3 3.5 H13 M3 8 H13 M3 12.5 H10" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function InfoDrawer({
  open,
  onClose,
  analysis,
  actIndex,
  onSelectAct,
  run,
}: {
  open: boolean;
  onClose: () => void;
  analysis: Analysis;
  actIndex: number;
  onSelectAct: (idx: number) => void;
  run: ReplayRun;
}) {
  const character = run.players[0]?.character?.split(".").pop() ?? "?";
  return (
    <aside
      aria-hidden={!open}
      className={cn(
        "fixed right-0 top-[49px] z-30 h-[calc(100dvh-49px)] w-[340px] overflow-y-auto border-l border-white/10 bg-zinc-950/95 p-4 backdrop-blur-md transition-transform duration-200",
        open ? "translate-x-0" : "translate-x-full",
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-zinc-100">런 정보</p>
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
        <Row label="캐릭터" value={character} />
        <Row label="결과" value={run.win ? "승리" : "패배"} />
      </dl>

      <div className="mt-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">막</p>
        <ul className="mt-2 space-y-1.5">
          {analysis.acts.map((act, idx) => (
            <li key={`${act.actId}-${act.actIndex}`}>
              <button
                type="button"
                onClick={() => onSelectAct(idx)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition",
                  idx === actIndex
                    ? "border-amber-300/60 bg-amber-500/10 text-amber-100"
                    : "border-zinc-800 bg-zinc-950/40 text-zinc-300 hover:border-zinc-600",
                )}
                aria-current={idx === actIndex ? "true" : undefined}
              >
                <span className="truncate">{act.actLabel}</span>
                <span className="text-zinc-500">{act.history.length}층</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
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
  analysis: Analysis;
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

  const character = run.players[0]?.character?.split(".").pop() ?? "?";
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-6">
      <button
        type="button"
        aria-label="닫기"
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
          시드 {run.seed} · A{run.ascension} · {character} · {run.win ? "승리" : "패배"}
        </p>
        <ul className="mt-5 grid gap-1.5 text-xs">
          {analysis.acts.map((act) => (
            <li
              key={`${act.actId}-${act.actIndex}`}
              className="flex justify-between border-b border-white/5 pb-1.5 text-zinc-300"
            >
              <span>{act.actLabel}</span>
              <span className="text-zinc-500">{act.history.length}층</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  blitzMerchantStateAt,
  runBlitzMerchant,
  type BlitzMerchantData,
  type BlitzMerchantInput,
} from "@/lib/node-sim/blitz-merchant";
import { BlitzMerchantStage, STAGE_H, STAGE_W, stateLayout, type BlitzMerchantStageView } from "./blitz-merchant-stage";
import type { SpineStatus } from "./placed-spine";

export interface NodeSimView {
  input: BlitzMerchantInput;
  preset: string | null;
  data: BlitzMerchantData;
  warnings: string[];
  stage: BlitzMerchantStageView;
  options: { t: number | "end" | null; autoplay: boolean; frame: number };
}

/** The same handle /dev/combat-sim puts on `window.__sim`, so `pnpm shorts:capture` drives both. */
interface NodeSimHandle {
  version: 1;
  node: string;
  input: BlitzMerchantInput;
  duration: number;
  actionEnds: number[];
  ready(): Promise<boolean>;
  seek(t: number): Promise<NodeSimSnapshot>;
  step(): Promise<NodeSimSnapshot>;
  play(): void;
  pause(): void;
  state(): NodeSimSnapshot;
  frameTimes(fps?: number): number[];
}

interface NodeSimSnapshot {
  node: string;
  t: number;
  open: boolean;
  hovered: string | null;
  stock: { type: string; status: string }[];
  remaining: number;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
    setTimeout(resolve, 100);
  });
}

export function NodeSimClient({ view, errors }: { view: NodeSimView; errors: string[] }) {
  const [failure, result] = useMemo(() => {
    try {
      return [null, runBlitzMerchant(view.input, view.data)] as const;
    } catch (error) {
      return [error instanceof Error ? error.message : String(error), null] as const;
    }
  }, [view.input, view.data]);
  const layout = useMemo(() => stateLayout(view.stage.layout), [view.stage.layout]);
  const duration = result?.duration ?? 0;
  const initialT = view.options.t === "end" ? duration : Math.min(view.options.t ?? 0, duration);
  const [t, setT] = useState(initialT);
  const [playing, setPlaying] = useState(false);
  const [devicePixelRatio, setDevicePixelRatio] = useState(1);
  const tRef = useRef(t);
  tRef.current = t;
  const stageRef = useRef<HTMLDivElement>(null);
  const spinesRef = useRef(new Map<string, SpineStatus>());
  const [, setSpinesVersion] = useState(0);
  const frameScale = view.options.frame / STAGE_W;

  useEffect(() => {
    // After hydration: the server render has no window.
    const frame = requestAnimationFrame(() => {
      setDevicePixelRatio(window.devicePixelRatio || 1);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (view.options.autoplay || (view.options.t === null && !reduced)) setPlaying(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [view.options.autoplay, view.options.t]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const next = Math.min(duration, tRef.current + (now - last));
      last = now;
      setT(next);
      if (next >= duration) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, duration]);

  const onSpineStatus = useCallback((id: string, status: SpineStatus) => {
    spinesRef.current.set(id, status);
    setSpinesVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    if (!result) return;
    const clamp = (value: number) => Math.max(0, Math.min(result.duration, value));
    const decodeImages = () => Promise.all([...(stageRef.current?.querySelectorAll("img") ?? [])].map((image) => image.decode().catch(() => undefined)));
    const snapshot = (time: number): NodeSimSnapshot => {
      const state = blitzMerchantStateAt(result, layout, time);
      return {
        node: result.input.node,
        t: time,
        open: state.open,
        hovered: state.hovered === null ? null : result.stock[state.hovered].type,
        stock: result.stock.map((entry, i) => ({ type: entry.type, status: state.slots[i].status })),
        remaining: state.remaining,
      };
    };
    const handle: NodeSimHandle = {
      version: 1,
      node: result.input.node,
      input: result.input,
      duration: result.duration,
      actionEnds: result.actionEnds,
      async ready() {
        await document.fonts.ready;
        const deadline = performance.now() + 30_000;
        for (;;) {
          const spinesDone = spinesRef.current.size >= (view.stage.options.isolate ? 1 : 2) && [...spinesRef.current.values()].every((status) => status !== "loading");
          const images = [...(stageRef.current?.querySelectorAll("img") ?? [])];
          if (spinesDone && images.every((image) => image.complete)) break;
          if (performance.now() > deadline) throw new Error("node-sim: assets did not load within 30s");
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        await decodeImages();
        await nextFrame();
        await nextFrame();
        return true;
      },
      async seek(value) {
        if (!Number.isFinite(value)) throw new Error(`__sim.seek needs a finite time in ms, got ${String(value)}`);
        flushSync(() => {
          setPlaying(false);
          setT(clamp(value));
        });
        await decodeImages();
        // A token position reported by the Spine draw re-renders once more.
        await nextFrame();
        await nextFrame();
        return snapshot(tRef.current);
      },
      async step() {
        const next = result.actionEnds.find((end) => end > tRef.current + 0.5) ?? result.duration;
        return handle.seek(next);
      },
      play() {
        if (tRef.current >= result.duration) setT(0);
        setPlaying(true);
      },
      pause() {
        setPlaying(false);
      },
      state() {
        return snapshot(tRef.current);
      },
      frameTimes(fps = 30) {
        const count = Math.floor((result.duration / 1000) * fps) + 1;
        return Array.from({ length: count }, (_, index) => Math.min(result.duration, (index * 1000) / fps));
      },
    };
    window.__sim = handle as unknown as Window["__sim"];
    return () => {
      if ((window.__sim as unknown) === handle) delete window.__sim;
    };
  }, [result, layout, view.stage.options.isolate]);

  if (!result) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-8 text-sm text-zinc-300">
        <h1 className="text-xl font-bold text-zinc-100">노드 시뮬레이터</h1>
        <ul className="rounded border border-red-400/30 bg-red-500/10 px-3 py-2 text-red-100">
          {[...errors, failure].map((line) => <li key={line}>{line}</li>)}
        </ul>
        <p>입력과 노드 추가 방법은 <code>docs/NODE_SIM.md</code>에 있습니다.</p>
      </main>
    );
  }

  const state = blitzMerchantStateAt(result, layout, t);
  const warnings = [...new Set([...errors, ...view.warnings, ...result.warnings])];

  return (
    <main className="flex w-full flex-col gap-6 px-4 py-6 lg:flex-row lg:items-start">
      <div
        ref={stageRef}
        data-node-sim-stage=""
        data-version={result.input.version}
        data-game-locale={result.input.locale}
        className="relative shrink-0 overflow-hidden"
        style={{ width: view.options.frame, height: (view.options.frame * STAGE_H) / STAGE_W }}
      >
        <div className="absolute left-0 top-0" style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${frameScale})`, transformOrigin: "0 0" }}>
          <BlitzMerchantStage
            view={view.stage}
            result={result}
            state={state}
            pixelRatio={frameScale * devicePixelRatio}
            locale={result.input.locale}
            onSpineStatus={onSpineStatus}
          />
        </div>
      </div>

      <section className="flex min-w-0 flex-1 flex-col gap-4 text-sm text-zinc-300">
        <header className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300/80">DEV / NODE SIM</p>
          <h1 className="text-xl font-bold text-zinc-100">v{result.input.version} · 블리츠 상인 · {result.input.character}</h1>
          {view.preset && <span className="text-xs text-zinc-500">preset: {view.preset}</span>}
        </header>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="rounded border border-white/15 px-3 py-1 hover:bg-white/10" onClick={() => (playing ? setPlaying(false) : window.__sim?.play())}>
            {playing ? "일시정지" : "재생"}
          </button>
          <button type="button" className="rounded border border-white/15 px-3 py-1 hover:bg-white/10" onClick={() => void window.__sim?.step()}>다음 액션</button>
          <button type="button" className="rounded border border-white/15 px-3 py-1 hover:bg-white/10" onClick={() => void window.__sim?.seek(0)}>처음으로</button>
          <span className="tabular-nums text-zinc-400">{Math.round(t)} / {result.duration} ms</span>
        </div>
        <input type="range" min={0} max={result.duration} step={1000 / 30} value={t} onChange={(event) => void window.__sim?.seek(Number(event.target.value))} />
        <ol className="rounded border border-white/10 text-xs">
          {result.stock.map((entry, i) => (
            <li key={entry.index} className={`flex gap-3 px-3 py-1 ${state.hovered === i ? "bg-white/10" : ""}`}>
              <span className="w-4 text-zinc-500">{i + 1}</span>
              <span className="w-56">{entry.type}{entry.rare ? " (rare)" : ""}{entry.cursed ? " (cursed)" : ""}</span>
              <span className="text-zinc-400">{state.slots[i].status}</span>
            </li>
          ))}
        </ol>
        {warnings.length > 0 && (
          <ul className="rounded border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            {warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        )}
        <ol className="rounded border border-white/10 text-xs">
          {result.beats.map((beat, i) => (
            <li key={i} className={`flex gap-3 px-3 py-1 ${beat.start <= t && t < Math.max(beat.end, beat.start + 1) ? "bg-white/10" : ""}`}>
              <button type="button" className="w-14 shrink-0 text-right tabular-nums text-sky-300 hover:underline" onClick={() => void window.__sim?.seek(beat.start)}>{beat.start}</button>
              <span>{beat.action.do}{"entry" in beat.action ? `:${beat.action.entry}` : ""}{"ms" in beat.action ? `:${beat.action.ms}` : ""}{beat.rejected ? ` — 거부: ${beat.rejected}` : ""}</span>
            </li>
          ))}
        </ol>
        <details>
          <summary className="cursor-pointer text-xs text-zinc-400">미구현</summary>
          <ul className="mt-2 list-disc pl-5 text-xs text-zinc-400">{result.notSimulated.map((line) => <li key={line}>{line}</li>)}</ul>
        </details>
        <details>
          <summary className="cursor-pointer text-xs text-zinc-400">입력 JSON</summary>
          <pre className="mt-2 overflow-auto rounded bg-white/5 p-3 text-[11px] text-zinc-300">{JSON.stringify(result.input, null, 2)}</pre>
        </details>
      </section>
    </main>
  );
}

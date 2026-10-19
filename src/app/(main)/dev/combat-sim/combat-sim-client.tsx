"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { runCombat } from "@/lib/combat-sim/engine";
import { buildTimeline, type CombatTimeline } from "@/lib/combat-sim/timeline";
import type { SimEvent, SimResult } from "@/lib/combat-sim/types";
import { CombatStage } from "./combat-stage";
import type { ActorStatus } from "./spine-actor";
import { STAGE_H, STAGE_W, visibleState } from "./stage-layout";
import type { CombatSimView } from "./view-types";

/** What capture tools read from `window.__sim`. */
export interface CombatSimHandle {
  version: 1;
  input: CombatSimView["input"];
  duration: number;
  actionEnds: number[];
  /** Resolves when fonts, images and every Spine actor have loaded. */
  ready(): Promise<boolean>;
  /** Pause at `t` (ms) and resolve after that frame is painted. */
  seek(t: number): Promise<CombatSimSnapshot>;
  /** Seek to the end of the next script action after the current time. */
  step(): Promise<CombatSimSnapshot>;
  play(): void;
  pause(): void;
  state(): CombatSimSnapshot;
  /** Frame times (ms) covering the whole timeline at `fps`. */
  frameTimes(fps?: number): number[];
}

export interface CombatSimSnapshot {
  t: number;
  action: number | null;
  event: SimEvent["kind"] | null;
  energy: number;
  maxEnergy: number;
  hand: string[];
  drawPile: number;
  discardPile: number;
  exhaustPile: number;
  player: { hp: number; block: number };
  monsters: { id: string; hp: number; move: string | null }[];
}

declare global {
  interface Window {
    __sim?: CombatSimHandle;
  }
}

/** A rendered frame, or 100 ms when rAF is throttled (hidden tab). */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
    setTimeout(resolve, 100);
  });
}

function snapshot(result: SimResult, timeline: CombatTimeline, t: number): CombatSimSnapshot {
  const frame = timeline.frameAt(t);
  const state = visibleState(frame.beat, frame.progress, frame.state);
  const label = (uid: string) => `${state.cards[uid].id}${state.cards[uid].upgraded ? "+" : ""}`;
  return {
    t: frame.t,
    action: frame.beat?.action ?? null,
    event: frame.beat?.event.kind ?? null,
    energy: state.energy,
    maxEnergy: state.maxEnergy,
    hand: state.piles.hand.map(label),
    drawPile: state.piles.draw.length,
    discardPile: state.piles.discard.length,
    exhaustPile: state.piles.exhaust.length,
    player: { hp: state.player.hp, block: state.player.block },
    monsters: state.monsters.map((monster) => ({ id: monster.id, hp: monster.hp, move: monster.moveId })),
  };
}

export function CombatSimClient({ view, errors }: { view: CombatSimView; errors: string[] }) {
  const result = useMemo(() => runCombat(view.input, view.catalog), [view.input, view.catalog]);
  const timeline = useMemo(() => buildTimeline(result, view.input), [result, view.input]);
  const initialT = view.options.t === "end" ? timeline.duration : Math.min(view.options.t ?? 0, timeline.duration);
  const [t, setT] = useState(initialT);
  const [playing, setPlaying] = useState(false);
  const [devicePixelRatio, setDevicePixelRatio] = useState(1);
  const tRef = useRef(t);
  tRef.current = t;
  const stageRef = useRef<HTMLDivElement>(null);
  const actorsRef = useRef(new Map<string, ActorStatus>());
  const [, setActorsVersion] = useState(0);

  const frameScale = view.options.frame / STAGE_W;
  const pixelRatio = frameScale * devicePixelRatio;

  useEffect(() => {
    setDevicePixelRatio(window.devicePixelRatio || 1);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (view.options.autoplay || (view.options.t === null && !reduced)) setPlaying(true);
  }, [view.options.autoplay, view.options.t]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const next = Math.min(timeline.duration, tRef.current + (now - last));
      last = now;
      setT(next);
      if (next >= timeline.duration) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, timeline.duration]);

  const onActorStatus = useCallback((id: string, status: ActorStatus) => {
    actorsRef.current.set(id, status);
    setActorsVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    const clamp = (value: number) => Math.max(0, Math.min(timeline.duration, value));
    const settle = async () => {
      await nextFrame();
      await nextFrame();
    };
    const handle: CombatSimHandle = {
      version: 1,
      input: view.input,
      duration: timeline.duration,
      actionEnds: timeline.actionEnds,
      async ready() {
        await document.fonts.ready;
        const deadline = performance.now() + 30_000;
        for (;;) {
          const actorsDone = [...actorsRef.current.values()].every((status) => status !== "loading");
          const images = [...(stageRef.current?.querySelectorAll("img") ?? [])];
          const imagesDone = images.every((image) => image.complete);
          if (actorsDone && imagesDone) break;
          if (performance.now() > deadline) throw new Error("combat-sim: assets did not load within 30s");
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        await Promise.all([...(stageRef.current?.querySelectorAll("img") ?? [])].map((image) => image.decode().catch(() => undefined)));
        await settle();
        return true;
      },
      async seek(value) {
        flushSync(() => {
          setPlaying(false);
          setT(clamp(value));
        });
        await settle();
        return snapshot(result, timeline, tRef.current);
      },
      async step() {
        const next = timeline.actionEnds.find((end) => end > tRef.current + 0.5) ?? timeline.duration;
        return handle.seek(next);
      },
      play() {
        if (tRef.current >= timeline.duration) setT(0);
        setPlaying(true);
      },
      pause() {
        setPlaying(false);
      },
      state() {
        return snapshot(result, timeline, tRef.current);
      },
      frameTimes(fps = 30) {
        const count = Math.floor((timeline.duration / 1000) * fps) + 1;
        return Array.from({ length: count }, (_, index) => Math.min(timeline.duration, (index * 1000) / fps));
      },
    };
    window.__sim = handle;
    return () => {
      if (window.__sim === handle) delete window.__sim;
    };
  }, [result, timeline, view.input]);

  const current = snapshot(result, timeline, t);
  const warnings = [...new Set([...errors, ...view.warnings, ...result.warnings])];

  return (
    <main className="flex w-full flex-col gap-6 px-4 py-6 lg:flex-row lg:items-start">
      <div
        ref={stageRef}
        data-combat-sim-stage=""
        data-version={view.catalog.version}
        data-game-locale="kor"
        className="relative shrink-0 overflow-hidden"
        style={{ width: view.options.frame, height: (view.options.frame * STAGE_H) / STAGE_W }}
      >
        <div className="absolute left-0 top-0" style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${frameScale})`, transformOrigin: "0 0" }}>
          <CombatStage
            view={view}
            result={result}
            timeline={timeline}
            t={t}
            pixelRatio={pixelRatio}
            badges={view.options.badges}
            onActorStatus={onActorStatus}
          />
        </div>
      </div>

      <section className="flex min-w-0 flex-1 flex-col gap-4 text-sm text-zinc-300">
        <header className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300/80">DEV / COMBAT SIM</p>
          <h1 className="text-xl font-bold text-zinc-100">
            v{view.catalog.version} · {view.catalog.character.name} · {view.catalog.encounter.name}
          </h1>
          {view.preset && <p className="text-xs text-zinc-500">preset: {view.preset}</p>}
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="rounded border border-white/15 px-3 py-1 hover:bg-white/10" onClick={() => (playing ? setPlaying(false) : window.__sim?.play())}>
            {playing ? "일시정지" : "재생"}
          </button>
          <button type="button" className="rounded border border-white/15 px-3 py-1 hover:bg-white/10" onClick={() => void window.__sim?.step()}>
            다음 액션
          </button>
          <button type="button" className="rounded border border-white/15 px-3 py-1 hover:bg-white/10" onClick={() => void window.__sim?.seek(0)}>
            처음으로
          </button>
          <span className="tabular-nums text-zinc-400">{Math.round(t)} / {timeline.duration} ms</span>
        </div>
        <input
          type="range"
          min={0}
          max={timeline.duration}
          step={1000 / 30}
          value={t}
          onChange={(event) => void window.__sim?.seek(Number(event.target.value))}
        />

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          <dt className="text-zinc-500">에너지</dt>
          <dd>{current.energy}/{current.maxEnergy}</dd>
          <dt className="text-zinc-500">손</dt>
          <dd>{current.hand.join(", ") || "—"}</dd>
          <dt className="text-zinc-500">뽑을/버린/소멸</dt>
          <dd>{current.drawPile} / {current.discardPile} / {current.exhaustPile}</dd>
        </dl>

        {warnings.length > 0 && (
          <ul className="rounded border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            {warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        )}

        <ol className="max-h-[420px] overflow-auto rounded border border-white/10 text-xs">
          {timeline.beats.filter((beat) => beat.action >= 0).map((beat) => (
            <li
              key={beat.step}
              className={`flex gap-3 px-3 py-1 ${beat.start <= t && t < beat.start + Math.max(beat.duration, 1) ? "bg-white/10" : ""}`}
            >
              <button type="button" className="w-14 shrink-0 text-right tabular-nums text-sky-300 hover:underline" onClick={() => void window.__sim?.seek(beat.start)}>
                {beat.start}
              </button>
              <span className="w-6 shrink-0 text-zinc-500">#{beat.action}</span>
              <span className="min-w-0 break-words">{describeEvent(beat.event)}</span>
            </li>
          ))}
        </ol>

        <details>
          <summary className="cursor-pointer text-xs text-zinc-400">입력 JSON</summary>
          <pre className="mt-2 overflow-auto rounded bg-white/5 p-3 text-[11px] text-zinc-300">{JSON.stringify(view.input, null, 2)}</pre>
        </details>
      </section>
    </main>
  );
}

function describeEvent(event: SimEvent): string {
  switch (event.kind) {
    case "select": return `${event.uid} 집어 듦`;
    case "energy": return `에너지 ${event.from} → ${event.to} (${event.cause}${event.sourceId ? `: ${event.sourceId}` : ""})`;
    case "move": return `${event.uid}: ${event.from} → ${event.to} (${event.cause})`;
    case "enter": return `${event.uid} 전투에 추가 → ${event.to}`;
    case "remove": return `${event.uid} 제거`;
    case "afflict": return `${event.uid}에 ${event.afflictionId} ${event.amount} (${event.sourceId})`;
    case "clearAffliction": return `${event.uid} ${event.afflictionId} 해제`;
    case "afflictionTrigger": return `${event.uid} ${event.afflictionId} 발동`;
    case "power": return `${event.creature} ${event.powerId} ${event.amount} ${event.change}`;
    case "damage": return `${event.creature} 피해 ${event.amount} (막음 ${event.blocked}) ${event.hpFrom} → ${event.hpTo}`;
    case "block": return `${event.creature} 방어도 +${event.amount} = ${event.total}`;
    case "animate": return `${event.creature} ${event.animation}`;
    case "intent": return `${event.creature} 다음 행동 ${event.moveId ?? "—"}`;
    case "shuffle": return `버린 카드 ${event.count}장 섞어 뽑을 카드 더미로`;
    case "wait": return `대기 ${event.ms}ms`;
    case "unimplemented": return `미구현: ${event.what}`;
    case "rejected": return `거부: ${event.reason}`;
  }
}

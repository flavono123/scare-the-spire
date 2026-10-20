"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { buildMapBarTimeline, type MapBarTimeline } from "@/lib/map-bar/engine";
import type { MapBarEvent, MapBarFrame, MapBarInput, MapBarNodeLayout } from "@/lib/map-bar/types";
import { MapBarStage, mapBarImageUrls } from "./map-bar-stage";
import type { MapBarViewOptions } from "./query-input";

/** What capture tools read from `window.__bar`. */
export interface MapBarHandle {
  version: 1;
  input: MapBarInput;
  /** Frame size (px, 1:1 with the PNG). */
  width: number;
  height: number;
  duration: number;
  events: MapBarEvent[];
  /** Node centers and marker spots (frame px); labels are the caller's to draw. */
  anchors: MapBarNodeLayout[];
  /** Resolves when fonts and every image the bar can show have loaded. */
  ready(): Promise<boolean>;
  /** Pause at `t` (ms) and resolve after that frame is painted. */
  seek(t: number): Promise<MapBarState>;
  play(): void;
  pause(): void;
  state(): MapBarState;
  /** Frame times (ms) covering the whole timeline at `fps`. */
  frameTimes(fps?: number): number[];
}

export interface MapBarState {
  t: number;
  transit: MapBarFrame["transit"];
  marker: MapBarFrame["marker"];
  ring: MapBarFrame["ring"];
  nodes: {
    index: number;
    x: number;
    y: number;
    state: MapBarFrame["nodes"][number]["state"];
    icon: string;
    revealed: boolean;
    synthetic: boolean;
    scale: number;
    pulse: number;
    traveledTicks: number | null;
  }[];
}

declare global {
  interface Window {
    __bar?: MapBarHandle;
  }
}

/** A rendered frame, or 100 ms when rAF is throttled (hidden tab). */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
    setTimeout(resolve, 100);
  });
}

function snapshot(timeline: MapBarTimeline, t: number): MapBarState {
  const frame = timeline.frameAt(t);
  return {
    t: frame.t,
    transit: frame.transit,
    marker: frame.marker,
    ring: frame.ring,
    nodes: frame.nodes.map((node) => ({
      index: node.index,
      x: timeline.layout.nodes[node.index].x,
      y: timeline.layout.nodes[node.index].y,
      state: node.state,
      icon: node.art.kind === "ancient" ? `ancient:${node.art.key}` : node.art.icon,
      revealed: node.revealed,
      synthetic: node.synthetic,
      scale: node.scale,
      pulse: node.pulse,
      // Dots painted on the edge into this node.
      traveledTicks: node.index === 0 ? null : frame.traveledTicks[node.index - 1],
    })),
  };
}

const CHECKER = "repeating-conic-gradient(#3f3f46 0% 25%, #27272a 0% 50%) 0 0 / 16px 16px";

export function MapBarClient({ input, preset, options }: { input: MapBarInput; preset: string | null; options: MapBarViewOptions }) {
  const timeline = useMemo(() => buildMapBarTimeline(input), [input]);
  const initialT = options.t === "end" ? timeline.duration : Math.min(options.t ?? 0, timeline.duration);
  const [t, setT] = useState(initialT);
  const [playing, setPlaying] = useState(false);
  const tRef = useRef(t);
  // Synced on commit, so a seek's flushSync leaves the new time here.
  useLayoutEffect(() => {
    tRef.current = t;
  }, [t]);
  const stageRef = useRef<HTMLDivElement>(null);
  const preloadRef = useRef<HTMLDivElement>(null);
  const frame = useMemo(() => timeline.frameAt(t), [timeline, t]);
  const images = useMemo(() => mapBarImageUrls(timeline), [timeline]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!(options.autoplay || (options.t === null && !reduced))) return;
    const start = requestAnimationFrame(() => setPlaying(true));
    return () => cancelAnimationFrame(start);
  }, [options.autoplay, options.t]);

  useEffect(() => {
    if (!playing) return;
    let handle = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const next = Math.min(timeline.duration, tRef.current + (now - last));
      last = now;
      setT(next);
      if (next >= timeline.duration) {
        setPlaying(false);
        return;
      }
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [playing, timeline.duration]);

  useEffect(() => {
    const clamp = (value: number) => Math.max(0, Math.min(timeline.duration, value));
    const allImages = () => [...(stageRef.current?.querySelectorAll("img") ?? []), ...(preloadRef.current?.querySelectorAll("img") ?? [])];
    const settle = async () => {
      await nextFrame();
      await nextFrame();
    };
    const handle: MapBarHandle = {
      version: 1,
      input,
      width: timeline.layout.width,
      height: timeline.layout.height,
      duration: timeline.duration,
      events: timeline.events,
      anchors: timeline.layout.nodes,
      async ready() {
        await document.fonts.ready;
        const deadline = performance.now() + 30_000;
        while (!allImages().every((image) => image.complete)) {
          if (performance.now() > deadline) throw new Error("map-bar: images did not load within 30s");
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        await Promise.all(allImages().map((image) => image.decode().catch(() => undefined)));
        await settle();
        return true;
      },
      async seek(value) {
        flushSync(() => {
          setPlaying(false);
          setT(clamp(value));
        });
        await Promise.all([...(stageRef.current?.querySelectorAll("img") ?? [])].map((image) => image.decode().catch(() => undefined)));
        await settle();
        return snapshot(timeline, tRef.current);
      },
      play() {
        if (tRef.current >= timeline.duration) setT(0);
        setPlaying(true);
      },
      pause() {
        setPlaying(false);
      },
      state() {
        return snapshot(timeline, tRef.current);
      },
      frameTimes(fps = 30) {
        const count = Math.floor((timeline.duration / 1000) * fps) + 1;
        return Array.from({ length: count }, (_, index) => Math.min(timeline.duration, (index * 1000) / fps));
      },
    };
    window.__bar = handle;
    return () => {
      if (window.__bar === handle) delete window.__bar;
    };
  }, [input, timeline]);

  const current = snapshot(timeline, t);

  return (
    <main className="flex w-full flex-col gap-6 px-4 py-6">
      {/* Checkerboard to show transparency; the capture hides everything but the stage. */}
      <div className="self-start overflow-auto p-2" style={{ background: CHECKER, maxWidth: "100%" }}>
        <div
          ref={stageRef}
          data-map-bar-stage=""
          className="relative overflow-hidden"
          style={{ width: timeline.layout.width, height: timeline.layout.height }}
        >
          <MapBarStage timeline={timeline} frame={frame} />
        </div>
      </div>
      <div ref={preloadRef} aria-hidden style={{ display: "none" }}>
        {images.map((url) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={url} src={url} alt="" />
        ))}
      </div>

      <section className="flex min-w-0 flex-col gap-4 text-sm text-zinc-300">
        <header className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300/80">DEV / MAP BAR</p>
          <h1 className="text-xl font-bold text-zinc-100">
            맵 진행 바 · {input.orientation ?? "horizontal"} · {timeline.layout.width}×{timeline.layout.height}
          </h1>
          <nav className="flex flex-wrap items-center gap-3 text-xs">
            <Link className="text-sky-300 hover:underline" href="/dev/map-bar">← 프리셋 목록</Link>
            {preset && <span className="text-zinc-500">preset: {preset}</span>}
            {preset && (
              <>
                <Link className="text-sky-300 hover:underline" href={`/dev/map-bar?preset=${preset}`}>가로</Link>
                <Link className="text-sky-300 hover:underline" href={`/dev/map-bar?preset=${preset}&orientation=vertical`}>세로</Link>
              </>
            )}
          </nav>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="rounded border border-white/15 px-3 py-1 hover:bg-white/10" onClick={() => (playing ? setPlaying(false) : window.__bar?.play())}>
            {playing ? "일시정지" : "재생"}
          </button>
          <button type="button" className="rounded border border-white/15 px-3 py-1 hover:bg-white/10" onClick={() => void window.__bar?.seek(0)}>
            처음으로
          </button>
          <span className="tabular-nums text-zinc-400">{Math.round(t)} / {Math.round(timeline.duration)} ms</span>
        </div>
        <input
          type="range"
          min={0}
          max={timeline.duration}
          step={1000 / 30}
          value={t}
          onChange={(event) => void window.__bar?.seek(Number(event.target.value))}
        />

        {timeline.warnings.length > 0 && (
          <ul className="rounded border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            {timeline.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        )}

        <div className="flex flex-wrap gap-6">
          <table className="text-xs">
            <thead className="text-zinc-500">
              <tr><th className="pr-3 text-left">#</th><th className="pr-3 text-left">노드</th><th className="pr-3 text-right">x</th><th className="pr-3 text-right">y</th><th className="pr-3 text-left">상태</th><th className="text-left">아이콘</th></tr>
            </thead>
            <tbody>
              {current.nodes.map((node) => (
                <tr key={node.index}>
                  <td className="pr-3 tabular-nums">{node.index}</td>
                  <td className="pr-3">{timeline.layout.nodes[node.index].type}{timeline.layout.nodes[node.index].outcome ? `:${timeline.layout.nodes[node.index].outcome}` : ""}</td>
                  <td className="pr-3 text-right tabular-nums">{node.x.toFixed(1)}</td>
                  <td className="pr-3 text-right tabular-nums">{node.y.toFixed(1)}</td>
                  <td className="pr-3">{node.state}</td>
                  <td>{node.icon}{node.synthetic ? " (synthetic)" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <ol className="max-h-[320px] min-w-64 overflow-auto rounded border border-white/10 text-xs">
            {timeline.events.map((event) => (
              <li key={`${event.kind}-${event.node}`} className={`flex gap-3 px-3 py-1 ${Math.abs(event.t - t) < 1 ? "bg-white/10" : ""}`}>
                <button type="button" className="w-14 shrink-0 text-right tabular-nums text-sky-300 hover:underline" onClick={() => void window.__bar?.seek(event.t)}>
                  {Math.round(event.t)}
                </button>
                <span>{event.kind} #{event.node}{event.icon ? ` → ${event.icon}` : ""}{event.synthetic ? " (synthetic)" : ""}</span>
              </li>
            ))}
          </ol>
        </div>

        <details>
          <summary className="cursor-pointer text-xs text-zinc-400">입력 JSON</summary>
          <pre className="mt-2 overflow-auto rounded bg-white/5 p-3 text-[11px] text-zinc-300">{JSON.stringify(input, null, 2)}</pre>
        </details>
      </section>
    </main>
  );
}

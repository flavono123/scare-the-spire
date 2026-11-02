"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import Image from "@/components/ui/static-image";
import { localizeHrefWithGameLocale, type GameLocale, type ServiceLocale } from "@/lib/i18n";
import { seededShuffle } from "@/lib/beta-art-quiz";
import { BETA_ART_PLAYLIST_URL } from "@/lib/vexing-puzzlebox";
import type { BetaArtEntry } from "@/lib/vexing-puzzlebox-types";
import { serviceMessages } from "@/messages/service";

/** Milliseconds each art stays on screen. The Shorts run at 1200. */
const SPEEDS = { slow: 3000, normal: 1800, fast: 1200 } as const;
type Speed = keyof typeof SPEEDS;

export function BetaArtViewer({
  entries,
  focusKey,
  serviceLocale,
  gameLocale,
}: {
  entries: BetaArtEntry[];
  focusKey: string | null;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  const copy = serviceMessages[serviceLocale].vexingPuzzlebox;
  const [shuffleSeed, setShuffleSeed] = useState<number | null>(null);
  const ordered = useMemo(
    () => (shuffleSeed === null ? entries : seededShuffle(entries, shuffleSeed)),
    [entries, shuffleSeed],
  );
  const [position, setPosition] = useState(() => (
    Math.max(0, focusKey ? entries.findIndex((entry) => entry.key === focusKey) : 0)
  ));
  const [playing, setPlaying] = useState(focusKey === null);
  const [speed, setSpeed] = useState<Speed>("normal");
  /** Share of the frame showing beta art, from the right edge. 100 hides the final art. */
  const [betaShare, setBetaShare] = useState(0);
  const [dragging, setDragging] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  const index = Math.min(position, ordered.length - 1);
  const entry = ordered[index];
  const nextEntry = ordered[(index + 1) % ordered.length];

  const move = useCallback((step: number) => {
    setPosition((current) => (Math.min(current, ordered.length - 1) + step + ordered.length) % ordered.length);
    setBetaShare(0);
  }, [ordered.length]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the motion preference is only readable after hydration
    setPlaying(!window.matchMedia("(prefers-reduced-motion: reduce)").matches && focusKey === null);
  }, [focusKey]);

  useEffect(() => {
    if (!playing || dragging) return;
    const timer = window.setTimeout(() => {
      if (betaShare < 100 && entry.officialUrl) setBetaShare(100);
      else move(1);
    }, SPEEDS[speed]);
    return () => window.clearTimeout(timer);
  }, [playing, dragging, betaShare, speed, entry, move]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, button, a")) return;
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
      if (event.key === " ") {
        event.preventDefault();
        setPlaying((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [move]);

  const dragTo = (event: PointerEvent<HTMLDivElement>) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || !entry.officialUrl) return;
    const share = 100 - ((event.clientX - rect.left) / rect.width) * 100;
    setBetaShare(Math.min(100, Math.max(0, share)));
  };

  const betaOnly = !entry.officialUrl;
  const shownShare = betaOnly ? 100 : betaShare;

  return (
    <div className="mx-auto max-w-3xl" data-beta-art-viewer>
      <div
        ref={stageRef}
        role="img"
        aria-label={`${entry.name} ${copy.beta}`}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
          setPlaying(false);
          dragTo(event);
        }}
        onPointerMove={(event) => {
          if (dragging) dragTo(event);
        }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        className="relative aspect-[4/3] cursor-ew-resize touch-pan-y select-none overflow-hidden rounded-xl border border-border bg-black"
      >
        {entry.officialUrl && (
          <Image
            key={entry.officialUrl}
            src={entry.officialUrl}
            alt=""
            width={960}
            height={720}
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain"
          />
        )}
        <div
          className={`absolute inset-0 ${dragging ? "" : "transition-[clip-path] duration-500 ease-in-out motion-reduce:transition-none"}`}
          style={{ clipPath: `inset(0 0 0 ${100 - shownShare}%)` }}
        >
          <Image
            key={entry.betaUrl}
            src={entry.betaUrl}
            alt=""
            width={960}
            height={720}
            draggable={false}
            className="absolute inset-0 h-full w-full bg-black object-contain"
          />
        </div>
        {!betaOnly && (
          <span
            aria-hidden="true"
            className={`absolute inset-y-0 w-0.5 bg-white/80 ${dragging ? "" : "transition-[left] duration-500 ease-in-out motion-reduce:transition-none"}`}
            style={{ left: `${100 - shownShare}%` }}
          />
        )}
        <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-0.5 text-xs text-white">
          {betaOnly ? copy.betaOnly : shownShare >= 50 ? copy.beta : copy.official}
        </span>
        <span className="absolute right-2 top-2 rounded bg-black/70 px-2 py-0.5 text-xs text-white tabular-nums">
          {index + 1}/{ordered.length}
        </span>
      </div>

      {/* Keep the next pair cached so the swap does not flash. */}
      <div className="hidden" aria-hidden="true">
        <Image src={nextEntry.betaUrl} alt="" width={960} height={720} loading="eager" />
        {nextEntry.officialUrl && (
          <Image src={nextEntry.officialUrl} alt="" width={960} height={720} loading="eager" />
        )}
      </div>

      <div className="mt-3 text-center">
        <p className="font-game-title text-lg font-semibold">{entry.name}</p>
        <p className="text-xs text-muted-foreground">{copy.compareHint}</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm">
        <button type="button" onClick={() => move(-1)} className="rounded-lg border border-border px-3 py-1.5 hover:border-primary/60">
          {copy.previous}
        </button>
        <button
          type="button"
          onClick={() => setPlaying(!playing)}
          className="rounded-lg bg-primary px-4 py-1.5 font-semibold text-primary-foreground"
        >
          {playing ? copy.pause : copy.play}
        </button>
        <button type="button" onClick={() => move(1)} className="rounded-lg border border-border px-3 py-1.5 hover:border-primary/60">
          {copy.next}
        </button>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {copy.speed}
          <select
            value={speed}
            onChange={(event) => setSpeed(event.target.value as Speed)}
            className="rounded-md border border-border bg-background px-1.5 py-1 text-foreground"
          >
            <option value="slow">{copy.speedSlow}</option>
            <option value="normal">{copy.speedNormal}</option>
            <option value="fast">{copy.speedFast}</option>
          </select>
        </label>
        <button
          type="button"
          aria-pressed={shuffleSeed !== null}
          onClick={() => {
            setShuffleSeed(shuffleSeed === null ? Math.floor(Math.random() * 1_000_000) : null);
            setPosition(0);
            setBetaShare(0);
          }}
          className="rounded-lg border border-border px-3 py-1.5 text-xs hover:border-primary/60"
        >
          {shuffleSeed === null ? copy.orderShuffle : copy.orderSeries}
        </button>
      </div>

      <p className="mt-3 flex justify-center gap-3 text-xs text-muted-foreground">
        <a
          href={localizeHrefWithGameLocale(entry.href, serviceLocale, gameLocale)}
          className="underline hover:text-foreground"
        >
          {copy.openCompendium}
        </a>
        <a href={BETA_ART_PLAYLIST_URL} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
          {copy.watchShorts}
        </a>
      </p>
    </div>
  );
}

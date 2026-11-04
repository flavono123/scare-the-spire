"use client";

import { Youtube } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { BoundedCarouselFrame } from "@/components/codex/bounded-carousel";
import { PlaybackRateGroup, PlaybackToggle } from "@/components/playback-controls";
import Image from "@/components/ui/static-image";
import {
  BetaArtComments,
  BetaArtReactions,
  type BetaArtAuth,
} from "@/components/vexing-puzzlebox/beta-art-engagement";
import { PileButton } from "@/components/vexing-puzzlebox/combat-buttons";
import { usePuzzleboxSound } from "@/components/vexing-puzzlebox/puzzlebox-audio";
import { localizeHrefWithGameLocale, type GameLocale, type ServiceLocale } from "@/lib/i18n";
import { seededShuffle } from "@/lib/beta-art-quiz";
import { buildBetaArtCommentThreadKey } from "@/lib/comment-threads";
import { INTERNAL_TOKEN_LINK_CLASS } from "@/lib/service-link-classes";
import { BETA_ART_PLAYLIST_URL } from "@/lib/vexing-puzzlebox";
import type { BetaArtEntry } from "@/lib/vexing-puzzlebox-types";
import { serviceMessages } from "@/messages/service";

/** Milliseconds each art stays on screen. The Shorts run at 1200. */
const SPEEDS = { slow: 3000, normal: 1800, fast: 1200 } as const;
type Speed = keyof typeof SPEEDS;
const SPEED_ORDER: Speed[] = ["slow", "normal", "fast"];
/** The draw pile counts back up while the order reshuffles. */
const SHUFFLE_COUNT_MS = 600;
const SHUFFLE_COUNT_STEPS = 20;
/** The STS2 Compendium's own token, as on the top bar. */
const COMPENDIUM_TOKEN_SRC = "/images/sts2/icons/app_icon.png";

export function BetaArtViewer({
  entries,
  focusKey,
  likes,
  comments,
  auth,
  initialCommentsOpen = false,
  serviceLocale,
  gameLocale,
}: {
  entries: BetaArtEntry[];
  focusKey: string | null;
  likes: Record<string, number>;
  comments: Record<string, number>;
  auth: BetaArtAuth;
  initialCommentsOpen?: boolean;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}) {
  const copy = serviceMessages[serviceLocale].vexingPuzzlebox;
  const playSound = usePuzzleboxSound();
  const [shuffleSeed, setShuffleSeed] = useState<number | null>(null);
  const ordered = useMemo(
    () => (shuffleSeed === null ? entries : seededShuffle(entries, shuffleSeed)),
    [entries, shuffleSeed],
  );
  const [position, setPosition] = useState(() => (
    Math.max(0, focusKey ? entries.findIndex((entry) => entry.key === focusKey) : 0)
  ));
  const [playing, setPlaying] = useState(focusKey === null && !initialCommentsOpen);
  const [commentsOpen, setCommentsOpen] = useState(initialCommentsOpen);
  /** Counts the open thread reported, ahead of the page-wide totals. */
  const [loadedCounts, setLoadedCounts] = useState<Record<string, number>>({});
  const [speed, setSpeed] = useState<Speed>("normal");
  /** Share of the frame showing beta art, from the right edge. 100 hides the final art. */
  const [betaShare, setBetaShare] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [shuffleCount, setShuffleCount] = useState<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const countTimers = useRef<number[]>([]);

  const index = Math.min(position, ordered.length - 1);
  const entry = ordered[index];
  const nextEntry = ordered[(index + 1) % ordered.length];
  const storyId = buildBetaArtCommentThreadKey(entry.key);

  const move = useCallback((step: number) => {
    setPosition((current) => (Math.min(current, ordered.length - 1) + step + ordered.length) % ordered.length);
    setBetaShare(0);
  }, [ordered.length]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the motion preference is only readable after hydration
    setPlaying(!window.matchMedia("(prefers-reduced-motion: reduce)").matches && focusKey === null && !initialCommentsOpen);
  }, [focusKey, initialCommentsOpen]);

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
      // The comment composer is a contenteditable editor, so its keys must not play or move the art.
      if (event.target instanceof HTMLElement && (
        event.target.isContentEditable
        || event.target.closest("input, textarea, select, button, a, [contenteditable]")
      )) return;
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

  useEffect(() => () => countTimers.current.forEach((timer) => window.clearTimeout(timer)), []);

  const shuffle = () => {
    setShuffleSeed(Math.floor(Math.random() * 1_000_000));
    setPosition(0);
    setBetaShare(0);
    playSound("cardSlide");
    countTimers.current.forEach((timer) => window.clearTimeout(timer));
    countTimers.current = Array.from({ length: SHUFFLE_COUNT_STEPS }, (_, step) => window.setTimeout(() => {
      setShuffleCount(Math.max(1, Math.round((ordered.length * (step + 1)) / SHUFFLE_COUNT_STEPS)));
    }, (step * SHUFFLE_COUNT_MS) / SHUFFLE_COUNT_STEPS));
    countTimers.current.push(window.setTimeout(() => setShuffleCount(null), SHUFFLE_COUNT_MS + 60));
  };

  const dragTo = (event: PointerEvent<HTMLDivElement>) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || !entry.officialUrl) return;
    const share = 100 - ((event.clientX - rect.left) / rect.width) * 100;
    setBetaShare(Math.min(100, Math.max(0, share)));
  };

  const betaOnly = !entry.officialUrl;
  const shownShare = betaOnly ? 100 : betaShare;
  const speedLabel = { slow: copy.speedSlow, normal: copy.speedNormal, fast: copy.speedFast };

  return (
    <div className="mx-auto max-w-[min(48rem,80svh)]" data-beta-art-viewer>
      <BoundedCarouselFrame
        canMovePrevious
        canMoveNext
        onPrevious={() => move(-1)}
        onNext={() => move(1)}
        previousLabel={copy.previous}
        nextLabel={copy.next}
      >
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
          className="relative aspect-[25/19] cursor-ew-resize touch-pan-y select-none overflow-hidden rounded-xl border border-border bg-black"
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
              className={`absolute inset-y-0 w-px bg-white/50 ${dragging ? "" : "transition-[left] duration-500 ease-in-out motion-reduce:transition-none"}`}
              style={{ left: `${100 - shownShare}%` }}
            />
          )}
          {shownShare >= 50 && (
            <span className="absolute left-2 top-1.5 text-[10px] font-medium tracking-wide text-white/35">
              {betaOnly ? copy.betaOnly : copy.beta}
            </span>
          )}
          <span className="absolute right-2 top-1.5 text-[10px] tabular-nums text-white/35">
            {index + 1}/{ordered.length}
          </span>
        </div>
      </BoundedCarouselFrame>

      {/* Keep the next pair cached so the swap does not flash. */}
      <div className="hidden" aria-hidden="true">
        <Image src={nextEntry.betaUrl} alt="" width={960} height={720} loading="eager" />
        {nextEntry.officialUrl && (
          <Image src={nextEntry.officialUrl} alt="" width={960} height={720} loading="eager" />
        )}
      </div>

      <div className="mt-3 text-center">
        <p className="font-game-title text-lg font-semibold">{entry.name}</p>
        <BetaArtReactions
          artKey={entry.key}
          likeCount={likes[storyId] ?? 0}
          commentCount={loadedCounts[storyId] ?? comments[storyId] ?? 0}
          auth={auth}
          commentsOpen={commentsOpen}
          onComments={() => {
            setCommentsOpen((open) => !open);
            setPlaying(false);
          }}
          serviceLocale={serviceLocale}
          size={18}
          className="mt-2"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs">
        <PlaybackToggle
          playing={playing}
          playLabel={copy.play}
          pauseLabel={copy.pause}
          onToggle={() => setPlaying(!playing)}
        />
        <PlaybackRateGroup rates={SPEED_ORDER} rate={speed} onChange={setSpeed} label={(value) => speedLabel[value]} />
        <PileButton pile="draw" count={shuffleCount ?? ordered.length} label={copy.shuffle} onClick={shuffle} />
      </div>

      <p className="mt-4 flex flex-wrap justify-center gap-4 text-xs">
        <a href={localizeHrefWithGameLocale(entry.href, serviceLocale, gameLocale)} className={INTERNAL_TOKEN_LINK_CLASS}>
          <Image src={COMPENDIUM_TOKEN_SRC} alt="" width={32} height={32} className="h-4 w-4 object-contain" />
          {copy.openCompendium}
        </a>
        <a
          href={BETA_ART_PLAYLIST_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 spire-blue transition-colors hover:text-blue-300"
        >
          <Image src="/favicon.ico" alt="" width={16} height={16} className="h-4 w-4 rounded-sm" />
          <Youtube aria-hidden="true" className="h-4 w-4 shrink-0 text-red-500" />
          {copy.watchShorts} &rarr;
        </a>
      </p>

      {commentsOpen && (
        <BetaArtComments
          artKey={entry.key}
          title={entry.name}
          gameLocale={gameLocale}
          onCountChange={(count) => setLoadedCounts((current) => (
            current[storyId] === count ? current : { ...current, [storyId]: count }
          ))}
        />
      )}
    </div>
  );
}

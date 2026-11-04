"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import Image from "@/components/ui/static-image";
import { MonsterHealthBarView } from "@/components/codex/monster-ascension";
import { MonsterSpineStage } from "@/components/codex/monster-spine-stage";
import type { MonsterSpineAsset } from "@/lib/codex-types";
import { sts1MonsterImageUrl } from "@/lib/sts1/paths";
import type { Sts1Monster, Sts1MonsterMove, Sts1MonsterRect } from "@/lib/sts1/types";
import { textureSize } from "@/lib/sts1/vfx/assets";
import { Sts1StageEngine, type SpineSkeletonLike } from "@/lib/sts1/vfx/stage-engine";

/** Room above the monster for the intent, and below it for the health bar. */
const DETAIL_LAYOUT = { top: 84, bottom: 48, side: 16 };
const TILE_LAYOUT = { top: 4, bottom: 4, side: 4 };
/** Stills are drawn at one pixel per skeleton unit; past this they blur. */
const MAX_UNIT_SCALE = 1.75;
const NO_PADDING = { padLeft: "0%", padRight: "0%", padTop: "0%", padBottom: "0%" };

export interface Sts1MonsterPlayback {
  move: Sts1MonsterMove;
  nonce: number;
}

function percent(value: number): string {
  return `${value * 100}%`;
}

/** Places `inner` relative to `outer`, both in skeleton units (y up), as CSS percentages of `outer`. */
function placeWithin(inner: Sts1MonsterRect, outer: Sts1MonsterRect) {
  return {
    left: percent((inner.x - outer.x) / outer.width),
    top: percent((outer.y + outer.height - (inner.y + inner.height)) / outer.height),
    width: percent(inner.width / outer.width),
    height: percent(inner.height / outer.height),
  };
}

function useElementSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/**
 * The rect the stage fits, and how many game units one of its units is. A
 * skeleton's still is in skeleton units (the game draws it at
 * 1/`skeletonScale`); a monster drawn from an image stands on its bottom
 * edge, centered, at one game unit per pixel (`AbstractMonster.render`).
 */
function monsterBody(monster: Sts1Monster): { rect: Sts1MonsterRect; skeletonUnit: number } | null {
  if (monster.spine) {
    return { rect: monster.spine.still, skeletonUnit: 1 / (monster.vfx?.skeletonScale ?? 1) };
  }
  const size = monster.vfx?.image ? textureSize(monster.vfx.image) : null;
  if (!size) return null;
  return { rect: { x: -size.width / 2, y: 0, width: size.width, height: size.height }, skeletonUnit: 1 };
}

export function Sts1MonsterStage({
  monster,
  playback,
  intent = null,
  hpLabel = null,
  overlay,
  captureRef,
  variant = "detail",
  className,
}: {
  monster: Sts1Monster;
  playback: Sts1MonsterPlayback | null;
  intent?: ReactNode;
  hpLabel?: string | null;
  /** Drawn over the stage's top-left corner (the ascension stepper). */
  overlay?: ReactNode;
  captureRef?: RefObject<HTMLDivElement | null>;
  /** `tile`: the index thumbnail — no room for intent or health bar. */
  variant?: "detail" | "tile";
  className?: string;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const shakeRef = useRef<HTMLDivElement>(null);
  const motionRef = useRef<HTMLDivElement>(null);
  const behindRef = useRef<HTMLCanvasElement>(null);
  const frontRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Sts1StageEngine | null>(null);
  const size = useElementSize(stageRef);
  const spine = monster.spine;
  const stillUrl = sts1MonsterImageUrl(monster);
  const body = useMemo(() => monsterBody(monster), [monster]);
  const layout = variant === "tile" ? TILE_LAYOUT : DETAIL_LAYOUT;
  const [clip, setClip] = useState<{ name: string | null; nonce: number }>({ name: null, nonce: 0 });
  const [idle, setIdle] = useState<string | null>(null);
  const [bodyDrawn, setBodyDrawn] = useState(false);

  const box = useMemo(() => {
    if (!size) return null;
    const availableWidth = Math.max(0, size.width - layout.side * 2);
    const availableHeight = Math.max(0, size.height - layout.top - layout.bottom);
    if (!body) {
      return { left: layout.side, top: layout.top, width: availableWidth, height: availableHeight, unit: 1 };
    }
    const unit = Math.min(availableWidth / body.rect.width, availableHeight / body.rect.height, MAX_UNIT_SCALE);
    const width = body.rect.width * unit;
    const height = body.rect.height * unit;
    return {
      left: (size.width - width) / 2,
      top: size.height - layout.bottom - height,
      width,
      height,
      unit,
    };
  }, [body, layout, size]);

  useEffect(() => {
    const engine = new Sts1StageEngine(monster, {
      onClip: (name) => setClip((current) => ({ name, nonce: current.nonce + 1 })),
      onIdle: setIdle,
      onBodyDrawn: () => setBodyDrawn(true),
    });
    engineRef.current = engine;
    engine.attach({
      behind: behindRef.current,
      front: frontRef.current,
      motion: motionRef.current,
      shake: shakeRef.current,
    });
    return () => {
      engine.dispose();
      engineRef.current = null;
      setBodyDrawn(false);
      setClip({ name: null, nonce: 0 });
    };
  }, [monster]);

  // The motion element mounts with the measured box; hand it over when it appears.
  const hasBox = Boolean(box);
  useEffect(() => {
    engineRef.current?.attach({
      behind: behindRef.current,
      front: frontRef.current,
      motion: motionRef.current,
      shake: shakeRef.current,
    });
  }, [hasBox, monster]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !box || !size || !body) return;
    engine.setGeometry({
      width: size.width,
      height: size.height,
      pxPerUnit: box.unit / body.skeletonUnit,
      originX: box.left + (0 - body.rect.x) * box.unit,
      originY: box.top + box.height + body.rect.y * box.unit,
      skeletonUnit: body.skeletonUnit,
      monsterLeft: box.left,
    });
  }, [body, box, size, monster]);

  useEffect(() => {
    if (playback) engineRef.current?.play(playback.move);
  }, [playback]);

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    let intersecting = true;
    const update = () => engineRef.current?.setVisible(intersecting && !document.hidden);
    const observer = "IntersectionObserver" in window
      ? new IntersectionObserver(([entry]) => {
          intersecting = entry?.isIntersecting !== false;
          update();
        }, { rootMargin: "120px" })
      : null;
    observer?.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [monster]);

  const asset = useMemo<MonsterSpineAsset | null>(() => {
    if (!spine) return null;
    return {
      id: monster.id,
      source: "sts1",
      renderStatus: "ready",
      renderTags: [],
      atlasUrl: spine.atlasUrl,
      binaryUrl: "",
      jsonUrl: spine.skeletonUrl,
      textureUrls: [],
      skin: null,
      skins: [],
      animations: spine.animations,
      bestiaryAnimations: [],
      idleAnimation: spine.idle,
      // Timelines name clips directly.
      moveAnimations: Object.fromEntries(spine.animations.map((name) => [name, [name]])),
      moveEffects: {},
    };
  }, [monster.id, spine]);

  const viewport = useMemo(() => spine ? {
    x: spine.viewport.x,
    y: spine.viewport.y,
    width: spine.viewport.width,
    height: spine.viewport.height,
    padLeft: "0%",
    padRight: "0%",
    padTop: "0%",
    padBottom: "0%",
  } : null, [spine]);

  const healthBarWidth = box && size
    ? Math.min(Math.max(box.width + 24, 184), size.width - layout.side * 2)
    : 0;
  const tile = variant === "tile";

  return (
    <div
      ref={(element) => {
        stageRef.current = element;
        if (captureRef) captureRef.current = element;
      }}
      className={className ?? "relative h-[22rem] w-full max-w-2xl overflow-hidden sm:h-[28rem] lg:h-[30rem]"}
      data-monster-detail-render={tile ? undefined : ""}
    >
      {overlay ? <div className="absolute left-2 top-2 z-50 sm:left-3 sm:top-3">{overlay}</div> : null}
      <div ref={shakeRef} className="absolute inset-0">
        <canvas ref={behindRef} className="pointer-events-none absolute inset-0 z-0 h-full w-full" aria-hidden="true" />
        {box ? (
          <div className="absolute z-10" style={{ left: box.left, top: box.top, width: box.width, height: box.height }}>
            <div ref={motionRef} className="absolute inset-0">
              {spine && asset && viewport ? (
                <div className="absolute" style={placeWithin(spine.viewport, spine.still)}>
                  <MonsterSpineStage
                    asset={asset}
                    fallbackImageUrl={stillUrl}
                    monsterName={monster.name}
                    selectedMoveId={clip.name}
                    selectedMoveNonce={clip.nonce}
                    idleAnimationOverride={idle}
                    onPlayer={(player) => engineRef.current?.setSkeleton(
                      (player?.skeleton as SpineSkeletonLike | null | undefined) ?? null,
                    )}
                    className="relative h-full w-full"
                    viewportOverride={viewport}
                    viewportPadding={NO_PADDING}
                    viewportTransitionTime={0}
                    showLoadingLabel={false}
                    imagePriority={!tile}
                    fallbackImageClassName="absolute z-10 max-w-none object-fill"
                    fallbackImageStyle={placeWithin(spine.still, spine.viewport)}
                  />
                </div>
              ) : (
                <Image
                  src={stillUrl}
                  alt={monster.name}
                  width={640}
                  height={640}
                  priority={!tile}
                  className={`h-full w-full ${body ? "object-fill" : "object-contain object-bottom"} ${bodyDrawn ? "opacity-0" : ""}`}
                />
              )}
            </div>
          </div>
        ) : (
          // Before the stage is measured (and in the static HTML): the still alone.
          <Image
            src={stillUrl}
            alt={monster.name}
            width={640}
            height={640}
            priority={!tile}
            className={tile
              ? "absolute inset-1 h-[calc(100%-0.5rem)] w-[calc(100%-0.5rem)] object-contain object-bottom"
              : "absolute inset-x-4 bottom-12 top-20 h-[calc(100%-8rem)] w-[calc(100%-2rem)] object-contain object-bottom"}
          />
        )}
        <canvas ref={frontRef} className="pointer-events-none absolute inset-0 z-20 h-full w-full" aria-hidden="true" />
        {box && intent ? (
          <div
            className="pointer-events-none absolute z-40 flex -translate-x-1/2 justify-center"
            style={{ left: box.left + box.width / 2, top: Math.max(8, box.top - layout.top + 8) }}
            aria-hidden="true"
          >
            {intent}
          </div>
        ) : null}
        {box && hpLabel ? (
          <div
            className="pointer-events-none absolute z-40 flex justify-center"
            style={{ left: box.left + box.width / 2 - healthBarWidth / 2, top: box.top + box.height + 6, width: healthBarWidth }}
          >
            <MonsterHealthBarView hpLabel={hpLabel} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

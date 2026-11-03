"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import Image from "@/components/ui/static-image";
import { MonsterHealthBarView } from "@/components/codex/monster-ascension";
import { MonsterSpineStage } from "@/components/codex/monster-spine-stage";
import type { MonsterSpineAsset } from "@/lib/codex-types";
import { sts1Motion } from "@/lib/sts1/monster-moves";
import { sts1MonsterImageUrl } from "@/lib/sts1/paths";
import type { Sts1Monster, Sts1MonsterMove, Sts1MonsterRect } from "@/lib/sts1/types";

/** Room above the monster for the intent, and below it for the health bar. */
const TOP_RESERVE = 84;
const BOTTOM_RESERVE = 48;
const SIDE_GUTTER = 16;
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

export function Sts1MonsterStage({
  monster,
  playback,
  intent,
  hpLabel,
  overlay,
  captureRef,
}: {
  monster: Sts1Monster;
  playback: Sts1MonsterPlayback | null;
  intent: ReactNode;
  hpLabel: string | null;
  /** Drawn over the stage's top-left corner (the ascension stepper). */
  overlay?: ReactNode;
  captureRef?: RefObject<HTMLDivElement | null>;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const motionRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(stageRef);
  const spine = monster.spine;
  const stillUrl = sts1MonsterImageUrl(monster);

  const box = useMemo(() => {
    if (!size) return null;
    const availableWidth = Math.max(0, size.width - SIDE_GUTTER * 2);
    const availableHeight = Math.max(0, size.height - TOP_RESERVE - BOTTOM_RESERVE);
    if (!spine) {
      return { left: SIDE_GUTTER, top: TOP_RESERVE, width: availableWidth, height: availableHeight, unit: 1 };
    }
    const unit = Math.min(availableWidth / spine.still.width, availableHeight / spine.still.height, MAX_UNIT_SCALE);
    const width = spine.still.width * unit;
    const height = spine.still.height * unit;
    return {
      left: (size.width - width) / 2,
      top: size.height - BOTTOM_RESERVE - height,
      width,
      height,
      unit,
    };
  }, [size, spine]);

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
      moveAnimations: Object.fromEntries(monster.moves.flatMap((move) => {
        const clip = move.triggers.find((trigger) => trigger.type === "spine");
        return clip ? [[String(move.id), [clip.name]]] : [];
      })),
      moveEffects: {},
    };
  }, [monster.id, monster.moves, spine]);

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

  // Only moves with a clip restart the skeleton; the others keep idling.
  const clipMove = playback?.move.triggers.some((trigger) => trigger.type === "spine") ? playback : null;

  const unit = box?.unit ?? 1;
  useEffect(() => {
    const element = motionRef.current;
    if (!playback || !element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const trigger = playback.move.triggers.find((row) => row.type === "motion");
    const motion = trigger ? sts1Motion(trigger.name) : null;
    if (!motion) return;
    const animation = element.animate(
      motion.frames.map((frame) => ({
        offset: frame.offset,
        transform: `translate(${frame.x * unit}px, ${-frame.y * unit}px)`,
      })),
      { duration: motion.durationMs, easing: "linear" },
    );
    return () => animation.cancel();
    // `unit` is read once per trigger: a resize mid-lunge keeps the lunge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback]);

  const healthBarWidth = box && size
    ? Math.min(Math.max(box.width + 24, 184), size.width - SIDE_GUTTER * 2)
    : 0;

  return (
    <div
      ref={(element) => {
        stageRef.current = element;
        if (captureRef) captureRef.current = element;
      }}
      className="relative h-[22rem] w-full max-w-2xl overflow-hidden sm:h-[28rem] lg:h-[30rem]"
      data-monster-detail-render
    >
      {overlay ? <div className="absolute left-2 top-2 z-50 sm:left-3 sm:top-3">{overlay}</div> : null}
      {box ? (
        <>
          <div className="absolute" style={{ left: box.left, top: box.top, width: box.width, height: box.height }}>
            <div ref={motionRef} className="absolute inset-0">
              {spine && asset && viewport ? (
                <div className="absolute" style={placeWithin(spine.viewport, spine.still)}>
                  <MonsterSpineStage
                    asset={asset}
                    fallbackImageUrl={stillUrl}
                    monsterName={monster.name}
                    selectedMoveId={clipMove ? String(clipMove.move.id) : null}
                    selectedMoveNonce={clipMove?.nonce ?? 0}
                    className="relative h-full w-full"
                    viewportOverride={viewport}
                    viewportPadding={NO_PADDING}
                    viewportTransitionTime={0}
                    showLoadingLabel={false}
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
                  priority
                  className="h-full w-full object-contain object-bottom"
                />
              )}
            </div>
          </div>
          {intent ? (
            <div
              className="pointer-events-none absolute z-40 flex -translate-x-1/2 justify-center"
              style={{ left: box.left + box.width / 2, top: Math.max(8, box.top - TOP_RESERVE + 8) }}
              aria-hidden="true"
            >
              {intent}
            </div>
          ) : null}
          {hpLabel ? (
            <div
              className="pointer-events-none absolute z-40 flex justify-center"
              style={{ left: box.left + box.width / 2 - healthBarWidth / 2, top: box.top + box.height + 6, width: healthBarWidth }}
            >
              <MonsterHealthBarView hpLabel={hpLabel} />
            </div>
          ) : null}
        </>
      ) : (
        // Before the stage is measured (and in the static HTML): the still alone.
        <Image
          src={stillUrl}
          alt={monster.name}
          width={640}
          height={640}
          priority
          className="absolute inset-x-4 bottom-12 top-20 h-[calc(100%-8rem)] w-[calc(100%-2rem)] object-contain object-bottom"
        />
      )}
    </div>
  );
}

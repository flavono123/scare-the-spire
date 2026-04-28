"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

// Sequential per-node action queue. All card actions + relics for the current
// node feed in as one StackItem[] and play in order: appear → hold →
// text fade → post-effect (icon fly OR full fade) → next item slides up.
//
// 3-window slot-machine layout: pose 0 = current (center, full scale),
// pose -1 = just played (above, dim/blur), pose +1 = next (below, dim/blur).
// Items beyond ±1 are kept mounted at opacity 0 so React can reuse the same
// DOM as their pose changes.

const ROW_OFFSET = 40;
const APPEAR_MS = 280;
const HOLD_MS = 1700;
const TEXT_FADE_MS = 280;
const POST_GAP_MS = 100;
const ICON_FLY_MS = 640;
const ICON_FADE_MS = 380;
const SLOT_SHIFT_MS = 360;

export type NodeStackItemKind =
  | "card-gained"
  | "card-upgraded"
  | "card-enchanted"
  | "card-skipped"
  | "relic-gained";

export type NodeStackPostEffect =
  | { kind: "fly"; targetSelector: string }
  | { kind: "fade" };

export interface NodeStackItem {
  /** Stable React key — must change between distinct items in a step. */
  key: string;
  kind: NodeStackItemKind;
  /** Pre-rendered token (32×32 expected). */
  icon: ReactNode;
  /** Plain label (entity name). Empty string allowed for icon-less items. */
  label: string;
  /** Muted verb tag rendered after the label. */
  verb: string;
  /** Post-fade label color. Defaults to cream. */
  textColor?: string;
  postEffect: NodeStackPostEffect;
  /** Fires once this item's lifecycle finishes (after fly/fade lands). */
  onComplete?: () => void;
}

interface Point {
  x: number;
  y: number;
}

type Phase = "queued" | "appear" | "hold" | "textFade" | "postGap" | "post" | "done";

interface Props {
  stageRef: React.RefObject<HTMLDivElement | null>;
  items: NodeStackItem[];
  rate: number;
  onAllDone?: () => void;
}

export function NodeActionStack({ stageRef, items, rate, onAllDone }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const itemsRef = useRef(items);
  if (itemsRef.current !== items) {
    itemsRef.current = items;
    if (currentIndex !== 0) setCurrentIndex(0);
  }

  // Anchor at the right side of the current node. Re-measured whenever the
  // items batch changes (new step) and once on next frame (map scroll might
  // still be settling at mount time).
  const [origin, setOrigin] = useState<Point | null>(null);
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const compute = () => {
      const stageRect = stage.getBoundingClientRect();
      const node = stage.querySelector<HTMLElement>('[data-node-current="true"]');
      if (!node) {
        setOrigin(null);
        return;
      }
      const r = node.getBoundingClientRect();
      setOrigin({
        x: r.left - stageRect.left + r.width + 14,
        y: r.top - stageRect.top + r.height / 2 - 30,
      });
    };
    compute();
    const raf = window.requestAnimationFrame(compute);
    return () => window.cancelAnimationFrame(raf);
  }, [stageRef, items]);

  const allDoneRef = useRef(onAllDone);
  allDoneRef.current = onAllDone;
  useEffect(() => {
    if (items.length === 0) return;
    if (currentIndex >= items.length) allDoneRef.current?.();
  }, [currentIndex, items]);

  if (!origin || items.length === 0) return null;

  return (
    <>
      {items.map((item, index) => (
        <StackItemView
          key={item.key}
          stageRef={stageRef}
          origin={origin}
          item={item}
          index={index}
          currentIndex={currentIndex}
          rate={rate}
          onAdvance={() => {
            setCurrentIndex((i) => Math.max(i, index + 1));
            item.onComplete?.();
          }}
        />
      ))}
    </>
  );
}

interface StackItemViewProps {
  stageRef: React.RefObject<HTMLDivElement | null>;
  origin: Point;
  item: NodeStackItem;
  index: number;
  currentIndex: number;
  rate: number;
  onAdvance: () => void;
}

function StackItemView({
  stageRef,
  origin,
  item,
  index,
  currentIndex,
  rate,
  onAdvance,
}: StackItemViewProps) {
  const isCurrent = index === currentIndex;
  const pose = index - currentIndex;

  const [phase, setPhase] = useState<Phase>(index === 0 ? "appear" : "queued");
  const [target, setTarget] = useState<Point | null>(null);
  const onAdvanceRef = useRef(onAdvance);
  onAdvanceRef.current = onAdvance;

  // When this item *becomes* current, kick off its phase clock. Cleanup
  // cancels timers if the item is somehow displaced (shouldn't happen
  // mid-queue, but defensive).
  useEffect(() => {
    if (!isCurrent) return;
    setPhase("appear");
    const factor = 1 / Math.sqrt(Math.max(1, rate));
    const appear = Math.round(APPEAR_MS * factor);
    const hold = Math.round(HOLD_MS * factor);
    const textFade = Math.round(TEXT_FADE_MS * factor);
    const postGap = Math.round(POST_GAP_MS * factor);
    const postDur = Math.round(
      (item.postEffect.kind === "fly" ? ICON_FLY_MS : ICON_FADE_MS) * factor,
    );

    let t = 0;
    const tHold = (t += appear);
    const tTextFade = (t += hold);
    const tPostGap = (t += textFade);
    const tPost = (t += postGap);
    const tDone = (t += postDur);

    const ids: number[] = [];
    ids.push(window.setTimeout(() => setPhase("hold"), tHold));
    ids.push(window.setTimeout(() => setPhase("textFade"), tTextFade));
    ids.push(window.setTimeout(() => setPhase("postGap"), tPostGap));
    ids.push(window.setTimeout(() => setPhase("post"), tPost));
    ids.push(
      window.setTimeout(() => {
        setPhase("done");
        onAdvanceRef.current();
      }, tDone),
    );
    return () => {
      for (const id of ids) window.clearTimeout(id);
    };
  }, [isCurrent, rate, item.postEffect.kind]);

  // Resolve fly target the moment we enter the post phase; reading the rect
  // earlier risks measuring layout that's still settling.
  useLayoutEffect(() => {
    if (phase !== "post") return;
    if (item.postEffect.kind !== "fly") return;
    const stage = stageRef.current;
    if (!stage) return;
    const slot = stage.querySelector<HTMLElement>(item.postEffect.targetSelector);
    if (!slot) return;
    const stageRect = stage.getBoundingClientRect();
    const r = slot.getBoundingClientRect();
    setTarget({
      x: r.left - stageRect.left + r.width / 2,
      y: r.top - stageRect.top + r.height / 2,
    });
  }, [phase, stageRef, item.postEffect]);

  // ── Visual pose ──
  // While appearing, render the item AS IF it's still at pose +1 (below
  // slot, dim+blur), then phase=hold pulls it to pose=0 styling. This avoids
  // an opacity flash at the slot boundary.
  const isFlyDone =
    item.postEffect.kind === "fly" && (phase === "post" || phase === "done");
  const isFadeDone = item.postEffect.kind === "fade" && phase === "done";
  const visualPose = isCurrent && phase === "appear" ? 1 : pose;
  const fullyHidden =
    Math.abs(visualPose) >= 2 || isFlyDone || isFadeDone || phase === "queued";

  let slotScale = 1;
  let slotBlur = 0;
  let slotOpacity = 1;
  if (visualPose !== 0) {
    slotScale = 0.78;
    slotBlur = 2;
    slotOpacity = 0.5;
  }

  // Fly post-effect: take over transform / scale to send the icon to its
  // target. Run from current pose=0 anchor → target rect.
  const flying = isCurrent && phase === "post" && item.postEffect.kind === "fly";
  const flyDx = flying && target ? target.x - origin.x : 0;
  const flyDy = flying && target ? target.y - origin.y : 0;
  const flyScale = flying ? 0.18 : 1;

  const finalDx = flying ? flyDx : 0;
  const finalDy = flying ? flyDy : visualPose * ROW_OFFSET;
  const finalScale = flying ? flyScale : slotScale;
  const finalBlur = flying ? 0 : slotBlur;

  // Label fade: independent of icon fade. Triggered as soon as the post
  // phase starts approaching.
  const labelHidden =
    isCurrent &&
    (phase === "textFade" || phase === "postGap" || phase === "post");

  // Item opacity: fade post-effect fully fades the icon during "post"; fly
  // post-effect leaves icon at full opacity until it lands (fly target is
  // off-stage from the user's perspective).
  let itemOpacity = slotOpacity;
  if (fullyHidden) itemOpacity = 0;
  else if (item.postEffect.kind === "fade" && isCurrent && phase === "post")
    itemOpacity = 0;

  // Transition selection
  const factor = 1 / Math.sqrt(Math.max(1, rate));
  const transitionDur = (() => {
    if (flying) return Math.round(ICON_FLY_MS * factor);
    if (item.postEffect.kind === "fade" && isCurrent && phase === "post")
      return Math.round(ICON_FADE_MS * factor);
    if (isCurrent && phase === "appear")
      return Math.round(APPEAR_MS * factor);
    return Math.round(SLOT_SHIFT_MS * factor);
  })();
  const transitionEase = flying
    ? "cubic-bezier(0.45, 0.05, 0.6, 1)"
    : "cubic-bezier(0.22, 1, 0.36, 1)";

  if (fullyHidden && !flying) {
    // keep the DOM around so React can reuse the node when pose shifts
    return (
      <div
        aria-hidden
        data-pose={pose}
        data-phase={phase}
        className="pointer-events-none absolute opacity-0"
        style={{ left: origin.x, top: origin.y }}
      />
    );
  }

  const verbColor = "rgba(228, 228, 231, 0.85)";
  const labelColor = item.textColor ?? "#fafafa";

  return (
    <div
      aria-hidden
      data-testid="node-stack-item"
      data-kind={item.kind}
      data-pose={pose}
      data-phase={phase}
      className="pointer-events-none absolute z-30"
      style={{
        left: origin.x,
        top: origin.y,
        transform: `translate3d(${finalDx}px, calc(-50% + ${finalDy}px), 0) scale(${finalScale})`,
        transformOrigin: "left center",
        opacity: itemOpacity,
        filter: finalBlur > 0 ? `blur(${finalBlur}px)` : undefined,
        transition: `transform ${transitionDur}ms ${transitionEase}, opacity ${transitionDur}ms ${transitionEase}, filter ${transitionDur}ms ${transitionEase}`,
        willChange: "transform, opacity, filter",
      }}
    >
      {/* Per-item radial halo — only on the current item. Soft black glow
          fading to transparent so the label reads against the map without
          a visible container boundary. */}
      {isCurrent && phase !== "appear" && (
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: -44,
            top: -32,
            width: "calc(100% + 96px)",
            height: "calc(100% + 64px)",
            background:
              "radial-gradient(ellipse at left center, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.55) 30%, rgba(0,0,0,0.18) 65%, rgba(0,0,0,0) 100%)",
            zIndex: -1,
            opacity: labelHidden ? 0 : 1,
            transition: `opacity ${Math.round(TEXT_FADE_MS * factor)}ms ease-out`,
          }}
        />
      )}

      <div className="flex items-center gap-2">
        {item.icon}
        {item.label && (
          <p
            className="text-[13px] font-bold leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]"
            style={{
              color: labelColor,
              opacity: labelHidden ? 0 : 1,
              transition: `opacity ${Math.round(TEXT_FADE_MS * factor)}ms ease-out, color ${Math.round(APPEAR_MS * factor)}ms ease-out`,
              WebkitTextStroke: "0.5px rgba(0,0,0,0.85)",
              whiteSpace: "nowrap",
            }}
          >
            <span>{item.label}</span>
            {item.verb && (
              <span
                className="ml-1 text-xs font-semibold"
                style={{ color: verbColor }}
              >
                {item.verb}
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

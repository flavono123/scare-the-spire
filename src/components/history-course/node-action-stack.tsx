"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

// Sequential per-node action queue. Stateless — every visual derives from
// `nodeLocalMs` (the elapsed time within the current node, fed by the
// shell's rAF ticker). Pausing the ticker freezes nodeLocalMs and the
// stack stops dead, mid-fly or mid-hold. No setTimeout, no CSS transition
// for the live progress bar — just per-frame transform interpolation.
//
// Per-item budget is fixed at 1× regardless of how many items the node
// has; node duration scales with item count instead. Slot machine layout:
// pose 0 = active (center), pose -1 = just played (above, dim), pose +1 =
// next (below, dim).

export const PER_ITEM_MS = 2500;
const APPEAR_MS = 240;
const HOLD_MS = 1300;
const TEXT_FADE_MS = 200;
const POST_GAP_MS = 60;
const POST_MS = 700;
// 240 + 1300 + 200 + 60 + 700 = 2500 = PER_ITEM_MS
// Card fly post phase needs room for the full NCardFlyVfx mirror —
// accelerating Bezier (~480ms) + endpoint shrink (~220ms). Hold trims
// to 1300ms to make room.

// NCardFlyVfx parameters (decompiled from sts2.dll v0.103):
//   _controlPointOffset = Rng.NextFloat(100, 400)
//   _speed              = Rng.NextFloat(1.1, 1.25)  // initial
//   _accel              = Rng.NextFloat(2, 2.5)
//   _duration           = Rng.NextFloat(1, 1.75)    // seconds
// Frame loop: time += speed × dt; speed += accel × dt; t = time/duration.
// Control point: midpoint(P0, P2) with c.y -= arcDir, where
//   arcDir = (target.y < viewport.y/2) ? -500 : (500 + controlPointOffset)
// — i.e. the arc bows AWAY from the target's vertical half (sling motion).
// Visible card rotates to follow tangent (angle + π/2, lerp 12 smoothing).
// Body fade: white→black + scale 1→0.1 over (time × 3 / duration) clamp[0,1].
// Phase 2: after Phase 1 ends, scale 0.1→0 over a second `duration` cycle.
const CARD_FLY_INITIAL_SPEED = 1.175; // mid of 1.1..1.25
const CARD_FLY_ACCEL = 2.25; // mid of 2..2.5
const CARD_FLY_DURATION_S = 1.375; // mid of 1..1.75 (game seconds)
// Real-time τ such that ∫₀^τ (T0 + ACC·s) ds = DURATION_S, i.e. when
// the Bezier t hits 1 in the game's accelerating clock.
const CARD_FLY_TAU_MAX =
  (-CARD_FLY_INITIAL_SPEED +
    Math.sqrt(
      CARD_FLY_INITIAL_SPEED * CARD_FLY_INITIAL_SPEED +
        2 * CARD_FLY_ACCEL * CARD_FLY_DURATION_S,
    )) /
  CARD_FLY_ACCEL;
// Of the POST_MS window, how much is Phase 1 (Bezier travel) vs Phase 2
// (endpoint shrink). The game runs them back to back at the same
// duration; we squeeze Phase 2 into a smaller tail since by then the
// card is at the slot and basically invisible.
const CARD_FLY_PHASE1_FRAC = 0.78;

const ROW_OFFSET = 40;

export type NodeStackItemKind =
  | "card-gained"
  | "card-bought"
  | "card-upgraded"
  | "card-enchanted"
  | "card-skipped"
  | "card-removed"
  | "relic-gained"
  | "hp-loss"
  | "hp-heal"
  | "max-hp-up"
  | "max-hp-down";

export type NodeStackPostEffect =
  | { kind: "fly"; targetSelector: string }
  | { kind: "fade" };

export interface NodeStackItem {
  key: string;
  kind: NodeStackItemKind;
  icon: ReactNode;
  label: string;
  verb: string;
  textColor?: string;
  postEffect: NodeStackPostEffect;
  onComplete?: () => void;
}

interface Point {
  x: number;
  y: number;
}

type Phase = "appear" | "hold" | "textFade" | "postGap" | "post" | "done";

function phaseAt(localT: number): { phase: Phase; phaseProgress: number } {
  if (localT <= 0) return { phase: "appear", phaseProgress: 0 };
  let t = localT;
  if (t < APPEAR_MS) return { phase: "appear", phaseProgress: t / APPEAR_MS };
  t -= APPEAR_MS;
  if (t < HOLD_MS) return { phase: "hold", phaseProgress: t / HOLD_MS };
  t -= HOLD_MS;
  if (t < TEXT_FADE_MS) return { phase: "textFade", phaseProgress: t / TEXT_FADE_MS };
  t -= TEXT_FADE_MS;
  if (t < POST_GAP_MS) return { phase: "postGap", phaseProgress: t / POST_GAP_MS };
  t -= POST_GAP_MS;
  if (t < POST_MS) return { phase: "post", phaseProgress: t / POST_MS };
  return { phase: "done", phaseProgress: 1 };
}

function easeOutCubic(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - x, 3);
}

function easeInOutCubic(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Deterministic 0..1 from a string key — used to vary the card-fly
 *  control-point offset per item without committing to a real RNG. */
function stableHash01(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000) / 1000;
}

interface Props {
  stageRef: React.RefObject<HTMLDivElement | null>;
  items: NodeStackItem[];
  /** Elapsed ms within the current node (0 .. items.length × PER_ITEM_MS).
   *  Driven by the shell's rAF ticker. When the shell pauses, this stops
   *  changing and every visual freezes in place. */
  nodeLocalMs: number;
}

export function NodeActionStack({ stageRef, items, nodeLocalMs }: Props) {
  // Anchor — right side of the current map node.
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

  // Pre-measure fly destinations whenever the items batch changes.
  const [targets, setTargets] = useState<Map<string, Point>>(new Map());
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const stageRect = stage.getBoundingClientRect();
    const m = new Map<string, Point>();
    for (const item of items) {
      if (item.postEffect.kind !== "fly") continue;
      const slot = stage.querySelector<HTMLElement>(item.postEffect.targetSelector);
      if (!slot) continue;
      const r = slot.getBoundingClientRect();
      m.set(item.key, {
        x: r.left - stageRect.left + r.width / 2,
        y: r.top - stageRect.top + r.height / 2,
      });
    }
    setTargets(m);
  }, [stageRef, items]);

  // Fire onComplete exactly once per item, when nodeLocalMs crosses its
  // end boundary. Resets when the items batch changes (new step).
  const completedRef = useRef<Set<string>>(new Set());
  const itemsKeyRef = useRef<NodeStackItem[]>(items);
  if (itemsKeyRef.current !== items) {
    itemsKeyRef.current = items;
    completedRef.current = new Set();
  }
  useEffect(() => {
    for (let i = 0; i < items.length; i++) {
      const itemEnd = (i + 1) * PER_ITEM_MS;
      const item = items[i];
      if (nodeLocalMs >= itemEnd && !completedRef.current.has(item.key)) {
        completedRef.current.add(item.key);
        item.onComplete?.();
      }
    }
  }, [items, nodeLocalMs]);

  if (!origin || items.length === 0) return null;

  const currentIndex = Math.min(
    items.length - 1,
    Math.max(0, Math.floor(nodeLocalMs / PER_ITEM_MS)),
  );

  return (
    <>
      {items.map((item, index) => (
        <StackItemView
          key={item.key}
          item={item}
          index={index}
          currentIndex={currentIndex}
          nodeLocalMs={nodeLocalMs}
          origin={origin}
          target={targets.get(item.key) ?? null}
        />
      ))}
    </>
  );
}

function StackItemView({
  item,
  index,
  currentIndex,
  nodeLocalMs,
  origin,
  target,
}: {
  item: NodeStackItem;
  index: number;
  currentIndex: number;
  nodeLocalMs: number;
  origin: Point;
  target: Point | null;
}) {
  const itemStartMs = index * PER_ITEM_MS;
  const localT = Math.max(0, nodeLocalMs - itemStartMs);
  const pose = index - currentIndex;
  const isActive = pose === 0 && nodeLocalMs >= itemStartMs;

  const { phase, phaseProgress } = isActive
    ? phaseAt(localT)
    : pose < 0
      ? { phase: "done" as Phase, phaseProgress: 1 }
      : { phase: "appear" as Phase, phaseProgress: 0 };

  // visualPose — slot reel landing. The active item slides 1→0 (below
  // slot up to centre); the upcoming item (pose 1) slides 2→1 in
  // tandem so the user sees the active item lead the reel instead of
  // a stale "next" ghost sitting alone before the active arrives.
  // Without this synchronisation the first frame of a new node has
  // pose 0 and pose 1 stacked at slot 1, and DOM order makes pose 1
  // (rendered last) paint over pose 0 — reading as the next-up item
  // appearing first.
  let visualPose: number = pose;
  if (isActive && phase === "appear") {
    visualPose = 1 - easeOutCubic(phaseProgress);
  } else if (pose === 1) {
    // Match pose 0's appear progress so we slide together.
    const pose0LocalT = nodeLocalMs - currentIndex * PER_ITEM_MS;
    if (pose0LocalT >= 0 && pose0LocalT < APPEAR_MS) {
      const t = pose0LocalT / APPEAR_MS;
      visualPose = 2 - easeOutCubic(t);
    }
  }

  // Slot styling — lerp by |visualPose| in [0, 1]; |visualPose| ≥ 2 hides.
  const absPose = Math.abs(visualPose);
  const slotT = Math.min(1, absPose);
  const slotScale = 1 - slotT * (1 - 0.78);
  const slotBlur = slotT * 2;
  let slotOpacity = 1 - slotT * (1 - 0.5);
  if (absPose >= 2) slotOpacity = 0;

  // Fly post-effect computation
  const flying = isActive && phase === "post" && item.postEffect.kind === "fly" && target != null;
  let finalDx = 0;
  let finalDy = visualPose * ROW_OFFSET;
  let finalScale = slotScale;
  let finalBlur = slotBlur;
  let itemOpacity = slotOpacity;

  let flyRotationDeg = 0;
  let flyBrightness = 1;
  // Cards mirror the decompiled NCardFlyVfx; relics/everything else fly
  // along the original linear Bezier-less trajectory (per user note —
  // straight feels right for relics, the arc reads as overdone).
  const isCardFly =
    flying &&
    (item.kind === "card-gained" ||
      item.kind === "card-bought" ||
      item.kind === "card-upgraded" ||
      item.kind === "card-enchanted");

  if (flying && target && !isCardFly) {
    // Linear (relic) — straight line with cubic ease, scale 1 → 0.18.
    const ease = easeInOutCubic(phaseProgress);
    finalDx = (target.x - origin.x) * ease;
    finalDy = (target.y - origin.y) * ease;
    finalScale = 1 + (0.18 - 1) * ease;
    finalBlur = 0;
    itemOpacity = 1;
  } else if (flying && target && isCardFly) {
    // ----- NCardFlyVfx mirror -----
    // Phase 1 (0..PHASE1_FRAC of POST_MS): Bezier arc with accelerating
    // game clock + tangent rotation + scale 1→0.1.
    // Phase 2 (PHASE1_FRAC..1): card stays at endpoint, scale 0.1→0.
    if (phaseProgress < CARD_FLY_PHASE1_FRAC) {
      const phase1Local = phaseProgress / CARD_FLY_PHASE1_FRAC; // 0..1
      const tau = phase1Local * CARD_FLY_TAU_MAX;
      const elapsed =
        CARD_FLY_INITIAL_SPEED * tau + 0.5 * CARD_FLY_ACCEL * tau * tau;
      const tBezier = Math.min(1, elapsed / CARD_FLY_DURATION_S);

      // Sling control point: midpoint pulled AWAY from target's
      // vertical half. We approximate the game's viewport-half decision
      // using origin Y as a stand-in for "play area" — the deck slot
      // sits in the topbar (small Y), so the arc bows downward.
      // controlPointOffset is randomized in-game (100..400); use a
      // stable per-item value so each fly looks unique without shifting
      // each frame.
      const ctlOffset = 100 + (stableHash01(item.key) * 300); // 100..400
      const targetInUpperHalf = target.y < origin.y;
      const arcDir = targetInUpperHalf ? -500 : 500 + ctlOffset;
      const midX = (origin.x + target.x) * 0.5;
      const midY = (origin.y + target.y) * 0.5;
      const cX = midX;
      const cY = midY - arcDir;
      const u = 1 - tBezier;
      const px = u * u * origin.x + 2 * u * tBezier * cX + tBezier * tBezier * target.x;
      const py = u * u * origin.y + 2 * u * tBezier * cY + tBezier * tBezier * target.y;
      // Tangent for rotation — derivative of B(t) is 2(1-t)(C-P0) +
      // 2t(P2-C). Use it directly so we don't need a forward sample.
      const dxT = 2 * (1 - tBezier) * (cX - origin.x) + 2 * tBezier * (target.x - cX);
      const dyT = 2 * (1 - tBezier) * (cY - origin.y) + 2 * tBezier * (target.y - cY);
      const angleRad = Math.atan2(dyT, dxT) + Math.PI / 2;
      finalDx = px - origin.x;
      finalDy = py - origin.y;
      flyRotationDeg = (angleRad * 180) / Math.PI;

      // Scale 1 → 0.1 + brightness modulate over (time × 3 / duration).
      const colorT = Math.max(
        0,
        Math.min(1, (elapsed * 3) / CARD_FLY_DURATION_S),
      );
      finalScale = 1 + (0.1 - 1) * colorT;
      // Game uses Modulate white → black (silhouette). Approximate via
      // CSS brightness — drops to 0.25 at full colorT (dark but not
      // pure-black, since our icons have outlines that read better not
      // crushed). itemOpacity stays at 1.
      flyBrightness = 1 - 0.75 * colorT;
      finalBlur = 0;
      itemOpacity = 1;
    } else {
      // Phase 2 — pinned at endpoint, scale collapses.
      const phase2Local =
        (phaseProgress - CARD_FLY_PHASE1_FRAC) / (1 - CARD_FLY_PHASE1_FRAC);
      finalDx = target.x - origin.x;
      finalDy = target.y - origin.y;
      finalScale = Math.max(0, 0.1 + (-0.05 - 0.1) * phase2Local);
      flyRotationDeg = 0;
      flyBrightness = 0.25;
      finalBlur = 0;
      itemOpacity = finalScale > 0 ? 1 : 0;
    }
  }

  // Fade post-effect: icon fades out during the post phase.
  if (
    isActive &&
    item.postEffect.kind === "fade" &&
    (phase === "post" || phase === "done")
  ) {
    if (phase === "post") {
      itemOpacity = (1 - phaseProgress) * slotOpacity;
    } else {
      itemOpacity = 0;
    }
  }

  // Once fly post phase ends, the item is "gone" — hide.
  if (isActive && item.postEffect.kind === "fly" && phase === "done") {
    itemOpacity = 0;
  }

  // Two-window slot machine: only the active item (pose 0) and the
  // upcoming item (pose 1) render. Past items disappear cleanly via
  // their post-effect (fly out / fade out) and never linger above as
  // a blurred ghost.
  if (pose < 0) return null;

  if (itemOpacity <= 0.005 && !flying) return null;

  // Label fade — synchronized with phase.
  let labelOpacity = 1;
  if (phase === "appear") labelOpacity = easeOutCubic(phaseProgress);
  else if (phase === "hold") labelOpacity = 1;
  else if (phase === "textFade") labelOpacity = 1 - phaseProgress;
  else labelOpacity = 0;

  const verbColor = "rgba(228, 228, 231, 0.85)";
  const labelColor = item.textColor ?? "#fafafa";

  // Soft bloom — only on the active item with the label still up.
  const showBloom = isActive && labelOpacity > 0.4;
  const slotFilter = finalBlur > 0 ? `blur(${finalBlur.toFixed(2)}px)` : "";
  const bloomFilter = showBloom
    ? "drop-shadow(0 0 4px rgba(0,0,0,0.85)) drop-shadow(0 0 10px rgba(0,0,0,0.7)) drop-shadow(0 0 22px rgba(0,0,0,0.45)) drop-shadow(0 0 36px rgba(0,0,0,0.25))"
    : "";
  const brightnessFilter = flyBrightness < 1
    ? `brightness(${flyBrightness.toFixed(3)})`
    : "";
  const composedFilter =
    [slotFilter, brightnessFilter, bloomFilter].filter(Boolean).join(" ") ||
    undefined;

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
        // For card flies we pivot around the icon's centre (16px = half
        // the 32px icon column) so the rotation tumbles in place along
        // the Bezier arc instead of swinging around the icon's left
        // edge. Relic fly + slot mode keep the original left-anchored
        // pivot so the label tail aligns predictably.
        transform: isCardFly
          ? `translate3d(${finalDx.toFixed(2)}px, calc(-50% + ${finalDy.toFixed(2)}px), 0) rotate(${flyRotationDeg.toFixed(1)}deg) scale(${finalScale.toFixed(3)})`
          : `translate3d(${finalDx.toFixed(2)}px, calc(-50% + ${finalDy.toFixed(2)}px), 0) scale(${finalScale.toFixed(3)})`,
        transformOrigin: isCardFly ? "16px center" : "left center",
        opacity: itemOpacity,
        filter: composedFilter,
        willChange: "transform, opacity, filter",
      }}
    >
      <div className="flex items-center gap-2.5">
        {item.icon}
        {item.label && (
          <p
            className="font-bold leading-none"
            style={{
              fontSize: "22px",
              color: labelColor,
              opacity: labelOpacity,
              WebkitTextStroke: "0.6px rgba(0,0,0,0.85)",
              whiteSpace: "nowrap",
            }}
          >
            <span>{item.label}</span>
            {item.verb && (
              <span
                className="ml-1.5 font-bold"
                style={{ color: verbColor, fontSize: "18px" }}
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

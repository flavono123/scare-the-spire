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
const APPEAR_MS = 280;
const HOLD_MS = 1700;
const TEXT_FADE_MS = 240;
const POST_GAP_MS = 80;
const POST_MS = 200;
// 280 + 1700 + 240 + 80 + 200 = 2500 = PER_ITEM_MS

const ROW_OFFSET = 40;

export type NodeStackItemKind =
  | "card-gained"
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

  // visualPose — for the appear phase of the active item, interpolate from
  // +1 (below slot) to 0 (center) so it slides up like a slot reel landing.
  let visualPose: number = pose;
  if (isActive && phase === "appear") {
    visualPose = 1 - easeOutCubic(phaseProgress);
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

  if (flying && target) {
    const ease = easeInOutCubic(phaseProgress);
    finalDx = (target.x - origin.x) * ease;
    finalDy = (target.y - origin.y) * ease;
    finalScale = 1 + (0.18 - 1) * ease;
    finalBlur = 0;
    itemOpacity = 1;
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
  const composedFilter = [slotFilter, bloomFilter].filter(Boolean).join(" ") || undefined;

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
        transform: `translate3d(${finalDx.toFixed(2)}px, calc(-50% + ${finalDy.toFixed(2)}px), 0) scale(${finalScale.toFixed(3)})`,
        transformOrigin: "left center",
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

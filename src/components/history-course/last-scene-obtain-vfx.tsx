"use client";

import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

/** Piecewise Godot curves from `scenes/vfx/vfx_item_throw.tscn`. */
const THROW_HORIZONTAL: Array<[number, number]> = [
  [0, 0],
  [0.496583, 0.549666],
  [1, 1],
];
const THROW_VERTICAL: Array<[number, number]> = [
  [0, 0],
  [0.298405, 1],
  [0.753986, 1],
  [1, 0],
];
const THROW_SPIN: Array<[number, number]> = [
  [0.00227791, 0.994574],
  [0.501139, 0.196995],
  [1, 0.647329],
];

const HEIGHT_PX = 350;
const SPIN_DEG = -2880;

type Point = { x: number; y: number };

export type LastSceneObtainKind = "relic" | "potion" | "card";

export function cssEscapeAttr(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/"/g, '\\"');
}

export function relicTargetSelector(id: string): string {
  const stripped = id.includes(".") ? (id.split(".").pop() ?? id) : id;
  const prefixed = id.toUpperCase().startsWith("RELIC.") ? id : `RELIC.${stripped}`;
  const ids = Array.from(new Set([id, stripped, prefixed]));
  return ids.map((value) => `[data-relic-target="${cssEscapeAttr(value)}"]`).join(", ");
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function sampleCurve(points: Array<[number, number]>, t: number): number {
  const x = Math.max(0, Math.min(1, t));
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const next = points[i]!;
    if (x <= next[0]) {
      const span = next[0] - prev[0] || 1;
      return lerp(prev[1], next[1], (x - prev[0]) / span);
    }
  }
  return points[points.length - 1]?.[1] ?? x;
}

function cubicBezier(t: number, p0: Point, p1: Point, p2: Point, p3: Point): Point {
  const u = 1 - t;
  return {
    x: u ** 3 * p0.x + 3 * u ** 2 * t * p1.x + 3 * u * t ** 2 * p2.x + t ** 3 * p3.x,
    y: u ** 3 * p0.y + 3 * u ** 2 * t * p1.y + 3 * u * t ** 2 * p2.y + t ** 3 * p3.y,
  };
}

function queryTarget(selector: string): HTMLElement | null {
  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}

function centerOf(el: HTMLElement): Point {
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export function bounceTranslateY(progress: number): number {
  const t = Math.max(0, Math.min(1, progress / 0.18));
  if (progress >= 0.18) return 0;
  return -Math.sin(Math.PI * t) * 22;
}

export function itemThrowPoint(start: Point, end: Point, t: number): { point: Point; rotate: number } {
  const u = Math.max(0, Math.min(1, t));
  const x = lerp(start.x, end.x, sampleCurve(THROW_HORIZONTAL, u));
  const y = lerp(start.y, end.y, u) - HEIGHT_PX * sampleCurve(THROW_VERTICAL, u);
  const rotate = SPIN_DEG * sampleCurve(THROW_SPIN, u) * u;
  return { point: { x, y }, rotate };
}

export function cardBezierPoint(start: Point, end: Point, t: number): Point {
  const midX = lerp(start.x, end.x, 0.45);
  const control1 = { x: lerp(start.x, midX, 0.4), y: start.y - 160 };
  const control2 = { x: lerp(midX, end.x, 0.35), y: end.y - 40 };
  return cubicBezier(Math.max(0, Math.min(1, t)), start, control1, control2, end);
}

export function LastSceneObtainFly({
  active,
  progress,
  sourceSelector,
  targetSelector,
  iconUrl,
  kind,
  size = 56,
}: {
  active: boolean;
  progress: number;
  sourceSelector: string;
  targetSelector: string;
  iconUrl: string;
  kind: LastSceneObtainKind;
  size?: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [pose, setPose] = useState<{ x: number; y: number; rotate: number; scale: number; opacity: number } | null>(null);

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- portal only after client mount
    setMounted(true);
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- fly pose tracks source/target layout */
  useLayoutEffect(() => {
    if (!active || !iconUrl) {
      setPose(null);
      return;
    }
    const source = queryTarget(sourceSelector);
    const target = queryTarget(targetSelector);
    if (!source || !target) {
      setPose(null);
      return;
    }
    const start = centerOf(source);
    const end = centerOf(target);
    if (progress < 0.18) {
      setPose({
        x: start.x,
        y: start.y + bounceTranslateY(progress),
        rotate: 0,
        scale: 1,
        opacity: 1,
      });
      return;
    }
    const flyT = Math.max(0, Math.min(1, (progress - 0.18) / 0.64));
    if (kind === "card") {
      const point = cardBezierPoint(start, end, flyT);
      setPose({
        x: point.x,
        y: point.y,
        rotate: 0,
        scale: lerp(1, 0.22, flyT),
        opacity: flyT >= 1 ? 0 : 1,
      });
      return;
    }
    const thrown = itemThrowPoint(start, end, flyT);
    setPose({
      x: thrown.point.x,
      y: thrown.point.y,
      rotate: thrown.rotate,
      scale: lerp(1, 0.28, flyT),
      opacity: flyT >= 1 ? 0 : 1,
    });
  }, [active, iconUrl, kind, progress, sourceSelector, targetSelector]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!mounted || !active || !pose || pose.opacity <= 0) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed z-[80]"
      style={{
        left: pose.x,
        top: pose.y,
        width: size,
        height: size,
        transform: `translate(-50%, -50%) rotate(${pose.rotate}deg) scale(${pose.scale})`,
        opacity: pose.opacity,
      }}
      data-history-obtain-fly={kind}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={iconUrl} alt="" className="h-full w-full object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,0.55)]" />
    </div>,
    document.body,
  );
}

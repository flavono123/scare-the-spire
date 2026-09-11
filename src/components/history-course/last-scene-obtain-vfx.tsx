"use client";

import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FittedCardTile } from "@/components/history-course/fitted-card-tile";
import type { CodexCard } from "@/lib/codex-types";
import type { ServiceLocale } from "@/lib/i18n";
import { CARD_ASPECT_H, CARD_ASPECT_W } from "@/lib/sts2-card-style";

type Point = { x: number; y: number };

export type LastSceneObtainKind = "relic" | "potion" | "card";

/** NPotion.DoBounce is 12px / 0.25s. Slightly taller so the hop reads without SFX. */
const ITEM_BOB_PX = 14;
/** Vertical pop while sliding into the topbar. Game obtain is a 0.35s position tween, not vfx_item_throw. */
const ITEM_HOP_PX = 22;
const ITEM_BOB_END = 0.12;
const ITEM_FLY_DURATION = 0.35 / 1.2;

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

function quadOut(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  return 1 - (1 - u) * (1 - u);
}

/** Godot `MathHelper.BezierCurve(v0, v1, c0, t)`. */
export function quadraticBezier(p0: Point, p1: Point, control: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * control.x + t * t * p1.x,
    y: u * u * p0.y + 2 * u * t * control.y + t * t * p1.y,
  };
}

export function cardFlyControl(start: Point, end: Point, viewportHeight: number): Point {
  const mid = { x: lerp(start.x, end.x, 0.5), y: lerp(start.y, end.y, 0.5) };
  const scale = Math.max(0.35, viewportHeight / 1080);
  const controlOffset = 250 * scale;
  const endInTopHalf = end.y < viewportHeight * 0.5;
  const arcDir = endInTopHalf ? -500 * scale : (500 + controlOffset) * scale;
  return { x: mid.x, y: mid.y - arcDir };
}

/** NCardFlyVfx speeds up as it flies (`_speed` + `_accel`). */
export function cardFlyParametric(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  return Math.min(1, 1.15 * u * u + 0.15 * u);
}

export function itemBobTranslateY(progress: number): number {
  if (progress >= ITEM_BOB_END) return 0;
  const t = progress / ITEM_BOB_END;
  return -Math.sin(Math.PI * t) * ITEM_BOB_PX;
}

export function itemHopPoint(start: Point, end: Point, t: number): Point {
  const eased = quadOut(t);
  return {
    x: lerp(start.x, end.x, eased),
    y: lerp(start.y, end.y, eased) - Math.sin(Math.PI * Math.max(0, Math.min(1, t))) * ITEM_HOP_PX,
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

export function LastSceneObtainFly({
  active,
  progress,
  sourceSelector,
  targetSelector,
  iconUrl,
  kind,
  size = 56,
  card,
  upgradeLevel = 0,
  serviceLocale = "ko",
}: {
  active: boolean;
  progress: number;
  sourceSelector: string;
  targetSelector: string;
  iconUrl: string;
  kind: LastSceneObtainKind;
  size?: number;
  card?: CodexCard;
  upgradeLevel?: number;
  serviceLocale?: ServiceLocale;
}) {
  const [mounted, setMounted] = useState(false);
  const [pose, setPose] = useState<{
    x: number;
    y: number;
    rotate: number;
    scale: number;
    opacity: number;
    darken: number;
    width: number;
    height: number;
  } | null>(null);

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- portal only after client mount
    setMounted(true);
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- fly pose tracks source/target layout */
  useLayoutEffect(() => {
    if (!active || (!iconUrl && !card)) {
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
    const sourceRect = source.getBoundingClientRect();
    const sourceWidth = Math.max(sourceRect.width, size);
    const sourceHeight = Math.max(sourceRect.height, size);

    if (kind === "card") {
      const flyT = cardFlyParametric(Math.max(0, Math.min(1, progress)));
      const viewportHeight = window.innerHeight || 1080;
      const control = cardFlyControl(start, end, viewportHeight);
      const point = quadraticBezier(start, end, control, flyT);
      const lookAhead = quadraticBezier(start, end, control, Math.min(1, flyT + 0.05));
      const angle = Math.atan2(lookAhead.y - point.y, lookAhead.x - point.x) + Math.PI / 2;
      const shrink = Math.min(1, flyT * 3);
      const scale = flyT >= 0.92 ? lerp(0.1, 0, (flyT - 0.92) / 0.08) : lerp(1, 0.1, shrink);
      setPose({
        x: point.x,
        y: point.y,
        rotate: (angle * 180) / Math.PI,
        scale: Math.max(0, scale),
        opacity: flyT >= 1 || scale <= 0 ? 0 : 1,
        darken: shrink,
        width: sourceWidth,
        height: sourceHeight || sourceWidth * (CARD_ASPECT_H / CARD_ASPECT_W),
      });
      return;
    }

    if (progress < ITEM_BOB_END) {
      setPose({
        x: start.x,
        y: start.y + itemBobTranslateY(progress),
        rotate: 0,
        scale: 1,
        opacity: 1,
        darken: 0,
        width: size,
        height: size,
      });
      return;
    }
    const flyT = Math.max(0, Math.min(1, (progress - ITEM_BOB_END) / ITEM_FLY_DURATION));
    const point = itemHopPoint(start, end, flyT);
    setPose({
      x: point.x,
      y: point.y,
      rotate: 0,
      scale: lerp(1, 0.92, flyT),
      opacity: flyT >= 1 ? 0 : 1,
      darken: 0,
      width: size,
      height: size,
    });
  }, [active, card, iconUrl, kind, progress, size, sourceSelector, targetSelector]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!mounted || !active || !pose || pose.opacity <= 0) return null;

  const useCard = kind === "card" && card;

  return createPortal(
    <div
      className="pointer-events-none fixed z-[80] overflow-visible"
      style={{
        left: pose.x,
        top: pose.y,
        width: pose.width,
        height: pose.height,
        transform: `translate(-50%, -50%) rotate(${pose.rotate}deg) scale(${pose.scale})`,
        opacity: pose.opacity,
        filter: pose.darken > 0 ? `brightness(${Math.max(0, 1 - pose.darken)}) contrast(1.15)` : undefined,
      }}
      data-history-obtain-fly={kind}
      aria-hidden
    >
      {useCard ? (
        <FittedCardTile
          card={card}
          showUpgrade={upgradeLevel > 0}
          upgradeLevel={upgradeLevel}
          showBeta={false}
          interactive={false}
          serviceLocale={serviceLocale}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={iconUrl} alt="" className="h-full w-full object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,0.55)]" />
      )}
    </div>,
    document.body,
  );
}

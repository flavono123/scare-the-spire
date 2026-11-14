"use client";

/**
 * NTargetingArrow (0.113.0): 19 segment sprites along a quadratic Bezier from the card to the target, plus a
 * head, tinted StsColors.targetingArrowEnemy (E61E1B) over an enemy. The geometry is the node's
 * `UpdateArrowPosition` / `UpdateSegments`; the head's rotation feeds back into its own position, so it is
 * iterated to its fixed point. Shown while the card is lifted toward a single target.
 */

import type { CSSProperties } from "react";
import { UI_SCALE } from "./stage-layout";

export interface TargetingArrowAsset {
  head: { url: string; width: number; height: number };
  segment: { url: string; width: number; height: number };
}

const SEGMENTS = 19;
const ENEMY = "#E61E1B";
const HEAD_HOVER_SCALE = 1.05;

interface Placed {
  x: number;
  y: number;
  rotate: number;
  scale: number;
}

function bezier(v0: { x: number; y: number }, v1: { x: number; y: number }, c: { x: number; y: number }, t: number) {
  const u = 1 - t;
  return { x: u * u * v0.x + 2 * u * t * c.x + t * t * v1.x, y: u * u * v0.y + 2 * u * t * c.y + t * t * v1.y };
}

/** `from` and `to` in stage px; `midY` is the screen's vertical middle (the game compares with 540 of 1080). */
export function arrowGeometry(from: { x: number; y: number }, to: { x: number; y: number }, midY: number) {
  let headRotation = 0;
  let head = { x: to.x, y: to.y + 88 * UI_SCALE };
  let control = { x: from.x, y: from.y };
  let finalPos = { x: to.x, y: to.y };
  for (let i = 0; i < 6; i += 1) {
    const cos = Math.cos(headRotation);
    const sin = Math.sin(headRotation);
    // Vector2(0, d).Rotated(r) = (-d sin r, d cos r)
    head = { x: to.x - 88 * UI_SCALE * sin, y: to.y + 88 * UI_SCALE * cos };
    finalPos = { x: to.x - 40 * UI_SCALE * sin, y: to.y + 40 * UI_SCALE * cos };
    control = {
      x: from.x - (head.x - from.x) * 0.25,
      y: from.y > midY ? head.y + (head.y - from.y) * 0.5 : head.y * 0.75 + from.y * 0.25,
    };
    headRotation = Math.atan2(to.y - control.y, to.x - control.x) + Math.PI / 2;
  }
  const segments: Placed[] = [];
  for (let i = 0; i < SEGMENTS; i += 1) {
    const position = bezier(from, finalPos, control, i / 20);
    const scale = 0.28 + (0.42 - 0.28) * ((i * 2) / SEGMENTS);
    segments.push({ ...position, rotate: 0, scale });
  }
  for (let i = 1; i < SEGMENTS; i += 1) {
    segments[i].rotate = Math.atan2(segments[i].y - segments[i - 1].y, segments[i].x - segments[i - 1].x) + Math.PI / 2;
  }
  segments[0].rotate = Math.atan2(segments[0].y - segments[1].y, segments[0].x - segments[1].x) - Math.PI / 2;
  return { segments, head: { ...head, rotate: headRotation, scale: HEAD_HOVER_SCALE } };
}

function Sprite({ asset, placed }: { asset: { url: string; width: number; height: number }; placed: Placed }) {
  const width = asset.width * placed.scale * UI_SCALE;
  const height = asset.height * placed.scale * UI_SCALE;
  const mask = `url(${asset.url})`;
  const style: CSSProperties = {
    left: placed.x - width / 2,
    top: placed.y - height / 2,
    width,
    height,
    transform: `rotate(${placed.rotate}rad)`,
    backgroundColor: ENEMY,
    backgroundImage: mask,
    backgroundSize: "100% 100%",
    backgroundBlendMode: "multiply",
    WebkitMaskImage: mask,
    WebkitMaskSize: "100% 100%",
  };
  return <div className="pointer-events-none absolute" style={style} />;
}

export function TargetingArrow({ asset, from, to, midY }: {
  asset: TargetingArrowAsset;
  from: { x: number; y: number };
  to: { x: number; y: number };
  midY: number;
}) {
  const { segments, head } = arrowGeometry(from, to, midY);
  return (
    <div data-combat-sim-arrow="" className="absolute left-0 top-0" style={{ zIndex: 500 }}>
      {segments.map((placed, index) => <Sprite key={index} asset={asset.segment} placed={placed} />)}
      <Sprite asset={asset.head} placed={head} />
    </div>
  );
}

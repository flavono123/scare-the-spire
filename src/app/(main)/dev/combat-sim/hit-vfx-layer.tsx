"use client";

/**
 * The VFX a card spawns, drawn from the frame sheets `scripts/extract-hit-vfx.py` renders from the game
 * package: `WithHitFx` scenes (`vfx/vfx_attack_slash`) and dedicated nodes (`NSmallMagicMissileVfx` at a tint).
 * A sheet plays once from the `vfx` event's time at the target's center, base or bottom of hitbox. VFX scenes
 * keep game pixels, so they scale with the creature's stage scale (the monsters shrink to fit the region).
 */

import type { CombatTimeline } from "@/lib/combat-sim/timeline";
import type { CreatureBox } from "./stage-layout";

export interface HitVfxAsset {
  scene: string;
  url: string;
  fps: number;
  frames: number;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  /** The target point inside one frame (px). */
  origin: { x: number; y: number };
  durationMs: number;
}

/** `vfx/vfx_attack_slash`, or `NSmallMagicMissileVfx#50b598` for a dedicated node with a tint. */
export function hitVfxKey(effect: string, color?: string): string {
  return effect.startsWith("vfx/") || !color ? effect : `${effect}#${color}`;
}

export function HitVfxLayer({ timeline, t, assets, player, monsters }: {
  timeline: CombatTimeline;
  t: number;
  assets: Record<string, HitVfxAsset>;
  player: CreatureBox | null;
  monsters: CreatureBox[];
}) {
  const nodes: React.ReactNode[] = [];
  for (const beat of timeline.beats) {
    if (beat.event.kind !== "vfx" || !beat.event.target) continue;
    if (beat.start > t) break;
    const asset = assets[hitVfxKey(beat.event.effect, beat.event.color)];
    if (!asset) continue;
    const age = t - beat.start;
    if (age >= asset.durationMs) continue;
    const box = beat.event.target === "player" ? player : monsters[Number(beat.event.target.slice(1))];
    if (!box) continue;
    const frame = Math.min(asset.frames - 1, Math.floor((age * asset.fps) / 1000));
    const k = box.scale;
    const x = box.x;
    const y = beat.event.at === "center" ? box.y - box.height / 2 : box.y;
    nodes.push(
      <div
        key={beat.step}
        className="pointer-events-none absolute"
        data-combat-sim-vfx={asset.scene}
        style={{
          left: x - asset.origin.x * k,
          top: y - asset.origin.y * k,
          width: asset.frameWidth * k,
          height: asset.frameHeight * k,
          backgroundImage: `url(${asset.url})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: `${asset.columns * asset.frameWidth * k}px ${Math.ceil(asset.frames / asset.columns) * asset.frameHeight * k}px`,
          backgroundPosition: `${-(frame % asset.columns) * asset.frameWidth * k}px ${-Math.floor(frame / asset.columns) * asset.frameHeight * k}px`,
          zIndex: 650,
        }}
      />,
    );
  }
  return <>{nodes}</>;
}

/**
 * NGame.ScreenShake as the game calls it from CreatureCmd.Damage (0.113.0): a ScreenPunchInstance, one at a time
 * (a new shake replaces the running one). Strength comes from the damage that got through: under 6 Weak (5),
 * under 11 Medium (20), otherwise Strong (40); a fully blocked hit is Weak. All last ShakeDuration.Short
 * (0.3 s) and start at the hit. Each frame the target moves by `Rotated(angle) * (cos(remaining x 60), 0) *
 * strength * CubicOut(remaining / duration)`. The game picks the angle from Rng.Chaotic and scales the strength
 * by the screen shake setting; here the angle is seeded by the step and the multiplier is 1 (the setting's
 * default index 2 is not mapped).
 */

import { nextRandom, seedRandom } from "@/lib/combat-sim/rng";
import type { CombatTimeline } from "@/lib/combat-sim/timeline";
import { clamp01, ease } from "./godot-anim";
import { UI_SCALE, commitTime } from "./stage-layout";

const SHORT_SECONDS = 0.3;
const WIGGLE_SPEED = 60;

export function shakeStrength(amount: number, blocked: number): number | null {
  const unblocked = amount - blocked;
  if (unblocked > 0) return unblocked < 6 ? 5 : unblocked < 11 ? 20 : 40;
  return blocked > 0 ? 5 : null;
}

/** Stage-pixel offset of the whole screen at `tMs`. */
export function screenShakeAt(timeline: CombatTimeline, tMs: number): { x: number; y: number } {
  let active: { start: number; strength: number; angle: number } | null = null;
  for (const beat of timeline.beats) {
    if (beat.event.kind !== "damage") continue;
    const start = commitTime(beat);
    if (start > tMs) break;
    const strength = shakeStrength(beat.event.amount, beat.event.blocked);
    if (strength === null) continue;
    const angle = nextRandom(seedRandom(beat.step * 7919 + 17))[0] * Math.PI * 2;
    active = { start, strength, angle };
  }
  if (!active) return { x: 0, y: 0 };
  const remaining = SHORT_SECONDS - (tMs - active.start) / 1000;
  if (remaining <= 0) return { x: 0, y: 0 };
  const wiggle = Math.cos(remaining * WIGGLE_SPEED);
  const amount = wiggle * active.strength * ease.cubicOut(clamp01(remaining / SHORT_SECONDS)) * UI_SCALE;
  return { x: amount * Math.cos(active.angle), y: amount * Math.sin(active.angle) };
}

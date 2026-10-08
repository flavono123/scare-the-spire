/**
 * Frame-rate independent ports of the libGDX helpers the STS1 character select
 * screen uses (MathHelper.*LerpSnap, ScreenShake, glow pulses). Units are
 * 1920×1080 game pixels with Settings.scale = 1.
 */

export const STS1_STAGE_WIDTH = 1920;
export const STS1_STAGE_HEIGHT = 1080;

const UI_SNAP_THRESHOLD = 1;

function lerp(start: number, target: number, alpha: number): number {
  return start + (target - start) * alpha;
}

function lerpSnap(start: number, target: number, alpha: number, threshold: number): number {
  if (start === target) return start;
  const next = lerp(start, target, alpha);
  return Math.abs(next - target) < threshold ? target : next;
}

/** MathHelper.uiLerpSnap: delta * 9, snaps under Settings.UI_SNAP_THRESHOLD. */
export function uiLerpSnap(start: number, target: number, delta: number): number {
  return lerpSnap(start, target, delta * 9, UI_SNAP_THRESHOLD);
}

/** MathHelper.fadeLerpSnap: delta * 12, snaps under 0.01. */
export function fadeLerpSnap(start: number, target: number, delta: number): number {
  return lerpSnap(start, target, delta * 12, 0.01);
}

/** MathHelper.popLerpSnap: delta * 8, snaps under 0.003. */
export function popLerpSnap(start: number, target: number, delta: number): number {
  return lerpSnap(start, target, delta * 8, 0.003);
}

function cosDeg(degrees: number): number {
  return Math.cos((degrees * Math.PI) / 180);
}

/** CharacterOption.renderOptionButton glow alpha while selected. */
export function characterOptionGlowAlpha(nowMs: number): number {
  return 0.25 + (cosDeg(Math.floor(nowMs / 4) % 360) + 1.25) / 3.5;
}

/** ConfirmButton / MenuCancelButton.updateGlow. */
export function buttonGlowAlpha(glowTime: number): number {
  return Math.abs(Math.cos(glowTime)) / 2 + 0.3;
}

const SHAKE_INTENSITY = { LOW: 20, MED: 50, HIGH: 100 } as const;
const SHAKE_DURATION = { SHORT: 0.3, MED: 0.5, LONG: 1, XLONG: 3 } as const;

export interface ScreenShakeState {
  duration: number;
  startDuration: number;
  intensity: number;
  vertical: boolean;
}

export function startScreenShake(
  intensity: keyof typeof SHAKE_INTENSITY = "MED",
  duration: keyof typeof SHAKE_DURATION = "SHORT",
  vertical = false,
): ScreenShakeState {
  const seconds = SHAKE_DURATION[duration];
  return { duration: seconds, startDuration: seconds, intensity: SHAKE_INTENSITY[intensity], vertical };
}

function interpolationFade(alpha: number): number {
  return alpha * alpha * alpha * (alpha * (alpha * 6 - 15) + 10);
}

/**
 * ScreenShake.update(): FitViewport is resized by `x` pixels. A wider screen
 * keeps the scale and centers the world (shift by x/2); a narrower one shrinks
 * the world from the left edge; a taller one shifts it up by |x|/2.
 */
export function stepScreenShake(
  shake: ScreenShakeState,
  delta: number,
  nowMs: number,
): { state: ScreenShakeState; transform: string } {
  if (shake.duration <= 0) return { state: shake, transform: "" };
  const duration = Math.max(0, shake.duration - delta);
  const state = { ...shake, duration };
  if (duration === 0) return { state, transform: "" };
  const amount = lerp(0.1, shake.intensity, interpolationFade(duration / shake.startDuration));
  const x = cosDeg((nowMs % 360) / 0.3) * amount;
  if (shake.vertical) return { state, transform: `translateY(${-Math.abs(x) / 2}px)` };
  if (x >= 0) return { state, transform: `translateX(${x / 2}px)` };
  const scale = 1 + x / STS1_STAGE_WIDTH;
  return {
    state,
    transform: `translateY(${(STS1_STAGE_HEIGHT * (1 - scale)) / 2}px) scale(${scale})`,
  };
}

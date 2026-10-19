/**
 * Card motion for the combat scene, following the game's node code (0.102.0):
 * - NHandCardHolder: every frame `Lerp(value, target, dt * k)` with k = 7
 *   (position), 8 (scale), 10 (angle); here integrated as exp(-k t).
 * - Draw (CardPileCmd.Add -> hand): the card appears at the draw pile at scale 1,
 *   angle 0, and its holder lerps it into the hand slot.
 * - Play (AddDuringManualCardPlay): the card leaves its holder keeping its
 *   position with angle 0, then tweens to the play position (0.25 / 0.1 /
 *   0.01 s for Normal / Fast / Instant) and scale 0.8 (0.25 s in every mode),
 *   Cubic Out. The simulator lifts it to the hover pose first, as the player's
 *   drag would.
 * - Discard / result / end of turn: NCardFlyVfx flies it to the discard pile on
 *   a quadratic Bezier arc whose time advances with speed U(1.1, 1.25) and
 *   acceleration U(2, 2.5) over duration U(1, 1.75); the control point is the
 *   midpoint raised by 500 + U(100, 400). The card turns toward its heading
 *   (LerpAngle, dt * 12), darkens and shrinks to 0.1 in the first third, then
 *   after arrival shrinks to 0 by u = 0.4 while the trail fades (u > 0.25).
 *   The random values come from Rng.Chaotic in the game; here they are seeded.
 * - Exhaust: modulate to (0.1, 0.1, 0.1, 0) over 0.3 s (0.2 s on Fast; the ash particles are not drawn).
 * - Pile buttons (NCombatCardPile): a card arriving bumps the icon and count
 *   from 1.25 to 1 over 0.5 s (Expo Out); leaving only lowers the count.
 */

import { nextRandom, seedRandom } from "@/lib/combat-sim/rng";
import { pileLerpMs, type CombatTimeline } from "@/lib/combat-sim/timeline";
import type { PileType, SimResult, SimSpeed, SimState } from "@/lib/combat-sim/types";
import { clamp01, ease, expApproach, expApproachAngle } from "./godot-anim";
import { HAND_ANCHOR, PILES, PLAY_POSITION, PLAY_SCALE, UI_SCALE, handSlot, type Pose } from "./stage-layout";

const K_POSITION = 7;
const K_SCALE = 8;
const K_ANGLE = 10;
/** AppendPlayPileLerpTween scale tween: 0.25 s in every mode. */
const PLAY_SCALE_TWEEN = 0.25;
const FLY_STEP = 1 / 120;

type Segment =
  | { kind: "snap"; t: number; pose: Pose }
  | { kind: "lerp"; t: number; target: Pose; snapAngleScale?: boolean }
  /** Play pile: position over `positionSeconds` (AppendPileLerpTween), scale over 0.25 s, both Cubic Out. */
  | { kind: "tween"; t: number; to: Pose; positionSeconds: number }
  | { kind: "fly"; t: number; to: { x: number; y: number }; seed: number }
  | { kind: "fade"; t: number; seconds: number }
  | { kind: "hide"; t: number };

export interface FlyState {
  from: Pose;
  to: { x: number; y: number };
  seed: number;
  /** Seconds since the flight started. */
  age: number;
  arrived: boolean;
  /** Seconds since arrival (phase 2). */
  afterArrival: number;
  /** Phase-2 progress u (0..1); the node is freed at 1. */
  u2: number;
  /** Card positions over the last 0.8 s, oldest first, for the trail. */
  trail: { x: number; y: number }[];
  x: number;
  y: number;
  rotate: number;
  done: boolean;
}

export interface CardVisual {
  uid: string;
  pose: Pose;
  visible: boolean;
  /** Card body opacity. */
  alpha: number;
  /** Modulate brightness: 1 white, 0 black. */
  tint: number;
  /** Drawn above the hand while moving out of it. */
  lifted: boolean;
  fly: FlyState | null;
}

interface Track {
  uid: string;
  segments: Segment[];
}

export interface PileEvent {
  pile: PileType;
  t: number;
  delta: 1 | -1;
}

export interface MotionModel {
  tracks: Track[];
  pileEvents: PileEvent[];
  startCounts: Record<"draw" | "discard" | "exhaust", number>;
}

function pileOf(state: SimState, uid: string): PileType | null {
  for (const pile of ["hand", "play", "draw", "discard", "exhaust"] as PileType[]) {
    if (state.piles[pile].includes(uid)) return pile;
  }
  return null;
}

function random(seed: number, salt: number): number {
  return nextRandom(seedRandom(seed * 7919 + salt * 104729))[0];
}

interface FlyParams {
  speed: number;
  accel: number;
  duration: number;
  arc: number;
  arrival: number;
}

export function flyParams(seed: number): FlyParams {
  const speed = 1.1 + 0.15 * random(seed, 1);
  const accel = 2 + 0.5 * random(seed, 2);
  const duration = 1 + 0.75 * random(seed, 3);
  // The discard and draw piles sit below y 540, so the arc rises by 500 + offset.
  const arc = (500 + 100 + 300 * random(seed, 4)) * UI_SCALE;
  const arrival = (-speed + Math.sqrt(speed * speed + 2 * accel * duration)) / accel;
  return { speed, accel, duration, arc, arrival };
}

function bezier(p0: number, c: number, p1: number, u: number) {
  return (1 - u) * (1 - u) * p0 + 2 * (1 - u) * u * c + u * u * p1;
}

/** Card position `tau` seconds into a flight (stays at the pile after arrival). */
export function flyPositionAt(from: Pose, to: { x: number; y: number }, seed: number, tau: number): { x: number; y: number } {
  const params = flyParams(seed);
  const cx = (from.x + to.x) / 2;
  const cy = (from.y + to.y) / 2 - params.arc;
  const clamped = Math.min(Math.max(0, tau), params.arrival);
  const u = clamp01((params.speed * clamped + (params.accel * clamped * clamped) / 2) / params.duration);
  return { x: bezier(from.x, cx, to.x, u), y: bezier(from.y, cy, to.y, u) };
}

/** NCardFlyVfx at `age` seconds after it took the card at `from`. */
export function simulateFly(from: Pose, to: { x: number; y: number }, seed: number, age: number): { pose: Pose; tint: number; fly: FlyState } {
  const params = flyParams(seed);
  const cx = (from.x + to.x) / 2;
  const cy = (from.y + to.y) / 2 - params.arc;
  const at = (tau: number) => {
    const u = clamp01((params.speed * tau + (params.accel * tau * tau) / 2) / params.duration);
    return { u, x: bezier(from.x, cx, to.x, u), y: bezier(from.y, cy, to.y, u) };
  };
  // Rotation chases the heading + 90 deg each frame (LerpAngle, dt * 12).
  let rotate = from.rotate;
  const flightAge = Math.min(age, params.arrival);
  for (let tau = 0; tau < flightAge; tau += FLY_STEP) {
    const step = Math.min(FLY_STEP, flightAge - tau);
    const { u } = at(tau);
    const dx = 2 * (1 - u) * (cx - from.x) + 2 * u * (to.x - cx);
    const dy = 2 * (1 - u) * (cy - from.y) + 2 * u * (to.y - cy);
    const heading = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    rotate = expApproachAngle(rotate, heading, 12, step);
  }
  const trail: { x: number; y: number }[] = [];
  for (let back = 0.8; back >= 0; back -= 1 / 60) {
    const tau = Math.min(age - back, params.arrival);
    if (tau < 0) continue;
    const point = at(tau);
    trail.push({ x: point.x, y: point.y });
  }
  if (age < params.arrival) {
    const { u, x, y } = at(age);
    const shrink = clamp01(u * 3);
    const scale = from.scale + (0.1 * UI_SCALE - from.scale) * shrink;
    return {
      pose: { x, y, scale, rotate },
      tint: 1 - shrink,
      fly: { from, to, seed, age, arrived: false, afterArrival: 0, u2: 0, trail, x, y, rotate, done: false },
    };
  }
  const afterArrival = age - params.arrival;
  const finalSpeed = params.speed + params.accel * params.arrival;
  const u2 = (finalSpeed * afterArrival) / params.duration;
  const scale = Math.max(0.1 + (-0.15 - 0.1) * u2, 0) * UI_SCALE;
  return {
    pose: { x: to.x, y: to.y, scale, rotate },
    tint: 0,
    fly: { from, to, seed, age, arrived: true, afterArrival, u2, trail, x: to.x, y: to.y, rotate, done: u2 >= 1 },
  };
}

export function flyArrival(seed: number): number {
  return flyParams(seed).arrival;
}

export function buildMotion(result: SimResult, timeline: CombatTimeline, speed: SimSpeed = "normal"): MotionModel {
  const positionSeconds = pileLerpMs(speed) / 1000;
  // CardPileCmd exhaust fade: FastMode == Fast ? 0.2 : 0.3 (Instant keeps 0.3).
  const exhaustSeconds = speed === "fast" ? 0.2 : 0.3;
  const tracks = new Map<string, Track>();
  const track = (uid: string) => {
    let entry = tracks.get(uid);
    if (!entry) {
      entry = { uid, segments: [] };
      tracks.set(uid, entry);
    }
    return entry;
  };
  const pileEvents: PileEvent[] = [];
  const start = result.start;

  // Initial placement: hand cards settled in their slots, everything else hidden.
  const allUids = new Set<string>(Object.keys(start.cards));
  for (const step of result.steps) for (const uid of Object.keys(step.state.cards)) allUids.add(uid);
  for (const uid of allUids) {
    const index = start.piles.hand.indexOf(uid);
    if (index >= 0) track(uid).segments.push({ kind: "snap", t: 0, pose: handSlot(index, start.piles.hand.length) });
    else track(uid).segments.push({ kind: "hide", t: 0 });
  }

  let hovered: string | null = null;
  const relayout = (state: SimState, t: number, skip?: string) => {
    const hand = state.piles.hand;
    const hoverIndex = hovered ? hand.indexOf(hovered) : -1;
    hand.forEach((uid, index) => {
      if (uid === skip) return;
      const target = handSlot(index, hand.length, hoverIndex >= 0 ? hoverIndex : null);
      // The hovered card takes angle 0 and scale 1 at once; only its position lerps.
      track(uid).segments.push({ kind: "lerp", t, target, snapAngleScale: uid === hovered });
    });
  };

  timeline.beats.forEach((beat) => {
    const t = beat.start / 1000;
    const event = beat.event;
    switch (event.kind) {
      case "select":
        hovered = event.uid;
        relayout(beat.after, t);
        return;
      case "move": {
        const { uid, from, to } = event;
        const seed = beat.step + 1;
        if (from === "hand") hovered = hovered === uid ? null : hovered;
        if (to === "hand") {
          if (from === "draw") pileEvents.push({ pile: "draw", t, delta: -1 });
          if (from === "discard") pileEvents.push({ pile: "discard", t, delta: -1 });
          // Spawned at the source pile at scale 1, angle 0; the holder lerps it in.
          const source = from === "discard" ? PILES.discard : PILES.draw;
          track(uid).segments.push({ kind: "snap", t, pose: { x: source.x, y: source.y, scale: UI_SCALE, rotate: 0 } });
          relayout(beat.after, t);
          return;
        }
        if (to === "play") {
          track(uid).segments.push({ kind: "tween", t, to: { x: PLAY_POSITION.x, y: PLAY_POSITION.y, scale: PLAY_SCALE, rotate: 0 }, positionSeconds });
          relayout(beat.after, t);
          return;
        }
        if (to === "discard" || (to === "draw" && from === "discard")) {
          if (from === "draw") pileEvents.push({ pile: "draw", t, delta: -1 });
          if (from === "discard") pileEvents.push({ pile: "discard", t, delta: -1 });
          const target = to === "discard" ? PILES.discard : PILES.draw;
          track(uid).segments.push({ kind: "fly", t, to: target, seed });
          pileEvents.push({ pile: to, t: t + flyArrival(seed), delta: 1 });
          if (from === "hand") relayout(beat.after, t);
          return;
        }
        if (to === "exhaust") {
          if (from === "draw" || from === "discard") pileEvents.push({ pile: from, t, delta: -1 });
          pileEvents.push({ pile: "exhaust", t, delta: 1 });
          track(uid).segments.push({ kind: "fade", t, seconds: exhaustSeconds });
          if (from === "hand") relayout(beat.after, t);
          return;
        }
        // Anything else: move without animation.
        track(uid).segments.push({ kind: "hide", t });
        if (from === "hand") relayout(beat.after, t);
        return;
      }
      case "enter": {
        if (event.to === "hand") {
          // Generated cards grow from the bottom center (scale 0 -> 1) into the hand.
          track(event.uid).segments.push({ kind: "snap", t, pose: { x: HAND_ANCHOR.x, y: HAND_ANCHOR.y, scale: 0, rotate: 0 } });
          relayout(beat.after, t);
        } else if (event.to === "draw" || event.to === "discard" || event.to === "exhaust") {
          pileEvents.push({ pile: event.to, t, delta: 1 });
        }
        return;
      }
      case "remove":
        track(event.uid).segments.push({ kind: "fade", t, seconds: exhaustSeconds });
        return;
      default:
        return;
    }
  });

  for (const entry of tracks.values()) entry.segments.sort((a, b) => a.t - b.t);
  pileEvents.sort((a, b) => a.t - b.t);
  return {
    tracks: [...tracks.values()],
    pileEvents,
    startCounts: { draw: start.piles.draw.length, discard: start.piles.discard.length, exhaust: start.piles.exhaust.length },
  };
}

export function evaluateTrack(track: Track, tMs: number): CardVisual {
  const t = tMs / 1000;
  let pose: Pose = { x: 0, y: 0, scale: 1, rotate: 0 };
  let visible = false;
  let alpha = 1;
  let tint = 1;
  let lifted = false;
  let fly: FlyState | null = null;
  const segments = track.segments;
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    if (segment.t > t) break;
    const end = Math.min(t, segments[i + 1]?.t ?? Infinity);
    const elapsed = end - segment.t;
    fly = null;
    switch (segment.kind) {
      case "snap":
        pose = { ...segment.pose };
        visible = true;
        alpha = 1;
        tint = 1;
        lifted = false;
        break;
      case "lerp": {
        const from = segment.snapAngleScale ? { ...pose, rotate: segment.target.rotate, scale: segment.target.scale } : pose;
        pose = {
          x: expApproach(from.x, segment.target.x, K_POSITION, elapsed),
          y: expApproach(from.y, segment.target.y, K_POSITION, elapsed),
          scale: expApproach(from.scale, segment.target.scale, K_SCALE, elapsed),
          rotate: expApproachAngle(from.rotate, segment.target.rotate, K_ANGLE, elapsed),
        };
        lifted = Boolean(segment.snapAngleScale);
        break;
      }
      case "tween": {
        const move = ease.cubicOut(clamp01(elapsed / segment.positionSeconds));
        const grow = ease.cubicOut(clamp01(elapsed / PLAY_SCALE_TWEEN));
        pose = {
          x: pose.x + (segment.to.x - pose.x) * move,
          y: pose.y + (segment.to.y - pose.y) * move,
          scale: pose.scale + (segment.to.scale - pose.scale) * grow,
          rotate: 0,
        };
        lifted = true;
        break;
      }
      case "fly": {
        const flown = simulateFly(pose, segment.to, segment.seed, elapsed);
        // The flying card's own alpha eases to 0.75 (0.5 s Cubic Out).
        alpha = 1 - 0.25 * ease.cubicOut(clamp01(elapsed / 0.5));
        tint = flown.tint;
        lifted = true;
        if (end === t) {
          fly = flown.fly;
          pose = flown.pose;
          visible = !flown.fly.done;
        } else {
          // A later segment takes over; the flight's end pose is what it starts from.
          pose = flown.pose;
          visible = false;
        }
        break;
      }
      case "fade": {
        const k = clamp01(elapsed / segment.seconds);
        tint = 1 - 0.9 * k;
        alpha = 1 - k;
        visible = k < 1;
        break;
      }
      case "hide":
        visible = false;
        break;
    }
  }
  return { uid: track.uid, pose, visible, alpha, tint, lifted, fly };
}

export interface PileView {
  count: number;
  /** Icon and count scale (1.25 -> 1 over 0.5 s Expo Out after each arrival). */
  bump: number;
}

export function pileViews(model: MotionModel, tMs: number): Record<"draw" | "discard" | "exhaust", PileView> {
  const t = tMs / 1000;
  const counts = { ...model.startCounts };
  const lastArrival: Record<string, number> = {};
  for (const event of model.pileEvents) {
    if (event.t > t) break;
    if (event.pile === "draw" || event.pile === "discard" || event.pile === "exhaust") {
      counts[event.pile] = Math.max(0, counts[event.pile] + event.delta);
      if (event.delta > 0) lastArrival[event.pile] = event.t;
    }
  }
  const view = (pile: "draw" | "discard" | "exhaust"): PileView => {
    const since = lastArrival[pile] === undefined ? Infinity : t - lastArrival[pile];
    const bump = since < 0.5 ? 1.25 - 0.25 * ease.expoOut(since / 0.5) : 1;
    return { count: counts[pile], bump };
  };
  return { draw: view("draw"), discard: view("discard"), exhaust: view("exhaust") };
}

export { pileOf };

/**
 * Layout of the 1080x1920 portrait stage, in stage pixels. The game screen is
 * landscape, so this is a vertical re-arrangement: creatures keep the game's
 * left-to-right order and sizes, the hand, piles and energy orb move below.
 */

import type { PileType, SimState } from "@/lib/combat-sim/types";
import type { CombatTimeline, TimelineBeat } from "@/lib/combat-sim/timeline";
import type { CombatSimMonsterView } from "./view-types";
import type { EncounterSceneCombatLayout } from "@/lib/codex-types";

export const STAGE_W = 1080;
export const STAGE_H = 1920;
/** Card tile size (the game's 300x422 card). */
export const CARD_W = 300;
export const CARD_H = 422;
export const FEET_Y = 930;
/** Stage pixels per game pixel for creatures. */
export const CREATURE_SCALE = 1.15;
export const PLAYER_X = 270;
export const MONSTER_REGION = { left: 560, right: 1050 };
export const ORB = { x: 150, y: 1330, size: 220 };
export const PILES = {
  draw: { x: 96, y: 1830 },
  discard: { x: 984, y: 1830 },
  exhaust: { x: 984, y: 1680 },
};
const HAND_Y = 1645;
const HAND_SCALE = 0.88;
// Between the creatures and the hand, so the played card covers neither.
const PLAY_POSE = { x: 540, y: 1235, scale: 0.95 };

/** Fraction of a beat after which counters (energy, HP, pile counts) show the new value. */
export const COMMIT_AT = 0.35;

export interface CardPose {
  x: number;
  y: number;
  scale: number;
  rotate: number;
  opacity: number;
  z: number;
}

export function pileOf(state: SimState, uid: string): PileType | null {
  for (const pile of ["hand", "play", "draw", "discard", "exhaust"] as PileType[]) {
    if (state.piles[pile].includes(uid)) return pile;
  }
  return null;
}

export function cardPose(state: SimState, uid: string): CardPose | null {
  const pile = pileOf(state, uid);
  switch (pile) {
    case "hand": {
      const hand = state.piles.hand;
      const index = hand.indexOf(uid);
      const offset = index - (hand.length - 1) / 2;
      const spread = Math.min(215, 820 / Math.max(1, hand.length - 1));
      return {
        x: 540 + offset * spread,
        y: HAND_Y + offset * offset * 7,
        scale: HAND_SCALE,
        rotate: offset * 3.5,
        opacity: 1,
        z: 100 + index,
      };
    }
    case "play":
      return { ...PLAY_POSE, rotate: 0, opacity: 1, z: 400 };
    case "draw":
      return { ...PILES.draw, scale: 0.2, rotate: -8, opacity: 0, z: 50 };
    case "discard":
      return { ...PILES.discard, scale: 0.2, rotate: 8, opacity: 0, z: 50 };
    case "exhaust":
      return { ...PILES.exhaust, scale: 0.35, rotate: 0, opacity: 0, z: 50 };
    default:
      return null;
  }
}

export function easeInOut(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Pose of a card at the current beat: eased from its pose before the beat to after. */
export function interpolatedPose(beat: TimelineBeat | null, progress: number, state: SimState, uid: string): CardPose | null {
  if (!beat) return cardPose(state, uid);
  const from = cardPose(beat.before, uid);
  const to = cardPose(beat.after, uid);
  if (!from && !to) return null;
  if (!from) return to;
  if (!to) return { ...from, opacity: from.opacity * (1 - progress), scale: from.scale * (1 + 0.15 * progress) };
  const k = easeInOut(progress);
  const moving = beat.event.kind === "move" && beat.event.uid === uid;
  return {
    x: lerp(from.x, to.x, k),
    y: lerp(from.y, to.y, k),
    scale: lerp(from.scale, to.scale, k),
    rotate: lerp(from.rotate, to.rotate, k),
    opacity: lerp(from.opacity, to.opacity, k),
    z: moving && progress < 1 ? 500 : to.z,
  };
}

/** Counters show the new value once a beat is past COMMIT_AT. */
export function visibleState(beat: TimelineBeat | null, progress: number, fallback: SimState): SimState {
  if (!beat) return fallback;
  return progress >= COMMIT_AT || beat.duration === 0 ? beat.after : beat.before;
}

/** Time (ms) at which the beat's counters change. */
export function commitTime(beat: TimelineBeat): number {
  return beat.start + beat.duration * (beat.duration === 0 ? 0 : COMMIT_AT);
}

/**
 * NEnergyCounter._Process: rotation layer i turns (i + 1) * speed deg/s, where
 * speed is 30, or 5 while energy is 0. Integrated over the timeline so any time
 * gives the same angle.
 */
export function orbBaseAngle(timeline: CombatTimeline, startEnergy: number, t: number): number {
  let angle = 0;
  let clock = 0;
  let energy = startEnergy;
  for (const beat of timeline.beats) {
    if (beat.event.kind !== "energy") continue;
    const at = commitTime(beat);
    if (at > t) break;
    angle += (at - clock) / 1000 * (energy === 0 ? 5 : 30);
    clock = at;
    energy = beat.after.energy;
  }
  return angle + (t - clock) / 1000 * (energy === 0 ? 5 : 30);
}

export interface CreatureBox {
  /** Feet center, stage pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

const DEFAULT_MONSTER_BOX = { width: 200, height: 220 };
/** Bosses with no scene bounds (e.g. Doormaker) get a taller default box. */
const STATIC_BOSS_HEIGHT = 420;

/**
 * Monsters in encounter order, spaced like the game's auto layout
 * (`positionEnemiesFromGameBounds`) or by their scene slot, then scaled to fit
 * the monster region.
 */
export function monsterBoxes(monsters: CombatSimMonsterView[], combatLayout: EncounterSceneCombatLayout | null): CreatureBox[] {
  const gap = combatLayout?.enemyGap ?? 70;
  const sizes = monsters.map((monster) => {
    if (monster.layout) return { width: monster.layout.bounds.width, height: monster.layout.bounds.height };
    if (monster.staticArt && !monster.spine) {
      // Square box; the still is drawn object-contain, anchored to the feet.
      return { width: STATIC_BOSS_HEIGHT, height: STATIC_BOSS_HEIGHT };
    }
    return DEFAULT_MONSTER_BOX;
  });
  // Game x of each monster's center: scene slot when known, else packed left to right.
  const centers: number[] = [];
  let cursor = 0;
  sizes.forEach((size, index) => {
    const slotX = monsters[index].slotPosition?.x;
    const packed = cursor + size.width / 2;
    const previous = centers[index - 1];
    const x = slotX !== undefined && slotX !== null
      ? slotX
      : previous === undefined ? packed : Math.max(packed, previous + sizes[index - 1].width / 2 + gap + size.width / 2);
    centers.push(x);
    cursor = x + size.width / 2 + gap;
  });
  const left = Math.min(...centers.map((x, i) => x - sizes[i].width / 2));
  const right = Math.max(...centers.map((x, i) => x + sizes[i].width / 2));
  const span = right - left;
  const regionWidth = MONSTER_REGION.right - MONSTER_REGION.left;
  const scale = Math.min(CREATURE_SCALE, regionWidth / span);
  const offset = MONSTER_REGION.left + (regionWidth - span * scale) / 2;
  return sizes.map((size, index) => ({
    x: offset + (centers[index] - left) * scale,
    y: FEET_Y,
    width: size.width * scale,
    height: size.height * scale,
    scale,
  }));
}

/** The player sits in the game's 240x340 box (`positionPlayerFromGameLayout`). */
export function playerBox(): CreatureBox {
  return { x: PLAYER_X, y: FEET_Y, width: 240 * CREATURE_SCALE, height: 340 * CREATURE_SCALE, scale: CREATURE_SCALE };
}

/**
 * Layout of the 1080x1920 portrait stage, in stage pixels. The game screen is
 * landscape 1920x1080; the portrait stage keeps the game's UI geometry, scaled
 * by UI_SCALE and pinned to the same screen corners (piles and energy orb to
 * the bottom corners, the hand to the bottom center). Creatures keep the
 * game's left-to-right order and sizes above the hand. The play position moves
 * from the screen center to the band between creatures and hand (9:16 only).
 */

import type { SimState } from "@/lib/combat-sim/types";
import type { CombatTimeline, TimelineBeat } from "@/lib/combat-sim/timeline";
import type { CombatSimMonsterView } from "./view-types";
import type { EncounterSceneCombatLayout } from "@/lib/codex-types";

export const STAGE_W = 1080;
export const STAGE_H = 1920;
/** Card tile size (the game's 300x422 card). */
export const CARD_W = 300;
export const CARD_H = 422;
/** Stage pixels per game pixel, for UI and creatures alike. */
export const UI_SCALE = 1.15;
export const CREATURE_SCALE = UI_SCALE;
export const FEET_Y = 980;
export const PLAYER_X = 270;
export const MONSTER_REGION = { left: 560, right: 1050 };

export interface SceneFrame {
  feetY: number;
  monsterRegion: { left: number; right: number };
  /** Height of the encounter background band. */
  backgroundHeight: number;
}

/**
 * Where the encounter sits for the parts on stage: with the card interface the
 * creatures stay above the hand; without it the encounter moves down and the
 * background grows; without the player the monsters take the full width.
 */
export function sceneFrame(withPlayer: boolean, withCards: boolean): SceneFrame {
  return {
    feetY: withCards ? FEET_Y : 1240,
    monsterRegion: withPlayer ? MONSTER_REGION : { left: 90, right: 990 },
    backgroundHeight: withCards ? 1260 : 1560,
  };
}

/** Game point pinned to the stage's bottom-left / bottom-right corner. */
function fromBottomLeft(x: number, y: number) {
  return { x: x * UI_SCALE, y: STAGE_H - (1080 - y) * UI_SCALE };
}
function fromBottomRight(x: number, y: number) {
  return { x: STAGE_W - (1920 - x) * UI_SCALE, y: STAGE_H - (1080 - y) * UI_SCALE };
}

// combat_piles_container.tscn / NExhaustPileButton / combat_ui.tscn
export const PILES = {
  draw: fromBottomLeft(55, 1025),
  discard: fromBottomRight(1866, 1025),
  exhaust: fromBottomRight(1870, 830),
};
/** Pile buttons are 80x80 controls. */
export const PILE_SIZE = 80 * UI_SCALE;
/**
 * Energy counter: 128x128 control with its top-left at (100, 828), i.e. left of
 * the 1920-wide hand. The portrait hand reaches the left edge, so the orb is
 * raised to clear the hand's top (9:16 only); x stays the game's.
 */
export const ORB = { x: 164 * UI_SCALE, y: 1580, size: 128 * UI_SCALE };

/** CardHolderContainer anchor: the bottom center of the screen. */
export const HAND_ANCHOR = { x: STAGE_W / 2, y: STAGE_H };
/** PileTypeExtensions.GetTargetPosition(Play) is (960, 440); here it sits above the hand. */
export const PLAY_POSITION = { x: STAGE_W / 2, y: 1330 };
export const PLAY_SCALE = 0.8 * UI_SCALE;
/** NHandCardHolder hovered card: y -209 from the anchor, angle 0, scale 1. */
export const HOVER_Y = -209;

/**
 * Hand slots per card count (sts2.dll static arrays): [x, y, angle] relative to
 * the anchor, card centers in game pixels.
 */
const HAND_SLOTS: Record<number, [number, number, number][]> = {
  1: [[0, -50, 0]],
  2: [[-100, -50, -2], [100, -50, 2]],
  3: [[-180, -50, -3], [0, -59, 0], [180, -50, 3]],
  4: [[-240, -25, -8], [-80, -50, -4], [80, -50, 4], [240, -25, 8]],
  5: [[-340, 10, -8], [-170, -30, -4], [0, -50, 0], [170, -30, 4], [340, 10, 8]],
  6: [[-460, 13, -9], [-273, -25, -6], [-90, -50, -3], [90, -50, 3], [273, -25, 6], [460, 13, 9]],
  7: [[-534, 18, -9], [-365, -14, -6], [-189, -39, -3], [0, -50, 0], [189, -39, 3], [365, -14, 6], [534, 18, 9]],
  8: [[-565, 28, -12], [-400, -14, -9], [-231, -39, -6], [-80, -50, -3], [80, -50, 3], [231, -39, 6], [400, -14, 9], [565, 28, 12]],
  9: [[-600, 37, -12], [-445, -2, -9], [-300, -29, -6], [-150, -45, -3], [0, -50, 0], [150, -45, 3], [300, -29, 6], [445, -2, 9], [600, 37, 12]],
  10: [[-610, 38, -15], [-472, 5, -12], [-340, -21, -9], [-200, -41, -6], [-64, -50, -3], [64, -50, 3], [200, -41, 6], [340, -21, 9], [472, 5, 12], [610, 38, 15]],
};

/** Hand card scale: 0.8, times 0.95 / 0.9 / 0.85 at 8 / 9 / 10 cards. */
export function handScale(count: number): number {
  const factor = count === 8 ? 0.95 : count === 9 ? 0.9 : count === 10 ? 0.85 : 1;
  return 0.8 * factor * UI_SCALE;
}

export interface Pose {
  x: number;
  y: number;
  scale: number;
  /** degrees */
  rotate: number;
}

/**
 * Hand slot pose. The game's hand is 1920 wide; when a slot would leave the
 * 1080-wide stage the x offsets are compressed (9:16 only), never the y or angle.
 */
export function handSlot(index: number, count: number, hovered: number | null = null): Pose {
  const slots = HAND_SLOTS[Math.max(1, Math.min(10, count))];
  const [x, y, angle] = slots[Math.min(index, slots.length - 1)];
  const scale = handScale(count);
  const maxX = Math.max(...slots.map((slot) => Math.abs(slot[0])));
  const room = STAGE_W / 2 - (CARD_W * scale) / 2 - 6;
  const squeeze = maxX * UI_SCALE > room ? room / (maxX * UI_SCALE) : 1;
  if (hovered === index) {
    return { x: HAND_ANCHOR.x + x * UI_SCALE * squeeze, y: HAND_ANCHOR.y + HOVER_Y * UI_SCALE, scale: UI_SCALE, rotate: 0 };
  }
  // Cards beside a hovered card move away by lerp(100, 0, min(1, |d| / 4)).
  let push = 0;
  if (hovered !== null) {
    const d = index - hovered;
    push = Math.sign(d) * 100 * (1 - Math.min(1, Math.abs(d) / 4));
  }
  return {
    x: HAND_ANCHOR.x + (x * squeeze + push) * UI_SCALE,
    y: HAND_ANCHOR.y + y * UI_SCALE,
    scale,
    rotate: angle,
  };
}

/** Fraction of a beat after which counters (energy, HP, pile counts) show the new value. */
export const COMMIT_AT = 0.35;

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
/** Still-art bosses with no scene bounds (e.g. Doormaker) get a larger box. */
const STATIC_BOSS_HEIGHT = 480;

/**
 * Monsters in encounter order, spaced like the game's auto layout
 * (`positionEnemiesFromGameBounds`) or by their scene slot, then scaled to fit
 * the monster region.
 */
export function monsterBoxes(
  monsters: CombatSimMonsterView[],
  combatLayout: EncounterSceneCombatLayout | null,
  frame: SceneFrame = sceneFrame(true, true),
): CreatureBox[] {
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
  const region = frame.monsterRegion;
  const regionWidth = region.right - region.left;
  const scale = Math.min(CREATURE_SCALE, regionWidth / span);
  const offset = region.left + (regionWidth - span * scale) / 2;
  return sizes.map((size, index) => ({
    x: offset + (centers[index] - left) * scale,
    y: frame.feetY,
    width: size.width * scale,
    height: size.height * scale,
    scale,
  }));
}

/** The player sits in the game's 240x340 box (`positionPlayerFromGameLayout`). */
export function playerBox(frame: SceneFrame = sceneFrame(true, true)): CreatureBox {
  return { x: PLAYER_X, y: frame.feetY, width: 240 * CREATURE_SCALE, height: 340 * CREATURE_SCALE, scale: CREATURE_SCALE };
}

/**
 * Runs one bestiary stage like the game's combat room: a monster with its
 * class's per-frame behavior, a stand-in player at the stage's left, the
 * game's effect lists, and a move's `takeTurn` timeline played on demand.
 *
 * The page draws the skeleton (Spine player) or still between two canvases:
 * effects the game renders before monsters go behind it, the rest in front.
 */
import type { Sts1Monster, Sts1VfxEvent } from "../types";
import { sts1Motion, type Sts1Motion } from "../monster-moves";
import { loadVfxSheet } from "./assets";
import { SpriteBatch } from "./batch";
import type { MonsterBehavior } from "./monster";
import { MONSTER_BEHAVIORS } from "./monsters";
import { createEffect } from "./timeline";
import {
  VfxWorld,
  hitboxAt,
  refreshHitboxLocation,
  withWorld,
  type BoneView,
  type ShakeDur,
  type ShakeIntensity,
  type SkeletonView,
} from "./world";

/** Ironclad's hitbox (`initializeClass`): where the player stands in for every effect aimed at it. */
const PLAYER_HITBOX = { x: -4, y: -16, width: 220, height: 290 };
const MAX_FRAME_SECONDS = 0.1;

/** The Spine 4.2 bone fields the stage reads. */
export interface SpineBoneLike {
  x: number;
  y: number;
  worldX: number;
  worldY: number;
  rotation: number;
  getWorldRotationX(): number;
}

export interface SpineSkeletonLike {
  x: number;
  y: number;
  findBone(name: string): SpineBoneLike | null;
}

/** Where the monster sits on the stage, from the page's layout. */
export interface StageGeometry {
  /** Stage size in CSS pixels. */
  width: number;
  height: number;
  /** CSS pixels per game unit. */
  pxPerUnit: number;
  /** The monster's origin (feet), CSS pixels from the stage's top-left. */
  originX: number;
  originY: number;
  /** Game units per skeleton unit. */
  skeletonUnit: number;
  /** The monster's left edge, CSS pixels. */
  monsterLeft: number;
}

export interface StageCallbacks {
  /** Play a skeleton clip now. */
  onClip(name: string): void;
  /** The idle clip changed (a form change). */
  onIdle(name: string | null): void;
  /** The behavior drew the monster itself for the first time (hide the still). */
  onBodyDrawn?(): void;
}

export interface SpineAnimationStateLike {
  timeScale: number;
  addListener(listener: { start?: (entry: { timeScale: number; animation: { name: string } | null }) => void }): void;
}

/**
 * The speeds the game sets on its AnimationState and track entries: the
 * constructor's for the first clip (the opening idle), `changeState`'s for
 * every later start of those clips.
 */
export function applySpineTimeScales(
  state: SpineAnimationStateLike,
  scales: NonNullable<Sts1Monster["vfx"]>["timeScales"],
): void {
  if (!scales) return;
  if (scales.state) state.timeScale = scales.state;
  let opening = true;
  state.addListener({
    start: (entry) => {
      const name = entry.animation?.name ?? "";
      const scale = (opening ? scales.start?.[name] : undefined) ?? scales.clips?.[name];
      opening = false;
      if (scale) entry.timeScale = scale;
    },
  });
}

export class Sts1StageEngine {
  readonly world = new VfxWorld();
  readonly behavior: MonsterBehavior | null;
  private behind: SpriteBatch | null = null;
  private front: SpriteBatch | null = null;
  private behindCanvas: HTMLCanvasElement | null = null;
  private frontCanvas: HTMLCanvasElement | null = null;
  private motionElement: HTMLElement | null = null;
  private shakeElement: HTMLElement | null = null;
  private geometry: StageGeometry | null = null;
  private bodyDrawn = false;
  private pending: Sts1VfxEvent[] = [];
  private clock = 0;
  private motion: { motion: Sts1Motion; start: number } | null = null;
  private raf = 0;
  private last = 0;
  private visible = true;
  private sheetReady = false;
  private disposed = false;
  private readonly reducedMotion: boolean;

  constructor(
    private readonly monster: Sts1Monster,
    private readonly callbacks: StageCallbacks,
  ) {
    const factory = MONSTER_BEHAVIORS[monster.id];
    this.reducedMotion = typeof window !== "undefined"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const creature = this.world.monster;
    const [hbX, hbY, hbW, hbH] = monster.vfx?.hitbox ?? [0, 0, 200, 200];
    creature.hb_x = hbX;
    creature.hb_y = hbY;
    creature.hb_w = hbW;
    creature.hb_h = hbH;
    creature.hb = hitboxAt(0, 0, hbW, hbH);
    const player = this.world.player;
    player.hb_x = PLAYER_HITBOX.x;
    player.hb_y = PLAYER_HITBOX.y;
    player.hb_w = PLAYER_HITBOX.width;
    player.hb_h = PLAYER_HITBOX.height;
    player.hb = hitboxAt(0, 0, PLAYER_HITBOX.width, PLAYER_HITBOX.height);
    this.behavior = factory ? withWorld(this.world, () => factory(creature)) : null;
    void loadVfxSheet().then(() => {
      this.sheetReady = true;
      this.wake();
    }).catch((error: unknown) => console.warn("Failed to load STS1 effect textures:", error));
  }

  /** The two overlay canvases and the elements motion and screen shake move. */
  attach(parts: {
    behind: HTMLCanvasElement | null;
    front: HTMLCanvasElement | null;
    motion: HTMLElement | null;
    shake: HTMLElement | null;
  }): void {
    if (parts.behind !== this.behindCanvas) {
      this.behind?.dispose();
      this.behindCanvas = parts.behind;
      this.behind = parts.behind ? this.batchFor(parts.behind) : null;
    }
    if (parts.front !== this.frontCanvas) {
      this.front?.dispose();
      this.frontCanvas = parts.front;
      this.front = parts.front ? this.batchFor(parts.front) : null;
    }
    this.motionElement = parts.motion;
    this.shakeElement = parts.shake;
    this.resizeCanvases();
    this.wake();
  }

  private batchFor(canvas: HTMLCanvasElement): SpriteBatch | null {
    try {
      return new SpriteBatch(canvas);
    } catch (error) {
      console.warn("STS1 effects need WebGL:", error);
      return null;
    }
  }

  setGeometry(geometry: StageGeometry): void {
    this.geometry = geometry;
    const unit = geometry.pxPerUnit;
    const world = this.world;
    world.width = geometry.width / unit;
    world.height = geometry.height / unit;
    const monster = world.monster;
    monster.drawX = geometry.originX / unit;
    monster.drawY = (geometry.height - geometry.originY) / unit;
    world.floorY = monster.drawY - (this.monster.vfx?.offset?.[1] ?? 0);
    refreshHitboxLocation(monster);
    // The player stands just left of the monster. A small monster is drawn
    // large, so the player's body is shortened to keep effects aimed at it on stage.
    const player = world.player;
    const left = geometry.monsterLeft / unit;
    const cX = Math.min(world.width * 0.3, Math.max(world.width * 0.15, left - PLAYER_HITBOX.width * 0.6));
    const centerHeight = Math.min(
      PLAYER_HITBOX.y + PLAYER_HITBOX.height / 2,
      (world.height - world.floorY) * 0.4,
    );
    player.hb_y = centerHeight - PLAYER_HITBOX.height / 2;
    player.drawX = cX - player.hb_x;
    player.drawY = world.floorY;
    refreshHitboxLocation(player);
    this.resizeCanvases();
    this.wake();
  }

  /** The live skeleton from the Spine player, so bone-anchored effects follow it. */
  setSkeleton(skeleton: SpineSkeletonLike | null): void {
    const monster = this.world.monster;
    monster.skeleton = skeleton ? this.skeletonView(skeleton) : null;
    this.wake();
  }

  private skeletonView(skeleton: SpineSkeletonLike): SkeletonView {
    const monster = this.world.monster;
    const unit = () => this.geometry?.skeletonUnit ?? 1;
    const view = (bone: SpineBoneLike): BoneView => ({
      getX: () => bone.x * unit(),
      getY: () => bone.y * unit(),
      getWorldX: () => (bone.worldX - skeleton.x) * unit(),
      getWorldY: () => (bone.worldY - skeleton.y) * unit(),
      getRotation: () => bone.rotation,
      getWorldRotationX: () => bone.getWorldRotationX(),
    });
    return {
      getX: () => monster.drawX + monster.animX,
      getY: () => monster.drawY + monster.animY,
      findBone: (name) => {
        const bone = skeleton.findBone(name);
        return bone ? view(bone) : null;
      },
    };
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (visible) this.wake();
  }

  /** The idle clip the behavior wants now (Awakened One's forms). */
  idleAnimation(): string | null {
    return this.behavior?.idleAnimation?.() ?? null;
  }

  /** Starts a move's turn: clips, motions, state changes and effects at their times. */
  play(move: { id: number; key: string | null }): void {
    withWorld(this.world, () => this.behavior?.onMove?.(move.key, this.world.monster));
    this.callbacks.onIdle(this.idleAnimation());
    const events = this.monster.vfx?.moves[String(move.id)] ?? [];
    this.world.clear();
    this.motion = null;
    this.clock = 0;
    this.pending = [...events].sort((left, right) => left.at - right.at);
    this.fireDue();
    this.wake();
  }

  private fireDue(): void {
    while (this.pending.length && this.pending[0].at <= this.clock + 1e-6) {
      const event = this.pending.shift();
      if (event) this.fire(event);
    }
  }

  private fire(event: Sts1VfxEvent): void {
    const world = this.world;
    switch (event.type) {
      case "spine":
        this.callbacks.onClip(event.name);
        break;
      case "motion": {
        if (this.reducedMotion) break;
        const motion = sts1Motion(event.name);
        if (motion) this.motion = { motion, start: this.clock };
        break;
      }
      case "state":
        withWorld(world, () => this.behavior?.changeState?.(event.name, world.monster));
        this.callbacks.onIdle(this.idleAnimation());
        break;
      case "shake":
        if (!this.reducedMotion) world.screenShake.shake(event.intensity as ShakeIntensity, event.dur as ShakeDur, false);
        break;
      case "effect": {
        if (this.reducedMotion || !this.sheetReady) break;
        const effect = withWorld(world, () => createEffect(event.effect, event.args, world));
        if (effect) (event.list === "top" ? world.topLevelEffects : world.effectList).push(effect);
        break;
      }
    }
  }

  /** `animX`/`animY` from the running whole-sprite motion. */
  private motionOffset(): { x: number; y: number } {
    if (!this.motion) return { x: 0, y: 0 };
    const { motion, start } = this.motion;
    const progress = ((this.clock - start) * 1000) / motion.durationMs;
    if (progress >= 1) {
      this.motion = null;
      return { x: 0, y: 0 };
    }
    const frames = motion.frames;
    let index = 1;
    while (index < frames.length - 1 && frames[index].offset < progress) index += 1;
    const previous = frames[index - 1];
    const next = frames[index];
    const span = next.offset - previous.offset || 1;
    const t = Math.min(1, Math.max(0, (progress - previous.offset) / span));
    return { x: previous.x + (next.x - previous.x) * t, y: previous.y + (next.y - previous.y) * t };
  }

  private get active(): boolean {
    return Boolean(
      (this.behavior && !this.reducedMotion)
      || this.pending.length
      || this.motion
      || this.world.busy,
    );
  }

  private wake(): void {
    if (this.disposed || this.raf || !this.visible) return;
    this.last = 0;
    this.raf = window.requestAnimationFrame(this.frame);
  }

  private readonly frame = (now: number): void => {
    this.raf = 0;
    if (this.disposed || !this.visible) return;
    const dt = this.last ? Math.min(MAX_FRAME_SECONDS, (now - this.last) / 1000) : 1 / 60;
    this.last = now;
    this.step(dt, now);
    this.render();
    if (this.active) this.raf = window.requestAnimationFrame(this.frame);
    else this.applyTransforms();
  };

  private step(dt: number, now: number): void {
    const world = this.world;
    const monster = world.monster;
    this.clock += dt;
    this.fireDue();
    const offset = this.motionOffset();
    monster.animX = offset.x;
    monster.animY = offset.y;
    world.dt = dt;
    if (this.behavior && !this.reducedMotion) {
      withWorld(world, () => this.behavior?.update(monster));
    }
    refreshHitboxLocation(monster);
    world.update(dt, now);
    this.applyTransforms();
  }

  private applyTransforms(): void {
    const geometry = this.geometry;
    if (!geometry) return;
    const unit = geometry.pxPerUnit;
    const monster = this.world.monster;
    if (this.motionElement) {
      const x = monster.animX * unit;
      const y = -monster.animY * unit;
      this.motionElement.style.transform = x || y ? `translate(${x}px, ${y}px)` : "";
    }
    if (this.shakeElement) {
      const shake = this.world.screenShake.view(this.world.width);
      this.shakeElement.style.transform = shake.dx || shake.dy || shake.scale !== 1
        ? `translate(${shake.dx * unit}px, ${-shake.dy * unit}px) scale(${shake.scale})`
        : "";
    }
  }

  private resizeCanvases(): void {
    const geometry = this.geometry;
    if (!geometry) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    for (const canvas of [this.behindCanvas, this.frontCanvas]) {
      if (!canvas) continue;
      const width = Math.max(1, Math.round(geometry.width * ratio));
      const height = Math.max(1, Math.round(geometry.height * ratio));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
    }
  }

  private render(): void {
    if (!this.sheetReady) return;
    const world = this.world;
    const monster = world.monster;
    const behavior = this.behavior;
    if (this.behind) {
      this.behind.begin(0, 0, world.width, world.height);
      world.renderBehind(this.behind);
      withWorld(world, () => {
        if (this.behind) behavior?.renderBehind?.(this.behind, monster);
        if (this.behind) behavior?.renderBody?.(this.behind, monster);
      });
      this.behind.end();
      if (behavior?.renderBody && !this.bodyDrawn) {
        this.bodyDrawn = true;
        this.callbacks.onBodyDrawn?.();
      }
    }
    if (this.front) {
      this.front.begin(0, 0, world.width, world.height);
      withWorld(world, () => {
        if (this.front) behavior?.renderFront?.(this.front, monster);
      });
      world.renderFront(this.front);
      this.front.end();
    }
  }

  dispose(): void {
    this.disposed = true;
    if (this.raf) window.cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.world.clear();
    withWorld(this.world, () => this.behavior?.dispose?.());
    this.behind?.dispose();
    this.front?.dispose();
    this.behind = null;
    this.front = null;
  }
}

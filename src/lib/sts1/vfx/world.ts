/**
 * The game state STS1's effects read (`Settings`, `AbstractDungeon`,
 * `CardCrawlGame`, `Gdx.graphics`), scoped to one bestiary stage.
 *
 * The game has one screen; the site can show several stages at once, so each
 * stage owns a `VfxWorld` and the globals below read whichever world is
 * updating or drawing right now. The "screen" is the stage: game units with
 * the origin at its bottom-left, `Settings.WIDTH x Settings.HEIGHT` of them.
 */
import type { SpriteBatch } from "./batch";
import type { AbstractGameEffect } from "./effect";
import { Color, Interpolation, MathUtils } from "./gdx";

export interface Hitbox {
  x: number;
  y: number;
  width: number;
  height: number;
  cX: number;
  cY: number;
}

export function hitboxAt(cX: number, cY: number, width: number, height: number): Hitbox {
  return { x: cX - width / 2, y: cY - height / 2, width, height, cX, cY };
}

export function moveHitbox(hb: Hitbox, cX: number, cY: number): void {
  hb.cX = cX;
  hb.cY = cY;
  hb.x = cX - hb.width / 2;
  hb.y = cY - hb.height / 2;
}

/** A Spine bone as the game's 3.x runtime reports it (world values include the skeleton's position). */
export interface BoneView {
  getX(): number;
  getY(): number;
  getWorldX(): number;
  getWorldY(): number;
  getRotation(): number;
  getWorldRotationX(): number;
}

export interface SkeletonView {
  getX(): number;
  getY(): number;
  findBone(name: string): BoneView | null;
}

/** The parts of `AbstractCreature` effects and monster code read. */
export interface Creature {
  hb: Hitbox;
  hb_x: number;
  hb_y: number;
  hb_w: number;
  hb_h: number;
  drawX: number;
  drawY: number;
  animX: number;
  animY: number;
  flipHorizontal: boolean;
  skeleton: SkeletonView | null;
}

export function refreshHitboxLocation(creature: Creature): void {
  moveHitbox(
    creature.hb,
    creature.drawX + creature.hb_x + creature.animX,
    creature.drawY + creature.hb_y + creature.hb_h / 2,
  );
}

export type ShakeIntensity = "LOW" | "MED" | "HIGH";
export type ShakeDur = "SHORT" | "MED" | "LONG" | "XLONG";

const SHAKE_INTENSITY: Record<ShakeIntensity, number> = { LOW: 20, MED: 50, HIGH: 100 };
const SHAKE_DURATION: Record<ShakeDur, number> = { SHORT: 0.3, MED: 0.5, LONG: 1, XLONG: 3 };

/**
 * helpers/ScreenShake. The game resizes its FitViewport by `x` pixels, which
 * shifts the picture by x/2 when it grows and shrinks it toward the center
 * when it narrows; `view()` reports that as a translate and scale.
 */
export class ScreenShake {
  private x = 0;
  private duration = 0;
  private startDuration = 0;
  private intensityValue = 0;
  private intervalSpeed = 0.3;
  private vertical = false;

  shake(intensity: ShakeIntensity, dur: ShakeDur, vertical: boolean): void {
    this.duration = SHAKE_DURATION[dur] ?? 1;
    this.startDuration = this.duration;
    this.intensityValue = SHAKE_INTENSITY[intensity] ?? 100;
    this.vertical = vertical;
    this.intervalSpeed = 0.3;
  }

  rumble(duration: number): void {
    this.duration = duration;
    this.startDuration = duration;
    this.intensityValue = 10;
    this.vertical = false;
    this.intervalSpeed = 0.7;
  }

  mildRumble(duration: number): void {
    this.duration = duration;
    this.startDuration = duration;
    this.intensityValue = 3;
    this.vertical = false;
    this.intervalSpeed = 0.7;
  }

  update(dt: number, nowMs: number): void {
    if (this.duration === 0) {
      this.x = 0;
      return;
    }
    this.duration -= dt;
    if (this.duration < 0) this.duration = 0;
    const amount = Interpolation.fade.apply(0.1, this.intensityValue, this.duration / this.startDuration);
    this.x = MathUtils.cosDeg((nowMs % 360) / this.intervalSpeed) * amount;
    if (this.duration === 0) this.x = 0;
  }

  /** The offset (game units) and zoom the resized viewport gives a `width x height` screen. */
  view(width: number): { dx: number; dy: number; scale: number } {
    if (this.x === 0) return { dx: 0, dy: 0, scale: 1 };
    if (this.vertical) return { dx: 0, dy: Math.abs(this.x) / 2, scale: 1 };
    if (this.x > 0) return { dx: this.x / 2, dy: 0, scale: 1 };
    return { dx: 0, dy: 0, scale: Math.max(0.5, (width + this.x) / width) };
  }
}

function emptyCreature(): Creature {
  return {
    hb: hitboxAt(0, 0, 0, 0),
    hb_x: 0,
    hb_y: 0,
    hb_w: 0,
    hb_h: 0,
    drawX: 0,
    drawY: 0,
    animX: 0,
    animY: 0,
    flipHorizontal: false,
    skeleton: null,
  };
}

function updateList(list: AbstractGameEffect[]): void {
  for (const effect of list.slice()) {
    effect.update();
    if (effect.isDone) {
      effect.dispose();
      const index = list.indexOf(effect);
      if (index >= 0) list.splice(index, 1);
    }
  }
}

export class VfxWorld {
  width = 1920;
  height = 1080;
  floorY = 0;
  dt = 1 / 60;
  nowMs = 0;
  readonly effectList: AbstractGameEffect[] = [];
  readonly effectsQueue: AbstractGameEffect[] = [];
  readonly topLevelEffects: AbstractGameEffect[] = [];
  readonly screenShake = new ScreenShake();
  readonly monster: Creature = emptyCreature();
  readonly player: Creature = emptyCreature();

  update(dt: number, nowMs: number): void {
    withWorld(this, () => {
      this.dt = dt;
      this.nowMs = nowMs;
      this.screenShake.update(dt, nowMs);
      updateList(this.effectList);
      updateList(this.topLevelEffects);
      if (this.effectsQueue.length) {
        this.effectList.push(...this.effectsQueue);
        this.effectsQueue.length = 0;
      }
    });
  }

  /** What the game draws before the room (monsters): effects flagged `renderBehind`. */
  renderBehind(sb: SpriteBatch): void {
    withWorld(this, () => {
      for (const effect of this.effectList) if (effect.renderBehind) effect.render(sb);
    });
  }

  /** What it draws after: the rest of `effectList`, then `topLevelEffects`. */
  renderFront(sb: SpriteBatch): void {
    withWorld(this, () => {
      for (const effect of this.effectList) if (!effect.renderBehind) effect.render(sb);
      for (const effect of this.topLevelEffects) if (!effect.renderBehind) effect.render(sb);
    });
  }

  clear(): void {
    for (const list of [this.effectList, this.effectsQueue, this.topLevelEffects]) {
      for (const effect of list) effect.dispose();
      list.length = 0;
    }
  }

  get busy(): boolean {
    return this.effectList.length + this.effectsQueue.length + this.topLevelEffects.length > 0;
  }
}

let current: VfxWorld | null = null;
const fallback = new VfxWorld();

export function withWorld<T>(world: VfxWorld, run: () => T): T {
  const previous = current;
  current = world;
  try {
    return run();
  } finally {
    current = previous;
  }
}

function world(): VfxWorld {
  return current ?? fallback;
}

export const Gdx = {
  graphics: {
    getDeltaTime(): number {
      return world().dt;
    },
  },
};

export const Settings = {
  scale: 1,
  xScale: 1,
  yScale: 1,
  renderScale: 1,
  get WIDTH(): number {
    return world().width;
  },
  get HEIGHT(): number {
    return world().height;
  },
  SCREEN_SHAKE: true,
  FAST_MODE: false,
  DISABLE_EFFECTS: false,
  CREAM_COLOR: Color.fromRgba8888(-597249),
  LIGHT_YELLOW_COLOR: Color.fromRgba8888(-1202177),
  RED_TEXT_COLOR: Color.fromRgba8888(-10132481),
  GREEN_TEXT_COLOR: Color.fromRgba8888(2147418367),
  BLUE_TEXT_COLOR: Color.fromRgba8888(-2016482305),
  GOLD_COLOR: Color.fromRgba8888(-272084481),
  PURPLE_COLOR: Color.fromRgba8888(-293409025),
  ACTION_DUR_XFAST: 0.1,
  ACTION_DUR_FASTER: 0.2,
  ACTION_DUR_FAST: 0.25,
  ACTION_DUR_MED: 0.5,
  ACTION_DUR_LONG: 1,
  ACTION_DUR_XLONG: 1.5,
};

export const AbstractDungeon = {
  get effectList(): AbstractGameEffect[] {
    return world().effectList;
  },
  get effectsQueue(): AbstractGameEffect[] {
    return world().effectsQueue;
  },
  get topLevelEffects(): AbstractGameEffect[] {
    return world().topLevelEffects;
  },
  get player(): Creature {
    return world().player;
  },
  get floorY(): number {
    return world().floorY;
  },
  sceneOffsetY: 0,
};

/** Sounds are not played on the site; the calls stay so ports read like the game. */
const sound = {
  play(_key: string, _pitchVariation?: number): number {
    return 0;
  },
  playA(_key: string, _pitchAdjust: number): number {
    return 0;
  },
  playV(_key: string, _volume: number): number {
    return 0;
  },
  playAV(_key: string, _pitchAdjust: number, _volume: number): number {
    return 0;
  },
  stop(_key: string): void {},
};

export const CardCrawlGame = {
  sound,
  get screenShake(): ScreenShake {
    return world().screenShake;
  },
};

import { AbstractGameEffect } from "../effect";
import { Color, Interpolation, MathUtils } from "../gdx";
import { AbstractDungeon, Gdx, Settings } from "../world";
import { FireBurstParticleEffect } from "./fire-burst-particle-effect";
import { GhostIgniteEffect } from "./ghost-ignite-effect";
import { GhostlyWeakFireEffect } from "./ghostly-weak-fire-effect";
import { LightFlareParticleEffect } from "./light-flare-particle-effect";

const FIREBALL_INTERVAL = 0.016;

/** vfx/combat/FireballEffect. */
export class FireballEffect extends AbstractGameEffect {
  private x: number;
  private y: number;
  private startX: number;
  private startY: number;
  private targetX: number;
  private targetY: number;
  private vfxTimer = 0;

  constructor(startX: number, startY: number, targetX: number, targetY: number) {
    super();
    this.startingDuration = 0.5;
    this.duration = 0.5;
    this.startX = startX;
    this.startY = startY;
    this.targetX = targetX + MathUtils.random(-20, 20) * Settings.scale;
    this.targetY = targetY + MathUtils.random(-20, 20) * Settings.scale;
    this.x = startX;
    this.y = startY;
  }

  update(): void {
    this.x = Interpolation.fade.apply(this.targetX, this.startX, this.duration / this.startingDuration);
    this.y = Interpolation.fade.apply(this.targetY, this.startY, this.duration / this.startingDuration);
    this.vfxTimer -= Gdx.graphics.getDeltaTime();
    if (this.vfxTimer < 0) {
      this.vfxTimer = FIREBALL_INTERVAL;
      AbstractDungeon.effectsQueue.push(new LightFlareParticleEffect(this.x, this.y, Color.CHARTREUSE));
      AbstractDungeon.effectsQueue.push(new FireBurstParticleEffect(this.x, this.y));
    }
    this.duration -= Gdx.graphics.getDeltaTime();
    if (this.duration < 0) {
      this.isDone = true;
      AbstractDungeon.effectsQueue.push(new GhostIgniteEffect(this.x, this.y));
      AbstractDungeon.effectsQueue.push(new GhostlyWeakFireEffect(this.x, this.y));
    }
  }

  render(): void {}

  dispose(): void {}
}

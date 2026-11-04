import { AbstractGameEffect } from "../effect";
import { MathUtils } from "../gdx";
import { AbstractDungeon, Gdx, Settings } from "../world";
import { BloodShotParticleEffect } from "./blood-shot-particle-effect";

/** vfx/combat/BloodShotEffect. */
export class BloodShotEffect extends AbstractGameEffect {
  private sX: number;
  private sY: number;
  private tX: number;
  private tY: number;
  private count = 0;
  private timer = 0;

  constructor(sX: number, sY: number, tX: number, tY: number, count: number) {
    super();
    this.sX = sX - 20 * Settings.scale;
    this.sY = sY + 80 * Settings.scale;
    this.tX = tX;
    this.tY = tY;
    this.count = count;
  }

  update(): void {
    this.timer -= Gdx.graphics.getDeltaTime();
    if (this.timer < 0) {
      this.timer += MathUtils.random(0.05, 0.15);
      AbstractDungeon.effectsQueue.push(new BloodShotParticleEffect(this.sX, this.sY, this.tX, this.tY));
      this.count -= 1;
      if (this.count === 0) this.isDone = true;
    }
  }

  render(): void {}

  dispose(): void {}
}
